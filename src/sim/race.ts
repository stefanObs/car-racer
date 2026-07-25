import { CARS, type CarId } from "../data/cars";
import { mergeStats, type PartId } from "../data/parts";
import { buildTrackFromLevel, sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack, LevelDefinition } from "../track/types";
import { catchUpMultipliers } from "./catchup";
import { stageFromHp } from "./damage";
import { createCarState, resolveContact, stepCar, type CarState, type DriverInput } from "./vehicle";

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

export class RaceSession {
  readonly track: BuiltTrack;
  readonly level: LevelDefinition;
  cars: CarState[] = [];
  finishedCount = 0;
  styleBonus = 0;
  done = false;
  private prevProgress = new Map<string, number>();
  private readonly config: RaceConfig;
  private elapsed = 0;

  constructor(config: RaceConfig) {
    this.config = config;
    this.level = config.level;
    this.track = buildTrackFromLevel(config.level);
    this.spawnField();
  }

  private spawnField(): void {
    const grid = this.level.spawn.grid;
    const playerStats = mergeStats(CARS[this.config.playerCarId].stats, this.config.playerParts);

    const aiSpecs: Array<{ id: string; paint: string; carId: CarId; skill: number }> = [
      { id: "ai-felix", paint: "#339af0", carId: "blitz", skill: 0.82 },
      { id: "ai-dana", paint: "#f08c00", carId: "bison", skill: 0.88 },
      { id: "ai-dino", paint: "#ae3ec9", carId: "blitz", skill: 0.75 },
      { id: "ai-ben", paint: "#868e96", carId: "bison", skill: 0.85 },
      { id: "ai-olli", paint: "#e67700", carId: "blitz", skill: 0.9 },
    ];

    const playerSlot = grid[0] ?? [-8, 0];
    void playerSlot;
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
        stats: playerStats,
        distanceAlong: 8,
        progress: 8,
      }),
    );

    aiSpecs.forEach((ai, index) => {
      const along = 2 + index * 7;
      const s = sampleCenterline(this.track, along);
      const stats = mergeStats(CARS[ai.carId].stats, index % 2 === 0 ? ["big_wheels"] : ["reinforced_frame"]);
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
          sticker: "none",
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
      const prevHp = car.hp;
      stepCar(car, input, this.track, dt, catchUp);
      if (car.isPlayer && car.hp < prevHp - 0.01) {
        // no style for eating wall
      }

      // Lap / finish via crossing start line
      const prevAlong = this.prevProgress.get(car.id) ?? car.distanceAlong;
      const along = car.distanceAlong;
      if (prevAlong > this.track.totalLength * 0.75 && along < this.track.totalLength * 0.25 && car.speed > 2) {
        car.lap += 1;
        if (car.isPlayer) this.styleBonus += 20;
      }
      car.progress = along + (car.lap - 1) * this.track.totalLength;
      if (car.lap > this.level.laps && !car.finished) {
        car.finished = true;
        this.finishedCount += 1;
        car.finishPlace = this.finishedCount;
        car.speed = 0;
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

    if (this.elapsed > 1.5) {
      for (let i = 0; i < this.cars.length; i++) {
        for (let j = i + 1; j < this.cars.length; j++) {
          resolveContact(this.cars[i]!, this.cars[j]!);
        }
      }
    }

    if (this.cars.every((c) => c.finished) || (this.cars.find((c) => c.isPlayer)?.finished && this.finishedCount >= 1)) {
      // End when player finished (others may still run briefly)
      const player = this.cars.find((c) => c.isPlayer);
      if (player?.finished) this.done = true;
    }
  }

  result(): RaceResult {
    const player = this.cars.find((c) => c.isPlayer)!;
    const place = player.finishPlace || player.place;
    const purse = this.level.rewards.placePurse[place - 1] ?? 60;
    const style = Math.min(120, this.styleBonus);
    return {
      place,
      purseChf: purse + style,
      styleBonus: style,
      starsEarned: this.level.rewards.starsOnTop3 && place <= 3,
    };
  }

  player(): CarState {
    return this.cars.find((c) => c.isPlayer)!;
  }

  playerDamageStage() {
    return stageFromHp(this.player().hp);
  }
}
