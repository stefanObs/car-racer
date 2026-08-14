/** Garage turntable: drag to yaw + pitch the showcase car (CONCEPT §9 frei drehen). */

export const GARAGE_YAW_DEFAULT = 0.42;
export const GARAGE_PITCH_DEFAULT = 0;

/** Radians per CSS pixel of drag. */
export const GARAGE_ORBIT_SENSITIVITY = 0.0075;

/** Full tumble allowed; keep pitch in ±π so Euler YXZ stays readable. */
export const GARAGE_PITCH_LIMIT = Math.PI;

/** Extra clearance above half-extent when hovering for inspect tumble. */
export const GARAGE_INSPECT_LIFT_PADDING = 0.45;

export type GarageOrbitAxes = { yaw: boolean; pitch: boolean };

/**
 * Mouse: LMB = yaw only; RMB = free tumble (yaw + pitch).
 * Touch / pen: 1 finger = yaw; 2+ fingers = free tumble.
 */
export function garageOrbitAxesForPointer(
  button: number,
  pointerType: string,
  activeTouchCount = 1,
): GarageOrbitAxes {
  if (pointerType === "touch" || pointerType === "pen") {
    if (activeTouchCount >= 2) return { yaw: true, pitch: true };
    return { yaw: true, pitch: false };
  }
  if (button === 2) return { yaw: true, pitch: true };
  if (button === 0) return { yaw: true, pitch: false };
  return { yaw: false, pitch: false };
}

/** Fixed hover lift so the car clears the pad while tumbling around its center. */
export function garageInspectLiftAmount(halfLen: number, halfHeight: number): number {
  return Math.max(halfLen, halfHeight) + GARAGE_INSPECT_LIFT_PADDING;
}

/** Pivot Y: sit-center, or raised by a fixed lift while inspect is held. */
export function garageOrbitPivotY(sitCenterY: number, inspectActive: boolean, liftAmount: number): number {
  return sitCenterY + (inspectActive ? liftAmount : 0);
}

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

/** Apply selected axes from one pointer move. */
export function applyGarageDragOrbit(
  yaw: number,
  pitch: number,
  deltaXPx: number,
  deltaYPx: number,
  axes: GarageOrbitAxes = { yaw: true, pitch: true },
  sensitivity = GARAGE_ORBIT_SENSITIVITY,
): { yaw: number; pitch: number } {
  return {
    yaw: axes.yaw ? applyGarageDragYaw(yaw, deltaXPx, sensitivity) : yaw,
    pitch: axes.pitch ? applyGarageDragPitch(pitch, deltaYPx, sensitivity) : pitch,
  };
}

/** Gentle idle sway only while the player is not dragging. */
export function garageDisplayYaw(baseYaw: number, timeSec: number, dragging: boolean): number {
  if (dragging) return baseYaw;
  return baseYaw + Math.sin(timeSec * 0.25) * 0.06;
}
