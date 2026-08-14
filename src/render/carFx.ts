import type { Object3D } from "three";
import type { DamageStage } from "../sim/damage";

export type CarFxVisual = {
  smoke: { children: Object3D[] };
  sparks: { children: Object3D[] };
  nitro: { children: Object3D[] };
  shield: { children: Object3D[]; scale: { setScalar: (n: number) => void }; visible: boolean };
  fxRearZ: number;
};

/** Light = 2 puffs, ramponiert = 3, kritisch = 4. Hidden when tip-top or K.O. */
export function smokeVisibleCount(stage: DamageStage): number {
  if (stage < 1 || stage >= 4) return 0;
  if (stage === 1) return 2;
  if (stage === 2) return 3;
  return 4;
}

export function sparksVisible(healFx: number): boolean {
  return healFx > 0.25;
}

/** Nitro trail while the tank is draining (button held). */
export function nitroBoosting(prevNitro: number, nitro: number): boolean {
  return nitro < prevNitro - 0.001;
}

export function lapShieldVisible(lapShield: number): boolean {
  return lapShield > 0.05;
}

/**
 * Bob / scale / visibility for shared comic FX groups.
 * Positions are local to the car root (nose +Z, rear −Z).
 */
export function applyCarFx(
  visual: CarFxVisual,
  opts: { stage: DamageStage; healFx: number; boosting: boolean; lapShield: number },
  fxTime: number,
): void {
  const { smoke, sparks, nitro, shield, fxRearZ } = visual;
  const puffCount = smokeVisibleCount(opts.stage);
  smoke.children.forEach((child, i) => {
    child.visible = i < puffCount;
    if (!child.visible) return;
    const t = fxTime * (1.5 + i * 0.2) + i;
    child.position.set(Math.sin(t) * 0.25, 1.05 + (t % 1.2) * 0.85, fxRearZ - i * 0.12);
    child.scale.setScalar(0.7 + (t % 1));
  });

  const healing = sparksVisible(opts.healFx);
  sparks.children.forEach((child, i) => {
    child.visible = healing;
    if (!child.visible) return;
    const t = fxTime * 8 + i;
    child.position.set(Math.cos(t + i) * 0.85, 0.5 + Math.abs(Math.sin(t)) * 0.7, Math.sin(t * 1.3) * 0.9);
  });

  nitro.children.forEach((child, i) => {
    child.visible = opts.boosting;
    if (child.visible) child.scale.z = 1 + (i % 3) * 0.15 + Math.sin(fxTime * 20 + i) * 0.1;
  });

  // Lap immunity is gameplay + Style-Popup only — never show an on-car shield mesh.
  void opts.lapShield;
  shield.visible = false;
  for (const child of shield.children) child.visible = false;
}
