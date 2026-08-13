import { type CarId } from "../data/cars";
import { APP_CREDIT, APP_VERSION } from "../core/version";
import { CUP_LEVELS, freeLevels, levelById } from "../data/levels";
import { type PartId } from "../data/parts";
import { DevTools } from "../dev/DevTools";
import { bindKeyboard, sampleActions, touchState } from "../input/actions";
import { nextFocusIndex, risingEdge, type UiNavDir } from "../input/uiNav";
import { buyCar, selectCarInGarage, showcaseCarId, showcaseKit } from "../meta/carShop";
import {
  buyPaint,
  buySticker,
  selectPaintInGarage,
  selectStickerInGarage,
  showcasePaint,
  showcaseSticker,
} from "../meta/cosmeticsShop";
import { buyPart, selectPartInGarage, showcaseParts } from "../meta/partsShop";
import { formatChf, loadSave, writeSave, activeKit, ensureKit, type SaveData, type StickerId } from "../meta/save";
import { ensureCarPartTemplates } from "../render/carParts";
import { createGameRenderer, type GameRenderer } from "../render/createGameRenderer";
import { DAMAGE_LABELS } from "../sim/damage";
import { RaceSession } from "../sim/race";
import { renderTrackPlanSvg } from "./trackPlan";
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
import {
  panelScreenOf,
  readPanelScrollTop,
  shouldPreservePanelScroll,
  writePanelScrollTop,
} from "./panelScroll";
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
  /** Unowned car shown in the bay until bought or another owned car is picked. */
  private previewCar: CarId | null = null;
  /** Unowned paint/sticker/part preview on the active car (cleared on buy or car switch). */
  private previewPaint: string | null = null;
  private previewSticker: StickerId | null = null;
  private previewPart: PartId | null = null;
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
  this.renderer = created;
  this.bindGarageOrbit(canvas);
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

  /** LMB / touch drag on the canvas spins the garage showcase car. */
  private bindGarageOrbit(canvas: HTMLCanvasElement): void {
    let dragging = false;
    let lastX = 0;

    const endDrag = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      this.renderer.setGarageDragging(false);
      canvas.classList.remove("is-orbiting");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    canvas.addEventListener("pointerdown", (e) => {
      if (this.screen !== "garage") return;
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      this.renderer.setGarageDragging(true);
      canvas.classList.add("is-orbiting");
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!dragging || this.screen !== "garage") return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      if (dx !== 0) this.renderer.addGarageYawFromDrag(dx);
    });

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
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
            ? { throttle: 0, brake: 0, steer: 0, nitro: false, drift: false }
            : {
                throttle: actions.throttle,
                brake: actions.brake,
                steer: actions.steer,
                nitro: actions.nitro,
                drift: actions.drift,
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

  private applyFocus(index: number, opts?: { scrollIntoView?: boolean }): void {
    const buttons = this.navButtons();
    if (buttons.length === 0) return;
    const safe = ((index % buttons.length) + buttons.length) % buttons.length;
    this.focusIndex = safe;
    buttons.forEach((b, i) => b.classList.toggle("nav-focused", i === safe));
    const target = buttons[safe];
    // Always preventScroll — panel scroll is restored explicitly after garage re-renders.
    if (target && !target.disabled) target.focus({ preventScroll: true });
    if (opts?.scrollIntoView !== false) {
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
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
    const modelIds = [...new Set(this.race.cars.map((c) => c.modelId))];
    for (const id of modelIds) void ensureCarPartTemplates(id);
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
          ${
            p.drift > 0.35
              ? `<div class="hud-row hud-drift" data-dev-name="hud.drift">DRIFT${p.driftTime >= 0.55 ? " · Turbo bereit" : ""}</div>`
              : ""
          }
          ${
            p.lapShield > 0.05
              ? `<div class="hud-row hud-shield" data-dev-name="hud.shield">SCHILD</div>`
              : ""
          }
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
    }
    const fxEl = host.querySelector<HTMLElement>(".finish-fx");
    if (!fxEl) return;
    const p = Math.min(1, this.finishCelebrate.t / Math.max(0.001, this.finishCelebrate.duration));
    const flash = p < 0.12 ? 1 - p / 0.12 : Math.max(0, 1 - (p - 0.12) / 0.2);
    fxEl.style.setProperty("--p", p.toFixed(3));
    fxEl.style.setProperty("--flash", flash.toFixed(3));
  }

  private syncGarageLook(): void {
    const kit = showcaseKit(this.save, this.previewCar);
    this.renderer.setGarageLook({
      paint: showcasePaint(kit, this.previewPaint),
      sticker: showcaseSticker(kit, this.previewSticker),
      modelId: showcaseCarId(this.save.activeCar, this.previewCar),
      equippedParts: showcaseParts(kit, this.previewPart),
    });
  }

  private renderUi(): void {
    document.documentElement.dataset.screen = this.screen;
    const preserveScroll = shouldPreservePanelScroll(panelScreenOf(this.uiRoot), this.screen);
    const savedScrollTop = preserveScroll ? readPanelScrollTop(this.uiRoot) : 0;
    const savedFocusIndex = this.focusIndex;
    let body = "";
    if (this.screen === "menu") {
      body = `
        <h1 class="brand">Crash Circuit</h1>
        <p class="tag">Hilfe & Infos</p>
        <p class="meta">${formatChf(this.save.chf)} · v${APP_VERSION}</p>
        <p class="credit">${APP_CREDIT}</p>
        <p class="help">Tastatur: WASD / Pfeile, Strg/E Drift, Space Nitro, Enter, Esc · Controller: Stick, LB Drift, A/RB Nitro · Tablet: Touch</p>
        <div class="stack">
          <button data-nav data-act="garage">Zur Garage</button>
        </div>
      `;
    } else if (this.screen === "cup") {
      const rows = CUP_LEVELS.map((l) => {
        const locked = (l.cupIndex ?? 99) > this.save.cupIndexUnlocked;
        const stars = this.save.cupStars[l.id] ?? 0;
        const plan = renderTrackPlanSvg(l, 132);
        return `<button data-nav data-act="race" data-level="${l.id}" class="track-pick" ${locked ? "disabled" : ""}>
          ${plan}
          <span class="track-pick__meta">
            <strong>${l.cupIndex}. ${l.displayName}</strong>
            <span class="dim">${locked ? "Gesperrt" : l.description}</span>
            <span class="track-pick__stars">${"★".repeat(stars)}</span>
          </span>
        </button>`;
      }).join("");
      body = `<h2>Blitz-Cup</h2><div class="stack track-pick-list">${rows}</div><button data-nav data-act="garage">Garage</button>`;
    } else if (this.screen === "free") {
      const levels = freeLevels(this.save.unlockedLevels);
      const rows = levels
        .map((l) => {
          const plan = renderTrackPlanSvg(l, 132);
          return `<button data-nav data-act="race" data-level="${l.id}" class="track-pick">
            ${plan}
            <span class="track-pick__meta">
              <strong>${l.displayName}</strong>
              <span class="dim">${l.description}</span>
            </span>
          </button>`;
        })
        .join("");
      body = `<h2>Freier Modus</h2><div class="stack track-pick-list">${rows || "<p>Noch keine Strecken freigeschaltet.</p>"}</div><button data-nav data-act="garage">Garage</button>`;
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
      const plan = renderTrackPlanSvg(preview, 160);
      body = `
        <h2>Ad-hoc</h2>
        <p class="tag">Zufallsstrecke zum Teilen — Seed zeigt die gleiche Runde.</p>
        <div class="track-pick track-pick--preview">${plan}</div>
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
        previewCar: this.previewCar,
        previewPaint: this.previewPaint,
        previewSticker: this.previewSticker,
        previewPart: this.previewPart,
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
          <button type="button" data-touch="drift">Drift</button>
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
            carId: showcaseCarId(this.save.activeCar, this.previewCar),
            equippedParts: showcaseParts(
              showcaseKit(this.save, this.previewCar),
              this.previewPart,
            ),
          })
        : "";
    const previewStamp =
      this.screen === "garage" &&
      (this.previewCar || this.previewPaint || this.previewSticker || this.previewPart)
        ? `<div class="garage-preview-stamp" data-dev-name="garage.preview.stamp">Vorschau</div>`
        : "";
    this.uiRoot.innerHTML = `${statsPopup}${previewStamp}<div class="panel ${this.screen}" data-dev-name="panel.${this.screen}">${body}</div>`;
    this.wireUi({ preserveFocus: preserveScroll, focusIndex: savedFocusIndex });
    if (preserveScroll) writePanelScrollTop(this.uiRoot, savedScrollTop);
    this.dev.tagUi(this.uiRoot);
  }

  private wireUi(opts?: { preserveFocus?: boolean; focusIndex?: number }): void {
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
    if (opts?.preserveFocus) {
      // Same-screen re-render (e.g. paint/part pick): keep focus, do not scrollIntoView.
      this.applyFocus(opts.focusIndex ?? this.focusIndex, { scrollIntoView: false });
      return;
    }
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
      const next = selectCarInGarage(this.save.ownedCars, this.save.activeCar, id);
      this.save.activeCar = next.activeCar;
      this.previewCar = next.previewCar;
      this.previewPaint = null;
      this.previewSticker = null;
      this.previewPart = null;
      if (next.previewCar == null) ensureKit(this.save, next.activeCar);
      writeSave(this.save);
    }
    if (act === "buy-car" && btn.dataset.car) {
      const id = btn.dataset.car as CarId;
      if (buyCar(this.save, id)) {
        this.previewCar = null;
        this.previewPaint = null;
        this.previewSticker = null;
        this.previewPart = null;
        writeSave(this.save);
      }
    }
    if (act === "paint" && btn.dataset.color) {
      const kit = activeKit(this.save);
      const next = selectPaintInGarage(kit, btn.dataset.color, this.previewPaint);
      kit.paint = next.paint;
      this.previewPaint = next.previewPaint;
      if (next.previewPaint == null) writeSave(this.save);
    }
    if (act === "buy-paint" && btn.dataset.color) {
      const kit = activeKit(this.save);
      if (buyPaint(this.save, kit, btn.dataset.color)) {
        this.previewPaint = null;
        writeSave(this.save);
      }
    }
    if (act === "sticker" && btn.dataset.sticker) {
      const kit = activeKit(this.save);
      const next = selectStickerInGarage(kit, btn.dataset.sticker, this.previewSticker);
      kit.sticker = next.sticker;
      this.previewSticker = next.previewSticker;
      if (next.previewSticker == null) writeSave(this.save);
    }
    if (act === "buy-sticker" && btn.dataset.sticker) {
      const kit = activeKit(this.save);
      if (buySticker(this.save, kit, btn.dataset.sticker)) {
        this.previewSticker = null;
        writeSave(this.save);
      }
    }
    if (act === "part" && btn.dataset.part) {
      const id = btn.dataset.part as PartId;
      const kit = activeKit(this.save);
      const next = selectPartInGarage(kit, id, this.previewPart, this.save.activeCar);
      kit.equippedParts = next.equippedParts;
      this.previewPart = next.previewPart;
      if (next.dirty) writeSave(this.save);
    }
    if (act === "buy-part" && btn.dataset.part) {
      const id = btn.dataset.part as PartId;
      const kit = activeKit(this.save);
      if (buyPart(this.save, kit, id, this.save.activeCar)) {
        this.previewPart = null;
        writeSave(this.save);
      }
    }
    if (this.screen !== "race") this.renderUi();
  }
}
