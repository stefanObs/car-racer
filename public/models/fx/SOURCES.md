# Shared race FX provenance

Tripo3D image-to-mesh from Asphalt-Comic concepts in `assets/tripo-concepts/fx-*.png`. Authoring-time only — the game ships the baked GLBs (no Tripo at play time). Same chunks on every car.

| Chunk | Concept | Bake |
|-------|---------|------|
| Light smoke | `fx-smoke-puff.png` | `npm run fx:bake-tripo` |
| Heavy smoke | `fx-smoke-heavy.png` | same |
| Repair spark | `fx-repair-spark.png` | same |
| Nitro orange | `fx-nitro-orange.png` | same |
| Nitro cyan | `fx-nitro-cyan.png` (mesh may reuse orange bake, tinted `#3DB9C7` at runtime) | same |

Style lock: `.cursor/skills/asphalt-comic-art/reference.png`. Nitro colors `#FF7A18` / `#3DB9C7` — no purple bloom.
