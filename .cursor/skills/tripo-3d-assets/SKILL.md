---
name: tripo-3d-assets
description: >-
  Authors Crash Circuit 3D meshes via Asphalt-Comic concept art → Tripo3D
  image-to-mesh → bake scripts → shipped GLBs. Also covers Tripo mesh segment
  detach/remount (e.g. Bison tires → StockWheel_* with comic albedo). Use when
  generating or rebuilding cars, equipped Teile / parts, garage props, track
  kit, FX, nose ornaments, Tripo GLBs, bake-*-tripo scripts, segmented wheels,
  or when the user asks for 3D assets / Tripo.
---

# Tripo 3D assets (Crash Circuit)

**Runtime never calls Tripo.** Play ships baked GLBs under `public/models/`. Authoring sources live in gitignored `assets/tripo-out/`.

Always also read `.cursor/skills/asphalt-comic-art/` for concept images. For equipped Teile mounts: `src/render/carParts.ts` + parts-look sheets.

Full CLI / path cookbook: [pipeline.md](pipeline.md).

## Hard rules

1. **Concept first** — Asphalt-Comic PNG (GenerateImage + style lock + `reference.png`), then Tripo, then bake.
2. **One mesh family per car class** — do **not** remount Blitz Tripo kits on Bison/Käferkraft/Donner/Bunker. Ship **per-car** part GLBs that match `assets/tripo-concepts/parts-look/`.
3. **Cars use Tripo Teile only** — equipped silhouette Teile on every car must be Tripo (or extracted) GLBs under `public/models/parts/{carId}-{partId}.glb` with `preferGlb: true` in `src/render/carParts.ts`. Do **not** ship intentional procedural silhouette meshes on cars.
4. **Credits before generate** — `tripo doctor` / `tripo balance`. Stop and ask the user to top up if balance is 0.
5. **Ship only baked outputs** — commit `public/models/**/*.glb` + bake scripts/tests; never commit `assets/tripo-out/` or `.tripo/`.
6. **Visuals ≠ stats** — equipped Teile meshes are cosmetic; stats stay in `mergeStats`.
7. **Delivery** — version → commit `master` → push after a bake that changes shipped GLBs.
8. **Detach ≠ UV carve** — to remove a welded part (tires, etc.), use Tripo **mesh segment** + remount bake. Do **not** carve `StockWheel_*` from BodyPaint UV islands alone (fails texture/QA).

## When Tripo vs procedural

| Prefer Tripo (required on cars) | Prefer procedural (`carPartBuilders.ts`) |
|--------------|------------------------------------------|
| Full cars, FX blobs, track walls, garage props | `better_brakes` calipers; `big_wheels` procedural overlays (except Bison / Käferkraft: Tripo-segmented `StockWheel_*` scaled for Große Räder) |
| Silhouette Teile: `big_engine`, `spike_bumper`, `nitro_kit`, `rear_spoiler`, `reinforced_frame`, `lightweight_body` | Load-time fallback if a GLB failed to load (never leave `preferGlb: false` once a kit ships); `better_brakes` calipers; procedural `big_wheels` where stock tires stay welded |
| Per-class kits matching parts-look sheets | Temporary authoring only until bake lands — then flip `preferGlb: true` |

**Agent check:** if `public/models/parts/{car}-{part}.glb` exists for a silhouette part, layout must have `preferGlb: true`. Unit tests in `tests/car-parts.test.ts` enforce this.

## Agent checklist (any new 3D asset)

```
Task Progress:
- [ ] 1. Credits OK (`tripo balance`)
- [ ] 2. Concept PNG under assets/tripo-concepts/ (Asphalt-Comic)
- [ ] 3. tripo make → assets/tripo-out/... (gitignored)
- [ ] 4. Bake script → public/models/...
- [ ] 5. Wire preload / mounts / paint if needed
- [ ] 6. Unit + e2e / browser garage or race QA
- [ ] 7. Version + commit master + push
```

## Mesh segment: detach a part, remount with color + texture

Canonical example: **Bison tires** (`npm run cars:bake-bison-segmented-wheels`). Use this pattern when a welded sub-mesh must become a named runtime node (`StockWheel_*`, etc.) **without** destroying the car’s BodyPaint atlas.

### Why this shape

| Approach | Result |
|----------|--------|
| Carve tires from BodyPaint UVs / extract islands | Rejected — wrong textures, grey clay wheels |
| Merge all Tripo segment body fragments onto one atlas | Scrambles UVs — body texture “off” |
| **Keep good BodyPaint GLB + segment only the part + remount** | Body atlas intact; part gets its own mat/albedo |

### Steps (Bison tires)

1. **Keep a pre-split body** with a good single Tripo atlas — e.g. `assets/tripo-out/bison/bison-pre-wheel-split.glb` (do not rebuild body from segment shards).
2. **Segment** the textured car GLB with Tripo mesh segment **v2 `simple`** (prefer over `smartsegment` / `fine` — those over-fragment the body). Output under `assets/tripo-out/bison/segment-tires-v2/…`.
3. **Identify part meshes** by bounds (tires: low Y, compact disks — four corners).
4. **Bake remount** (`scripts/bake-bison-segmented-wheels.mjs`):
   - Punch tire **volumes** out of the pre-split BodyPaint mesh (ellipsoid around segment centers).
   - Clone segment tire meshes → nodes/meshes `StockWheel_{FL,FR,RL,RR}`.
   - Material **`Tire`** + Asphalt-Comic albedo (`assets/tripo-concepts/bison-tire-albedo.png`): full disk **face** prims on both ±X flanks + annulus UVs on rubber so tread/rim read; `NearestFilter` at runtime.
   - Orient/sit like other car bakes (`facePosZFromTripoX`, cab toward +Z, sit/scale).
5. **Runtime** (`loadCarGltf.ts` / `carParts.ts` / `stockWheels.ts`):
   - Keep authored maps on Tire; flat rubber only if no map (`ComicPalette.tire`).
   - Cars with authored `StockWheel_*`: **`collectWheelUvTriangles` returns `[]`** — never feed Tire-atlas UVs into BodyPaint paint-skip (causes blotches / “paint broken”).
   - Bison / Käferkraft Große Räder: **scale** root `StockWheel_*` only (`BISON_BIG_WHEEL_SCALE` / `KAEFERKRAFT_BIG_WHEEL_SCALE` = 1.35; do not scale GLTF `…_1` children) and **drop hubs** by `radius×(scale−1)` so tops stay on the stock fender line and growth goes down; no procedural `UpgradeTire` overlays.
6. **Tests**: `tests/bison-tripo.test.ts`, `tests/car-wheels.test.ts`, garage paint recolor on BodyPaint atlas.

Detail + CLI notes: [pipeline.md](pipeline.md) § Mesh segment detach/remount.

## Blitz Teile — canonical part pipeline (original)

This is how `public/models/parts/blitz-*.glb` were produced. Repeat the same pattern for **other cars** with `{carId}-*.glb` + bake job table.

### 1. Look sheet + isolated concept

- Sheet: `assets/tripo-concepts/parts-look/{carId}-parts-look-sheet.png`
- Isolated prop (studio, clear silhouette): `assets/tripo-concepts/{carId}-part-{partId}.png`
- Prompt: style lock + **single part only** (no full car unless extracting), thick outlines, flat color, readable from ¾ studio camera.

### 2. Tripo image → mesh

```bash
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
mkdir -p assets/tripo-out/parts/blitz/big_engine
tripo make assets/tripo-concepts/blitz-part-big_engine.png \
  --model tripo-p1 \
  --for game-pc \
  --then texture \
  --name blitz-part-big_engine \
  -o assets/tripo-out/parts/blitz/big_engine \
  --json --timeout 1800 --yes --no-open
```

Expect `texture/model.glb` or `model.glb` under the `-o` dir.

### 3. Bake into shippable add-on

```bash
npm run cars:bake-blitz-parts-tripo
```

Script: `scripts/bake-blitz-parts-tripo.mjs` — flatten, face +Z, optional 180° for rear-facing props, sit/scale, comic material name, meshopt simplify → `public/models/parts/blitz-{id}.glb`.

**Exception — Heckspoiler:** Tripo-segmented from the GT body (`StockSpoiler` + `npm run cars:bake-blitz-segmented-parts`). Historical UV extract (`npm run cars:extract-blitz-spoiler`) is superseded.

### 4. Mount in game

- Register URL in `PART_URLS` / preload (`preloadCarParts`)
- Per-car anchors in `CAR_PART_LAYOUTS` / `BLITZ_PART_PLACEMENT`
- Hood/deck: surface snap + `preferY` so scoops do not jump onto cab roofs
- `preferGlb: true` for every car that ships that kit (required — Tripo-only on cars)

### 5. Lock with tests

- `tests/blitz-parts-tripo.test.ts` — file size, material name string, bounds
- `tests/car-parts.test.ts` — mounts / stance / preferGlb policy
- `e2e/car-parts.spec.ts` — garage Ausrüsten

## Other asset families (same pattern)

| Family | Concepts | Out dir | Bake npm |
|--------|----------|---------|----------|
| Cars | `*-concept-3q.png` | `tripo-out/{carId}/` | `cars:bake-{carId}-tripo` |
| Bison segmented wheels | `bison-tire-albedo.png` + segment out | `tripo-out/bison/segment-tires-v2/` | `cars:bake-bison-segmented-wheels` |
| Käferkraft segmented wheels | original body + wheels-only segment (keep cage in BodyPaint) | `tripo-out/kaeferkraft/segment-wheels-only-v4/` | `cars:bake-kaeferkraft-segmented-parts` |
| Blitz segmented wheels + spoiler | pre-split body + segment v2 simple | `tripo-out/blitz/segment-wheels-spoiler-v1/` | `cars:bake-blitz-segmented-parts` |
| Blitz parts | `blitz-part-*.png` | `tripo-out/parts/blitz/{id}/` | `cars:bake-blitz-parts-tripo` |
| FX | `fx-*.png` | `tripo-out/fx/` | `fx:bake-tripo` |
| Track kit | `track-*.png` (walls, scenery, **obstacles**: ramp/rumble/oil/tire-stack/barrier) | `tripo-out/track/` | `track:bake-tripo` |
| Garage props | `garage-*.png` | `tripo-out/garage/` | `garage:bake-tripo` |
| Stickers / Flammen | `sticker-flames-*.png` | `tripo-out/stickers/flames/` | `stickers:bake-flames-tripo` |

Provenance docs: `public/models/*/SOURCES.md` or `README.md`.

## Orientation contract (race space)

After bake, car/parts local space:

- **Nose +Z**, **up +Y**, wheels on **Y = 0** (sit on min Y)
- Tripo often faces +X — bake scripts remap `(x,z) → (−z, x)` (`facePosZFromTripoX`)
- Rear-mounted props may need bake `toward: "-z"` (extra Y 180°)
- Käferkraft body yaw π/2 in `carModels.ts`; part anchors stay in **mesh-local** (nose −X)

## Do / Don't

**Do:** small primary volumes; thick-outline-friendly; match parts-look; update SOURCES; keep start scripts green; segment-detach with pre-split BodyPaint + remount albedo.

**Don't:** photoreal PBR clutter; purple glow; commit `tripo-out`; call Tripo at runtime; reuse Blitz part GLBs on other classes; grant stats from meshes; BodyPaint UV-carve for detach; merge segment body shards onto one atlas; feed `StockWheel_*` UVs into garage paint skip.
