# Car model sources (free / CC0)

All shipped GLBs are free for commercial use. Prefer low-poly comic-friendly meshes.

| Car | File | Source | License |
|-----|------|--------|---------|
| **Blitz** (sport) | `blitz.glb` | Tripo3D GT coupe from Asphalt-Comic concept (`npm run cars:bake-blitz-tripo`), then Tripo mesh segment v2 **wheels only** (`npm run cars:bake-blitz-segmented-parts`). Wheels remount as `StockWheel_*` (roll/steer). Welded GT wing stays on BodyPaint; Heckspoiler is overlay `blitz-rear_spoiler.glb`. Große Räder width-scales `StockWheel_*` ×1.2 (same diameter; replaces stock). | Generated mesh (shipped bake) |
| **Blitz Teile** | `../parts/blitz-*.glb` | Tripo3D add-on props for equipped Teile (`npm run cars:bake-blitz-parts-tripo`). Visuals only — no extra stats. | Generated mesh (shipped bake) |
| **Bison** (pickup) | `bison.glb` | Tripo3D image-to-mesh (`npm run cars:bake-bison-tripo`), then Tripo mesh segment v2 for tires + remount (`npm run cars:bake-bison-segmented-wheels`). Große Räder scales `StockWheel_*`. | Generated mesh (shipped bake) |
| **Käferkraft** (buggy) | `kaeferkraft.glb` | Tripo3D image-to-mesh (`npm run cars:bake-kaeferkraft-tripo`), then Tripo mesh segment v2 **wheels only** (`npm run cars:bake-kaeferkraft-segmented-parts` from `kaeferkraft-pre-cage-split.glb` + `segment-wheels-only-v4`). Roll cage stays welded in BodyPaint; Große Räder scales `StockWheel_*` (no procedural overlays). | Generated mesh (shipped bake) |
| **Käferkraft Totenkopf** (nose) | `props/buggy-skull.glb` | Tripo3D from Asphalt-Comic skull concept (horns in-mesh) | Generated mesh (shipped bake) |
| **Käferkraft Vogel** (nose) | `props/buggy-bird.glb` | Tripo3D from Asphalt-Comic bird concept | Generated mesh (shipped bake) |
| **Käferkraft Hund** (nose) | `props/buggy-dog.glb` | Tripo3D from Asphalt-Comic dog concept | Generated mesh (shipped bake) |
| **Donnerbüchse** (hotrod) | `donnerbuechse.glb` | Tripo3D image-to-mesh from Asphalt-Comic concept (`npm run cars:bake-donnerbuechse-tripo`), then Tripo mesh segment v2 **wheels only** (`npm run cars:bake-donnerbuechse-segmented-wheels`). Wheels remount as `StockWheel_*` (skinny front, fat rear; roll/steer). Engine stays a BodyPaint prim. Große Räder scales `StockWheel_*`. | Generated mesh (shipped bake) |
| **Bunker** (armor) | `bunker.glb` | Tripo3D image-to-mesh from Asphalt-Comic concept (`npm run cars:bake-bunker-tripo`). Authoring-time only — runtime ships the baked GLB. | Generated mesh (shipped bake) |

## Also useful

- **Kenney Car Kit 3.1** (CC0): https://kenney.nl/assets/car-kit — still handy for props/wheels.
- **Pixabay GLB cars:** https://pixabay.com/3d-models/search/glb%20car/
- TurboSquid / paid marketplaces are **out of scope** (TECH.md free-only). Use as visual reference only.

## Pipeline notes

- Collision stays silhouette (`collisionRadius`); mesh is visual only.
- Loader strips embedded lights/cameras, skips outline shells on tiny shards, mesh-only bounds before autoscale.
- Cars with Tripo albedo keep the authored map. Garage paint recolors body pixels (Bison green, Donnerbüchse blue, Käferkraft orange, Blitz red, Bunker pale armor). Comic atlases (`comicCarAtlases.ts`) are a fallback when a GLB has no usable map.
- Rebuild Bison from Tripo sources: `npm run cars:bake-bison-tripo` (needs `assets/tripo-out/bison/`, gitignored)
- Rebuild Donnerbüchse from Tripo sources: `npm run cars:bake-donnerbuechse-tripo` then `npm run cars:bake-donnerbuechse-segmented-wheels` (needs `assets/tripo-out/donnerbuechse/`, gitignored)
- Rebuild Käferkraft from Tripo sources: `npm run cars:bake-kaeferkraft-tripo` then `npm run cars:bake-kaeferkraft-segmented-parts` (needs `assets/tripo-out/kaeferkraft/`, gitignored)
- Rebuild Blitz from Tripo sources: `npm run cars:bake-blitz-tripo` then `npm run cars:bake-blitz-segmented-parts` (needs `assets/tripo-out/blitz/`, gitignored). Stock body keeps the welded GT wing; `rear_spoiler` is the overlay upgrade.
- Authored tires stay painted into each car GLB (no shared spinning comic-wheel overlays).

