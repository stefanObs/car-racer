/** Theme surface hex — HUD and 3D both read these; fog/hemi stay in render. */
export type ThemeSurface = {
  sky: number;
  skyLow: number;
  ground: number;
};

const SURFACES: Record<string, ThemeSurface> = {
  harbor: {
    sky: 0x4aa3d9,
    skyLow: 0x2f7eb8,
    // Pier / dock concrete — never grass-green (that read as a “green wall” in the oval infield).
    ground: 0x6e7580,
  },
  beach: {
    sky: 0x6ec6f0,
    skyLow: 0x4aa3d4,
    ground: 0xc2a66a,
  },
  city: {
    sky: 0x7a92a8,
    skyLow: 0x5a7088,
    ground: 0x4a4f57,
  },
  factory: {
    // Kuppenfinale forest bowl — green ground, soft cool sky
    sky: 0x7eb8e8,
    skyLow: 0x5a9acc,
    ground: 0x4f6b45,
  },
  canyon: {
    sky: 0x6eb0e0,
    skyLow: 0x4a8cbc,
    ground: 0xa0785a,
  },
};

export function themeSurface(theme: string): ThemeSurface {
  return SURFACES[theme.toLowerCase()] ?? SURFACES.harbor!;
}

export function knownThemeIds(): string[] {
  return Object.keys(SURFACES);
}
