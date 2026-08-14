/** Garage turntable: drag to yaw + pitch the showcase car (CONCEPT §9 frei drehen). */

export const GARAGE_YAW_DEFAULT = 0.42;
export const GARAGE_PITCH_DEFAULT = 0;

/** Radians per CSS pixel of drag. */
export const GARAGE_ORBIT_SENSITIVITY = 0.0075;

/** Full tumble allowed; keep pitch in ±π so Euler YXZ stays readable. */
export const GARAGE_PITCH_LIMIT = Math.PI;

/**
 * Drag right → show the car's left side (clockwise yaw when Y is up).
 * Works for mouse and touch (pointer deltaX).
 */
export function applyGarageDragYaw(
  yaw: number,
  deltaXPx: number,
  sensitivity = GARAGE_ORBIT_SENSITIVITY,
): number {
  return yaw - deltaXPx * sensitivity;
}

/**
 * Drag down → tip nose toward ground / camera (positive pitch).
 * Clamped so the car can flip fully but not spin past ±180°.
 */
export function applyGarageDragPitch(
  pitch: number,
  deltaYPx: number,
  sensitivity = GARAGE_ORBIT_SENSITIVITY,
  limit = GARAGE_PITCH_LIMIT,
): number {
  return Math.max(-limit, Math.min(limit, pitch + deltaYPx * sensitivity));
}

/** Apply both axes from one pointer move. */
export function applyGarageDragOrbit(
  yaw: number,
  pitch: number,
  deltaXPx: number,
  deltaYPx: number,
  sensitivity = GARAGE_ORBIT_SENSITIVITY,
): { yaw: number; pitch: number } {
  return {
    yaw: applyGarageDragYaw(yaw, deltaXPx, sensitivity),
    pitch: applyGarageDragPitch(pitch, deltaYPx, sensitivity),
  };
}

/** Gentle idle sway only while the player is not dragging. */
export function garageDisplayYaw(baseYaw: number, timeSec: number, dragging: boolean): number {
  if (dragging) return baseYaw;
  return baseYaw + Math.sin(timeSec * 0.25) * 0.06;
}
