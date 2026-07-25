import type { CarId } from "../data/cars";
import { CARS } from "../data/cars";
import { activeSynergies, mergeStats, type PartId } from "../data/parts";
import { carStatLevels, levelTone } from "./carStatLevels";

/** Top-right garage popup: car properties as 1–100 level bars. */
export function renderCarStatsPopup(opts: {
  carId: CarId;
  equippedParts: PartId[];
}): string {
  const car = CARS[opts.carId];
  const stats = mergeStats(car.stats, opts.equippedParts);
  const rows = carStatLevels(stats);
  const syn = activeSynergies(opts.equippedParts);

  const bars = rows
    .map((row) => {
      const tone = levelTone(row.level);
      return `<div class="stat-bar" data-stat="${row.key}" data-dev-name="garage.stat.${row.key}">
        <div class="stat-bar__meta">
          <span class="stat-bar__label">${row.label}</span>
          <span class="stat-bar__value">${row.level}</span>
        </div>
        <div class="stat-bar__track" role="meter" aria-label="${row.label}" aria-valuemin="1" aria-valuemax="100" aria-valuenow="${row.level}">
          <i class="stat-bar__fill tone-${tone}" style="--lvl:${row.level}"></i>
        </div>
      </div>`;
    })
    .join("");

  const synLine = syn.length
    ? `Kombo: ${syn.map((s) => s.name).join(", ")}`
    : "Keine Kombo — Teile kombinieren!";

  return `
    <aside class="car-stats-popup" data-dev-name="garage.stats.popup" aria-label="Auto-Eigenschaften">
      <header class="car-stats-popup__head">
        <p class="car-stats-popup__kicker">Eigenschaften</p>
        <h2 class="car-stats-popup__title">${car.name}</h2>
        <p class="car-stats-popup__class">${car.classLabel}</p>
      </header>
      <div class="car-stats-popup__bars">${bars}</div>
      <p class="car-stats-popup__syn">${synLine}</p>
    </aside>
  `;
}
