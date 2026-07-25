import type { VehicleStats } from "../data/cars";
import type { CarId } from "../data/cars";
import { applyHeal, applyHit, damageMultipliers, stageFromHp, type DamageStage } from "./damage";
import { surfaceAt } from "./zones";
import type { BuiltTrack } from "../track/types";

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

  // Walls are solid: project back onto the grass outer edge, then apply hit + slowdown.
  // (Previously a small “bounce” used the wrong lateral sign and ran *before* integration,
  // so cars were pushed further through the wall.)
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
    const sign = Math.sign(afterMove.lateral) || 1;
    const leftX = -afterMove.tangent.z;
    const leftZ = afterMove.tangent.x;
    car.x -= sign * overflow * leftX;
    car.z -= sign * overflow * leftZ;

    const wallDamage = (afterMove.wallKind === "concrete" ? 0.12 : 0.07) * (0.5 + Math.min(1, car.speed / BASE_TOP));
    const prev = car.hp;
    car.hp = applyHit(car.hp, wallDamage, car.stats.armor);
    if (car.hp < prev) hitWall = true;
    car.speed *= afterMove.wallKind === "concrete" ? 0.55 : 0.7;
  }

  const resolved = surfaceAt(
    track,
    car.x,
    car.z,
    car.stats.grassMitigation,
    car.stats.suspension,
  );

  // Heal
  const interrupted = hitWall;
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

  return { hitWall, stage: stageFromHp(car.hp) };
}

export function resolveContact(a: CarState, b: CarState): void {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const minDist = 2.2;
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
