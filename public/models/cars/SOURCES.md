# Car model sources (free / CC0)

All shipped GLBs are free for commercial use. Prefer low-poly comic-friendly meshes.

| Car | File | Source | License |
|-----|------|--------|---------|
| **Blitz** (sport) | `blitz.glb` | Tripo3D image-to-mesh from Asphalt-Comic concept (`npm run cars:bake-blitz-tripo`). Authoring-time only — runtime ships the baked GLB. | Generated mesh (shipped bake) |
| **Bison** (pickup) | `bison.glb` | [Mitsubishi L200](https://poly.pizza/m/4qjS9tFhsJg) by Muhammad Reyhan (CC-BY 3.0) via Poly Pizza — rematerialized by `npm run cars:polish`; modern crew-cab curves. Silhouette also informed by [TurboSquid 1675577](https://www.turbosquid.com/3d-models/car-pickup-model-1675577) (ref only — TS mesh not shipped) | CC-BY 3.0 |
| **Käferkraft** (buggy) | `kaeferkraft.glb` | Tripo3D image-to-mesh from Asphalt-Comic concept (`npm run cars:bake-kaeferkraft-tripo`). Authoring-time only — runtime ships the baked GLB. | Generated mesh (shipped bake) |
| **Käferkraft Totenkopf** (nose) | `props/buggy-skull.glb` | Tripo3D from Asphalt-Comic skull concept (horns in-mesh) | Generated mesh (shipped bake) |
| **Käferkraft Vogel** (nose) | `props/buggy-bird.glb` | Tripo3D from Asphalt-Comic bird concept | Generated mesh (shipped bake) |
| **Käferkraft Hund** (nose) | `props/buggy-dog.glb` | Tripo3D from Asphalt-Comic dog concept | Generated mesh (shipped bake) |
| **Donnerbüchse** (hotrod) | `donnerbuechse.glb` | [Hotrod](https://sketchfab.com/3d-models/hotrod-944a5d1535cd45cb82cafef5a8d991f7) by [car-go](https://sketchfab.com/car-go) on Sketchfab — albedo atlas kept under cel shading (`npm run cars:fetch-donnerbuechse` + `npm run cars:polish`). Provided by Sketchfab. | [CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| **Bunker** (armor) | `bunker.glb` | Tripo3D image-to-mesh from Asphalt-Comic concept (`npm run cars:bake-bunker-tripo`). Authoring-time only — runtime ships the baked GLB. | Generated mesh (shipped bake) |

## Also useful

- **Kenney Car Kit 3.1** (CC0): https://kenney.nl/assets/car-kit — still handy for props/wheels.
- **Pixabay GLB cars:** https://pixabay.com/3d-models/search/glb%20car/
- TurboSquid / paid marketplaces are **out of scope** (TECH.md free-only). Use as visual reference only.

## Pipeline notes

- Collision stays silhouette (`collisionRadius`); mesh is visual only.
- Loader strips embedded lights/cameras, skips outline shells on tiny shards, mesh-only bounds before autoscale.
- Non-Hotrod cars get runtime Asphalt-Comic albedo atlases (`comicCarAtlases.ts`) + box UVs when exports lack usable TEXCOORD_0. Donnerbüchse keeps its Sketchfab atlas. Käferkraft keeps its Tripo albedo (garage paint recolors orange body pixels). Blitz keeps its Tripo albedo (garage paint recolors red body pixels). Bunker keeps its Tripo albedo (garage paint recolors pale armor pixels).
- Rebuild Bison/Donnerbüchse: `npm run cars:polish`
- Fetch Donnerbüchse source (needs `SKETCHFAB_API_TOKEN`): `npm run cars:fetch-donnerbuechse`
- Rebuild Käferkraft from Tripo sources: `npm run cars:bake-kaeferkraft-tripo` (needs `assets/tripo-out/`, gitignored)
- Rebuild Blitz from Tripo sources: `npm run cars:bake-blitz-tripo` (needs `assets/tripo-out/blitz/`, gitignored)
- Rebuild Bunker from Tripo sources: `npm run cars:bake-bunker-tripo` (needs `assets/tripo-out/bunker/`, gitignored)
