# Car model sources (free / CC0)

All shipped GLBs are free for commercial use. Prefer low-poly comic-friendly meshes.

| Car | File | Source | License |
|-----|------|--------|---------|
| **Blitz** (sport) | `blitz.glb` | Quaternius Sports Car via [GetGLB](https://www.getglb.com/vehicles/sports-car/) → `Sports-Car.glb` | Free redistrib (GetGLB mirror) |
| **Bison** (pickup) | `bison.glb` | [Mitsubishi L200](https://poly.pizza/m/4qjS9tFhsJg) by Muhammad Reyhan (CC-BY 3.0) via Poly Pizza — rematerialized by `npm run cars:polish`; modern crew-cab curves. Silhouette also informed by [TurboSquid 1675577](https://www.turbosquid.com/3d-models/car-pickup-model-1675577) (ref only — TS mesh not shipped) | CC-BY 3.0 |
| **Käferkraft** (buggy) | `kaeferkraft.glb` | [GetGLB Buggy](https://www.getglb.com/vehicles/buggy/) + `npm run cars:tune-kaeferkraft` (chrome engine, orange cage, red skull eyes; black strip cleanup) | Free via GetGLB |
| **Donnerbüchse** (hotrod) | `donnerbuechse.glb` | **Generated** curved hot-rod bake (`npm run cars:polish`) — soft rounded body, cycle + teardrop fenders, exposed V8 (`EngineBlock` + red `EngineValve`, blower, tube headers). Silhouette inspired by [CGTrader free RatRod #481449](https://www.cgtrader.com/free-3d-models/car/antique-car/ratrod) (**Editorial License — mesh not shipped**) | Project CC0 bake |
| **Bunker** (armor) | `bunker.glb` | [GetGLB Military Truck](https://www.getglb.com/vehicles/military-truck/); arcade `scale` in `carModels.ts` | Free via GetGLB |

## Also useful

- **Kenney Car Kit 3.1** (CC0): https://kenney.nl/assets/car-kit — still handy for props/wheels.
- **Pixabay GLB cars:** https://pixabay.com/3d-models/search/glb%20car/
- TurboSquid / paid marketplaces are **out of scope** (TECH.md free-only). Use as visual reference only.

## Pipeline notes

- Collision stays silhouette (`collisionRadius`); mesh is visual only.
- Loader strips embedded lights/cameras, skips outline shells on tiny shards, mesh-only bounds before autoscale.
- Rebuild generated cars: `npm run cars:polish`
- Retune Käferkraft materials: `npm run cars:tune-kaeferkraft` (reads `kaeferkraft.source.glb` when present)
