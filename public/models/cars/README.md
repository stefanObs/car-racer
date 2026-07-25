# Car GLB models

Drop Blender / Blockbench / MagicaVoxel exports here:

| File | Car |
|------|-----|
| `blitz.glb` | Sportwagen |
| `bison.glb` | Pick-up |
| `kaeferkraft.glb` | Buggy |
| `donnerbuechse.glb` | Hot Rod |
| `bunker.glb` | Panzerwagen |

## Blender export tips

1. Model in **meters**, nose pointing **+Y** in Blender (or set `yaw` in `src/data/carModels.ts`).
2. Name materials so the game can tint paint / keep glass dark:
   - `BodyPaint` / `Body` / `Cab` → player paint color
   - `Glass` / `Window`
   - `Tire` / `Wheel`
   - `Chrome` / `Metal`
3. File → Export → **glTF 2.0** → format **GLB**.
4. Keep polycount modest (a few thousand tris is plenty for Asphalt-Comic).
5. Collision is a **circle** from `collisionRadius` in `carModels.ts` — the visual may overhang.

Regenerate these starter placeholders:

```bash
node scripts/write-car-glbs.mjs
```
