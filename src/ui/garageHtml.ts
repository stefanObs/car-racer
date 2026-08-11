import { CARS, type CarId } from "../data/cars";
import { PARTS, type PartId } from "../data/parts";
import { APP_VERSION } from "../core/version";
import { isUnownedPreview, showcaseCarId } from "../meta/carShop";
import { formatChf, type CarKit, type StickerId } from "../meta/save";
import { carUsesNoseVariants } from "../render/carStickers";

const PAINTS = ["#e03131", "#339af0", "#f08c00", "#12b886", "#2f9e44", "#868e96", "#ffffff", "#1b1b1f"] as const;

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
        ironClad: "IronClad",
      },
    };
  }
  if (carId === "bunker") {
    return {
      title: "Tür-Aufkleber",
      ids: ["none", "ironClad", "flames", "bolt", "star"],
      labels: {
        none: "Kein",
        ironClad: "IronClad",
        flames: "Flammen",
        bolt: "Blitz",
        star: "Stern",
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
      ironClad: "IronClad",
    },
  };
}

/** Comic garage hub HTML — equip-first, race CTAs at top. */
export function renderGarageHtml(opts: {
  chf: number;
  activeCar: CarId;
  ownedCars: CarId[];
  kit: CarKit;
  previewCar?: CarId | null;
}): string {
  const previewing = isUnownedPreview(opts.ownedCars, opts.previewCar ?? null);
  const shownId = showcaseCarId(opts.activeCar, previewing ? opts.previewCar! : null);
  const car = CARS[shownId];
  const racer = CARS[opts.activeCar];

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

  const ownedParts = (Object.keys(PARTS) as PartId[]).filter((id) => opts.kit.ownedParts.includes(id));
  const shopParts = (Object.keys(PARTS) as PartId[]).filter((id) => !opts.kit.ownedParts.includes(id));

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
      const can = opts.chf >= p.priceChf;
      return `<div class="garage-part garage-part--shop">
        <button data-nav data-act="part" data-part="${id}" class="garage-part__btn" ${can ? "" : "disabled"}>
          <span class="garage-part__state">Neu</span>
          <span class="garage-part__name">${p.name}</span>
          <span class="garage-part__action">Kaufen ${formatChf(p.priceChf)}</span>
        </button>
        <small><b>+</b> ${p.pro}<br/><b>−</b> ${p.con}</small>
      </div>`;
    })
    .join("");

  const paints = PAINTS.map(
    (c) =>
      `<button data-nav data-act="paint" data-color="${c}" class="swatch${opts.kit.paint === c ? " is-on" : ""}" style="--sw:${c}" aria-label="Lack ${c}">${opts.kit.paint === c ? "✓" : ""}</button>`,
  ).join("");

  const cosmetics = cosmeticsForCar(opts.activeCar);
  const stickers = cosmetics.ids
    .map(
      (s) =>
        `<button data-nav data-act="sticker" data-sticker="${s}" class="chip${opts.kit.sticker === s ? " is-on" : ""}">${cosmetics.labels[s]}</button>`,
    )
    .join("");

  return `
    <header class="garage-hero">
      <div>
        <p class="garage-kicker">Crash Circuit</p>
        <h1 class="brand garage-title">Garage</h1>
        <p class="tag">Ziehen zum Drehen · rüst Teile · dann ab auf die Piste</p>
      </div>
      <div class="garage-wallet" data-dev-name="garage.wallet">
        <span class="garage-wallet__label">Kasse</span>
        <strong>${formatChf(opts.chf)}</strong>
        <span class="garage-wallet__ver">v${APP_VERSION}</span>
      </div>
    </header>

    <section class="garage-race" aria-label="Rennen starten">
      <h2 class="garage-section">Rennen</h2>
      <div class="garage-race__row">
        <button data-nav data-act="cup" class="garage-cta garage-cta--primary">Cup</button>
        <button data-nav data-act="free" class="garage-cta">Freier Modus</button>
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
      <div class="garage-parts">
        ${equipRows || `<p class="dim">Noch keine Teile — unten im Laden kaufen.</p>`}
      </div>
      <h3 class="garage-sub">Laden</h3>
      <div class="garage-parts garage-parts--shop">
        ${shopRows || `<p class="dim">Alles gekauft. Zeit zum Rennen!</p>`}
      </div>
    </section>

    <section aria-label="Lack und Schmücken">
      <h2 class="garage-section">Schmücken</h2>
      <div class="stack row garage-swatches">${paints}</div>
      <h3 class="garage-sub">${cosmetics.title}</h3>
      <div class="stack row garage-chips">${stickers}</div>
    </section>`
    }

    <p class="help">Tastatur · Controller · Tablet · Dev F1/F2/F3</p>
    <button data-nav data-act="menu" class="garage-help-link">Hilfe</button>
  `;
}
