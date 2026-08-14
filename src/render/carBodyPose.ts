/**
 * Visual body pose for race cars — lean is subtle now that front wheels steer.
 */

/** Max bank while sliding (rad). Kept mild so steered wheels read clearly. */
export const MAX_BODY_ROLL = 0.18;

const SLIP_ROLL = 0.22;
const DRIFT_EXTRA_ROLL = 0.05;
const IDLE_DRIFT_LEAN = 0.08;

export type BodyRollInput = {
  drift: number;
  /** Heading − move angle, wrapped (−π, π]. */
  slip: number;
  /** Damage / bump lean amplitude before wobble (non-drift). */
  baseLean: number;
  /** −1..1 wobble (e.g. sin time) applied when not in a hard drift. */
  wobble: number;
};

/** Body roll around local Z (bank). Drift uses slip; otherwise light wobble. */
export function bodyRollZ(opts: BodyRollInput): number {
  if (opts.drift > 0.2) {
    const raw =
      -opts.slip * SLIP_ROLL - Math.sign(opts.slip || 1) * opts.drift * DRIFT_EXTRA_ROLL;
    return Math.max(-MAX_BODY_ROLL, Math.min(MAX_BODY_ROLL, raw));
  }
  return (opts.baseLean + opts.drift * IDLE_DRIFT_LEAN) * opts.wobble;
}

export function bodyBaseLean(stage: number, airborne: boolean, bump: number): number {
  const dmg = stage >= 2 ? 0.06 : 0;
  const bumpLean = airborne ? 0 : bump * 0.08;
  return dmg + bumpLean;
}
