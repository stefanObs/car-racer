export type DamageStage = 0 | 1 | 2 | 3 | 4;

export const DAMAGE_LABELS = ["Tip-top", "Beulen", "Ramponiert", "Kritisch", "K.O."] as const;

/** Seconds to heal one stage when not taking hits. */
export const HEAL_SECONDS_PER_STAGE = 4.5;

export function stageFromHp(hp: number): DamageStage {
  if (hp <= 0) return 4;
  if (hp < 0.28) return 3;
  if (hp < 0.5) return 2;
  if (hp < 0.75) return 1;
  return 0;
}

export function damageMultipliers(stage: DamageStage): {
  grip: number;
  topSpeed: number;
  handling: number;
  nitro: number;
} {
  switch (stage) {
    case 0:
      return { grip: 1, topSpeed: 1, handling: 1, nitro: 1 };
    case 1:
      return { grip: 0.92, topSpeed: 1, handling: 0.94, nitro: 0.95 };
    case 2:
      return { grip: 0.78, topSpeed: 0.95, handling: 0.85, nitro: 0.8 };
    case 3:
      return { grip: 0.62, topSpeed: 0.82, handling: 0.7, nitro: 0.55 };
    case 4:
      return { grip: 0.2, topSpeed: 0, handling: 0.2, nitro: 0 };
  }
}

export function applyHeal(hp: number, dt: number, interrupted: boolean): number {
  if (interrupted || hp >= 1 || hp <= 0) return hp;
  return Math.min(1, hp + dt / (HEAL_SECONDS_PER_STAGE * 4));
}

export function applyHit(hp: number, amount: number, armor: number): number {
  const mitigated = amount / Math.max(0.5, armor);
  return Math.max(0, hp - mitigated);
}
