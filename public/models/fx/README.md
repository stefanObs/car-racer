# Shared race FX (Asphalt-Comic)

Tripo3D image-to-mesh chunks used by **every** car (not per-car cosmetics).

| File | Use |
|------|-----|
| `smoke-puff.glb` | Light damage smoke |
| `smoke-heavy.glb` | Heavy damage smoke |
| `repair-spark.glb` | Heal sparks |
| `nitro-orange.glb` | Nitro trail chunk (`#FF7A18`) |
| `nitro-cyan.glb` | Nitro trail chunk (`#3DB9C7`) |
| `lap-shield.glb` | Start-line lap shield on car + compact finish-line round flash plaque |

Authoring: concept PNGs in `assets/tripo-concepts/fx-*.png` → `tripo make` → `node scripts/bake-fx-tripo.mjs`. Runtime ships these GLBs (no Tripo at play time). Rebuild needs `assets/tripo-out/fx/` (gitignored).
