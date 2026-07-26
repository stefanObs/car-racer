/** Hooks for leaving the race field when the idle garage is shown. */
export type IdleRaceTeardown = {
  raceCarCount: number;
  raceFieldVisible: boolean;
  clearRaceCars: () => void;
  hideRaceField: () => void;
  restoreGarageEnvironment: () => void;
};

/**
 * After a race, car meshes stay in the scene unless torn down.
 * Idle/garage must clear them so opponents do not blend into the bay.
 * @returns true when teardown ran
 */
export function ensureIdleClearsRaceField(hooks: IdleRaceTeardown): boolean {
  if (hooks.raceCarCount === 0 && !hooks.raceFieldVisible) return false;
  hooks.clearRaceCars();
  hooks.hideRaceField();
  hooks.restoreGarageEnvironment();
  return true;
}
