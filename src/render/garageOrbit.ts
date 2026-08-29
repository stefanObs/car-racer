import type { MeshInspectOrbitMode } from "../core/meshInspect";
import { Vector3, type Camera, type Object3D } from "three";

export const GARAGE_YAW_DEFAULT = 0.42;
export const GARAGE_PITCH_DEFAULT = 0;
export const GARAGE_ROLL_DEFAULT = 0;

/** Radians per CSS pixel of drag. */
export const GARAGE_ORBIT_SENSITIVITY = 0.0075;

/** Full tumble allowed; keep Euler angles in ±π so YXZ stays readable. */
export const GARAGE_PITCH_LIMIT = Math.PI;
export const GARAGE_ROLL_LIMIT = Math.PI;

/**
 * World Y for inspect hover — mid-frame under the garage camera (lookAt follows).
 * Old half-extent clearance floated the car near the top of the view (~3.5+).
 */
export const GARAGE_INSPECT_TARGET_Y = 2.0;

export type GarageOrbitAxes = { yaw: boolean; pitch: boolean; roll?: boolean };

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
    if (activeTouchCount >= 2) return { yaw: true, pitch: true, roll: false };
    return { yaw: true, pitch: false, roll: false };
  }
  if (button === 2) return { yaw: true, pitch: true, roll: false };
  if (button === 0) return { yaw: true, pitch: false, roll: false };
  return { yaw: false, pitch: false, roll: false };
}

/**
 * F6: LMB follows the latched orbit mode. Ctrl still forces screen-roll for one drag.
 * Roll is around the camera look axis so it tips the car in the view (not local Euler Z).
 */
export function garageInspectOrbitAxes(
  mode: MeshInspectOrbitMode = "turn",
  ctrlKey = false,
): GarageOrbitAxes {
  if (mode === "roll" || ctrlKey) return { yaw: false, pitch: true, roll: true };
  return { yaw: true, pitch: true, roll: false };
}

/** Raise the pivot to mid-screen height while inspect is held. */
export function garageInspectLiftAmount(
  sitCenterY: number,
  targetY = GARAGE_INSPECT_TARGET_Y,
): number {
  return Math.max(0, targetY - sitCenterY);
}

/** Pivot Y: sit-center, or raised by a fixed lift while inspect is held. */
export function garageOrbitPivotY(sitCenterY: number, inspectActive: boolean, liftAmount: number): number {
  return sitCenterY + (inspectActive ? liftAmount : 0);
}

/**
 * Ending inspect (RMB / 2-finger up) must flatten pitch — CONCEPT §9
 * „Loslassen stellt flach auf den Boden“.
 */
export function garagePitchAfterInspectChange(
  wasInspecting: boolean,
  nowInspecting: boolean,
  pitch: number,
): number {
  if (wasInspecting && !nowInspecting) return GARAGE_PITCH_DEFAULT;
  if (!nowInspecting) return GARAGE_PITCH_DEFAULT;
  return pitch;
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

/** Drag right → roll the car onto its right side (F6 missing axis). */
export function applyGarageDragRoll(
  roll: number,
  deltaXPx: number,
  sensitivity = GARAGE_ORBIT_SENSITIVITY,
  limit = GARAGE_ROLL_LIMIT,
): number {
  return Math.max(-limit, Math.min(limit, roll + deltaXPx * sensitivity));
}

/** Apply selected axes from one pointer move. */
export function applyGarageDragOrbit(
  yaw: number,
  pitch: number,
  deltaXPx: number,
  deltaYPx: number,
  axes: GarageOrbitAxes = { yaw: true, pitch: true, roll: false },
  sensitivity = GARAGE_ORBIT_SENSITIVITY,
  roll = GARAGE_ROLL_DEFAULT,
): { yaw: number; pitch: number; roll: number } {
  return {
    yaw: axes.yaw ? applyGarageDragYaw(yaw, deltaXPx, sensitivity) : yaw,
    pitch: axes.pitch ? applyGarageDragPitch(pitch, deltaYPx, sensitivity) : pitch,
    roll: axes.roll ? applyGarageDragRoll(roll, deltaXPx, sensitivity) : roll,
  };
}

const _inspectFwd = new Vector3();
const _inspectRight = new Vector3();
const _inspectUp = new Vector3(0, 1, 0);

/**
 * Rotate the F6 orbit pivot (the car's parent) in view space.
 * Yaw around world Y, pitch around camera right, roll around the look axis.
 */
export function applyInspectCarOrbit(
  pivot: Object3D,
  camera: Camera,
  deltaXPx: number,
  deltaYPx: number,
  axes: GarageOrbitAxes,
  sensitivity = GARAGE_ORBIT_SENSITIVITY,
): void {
  camera.updateMatrixWorld(true);
  camera.getWorldDirection(_inspectFwd);
  _inspectRight.crossVectors(_inspectFwd, _inspectUp);
  if (_inspectRight.lengthSq() < 1e-8) {
    _inspectRight.setFromMatrixColumn(camera.matrixWorld, 0);
  }
  _inspectRight.normalize();
  if (axes.yaw) pivot.rotateOnWorldAxis(_inspectUp, -deltaXPx * sensitivity);
  if (axes.pitch) pivot.rotateOnWorldAxis(_inspectRight, deltaYPx * sensitivity);
  if (axes.roll) pivot.rotateOnWorldAxis(_inspectFwd, deltaXPx * sensitivity);
}

/** Gentle idle sway only while the player is not dragging. */
export function garageDisplayYaw(baseYaw: number, timeSec: number, dragging: boolean): number {
  if (dragging) return baseYaw;
  return baseYaw + Math.sin(timeSec * 0.25) * 0.06;
}
