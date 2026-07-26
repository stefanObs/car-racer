# Car GLB models

Place one GLB per car id:

| File | Car |
|------|-----|
| `blitz.glb` | Blitz (sport) |
| `bison.glb` | Bison (pickup) |
| `kaeferkraft.glb` | Käferkraft (buggy) |
| `donnerbuechse.glb` | Donnerbüchse (hotrod) |
| `bunker.glb` | Bunker (armor) |

Tune `scale` / `yaw` / `y` / `collisionRadius` in `src/data/carModels.ts`.

Optional Blender material names for nicer paint mapping: `BodyPaint`, `Glass`, `Tire`, `Chrome`. The loader also tints common free-asset names (`White`, `Truck`, `Atlas`, `mat*`, …).

See [SOURCES.md](./SOURCES.md) for provenance. Rebuild generated cars: `npm run cars:polish`.
