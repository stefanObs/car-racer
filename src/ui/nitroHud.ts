import { NITRO_ENGAGE_MIN } from "../sim/vehicle";

/** Race HUD nitro bar with the engage-mark tick (CONCEPT §4.2 / §9). */
export function renderNitroMeterHtml(tank: number, boosting: boolean): string {
  const ready = boosting || tank >= NITRO_ENGAGE_MIN;
  const state = boosting ? "is-boost" : ready ? "is-ready" : "is-low";
  const pct = Math.round(Math.max(0, Math.min(1, tank)) * 100);
  const mark = Math.round(NITRO_ENGAGE_MIN * 100);
  return `<div class="bar bar--nitro ${state}" data-dev-name="hud.nitro"><span>Nitro</span><i style="width:${pct}%"></i><b class="bar-min" style="left:${mark}%"></b></div>`;
}
