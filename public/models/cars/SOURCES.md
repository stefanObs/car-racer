# Car model sources (free / CC0)

All shipped GLBs are free for commercial use. Prefer low-poly comic-friendly meshes.

| Car | File | Source | License |
|-----|------|--------|---------|
| **Blitz** (sport) | `blitz.glb` | Quaternius Sports Car via [GetGLB](https://www.getglb.com/vehicles/sports-car/) → `Sports-Car.glb` | Free redistrib (GetGLB mirror) |
| **Bison** (pickup) | `bison.glb` | [GetGLB Pickup Truck](https://www.getglb.com/vehicles/pickup-truck/) → `Pickup-Truck_by_get3dmodels.glb` | Free via GetGLB |
| **Käferkraft** (buggy) | `kaeferkraft.glb` | [GetGLB Buggy](https://www.getglb.com/vehicles/buggy/) → `Buggy_by_get3dmodels.glb` | Free via GetGLB |
| **Donnerbüchse** (hotrod) | `donnerbuechse.glb` | [Kenney Car Kit 3.1](https://kenney.nl/assets/car-kit) `sedan-sports.glb` (OpenGameArt zip) | **CC0** — credit Kenney appreciated |
| **Bunker** (armor) | `bunker.glb` | [GetGLB Military Truck](https://www.getglb.com/vehicles/military-truck/) → `Military-Truck-2D2F3D-Collab_by_get3dmodels.glb` | Free via GetGLB |

## Also useful

- **Kenney Car Kit 3.1** (CC0): https://kenney.nl/assets/car-kit — OpenGameArt `kenney_car-kit_3.1.zip` (`truck-flat`, `delivery`, `hatchback-sports`, …).
- **Pixabay GLB cars:** https://pixabay.com/3d-models/search/glb%20car/ — Pixabay Content License; Quaternius_CC0 packs appear there (cookie consent often required to download).

## Pipeline notes

- Collision stays silhouette (`collisionRadius`); mesh is visual only.
- Loader strips embedded lights/cameras and uses **mesh-only** bounds before autoscale (Spotlight helpers otherwise shrink cars to dust).
