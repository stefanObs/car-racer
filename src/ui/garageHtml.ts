import { CARS, type CarId } from "../data/cars";
import { PARTS, type PartId } from "../data/parts";
import { partsForCar } from "../data/partsCatalog";
import { APP_CREDIT, APP_VERSION } from "../core/version";
import {
  GARAGE_PAINTS,
  PAINT_PRICE_CHF,
  STICKER_PRICE_CHF,
  ownsPaint,
  ownsSticker,
} from "../meta/cosmeticsShop";
import { isUnownedPreview, showcaseCarId } from "../meta/carShop";
import { formatChf, type CarKit, type StickerId } from "../meta/save";
import { carUsesNoseVariants } from "../render/carStickers";

function cosmeticsForCar(carId: CarId): { ids: StickerId[]; labels: Record<StickerId, string>; title: string } {
  if (carUsesNoseVariants(carId)) {
    return {
      title: "Nase / Kopf",
      ids: ["none", "flames", "bolt", "star"],
      labels: {
        none: "Glatt",
        flames: "Totenkopf",
        bolt: "Vogel",
        star: "Hund",
      },
    };
  }
  return {
    title: "Aufkleber",
    ids: ["none", "flames", "bolt", "star"],
    labels: {
      none: "Kein",
      flames: "Flammen",
      bolt: "Blitz",
      star: "Stern",
    },
  };
}

/** Comic garage hub HTML — equip-first, race CTAs at top. */
export function renderGarageHtml(opts: {
  chf: number;
  activeCar: CarId;
  ownedCars: CarId[];
  kit: CarKit;
  muted?: boolean;
  previewCar?: CarId | null;
  previewPaint?: string | null;
  previewSticker?: StickerId | null;
  previewPart?: PartId | null;
}): string {
  const previewing = isUnownedPreview(opts.ownedCars, opts.previewCar ?? null);
  const shownId = showcaseCarId(opts.activeCar, previewing ? opts.previewCar! : null);
  const car = CARS[shownId];
  const racer = CARS[opts.activeCar];
  const previewPaint = opts.previewPaint ?? null;
  const previewSticker = opts.previewSticker ?? null;

  const carButtons = (Object.keys(CARS) as CarId[])
    .map((id) => {
      const c = CARS[id];
      const owned = opts.ownedCars.includes(id);
      const active = opts.activeCar === id && !previewing;
      const preview = previewing && opts.previewCar === id;
      const cls = `garage-car${active ? " is-active" : ""}${preview ? " is-preview" : ""}${owned ? "" : " is-locked"}`;
      const meta = preview ? "Vorschau" : active ? "Aktiv" : owned ? "Wählen" : "Anschauen";
      return `<button data-nav data-act="car" data-car="${id}" class="${cls}">
        <span class="garage-car__name">${c.name}</span>
        <span class="garage-car__class">${c.classLabel}</span>
        <span class="garage-car__meta">${meta}${owned ? "" : ` · ${formatChf(c.priceChf)}`}</span>
      </button>`;
    })
    .join("");

  const catalog = partsForCar(shownId);
  const ownedParts = catalog.filter((id) => opts.kit.ownedParts.includes(id));
  const shopParts = catalog.filter((id) => !opts.kit.ownedParts.includes(id));

  const equipRows = ownedParts
    .map((id) => {
      const p = PARTS[id];
      const eq = opts.kit.equippedParts.includes(id);
      return `<div class="garage-part${eq ? " is-on" : ""}">
        <button data-nav data-act="part" data-part="${id}" class="garage-part__btn">
          <span class="garage-part__state">${eq ? "An" : "Aus"}</span>
          <span class="garage-part__name">${p.name}</span>
          <span class="garage-part__action">${eq ? "Ablegen" : "Ausrüsten"}</span>
        </button>
        <small><b>+</b> ${p.pro}<br/><b>−</b> ${p.con}</small>
      </div>`;
    })
    .join("");

  const shopRows = shopParts
    .map((id) => {
      const p = PARTS[id];
      const preview = opts.previewPart === id;
      const cls = `garage-part garage-part--shop${preview ? " is-preview" : ""}`;
      return `<div class="${cls}">
        <button data-nav data-act="part" data-part="${id}" class="garage-part__btn">
          <span class="garage-part__state">${preview ? "Vorschau" : "Neu"}</span>
          <span class="garage-part__name">${p.name}</span>
          <span class="garage-part__action">${preview ? "Abbrechen" : `Anschauen · ${formatChf(p.priceChf)}`}</span>
        </button>
        <small><b>+</b> ${p.pro}<br/><b>−</b> ${p.con}</small>
      </div>`;
    })
    .join("");

  const partBuy =
    opts.previewPart != null && PARTS[opts.previewPart]
      ? `<div class="garage-cosmetic-buy" data-dev-name="garage.part-preview">
          <p class="garage-preview-banner"><strong>Teil-Vorschau</strong> — ${PARTS[opts.previewPart].name} noch nicht gekauft.</p>
          <button data-nav data-act="buy-part" data-part="${opts.previewPart}" class="garage-buy" ${
            opts.chf >= PARTS[opts.previewPart].priceChf ? "" : "disabled"
          }>Kaufen ${formatChf(PARTS[opts.previewPart].priceChf)}</button>
        </div>`
      : "";

  const paints = GARAGE_PAINTS.map((c) => {
    const owned = ownsPaint(opts.kit, c);
    const equipped = opts.kit.paint === c && !previewPaint;
    const preview = previewPaint === c;
    const cls = `swatch${equipped ? " is-on" : ""}${preview ? " is-preview" : ""}${owned ? "" : " is-locked"}`;
    const mark = equipped ? "✓" : preview ? "?" : owned ? "" : "·";
    return `<button data-nav data-act="paint" data-color="${c}" class="${cls}" style="--sw:${c}" aria-label="Lack ${c}${owned ? "" : " Vorschau"}">${mark}</button>`;
  }).join("");

  const cosmetics = cosmeticsForCar(opts.activeCar);
  const stickers = cosmetics.ids
    .map((s) => {
      const owned = ownsSticker(opts.kit, s);
      const equipped = opts.kit.sticker === s && !previewSticker;
      const preview = previewSticker === s;
      const cls = `chip${equipped ? " is-on" : ""}${preview ? " is-preview" : ""}${owned ? "" : " is-locked"}`;
      const tag = owned ? "" : ` · ${formatChf(STICKER_PRICE_CHF)}`;
      return `<button data-nav data-act="sticker" data-sticker="${s}" class="${cls}">${cosmetics.labels[s]}${tag}</button>`;
    })
    .join("");

  const paintBuy =
    previewPaint != null
      ? `<div class="garage-cosmetic-buy" data-dev-name="garage.paint-preview">
          <p class="garage-preview-banner"><strong>Lack-Vorschau</strong> — noch nicht gekauft.</p>
          <button data-nav data-act="buy-paint" data-color="${previewPaint}" class="garage-buy" ${
            opts.chf >= PAINT_PRICE_CHF ? "" : "disabled"
          }>Kaufen ${formatChf(PAINT_PRICE_CHF)}</button>
        </div>`
      : "";

  const stickerBuy =
    previewSticker != null
      ? `<div class="garage-cosmetic-buy" data-dev-name="garage.sticker-preview">
          <p class="garage-preview-banner"><strong>${cosmetics.title}-Vorschau</strong> — noch nicht gekauft.</p>
          <button data-nav data-act="buy-sticker" data-sticker="${previewSticker}" class="garage-buy" ${
            opts.chf >= STICKER_PRICE_CHF ? "" : "disabled"
          }>Kaufen ${formatChf(STICKER_PRICE_CHF)}</button>
        </div>`
      : "";

  return `
    <header class="garage-hero">
      <div>
        <p class="garage-kicker">Crash Circuit</p>
        <h1 class="brand garage-title">Garage</h1>
        <p class="tag">Ziehen zum Drehen · rüst Teile · dann ab auf die Piste</p>
        <div class="garage-hero__actions">
          <button data-nav data-act="open-settings" class="garage-settings" data-dev-name="garage.settings">
            Einstellungen
          </button>
        </div>
      </div>
      <div class="garage-wallet" data-dev-name="garage.wallet">
        <span class="garage-wallet__label">Kasse</span>
        <strong>${formatChf(opts.chf)}</strong>
        <span class="garage-wallet__ver">v${APP_VERSION}</span>
        <span class="garage-wallet__credit">${APP_CREDIT}</span>
      </div>
    </header>

    <section class="garage-race" aria-label="Rennen starten">
      <h2 class="garage-section">Rennen</h2>
      <div class="garage-race__row">
        <button data-nav data-act="cup" class="garage-cta garage-cta--primary">Cup</button>
        <button data-nav data-act="free" class="garage-cta">Freier Modus</button>
        <button data-nav data-act="training" class="garage-cta">Training</button>
        <button data-nav data-act="adhoc" class="garage-cta">Ad-hoc</button>
      </div>
    </section>

    <section class="garage-bay-card${previewing ? " garage-bay-card--preview" : ""}" aria-label="${previewing ? "Autovorschau" : "Aktives Auto"}">
      <h2 class="garage-section">${previewing ? "Vorschau" : "Dein Auto"}</h2>
      ${
        previewing
          ? `<p class="garage-preview-banner" data-dev-name="garage.preview">
              <strong>Vorschau</strong> — ${car.name} ist noch nicht deins.
            </p>
            <p class="garage-active"><strong>${car.name}</strong> · ${car.classLabel}</p>
            <p class="dim">${car.description}</p>
            <button data-nav data-act="buy-car" data-car="${shownId}" class="garage-buy" ${opts.chf >= car.priceChf ? "" : "disabled"}>
              Kaufen ${formatChf(car.priceChf)}
            </button>
            <p class="dim">Rennen fährst du weiter mit <strong>${racer.name}</strong>, bis du kaufst.</p>`
          : `<p class="garage-active"><strong>${car.name}</strong> · ${car.classLabel}</p>
            <p class="dim">Teile, Lack und Aufkleber gehören nur zu diesem Auto.</p>`
      }
      <div class="garage-cars">${carButtons}</div>
    </section>

    ${
      previewing
        ? `<section class="garage-preview-tune" aria-label="Tuning gesperrt">
            <h2 class="garage-section">Ausrüsten</h2>
            <p class="dim">Erst kaufen — dann Teile, Lack und Aufkleber für ${car.name}.</p>
          </section>`
        : `<section class="garage-equip" aria-label="Ausrüstung">
      <h2 class="garage-section garage-section--equip">Ausrüsten <span class="dim">(${car.name})</span></h2>
      <p class="garage-stock-hint dim">Bestand — nur ${car.name}</p>
      <div class="garage-parts garage-parts--grid">
        ${equipRows || `<p class="dim garage-parts__empty">Noch keine Teile — unten im Laden kaufen.</p>`}
      </div>
      <h3 class="garage-sub">Laden</h3>
      <p class="dim garage-stock-hint">Tippen = Vorschau am Auto · dann Kaufen</p>
      <div class="garage-parts garage-parts--grid garage-parts--shop">
        ${shopRows || `<p class="dim garage-parts__empty">Alles gekauft. Zeit zum Rennen!</p>`}
      </div>
      ${partBuy}
    </section>

    <section aria-label="Lack und Schmücken">
      <h2 class="garage-section">Schmücken</h2>
      <p class="dim garage-stock-hint">Tippen = Vorschau · Kaufen speichert den Look für ${car.name}</p>
      <div class="stack row garage-swatches">${paints}</div>
      ${paintBuy}
      <h3 class="garage-sub">${cosmetics.title}</h3>
      <div class="stack row garage-chips">${stickers}</div>
      ${stickerBuy}
    </section>`
    }

    <p class="help">Tastatur · Controller · Tablet · Dev F1/F2/F3</p>
    <div class="garage-footer-row">
      <button data-nav data-act="toggle-mute" class="garage-mute" aria-pressed="${opts.muted ? "true" : "false"}">${
        opts.muted ? "Ton aus" : "Ton an"
      }</button>
      <button data-nav data-act="open-settings" class="garage-settings">Einstellungen</button>
      <button data-nav data-act="menu" class="garage-help-link">Hilfe</button>
    </div>
  `;
}
