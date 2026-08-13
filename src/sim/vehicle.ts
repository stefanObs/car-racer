import type { VehicleStats } from "../data/cars";
import type { CarId } from "../data/cars";
import type { PartId } from "../data/parts";
import { collisionRadiusFor } from "../data/carModels";
import type { BuiltTrack, LevelDefinition } from "../track/types";
import { applyHeal, applyHit, damageMultipliers, stageFromHp, type DamageStage } from "./damage";
import { surfaceAt } from "./zones";

export type TrackObstacle = LevelDefinition["obstacles"][number];

/** Seconds between damage applications from walls/obstacles. */
export const IMPACT_DAMAGE_COOLDOWN = 0.55;
/** Damage immunity after crossing start/finish (CONCEPT §4.5 Runden-Schild). */
export const LAP_SHIELD_DURATION = 2;

export interface DriverInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1
  nitro: boolean;
  /** Hold to enter arcade powerslide while steering (Kart-style). */
  drift?: boolean;
}

export type MergedVehicleStats = VehicleStats & {
  nitroBonus: number;
  ramBonus: number;
  grassMitigation: number;
  brakeBonus: number;
};

export interface CarState {
  id: string;
  x: number;
  z: number;
  /** Height above track (arcade jump / Schanze). */
  y: number;
  heading: number;
  speed: number;
  /** World-space velocity — can slip vs heading (arcade grip). */
  vx: number;
  vz: number;
  /** Vertical velocity while airborne. */
  vy: number;
  /** 0..1 arcade powerslide amount (Mario Kart–style, not tire sim). */
  drift: number;
  /** Seconds continuously in a meaningful drift (for mini-turbo). */
  driftTime: number;
  /** Rising-edge latch for nitro kick. */
  nitroHeld: boolean;
  hp: number;
  nitro: number;
  koTimer: number;
  healFx: number;
  /** Seconds of start-line lap shield (damage immunity). */
  lapShield: number;
  /** Seconds until next wall/obstacle damage tick (prevents grind KO). */
  impactCooldown: number;
  isPlayer: boolean;
  paint: string;
  sticker: string;
  /** Visual / gear archetype (Blitz sport vs Bison pickup). */
  modelId?: CarId | string;
  /** Equipped Teile meshes — visuals only; stats already live in `stats`. */
  equippedParts?: PartId[];
  stats: MergedVehicleStats;
  place: number;
  lap: number;
  checkpoint: number;
  progress: number;
  distanceAlong: number;
  finished: boolean;
  finishPlace: number;
}

/** Arcade pace: punchy but not instant; roomy top end (meters/sec-ish). */
export const BASE_TOP = 34;
export const BASE_ACCEL = 15;
export const BASE_BRAKE = 48;
/** Continuous nitro shove — clearly stronger than throttle. */
export const BASE_NITRO = 125;
/** Instant kick when nitro is pressed (Split/Second-style burst). */
export const NITRO_KICK = 14;
export const GRAVITY = 38;
const DRAG = 0.14;
const COAST_BRAKE = 3.5;
const AIR_STEER_SCALE = 0.35;
const AIRBORNE_EPS = 0.04;
const DRIFT_MIN_SPEED = 11;
const OVERSTEER_MIN_SPEED = 17;
const MINI_TURBO_TIME = 0.45;
const MINI_TURBO_KICK = 8.5;

export function createCarState(
  partial: Omit<
    CarState,
    | "speed"
    | "vx"
    | "vz"
    | "vy"
    | "y"
    | "drift"
    | "driftTime"
    | "nitroHeld"
    | "hp"
    | "nitro"
    | "koTimer"
    | "healFx"
    | "lapShield"
    | "impactCooldown"
    | "place"
    | "lap"
    | "checkpoint"
    | "progress"
    | "distanceAlong"
    | "finished"
    | "finishPlace"
  > &
    Partial<CarState>,
): CarState {
  const heading = partial.heading;
  const speed = partial.speed ?? 0;
  const car: CarState = {
    speed,
    vx: Math.cos(heading) * speed,
    vz: Math.sin(heading) * speed,
    vy: 0,
    y: 0,
    drift: 0,
    driftTime: 0,
    nitroHeld: false,
    hp: 1,
    nitro: 1,
    koTimer: 0,
    healFx: 0,
    lapShield: 0,
    impactCooldown: 0,
    place: 1,
    lap: 1,
    checkpoint: 0,
    progress: 0,
    distanceAlong: 0,
    finished: false,
    finishPlace: 0,
    modelId: "blitz",
    equippedParts: [],
    ...partial,
  };
  if (partial.vx === undefined || partial.vz === undefined) {
    car.vx = Math.cos(car.heading) * car.speed;
    car.vz = Math.sin(car.heading) * car.speed;
  }
  if (partial.y === undefined) car.y = 0;
  if (partial.vy === undefined) car.vy = 0;
  if (partial.drift === undefined) car.drift = 0;
  if (partial.driftTime === undefined) car.driftTime = 0;
  if (partial.nitroHeld === undefined) car.nitroHeld = false;
  if (partial.lapShield === undefined) car.lapShield = 0;
  return car;
}

export function isAirborne(car: CarState): boolean {
  return car.y > AIRBORNE_EPS || car.vy > 0.5;
}

export function grantLapShield(car: CarState, duration = LAP_SHIELD_DURATION): void {
  car.lapShield = Math.max(car.lapShield, duration);
}

export function isLapShieldActive(car: Pick<CarState, "lapShield">): boolean {
  return car.lapShield > 0;
}

/** Apply hit unless Runden-Schild is up (shove/bounce still apply elsewhere). */
export function damageCar(car: CarState, amount: number): boolean {
  if (isLapShieldActive(car) || amount <= 0) return false;
  const prev = car.hp;
  car.hp = applyHit(car.hp, amount, car.stats.armor);
  return car.hp < prev;
}

/**
 * Arcade yaw: responsive at low/mid speed, settles at high speed (racing feel).
 * Turning circle from Handling (+ Masse widens it). Grip is for slide, not yaw.
 * During powerslide, yaw opens up (Kart-style swing).
 * CONCEPT §4.2 — Gewicht + Grip + Impuls, kein Drift-Sim.
 */
export function yawRateFor(opts: {
  steer: number;
  speed: number;
  handling: number;
  mass: number;
  gripFactor: number;
  handlingMult: number;
  airborne?: boolean;
  drift?: number;
}): number {
  const massCut = 1 / (0.82 + 0.18 * opts.mass);
  const surfaceSteer = 0.55 + 0.45 * opts.gripFactor;
  const drift = opts.drift ?? 0;
  // Mild extra yaw while sliding — huge multipliers made the nose whip wrong vs motion
  const driftYaw = 1 + drift * 0.55;
  const auth =
    opts.steer *
    (1.9 + opts.handling * 1.2) *
    opts.handlingMult *
    surfaceSteer *
    massCut *
    driftYaw;
  const speedBuild = 0.4 + 0.6 * Math.min(1, opts.speed / 7);
  const highSpeedCut = 1 / (1 + (opts.speed / 24) ** 2.15);
  const air = opts.airborne ? AIR_STEER_SCALE : 1;
  return auth * speedBuild * highSpeedCut * air;
}

/** Brake force from Handling + brakeBonus; heavier cars stop a bit slower. */
export function brakeForceFor(stats: Pick<MergedVehicleStats, "handling" | "mass" | "brakeBonus">): number {
  const handlingBoost = 0.72 + 0.4 * stats.handling;
  const massCut = 1 / (0.88 + 0.12 * stats.mass);
  return BASE_BRAKE * handlingBoost * (1 + stats.brakeBonus) * massCut;
}

/** Nitro continuous shove — scaled by nitroBonus (Hot Rod / Nitro-Kit). */
export function nitroForceFor(nitroBonus: number, nitroMult: number): number {
  return (BASE_NITRO + nitroBonus * 70) * nitroMult;
}

/** Instant nitro engage kick. */
export function nitroKickFor(nitroBonus: number, nitroMult: number): number {
  return (NITRO_KICK + nitroBonus * 8) * nitroMult;
}

/**
 * How committed the car is to an arcade powerslide (0..1).
 * Drift button → intentional slide; high speed + hard steer → forced oversteer.
 */
export function driftIntent(opts: {
  driftHeld: boolean;
  steer: number;
  speed: number;
  throttle: number;
  grip: number;
  gripFactor: number;
  airborne: boolean;
}): number {
  if (opts.airborne || opts.speed < DRIFT_MIN_SPEED) return 0;
  const steerAmt = Math.abs(opts.steer);
  if (steerAmt < 0.12) return 0;
  const gripEase = Math.max(0.55, Math.min(1.6, 1.6 - opts.grip * opts.gripFactor * 0.7));
  const speedT = Math.min(1, (opts.speed - DRIFT_MIN_SPEED) / 12);
  const steerT = Math.min(1, steerAmt / 0.75);

  if (opts.driftHeld) {
    const raw = 0.42 + steerT * 0.45 * (0.5 + 0.5 * speedT) * gripEase;
    return Math.max(0, Math.min(1, raw));
  }

  // Forced oversteer: full gas + hard turn at high speed (Grip resists)
  if (opts.throttle < 0.45 || steerAmt < 0.55 || opts.speed < OVERSTEER_MIN_SPEED) return 0;
  const overT = Math.min(1, (opts.speed - OVERSTEER_MIN_SPEED) / 10);
  const raw = (0.28 + steerT * 0.6 * overT) * gripEase;
  return Math.max(0, Math.min(0.92, raw));
}

/** How hard lateral velocity is pulled back toward the nose (higher = less slide). */
export function gripPullRate(opts: {
  grip: number;
  gripFactor: number;
  damageGrip: number;
  steerLoad: number;
  airborne: boolean;
  drift?: number;
}): number {
  if (opts.airborne) return 0.35;
  const gripStat = opts.grip * opts.gripFactor * opts.damageGrip;
  const base = (3.4 + gripStat * 6.2) * (1 - opts.steerLoad * 0.55);
  const driftCut = 1 - Math.min(0.95, (opts.drift ?? 0) * 0.98);
  return Math.max(0.15, base * driftCut);
}

function syncSpeedFromVelocity(car: CarState): void {
  car.speed = Math.hypot(car.vx, car.vz);
}

export function stepCar(
  car: CarState,
  input: DriverInput,
  track: BuiltTrack,
  dt: number,
  catchUp: { accel: number; topSpeed: number },
  obstacles: TrackObstacle[] = [],
): { hitWall: boolean; stage: DamageStage } {
  if (car.finished) {
    return { hitWall: false, stage: stageFromHp(car.hp) };
  }

  if (car.koTimer > 0) {
    car.koTimer -= dt;
    car.speed = 0;
    car.vx = 0;
    car.vz = 0;
    car.vy = 0;
    car.y = 0;
    car.drift = 0;
    car.driftTime = 0;
    car.nitroHeld = false;
    if (car.koTimer <= 0) {
      car.hp = 1;
      car.healFx = 0.6;
    }
    return { hitWall: false, stage: 4 };
  }

  const stage = stageFromHp(car.hp);
  const dmg = damageMultipliers(stage);
  const airborne = isAirborne(car);
  const surface = surfaceAt(
    track,
    car.x,
    car.z,
    car.stats.grassMitigation,
    car.stats.suspension,
  );
  const passable = passableObstacleMods(car.x, car.z, obstacles);
  surface.gripFactor *= passable.gripMul;
  surface.bump = Math.min(1, surface.bump + passable.bumpAdd);

  const intent = driftIntent({
    driftHeld: Boolean(input.drift),
    steer: input.steer,
    speed: car.speed,
    throttle: input.throttle,
    grip: car.stats.grip,
    gripFactor: surface.gripFactor * dmg.grip,
    airborne,
  });
  // Smooth into / out of powerslide (gentler than a snap, still exits in ~0.2s)
  const driftLerp =
    intent > car.drift ? 1 - Math.exp(-11 * dt) : 1 - Math.exp(-(intent < 0.05 ? 11 : 7) * dt);
  const prevDrift = car.drift;
  const prevDriftTime = car.driftTime;
  car.drift = car.drift + (intent - car.drift) * driftLerp;
  if (car.drift > 0.25) car.driftTime += dt;
  else car.driftTime = Math.max(0, car.driftTime - dt * 2);

  // Mini-turbo when a charged slide ends (button release or easing out of oversteer)
  if (prevDrift > 0.35 && intent < 0.15 && prevDriftTime >= MINI_TURBO_TIME && !airborne) {
    const hxKick = Math.cos(car.heading);
    const hzKick = Math.sin(car.heading);
    const spd = Math.hypot(car.vx, car.vz);
    const kick = MINI_TURBO_KICK * (0.85 + 0.2 * Math.min(1, prevDriftTime));
    // Realign onto nose so exit keeps the slide speed + boost
    car.vx = hxKick * (spd + kick);
    car.vz = hzKick * (spd + kick);
    car.driftTime = 0;
  }

  const boosting = input.nitro && car.nitro > 0 && stage < 4;
  const nitroHeadroom = boosting ? 1.42 + car.stats.nitroBonus * 0.5 : 1;
  const top =
    BASE_TOP *
    car.stats.topSpeed *
    dmg.topSpeed *
    (airborne ? 1 : surface.speedFactor) *
    catchUp.topSpeed *
    nitroHeadroom *
    (airborne ? 1 : 1 - surface.bump * 0.22);

  const throttle = airborne ? input.throttle * 0.55 : input.throttle;
  const accel =
    BASE_ACCEL * car.stats.accel * catchUp.accel * (throttle > 0 ? throttle : 0);

  const hx = Math.cos(car.heading);
  const hz = Math.sin(car.heading);

  // Drive / nitro along nose
  car.vx += hx * accel * dt;
  car.vz += hz * accel * dt;
  if (boosting) {
    const justPressed = !car.nitroHeld;
    if (justPressed) {
      const kick = nitroKickFor(car.stats.nitroBonus, dmg.nitro);
      car.vx += hx * kick;
      car.vz += hz * kick;
    }
    const nitroPush = nitroForceFor(car.stats.nitroBonus, dmg.nitro);
    car.vx += hx * nitroPush * dt;
    car.vz += hz * nitroPush * dt;
    const drain = 0.38 + car.stats.nitroBonus * 0.18;
    car.nitro = Math.max(0, car.nitro - drain * dt);
  } else {
    car.nitro = Math.min(1, car.nitro + 0.1 * dt);
  }
  car.nitroHeld = boosting;

  syncSpeedFromVelocity(car);
  if (car.speed > 1e-4) {
    const fx = car.vx / car.speed;
    const fz = car.vz / car.speed;
    const brake = airborne ? input.brake * 0.25 : input.brake;
    // Light brake while drifting is for slide initiation, not full stop
    const brakeEff = car.drift > 0.35 ? brake * 0.35 : brake;
    let scrub = car.speed * DRAG * (boosting ? 0.35 : 1) * dt;
    if (brakeEff > 0) scrub += brakeEff * brakeForceFor(car.stats) * dt;
    if (input.throttle < 0.05 && !boosting && !airborne && car.drift < 0.25) {
      scrub += COAST_BRAKE * dt;
    }
    // Powerslide / exit keep more pace (Kart) — mild scrub only
    if (car.drift > 0.12) scrub *= 1 - Math.min(0.45, car.drift * 0.4 + 0.08);
    const next = Math.max(0, car.speed - scrub);
    car.vx = fx * next;
    car.vz = fz * next;
    car.speed = next;
  }

  syncSpeedFromVelocity(car);
  if (car.speed > top && car.speed > 1e-6) {
    const s = top / car.speed;
    car.vx *= s;
    car.vz *= s;
    car.speed = top;
  }

  // Steering + lateral grip (velocity can slip vs heading)
  const turnRate = yawRateFor({
    steer: input.steer,
    speed: car.speed,
    handling: car.stats.handling,
    mass: car.stats.mass,
    gripFactor: airborne ? 0.7 : surface.gripFactor,
    handlingMult: dmg.handling,
    airborne,
    drift: car.drift,
  });
  car.heading += turnRate * dt;
  const hx2 = Math.cos(car.heading);
  const hz2 = Math.sin(car.heading);
  const steerLoad = Math.abs(input.steer) * Math.min(1, car.speed / 16);
  const gripPull = gripPullRate({
    grip: car.stats.grip,
    gripFactor: surface.gripFactor,
    damageGrip: dmg.grip,
    steerLoad,
    airborne,
    drift: car.drift,
  });
  const pull = 1 - Math.exp(-Math.max(0.25, gripPull) * dt);
  // Rotate velocity toward the nose (preserve pace) — killing lateral dumped speed on exit
  const spdBefore = Math.hypot(car.vx, car.vz);
  if (spdBefore > 1e-4) {
    const moveAng = Math.atan2(car.vz, car.vx);
    const dAng = Math.atan2(Math.sin(car.heading - moveAng), Math.cos(car.heading - moveAng));
    const newAng = moveAng + dAng * pull;
    car.vx = Math.cos(newAng) * spdBefore;
    car.vz = Math.sin(newAng) * spdBefore;
  }

  // Feed the slide OUTWARD (rear kicks to the outside of the turn)
  if (car.drift > 0.15 && !airborne && Math.abs(input.steer) > 0.1) {
    const side = Math.sign(input.steer) || 1;
    // Right of heading when turning left (steer+), and vice versa
    const lx = hz2 * side;
    const lz = -hx2 * side;
    const feed = car.speed * car.drift * 4.2 * dt;
    car.vx += lx * feed;
    car.vz += lz * feed;
  }

  // Very mild pace cost from slip — exit must not feel like a brake tap
  const forward = car.vx * hx2 + car.vz * hz2;
  const latMag = Math.hypot(car.vx - hx2 * forward, car.vz - hz2 * forward);
  if (!airborne && latMag > 0.8) {
    const scrub = 1 - Math.min(0.028, latMag * 0.0012) * (1 - car.drift * 0.9);
    car.vx *= scrub;
    car.vz *= scrub;
  }
  syncSpeedFromVelocity(car);
  car.speed = Math.max(0, car.speed);

  // Uneven wobble (ground only)
  if (!airborne && surface.bump > 0.05) {
    car.heading += Math.sin(surface.distanceAlong * 0.35) * surface.bump * 0.45 * dt;
    const bumpCut = 1 - surface.bump * 0.12 * dt * 4;
    car.vx *= bumpCut;
    car.vz *= bumpCut;
    syncSpeedFromVelocity(car);
  }

  // Schanze launch / airtime / landing (CONCEPT §4.6)
  stepJump(car, passable.rampLaunch, dt);

  // Integrate along velocity (slip = racing feel)
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  if (car.impactCooldown > 0) car.impactCooldown = Math.max(0, car.impactCooldown - dt);
  if (car.lapShield > 0) car.lapShield = Math.max(0, car.lapShield - dt);

  // Walls are solid on the ground: project back, bounce velocity inward.
  let hitWall = false;
  if (!isAirborne(car)) {
    const afterMove = surfaceAt(
      track,
      car.x,
      car.z,
      car.stats.grassMitigation,
      car.stats.suspension,
    );
    const wallLimit = track.asphaltHalfWidth + track.grassWidth;
    const overflow = Math.abs(afterMove.lateral) - wallLimit;
    if (overflow > 0) {
      hitWall = applyWallBounce(car, afterMove, overflow);
    }
  }

  const hitObstacle = resolveObstacles(car, obstacles);

  const resolved = surfaceAt(
    track,
    car.x,
    car.z,
    car.stats.grassMitigation,
    car.stats.suspension,
  );

  // Heal
  const interrupted = hitWall || hitObstacle;
  const before = car.hp;
  car.hp = applyHeal(car.hp, dt, interrupted);
  if (car.hp > before) car.healFx = Math.min(1, car.healFx + dt * 2);
  else car.healFx = Math.max(0, car.healFx - dt);

  if (car.hp <= 0) {
    car.koTimer = 3.5;
    car.speed = 0;
    car.vx = 0;
    car.vz = 0;
    car.vy = 0;
    car.y = 0;
    car.drift = 0;
    car.driftTime = 0;
    car.nitroHeld = false;
  }

  // Progress
  car.distanceAlong = resolved.distanceAlong;
  car.progress = resolved.distanceAlong + (car.lap - 1) * track.totalLength;

  return { hitWall: hitWall || hitObstacle, stage: stageFromHp(car.hp) };
}

/** Arcade jump: ramp launches, gravity, grip/suspension soften landings. */
export function stepJump(car: CarState, rampLaunch: number, dt: number): void {
  const grounded = !isAirborne(car);

  if (grounded && rampLaunch > 0.12 && car.speed > 8) {
    // Suspension softens launch a bit (less wild hop); speed & ramp intensity dominate.
    const suspEase = Math.min(0.25, Math.max(0, (car.stats.suspension - 0.7) * 0.2));
    const launch = (6.5 + car.speed * 0.22) * rampLaunch * (1 - suspEase);
    car.vy = Math.max(car.vy, launch);
    car.y = Math.max(car.y, AIRBORNE_EPS + 0.02);
  }

  if (isAirborne(car) || car.vy !== 0) {
    car.vy -= GRAVITY * dt;
    car.y += car.vy * dt;
    if (car.y <= 0) {
      const impact = Math.max(0, -car.vy);
      car.y = 0;
      car.vy = 0;
      // Hard landing → slip; grip + Federung stabilize (CONCEPT §4.6)
      const soft = Math.min(0.75, Math.max(0, (car.stats.suspension - 0.6) * 0.45));
      const gripHold = Math.min(1, car.stats.grip * 0.55);
      const slip = Math.max(0, (impact / 18) * (1 - soft) * (1.15 - gripHold));
      if (slip > 0.02) {
        const side = Math.sign(Math.sin(car.heading * 3.1)) || 1;
        const lx = -Math.sin(car.heading) * side;
        const lz = Math.cos(car.heading) * side;
        car.vx += lx * slip * car.speed * 0.35;
        car.vz += lz * slip * car.speed * 0.35;
        syncSpeedFromVelocity(car);
      }
    }
  }
}

/**
 * Separate from wall, reflect outward velocity back onto the track, apply capped damage.
 * RCA: old code damaged every frame while clamped (no bounce) → KO in ~1.5s grinding.
 */
export function applyWallBounce(
  car: CarState,
  afterMove: ReturnType<typeof surfaceAt>,
  overflow: number,
): boolean {
  const sign = Math.sign(afterMove.lateral) || 1;
  const leftX = -afterMove.tangent.z;
  const leftZ = afterMove.tangent.x;
  const outwardX = sign * leftX;
  const outwardZ = sign * leftZ;

  // Push clearly inside the grass edge so we don't re-hit next frame.
  const push = overflow + 0.2;
  car.x -= outwardX * push;
  car.z -= outwardZ * push;

  let vx = car.vx;
  let vz = car.vz;
  const outwardVel = vx * outwardX + vz * outwardZ;
  const restitution = afterMove.wallKind === "concrete" ? 0.55 : 0.7;
  const suspEase = Math.min(0.2, Math.max(0, (car.stats.suspension - 0.7) * 0.15));
  // Light cars bounce harder; heavy cars dump more speed into the wall.
  const massBounce = 1.15 - Math.min(0.35, car.stats.mass * 0.2);
  if (outwardVel > 0) {
    const bounce = outwardVel * (1 + restitution - suspEase) * massBounce;
    vx -= outwardX * bounce;
    vz -= outwardZ * bounce;
  } else {
    // Scraping: nudge slightly back onto track
    vx -= outwardX * 2;
    vz -= outwardZ * 2;
  }

  const damp = afterMove.wallKind === "concrete" ? 0.52 : 0.68;
  car.vx = vx * damp;
  car.vz = vz * damp;
  syncSpeedFromVelocity(car);
  if (car.speed > 0.05) {
    // Nudge heading toward post-bounce velocity without erasing all slip
    const moveAng = Math.atan2(car.vz, car.vx);
    let err = moveAng - car.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    car.heading += err * 0.65;
  }

  let damaged = false;
  if (car.impactCooldown <= 0) {
    const impact = Math.min(1, Math.max(0, outwardVel) / BASE_TOP);
    const base = afterMove.wallKind === "concrete" ? 0.07 : 0.045;
    const amount = base * (0.35 + 0.65 * impact);
    damaged = damageCar(car, amount);
    car.impactCooldown = IMPACT_DAMAGE_COOLDOWN;
  }
  return damaged || outwardVel > 0.5;
}

/** Solid on-track props: bounce + light damage. Passable oil/uneven/ramp are surface-only. */
export function resolveObstacles(car: CarState, obstacles: TrackObstacle[]): boolean {
  if (car.finished || car.koTimer > 0 || isAirborne(car)) return false;
  let hit = false;
  const carR = collisionRadiusFor(car.modelId);

  for (const o of obstacles) {
    if (o.type === "uneven" || o.type === "oil" || o.type === "ramp") continue;
    const [ox, oz] = o.position;
    const obstR = o.radius ?? (o.type === "tire_stack" ? 1.5 : 1.2);
    const minDist = obstR + carR;
    const dx = car.x - ox;
    const dz = car.z - oz;
    const dist = Math.hypot(dx, dz);
    if (dist >= minDist || dist < 1e-5) continue;

    const nx = dx / dist;
    const nz = dz / dist;
    const overlap = minDist - dist;
    car.x += nx * (overlap + 0.05);
    car.z += nz * (overlap + 0.05);

    // Fixed obstacle ≈ infinite mass; light cars rebound more.
    const into = -(car.vx * nx + car.vz * nz);
    const rest = o.type === "concrete_barrier" ? 0.55 : 0.7;
    const massScale = 1.25 / Math.max(0.5, car.stats.mass);
    if (into > 0) {
      const impulse = into * (1 + rest) * Math.min(1.45, massScale);
      car.vx += nx * impulse;
      car.vz += nz * impulse;
    } else {
      car.vx += nx * 3 * massScale;
      car.vz += nz * 3 * massScale;
    }
    const damp = o.type === "concrete_barrier" ? 0.5 : 0.62;
    car.vx *= damp;
    car.vz *= damp;
    syncSpeedFromVelocity(car);
    if (car.speed > 0.05) {
      const moveAng = Math.atan2(car.vz, car.vx);
      let err = moveAng - car.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      car.heading += err * 0.55;
    }

    if (car.impactCooldown <= 0) {
      const base = o.type === "concrete_barrier" ? 0.055 : 0.035;
      const impact = Math.min(1, car.speed / BASE_TOP);
      damageCar(car, base * (0.4 + 0.6 * impact));
      car.impactCooldown = IMPACT_DAMAGE_COOLDOWN;
    }
    hit = true;
  }
  return hit;
}

/** Passable hazards: oil kills grip; uneven rumble adds bump; ramp can launch. */
export function passableObstacleMods(
  x: number,
  z: number,
  obstacles: TrackObstacle[],
): { gripMul: number; bumpAdd: number; rampLaunch: number } {
  let gripMul = 1;
  let bumpAdd = 0;
  let rampLaunch = 0;
  for (const o of obstacles) {
    const [ox, oz] = o.position;
    const r = o.radius ?? (o.type === "oil" ? 2 : o.type === "ramp" ? 4.5 : 6);
    const dist = Math.hypot(x - ox, z - oz);
    if (dist >= r) continue;
    const t = 1 - dist / r;
    if (o.type === "oil") {
      gripMul = Math.min(gripMul, 0.32 + 0.2 * (1 - t));
    } else if (o.type === "uneven") {
      bumpAdd = Math.max(bumpAdd, (o.intensity ?? 0.55) * t);
    } else if (o.type === "ramp") {
      const intensity = o.intensity ?? 0.9;
      bumpAdd = Math.max(bumpAdd, intensity * t * 0.45);
      rampLaunch = Math.max(rampLaunch, intensity * t);
    }
  }
  return { gripMul, bumpAdd, rampLaunch };
}

/**
 * Car–car contact: mass + relative speed decide shove (CONCEPT §4.5).
 * Light cars get pushed farther; heavy cars hold the line.
 * @returns true when a hard closing impulse was applied (for SFX).
 */
export function resolveContact(a: CarState, b: CarState): boolean {
  if (a.finished || b.finished || a.koTimer > 0 || b.koTimer > 0) return false;
  if (isAirborne(a) || isAirborne(b)) return false;

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const minDist = collisionRadiusFor(a.modelId) + collisionRadiusFor(b.modelId);
  if (dist >= minDist || dist < 1e-4) return false;

  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;
  const totalMass = a.stats.mass + b.stats.mass;
  a.x -= (nx * overlap * b.stats.mass) / totalMass;
  a.z -= (nz * overlap * b.stats.mass) / totalMass;
  b.x += (nx * overlap * a.stats.mass) / totalMass;
  b.z += (nz * overlap * a.stats.mass) / totalMass;

  const relVx = a.vx - b.vx;
  const relVz = a.vz - b.vz;
  const closing = relVx * nx + relVz * nz;
  if (closing <= 0.4) {
    // Separating or soft jostle — separation only
    return false;
  }

  const restitution = 0.35;
  const invA = 1 / Math.max(0.35, a.stats.mass);
  const invB = 1 / Math.max(0.35, b.stats.mass);
  const ram = 1 + (a.stats.ramBonus + b.stats.ramBonus) * 0.35;
  const impulse = ((1 + restitution) * closing * ram) / (invA + invB);

  a.vx -= impulse * invA * nx;
  a.vz -= impulse * invA * nz;
  b.vx += impulse * invB * nx;
  b.vz += impulse * invB * nz;
  syncSpeedFromVelocity(a);
  syncSpeedFromVelocity(b);

  const hit = 0.01 + closing * 0.0035 + (a.stats.ramBonus + b.stats.ramBonus) * 0.01;
  damageCar(a, (hit * b.stats.mass) / totalMass);
  damageCar(b, (hit * a.stats.mass) / totalMass);
  return true;
}
