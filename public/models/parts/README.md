# Tuning-part add-ons (Tripo kits)

Small Asphalt-Comic GLBs attached when `kit.equippedParts` includes the matching `PartId`. Each car class ships **its own** kits (`{carId}-*.glb`) — do not remount Blitz meshes on other cars. Missing GLB → procedural fallback. Visualization only — stats stay in `mergeStats`.

## Blitz

| File | Part |
|------|------|
| `blitz-rear_spoiler.glb` | Heckspoiler — extracted GT wing overlay (stock coupe keeps the welded wing) |
| `blitz-big_engine.glb` | Großer Motor (tall hood scoop) |
| `blitz-nitro_kit.glb` | Nitro-Kit |
| `blitz-spike_bumper.glb` | Spike-Stoßstange |
| `blitz-offroad_suspension.glb` | Gelände-Federung (+ ride lift) |
| `blitz-reinforced_frame.glb` | Verstärkter Rahmen (sill armor; rear cage removed) |
| `blitz-lightweight_body.glb` | _(none — Blitz Leichtbau is stats-only)_ |

## Other cars (Bison, Käferkraft, Donnerbüchse, Bunker)

Per-class kits for the five look-sheet deltas:

| Suffix | Part |
|--------|------|
| `{car}-big_engine.glb` | Großer Motor |
| `{car}-spike_bumper.glb` | Spike-Stoßstange |
| `{car}-nitro_kit.glb` | Nitro-Kit |
| `{car}-rear_spoiler.glb` | Heckspoiler |
| `{car}-reinforced_frame.glb` | Verstärkter Rahmen |

Concepts: `assets/tripo-concepts/{car}-part-{part}.png`. Look sheets: `assets/tripo-concepts/parts-look/`.

Große Räder: Blitz/Bison/Käferkraft scale detached `StockWheel_*` (Blitz +20% width). Donnerbüchse/Bunker keep procedural tires. Bessere Bremsen stay procedural calipers (Donnerbüchse only).

**Authoring:** concept PNG → `./scripts/tripo-make-car-parts.sh [carId]` → `assets/tripo-out/parts/{car}/{id}/` → `npm run cars:bake-car-parts-tripo` (Blitz: `cars:bake-blitz-parts-tripo`). Full agent workflow: `.cursor/skills/tripo-3d-assets/`.
