/** Theme look — backgrounds only; asphalt/grass/wall stay concept-readable. */
export type ThemeLook = {
  sky: number;
  skyLow: number;
  ground: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
};

const LOOKS: Record<string, ThemeLook> = {
  harbor: {
    sky: 0x5ba3d9,
    skyLow: 0x3d7eae,
    ground: 0x4a5c52,
    fogNear: 90,
    fogFar: 280,
    hemiSky: 0xc8e4ff,
    hemiGround: 0x4a6a58,
  },
  beach: {
    sky: 0x6ec6f0,
    skyLow: 0x4aa3d4,
    ground: 0xc2a66a,
    fogNear: 95,
    fogFar: 300,
    hemiSky: 0xd8f0ff,
    hemiGround: 0xb8955a,
  },
  city: {
    sky: 0x7a92a8,
    skyLow: 0x5a7088,
    ground: 0x4a4f57,
    fogNear: 70,
    fogFar: 240,
    hemiSky: 0xb8c8d8,
    hemiGround: 0x5a5f66,
  },
  factory: {
    sky: 0x8a9aa8,
    skyLow: 0x6a7a88,
    ground: 0x5a5550,
    fogNear: 65,
    fogFar: 230,
    hemiSky: 0xc0c8d0,
    hemiGround: 0x6a6058,
  },
  canyon: {
    sky: 0x6eb0e0,
    skyLow: 0x4a8cbc,
    ground: 0xa0785a,
    fogNear: 85,
    fogFar: 280,
    hemiSky: 0xd0e8ff,
    hemiGround: 0x8a6848,
  },
};

export function themeLook(theme: string): ThemeLook {
  return LOOKS[theme.toLowerCase()] ?? LOOKS.harbor!;
}

export function knownThemes(): string[] {
  return Object.keys(LOOKS);
}
