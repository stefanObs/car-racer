import type { BuiltTrack } from "../track/types";
import { sampleCenterline } from "../track/buildTrack";

/** Min speed (m/s-ish) before wrong-way is considered — avoids spawn flicker. */
export const WRONG_WAY_MIN_SPEED = 5;

/** Dot product below this vs track tangent = facing backward. */
export const WRONG_WAY_DOT = -0.25;

/** Seconds of sustained wrong-way before HUD warns (hysteresis). */
export const WRONG_WAY_HOLD = 0.35;

/**
 * True when velocity points against the track forward tangent.
 * CONCEPT: kids need a clear “wrong way” cue on a closed loop.
 */
export function isFacingWrongWay(opts: {
  vx: number;
  vz: number;
  speed: number;
  tangentX: number;
  tangentZ: number;
  minSpeed?: number;
  dotThreshold?: number;
}): boolean {
  const minSpeed = opts.minSpeed ?? WRONG_WAY_MIN_SPEED;
  if (opts.speed < minSpeed) return false;
  const tLen = Math.hypot(opts.tangentX, opts.tangentZ) || 1;
  const dot = (opts.vx * opts.tangentX + opts.vz * opts.tangentZ) / (opts.speed * tLen);
  return dot < (opts.dotThreshold ?? WRONG_WAY_DOT);
}

export function isCarFacingWrongWay(
  car: { x: number; z: number; vx: number; vz: number; speed: number; distanceAlong: number },
  track: BuiltTrack,
): boolean {
  const sample = sampleCenterline(track, car.distanceAlong);
  return isFacingWrongWay({
    vx: car.vx,
    vz: car.vz,
    speed: car.speed,
    tangentX: sample.tangent.x,
    tangentZ: sample.tangent.z,
  });
}

/** Accumulate hold time; returns whether the warning should show. */
export function tickWrongWayHold(heldSeconds: number, facingWrong: boolean, dt: number): number {
  if (facingWrong) return heldSeconds + dt;
  return Math.max(0, heldSeconds - dt * 2.5);
}

export function shouldShowWrongWayWarning(heldSeconds: number): boolean {
  return heldSeconds >= WRONG_WAY_HOLD;
}
