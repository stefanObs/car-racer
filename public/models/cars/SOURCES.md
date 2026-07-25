# Car model sources (free / CC0)

All shipped GLBs are free for commercial use. Prefer low-poly comic-friendly meshes.

| Car | File | Source | License |
|-----|------|--------|---------|
| **Blitz** (sport) | `blitz.glb` | Quaternius Sports Car via [GetGLB](https://www.getglb.com/vehicles/sports-car/) → `Sports-Car.glb` | Free redistrib (GetGLB mirror) |
| **Bison** (pickup) | `bison.glb` | **Generated** crew-cab pickup (`scripts/polish-car-glbs.mjs`) — silhouette inspired by common pickup refs; **not** TurboSquid (paid) | Project CC0 bake |
| **Käferkraft** (buggy) | `kaeferkraft.glb` | **Generated** dune-hunter / sand-rail (`scripts/polish-car-glbs.mjs`) — silhouette inspired by common dune-buggy refs; **not** TurboSquid (paid) | Project CC0 bake |
| **Donnerbüchse** (hotrod) | `donnerbuechse.glb` | **Generated** classic hot-rod volumes (`scripts/polish-car-glbs.mjs`) — silhouette inspired by common free/hot-rod refs; **not** TurboSquid (paid) | Project CC0 bake |
| **Bunker** (armor) | `bunker.glb` | [GetGLB Military Truck](https://www.getglb.com/vehicles/military-truck/); arcade `scale` in `carModels.ts` | Free via GetGLB |

## Also useful

- **Kenney Car Kit 3.1** (CC0): https://kenney.nl/assets/car-kit — still handy for props/wheels.
- **Pixabay GLB cars:** https://pixabay.com/3d-models/search/glb%20car/
- TurboSquid / paid marketplaces are **out of scope** (TECH.md free-only). Use as visual reference only.

## Pipeline notes

- Collision stays silhouette (`collisionRadius`); mesh is visual only.
- Loader strips embedded lights/cameras, skips outline shells on tiny shards, mesh-only bounds before autoscale.
- Rebuild generated cars: `npm run cars:polish`
