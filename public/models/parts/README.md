# Blitz tuning-part add-ons

Small Asphalt-Comic GLBs attached when `kit.equippedParts` includes the matching `PartId`. Visualization only — stats stay in `mergeStats`.

| File | Part |
|------|------|
| `blitz-rear_spoiler.glb` | Heckspoiler — original wing extracted from the Blitz body (`npm run cars:extract-blitz-spoiler`) |
| `blitz-big_engine.glb` | Großer Motor (tall hood scoop) |
| `blitz-nitro_kit.glb` | Nitro-Kit |
| `blitz-spike_bumper.glb` | Spike-Stoßstange |
| `blitz-offroad_suspension.glb` | Gelände-Federung (+ ride lift) |
| `blitz-reinforced_frame.glb` | Verstärkter Rahmen (sill armor + half-cage) |
| `blitz-lightweight_body.glb` | Leichtbau |

Große Räder is stance lift only (no fake shared wheel overlays).

Rebuild parts (Tripo): `npm run cars:bake-blitz-parts-tripo`. Rebuild stock Blitz + original Heckspoiler: `npm run cars:extract-blitz-spoiler`.
