# Tuning-part add-ons (Tripo kits)

Small Asphalt-Comic GLBs attached when `kit.equippedParts` includes the matching `PartId`. **Blitz** ships Tripo/extracted kits; other cars use class procedural builders until per-car Tripo kits exist (see `.cursor/skills/tripo-3d-assets/`). Visualization only — stats stay in `mergeStats`.

| File | Part |
|------|------|
| `blitz-rear_spoiler.glb` | Heckspoiler — original wing extracted from the Blitz body (`npm run cars:extract-blitz-spoiler`; not overwritten by Tripo bake) |
| `blitz-big_engine.glb` | Großer Motor (tall hood scoop) |
| `blitz-nitro_kit.glb` | Nitro-Kit |
| `blitz-spike_bumper.glb` | Spike-Stoßstange |
| `blitz-offroad_suspension.glb` | Gelände-Federung (+ ride lift) |
| `blitz-reinforced_frame.glb` | Verstärkter Rahmen (sill armor + half-cage) |
| `blitz-lightweight_body.glb` | Leichtbau |

Große Räder / Bessere Bremsen stay procedural (stance / calipers).

**Authoring (Blitz):** concept PNG → `tripo make` → `assets/tripo-out/parts/blitz/{id}/` → `npm run cars:bake-blitz-parts-tripo`. Full agent workflow: `.cursor/skills/tripo-3d-assets/`.

Rebuild Tripo parts: `npm run cars:bake-blitz-parts-tripo`. Rebuild stock Blitz + original Heckspoiler: `npm run cars:extract-blitz-spoiler`.
