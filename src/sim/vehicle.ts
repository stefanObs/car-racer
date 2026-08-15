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
  /** Last driver steer (−1..1) — front-wheel visuals follow this. */
  steer: number;
  /** World-space velocity — can slip vs heading (arcade grip). */
  vx: number;
  vz: number;
  /** Vertical velocity while airborne. */
  vy: number;
  /** 0..1 arcade powerslide amount (Mario Kart–style, not tire sim). */
  drift: number;
  /** Seconds continuously in a meaningful drift (for mini-turbo). */
  driftTime: number;
  /** Brief top-speed grace after mini-turbo so grass doesn't eat the kick. */
  miniTurboGrace: number;
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
export const GRAVITY = 30;
const DRAG = 0.14;
/** Extra coast when throttle lifted — scales up a bit at high pace (engine brake). */
const COAST_BRAKE = 3.5;
const COAST_HIGH_SPEED = 22;
const AIR_STEER_SCALE = 0.35;
const AIRBORNE_EPS = 0.04;
/** Need to be well onto the wedge before punching — fringe launches steal the hop. */
export const RAMP_LAUNCH_GATE = 0.6;
const DRIFT_MIN_SPEED = 11;
const OVERSTEER_MIN_SPEED = 17;
const MINI_TURBO_TIME = 0.45;
const MINI_TURBO_KICK = 8.5;
/** Kart outside-drift target slip (radians, ~26°). Nose leads; velocity lags outside. */
export const DRIFT_TARGET_SLIP = 0.45;
/** Hard cap ~40° (MKWii outside-drift IV offset ~45°). */
export const DRIFT_MAX_SLIP = 0.7;
/** Forward speed at/below this + held brake → reverse thrust (CONCEPT §4.2). */
export const REVERSE_ENGAGE_SPEED = 0.7;
/** Reverse top as fraction of forward cruise top (~35–50%). */
export const REVERSE_TOP_FRAC = 0.42;

/** Signed speed along nose (+ forward, − reverse). */
export function forwardSpeedAlongHeading(heading: number, vx: number, vz: number): number {
  return vx * Math.cos(heading) + vz * Math.sin(heading);
}

export function reverseTopFor(forwardTop: number): number {
  return Math.max(4, forwardTop * REVERSE_TOP_FRAC);
}

/** Held brake after near-stop with no throttle → reverse (CONCEPT §4.2). */
export function wantsReverse(opts: {
  brake: number;
  throttle: number;
  forward: number;
  airborne?: boolean;
}): boolean {
  if (opts.airborne) return false;
  if (opts.brake < 0.05) return false;
  if (opts.throttle > 0.05) return false;
  return opts.forward <= REVERSE_ENGAGE_SPEED;
}

/** Reverse accel — same Säule as forward, softened. */
export function reverseAccelFor(
  stats: Pick<MergedVehicleStats, "accel">,
  catchUpAccel: number,
  brake: number,
): number {
  return BASE_ACCEL * stats.accel * catchUpAccel * 0.75 * Math.min(1, Math.max(0, brake));
}

export function createCarState(
  partial: Omit<
    CarState,
    | "speed"
    | "steer"
    | "vx"
    | "vz"
    | "vy"
    | "y"
    | "drift"
    | "driftTime"
    | "miniTurboGrace"
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
    steer: 0,
    vx: Math.cos(heading) * speed,
    vz: Math.sin(heading) * speed,
    vy: 0,
    y: 0,
    drift: 0,
    driftTime: 0,
    miniTurboGrace: 0,
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
  if (partial.miniTurboGrace === undefined) car.miniTurboGrace = 0;
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
 * Arcade yaw (CONCEPT §4.2 Front-Steer): bicycle-lite — turn rate scales with
 * forward speed so standstill does not tank-pivot. Responsive at low/mid pace,
 * settles at high speed. Handling + Masse set the circle; Grip is for slide.
 * During powerslide, nose yaws into the turn (Kart outside-drift silhouette).
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
  // Modest nose lead — path lag comes from slip seek, not extreme yaw
  const driftYaw = 1 + drift * 0.5;
  const auth =
    opts.steer *
    (1.9 + opts.handling * 1.2) *
    opts.handlingMult *
    surfaceSteer *
    massCut *
    driftYaw;
  // Bicycle-lite: yaw ∝ speed (no standstill pivot). Cap 1 matches prior mid-speed authority.
  const speedAbs = Math.max(0, opts.speed);
  const bicycle = Math.min(1, speedAbs / 6.2);
  const highSpeedCut = 1 / (1 + (speedAbs / 24) ** 2.15);
  const air = opts.airborne ? AIR_STEER_SCALE : 1;
  return auth * bicycle * highSpeedCut * air;
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

/** Signed slip: heading − move angle, wrapped to (−π, π]. */
export function slipAngle(heading: number, vx: number, vz: number): number {
  if (vx * vx + vz * vz < 1e-8) return 0;
  const moveAng = Math.atan2(vz, vx);
  return Math.atan2(Math.sin(heading - moveAng), Math.cos(heading - moveAng));
}

/**
 * Kart outside-drift target slip (radians).
 * Steer+ → positive slip: nose leads into the turn, velocity stays outside.
 */
export function driftTargetSlip(drift: number, steer: number): number {
  if (drift < 0.05 || Math.abs(steer) < 0.08) return 0;
  const steerT = Math.min(1, Math.abs(steer) / 0.85);
  const mag = Math.min(DRIFT_MAX_SLIP, DRIFT_TARGET_SLIP * drift * (0.55 + 0.45 * steerT));
  return Math.sign(steer) * mag;
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

  // Forced oversteer: full gas + near-full stick at high speed (Grip resists)
  if (opts.throttle < 0.45 || steerAmt < 0.72 || opts.speed < OVERSTEER_MIN_SPEED) return 0;
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
  // Near-zero pull while drifting — slip is owned by driftTargetSlip seek
  const driftCut = 1 - Math.min(0.97, (opts.drift ?? 0) * 1.05);
  return Math.max(0.08, base * driftCut);
}

/**
 * Integrate facing vs motion (Kart outside-drift).
 * Sources: MKWii TAS (IV can lag facing ~45° on outside-drift); MK outside-drift guides.
 * While drifting: seek a stable slip (nose inside, path outside). Else: pull velocity to nose.
 */
export function integrateVelocityFacing(opts: {
  heading: number;
  vx: number;
  vz: number;
  drift: number;
  steer: number;
  gripPull: number;
  dt: number;
}): { vx: number; vz: number } {
  const spd = Math.hypot(opts.vx, opts.vz);
  if (spd < 1e-4) return { vx: opts.vx, vz: opts.vz };
  const moveAng = Math.atan2(opts.vz, opts.vx);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  if (opts.drift > 0.15 && Math.abs(opts.steer) > 0.08) {
    const target = driftTargetSlip(opts.drift, opts.steer);
    const slip = wrap(opts.heading - moveAng);
    const steerSign = Math.sign(opts.steer) || 1;
    const underTarget = slip * steerSign < target * steerSign;
    // Under target: path lags slowly (wider radius). Over: pull in to the ~45° cap.
    const seekRate = underTarget ? 2.6 + opts.drift * 2.4 : 6.2 + opts.drift * 3;
    const wantMove = opts.heading - target;
    const dAng = wrap(wantMove - moveAng);
    const seek = 1 - Math.exp(-seekRate * opts.dt);
    let newMove = moveAng + dAng * seek;
    const newSlip = wrap(opts.heading - newMove);
    if (Math.abs(newSlip) > DRIFT_MAX_SLIP) {
      newMove = opts.heading - Math.sign(newSlip) * DRIFT_MAX_SLIP;
    }
    return { vx: Math.cos(newMove) * spd, vz: Math.sin(newMove) * spd };
  }

  const pull = 1 - Math.exp(-Math.max(0.25, opts.gripPull) * opts.dt);
  const dAng = wrap(opts.heading - moveAng);
  const newAng = moveAng + dAng * pull;
  return { vx: Math.cos(newAng) * spd, vz: Math.sin(newAng) * spd };
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
    car.steer = 0;
    car.vx = 0;
    car.vz = 0;
    car.vy = 0;
    car.y = 0;
    car.drift = 0;
    car.driftTime = 0;
    car.miniTurboGrace = 0;
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
    car.distanceAlong,
  );
  const passable = passableObstacleMods(car.x, car.z, obstacles);
  surface.gripFactor *= passable.gripMul;
  surface.bump = Math.min(1, surface.bump + passable.bumpAdd);

  car.steer = input.steer;

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
  // Charge while sliding; decay slowly so a brief scrub doesn't wipe the mini-turbo
  if (car.drift > 0.25) car.driftTime += dt;
  else car.driftTime = Math.max(0, car.driftTime - dt * 0.85);

  // Mini-turbo when a charged slide ends (button release or easing out of oversteer)
  if (prevDrift > 0.35 && intent < 0.15 && prevDriftTime >= MINI_TURBO_TIME && !airborne) {
    const spd = Math.hypot(car.vx, car.vz);
    const kick = MINI_TURBO_KICK * (0.85 + 0.2 * Math.min(1, prevDriftTime));
    if (spd > 1e-4) {
      // Mostly along nose (Kart MT) with a little path memory — avoids grass dive + harsh snap
      const fx = car.vx / spd;
      const fz = car.vz / spd;
      const hxKick = Math.cos(car.heading);
      const hzKick = Math.sin(car.heading);
      const blend = 0.68;
      let bx = fx * (1 - blend) + hxKick * blend;
      let bz = fz * (1 - blend) + hzKick * blend;
      const bl = Math.hypot(bx, bz) || 1;
      car.vx = (bx / bl) * (spd + kick);
      car.vz = (bz / bl) * (spd + kick);
    }
    car.driftTime = 0;
    car.miniTurboGrace = 0.45;
  }

  if (car.miniTurboGrace > 0) car.miniTurboGrace = Math.max(0, car.miniTurboGrace - dt);

  const boosting = input.nitro && car.nitro > 0 && stage < 4;
  const nitroHeadroom = boosting ? 1.42 + car.stats.nitroBonus * 0.5 : 1;
  // Mini-turbo punches through grass briefly (Kart boost), without removing the grass rule
  const mtGrace =
    car.miniTurboGrace > 0 ? Math.min(1.35, Math.max(1, 1 / Math.max(0.62, surface.speedFactor))) : 1;
  const top =
    BASE_TOP *
    car.stats.topSpeed *
    dmg.topSpeed *
    (airborne ? 1 : surface.speedFactor) *
    catchUp.topSpeed *
    nitroHeadroom *
    (airborne ? 1 : 1 - surface.bump * 0.22) *
    (airborne ? 1 : mtGrace);

  const throttleRaw = airborne ? input.throttle * 0.55 : input.throttle;
  const brakeIn = airborne ? input.brake * 0.25 : input.brake;
  // Pedal priority: brake wins over gas (CONCEPT §4.2 — clear stop / reverse path)
  const throttle = brakeIn > 0.05 ? 0 : throttleRaw;
  const hx = Math.cos(car.heading);
  const hz = Math.sin(car.heading);
  let forward = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);
  const reversing = wantsReverse({
    brake: brakeIn,
    throttle,
    forward,
    airborne,
  });

  // Forward drive along nose (also cancels reverse when gas is pressed)
  const accel =
    BASE_ACCEL * car.stats.accel * catchUp.accel * (throttle > 0 ? throttle : 0);
  car.vx += hx * accel * dt;
  car.vz += hz * accel * dt;

  // Nitro only forward (CONCEPT §4.2) — skip while reverse engage / traveling reverse on brake
  const allowNitro = !reversing && forward >= -REVERSE_ENGAGE_SPEED;
  if (boosting && allowNitro) {
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
  car.nitroHeld = boosting && allowNitro;

  syncSpeedFromVelocity(car);
  forward = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);

  const cruiseTop =
    BASE_TOP *
    car.stats.topSpeed *
    dmg.topSpeed *
    (airborne ? 1 : surface.speedFactor) *
    catchUp.topSpeed *
    (airborne ? 1 : 1 - surface.bump * 0.22);
  const rTop = reverseTopFor(cruiseTop);

  if (reversing) {
    const rAcc = reverseAccelFor(car.stats, catchUp.accel, brakeIn);
    car.vx -= hx * rAcc * dt;
    car.vz -= hz * rAcc * dt;
    syncSpeedFromVelocity(car);
    forward = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);
    if (forward < -rTop) {
      // Clamp reverse pace along nose; drop stray lateral
      car.vx = -hx * rTop;
      car.vz = -hz * rTop;
      car.speed = rTop;
    }
  } else if (car.speed > 1e-4) {
    const fx = car.vx / car.speed;
    const fz = car.vz / car.speed;
    // Light brake while drifting is for slide initiation, not full stop
    const brakeEff = car.drift > 0.35 ? brakeIn * 0.35 : brakeIn;
    let scrub = car.speed * DRAG * (boosting && allowNitro ? 0.35 : 1) * dt;
    if (brakeEff > 0) scrub += brakeEff * brakeForceFor(car.stats) * dt;
    if (throttle < 0.05 && !(boosting && allowNitro) && !airborne && car.drift < 0.25) {
      const coastBoost = car.speed > COAST_HIGH_SPEED ? 1 + Math.min(0.55, (car.speed - COAST_HIGH_SPEED) / 28) : 1;
      scrub += COAST_BRAKE * coastBoost * dt;
    }
    // Powerslide / exit keep more pace (Kart) — mild scrub only
    if (car.drift > 0.12) scrub *= 1 - Math.min(0.45, car.drift * 0.4 + 0.08);
    const next = Math.max(0, car.speed - scrub);
    car.vx = fx * next;
    car.vz = fz * next;
    car.speed = next;
  }

  // Deadband so reverse engage is crisp at rest
  syncSpeedFromVelocity(car);
  if (car.speed < 0.12 && !reversing && throttle < 0.05) {
    car.vx = 0;
    car.vz = 0;
    car.speed = 0;
  }

  syncSpeedFromVelocity(car);
  forward = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);
  if (forward >= 0 && car.speed > top && car.speed > 1e-6) {
    const s = top / car.speed;
    car.vx *= s;
    car.vz *= s;
    car.speed = top;
  } else if (forward < 0 && car.speed > rTop) {
    const s = rTop / car.speed;
    car.vx *= s;
    car.vz *= s;
    car.speed = rTop;
  }

  // Steering + lateral grip (velocity can slip vs heading)
  syncSpeedFromVelocity(car);
  forward = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);
  const travelingReverse = forward < -0.05;
  const steerForYaw = travelingReverse ? -input.steer : input.steer;
  const turnRate = yawRateFor({
    steer: steerForYaw,
    speed: car.speed,
    handling: car.stats.handling,
    mass: car.stats.mass,
    gripFactor: airborne ? 0.7 : surface.gripFactor,
    handlingMult: dmg.handling,
    airborne,
    drift: travelingReverse ? 0 : car.drift,
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
    drift: travelingReverse ? 0 : car.drift,
  });
  // Pull velocity toward travel nose — reverse uses −heading so grip does not flip reverse→forward.
  // Gas exits reverse: always face the true nose while throttle is applied.
  const useReverseFace = (travelingReverse || reversing) && throttle < 0.05;
  const faceHeading = useReverseFace ? car.heading + Math.PI : car.heading;
  const faced = integrateVelocityFacing({
    heading: faceHeading,
    vx: car.vx,
    vz: car.vz,
    drift: useReverseFace ? 0 : car.drift,
    steer: useReverseFace ? 0 : input.steer,
    gripPull,
    dt,
  });
  car.vx = faced.vx;
  car.vz = faced.vz;

  // Tiny scrub only when not in a controlled drift (keeps Kart pace)
  const alongNose = car.vx * hx2 + car.vz * hz2;
  const latMag = Math.hypot(car.vx - hx2 * alongNose, car.vz - hz2 * alongNose);
  if (!airborne && car.drift < 0.2 && latMag > 1.2) {
    const scrub = 1 - Math.min(0.02, latMag * 0.0008);
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

  // Walls stay solid in air too (soft) so Schanze jumps cannot leave the ribbon.
  let hitWall = false;
  {
    const afterMove = surfaceAt(
      track,
      car.x,
      car.z,
      car.stats.grassMitigation,
      car.stats.suspension,
      car.distanceAlong,
    );
    const wallLimit = track.asphaltHalfWidth + track.grassWidth;
    const overflow = Math.abs(afterMove.lateral) - wallLimit;
    if (overflow > 0) {
      hitWall = applyWallBounce(car, afterMove, overflow, { soft: isAirborne(car) });
    }
  }

  const hitObstacle = resolveObstacles(car, obstacles);

  const resolved = surfaceAt(
    track,
    car.x,
    car.z,
    car.stats.grassMitigation,
    car.stats.suspension,
    car.distanceAlong,
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
    car.miniTurboGrace = 0;
    car.nitroHeld = false;
  }

  // Progress: reject snaps onto a parallel ribbon (Phase C corridor lock).
  car.distanceAlong = continuousAlong(car.distanceAlong, resolved.distanceAlong, track.totalLength, dt);
  car.progress = car.distanceAlong + (car.lap - 1) * track.totalLength;

  return { hitWall: hitWall || hitObstacle, stage: stageFromHp(car.hp) };
}

/** Max along-track advance (m/s) before we treat a jump as a parallel-ribbon snap. */
const MAX_ALONG_SPEED = 55;

export function continuousAlong(prev: number, next: number, totalLength: number, dt: number): number {
  const gap = Math.min(Math.abs(next - prev), totalLength - Math.abs(next - prev));
  const maxJump = Math.max(8, MAX_ALONG_SPEED * Math.max(dt, 1 / 120) * 1.35);
  if (gap <= maxJump) return next;
  return prev;
}

/** Arcade jump: ramp launches, gravity, grip/suspension soften landings. */
export function stepJump(car: CarState, rampLaunch: number, dt: number): void {
  const grounded = !isAirborne(car);

  if (grounded && rampLaunch >= RAMP_LAUNCH_GATE && car.speed > 8) {
    // Comic hop: punchy launch; Federung only softens a little.
    const suspEase = Math.min(0.22, Math.max(0, (car.stats.suspension - 0.7) * 0.18));
    const launch = (10.5 + car.speed * 0.38) * rampLaunch * (1 - suspEase);
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
      const slip = Math.max(0, (impact / 22) * (1 - soft) * (1.15 - gripHold));
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
 * Soft mode (airborne): project + damp without impact damage so jumps cannot exit the world.
 */
export function applyWallBounce(
  car: CarState,
  afterMove: ReturnType<typeof surfaceAt>,
  overflow: number,
  opts: { soft?: boolean } = {},
): boolean {
  const soft = Boolean(opts.soft);
  const sign = Math.sign(afterMove.lateral) || 1;
  const leftX = -afterMove.tangent.z;
  const leftZ = afterMove.tangent.x;
  const outwardX = sign * leftX;
  const outwardZ = sign * leftZ;

  // Push clearly inside the grass edge so we don't re-hit next frame.
  const push = overflow + (soft ? 0.35 : 0.2);
  car.x -= outwardX * push;
  car.z -= outwardZ * push;

  let vx = car.vx;
  let vz = car.vz;
  const outwardVel = vx * outwardX + vz * outwardZ;
  const restitution = soft ? 0.25 : afterMove.wallKind === "concrete" ? 0.55 : 0.7;
  const suspEase = Math.min(0.2, Math.max(0, (car.stats.suspension - 0.7) * 0.15));
  // Light cars bounce harder; heavy cars dump more speed into the wall.
  const massBounce = 1.15 - Math.min(0.35, car.stats.mass * 0.2);
  if (outwardVel > 0) {
    const bounce = outwardVel * (1 + restitution - suspEase) * (soft ? 0.85 : massBounce);
    vx -= outwardX * bounce;
    vz -= outwardZ * bounce;
  } else {
    // Scraping: nudge slightly back onto track
    vx -= outwardX * (soft ? 1.2 : 2);
    vz -= outwardZ * (soft ? 1.2 : 2);
  }

  const damp = soft ? 0.82 : afterMove.wallKind === "concrete" ? 0.52 : 0.68;
  car.vx = vx * damp;
  car.vz = vz * damp;
  syncSpeedFromVelocity(car);
  if (!soft && car.speed > 0.05) {
    // Nudge heading toward post-bounce velocity without erasing all slip
    const moveAng = Math.atan2(car.vz, car.vx);
    let err = moveAng - car.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    car.heading += err * 0.65;
  }

  let damaged = false;
  if (!soft && car.impactCooldown <= 0) {
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
 * Car–car bump helpers (CONCEPT §4.5): hit zone, direction class, aggressor.
 * Normal `(nx,nz)` points from self toward the other car.
 */
export type ContactHitZone = "nose" | "flank" | "tail";
export type ContactDirectionClass = "frontal" | "oblique" | "glancing";

/** Alignment of nose with contact normal: +1 = other dead ahead, −1 = dead astern. */
export function contactForwardAlign(heading: number, nx: number, nz: number): number {
  return Math.cos(heading) * nx + Math.sin(heading) * nz;
}

export function contactHitZone(heading: number, nx: number, nz: number): ContactHitZone {
  const f = contactForwardAlign(heading, nx, nz);
  if (f > 0.5) return "nose";
  if (f < -0.5) return "tail";
  return "flank";
}

export function contactDirectionClass(heading: number, nx: number, nz: number): ContactDirectionClass {
  const a = Math.abs(contactForwardAlign(heading, nx, nz));
  if (a >= 0.72) return "frontal";
  if (a >= 0.32) return "oblique";
  return "glancing";
}

/** +1 = contact on the left of the nose (heading × normal). */
export function contactSideSign(heading: number, nx: number, nz: number): number {
  const hx = Math.cos(heading);
  const hz = Math.sin(heading);
  const cross = hx * nz - hz * nx;
  return Math.sign(cross) || 1;
}

export function contactImpulseDirScale(dir: ContactDirectionClass): number {
  if (dir === "glancing") return 0.32;
  if (dir === "oblique") return 0.82;
  return 1.12;
}

export function contactAggressorZoneScale(zone: ContactHitZone): number {
  if (zone === "tail") return 0.55;
  if (zone === "flank") return 0.88;
  return 1.08; // nose
}

export function contactDamageZoneScale(victimZone: ContactHitZone): number {
  if (victimZone === "tail") return 0.75;
  if (victimZone === "flank") return 1.05;
  return 1;
}

/** Arcade yaw kick from a flank/oblique bump; Grip settles the nose afterward via grip pull. */
export function contactYawKick(opts: {
  zone: ContactHitZone;
  dir: ContactDirectionClass;
  closing: number;
  grip: number;
  side: number;
}): number {
  // Streifend + Bug/Heck: barely turn. Flanke always gets some spin (Schultercheck).
  if (opts.dir === "glancing" && opts.zone !== "flank") return 0;
  let mag = opts.zone === "flank" ? 0.24 : opts.zone === "tail" ? 0.1 : 0.045;
  if (opts.dir === "oblique") mag *= 1.12;
  if (opts.dir === "glancing") mag *= 0.62;
  mag *= Math.min(1.35, opts.closing / 16);
  mag /= 0.55 + Math.max(0.35, opts.grip) * 0.55;
  return opts.side * mag;
}

/**
 * Car–car contact (CONCEPT §4.5): Masse + Schließspeed + Richtung + Bug/Flanke/Heck.
 * Soft / separating contacts only separate. Hard hits shove, may yaw, and chip damage.
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

  const zoneA = contactHitZone(a.heading, nx, nz);
  const zoneB = contactHitZone(b.heading, -nx, -nz);
  const approachA = a.vx * nx + a.vz * nz;
  const approachB = -(b.vx * nx + b.vz * nz);
  const aIsAggressor = approachA >= approachB;
  const agg = aIsAggressor ? a : b;
  const vic = aIsAggressor ? b : a;
  const aggZone = aIsAggressor ? zoneA : zoneB;
  const vicZone = aIsAggressor ? zoneB : zoneA;
  const nxAgg = aIsAggressor ? nx : -nx;
  const nzAgg = aIsAggressor ? nz : -nz;
  const aggDir = contactDirectionClass(agg.heading, nxAgg, nzAgg);
  const vicDir = contactDirectionClass(vic.heading, aIsAggressor ? -nx : nx, aIsAggressor ? -nz : nz);

  const dirScale = contactImpulseDirScale(aggDir);
  const zoneScale = contactAggressorZoneScale(aggZone);
  const ramNose = aggZone === "nose" ? 0.55 : 0.22;
  const ram =
    1 +
    agg.stats.ramBonus * ramNose +
    vic.stats.ramBonus * 0.12 +
    (a.stats.ramBonus + b.stats.ramBonus) * 0.08;

  const restitution = 0.35;
  const invA = 1 / Math.max(0.35, a.stats.mass);
  const invB = 1 / Math.max(0.35, b.stats.mass);
  const impulse =
    ((1 + restitution) * closing * ram * dirScale * zoneScale) / (invA + invB);

  a.vx -= impulse * invA * nx;
  a.vz -= impulse * invA * nz;
  b.vx += impulse * invB * nx;
  b.vz += impulse * invB * nz;

  // Heck-Treffer: angeschoben — mild forward shove on the victim
  if (vicZone === "tail" && closing > 2) {
    const boost = closing * 0.09 * (agg.stats.mass / totalMass);
    const hx = Math.cos(vic.heading);
    const hz = Math.sin(vic.heading);
    vic.vx += hx * boost;
    vic.vz += hz * boost;
  }

  // Flanke / schräg: arcade Giermoment (both can spin a bit)
  a.heading += contactYawKick({
    zone: zoneA,
    dir: aIsAggressor ? aggDir : vicDir,
    closing,
    grip: a.stats.grip,
    side: contactSideSign(a.heading, nx, nz),
  });
  b.heading += contactYawKick({
    zone: zoneB,
    dir: aIsAggressor ? vicDir : aggDir,
    closing,
    grip: b.stats.grip,
    side: contactSideSign(b.heading, -nx, -nz),
  });

  syncSpeedFromVelocity(a);
  syncSpeedFromVelocity(b);

  const dmgScale = dirScale * contactDamageZoneScale(vicZone);
  const hitBase =
    (0.01 + closing * 0.0035 * dmgScale + (a.stats.ramBonus + b.stats.ramBonus) * 0.01) * dmgScale;
  // Heavier opponent deals more; aggressor frontal takes a slightly larger self share
  let dmgA = (hitBase * b.stats.mass) / totalMass;
  let dmgB = (hitBase * a.stats.mass) / totalMass;
  if (aIsAggressor && aggDir === "frontal") {
    dmgA *= 1.12;
    dmgB *= 0.95;
  } else if (!aIsAggressor && aggDir === "frontal") {
    dmgB *= 1.12;
    dmgA *= 0.95;
  }
  damageCar(a, dmgA);
  damageCar(b, dmgB);
  return true;
}

