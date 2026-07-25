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

const BASE_TOP = 28;
const BASE_ACCEL = 18;

export function createCarState(
  partial: Omit<
    CarState,
    | "speed"
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
  return {
    speed: 0,
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
    (1 - surface.bump * 0.25);
  const accel =
    BASE_ACCEL * car.stats.accel * catchUp.accel * (input.throttle > 0 ? 1 : 0);

  if (input.nitro && car.nitro > 0 && stage < 4) {
    car.speed += (22 + car.stats.nitroBonus * 20) * dmg.nitro * dt;
    car.nitro = Math.max(0, car.nitro - (0.35 + (car.stats.nitroBonus > 0 ? 0.1 : 0)) * dt);
  } else {
    car.nitro = Math.min(1, car.nitro + 0.12 * dt);
  }

  car.speed += accel * dt;
  car.speed -= input.brake * 35 * dt;
  car.speed -= car.speed * 0.55 * dt; // drag
  if (input.throttle < 0.05 && input.nitro === false) {
    car.speed -= 4 * dt;
  }
  car.speed = Math.max(0, Math.min(top, car.speed));

  // Steering
  const steerAuth =
    input.steer * (1.8 + car.stats.handling) * dmg.handling * surface.gripFactor * car.stats.grip;
  const turnRate = steerAuth * (0.35 + Math.min(1, car.speed / 12));
  car.heading += turnRate * dt;

  // Uneven wobble
  if (surface.bump > 0.05) {
    car.heading += Math.sin(surface.distanceAlong * 0.35) * surface.bump * 0.5 * dt;
    car.speed *= 1 - surface.bump * 0.15 * dt * 4;
  }

  car.x += Math.cos(car.heading) * car.speed * dt;
  car.z += Math.sin(car.heading) * car.speed * dt;

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
}
