import { type CarId } from "../data/cars";
import { gameAudio } from "../audio/GameAudio";
import { playRaceAudioEvent } from "../audio/raceEvents";
import { APP_CREDIT, APP_VERSION } from "../core/version";
import { CUP_LEVELS, freeLevels, levelById } from "../data/levels";
import { debugPadLevel } from "../data/debugPad";
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
import {
  applyEasyModeThrottle,
  loadGameSettings,
  writeGameSettings,
  type GameSettings,
} from "../meta/gameSettings";
import { ensureCarPartTemplates } from "../render/carParts";
import { createGameRenderer, type GameRenderer } from "../render/createGameRenderer";
import { preloadTrackModels } from "../render/loadTrackGltf";
import { DAMAGE_LABELS } from "../sim/damage";
import { RaceSession } from "../sim/race";
import { renderTrackPlanSvg } from "./trackPlan";
import { generateAdhocLevel, normalizeSeed, randomSeed, type AdhocLength } from "../track/adhoc";
import type { LevelDefinition } from "../track/types";
import { renderGarageHtml } from "./garageHtml";
import { garageOrbitAxesForPointer } from "./garageOrbit";
import { renderSettingsPanelHtml } from "./settingsHtml";
import { escapeOpensSettings } from "./settingsEsc";
import { renderCarStatsPopup } from "./carStatsPopup";
import { renderLapCounterHtml } from "./lapHud";
import { renderFieldStripSvg, renderMiniMapSvg } from "./miniMap";
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
  private settings: GameSettings = loadGameSettings();
  private settingsOpen = false;
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
    window.addEventListener("contextmenu", (e) => this.onContextMenu(e, canvas));
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
      startDebugPad: () => {
        this.settingsOpen = false;
        this.uiRoot.querySelector(".settings-host")?.remove();
        this.finishCelebrate = null;
        this.stylePops.clear();
        void this.beginRace(debugPadLevel());
      },
      onUiRefresh: () => {
        if (this.screen !== "race") this.renderUi();
        else this.updateHud();
      },
    });
    this.renderUi();
  }

  private onContextMenu(e: MouseEvent, canvas: HTMLCanvasElement): void {
    const target = e.target;
    if (target instanceof Node && (target === canvas || canvas.contains(target))) {
      // Garage canvas RMB = orbit; race canvas RMB = settings.
      if (this.screen === "garage") return;
    }
    e.preventDefault();
    this.openSettings();
  }

  private openSettings(): void {
    if (this.settingsOpen) return;
    this.settingsOpen = true;
    gameAudio.playUiClick();
    this.renderSettingsOverlay();
  }

  private closeSettings(): void {
    if (!this.settingsOpen) return;
    this.settingsOpen = false;
    this.uiRoot.querySelector(".settings-host")?.remove();
    if (this.screen !== "race") this.renderUi();
    else this.wireUi();
  }

  /** Abort the current race without rewards and return to the garage hub. */
  private leaveRaceToGarage(): void {
    gameAudio.stopEngine();
    gameAudio.playUiClick();
    this.settingsOpen = false;
    this.uiRoot.querySelector(".settings-host")?.remove();
    this.finishCelebrate = null;
    this.race = null;
    this.stylePops.clear();
    this.renderer.clearCars();
    this.screen = "garage";
    this.renderUi();
  }

  private renderSettingsOverlay(): void {
    this.uiRoot.querySelector(".settings-host")?.remove();
    const host = document.createElement("div");
    host.className = "settings-host";
    host.innerHTML = renderSettingsPanelHtml(this.settings, gameAudio.muted, {
      inRace: this.screen === "race",
    });
    this.uiRoot.appendChild(host);
    host.querySelectorAll<HTMLElement>("[data-act]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (el instanceof HTMLButtonElement) this.onAction(el);
        else if (el.dataset.act === "close-settings") {
          gameAudio.playUiClick();
          this.closeSettings();
        }
      });
    });
    const first = host.querySelector<HTMLButtonElement>("button[data-nav]");
    first?.focus({ preventScroll: true });
  }

  private playerRaceInput(actions: ReturnType<typeof sampleActions>): {
    throttle: number;
    brake: number;
    steer: number;
    nitro: boolean;
    drift: boolean;
  } {
    const brake = actions.brake;
    const throttle = applyEasyModeThrottle(actions.throttle, brake, this.settings.easyMode);
    return {
      throttle,
      brake,
      steer: actions.steer,
      nitro: actions.nitro,
      drift: actions.drift,
    };
  }

  /** LMB/1-finger yaw; RMB/2-finger free tumble (with pad hover). */
  private bindGarageOrbit(canvas: HTMLCanvasElement): void {
    const pointers = new Map<number, { x: number; y: number; type: string; button: number }>();

    const touchLikeCount = (): number =>
      [...pointers.values()].filter((p) => p.type === "touch" || p.type === "pen").length;

    const syncOrbitClass = (): void => {
      const on = pointers.size > 0;
      this.renderer.setGarageDragging(on);
      canvas.classList.toggle("is-orbiting", on);
      let inspect = false;
      for (const p of pointers.values()) {
        const count =
          p.type === "touch" || p.type === "pen" ? Math.max(1, touchLikeCount()) : 1;
        const axes = garageOrbitAxesForPointer(p.button, p.type, count);
        if (axes.pitch) {
          inspect = true;
          break;
        }
      }
      this.renderer.setGaragePitchInspect(inspect);
    };

    const release = (pointerId: number): void => {
      if (!pointers.delete(pointerId)) return;
      try {
        canvas.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      syncOrbitClass();
    };

    /** RMB / mouse can lose capture without a canvas pointerup — still drop to the pad. */
    const releaseMouseIfIdle = (buttons: number): void => {
      if (buttons !== 0) return;
      for (const [id, p] of [...pointers.entries()]) {
        if (p.type === "mouse") release(id);
      }
    };

    canvas.addEventListener("contextmenu", (e) => {
      if (this.screen !== "garage") return;
      e.preventDefault();
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (this.screen !== "garage") return;
      const touchish = e.pointerType === "touch" || e.pointerType === "pen";
      const nextCount = touchish ? touchLikeCount() + 1 : 1;
      const axes = garageOrbitAxesForPointer(e.button, e.pointerType, nextCount);
      if (!touchish && !axes.yaw && !axes.pitch) return;

      pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
        button: e.button,
      });
      canvas.setPointerCapture(e.pointerId);
      syncOrbitClass();
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (this.screen !== "garage") return;
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;

      const axes = garageOrbitAxesForPointer(prev.button, prev.type, Math.max(1, touchLikeCount()));
      if (dx !== 0 || dy !== 0) this.renderer.addGarageOrbitFromDrag(dx, dy, axes);
    });

    canvas.addEventListener("pointerup", (e) => {
      release(e.pointerId);
      releaseMouseIfIdle(e.buttons);
    });
    canvas.addEventListener("pointercancel", (e) => release(e.pointerId));
    canvas.addEventListener("lostpointercapture", (e) => release(e.pointerId));
    window.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") releaseMouseIfIdle(e.buttons);
    });
  }

  tick(now: number, dt: number): void {
    const typing =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement;
    const actions = sampleActions();
    if (!typing) this.handleUiNav(actions);

    if (this.screen === "race" && this.race) {
      if (this.settingsOpen) {
        this.renderer.sync(this.race);
        return;
      }
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
            : this.playerRaceInput(actions),
        );
        for (const ev of this.race.consumeAudioEvents()) {
          playRaceAudioEvent(gameAudio, ev);
        }
        const player = this.race.player();
        const racing = !this.race.isCountingDown() && !player.finished && player.koTimer <= 0;
        gameAudio.syncEngine(racing, player.speed, player.nitroHeld);
        this.renderer.sync(this.race);
        this.updateHud();
        if (this.race.done) {
          gameAudio.stopEngine();
          this.finishCelebrate = createFinishCelebrate(this.race.result().place, now);
          this.updateFinishOverlay();
        }
      }
    } else {
      if (this.screen === "garage") this.syncGarageLook();
      gameAudio.stopEngine();
      this.renderer.renderIdle();
    }
  }

  private moveFocus(dir: UiNavDir): void {
    const buttons = this.navButtons();
    if (buttons.length === 0) return;
    this.applyFocus(nextFocusIndex(buttons, this.focusIndex, dir));
    gameAudio.playUiNav();
  }

  private onMenuKeyDown(e: KeyboardEvent): void {
    if (e.code === "F1" || e.code === "F2" || e.code === "F3" || e.code === "F4") return;
    if (this.settingsOpen) {
      if (e.code === "Escape") {
        e.preventDefault();
        this.closeSettings();
      }
      return;
    }
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      if (escapeOpensSettings(this.screen)) this.openSettings();
      else {
        this.screen = "garage";
        this.renderUi();
      }
      return;
    }
    if (this.screen === "race") return;
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
    if (this.settingsOpen) {
      const backEdge = risingEdge(actions.uiBack, this.lastUi.back);
      this.lastUi = {
        confirm: actions.uiConfirm,
        back: actions.uiBack,
        up: actions.uiUp,
        down: actions.uiDown,
        left: actions.uiLeft,
        right: actions.uiRight,
      };
      if (backEdge) this.closeSettings();
      return;
    }
    if (this.screen === "race") {
      const backEdge = risingEdge(actions.uiBack, this.lastUi.back);
      this.lastUi = {
        confirm: actions.uiConfirm,
        back: actions.uiBack,
        up: actions.uiUp,
        down: actions.uiDown,
        left: actions.uiLeft,
        right: actions.uiRight,
      };
      if (backEdge) this.openSettings();
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
    if (edges.back) {
      if (escapeOpensSettings(this.screen)) this.openSettings();
      else {
        this.screen = "garage";
        this.renderUi();
      }
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
    void this.beginRace(level);
  }

  private async beginRace(level: LevelDefinition): Promise<void> {
    if (!level.track.debugPad) await preloadTrackModels();
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
    for (const id of modelIds) void ensureCarPartTemplates(id as CarId);
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
    const countdown = this.race.countdownLabel();
    hud.innerHTML = `
      <div class="hud-cluster" data-dev-name="hud.cluster">
        <div class="hud-stats">
          <div class="hud-row hud-row--top" data-dev-name="hud.place-lap">
            ${
              this.race.track.debugPad
                ? `<strong data-dev-name="hud.debug-pad">Debug-Raster</strong>`
                : `<strong data-dev-name="hud.place">Platz ${p.place}/${this.race.cars.length}</strong>
            ${renderLapCounterHtml(p.lap, this.race.level.laps)}`
            }
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
        ${
          this.race.track.debugPad
            ? ""
            : `<div class="hud-field" data-dev-name="hud.field-wrap">${renderFieldStripSvg(this.race)}</div>
        <div class="hud-minimap" data-dev-name="hud.minimap-wrap">${renderMiniMapSvg(this.race)}</div>`
        }
      </div>
      ${
        countdown
          ? `<div class="race-countdown${countdown === "GO" ? " race-countdown--go" : ""}" data-dev-name="hud.countdown" role="status" aria-live="assertive">
              <span class="race-countdown__label">${countdown}</span>
            </div>`
          : ""
      }
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
        <p class="help">Tastatur: WASD / Pfeile (S halten = Rückwärts), Strg/E Drift, Space Nitro, Enter, Esc · Controller: Stick, LT Bremse/Rückwärts, LB Drift, A/RB Nitro · Tablet: Touch · Mini-Map: DU + die anderen</p>
        <div class="stack">
          <button data-nav data-act="open-settings">Einstellungen</button>
          <button data-nav data-act="toggle-mute">${gameAudio.muted ? "Ton aus" : "Ton an"}</button>
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
        muted: gameAudio.muted,
        previewCar: this.previewCar,
        previewPaint: this.previewPaint,
        previewSticker: this.previewSticker,
        previewPart: this.previewPart,
      });
      this.syncGarageLook();
    } else if (this.screen === "race") {
      body = `
        <div id="race-hud" class="race-hud"></div>
        <button type="button" data-act="open-settings" class="race-settings">Einstellungen</button>
        <button type="button" data-act="toggle-mute" class="race-mute" aria-pressed="${
          gameAudio.muted ? "true" : "false"
        }">${gameAudio.muted ? "Ton aus" : "Ton an"}</button>
        <div class="touch-controls" aria-label="Touch-Steuerung">
          <button type="button" data-touch="left">◀</button>
          <button type="button" data-touch="brake">Bremse / R</button>
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
    if (act === "open-settings") {
      this.openSettings();
      return;
    }
    if (act === "close-settings") {
      gameAudio.playUiClick();
      this.closeSettings();
      return;
    }
    if (act === "leave-race") {
      this.leaveRaceToGarage();
      return;
    }
    if (act === "toggle-easy-mode") {
      this.settings.easyMode = !this.settings.easyMode;
      writeGameSettings(this.settings);
      gameAudio.playUiClick();
      if (this.settingsOpen) this.renderSettingsOverlay();
      return;
    }
    if (act === "toggle-mute") {
      const wasMuted = gameAudio.muted;
      if (!wasMuted) gameAudio.playUiClick();
      gameAudio.toggleMute();
      if (wasMuted) gameAudio.playUiClick();
      if (this.settingsOpen) {
        this.renderSettingsOverlay();
        return;
      }
      if (this.screen === "race") {
        const muteBtn = this.uiRoot.querySelector<HTMLButtonElement>("[data-act='toggle-mute']");
        if (muteBtn) {
          muteBtn.textContent = gameAudio.muted ? "Ton aus" : "Ton an";
          muteBtn.setAttribute("aria-pressed", gameAudio.muted ? "true" : "false");
        }
        return;
      }
      this.renderUi();
      return;
    }

    const isBuy = act === "buy-car" || act === "buy-paint" || act === "buy-sticker" || act === "buy-part";
    const isConfirm =
      act === "race" || act === "adhoc-start" || act === "cup" || act === "free" || act === "adhoc";
    if (!isBuy) {
      if (isConfirm) gameAudio.playUiConfirm();
      else gameAudio.playUiClick();
    }

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
        gameAudio.playUiBuy();
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
        gameAudio.playUiBuy();
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
        gameAudio.playUiBuy();
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
        gameAudio.playUiBuy();
        this.previewPart = null;
        writeSave(this.save);
      }
    }
    if (this.screen !== "race") this.renderUi();
  }
}
