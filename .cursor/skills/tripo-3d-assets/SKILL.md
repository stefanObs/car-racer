---
name: tripo-3d-assets
description: >-
  Authors Crash Circuit 3D meshes via Asphalt-Comic concept art → Tripo3D
  image-to-mesh → bake scripts → shipped GLBs. Use when generating or rebuilding
  cars, equipped Teile / parts, garage props, track kit, FX, nose ornaments,
  Tripo GLBs, bake-*-tripo scripts, or when the user asks for 3D assets / Tripo.
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

## When Tripo vs procedural

| Prefer Tripo (required on cars) | Prefer procedural (`carPartBuilders.ts`) |
|--------------|------------------------------------------|
| Full cars, FX blobs, track walls, garage props | `better_brakes` calipers, `big_wheels` replacement tires (stock wheels extracted/hidden) |
| Silhouette Teile: `big_engine`, `spike_bumper`, `nitro_kit`, `rear_spoiler`, `reinforced_frame`, `lightweight_body` | Load-time fallback if a GLB failed to load (never leave `preferGlb: false` once a kit ships); `better_brakes` calipers; Bison `big_wheels` procedural (Blitz/Käferkraft/Donner/Bunker scale detached `StockWheel_*`) |
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

**Exception — Heckspoiler:** not Tripo. Extract original wing:

```bash
npm run cars:extract-blitz-spoiler
```

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
| Blitz parts | `blitz-part-*.png` | `tripo-out/parts/blitz/{id}/` | `cars:bake-blitz-parts-tripo` |
| FX | `fx-*.png` | `tripo-out/fx/` | `fx:bake-tripo` |
| Track kit | `track-*.png` | `tripo-out/track/` | `track:bake-tripo` |
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

**Do:** small primary volumes; thick-outline-friendly; match parts-look; update SOURCES; keep start scripts green.

**Don't:** photoreal PBR clutter; purple glow; commit `tripo-out`; call Tripo at runtime; reuse Blitz part GLBs on other classes; grant stats from meshes.
