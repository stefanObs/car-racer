import { CARS, type CarId } from "../data/cars";
import { CUP_LEVELS, freeLevels, levelById } from "../data/levels";
import { PARTS, type PartId } from "../data/parts";
import { DevTools } from "../dev/DevTools";
import { bindKeyboard, sampleActions, touchState } from "../input/actions";
import { nextFocusIndex, risingEdge, type UiNavDir } from "../input/uiNav";
import { formatChf, loadSave, writeSave, activeKit, ensureKit, type SaveData, type StickerId } from "../meta/save";
import { createGameRenderer, type GameRenderer } from "../render/createGameRenderer";
import { DAMAGE_LABELS } from "../sim/damage";
import { RaceSession } from "../sim/race";
import { APP_VERSION } from "../core/version";
import { generateAdhocLevel, normalizeSeed, randomSeed, type AdhocLength } from "../track/adhoc";
import type { LevelDefinition } from "../track/types";
import { renderGarageHtml } from "./garageHtml";
import { renderCarStatsPopup } from "./carStatsPopup";
import { renderLapCounterHtml } from "./lapHud";
import { renderMiniMapSvg } from "./miniMap";
import {
  advanceFinishCelebrate,
  createFinishCelebrate,
  finishOverlayHtml,
  resultsPodiumHtml,
  type FinishCelebrate,
} from "./finishCelebrate";
import { StylePopupQueue } from "./stylePopups";

type Screen = "menu" | "cup" | "free" | "adhoc" | "garage" | "race" | "results";

export class GameApp {
  private save: SaveData = loadSave();
  private screen: Screen = "garage";
  private race: RaceSession | null = null;
  private renderer: GameRenderer;
  private lastResult: ReturnType<RaceSession["result"]> | null = null;
  private finishCelebrate: FinishCelebrate | null = null;
  private focusIndex = 0;
  private uiRoot: HTMLElement;
  private dev: DevTools;
  private adhocSeed = randomSeed();
  private adhocLength: AdhocLength = "medium";
  private lastAdhoc: LevelDefinition | null = null;
  private stylePops = new StylePopupQueue();
  private lastUi = {
    confirm: false,
    back: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.uiRoot = uiRoot;
    bindKeyboard();
    window.addEventListener("keydown", (e) => this.onMenuKeyDown(e));
    const created = createGameRenderer(canvas);
    this.renderer = created.renderer;
    void created.mode;
    const host = uiRoot.parentElement ?? document.body;
    this.dev = new DevTools(host, {
      getChf: () => this.save.chf,
      setChf: (amount) => {
        this.save.chf = amount;
        writeSave(this.save);
      },
      canForceFinish: () =>
        this.screen === "race" && !!this.race && !this.race.done && !this.finishCelebrate,
      fieldSize: () => this.race?.cars.length ?? 6,
      forceFinish: (place) => {
        if (!this.race || this.screen !== "race") return;
        this.race.forceFinishAs(place);
      },
      onUiRefresh: () => {
        if (this.screen !== "race") this.renderUi();
        else this.updateHud();
      },
    });
    this.renderUi();
  }

  tick(now: number, dt: number): void {
    const typing =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement;
    const actions = sampleActions();
    if (!typing) this.handleUiNav(actions);

    if (this.screen === "race" && this.race) {
      if (this.finishCelebrate) {
        advanceFinishCelebrate(this.finishCelebrate, now);
        this.renderer.sync(this.race, this.finishCelebrate);
        this.updateFinishOverlay();
        if (this.finishCelebrate.t >= this.finishCelebrate.duration) {
          this.lastResult = this.race.result();
          this.applyRaceRewards(this.lastResult, this.race.level.id);
          this.finishCelebrate = null;
          this.screen = "results";
          this.renderUi();
        }
      } else {
        this.race.step(
          dt,
          typing
            ? { throttle: 0, brake: 0, steer: 0, nitro: false }
            : {
                throttle: actions.throttle,
                brake: actions.brake,
                steer: actions.steer,
                nitro: actions.nitro,
              },
        );
        this.renderer.sync(this.race);
        this.updateHud();
        if (this.race.done) {
          this.finishCelebrate = createFinishCelebrate(this.race.result().place, now);
          this.updateFinishOverlay();
        }
      }
    } else {
      if (this.screen === "garage") this.syncGarageLook();
      this.renderer.renderIdle();
    }
  }

  private moveFocus(dir: UiNavDir): void {
    const buttons = this.navButtons();
    if (buttons.length === 0) return;
    this.applyFocus(nextFocusIndex(buttons, this.focusIndex, dir));
  }

  private onMenuKeyDown(e: KeyboardEvent): void {
    if (e.code === "F1" || e.code === "F2" || e.code === "F3") return;
    if (this.screen === "race") return;
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }
    const dirByCode: Record<string, UiNavDir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const dir = dirByCode[e.code];
    if (dir) {
      e.preventDefault();
      this.moveFocus(dir);
      return;
    }
    if (e.code === "Enter") {
      e.preventDefault();
      const btn = this.navButtons()[this.focusIndex];
      if (btn && !btn.disabled) btn.click();
      return;
    }
    if (e.code === "Escape" && this.screen !== "garage") {
      e.preventDefault();
      this.screen = "garage";
      this.renderUi();
    }
  }

  private navButtons(): HTMLButtonElement[] {
    return [...this.uiRoot.querySelectorAll<HTMLButtonElement>("button[data-nav]")];
  }

  private applyFocus(index: number): void {
    const buttons = this.navButtons();
    if (buttons.length === 0) return;
    const safe = ((index % buttons.length) + buttons.length) % buttons.length;
    this.focusIndex = safe;
    buttons.forEach((b, i) => b.classList.toggle("nav-focused", i === safe));
    const target = buttons[safe];
    if (target && !target.disabled) target.focus({ preventScroll: false });
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  private handleUiNav(actions: ReturnType<typeof sampleActions>): void {
    if (this.screen === "race") {
      this.lastUi = {
        confirm: actions.uiConfirm,
        back: actions.uiBack,
        up: actions.uiUp,
        down: actions.uiDown,
        left: actions.uiLeft,
        right: actions.uiRight,
      };
      return;
    }

    const edges = {
      confirm: risingEdge(actions.uiConfirm, this.lastUi.confirm),
      back: risingEdge(actions.uiBack, this.lastUi.back),
      up: risingEdge(actions.uiUp, this.lastUi.up),
      down: risingEdge(actions.uiDown, this.lastUi.down),
      left: risingEdge(actions.uiLeft, this.lastUi.left),
      right: risingEdge(actions.uiRight, this.lastUi.right),
    };
    this.lastUi = {
      confirm: actions.uiConfirm,
      back: actions.uiBack,
      up: actions.uiUp,
      down: actions.uiDown,
      left: actions.uiLeft,
      right: actions.uiRight,
    };

    if (edges.up) this.moveFocus("up");
    if (edges.down) this.moveFocus("down");
    if (edges.left) this.moveFocus("left");
    if (edges.right) this.moveFocus("right");

    if (edges.confirm) {
      const btn = this.navButtons()[this.focusIndex];
      if (btn && !btn.disabled) btn.click();
    }
    if (edges.back && this.screen !== "garage") {
      this.screen = "garage";
      this.renderUi();
    }
  }

  private applyRaceRewards(result: NonNullable<typeof this.lastResult>, levelId: string): void {
    this.save.chf += result.purseChf;
    if (result.starsEarned) {
      const prev = this.save.cupStars[levelId] ?? 0;
      this.save.cupStars[levelId] = Math.max(prev, result.place === 1 ? 3 : result.place === 2 ? 2 : 1);
    }
    const level = levelById(levelId);
    if (level?.cupIndex && result.place <= 3) {
      const next = level.cupIndex + 1;
      if (next > this.save.cupIndexUnlocked) this.save.cupIndexUnlocked = next;
      const nextLevel = CUP_LEVELS.find((l) => l.cupIndex === next);
      if (nextLevel && !this.save.unlockedLevels.includes(nextLevel.id)) {
        this.save.unlockedLevels.push(nextLevel.id);
      }
    }
    writeSave(this.save);
  }

  private startRaceWithLevel(level: LevelDefinition): void {
    this.renderer.clearCars();
    this.stylePops.clear();
    this.finishCelebrate = null;
    const kit = activeKit(this.save);
    this.race = new RaceSession({
      level,
      playerCarId: this.save.activeCar,
      playerParts: kit.equippedParts,
      playerPaint: kit.paint,
      playerSticker: kit.sticker,
    });
    this.renderer.buildTrack(this.race);
    this.screen = "race";
    this.renderUi();
  }

  private startRace(levelId: string): void {
    if (this.lastAdhoc && this.lastAdhoc.id === levelId) {
      this.startRaceWithLevel(this.lastAdhoc);
      return;
    }
    const level = levelById(levelId) ?? freeLevels(this.save.unlockedLevels).find((l) => l.id === levelId);
    if (!level) return;
    this.startRaceWithLevel(level);
  }

  private updateHud(): void {
    const hud = this.uiRoot.querySelector<HTMLElement>("#race-hud");
    if (!hud || !this.race) return;
    const p = this.race.player();
    const stage = this.race.playerDamageStage();
    const now = performance.now();
    for (const ev of this.race.consumeStyleEvents()) {
      this.stylePops.push(ev.amount, ev.reason, now);
    }
    const wrongWay = this.race.playerWrongWay();
    hud.innerHTML = `
      <div class="hud-cluster" data-dev-name="hud.cluster">
        <div class="hud-stats">
          <div class="hud-row hud-row--top" data-dev-name="hud.place-lap">
            <strong data-dev-name="hud.place">Platz ${p.place}/${this.race.cars.length}</strong>
            ${renderLapCounterHtml(p.lap, this.race.level.laps)}
          </div>
          <div class="hud-row" data-dev-name="hud.damage">Schaden: ${DAMAGE_LABELS[stage]}${p.healFx > 0.2 ? " · Reparatur…" : ""}</div>
          <div class="bars" data-dev-name="hud.bars">
            <div class="bar" data-dev-name="hud.nitro"><span>Nitro</span><i style="width:${Math.round(p.nitro * 100)}%"></i></div>
            <div class="bar" data-dev-name="hud.hp"><span>Karosserie</span><i class="hp" style="width:${Math.round(p.hp * 100)}%"></i></div>
          </div>
          <div class="hud-row hud-style" data-dev-name="hud.style-total">Style ${formatChf(this.race.styleBonus)}</div>
        </div>
        <div class="hud-minimap" data-dev-name="hud.minimap-wrap">${renderMiniMapSvg(this.race)}</div>
      </div>
      ${
        wrongWay
          ? `<div class="wrong-way" data-dev-name="hud.wrong-way" role="alert">
              <span class="wrong-way__arrow" aria-hidden="true">↺</span>
              <strong>Falsche Richtung!</strong>
              <span class="wrong-way__hint">Dreh um — der Pfeil zeigt die Rennrichtung</span>
            </div>`
          : ""
      }
      <div class="style-popups" data-dev-name="hud.style-popups">${this.stylePops.renderHtml(now)}</div>
    `;
    hud.dataset.devName = "#race-hud";
    this.dev.tagUi(this.uiRoot);
  }

  private updateFinishOverlay(): void {
    if (!this.finishCelebrate) return;
    let host = this.uiRoot.querySelector<HTMLElement>("#finish-fx-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "finish-fx-host";
      host.dataset.devName = "finish.host";
      this.uiRoot.appendChild(host);
    }
    const existing = host.querySelector<HTMLElement>(".finish-fx");
    if (!existing) {
      host.innerHTML = finishOverlayHtml(this.finishCelebrate);
      return;
    }
    const p = Math.min(1, this.finishCelebrate.t / Math.max(0.001, this.finishCelebrate.duration));
    const flash = p < 0.18 ? 1 - p / 0.18 : Math.max(0, 1 - (p - 0.18) / 0.25);
    existing.style.setProperty("--p", p.toFixed(3));
    existing.style.setProperty("--flash", flash.toFixed(3));
  }

  private syncGarageLook(): void {
    const kit = activeKit(this.save);
    this.renderer.setGarageLook({
      paint: kit.paint,
      sticker: kit.sticker,
      modelId: this.save.activeCar,
    });
  }

  private renderUi(): void {
    const buttons: string[] = [];
    let body = "";
    if (this.screen === "menu") {
      body = `
        <h1 class="brand">Crash Circuit</h1>
        <p class="tag">Hilfe & Infos</p>
        <p class="meta">${formatChf(this.save.chf)} · v${APP_VERSION}</p>
        <p class="help">Tastatur: WASD / Pfeile, Enter, Esc · Controller: D-Pad/Stick, A/B · Tablet: Touch · Dev: F1/F2/F3</p>
        <div class="stack">
          <button data-nav data-act="garage">Zur Garage</button>
        </div>
      `;
    } else if (this.screen === "cup") {
      const rows = CUP_LEVELS.map((l) => {
        const locked = (l.cupIndex ?? 99) > this.save.cupIndexUnlocked;
        const stars = this.save.cupStars[l.id] ?? 0;
        return `<button data-nav data-act="race" data-level="${l.id}" ${locked ? "disabled" : ""}>
          ${l.cupIndex}. ${l.displayName} ${locked ? "(gesperrt)" : ""} ${"★".repeat(stars)}
        </button>`;
      }).join("");
      body = `<h2>Blitz-Cup</h2><div class="stack">${rows}</div><button data-nav data-act="garage">Garage</button>`;
    } else if (this.screen === "free") {
      const levels = freeLevels(this.save.unlockedLevels);
      const rows = levels
        .map(
          (l) =>
            `<button data-nav data-act="race" data-level="${l.id}">${l.displayName}</button>`,
        )
        .join("");
      body = `<h2>Freier Modus</h2><div class="stack">${rows || "<p>Noch keine Strecken freigeschaltet.</p>"}</div><button data-nav data-act="garage">Garage</button>`;
    } else if (this.screen === "adhoc") {
      const preview = generateAdhocLevel({ seed: this.adhocSeed, length: this.adhocLength });
      this.lastAdhoc = preview;
      const lengthBtns = (["short", "medium", "long"] as AdhocLength[])
        .map((len) => {
          const label = len === "short" ? "Kurz" : len === "long" ? "Lang" : "Mittel";
          const on = this.adhocLength === len ? " ✓" : "";
          return `<button data-nav data-act="adhoc-length" data-length="${len}">${label}${on}</button>`;
        })
        .join("");
      body = `
        <h2>Ad-hoc</h2>
        <p class="tag">Zufallsstrecke zum Teilen — Seed zeigt die gleiche Runde.</p>
        <p class="meta">Seed <strong id="adhoc-seed-label">${this.adhocSeed}</strong> · ${preview.theme} · ${preview.laps} Runden</p>
        <label class="seed-field">Seed
          <input data-seed-input maxlength="6" value="${this.adhocSeed}" autocomplete="off" spellcheck="false" />
        </label>
        <div class="stack row">${lengthBtns}</div>
        <div class="stack">
          <button data-nav data-act="adhoc-roll">Neuer Seed</button>
          <button data-nav data-act="adhoc-start">Start #${this.adhocSeed}</button>
          <button data-nav data-act="garage">Garage</button>
        </div>
      `;
    } else if (this.screen === "garage") {
      body = renderGarageHtml({
        chf: this.save.chf,
        activeCar: this.save.activeCar,
        ownedCars: this.save.ownedCars,
        kit: activeKit(this.save),
      });
      this.syncGarageLook();
    } else if (this.screen === "race") {
      body = `
        <div id="race-hud" class="race-hud"></div>
        <div class="touch-controls" aria-label="Touch-Steuerung">
          <button type="button" data-touch="left">◀</button>
          <button type="button" data-touch="brake">Bremse</button>
          <button type="button" data-touch="throttle">Gas</button>
          <button type="button" data-touch="right">▶</button>
          <button type="button" data-touch="nitro">Nitro</button>
        </div>
      `;
    } else if (this.screen === "results" && this.lastResult) {
      body = `
        <h2>Ergebnis</h2>
        ${resultsPodiumHtml(this.lastResult.place)}
        <p>${formatChf(this.lastResult.purseChf)} <span class="dim">(inkl. Style ${formatChf(this.lastResult.styleBonus)})</span></p>
        <p>${this.lastResult.starsEarned ? "Sterne verdient!" : ""}</p>
        <div class="stack">
          <button data-nav data-act="cup">Weiter Cup</button>
          <button data-nav data-act="garage">Garage</button>
          <button data-nav data-act="menu">Hilfe</button>
        </div>
      `;
    }

    const statsPopup =
      this.screen === "garage"
        ? renderCarStatsPopup({
            carId: this.save.activeCar,
            equippedParts: activeKit(this.save).equippedParts,
          })
        : "";
    this.uiRoot.innerHTML = `${statsPopup}<div class="panel ${this.screen}" data-dev-name="panel.${this.screen}">${body}</div>`;
    this.wireUi();
    this.dev.tagUi(this.uiRoot);
    void buttons;
  }

  private wireUi(): void {
    this.uiRoot.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => this.onAction(btn));
    });
    const seedInput = this.uiRoot.querySelector<HTMLInputElement>("input[data-seed-input]");
    seedInput?.addEventListener("change", () => {
      this.adhocSeed = normalizeSeed(seedInput.value);
      this.renderUi();
    });
    seedInput?.addEventListener("keydown", (e) => {
      if (e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        this.adhocSeed = normalizeSeed(seedInput.value);
        this.renderUi();
      }
    });
    this.uiRoot.querySelectorAll<HTMLButtonElement>("button[data-touch]").forEach((btn) => {
      const key = btn.dataset.touch as keyof typeof touchState;
      const set = (v: boolean) => {
        if (key in touchState) touchState[key] = v;
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        set(true);
      });
      btn.addEventListener("pointerup", () => set(false));
      btn.addEventListener("pointerleave", () => set(false));
      btn.addEventListener("pointercancel", () => set(false));
    });
    const navButtons = this.navButtons();
    navButtons.forEach((b, i) => {
      b.addEventListener("focus", () => {
        this.focusIndex = i;
        navButtons.forEach((other, j) => other.classList.toggle("nav-focused", j === i));
      });
    });
    const firstEnabled = navButtons.findIndex((b) => !b.disabled);
    this.applyFocus(firstEnabled >= 0 ? firstEnabled : 0);
  }

  private onAction(btn: HTMLButtonElement): void {
    const act = btn.dataset.act;
    if (act === "menu") this.screen = "menu";
    if (act === "cup") this.screen = "cup";
    if (act === "free") this.screen = "free";
    if (act === "adhoc") this.screen = "adhoc";
    if (act === "garage") this.screen = "garage";
    if (act === "adhoc-roll") {
      this.adhocSeed = randomSeed();
      this.screen = "adhoc";
    }
    if (act === "adhoc-length" && btn.dataset.length) {
      this.adhocLength = btn.dataset.length as AdhocLength;
      this.screen = "adhoc";
    }
    if (act === "adhoc-start") {
      const level = generateAdhocLevel({ seed: this.adhocSeed, length: this.adhocLength });
      this.lastAdhoc = level;
      this.startRaceWithLevel(level);
      return;
    }
    if (act === "race" && btn.dataset.level) {
      this.startRace(btn.dataset.level);
      return;
    }
    if (act === "car" && btn.dataset.car) {
      const id = btn.dataset.car as CarId;
      if (!this.save.ownedCars.includes(id)) {
        const price = CARS[id].priceChf;
        if (this.save.chf >= price) {
          this.save.chf -= price;
          this.save.ownedCars.push(id);
          ensureKit(this.save, id);
          this.save.activeCar = id;
        }
      } else {
        this.save.activeCar = id;
        ensureKit(this.save, id);
      }
      writeSave(this.save);
    }
    if (act === "paint" && btn.dataset.color) {
      activeKit(this.save).paint = btn.dataset.color;
      writeSave(this.save);
    }
    if (act === "sticker" && btn.dataset.sticker) {
      activeKit(this.save).sticker = btn.dataset.sticker as StickerId;
      writeSave(this.save);
    }
    if (act === "part" && btn.dataset.part) {
      const id = btn.dataset.part as PartId;
      const kit = activeKit(this.save);
      if (!kit.ownedParts.includes(id)) {
        const price = PARTS[id].priceChf;
        if (this.save.chf >= price) {
          this.save.chf -= price;
          kit.ownedParts.push(id);
          kit.equippedParts.push(id);
        }
      } else if (kit.equippedParts.includes(id)) {
        kit.equippedParts = kit.equippedParts.filter((p) => p !== id);
      } else {
        kit.equippedParts.push(id);
      }
      writeSave(this.save);
    }
    if (this.screen !== "race") this.renderUi();
  }
}
