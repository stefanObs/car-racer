import type { VehicleStats } from "./cars";

export type PartId =
  | "big_engine"
  | "big_wheels"
  | "spike_bumper"
  | "better_brakes"
  | "reinforced_frame"
  | "lightweight_body"
  | "nitro_kit"
  | "offroad_suspension"
  | "rear_spoiler";

export interface PartDef {
  id: PartId;
  name: string;
  priceChf: number;
  pro: string;
  con: string;
  tags: string[];
  /** Additive deltas applied to base stats */
  delta: Partial<VehicleStats> & { nitroBonus?: number; ramBonus?: number };
}

export const PARTS: Record<PartId, PartDef> = {
  big_engine: {
    id: "big_engine",
    name: "Großer Motor",
    priceChf: 360,
    pro: "Mehr Beschleunigung und etwas Topspeed.",
    con: "Schleudert leichter, Nitro verbraucht schneller.",
    tags: ["motor"],
    delta: { accel: 0.2, topSpeed: 0.08, grip: -0.12 },
  },
  big_wheels: {
    id: "big_wheels",
    name: "Große Räder",
    priceChf: 300,
    pro: "Weniger Schleudern, stabilere Landungen.",
    con: "Etwas weniger Höchstgeschwindigkeit.",
    tags: ["wheels"],
    delta: { grip: 0.15, suspension: 0.08, topSpeed: -0.06 },
  },
  spike_bumper: {
    id: "spike_bumper",
    name: "Spike-Stoßstange",
    priceChf: 220,
    pro: "Mehr Schub bei Kontakt.",
    con: "Handling hakelig, Mauer-Treffer tun mehr weh.",
    tags: ["spike"],
    delta: { handling: -0.08, ramBonus: 0.25, armor: -0.05 },
  },
  better_brakes: {
    id: "better_brakes",
    name: "Bessere Bremsen",
    priceChf: 180,
    pro: "Schärferes Abbremsen, engere Linien.",
    con: "Etwas träger aus der Kurve heraus.",
    tags: ["brakes"],
    delta: { handling: 0.1, accel: -0.05 },
  },
  reinforced_frame: {
    id: "reinforced_frame",
    name: "Verstärkter Rahmen",
    priceChf: 320,
    pro: "Weniger Schaden, härterer Stand.",
    con: "Trägere Lenkung, etwas weniger Topspeed.",
    tags: ["frame"],
    delta: { armor: 0.25, mass: 0.1, handling: -0.1, topSpeed: -0.05 },
  },
  lightweight_body: {
    id: "lightweight_body",
    name: "Leichtbau-Karosserie",
    priceChf: 280,
    pro: "Bessere Beschleunigung und Lenkung.",
    con: "Viel mehr Schaden, leicht wegdrückbar.",
    tags: ["light"],
    delta: { accel: 0.15, handling: 0.12, mass: -0.2, armor: -0.25 },
  },
  nitro_kit: {
    id: "nitro_kit",
    name: "Nitro-Kit",
    priceChf: 340,
    pro: "Stärkerer und längerer Boost.",
    con: "Bei Schaden riskanter Spin.",
    tags: ["nitro"],
    delta: { nitroBonus: 0.35, grip: -0.05 },
  },
  offroad_suspension: {
    id: "offroad_suspension",
    name: "Gelände-Federung",
    priceChf: 300,
    pro: "Dämpft Buckel stark, mildert Gras-Malus.",
    con: "Etwas schwammiger auf reinem Asphalt.",
    tags: ["suspension"],
    delta: { suspension: 0.35, handling: -0.06 },
  },
  rear_spoiler: {
    id: "rear_spoiler",
    name: "Heckspoiler",
    priceChf: 200,
    pro: "Mehr Grip bei hoher Speed.",
    con: "Weniger absichtliches Schleudern.",
    tags: ["spoiler"],
    delta: { grip: 0.12, handling: 0.05 },
  },
};

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  /** Part tags required (all) */
  requireTags: string[];
  bonus: Partial<VehicleStats> & { grassMitigation?: number };
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: "street_glue",
    name: "Straßenkleber",
    description: "Motor-Schleuder-Malus stark gemildert, Rad-Speed-Malus teilweise weg.",
    requireTags: ["motor", "wheels", "spoiler"],
    bonus: { grip: 0.18, topSpeed: 0.05 },
  },
  {
    id: "bump_king",
    name: "Buckelkönig",
    description: "Unebenheiten und Gras kaum noch Drama.",
    requireTags: ["suspension", "wheels"],
    bonus: { suspension: 0.15, grassMitigation: 0.2 },
  },
  {
    id: "rock",
    name: "Fels in der Brandung",
    description: "Stabil bei Kontakt, weniger Selbstschaden.",
    requireTags: ["frame", "spike"],
    bonus: { armor: 0.15, mass: 0.08 },
  },
];

export function equippedTags(partIds: PartId[]): Set<string> {
  const tags = new Set<string>();
  for (const id of partIds) {
    for (const t of PARTS[id].tags) tags.add(t);
  }
  return tags;
}

export function activeSynergies(partIds: PartId[]): SynergyDef[] {
  const tags = equippedTags(partIds);
  return SYNERGIES.filter((s) => s.requireTags.every((t) => tags.has(t)));
}

export function mergeStats(
  base: VehicleStats,
  partIds: PartId[],
): VehicleStats & { nitroBonus: number; ramBonus: number; grassMitigation: number } {
  const stats = { ...base };
  let nitroBonus = 0;
  let ramBonus = 0;
  let grassMitigation = 0;

  for (const id of partIds) {
    const d = PARTS[id].delta;
    for (const key of Object.keys(d) as Array<keyof typeof d>) {
      if (key === "nitroBonus") nitroBonus += d.nitroBonus ?? 0;
      else if (key === "ramBonus") ramBonus += d.ramBonus ?? 0;
      else {
        const k = key as keyof VehicleStats;
        stats[k] = (stats[k] ?? 0) + (d[k] as number);
      }
    }
  }

  for (const syn of activeSynergies(partIds)) {
    grassMitigation += syn.bonus.grassMitigation ?? 0;
    for (const key of Object.keys(syn.bonus) as Array<keyof typeof syn.bonus>) {
      if (key === "grassMitigation") continue;
      const k = key as keyof VehicleStats;
      if (typeof syn.bonus[k] === "number") {
        stats[k] = stats[k] + (syn.bonus[k] as number);
      }
    }
  }

  // Clamp sane ranges
  for (const k of Object.keys(stats) as (keyof VehicleStats)[]) {
    stats[k] = Math.max(0.35, Math.min(2.2, stats[k]));
  }

  return {
    ...stats,
    nitroBonus,
    ramBonus,
    grassMitigation: Math.min(0.55, grassMitigation),
  };
}
