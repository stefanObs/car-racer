import type { VehicleStats } from "../data/cars";
import type { CarId } from "../data/cars";
import { collisionRadiusFor } from "../data/carModels";
import type { BuiltTrack, LevelDefinition } from "../track/types";
import { applyHeal, applyHit, damageMultipliers, stageFromHp, type DamageStage } from "./damage";
import { surfaceAt } from "./zones";

export type TrackObstacle = LevelDefinition["obstacles"][number];

/** Seconds between damage applications from walls/obstacles. */
export const IMPACT_DAMAGE_COOLDOWN = 0.55;

export interface DriverInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1
  nitro: boolean;
}

export interface CarState {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** World-space velocity — can slip vs heading (arcade grip). */
  vx: number;
  vz: number;
  hp: number;
  nitro: number;
  koTimer: number;
  healFx: number;
  /** Seconds until next wall/obstacle damage tick (prevents grind KO). */
  impactCooldown: number;
  isPlayer: boolean;
  paint: string;
  sticker: string;
  /** Visual / gear archetype (Blitz sport vs Bison pickup). */
  modelId?: CarId | string;
  stats: VehicleStats & { nitroBonus: number; ramBonus: number; grassMitigation: number };
  place: number;
  lap: number;
  checkpoint: number;
  progress: number;
  distanceAlong: number;
  finished: boolean;
  finishPlace: number;
}

/** Arcade pace: punchy accel, roomy top end (meters/sec-ish units). */
export const BASE_TOP = 34;
export const BASE_ACCEL = 26;
const DRAG = 0.14;
const COAST_BRAKE = 3.5;
const BRAKE_FORCE = 48;
const NITRO_FORCE = 38;

export function createCarState(
  partial: Omit<
    CarState,
    | "speed"
    | "vx"
    | "vz"
    | "hp"
    | "nitro"
    | "koTimer"
    | "healFx"
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
    hp: 1,
    nitro: 1,
    koTimer: 0,
    healFx: 0,
    impactCooldown: 0,
    place: 1,
    lap: 1,
    checkpoint: 0,
    progress: 0,
    distanceAlong: 0,
    finished: false,
    finishPlace: 0,
    modelId: "blitz",
    ...partial,
  };
  if (partial.vx === undefined || partial.vz === undefined) {
    car.vx = Math.cos(car.heading) * car.speed;
    car.vz = Math.sin(car.heading) * car.speed;
  }
  return car;
}

/**
 * Arcade yaw: responsive at low/mid speed, settles at high speed (racing feel).
 * CONCEPT §4.2 — Gewicht + Grip + Impuls, kein Drift-Sim.
 */
export function yawRateFor(opts: {
  steer: number;
  speed: number;
  handling: number;
  grip: number;
  gripFactor: number;
  handlingMult: number;
}): number {
  const auth =
    opts.steer * (2.35 + opts.handling) * opts.handlingMult * opts.gripFactor * opts.grip;
  const speedBuild = 0.4 + 0.6 * Math.min(1, opts.speed / 7);
  const highSpeedCut = 1 / (1 + (opts.speed / 24) ** 2.15);
  return auth * speedBuild * highSpeedCut;
}

function syncVelocityFromSpeed(car: CarState): void {
  car.vx = Math.cos(car.heading) * car.speed;
  car.vz = Math.sin(car.heading) * car.speed;
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
    if (car.koTimer <= 0) {
      car.hp = 1;
      car.healFx = 0.6;
      // Respawn near track
      const sample = surfaceAt(track, car.x, car.z, 0, 1);
      void sample;
    }
    return { hitWall: false, stage: 4 };
  }

  const stage = stageFromHp(car.hp);
  const dmg = damageMultipliers(stage);
  const surface = surfaceAt(
    track,
    car.x,
    car.z,
    car.stats.grassMitigation,
    car.stats.suspension,
  );

  const top =
    BASE_TOP *
    car.stats.topSpeed *
    dmg.topSpeed *
    surface.speedFactor *
    catchUp.topSpeed *
    (1 - surface.bump * 0.22);
  const accel =
    BASE_ACCEL * car.stats.accel * catchUp.accel * (input.throttle > 0 ? 1 : 0);

  const hx = Math.cos(car.heading);
  const hz = Math.sin(car.heading);

  // Drive / nitro along nose
  car.vx += hx * accel * dt;
  car.vz += hz * accel * dt;
  if (input.nitro && car.nitro > 0 && stage < 4) {
    const nitroPush = (NITRO_FORCE + car.stats.nitroBonus * 28) * dmg.nitro;
    car.vx += hx * nitroPush * dt;
    car.vz += hz * nitroPush * dt;
    car.nitro = Math.max(0, car.nitro - (0.32 + (car.stats.nitroBonus > 0 ? 0.08 : 0)) * dt);
  } else {
    car.nitro = Math.min(1, car.nitro + 0.11 * dt);
  }

  syncSpeedFromVelocity(car);
  if (car.speed > 1e-4) {
    const fx = car.vx / car.speed;
    const fz = car.vz / car.speed;
    car.vx -= fx * input.brake * BRAKE_FORCE * dt;
    car.vz -= fz * input.brake * BRAKE_FORCE * dt;
    car.vx -= fx * car.speed * DRAG * dt;
    car.vz -= fz * car.speed * DRAG * dt;
    if (input.throttle < 0.05 && !input.nitro) {
      car.vx -= fx * COAST_BRAKE * dt;
      car.vz -= fz * COAST_BRAKE * dt;
    }
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
    grip: car.stats.grip,
    gripFactor: surface.gripFactor,
    handlingMult: dmg.handling,
  });
  car.heading += turnRate * dt;
  const hx2 = Math.cos(car.heading);
  const hz2 = Math.sin(car.heading);
  const forward = car.vx * hx2 + car.vz * hz2;
  const latX = car.vx - hx2 * forward;
  const latZ = car.vz - hz2 * forward;
  const steerLoad = Math.abs(input.steer) * Math.min(1, car.speed / 18);
  const gripStat = car.stats.grip * surface.gripFactor * dmg.grip;
  const gripPull = (5.2 + gripStat * 6.5) * (1 - steerLoad * 0.42);
  const pull = 1 - Math.exp(-Math.max(0.5, gripPull) * dt);
  car.vx -= latX * pull;
  car.vz -= latZ * pull;
  // Tire scrub: hard cornering costs a little pace
  const latMag = Math.hypot(latX, latZ);
  car.vx -= hx2 * latMag * 0.12 * pull;
  car.vz -= hz2 * latMag * 0.12 * pull;
  syncSpeedFromVelocity(car);
  car.speed = Math.max(0, car.speed);

  // Uneven wobble
  if (surface.bump > 0.05) {
    car.heading += Math.sin(surface.distanceAlong * 0.35) * surface.bump * 0.45 * dt;
    const bumpCut = 1 - surface.bump * 0.12 * dt * 4;
    car.vx *= bumpCut;
    car.vz *= bumpCut;
    syncSpeedFromVelocity(car);
  }

  // Integrate along velocity (slip = racing feel)
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  if (car.impactCooldown > 0) car.impactCooldown = Math.max(0, car.impactCooldown - dt);

  // Walls are solid: project back, bounce velocity inward, light damage (cooldown).
  let hitWall = false;
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
  }

  // Progress
  car.distanceAlong = resolved.distanceAlong;
  car.progress = resolved.distanceAlong + (car.lap - 1) * track.totalLength;

  return { hitWall: hitWall || hitObstacle, stage: stageFromHp(car.hp) };
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

  let vx = Math.cos(car.heading) * car.speed;
  let vz = Math.sin(car.heading) * car.speed;
  const outwardVel = vx * outwardX + vz * outwardZ;
  const restitution = afterMove.wallKind === "concrete" ? 0.55 : 0.7;
  const suspEase = Math.min(0.2, Math.max(0, (car.stats.suspension - 0.7) * 0.15));
  if (outwardVel > 0) {
    const bounce = outwardVel * (1 + restitution - suspEase);
    vx -= outwardX * bounce;
    vz -= outwardZ * bounce;
  } else {
    // Scraping: nudge slightly back onto track
    vx -= outwardX * 2;
    vz -= outwardZ * 2;
  }

  const newSpeed = Math.hypot(vx, vz);
  if (newSpeed > 0.05) {
    car.heading = Math.atan2(vz, vx);
  }
  const damp = afterMove.wallKind === "concrete" ? 0.52 : 0.68;
  car.speed = newSpeed * damp;
  syncVelocityFromSpeed(car);

  let damaged = false;
  if (car.impactCooldown <= 0) {
    const impact = Math.min(1, Math.max(0, outwardVel) / BASE_TOP);
    const base = afterMove.wallKind === "concrete" ? 0.07 : 0.045;
    const amount = base * (0.35 + 0.65 * impact);
    const prev = car.hp;
    car.hp = applyHit(car.hp, amount, car.stats.armor);
    car.impactCooldown = IMPACT_DAMAGE_COOLDOWN;
    damaged = car.hp < prev;
  }
  return damaged || outwardVel > 0.5;
}

/** Solid on-track props: bounce + light damage (uneven/oil are surface-only). */
export function resolveObstacles(car: CarState, obstacles: TrackObstacle[]): boolean {
  if (car.finished || car.koTimer > 0) return false;
  let hit = false;
  const carR = collisionRadiusFor(car.modelId);

  for (const o of obstacles) {
    if (o.type === "uneven" || o.type === "oil") continue;
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

    let vx = Math.cos(car.heading) * car.speed;
    let vz = Math.sin(car.heading) * car.speed;
    const into = -(vx * nx + vz * nz); // speed toward obstacle center
    if (into > 0) {
      const rest = o.type === "concrete_barrier" ? 0.6 : 0.75;
      vx += nx * into * (1 + rest);
      vz += nz * into * (1 + rest);
    } else {
      vx += nx * 3;
      vz += nz * 3;
    }
    const newSpeed = Math.hypot(vx, vz);
    if (newSpeed > 0.05) car.heading = Math.atan2(vz, vx);
    car.speed = newSpeed * (o.type === "concrete_barrier" ? 0.5 : 0.62);
    syncVelocityFromSpeed(car);

    if (car.impactCooldown <= 0) {
      const base = o.type === "concrete_barrier" ? 0.055 : 0.035;
      const impact = Math.min(1, car.speed / BASE_TOP);
      car.hp = applyHit(car.hp, base * (0.4 + 0.6 * impact), car.stats.armor);
      car.impactCooldown = IMPACT_DAMAGE_COOLDOWN;
    }
    hit = true;
  }
  return hit;
}

export function resolveContact(a: CarState, b: CarState): void {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  // Silhouette circles — visual GLB may overhang; see CAR_MODELS.collisionRadius
  const minDist = collisionRadiusFor(a.modelId) + collisionRadiusFor(b.modelId);
  if (dist >= minDist || dist < 1e-4) return;

  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;
  const totalMass = a.stats.mass + b.stats.mass;
  a.x -= (nx * overlap * b.stats.mass) / totalMass;
  a.z -= (nz * overlap * b.stats.mass) / totalMass;
  b.x += (nx * overlap * a.stats.mass) / totalMass;
  b.z += (nz * overlap * a.stats.mass) / totalMass;

  const relSpeed = Math.abs(a.speed - b.speed);
  if (relSpeed < 3 && a.speed < 8 && b.speed < 8) {
    // Low-speed jostle — separation only
    return;
  }

  const hit = 0.012 + relSpeed * 0.004 + (a.stats.ramBonus + b.stats.ramBonus) * 0.01;
  a.hp = applyHit(a.hp, (hit * b.stats.mass) / totalMass, a.stats.armor);
  b.hp = applyHit(b.hp, (hit * a.stats.mass) / totalMass, b.stats.armor);

  a.speed *= 0.97;
  b.speed *= 0.97;
  syncVelocityFromSpeed(a);
  syncVelocityFromSpeed(b);
}
