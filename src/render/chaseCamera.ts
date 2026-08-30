/**
 * Chase-camera pose relative to the player car.
 * Must rise with surfaceY / jumps — a height cap left the camera inside the
 * Brückenkreuz deck asphalt so Blitz vanished at the crest (RCA v0.3.290).
 */

export const CHASE_BACK_M = 7.2;
/** World-up offset of the camera above the car root. */
export const CHASE_HEIGHT_ABOVE_CAR_M = 3.35;
/** Look-at height above the car root (nose / cockpit read). */
export const CHASE_LOOK_ABOVE_CAR_M = 0.95;

export type ChaseCamTarget = {
  x: number;
  y: number;
  z: number;
  heading: number;
};

export type ChaseCamPose = {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
};

export function chaseCameraPose(
  player: ChaseCamTarget,
  opts?: { back?: number; heightAbove?: number; lookAbove?: number },
): ChaseCamPose {
  const back = opts?.back ?? CHASE_BACK_M;
  const heightAbove = opts?.heightAbove ?? CHASE_HEIGHT_ABOVE_CAR_M;
  const lookAbove = opts?.lookAbove ?? CHASE_LOOK_ABOVE_CAR_M;
  return {
    camX: player.x - Math.cos(player.heading) * back,
    camY: player.y + heightAbove,
    camZ: player.z - Math.sin(player.heading) * back,
    lookX: player.x,
    lookY: player.y + lookAbove,
    lookZ: player.z,
  };
}
