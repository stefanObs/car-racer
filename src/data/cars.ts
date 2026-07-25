export type CarId = "blitz" | "bison";

/** Gear class drives silhouette + fantasy (CONCEPT §5). */
export type GearClass = "sport" | "pickup";

export interface CarDef {
  id: CarId;
  name: string;
  classLabel: string;
  gearClass: GearClass;
  description: string;
  priceChf: number;
  /** Base stats before parts */
  stats: VehicleStats;
  defaultPaint: string;
}

export interface VehicleStats {
  accel: number;
  topSpeed: number;
  grip: number;
  mass: number;
  armor: number;
  handling: number;
  suspension: number;
}

export const CARS: Record<CarId, CarDef> = {
  blitz: {
    id: "blitz",
    name: "Blitz",
    classLabel: "Sportwagen",
    gearClass: "sport",
    description: "Schnell und präzise — aber leicht und empfindlich.",
    priceChf: 0,
    defaultPaint: "#e03131",
    stats: {
      accel: 1.25,
      topSpeed: 1.2,
      grip: 0.95,
      mass: 0.75,
      armor: 0.7,
      handling: 1.2,
      suspension: 0.7,
    },
  },
  bison: {
    id: "bison",
    name: "Bison",
    classLabel: "Pick-up",
    gearClass: "pickup",
    description: "Schwer und standfest — braucht länger für Tempo.",
    priceChf: 900,
    defaultPaint: "#2f9e44",
    stats: {
      accel: 0.85,
      topSpeed: 0.95,
      grip: 1.0,
      mass: 1.35,
      armor: 1.35,
      handling: 0.85,
      suspension: 1.05,
    },
  },
};

export function gearClassOf(carId: CarId): GearClass {
  return CARS[carId].gearClass;
}
