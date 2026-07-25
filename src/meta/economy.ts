/**
 * Session economy pacing — aligned with CONCEPT §4.8 (v3.3).
 * A short session (7–15 min) must unlock or buy something meaningful.
 */
import { CUP_LEVELS } from "../data/levels";
import { PARTS } from "../data/parts";
import { CARS } from "../data/cars";

export const SESSION_MIN_MINUTES = 7;
export const SESSION_MAX_MINUTES = 15;

/** Mid-pack intro finishes that must fund the cheapest part. */
export const STARTER_RACES_FOR_PART = 2;

/** Place index 0 = 1st … 3 = 4th. */
export const MID_PACK_PLACE_INDEX = 3;

export function cheapestPartPriceChf(): number {
  return Math.min(...Object.values(PARTS).map((p) => p.priceChf));
}

export function introFourthPlacePurseChf(): number {
  const intro = CUP_LEVELS[0]!;
  return intro.rewards.placePurse[MID_PACK_PLACE_INDEX] ?? 0;
}

/** True when two intro 4th-place purses cover the cheapest part. */
export function starterPartAffordableFromMidPack(): boolean {
  return introFourthPlacePurseChf() * STARTER_RACES_FOR_PART >= cheapestPartPriceChf();
}

/** True when intro 1st-place purse alone covers at least one part. */
export function solidEarlyPartFromFirstWin(): boolean {
  const p1 = CUP_LEVELS[0]!.rewards.placePurse[0] ?? 0;
  return Object.values(PARTS).some((p) => p.priceChf <= p1);
}

/** Second car should cost more than two mid-pack races (not an instant buy). */
export function secondCarIsLongerGoal(): boolean {
  const bison = CARS.bison.priceChf;
  return bison > introFourthPlacePurseChf() * STARTER_RACES_FOR_PART;
}
