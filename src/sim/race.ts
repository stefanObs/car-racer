import { CARS, type CarId } from "../data/cars";
import { mergeStats, type PartId } from "../data/parts";
import { buildTrackFromLevel, sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack, LevelDefinition } from "../track/types";
import { catchUpMultipliers } from "./catchup";
import { stageFromHp } from "./damage";
import { createCarState, resolveContact, stepCar, type CarState, type DriverInput } from "./vehicle";
import { isCarFacingWrongWay, shouldShowWrongWayWarning, tickWrongWayHold } from "./wrongWay";

export interface RaceConfig {
  level: LevelDefinition;
  playerCarId: CarId;
  playerParts: PartId[];
  playerPaint: string;
  playerSticker: string;
}

export interface RaceResult {
  place: number;
  purseChf: number;
  styleBonus: number;
  starsEarned: boolean;
}

export type StyleEvent = { amount: number; reason: string };

const STYLE_CAP = 120;

export class RaceSession {
  readonly track: BuiltTrack;
  readonly level: LevelDefinition;
  cars: CarState[] = [];
  finishedCount = 0;
  styleBonus = 0;
  done = false;
  private prevProgress = new Map<string, number>();
  private prevPlace = new Map<string, number>();
  private styleEvents: StyleEvent[] = [];
  private readonly config: RaceConfig;
  private elapsed = 0;
  private wrongWayHold = 0;

  constructor(config: RaceConfig) {
    this.config = config;
    this.level = config.level;
    this.track = buildTrackFromLevel(config.level);
    this.spawnField();
  }

  private spawnField(): void {
    const playerStats = mergeStats(CARS[this.config.playerCarId].stats, this.config.playerParts);

    const aiSpecs: Array<{ id: string; paint: string; carId: CarId; skill: number }> = [
      { id: "ai-felix", paint: "#339af0", carId: "blitz", skill: 0.82 },
      { id: "ai-dana", paint: "#2f9e44", carId: "bison", skill: 0.88 },
      { id: "ai-dino", paint: "#12b886", carId: "kaeferkraft", skill: 0.75 },
      { id: "ai-ben", paint: "#1c7ed6", carId: "donnerbuechse", skill: 0.85 },
      { id: "ai-olli", paint: "#868e96", carId: "bunker", skill: 0.9 },
    ];

    const start = sampleCenterline(this.track, 8);
    const head = Math.atan2(start.tangent.z, start.tangent.x);

    this.cars.push(
      createCarState({
        id: "player",
        isPlayer: true,
        x: start.position.x,
        z: start.position.z,
        heading: head,
        paint: this.config.playerPaint,
        sticker: this.config.playerSticker,
        modelId: this.config.playerCarId,
        equippedParts: this.config.playerParts,
        stats: playerStats,
        distanceAlong: 8,
        progress: 8,
      }),
    );

    aiSpecs.forEach((ai, index) => {
      const along = 2 + index * 7;
      const s = sampleCenterline(this.track, along);
      const aiParts: PartId[] = index % 2 === 0 ? ["big_wheels"] : ["reinforced_frame"];
      const stats = mergeStats(CARS[ai.carId].stats, aiParts);
      stats.accel *= ai.skill;
      stats.topSpeed *= 0.92 + ai.skill * 0.08;
      const side = index % 2 === 0 ? -1.5 : 1.5;
      this.cars.push(
        createCarState({
          id: ai.id,
          isPlayer: false,
          x: s.position.x - s.tangent.z * side,
          z: s.position.z + s.tangent.x * side,
          heading: Math.atan2(s.tangent.z, s.tangent.x),
          paint: ai.paint,
          sticker: (["flames", "bolt", "star", "none", "flames"] as const)[index % 5]!,
          modelId: ai.carId,
          equippedParts: aiParts,
          stats,
          distanceAlong: along,
          progress: along,
        }),
      );
    });
  }

  private aiInput(car: CarState): DriverInput {
    const look = sampleCenterline(this.track, car.progress % this.track.totalLength + 14);
    const dx = look.position.x - car.x;
    const dz = look.position.z - car.z;
    const desired = Math.atan2(dz, dx);
    let err = desired - car.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, err * 1.6));
    const nitro = car.nitro > 0.5 && Math.abs(err) < 0.25 && car.speed > 10;
    return { throttle: 0.85, brake: Math.abs(err) > 0.9 ? 0.35 : 0, steer, nitro };
  }

  private addStyle(amount: number, reason: string): void {
    const before = this.styleBonus;
    this.styleBonus = Math.min(STYLE_CAP, this.styleBonus + amount);
    const gained = this.styleBonus - before;
    if (gained > 0) this.styleEvents.push({ amount: gained, reason });
  }

  /** Drain style events for HUD popups (CONCEPT §9). */
  consumeStyleEvents(): StyleEvent[] {
    const events = this.styleEvents;
    this.styleEvents = [];
    return events;
  }

  step(dt: number, playerInput: DriverInput): void {
    if (this.done) return;
    this.elapsed += dt;

    // Places by progress
    const ordered = [...this.cars].sort((a, b) => b.progress - a.progress);
    ordered.forEach((c, i) => {
      c.place = i + 1;
    });

    for (const car of this.cars) {
      if (car.finished) continue;
      const input = car.isPlayer ? playerInput : this.aiInput(car);
      const catchUp = catchUpMultipliers(car.place, this.cars.length);
      stepCar(car, input, this.track, dt, catchUp, this.level.obstacles);

      // Lap / finish via crossing start line
      const prevAlong = this.prevProgress.get(car.id) ?? car.distanceAlong;
      const along = car.distanceAlong;
      if (prevAlong > this.track.totalLength * 0.75 && along < this.track.totalLength * 0.25 && car.speed > 2) {
        car.lap += 1;
        if (car.isPlayer) this.addStyle(20, "Runde!");
      }
      car.progress = along + (car.lap - 1) * this.track.totalLength;
      if (car.lap > this.level.laps && !car.finished) {
        car.finished = true;
        this.finishedCount += 1;
        car.finishPlace = this.finishedCount;
        car.speed = 0;
        car.vx = 0;
        car.vz = 0;
        car.vy = 0;
        car.y = 0;
      }
      // KO respawn snap to track
      if (car.koTimer > 0 && car.hp <= 0) {
        const s = sampleCenterline(this.track, Math.max(0, along - 8));
        car.x = s.position.x;
        car.z = s.position.z;
        car.heading = Math.atan2(s.tangent.z, s.tangent.x);
      }
      this.prevProgress.set(car.id, along);
    }

    const playerCar = this.player();
    if (!playerCar.finished && playerCar.koTimer <= 0) {
      this.wrongWayHold = tickWrongWayHold(
        this.wrongWayHold,
        isCarFacingWrongWay(playerCar, this.track),
        dt,
      );
    } else {
      this.wrongWayHold = 0;
    }

    // Recompute places after movement; reward clean overtakes (not ramming score)
    const after = [...this.cars].sort((a, b) => b.progress - a.progress);
    after.forEach((c, i) => {
      c.place = i + 1;
    });
    const player = this.player();
    const prevPlace = this.prevPlace.get(player.id) ?? player.place;
    if (!player.finished && player.place < prevPlace) {
      this.addStyle(25, "Überholt!");
    }
    this.prevPlace.set(player.id, player.place);

    if (this.elapsed > 1.5) {
      for (let i = 0; i < this.cars.length; i++) {
        for (let j = i + 1; j < this.cars.length; j++) {
          resolveContact(this.cars[i]!, this.cars[j]!);
        }
      }
    }

    if (this.cars.every((c) => c.finished) || (this.cars.find((c) => c.isPlayer)?.finished && this.finishedCount >= 1)) {
      // End when player finished (others may still run briefly)
      if (player.finished) this.done = true;
    }
  }

  result(): RaceResult {
    const player = this.cars.find((c) => c.isPlayer)!;
    const place = player.finishPlace || player.place;
    const purse = this.level.rewards.placePurse[place - 1] ?? 60;
    const style = Math.min(STYLE_CAP, this.styleBonus);
    return {
      place,
      purseChf: purse + style,
      styleBonus: style,
      starsEarned: this.level.rewards.starsOnTop3 && place <= 3,
    };
  }

  /** Dev cheat: end the race immediately with a chosen player finish place. */
  forceFinishAs(place: number): void {
    if (this.done) return;
    const n = this.cars.length;
    const playerPlace = Math.max(1, Math.min(n, Math.round(place)));
    const player = this.player();
    player.finished = true;
    player.finishPlace = playerPlace;
    player.place = playerPlace;
    player.lap = this.level.laps + 1;
    player.speed = 0;
    player.vx = 0;
    player.vz = 0;

    let next = 1;
    for (const car of this.cars) {
      if (car.isPlayer) continue;
      if (next === playerPlace) next += 1;
      car.finished = true;
      car.finishPlace = next;
      car.place = next;
      car.lap = this.level.laps + 1;
      car.speed = 0;
      car.vx = 0;
      car.vz = 0;
      next += 1;
    }
    this.finishedCount = n;
    this.done = true;
  }

  player(): CarState {
    return this.cars.find((c) => c.isPlayer)!;
  }

  playerDamageStage() {
    return stageFromHp(this.player().hp);
  }

  /** HUD: sustained reverse travel on the loop. */
  playerWrongWay(): boolean {
    return shouldShowWrongWayWarning(this.wrongWayHold);
  }
}
