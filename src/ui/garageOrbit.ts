/** Garage turntable: drag horizontally to yaw the showcase car. */

export const GARAGE_YAW_DEFAULT = 0.42;

/** Radians per CSS pixel of horizontal drag. */
export const GARAGE_ORBIT_SENSITIVITY = 0.0075;

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

/** Gentle idle sway only while the player is not dragging. */
export function garageDisplayYaw(baseYaw: number, timeSec: number, dragging: boolean): number {
  if (dragging) return baseYaw;
  return baseYaw + Math.sin(timeSec * 0.25) * 0.06;
}
