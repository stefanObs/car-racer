import { DAMAGE_LABELS, stageFromHp } from "../sim/damage";

/** Race HUD damage / K.O. come-back line (CONCEPT §4.5 / §9). */
export function renderDamageHudHtml(hp: number, koTimer: number, healFx: number): string {
  if (koTimer > 0 && hp <= 0) {
    const secs = Math.max(1, Math.ceil(koTimer));
    return `<div class="hud-row hud-ko" data-dev-name="hud.damage">K.O. · Comeback ${secs}</div>`;
  }
  const heal = healFx > 0.2 ? " · Reparatur…" : "";
  return `<div class="hud-row" data-dev-name="hud.damage">Schaden: ${DAMAGE_LABELS[stageFromHp(hp)]}${heal}</div>`;
}
