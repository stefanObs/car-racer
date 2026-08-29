# Mesh cheat sheets

One sheet per car, the garage, and each cup track. Each sheet lists **nodes, meshes, submeshes, materials, runtime names**, a **3/4 photo of the GLB**, plus **meter coordinates** on an SVG **grid** (origin through the axes).

**Keep in sync:** after any car/garage/track GLB, named node, mount, or catalog change, run `npm run docs:cheatsheets` in the same step (renders GLB photos, then markdown). New ids go in `scripts/dump-mesh-cheatsheets.mjs` first.

## How to command

- Prefer **ids and node names** from these sheets (`blitz`, `StockWheel_FL`, `garageCabinet`, `tire-wall`).
- Car numbers are **mesh space** unless you say world/runtime. Käferkraft bake is **nose −X** (runtime yaw π/2).
- F6 **Kasten** (B): drag a rectangle, drag the 8 corner dots to resize (last Kasten only). **Seite** (panel or RMB menu) then LMB rolls the car in the view. **Shift+drag** paints another Kasten. **Kasten kopieren** / C copies every Kasten; **Zurück** / Pos1 restores the last painted size; Esc drops the last Kasten.
- Garage numbers are **world** (`garagePad` at x=1.5). Track overview is **world XZ**; kit pieces are **local**.
- Green dots on car grids are Teil **mount anchors**, not mesh centroids.

## F5 PATCH (apply forever)

When the user pastes a `CRASH CIRCUIT F5 PATCH v1` block (copied from F6 **Änderung kopieren** / C / RMB after moving a part):

1. Save it to a file (e.g. `tmp/f5-patch.txt`).
2. Run **`npm run mesh:apply-f5-patch -- tmp/f5-patch.txt`** for `apply: glb-node` rows (writes the named GLB).
3. For `apply: mount` / `carPart-*` groups: set that car’s mount xyz in `src/render/carParts.ts` to the patch `to` origin.
4. **`npm run docs:cheatsheets`**, version, commit `master`, push.

Do not leave the pose as a runtime-only F5 edit.

## Cars

- [Blitz](./car-blitz.md) — `blitz`
- [Bison](./car-bison.md) — `bison`
- [Käferkraft](./car-kaeferkraft.md) — `kaeferkraft`
- [Donnerbüchse](./car-donnerbuechse.md) — `donnerbuechse`
- [Bunker](./car-bunker.md) — `bunker`

Käferkraft detached `WaistL` / `WaistR` and Leichtbau `LightweightL` / `LightweightR`: [kaeferkraft-waist-anchors.md](../../assets/tripo-concepts/kaeferkraft-waist-anchors.md).

## Garage

- [Garage bay](./garage.md)

## Tracks (cup layouts; free + training reuse the same mesh kit)

- [Hafenstart](./track-hafenstart.md) — `blitz_cup_01_hafenstart` · theme `harbor`
- [Parabolbogen](./track-parabolbogen.md) — `blitz_cup_02_kuestenline` · theme `beach`
- [Schikanenring](./track-schikanenring.md) — `blitz_cup_03_stadtring` · theme `city`
- [Omegatal](./track-omegatal.md) — `blitz_cup_04_buckelpiste` · theme `canyon`
- [Kuppenfinale](./track-kuppenfinale.md) — `blitz_cup_05_cupfinale` · theme `factory`
- [Brückenkreuz](./track-brueckenkreuz.md) — `blitz_cup_06_brueckenkreuz` · theme `overpass`

