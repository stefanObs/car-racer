/**
 * Asphalt-Comic albedos for Käferkraft skull nose + horns.
 * Dog/Hund keeps authored GLB albedo + UVs (see buggyNose.ts).
 */
import {
  NearestFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

const URLS = {
  skull: "/textures/buggy-skull.png",
  skullHorn: "/textures/buggy-skull-horn.png",
} as const;

const maps = new Map<"skull" | "skullHorn", Texture>();
let preloadPromise: Promise<void> | null = null;

function configureNoseMap(tex: Texture): Texture {
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.userData.comicTintable = false;
  return tex;
}

/** Load skull + horn PNGs once (call with car / nose preload). */
export function preloadBuggyNoseTextures(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new TextureLoader();
    await Promise.all(
      (Object.keys(URLS) as (keyof typeof URLS)[]).map(async (id) => {
        const tex = await loader.loadAsync(URLS[id]);
        maps.set(id, configureNoseMap(tex));
      }),
    );
  })();
  return preloadPromise;
}

export function buggyNoseTexture(id: "skull" | "skullHorn"): Texture | null {
  return maps.get(id) ?? null;
}

export function hasBuggyNoseTexture(id: "skull" | "skullHorn"): boolean {
  return maps.has(id);
}
