import { CARS, type CarId } from "../data/cars";
import { emptyKit, ensureKit, type CarKit, type SaveData } from "./save";

/** Click a roster car: owned → drive it; locked → preview only (no CHF). */
export function selectCarInGarage(
  ownedCars: readonly CarId[],
  activeCar: CarId,
  clicked: CarId,
): { activeCar: CarId; previewCar: CarId | null } {
  if (ownedCars.includes(clicked)) {
    return { activeCar: clicked, previewCar: null };
  }
  return { activeCar, previewCar: clicked };
}

export function showcaseCarId(activeCar: CarId, previewCar: CarId | null): CarId {
  return previewCar ?? activeCar;
}

export function isUnownedPreview(ownedCars: readonly CarId[], previewCar: CarId | null): boolean {
  return previewCar != null && !ownedCars.includes(previewCar);
}

/** Stock kit for a shop preview; owned showcase uses the saved kit. */
export function showcaseKit(save: SaveData, previewCar: CarId | null): CarKit {
  if (isUnownedPreview(save.ownedCars, previewCar) && previewCar) {
    return emptyKit(previewCar);
  }
  return ensureKit(save, showcaseCarId(save.activeCar, previewCar));
}

/** Spend CHF, own the car, make it active. False if already owned or broke. */
export function buyCar(save: SaveData, id: CarId): boolean {
  if (save.ownedCars.includes(id)) return false;
  const price = CARS[id].priceChf;
  if (save.chf < price) return false;
  save.chf -= price;
  save.ownedCars.push(id);
  ensureKit(save, id);
  save.activeCar = id;
  return true;
}
