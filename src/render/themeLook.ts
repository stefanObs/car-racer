import { knownThemeIds, themeSurface } from "../data/themeColors";

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

type ThemeLighting = {
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
};

const LIGHTING: Record<string, ThemeLighting> = {
  harbor: {
    // Push fog out so the harbor panorama cylinder / sky dome stay readable.
    fogNear: 120,
    fogFar: 420,
    hemiSky: 0xc8e4ff,
    hemiGround: 0x5a6a78,
  },
  beach: {
    fogNear: 95,
    fogFar: 300,
    hemiSky: 0xd8f0ff,
    hemiGround: 0xb8955a,
  },
  city: {
    fogNear: 70,
    fogFar: 240,
    hemiSky: 0xb8c8d8,
    hemiGround: 0x5a5f66,
  },
  factory: {
    fogNear: 70,
    fogFar: 250,
    hemiSky: 0xd0e8ff,
    hemiGround: 0x5a6b48,
  },
  canyon: {
    fogNear: 85,
    fogFar: 280,
    hemiSky: 0xd0e8ff,
    hemiGround: 0x8a6848,
  },
};

export function themeLook(theme: string): ThemeLook {
  const key = theme.toLowerCase();
  const surface = themeSurface(key);
  const light = LIGHTING[key] ?? LIGHTING.harbor!;
  return { ...surface, ...light };
}

export function knownThemes(): string[] {
  return knownThemeIds();
}
