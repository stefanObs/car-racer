/**
 * Asphalt-Comic albedos for Käferkraft nose props (Schädel + Hund-Statue).
 */
import {
  NearestFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

const URLS = {
  skull: "/textures/buggy-skull.png",
  dogStatue: "/textures/buggy-dog-head.png",
} as const;

const maps = new Map<"skull" | "dogStatue", Texture>();
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

/** Load skull + dog-statue PNGs once (call with car / nose preload). */
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

export function buggyNoseTexture(id: "skull" | "dogStatue"): Texture | null {
  return maps.get(id) ?? null;
}

export function hasBuggyNoseTexture(id: "skull" | "dogStatue"): boolean {
  return maps.has(id);
}
