# Parts look — Asphalt-Comic 2D targets

How each garage **Teil** should read **on each car**. Use these when placing meshes.

## Runtime policy (v0.3.29+)

| Car | Mesh source |
|-----|-------------|
| **Blitz** | Tripo / extracted GLBs under `public/models/parts/blitz-*.glb` |
| **Bison, Käferkraft, Donnerbüchse, Bunker** | Per-car Tripo kits `public/models/parts/{carId}-*.glb` for look-sheet deltas (engine, spike, nitro, spoiler, frame); procedural fallback if a GLB is missing |

Do **not** remount Blitz kits on other classes — each car ships its own meshes and mounts.

## Full sheets (all 9 parts per car)

| Car | Sheet |
|-----|--------|
| Blitz | [blitz-parts-look-sheet.png](blitz-parts-look-sheet.png) |
| Bison | [bison-parts-look-sheet.png](bison-parts-look-sheet.png) |
| Käferkraft | [kaeferkraft-parts-look-sheet.png](kaeferkraft-parts-look-sheet.png) |
| Donnerbüchse | [donnerbuechse-parts-look-sheet.png](donnerbuechse-parts-look-sheet.png) |
| Bunker | [bunker-parts-look-sheet.png](bunker-parts-look-sheet.png) |

## Individual on-car panels

Naming: `{carId}-item-{partId}.png`

| PartId | German name | Mount cue |
|--------|-------------|-----------|
| `big_engine` | Großer Motor | Hood / engine scoop (intakes toward nose); Käferkraft = rear block |
| `big_wheels` | Große Räder | Fatter tires + raised stance |
| `spike_bumper` | Spike-Stoßstange | Spiked front bumper / brush guard |
| `better_brakes` | Bessere Bremsen | Oversized comic calipers / discs |
| `reinforced_frame` | Verstärkter Rahmen | Sill armor + rear half-cage / bed bar / exo |
| `lightweight_body` | Leichtbau-Karosserie | Carbon vents / drilled / tri cutouts |
| `nitro_kit` | Nitro-Kit | Nitro bottles at rear / bed / cage / side |
| `offroad_suspension` | Gelände-Federung | Visible coil springs + lift |
| `rear_spoiler` | Heckspoiler | Rear wing (Blitz = original GT wing) |

Cars: `blitz`, `bison`, `kaeferkraft`, `donnerbuechse`, `bunker` — **45** panels + **5** sheets.

Style lock: `.cursor/skills/asphalt-comic-art/`.
