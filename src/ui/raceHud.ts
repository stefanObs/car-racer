import { formatChf } from "../meta/save";
import type { RaceSession } from "../sim/race";
import { renderDamageHudHtml } from "./damageHud";
import { renderLapCounterHtml } from "./lapHud";
import { renderFieldStripSvg, renderMiniMapSvg } from "./miniMap";
import { renderNitroMeterHtml } from "./nitroHud";
import type { StylePopupQueue } from "./stylePopups";

export function raceHudLayout(session: RaceSession): "pad" | "training" | "race" {
  if (session.track.debugPad) return "pad";
  if (session.level.kind === "training") return "training";
  return "race";
}

function placeLapHtml(session: RaceSession): string {
  const p = session.player();
  if (session.track.debugPad) {
    return `<strong data-dev-name="hud.debug-pad">Debug-Raster</strong>`;
  }
  if (session.level.kind === "training") {
    return `<strong data-dev-name="hud.training">Training</strong>
            ${renderLapCounterHtml(p.lap, session.level.laps)}`;
  }
  return `<strong data-dev-name="hud.place">Platz ${p.place}/${session.cars.length}</strong>
            ${renderLapCounterHtml(p.lap, session.level.laps)}`;
}

function driftHtml(session: RaceSession): string {
  const p = session.player();
  if (p.drift <= 0.35) return "";
  return `<div class="hud-row hud-drift" data-dev-name="hud.drift">DRIFT${p.driftTime >= 0.55 ? " · Turbo bereit" : ""}</div>`;
}

function shieldHtml(session: RaceSession): string {
  if (session.player().lapShield <= 0.05) return "";
  return `<div class="hud-row hud-shield" data-dev-name="hud.shield">SCHILD</div>`;
}

function styleTotalHtml(session: RaceSession): string {
  if (session.track.debugPad || session.level.kind === "training") return "";
  return `<div class="hud-row hud-style" data-dev-name="hud.style-total">Style ${formatChf(session.styleBonus)}</div>`;
}

function mapsHtml(session: RaceSession): string {
  if (session.track.debugPad) return "";
  const field =
    session.level.kind === "training"
      ? ""
      : `<div class="hud-field" data-dev-name="hud.field-wrap">${renderFieldStripSvg(session)}</div>`;
  return `${field}
        <div class="hud-minimap" data-dev-name="hud.minimap-wrap">${renderMiniMapSvg(session)}</div>`;
}

function countdownHtml(session: RaceSession): string {
  const countdown = session.countdownLabel();
  if (!countdown) return "";
  return `<div class="race-countdown${countdown === "GO" ? " race-countdown--go" : ""}" data-dev-name="hud.countdown" role="status" aria-live="assertive">
              <span class="race-countdown__label">${countdown}</span>
            </div>`;
}

function wrongWayHtml(session: RaceSession): string {
  if (!session.playerWrongWay()) return "";
  return `<div class="wrong-way" data-dev-name="hud.wrong-way" role="alert">
              <span class="wrong-way__arrow" aria-hidden="true">↺</span>
              <strong>Falsche Richtung!</strong>
              <span class="wrong-way__hint">Dreh um — der Pfeil zeigt die Rennrichtung</span>
            </div>`;
}

export function renderRaceHudHtml(session: RaceSession, stylePops: StylePopupQueue, nowMs: number): string {
  const p = session.player();
  return `
      <div class="hud-cluster" data-dev-name="hud.cluster">
        <div class="hud-stats">
          <div class="hud-row hud-row--top" data-dev-name="hud.place-lap">
            ${placeLapHtml(session)}
          </div>
          ${renderDamageHudHtml(p.hp, p.koTimer, p.healFx)}
          <div class="bars" data-dev-name="hud.bars">
            ${renderNitroMeterHtml(p.nitro, p.nitroHeld)}
            <div class="bar" data-dev-name="hud.hp"><span>Karosserie</span><i class="hp" style="width:${Math.round(p.hp * 100)}%"></i></div>
          </div>
          ${driftHtml(session)}
          ${shieldHtml(session)}
          ${styleTotalHtml(session)}
        </div>
        ${mapsHtml(session)}
      </div>
      ${countdownHtml(session)}
      ${wrongWayHtml(session)}
      <div class="style-popups" data-dev-name="hud.style-popups">${stylePops.renderHtml(nowMs)}</div>
    `;
}

function named(host: HTMLElement, name: string): HTMLElement | null {
  return host.querySelector(`[data-dev-name="${name}"]`);
}

function paintFull(host: HTMLElement, session: RaceSession, stylePops: StylePopupQueue, nowMs: number): void {
  host.innerHTML = renderRaceHudHtml(session, stylePops, nowMs);
  host.dataset.devName = "#race-hud";
  host.dataset.hudLayout = raceHudLayout(session);
}

/** Patch stable HUD nodes; rebuild the tree when the shell or layout is missing. */
export function syncRaceHud(
  host: HTMLElement,
  session: RaceSession,
  stylePops: StylePopupQueue,
  nowMs: number,
): void {
  const layout = raceHudLayout(session);
  if (!host.querySelector(".hud-cluster") || host.dataset.hudLayout !== layout) {
    paintFull(host, session, stylePops, nowMs);
    return;
  }

  const p = session.player();
  const placeLap = named(host, "hud.place-lap");
  if (!placeLap) {
    paintFull(host, session, stylePops, nowMs);
    return;
  }
  placeLap.innerHTML = placeLapHtml(session);

  const damage = renderDamageHudHtml(p.hp, p.koTimer, p.healFx);
  const damageEl = named(host, "hud.damage");
  if (damageEl) damageEl.outerHTML = damage;
  else named(host, "hud.place-lap")?.insertAdjacentHTML("afterend", damage);

  const nitro = named(host, "hud.nitro");
  if (nitro) {
    const next = document.createElement("div");
    next.innerHTML = renderNitroMeterHtml(p.nitro, p.nitroHeld).trim();
    const fresh = next.firstElementChild as HTMLElement | null;
    if (fresh) {
      nitro.className = fresh.className;
      const fill = nitro.querySelector("i");
      const nextFill = fresh.querySelector("i");
      if (fill && nextFill) fill.setAttribute("style", nextFill.getAttribute("style") ?? "");
    }
  }
  const hpFill = host.querySelector<HTMLElement>('[data-dev-name="hud.hp"] i.hp');
  if (hpFill) hpFill.style.width = `${Math.round(p.hp * 100)}%`;

  const bars = named(host, "hud.bars");
  if (bars?.parentElement) {
    named(host, "hud.drift")?.remove();
    named(host, "hud.shield")?.remove();
    named(host, "hud.style-total")?.remove();
    bars.insertAdjacentHTML("afterend", driftHtml(session) + shieldHtml(session) + styleTotalHtml(session));
  }

  const field = named(host, "hud.field-wrap");
  if (field) field.innerHTML = renderFieldStripSvg(session);
  const map = named(host, "hud.minimap-wrap");
  if (map) map.innerHTML = renderMiniMapSvg(session);

  const nextCountdown = session.countdownLabel();
  let countdownEl = named(host, "hud.countdown");
  if (nextCountdown) {
    if (!countdownEl) {
      named(host, "hud.cluster")?.insertAdjacentHTML("afterend", countdownHtml(session));
      countdownEl = named(host, "hud.countdown");
    }
    if (countdownEl) {
      countdownEl.classList.toggle("race-countdown--go", nextCountdown === "GO");
      const label = countdownEl.querySelector(".race-countdown__label");
      if (label) label.textContent = nextCountdown;
    }
  } else {
    countdownEl?.remove();
  }

  const wrong = wrongWayHtml(session);
  const wrongEl = named(host, "hud.wrong-way");
  if (wrong) {
    if (wrongEl) {
      /* keep node */
    } else {
      named(host, "hud.style-popups")?.insertAdjacentHTML("beforebegin", wrong);
    }
  } else {
    wrongEl?.remove();
  }

  const pops = named(host, "hud.style-popups");
  if (pops) pops.innerHTML = stylePops.renderHtml(nowMs);
}
