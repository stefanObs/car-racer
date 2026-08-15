import { createRaceSession, mountRace, settleRace, teardownRace } from "./raceFlow";
import { emptyGaragePreview, garagePreviewActive, type GaragePreview } from "./garagePreview";
import type { Screen } from "./screens";
import { applyAdhocSeed, applyMenuAction } from "./uiActions";
import { gameAudio } from "../audio/GameAudio";
import { playRaceAudioEvent } from "../audio/raceEvents";
import { type CarId } from "../data/cars";
import { debugPadLevel } from "../data/debugPad";
import { CUP_LEVELS, freeLevels, trainingLevels } from "../data/levels";
import { DevTools } from "../dev/DevTools";
import { bindKeyboard, sampleActions, touchState } from "../input/actions";
import { defaultFocusIndex, nextFocusIndex, risingEdge, type UiNavDir } from "../input/uiNav";
import { showcaseCarId, showcaseKit } from "../meta/carShop";
import { showcasePaint, showcaseSticker } from "../meta/cosmeticsShop";
import { showcaseParts } from "../meta/partsShop";
import { loadSave, writeSave, activeKit, type SaveData } from "../meta/save";
import {
  applyEasyModeThrottle,
  loadGameSettings,
  writeGameSettings,
  type GameSettings,
} from "../meta/gameSettings";
import { createGameRenderer, type GameRenderer } from "../render/createGameRenderer";
import { RaceSession } from "../sim/race";
import { generateAdhocLevel, randomSeed, type AdhocLength } from "../track/adhoc";
import type { LevelDefinition } from "../track/types";
import { renderAdhocHtml } from "../ui/adhocHtml";
import { renderGarageHtml } from "../ui/garageHtml";
import { garageOrbitAxesForPointer } from "../ui/garageOrbit";
import { renderMenuHtml } from "../ui/menuHtml";
import { renderCupPickHtml, renderFreePickHtml, renderTrainingPickHtml } from "../ui/modePickHtml";
import { renderRaceChromeHtml } from "../ui/raceChromeHtml";
import { renderResultsHtml } from "../ui/resultsHtml";
import { renderSettingsPanelHtml } from "../ui/settingsHtml";
import { escapeOpensSettings } from "../ui/settingsEsc";
import { renderCarStatsPopup } from "../ui/carStatsPopup";
import { syncRaceHud } from "../ui/raceHud";
import {
  advanceFinishCelebrate,
  createFinishCelebrate,
  finishOverlayHtml,
  type FinishCelebrate,
} from "../ui/finishCelebrate";
import {
  panelScreenOf,
  readPanelScrollTop,
  shouldPreservePanelScroll,
  writePanelScrollTop,
} from "../ui/panelScroll";
import { StylePopupQueue } from "../ui/stylePopups";

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
  private preview: GaragePreview = emptyGaragePreview();
  private stylePops = new StylePopupQueue();
  private settings: GameSettings = loadGameSettings();
  private settingsOpen = false;
  private uiRenderFrame = 0;
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
      canSwapParts: () => this.screen === "race" && !!this.race,
      partsCarId: () => {
        const id = this.race?.player().modelId;
        return id ? (id as CarId) : null;
      },
      equippedParts: () => this.race?.player().equippedParts ?? [],
      setEquippedParts: (parts) => {
        this.race?.setPlayerParts(parts);
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
    teardownRace(this.renderer, this.stylePops);
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
          this.lastResult = settleRace(this.save, this.race);
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
          const outcome = this.race.result();
          this.finishCelebrate = createFinishCelebrate(outcome.place, now, { ranked: outcome.ranked });
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

  private startRaceWithLevel(level: LevelDefinition): void {
    void this.beginRace(level);
  }

  private async beginRace(level: LevelDefinition): Promise<void> {
    cancelAnimationFrame(this.uiRenderFrame);
    this.uiRenderFrame = 0;
    this.stylePops.clear();
    this.finishCelebrate = null;
    this.race = createRaceSession(this.save, level);
    await mountRace(this.renderer, this.race);
    this.screen = "race";
    this.renderUi();
  }

  private updateHud(): void {
    const hud = this.uiRoot.querySelector<HTMLElement>("#race-hud");
    if (!hud || !this.race) return;
    const now = performance.now();
    for (const ev of this.race.consumeStyleEvents()) {
      this.stylePops.push(ev.amount, ev.reason, now);
    }
    syncRaceHud(hud, this.race, this.stylePops, now);
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
    const kit = showcaseKit(this.save, this.preview.car);
    this.renderer.setGarageLook({
      paint: showcasePaint(kit, this.preview.paint),
      sticker: showcaseSticker(kit, this.preview.sticker),
      modelId: showcaseCarId(this.save.activeCar, this.preview.car),
      equippedParts: showcaseParts(kit, this.preview.part),
    });
  }

  private renderUi(): void {
    if (this.screen !== "race") this.dev.closePartsPanel();
    document.documentElement.dataset.screen = this.screen;
    const preserveScroll = shouldPreservePanelScroll(panelScreenOf(this.uiRoot), this.screen);
    const savedScrollTop = preserveScroll ? readPanelScrollTop(this.uiRoot) : 0;
    const savedFocusIndex = this.focusIndex;
    let body = "";
    if (this.screen === "menu") {
      body = renderMenuHtml(this.save.chf, gameAudio.muted);
    } else if (this.screen === "cup") {
      body = renderCupPickHtml(CUP_LEVELS, this.save.cupIndexUnlocked, this.save.cupStars);
    } else if (this.screen === "free") {
      body = renderFreePickHtml(freeLevels(this.save.unlockedLevels));
    } else if (this.screen === "training") {
      body = renderTrainingPickHtml(trainingLevels());
    } else if (this.screen === "adhoc") {
      const preview = generateAdhocLevel({ seed: this.adhocSeed, length: this.adhocLength });
      this.lastAdhoc = preview;
      body = renderAdhocHtml({ seed: this.adhocSeed, length: this.adhocLength, preview });
    } else if (this.screen === "garage") {
      body = renderGarageHtml({
        chf: this.save.chf,
        activeCar: this.save.activeCar,
        ownedCars: this.save.ownedCars,
        kit: activeKit(this.save),
        muted: gameAudio.muted,
        previewCar: this.preview.car,
        previewPaint: this.preview.paint,
        previewSticker: this.preview.sticker,
        previewPart: this.preview.part,
      });
      this.syncGarageLook();
    } else if (this.screen === "race") {
      body = renderRaceChromeHtml(gameAudio.muted);
    } else if (this.screen === "results" && this.lastResult) {
      body = renderResultsHtml(this.lastResult);
    }

    const statsPopup =
      this.screen === "garage"
        ? renderCarStatsPopup({
            carId: showcaseCarId(this.save.activeCar, this.preview.car),
            equippedParts: showcaseParts(
              showcaseKit(this.save, this.preview.car),
              this.preview.part,
            ),
          })
        : "";
    const previewStamp =
      this.screen === "garage" &&
      garagePreviewActive(this.preview)
        ? `<div class="garage-preview-stamp" data-dev-name="garage.preview.stamp">Vorschau</div>`
        : "";
    this.uiRoot.innerHTML = `${statsPopup}${previewStamp}<div class="panel ${this.screen}" data-dev-name="panel.${this.screen}">${body}</div>`;
    this.wireUi({ preserveFocus: preserveScroll, focusIndex: savedFocusIndex });
    if (preserveScroll) writePanelScrollTop(this.uiRoot, savedScrollTop);
    this.dev.tagUi(this.uiRoot);
  }

  /** Replace the panel after the current pointer/click finishes (avoids detaching the button mid-click). */
  private scheduleRenderUi(): void {
    if (this.screen === "race") return;
    cancelAnimationFrame(this.uiRenderFrame);
    this.uiRenderFrame = requestAnimationFrame(() => {
      this.uiRenderFrame = 0;
      if (this.screen !== "race") this.renderUi();
    });
  }

  private wireUi(opts?: { preserveFocus?: boolean; focusIndex?: number }): void {
    this.uiRoot.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => this.onAction(btn));
    });
    const seedInput = this.uiRoot.querySelector<HTMLInputElement>("input[data-seed-input]");
    const applySeed = (): void => {
      if (!seedInput) return;
      const menu = this.menuState();
      applyAdhocSeed(menu, seedInput.value);
      this.adhocSeed = menu.adhocSeed;
      this.renderUi();
    };
    seedInput?.addEventListener("change", applySeed);
    seedInput?.addEventListener("keydown", (e) => {
      if (e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        applySeed();
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
    this.applyFocus(
      defaultFocusIndex(
        navButtons.map((b) => ({ disabled: b.disabled, act: b.dataset.act })),
        this.screen === "garage" ? "cup" : undefined,
      ),
    );
  }

  private menuState() {
    return {
      screen: this.screen,
      save: this.save,
      preview: this.preview,
      adhocSeed: this.adhocSeed,
      adhocLength: this.adhocLength,
      lastAdhoc: this.lastAdhoc,
    };
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
      act === "race" ||
      act === "adhoc-start" ||
      act === "cup" ||
      act === "free" ||
      act === "training" ||
      act === "adhoc";
    if (!isBuy) {
      if (isConfirm) gameAudio.playUiConfirm();
      else gameAudio.playUiClick();
    }

    const menu = this.menuState();
    const out = applyMenuAction(menu, act, btn.dataset);
    this.screen = menu.screen;
    this.adhocSeed = menu.adhocSeed;
    this.adhocLength = menu.adhocLength;
    this.lastAdhoc = menu.lastAdhoc;
    if (out.bought) gameAudio.playUiBuy();
    if (out.persist) writeSave(this.save);
    if (out.startLevel) {
      this.startRaceWithLevel(out.startLevel);
      return;
    }
    if (out.render === false) return;
    this.scheduleRenderUi();
  }
}
