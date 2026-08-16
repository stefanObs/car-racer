/**
 * Shared stems + yaw for cheat-sheet GLB previews.
 * `./img/{stem}.png` lives next to the markdown sheets.
 */
export function stemForPublicRel(relPosix) {
  const n = relPosix.replaceAll("\\", "/");
  const file = n.split("/").pop().replace(/\.glb$/i, "");
  if (n.includes("/models/cars/")) return `car-${file}`;
  if (n.includes("/models/parts/")) return `part-${file}`;
  if (n.includes("/models/garage/")) return `garage-${file}`;
  if (n.includes("/models/track/")) return `track-${file}`;
  if (n.includes("/models/props/")) return `prop-${file}`;
  if (n.includes("/models/stickers/")) return `sticker-${file}`;
  return file;
}

export function previewMd(stem, alt) {
  return `![${alt}](./img/${stem}.png)`;
}

/** Extra Y yaw so the interesting face points toward +Z (camera 3/4). */
export const CAR_PREVIEW_YAW = {
  blitz: 0,
  bison: 0,
  kaeferkraft: Math.PI / 2,
  donnerbuechse: 0,
  bunker: 0,
};

/** Garage bake: front on local +X → yaw −π/2 maps front to +Z. */
export const GARAGE_PREVIEW_YAW = -Math.PI / 2;
