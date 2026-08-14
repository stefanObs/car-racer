# Shared race FX (Asphalt-Comic)

Tripo3D image-to-mesh chunks used by **every** car (not per-car cosmetics).

| File | Use |
|------|-----|
| `smoke-puff.glb` | Light damage smoke |
| `smoke-heavy.glb` | Heavy damage smoke |
| `repair-spark.glb` | Heal sparks |
| `nitro-orange.glb` / `nitro-orange-b.glb` | Nitro flame frames A/B (`#FF7A18`) |
| `nitro-cyan.glb` / `nitro-cyan-b.glb` | Nitro flame frames A/B (`#3DB9C7`) |
| `lap-shield.glb` | Finish-line round flash plaque above the car (not mounted on the chassis) |

Authoring: concept PNGs in `assets/tripo-concepts/fx-*.png` → `tripo make` → `node scripts/bake-fx-tripo.mjs`. Runtime ships these GLBs (no Tripo at play time). Rebuild needs `assets/tripo-out/fx/` (gitignored).
