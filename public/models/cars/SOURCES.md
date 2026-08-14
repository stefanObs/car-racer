# Car model sources (free / CC0)

All shipped GLBs are free for commercial use. Prefer low-poly comic-friendly meshes.

| Car | File | Source | License |
|-----|------|--------|---------|
| **Blitz** (sport) | `blitz.glb` | Tripo3D GT coupe from Asphalt-Comic concept; stock body is the wing-stripped bake (Tripo cabin glass kept). Heckspoiler add-on is the extracted original rear wing (`npm run cars:extract-blitz-spoiler`). Stock tires stay welded in the body mesh; Große Räder uses procedural overlays. | Generated mesh (shipped bake) |
| **Blitz Teile** | `../parts/blitz-*.glb` | Tripo3D add-on props for equipped Teile (`npm run cars:bake-blitz-parts-tripo`). Visuals only — no extra stats. | Generated mesh (shipped bake) |
| **Bison** (pickup) | `bison.glb` | Tripo3D image-to-mesh (`npm run cars:bake-bison-tripo`), then Tripo mesh segment v2 for tires + remount (`npm run cars:bake-bison-segmented-wheels`). Große Räder scales `StockWheel_*`. | Generated mesh (shipped bake) |
| **Käferkraft** (buggy) | `kaeferkraft.glb` | Tripo3D image-to-mesh from Asphalt-Comic concept (`npm run cars:bake-kaeferkraft-tripo`). Authoring-time only — runtime ships the baked GLB. | Generated mesh (shipped bake) |
| **Käferkraft Totenkopf** (nose) | `props/buggy-skull.glb` | Tripo3D from Asphalt-Comic skull concept (horns in-mesh) | Generated mesh (shipped bake) |
| **Käferkraft Vogel** (nose) | `props/buggy-bird.glb` | Tripo3D from Asphalt-Comic bird concept | Generated mesh (shipped bake) |
| **Käferkraft Hund** (nose) | `props/buggy-dog.glb` | Tripo3D from Asphalt-Comic dog concept | Generated mesh (shipped bake) |
| **Donnerbüchse** (hotrod) | `donnerbuechse.glb` | Tripo3D image-to-mesh from Asphalt-Comic concept (`npm run cars:bake-donnerbuechse-tripo`). Authoring-time only — runtime ships the baked GLB. | Generated mesh (shipped bake) |
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
- Rebuild Donnerbüchse from Tripo sources: `npm run cars:bake-donnerbuechse-tripo` (needs `assets/tripo-out/donnerbuechse/`, gitignored)
- Rebuild Käferkraft from Tripo sources: `npm run cars:bake-kaeferkraft-tripo` (needs `assets/tripo-out/`, gitignored)
- Rebuild Blitz from Tripo sources: `npm run cars:bake-blitz-tripo` (needs `assets/tripo-out/blitz/`, gitignored). Stock body has no tall wing; `rear_spoiler` add-on is the upgrade.
- Authored tires stay painted into each car GLB (no shared spinning comic-wheel overlays).

