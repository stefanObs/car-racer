import type { FlyMoveInput } from "../core/trackEditor";
import { keyHeld } from "./actions";

const DEAD = 0.18;
const LOOK_RATE = 1.8;

function axis(v: number): number {
  return Math.abs(v) > DEAD ? v : 0;
}

function clamp1(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

/** Horizontal editor axes: arrows (and optional WASD) on the XZ plane. */
export function sampleTrackEditorPlanarAxes(): { forward: number; right: number } {
  let forward = 0;
  let right = 0;
  if (keyHeld("KeyW") || keyHeld("ArrowUp")) forward += 1;
  if (keyHeld("KeyS") || keyHeld("ArrowDown")) forward -= 1;
  if (keyHeld("KeyD") || keyHeld("ArrowRight")) right += 1;
  if (keyHeld("KeyA") || keyHeld("ArrowLeft")) right -= 1;
  return { forward: clamp1(forward), right: clamp1(right) };
}

/** Dedicated vertical keys — separate from arrow planar movement. */
export function sampleTrackEditorVerticalAxis(): number {
  let up = 0;
  if (keyHeld("PageUp") || keyHeld("KeyE")) up += 1;
  if (keyHeld("PageDown") || keyHeld("KeyQ")) up -= 1;
  return clamp1(up);
}

/** WASD + arrows + PageUp/Down + left stick. Look from the pad right stick is a rate (rad/s). */
export function sampleTrackEditorFly(dt: number): FlyMoveInput {
  const planar = sampleTrackEditorPlanarAxes();
  let forward = planar.forward;
  let right = planar.right;
  const up = sampleTrackEditorVerticalAxis();
  const sprint = keyHeld("ShiftLeft") || keyHeld("ShiftRight");

  let lookYaw = 0;
  let lookPitch = 0;
  const pads = typeof navigator !== "undefined" ? (navigator.getGamepads?.() ?? []) : [];
  const pad = pads.find(Boolean);
  if (pad) {
    right = clamp1(right + axis(pad.axes[0] ?? 0));
    forward = clamp1(forward - axis(pad.axes[1] ?? 0));
    lookYaw -= axis(pad.axes[2] ?? 0) * LOOK_RATE * dt;
    lookPitch -= axis(pad.axes[3] ?? 0) * LOOK_RATE * dt;
  }

  return {
    forward,
    right,
    up,
    lookYaw,
    lookPitch,
    sprint,
  };
}
