# Mesh cheat sheets

One sheet per car, the garage, and each cup track. Each sheet lists **nodes, meshes, submeshes, materials, runtime names**, a **3/4 photo of the GLB**, plus **meter coordinates** on an SVG **grid** (origin through the axes).

**Keep in sync:** after any car/garage/track GLB, named node, mount, or catalog change, run `npm run docs:cheatsheets` in the same step (renders GLB photos, then markdown). New ids go in `scripts/dump-mesh-cheatsheets.mjs` first.

## How to command

- Prefer **ids and node names** from these sheets (`blitz`, `StockWheel_FL`, `garageCabinet`, `tire-wall`).
- Car numbers are **mesh space** unless you say world/runtime. Käferkraft bake is **nose −X** (runtime yaw π/2).
- Garage numbers are **world** (`garagePad` at x=1.5). Track overview is **world XZ**; kit pieces are **local**.
- Green dots on car grids are Teil **mount anchors**, not mesh centroids.

## Cars

- [Blitz](./car-blitz.md) — `blitz`
- [Bison](./car-bison.md) — `bison`
- [Käferkraft](./car-kaeferkraft.md) — `kaeferkraft`
- [Donnerbüchse](./car-donnerbuechse.md) — `donnerbuechse`
- [Bunker](./car-bunker.md) — `bunker`

Käferkraft detached `WaistL` / `WaistR`: [kaeferkraft-waist-anchors.md](../../assets/tripo-concepts/kaeferkraft-waist-anchors.md).

## Garage

- [Garage bay](./garage.md)

## Tracks (cup layouts; free + training reuse the same mesh kit)

- [Hafenstart](./track-hafenstart.md) — `blitz_cup_01_hafenstart` · theme `harbor`
- [Parabolbogen](./track-parabolbogen.md) — `blitz_cup_02_kuestenline` · theme `beach`
- [Schikanenring](./track-schikanenring.md) — `blitz_cup_03_stadtring` · theme `city`
- [Omegatal](./track-omegatal.md) — `blitz_cup_04_buckelpiste` · theme `canyon`
- [Kuppenfinale](./track-kuppenfinale.md) — `blitz_cup_05_cupfinale` · theme `factory`

