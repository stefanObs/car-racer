import type { CarId } from "../data/cars";
import type { PartId } from "../data/parts";
import { applyPhotoMode, assignDevNames, clampFinishPlace, isPhotoMode, parseChfAmount } from "./cheats";
import { allPartsForCar, renderDevPartsPanelHtml, toggleEquippedPart } from "./partsPanel";

export type DevDialog = "none" | "money" | "finish" | "parts";

type DevHooks = {
  getChf: () => number;
  setChf: (amount: number) => void;
  canForceFinish: () => boolean;
  fieldSize: () => number;
  forceFinish: (place: number) => void;
  startDebugPad: () => void;
  onUiRefresh: () => void;
  canSwapParts: () => boolean;
  partsCarId: () => CarId | null;
  equippedParts: () => PartId[];
  setEquippedParts: (parts: PartId[]) => void;
};

type PhotoModeWindow = Window & {
  __ccPhotoMode?: boolean;
  __ccSetPhotoMode?: (on: boolean) => void;
};

/**
 * F1 name overlay, F2 CHF setter, F3 force-finish place picker, F4 raster pad, F5 Teile, F6 Foto.
 * Mounts outside the main UI so GameApp re-renders do not wipe dialogs.
 */
export class DevTools {
  readonly root: HTMLElement;
  showNames = false;
  dialog: DevDialog = "none";
  private moneyDraft = "1000";
  private readonly hooks: DevHooks;

  constructor(host: HTMLElement, hooks: DevHooks) {
    this.hooks = hooks;
    this.root = document.createElement("div");
    this.root.id = "dev-root";
    this.root.className = "dev-root";
    this.root.dataset.devName = "#dev-root";
    host.appendChild(this.root);
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    const w = window as PhotoModeWindow;
    w.__ccSetPhotoMode = (on) => this.setPhotoMode(on);
    w.__ccPhotoMode = isPhotoMode(document.documentElement);
    this.render();
  }

  setPhotoMode(on: boolean): void {
    applyPhotoMode(document.documentElement, on);
    (window as PhotoModeWindow).__ccPhotoMode = on;
    this.render();
  }

  tagUi(uiRoot: HTMLElement): void {
    assignDevNames(uiRoot);
    const canvas = document.querySelector<HTMLElement>("#game-canvas");
    if (canvas && !canvas.dataset.devName) canvas.dataset.devName = "#game-canvas";
    this.syncNameClass();
  }

  closePartsPanel(): void {
    if (this.dialog !== "parts") return;
    this.dialog = "none";
    this.render();
  }

  private syncNameClass(): void {
    document.documentElement.classList.toggle("dev-show-names", this.showNames);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === "F1") {
      e.preventDefault();
      this.showNames = !this.showNames;
      this.syncNameClass();
      this.render();
      return;
    }
    if (e.code === "F2") {
      e.preventDefault();
      this.moneyDraft = String(this.hooks.getChf());
      this.dialog = this.dialog === "money" ? "none" : "money";
      this.render();
      return;
    }
    if (e.code === "F3") {
      e.preventDefault();
      if (!this.hooks.canForceFinish()) {
        this.dialog = "none";
        this.render();
        return;
      }
      this.dialog = this.dialog === "finish" ? "none" : "finish";
      this.render();
      return;
    }
    if (e.code === "F4") {
      e.preventDefault();
      this.dialog = "none";
      this.render();
      this.hooks.startDebugPad();
      return;
    }
    if (e.code === "F5") {
      if (!this.hooks.canSwapParts()) return;
      e.preventDefault();
      this.dialog = this.dialog === "parts" ? "none" : "parts";
      this.render();
      return;
    }
    if (e.code === "F6") {
      e.preventDefault();
      this.setPhotoMode(!isPhotoMode(document.documentElement));
      return;
    }
    if (e.code === "Escape" && isPhotoMode(document.documentElement)) {
      e.preventDefault();
      this.setPhotoMode(false);
    }
  }

  private render(): void {
    const photo = isPhotoMode(document.documentElement) ? "F6 Foto AN" : "F6 Foto";
    const badge = this.showNames ? "F1 Namen AN" : "F1 Namen AUS";
    let dialog = "";
    if (this.dialog === "money") {
      dialog = `
        <div class="dev-dialog" data-dev-name="dev.dialog.money" role="dialog" aria-label="Dev CHF">
          <h3 data-dev-name="dev.money.title">Dev: CHF setzen</h3>
          <p class="dim" data-dev-name="dev.money.hint">Aktuell ${this.hooks.getChf()} — Betrag eingeben</p>
          <input data-dev-money inputmode="numeric" value="${this.moneyDraft}" data-dev-name="dev.money.input" />
          <div class="stack row">
            <button type="button" data-dev-money-apply data-dev-name="dev.money.apply">Übernehmen</button>
            <button type="button" data-dev-close data-dev-name="dev.money.close">Schließen</button>
          </div>
        </div>
      `;
    } else if (this.dialog === "finish") {
      const size = this.hooks.fieldSize();
      const places = Array.from({ length: size }, (_, i) => i + 1)
        .map(
          (p) =>
            `<button type="button" data-dev-finish="${p}" data-dev-name="dev.finish.place.${p}">Platz ${p}</button>`,
        )
        .join("");
      dialog = `
        <div class="dev-dialog" data-dev-name="dev.dialog.finish" role="dialog" aria-label="Dev Rennen beenden">
          <h3 data-dev-name="dev.finish.title">Dev: Rennen beenden</h3>
          <p class="dim" data-dev-name="dev.finish.hint">Platzierung für den Spieler wählen</p>
          <div class="stack row">${places}</div>
          <button type="button" data-dev-close data-dev-name="dev.finish.close">Abbrechen</button>
        </div>
      `;
    } else if (this.dialog === "parts") {
      const carId = this.hooks.partsCarId();
      if (carId) dialog = renderDevPartsPanelHtml(carId, this.hooks.equippedParts());
      else this.dialog = "none";
    }

    this.root.innerHTML = `
      <div class="dev-badge" data-dev-name="dev.badge">${badge} · F2 CHF · F3 Ziel · F4 Raster · F5 Teile · ${photo}</div>
      ${dialog}
    `;
    this.root.querySelector("[data-dev-close]")?.addEventListener("click", () => {
      this.dialog = "none";
      this.render();
    });
    const moneyInput = this.root.querySelector<HTMLInputElement>("[data-dev-money]");
    moneyInput?.addEventListener("input", () => {
      this.moneyDraft = moneyInput.value;
    });
    moneyInput?.addEventListener("keydown", (e) => e.stopPropagation());
    this.root.querySelector("[data-dev-money-apply]")?.addEventListener("click", () => {
      const parsed = parseChfAmount(this.moneyDraft);
      if (parsed === null) return;
      this.hooks.setChf(parsed);
      this.dialog = "none";
      this.render();
      this.hooks.onUiRefresh();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-dev-finish]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const place = clampFinishPlace(Number(btn.dataset.devFinish), this.hooks.fieldSize());
        this.hooks.forceFinish(place);
        this.dialog = "none";
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-dev-part]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const carId = this.hooks.partsCarId();
        const partId = btn.dataset.devPart as PartId | undefined;
        if (!carId || !partId) return;
        this.hooks.setEquippedParts(toggleEquippedPart(carId, this.hooks.equippedParts(), partId));
        this.render();
      });
    });
    this.root.querySelector("[data-dev-parts-none]")?.addEventListener("click", () => {
      this.hooks.setEquippedParts([]);
      this.render();
    });
    this.root.querySelector("[data-dev-parts-all]")?.addEventListener("click", () => {
      const carId = this.hooks.partsCarId();
      if (!carId) return;
      this.hooks.setEquippedParts(allPartsForCar(carId));
      this.render();
    });
    if (moneyInput && this.dialog === "money") moneyInput.focus();
  }
}
