import { CARS, type CarId } from "../data/cars";
import { PARTS, type PartId } from "../data/parts";
import { carSupportsPart, partsForCar } from "../data/partsCatalog";

/** Toggle a Teil on/off for a live race kit (ignores unsupported ids). */
export function toggleEquippedPart(
  carId: CarId,
  equipped: readonly PartId[],
  partId: PartId,
): PartId[] {
  if (!carSupportsPart(carId, partId)) return [...equipped];
  if (equipped.includes(partId)) return equipped.filter((id) => id !== partId);
  return [...equipped, partId];
}

export function allPartsForCar(carId: CarId): PartId[] {
  return partsForCar(carId);
}

export function renderDevPartsPanelHtml(carId: CarId, equipped: readonly PartId[]): string {
  const car = CARS[carId];
  const rows = partsForCar(carId)
    .map((id) => {
      const on = equipped.includes(id);
      return `<button type="button" data-dev-part="${id}" class="dev-part${on ? " is-on" : ""}" aria-pressed="${on ? "true" : "false"}" data-dev-name="dev.parts.${id}">${PARTS[id].name}</button>`;
    })
    .join("");
  return `<div class="dev-dialog dev-dialog--parts" data-dev-name="dev.dialog.parts" role="dialog" aria-label="Dev Teile">
      <h3 data-dev-name="dev.parts.title">Dev: Teile</h3>
      <p class="dim" data-dev-name="dev.parts.hint">${car.name} — nur dieses Rennen</p>
      <div class="dev-parts" data-dev-name="dev.parts.list">${rows}</div>
      <div class="stack row">
        <button type="button" data-dev-parts-none data-dev-name="dev.parts.none">Keine</button>
        <button type="button" data-dev-parts-all data-dev-name="dev.parts.all">Alle</button>
        <button type="button" data-dev-close data-dev-name="dev.parts.close">Schließen</button>
      </div>
    </div>`;
}
