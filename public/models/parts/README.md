# Tuning-part add-ons (Tripo kits)

Small Asphalt-Comic GLBs attached on **every car** when `kit.equippedParts` includes the matching `PartId`. Kits are authored for Blitz and re-mounted with per-car scale/yaw + surface snap. Visualization only — stats stay in `mergeStats`.

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

Rebuild Tripo parts: `npm run cars:bake-blitz-parts-tripo`. Rebuild stock Blitz + original Heckspoiler: `npm run cars:extract-blitz-spoiler`.
