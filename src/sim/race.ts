import type { RaceAudioEvent } from "../audio/raceEvents";
import { CARS, type CarId } from "../data/cars";
import { mergeStats, type PartId } from "../data/parts";
import { DEBUG_PAD_EXTENT_M } from "../data/debugPad";
import { buildTrackFromLevel, sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack, LevelDefinition } from "../track/types";
import { catchUpMultipliers } from "./catchup";
import { stageFromHp } from "./damage";
import { finishLineCross } from "./finishLineCross";
import { countdownPhase, START_COUNTDOWN_SEC, type CountdownPhase } from "./startCountdown";
import { createCarState, grantLapShield, resolveContact, stepCar, type CarState, type DriverInput } from "./vehicle";
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
  /** False in Training: no podium / CHF / place copy. */
  ranked: boolean;
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
  private audioEvents: RaceAudioEvent[] = [];
  private readonly config: RaceConfig;
  private elapsed = 0;
  private wrongWayHold = 0;
  private prevPlayerDrift = 0;
  private driftStyleCooldown = 0;
  private prevPlayerNitro = false;
  private prevPlayerFinished = false;
  private prevWrongWayWarn = false;
  private styleAudioCooldown = 0;
  private countdownLeft = START_COUNTDOWN_SEC;
  private prevCountdownPhase: CountdownPhase | null = null;

  constructor(config: RaceConfig) {
    this.config = config;
    this.level = config.level;
    this.track = buildTrackFromLevel(config.level);
    this.spawnField();
    if (this.track.debugPad) this.countdownLeft = 0;
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

    const start = this.track.debugPad
      ? { position: { x: 0, z: 0 }, tangent: { x: 1, z: 0 } }
      : sampleCenterline(this.track, 8);
    const head = this.track.debugPad ? 0 : Math.atan2(start.tangent.z, start.tangent.x);
    const along = this.track.debugPad ? DEBUG_PAD_EXTENT_M : 8;

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
        distanceAlong: along,
        progress: along,
      }),
    );

    if (this.track.debugPad || this.level.kind === "training") return;

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
    const drift = Math.abs(err) > 0.35 && car.speed > 12;
    return { throttle: 0.85, brake: Math.abs(err) > 0.9 ? 0.35 : 0, steer, nitro, drift };
  }

  private addStyle(amount: number, reason: string): void {
    if (this.level.kind === "training") return;
    const before = this.styleBonus;
    this.styleBonus = Math.min(STYLE_CAP, this.styleBonus + amount);
    const gained = this.styleBonus - before;
    if (gained <= 0) return;
    this.styleEvents.push({ amount: gained, reason });
    if (this.styleAudioCooldown <= 0) {
      this.pushAudio({ kind: "style" });
      this.styleAudioCooldown = 0.35;
    }
  }

  /** Drain style events for HUD popups (CONCEPT §9). */
  consumeStyleEvents(): StyleEvent[] {
    const events = this.styleEvents;
    this.styleEvents = [];
    return events;
  }

  /** Drain race SFX cues for the audio bus. */
  consumeAudioEvents(): RaceAudioEvent[] {
    const events = this.audioEvents;
    this.audioEvents = [];
    return events;
  }

  private pushAudio(ev: RaceAudioEvent): void {
    this.audioEvents.push(ev);
  }

  /** True while 3…2…1…GO hold is active (cars frozen). */
  isCountingDown(): boolean {
    return this.countdownLeft > 0;
  }

  /** Current big-HUD label, or `null` after GO finishes. */
  countdownLabel(): CountdownPhase | null {
    return countdownPhase(this.countdownLeft);
  }

  /** End the start hold immediately (tests / forced finish paths). */
  clearStartCountdown(): void {
    this.countdownLeft = 0;
  }

  step(dt: number, playerInput: DriverInput): void {
    if (this.done) return;
    if (this.countdownLeft > 0) {
      this.countdownLeft = Math.max(0, this.countdownLeft - dt);
      // After the final tick (left → 0), still fire GO if we never entered that second.
      const phase: CountdownPhase | null =
        this.countdownLeft > 0 ? countdownPhase(this.countdownLeft) : "GO";
      if (phase && phase !== this.prevCountdownPhase) {
        this.pushAudio({ kind: "countdown", phase });
        this.prevCountdownPhase = phase;
      }
      return;
    }
    this.elapsed += dt;
    if (this.styleAudioCooldown > 0) this.styleAudioCooldown -= dt;

    // Places by progress
    const ordered = [...this.cars].sort((a, b) => b.progress - a.progress);
    ordered.forEach((c, i) => {
      c.place = i + 1;
    });

    for (const car of this.cars) {
      if (car.finished) continue;
      const input = car.isPlayer ? playerInput : this.aiInput(car);
      const catchUp = catchUpMultipliers(car.place, this.cars.length);
      const prevKo = car.koTimer > 0;
      const stepped = stepCar(car, input, this.track, dt, catchUp, this.level.obstacles);
      if (car.isPlayer && stepped.hitWall) {
        this.pushAudio({ kind: "wall", hard: car.speed > 14 });
      }
      if (car.isPlayer && !prevKo && car.koTimer > 0) {
        this.pushAudio({ kind: "ko" });
      }

      // Lap / finish via crossing start line (forward +1, wrong-way −1, may go negative)
      if (!this.track.debugPad) {
        const prevAlong = this.prevProgress.get(car.id) ?? car.distanceAlong;
        const along = car.distanceAlong;
        const cross = finishLineCross(prevAlong, along, this.track.totalLength, car.speed);
        if (cross === "forward") {
          car.lap += 1;
          if (car.lap <= this.level.laps) {
            grantLapShield(car);
            if (car.isPlayer) {
              this.addStyle(15, "Schild!");
              this.pushAudio({ kind: "shield" });
              this.addStyle(20, "Runde!");
              this.pushAudio({ kind: "lap" });
            }
          }
        } else if (cross === "backward") {
          car.lap -= 1;
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
        if (car.koTimer > 0 && car.hp <= 0) {
          const s = sampleCenterline(this.track, Math.max(0, along - 8));
          car.x = s.position.x;
          car.z = s.position.z;
          car.heading = Math.atan2(s.tangent.z, s.tangent.x);
        }
        this.prevProgress.set(car.id, along);
      }
    }

    const playerCar = this.player();
    if (!this.track.debugPad && !playerCar.finished && playerCar.koTimer <= 0) {
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

    // Drift-Style lightly dosed (CONCEPT §4.8) — reward exiting a held powerslide
    if (this.driftStyleCooldown > 0) this.driftStyleCooldown -= dt;
    if (
      !player.finished &&
      player.koTimer <= 0 &&
      this.prevPlayerDrift > 0.45 &&
      player.drift < 0.25 &&
      this.driftStyleCooldown <= 0
    ) {
      this.addStyle(12, "Drift!");
      this.driftStyleCooldown = 2.2;
    }
    this.prevPlayerDrift = player.drift;

    if (this.elapsed > 1.5) {
      for (let i = 0; i < this.cars.length; i++) {
        for (let j = i + 1; j < this.cars.length; j++) {
          const a = this.cars[i]!;
          const b = this.cars[j]!;
          if (resolveContact(a, b) && (a.isPlayer || b.isPlayer)) {
            this.pushAudio({ kind: "contact" });
          }
        }
      }
    }

    // Rising-edge player cues (nitro / finish / wrong-way)
    const boosting = player.nitroHeld;
    if (boosting && !this.prevPlayerNitro) this.pushAudio({ kind: "nitro" });
    this.prevPlayerNitro = boosting;

    if (player.finished && !this.prevPlayerFinished) this.pushAudio({ kind: "finish" });
    this.prevPlayerFinished = player.finished;

    const wrongWarn = shouldShowWrongWayWarning(this.wrongWayHold);
    if (wrongWarn && !this.prevWrongWayWarn) this.pushAudio({ kind: "wrongWay" });
    this.prevWrongWayWarn = wrongWarn;

    if (this.cars.every((c) => c.finished) || (this.cars.find((c) => c.isPlayer)?.finished && this.finishedCount >= 1)) {
      // End when player finished (others may still run briefly)
      if (player.finished) this.done = true;
    }
  }

  result(): RaceResult {
    const player = this.cars.find((c) => c.isPlayer)!;
    const ranked = this.level.kind !== "training";
    const place = ranked ? player.finishPlace || player.place : 0;
    const purse = ranked ? (this.level.rewards.placePurse[place - 1] ?? 60) : 0;
    const style = ranked ? Math.min(STYLE_CAP, this.styleBonus) : 0;
    return {
      place,
      purseChf: purse + style,
      styleBonus: style,
      starsEarned: ranked && this.level.rewards.starsOnTop3 && place <= 3,
      ranked,
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
    this.pushAudio({ kind: "finish" });
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
