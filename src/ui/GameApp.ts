import { CARS, type CarId } from "../data/cars";
import { CUP_LEVELS, freeLevels, levelById } from "../data/levels";
import { PARTS, activeSynergies, mergeStats, type PartId } from "../data/parts";
import { bindKeyboard, sampleActions, touchState } from "../input/actions";
import { formatChf, loadSave, writeSave, type SaveData, type StickerId } from "../meta/save";
import { createGameRenderer, type GameRenderer } from "../render/createGameRenderer";
import { DAMAGE_LABELS } from "../sim/damage";
import { RaceSession } from "../sim/race";
import { APP_VERSION } from "../core/version";

type Screen = "menu" | "cup" | "free" | "garage" | "race" | "results";

export class GameApp {
  private save: SaveData = loadSave();
  private screen: Screen = "menu";
  private race: RaceSession | null = null;
  private renderer: GameRenderer;
  private renderMode: "webgl" | "canvas2d" = "webgl";
  private lastResult: ReturnType<RaceSession["result"]> | null = null;
  private focusIndex = 0;
  private uiRoot: HTMLElement;
  private lastUiConfirm = false;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.uiRoot = uiRoot;
    bindKeyboard();
    const created = createGameRenderer(canvas);
    this.renderer = created.renderer;
    this.renderMode = created.mode;
    this.renderUi();
  }

  tick(now: number, dt: number): void {
    const actions = sampleActions();
    this.handleUiNav(actions);

    if (this.screen === "race" && this.race) {
      this.race.step(dt, {
        throttle: actions.throttle,
        brake: actions.brake,
        steer: actions.steer,
        nitro: actions.nitro,
      });
      this.renderer.sync(this.race);
      this.updateHud();
      if (this.race.done) {
        this.lastResult = this.race.result();
        this.applyRaceRewards(this.lastResult, this.race.level.id);
        this.screen = "results";
        this.renderUi();
      }
    } else {
      this.renderer.renderIdle();
    }
    void now;
  }

  private handleUiNav(actions: ReturnType<typeof sampleActions>): void {
    if (this.screen === "race") return;
    const confirmEdge = actions.uiConfirm && !this.lastUiConfirm;
    this.lastUiConfirm = actions.uiConfirm;
    if (!confirmEdge && !actions.uiBack) return;
    // Simple: Enter activates focused button via click simulation
    if (confirmEdge) {
      const buttons = [...this.uiRoot.querySelectorAll<HTMLButtonElement>("button[data-nav]")];
      const btn = buttons[this.focusIndex % Math.max(buttons.length, 1)];
      btn?.click();
    }
    if (actions.uiBack && this.screen !== "menu") {
      this.screen = "menu";
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

  private startRace(levelId: string): void {
    const level = levelById(levelId) ?? freeLevels(this.save.unlockedLevels).find((l) => l.id === levelId);
    if (!level) return;
    this.renderer.clearCars();
    this.race = new RaceSession({
      level,
      playerCarId: this.save.activeCar,
      playerParts: this.save.equippedParts,
      playerPaint: this.save.paint,
      playerSticker: this.save.sticker,
    });
    this.renderer.buildTrack(this.race);
    this.screen = "race";
    this.renderUi();
  }

  private updateHud(): void {
    const hud = this.uiRoot.querySelector("#race-hud");
    if (!hud || !this.race) return;
    const p = this.race.player();
    const stage = this.race.playerDamageStage();
    hud.innerHTML = `
      <div class="hud-row"><strong>Platz ${p.place}/${this.race.cars.length}</strong> · Runde ${Math.min(p.lap, this.race.level.laps)}/${this.race.level.laps}</div>
      <div class="hud-row">Schaden: ${DAMAGE_LABELS[stage]}${p.healFx > 0.2 ? " · Reparatur…" : ""}</div>
      <div class="bars">
        <div class="bar"><span>Nitro</span><i style="width:${Math.round(p.nitro * 100)}%"></i></div>
        <div class="bar"><span>Karosserie</span><i class="hp" style="width:${Math.round(p.hp * 100)}%"></i></div>
      </div>
    `;
  }

  private renderUi(): void {
    const buttons: string[] = [];
    let body = "";
    if (this.screen === "menu") {
      body = `
        <h1 class="brand">Crash Circuit</h1>
        <p class="tag">Getunte Autos. Saubere Linie. CHF fürs Tuning.</p>
        <p class="meta">${formatChf(this.save.chf)} · v${APP_VERSION}${this.renderMode === "canvas2d" ? " · 2D-Fallback" : ""}</p>
        <div class="stack">
          <button data-nav data-act="cup">Cup</button>
          <button data-nav data-act="free">Freier Modus</button>
          <button data-nav data-act="garage">Garage</button>
        </div>
        <p class="help">Tastatur: WASD / Pfeile, Leertaste Nitro · Controller & Touch unterstützt</p>
      `;
    } else if (this.screen === "cup") {
      const rows = CUP_LEVELS.map((l) => {
        const locked = (l.cupIndex ?? 99) > this.save.cupIndexUnlocked;
        const stars = this.save.cupStars[l.id] ?? 0;
        return `<button data-nav data-act="race" data-level="${l.id}" ${locked ? "disabled" : ""}>
          ${l.cupIndex}. ${l.displayName} ${locked ? "(gesperrt)" : ""} ${"★".repeat(stars)}
        </button>`;
      }).join("");
      body = `<h2>Blitz-Cup</h2><div class="stack">${rows}</div><button data-nav data-act="menu">Zurück</button>`;
    } else if (this.screen === "free") {
      const levels = freeLevels(this.save.unlockedLevels);
      const rows = levels
        .map(
          (l) =>
            `<button data-nav data-act="race" data-level="${l.id}">${l.displayName}</button>`,
        )
        .join("");
      body = `<h2>Freier Modus</h2><div class="stack">${rows || "<p>Noch keine Strecken freigeschaltet.</p>"}</div><button data-nav data-act="menu">Zurück</button>`;
    } else if (this.screen === "garage") {
      body = this.garageHtml();
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
        <p class="podium">Platz ${this.lastResult.place}</p>
        <p>${formatChf(this.lastResult.purseChf)} <span class="dim">(inkl. Style ${formatChf(this.lastResult.styleBonus)})</span></p>
        <p>${this.lastResult.starsEarned ? "Sterne verdient!" : ""}</p>
        <div class="stack">
          <button data-nav data-act="cup">Weiter Cup</button>
          <button data-nav data-act="garage">Garage</button>
          <button data-nav data-act="menu">Menü</button>
        </div>
      `;
    }

    this.uiRoot.innerHTML = `<div class="panel ${this.screen}">${body}</div>`;
    this.wireUi();
    void buttons;
  }

  private garageHtml(): string {
    const stats = mergeStats(CARS[this.save.activeCar].stats, this.save.equippedParts);
    const syn = activeSynergies(this.save.equippedParts);
    const carButtons = (Object.keys(CARS) as CarId[])
      .map((id) => {
        const c = CARS[id as CarId];
        const owned = this.save.ownedCars.includes(id);
        const active = this.save.activeCar === id;
        return `<button data-nav data-act="car" data-car="${id}" ${!owned ? "" : ""}>
          ${c.name} (${c.classLabel})${active ? " ✓" : ""}${!owned ? ` — ${formatChf(c.priceChf)}` : ""}
        </button>`;
      })
      .join("");

    const partButtons = (Object.keys(PARTS) as PartId[])
      .map((id) => {
        const p = PARTS[id];
        const owned = this.save.ownedParts.includes(id);
        const eq = this.save.equippedParts.includes(id);
        return `<div class="part">
          <button data-nav data-act="part" data-part="${id}">${eq ? "[An]" : "[Aus]"} ${p.name} ${owned ? "" : formatChf(p.priceChf)}</button>
          <small><b>+</b> ${p.pro}<br/><b>−</b> ${p.con}</small>
        </div>`;
      })
      .join("");

    return `
      <h2>Garage</h2>
      <p class="meta">${formatChf(this.save.chf)}</p>
      <h3>Autos</h3><div class="stack">${carButtons}</div>
      <h3>Lack</h3>
      <div class="stack row">
        ${["#e03131", "#339af0", "#f08c00", "#ffffff", "#1b1b1f"]
          .map(
            (c) =>
              `<button data-nav data-act="paint" data-color="${c}" style="background:${c};color:#fff">${this.save.paint === c ? "✓" : ""}</button>`,
          )
          .join("")}
      </div>
      <h3>Aufkleber</h3>
      <div class="stack row">
        ${(["none", "flames", "bolt", "star"] as StickerId[])
          .map(
            (s) =>
              `<button data-nav data-act="sticker" data-sticker="${s}">${s}${this.save.sticker === s ? " ✓" : ""}</button>`,
          )
          .join("")}
      </div>
      <h3>Teile</h3>
      <div class="parts">${partButtons}</div>
      <p class="stats">Tempo ${stats.topSpeed.toFixed(2)} · Accel ${stats.accel.toFixed(2)} · Grip ${stats.grip.toFixed(2)} · Federung ${stats.suspension.toFixed(2)}</p>
      <p class="syn">${syn.length ? "Kombo: " + syn.map((s) => s.name).join(", ") : "Keine Kombo aktiv"}</p>
      <button data-nav data-act="menu">Zurück</button>
    `;
  }

  private wireUi(): void {
    this.uiRoot.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => this.onAction(btn));
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
    const navButtons = [...this.uiRoot.querySelectorAll<HTMLButtonElement>("button[data-nav]")];
    navButtons.forEach((b, i) => {
      b.addEventListener("focus", () => {
        this.focusIndex = i;
      });
    });
    navButtons[0]?.focus();
  }

  private onAction(btn: HTMLButtonElement): void {
    const act = btn.dataset.act;
    if (act === "menu") this.screen = "menu";
    if (act === "cup") this.screen = "cup";
    if (act === "free") this.screen = "free";
    if (act === "garage") this.screen = "garage";
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
          this.save.activeCar = id;
          this.save.paint = CARS[id].defaultPaint;
        }
      } else {
        this.save.activeCar = id;
      }
      writeSave(this.save);
    }
    if (act === "paint" && btn.dataset.color) {
      this.save.paint = btn.dataset.color;
      writeSave(this.save);
    }
    if (act === "sticker" && btn.dataset.sticker) {
      this.save.sticker = btn.dataset.sticker as StickerId;
      writeSave(this.save);
    }
    if (act === "part" && btn.dataset.part) {
      const id = btn.dataset.part as PartId;
      if (!this.save.ownedParts.includes(id)) {
        const price = PARTS[id].priceChf;
        if (this.save.chf >= price) {
          this.save.chf -= price;
          this.save.ownedParts.push(id);
          this.save.equippedParts.push(id);
        }
      } else if (this.save.equippedParts.includes(id)) {
        this.save.equippedParts = this.save.equippedParts.filter((p) => p !== id);
      } else {
        this.save.equippedParts.push(id);
      }
      writeSave(this.save);
    }
    if (this.screen !== "race") this.renderUi();
  }
}
