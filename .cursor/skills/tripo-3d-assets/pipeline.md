# Tripo pipeline cookbook

Companion to [SKILL.md](SKILL.md). Exact commands and bake behavior for Crash Circuit.

## CLI setup

```bash
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
tripo doctor          # Node, API key, network
tripo balance         # need credits before make
tripo whoami          # confirm profile
```

Typical install path: `~/.local/node/bin/tripo`. If missing, install via Tripo’s documented CLI; do not invent flags — use `tripo make --help`.

## Canonical `tripo make` (image → textured GLB)

Used for Blitz body, Blitz parts, Bunker/Bison/Donner, FX, track, garage:

```bash
tripo make <concept.png> \
  --model tripo-p1 \
  --for game-pc \
  --then texture \
  --name <history-name> \
  -o <assets/tripo-out/...> \
  --json \
  --timeout 1800 \
  --yes \
  --no-open
```

Notes:

- `--for game-mobile` was used early for Käferkraft; prefer **`game-pc`** for cars/parts unless mobile budget is explicit.
- `--then texture` is enough; bake scripts find `texture/model.glb` or walk for any `model.glb`.
- `--json` helps agents parse completion; always wait for files on disk.
- Long runs: `block_until_ms` high or background + poll output dir (do **not** `pkill`).

## Blitz parts bake (`scripts/bake-blitz-parts-tripo.mjs`)

| Job id | Material name | Face | targetSpan | maxH |
|--------|---------------|------|------------|------|
| `big_engine` | Carbon | +z | 0.85 | 0.38 |
| `nitro_kit` | NitroKit | −z | 0.9 | 0.42 |
| `spike_bumper` | Spike | +z | 1.68 | 0.32 |
| `offroad_suspension` | Spring | +z | 0.5 | 0.34 |
| `reinforced_frame` | Grey | +z | 1.72 (width 1.52) + aft lift | 0.88 |
| `lightweight_body` | Carbon | +z | 0.85 | 0.24 |

Pipeline steps per job:

1. Read GLB from `assets/tripo-out/parts/blitz/{id}/`
2. `flatten` + bake node transforms
3. `facePosZFromTripoX` — Tripo +X → race +Z
4. If `toward === "-z"` → `rotateY180`
5. `centerSitScale` — center XZ, sit on min Y, scale to span/height caps
6. Comic material: metallic 0, roughness 0.85, keep base color/map, drop extras
7. meshopt `simplify` + weld/dedup/prune
8. Write `public/models/parts/blitz-{id}.glb`

**Not in JOBS:** `rear_spoiler` — remounted from Tripo mesh segment (`npm run cars:bake-blitz-segmented-parts`) as `StockSpoiler` + `public/models/parts/blitz-rear_spoiler.glb`.

## Extending to another car’s Teile

1. Create look panels under `assets/tripo-concepts/parts-look/{carId}-item-{partId}.png`.
2. Generate isolated `assets/tripo-concepts/{carId}-part-{partId}.png`.
3. `tripo make` → `assets/tripo-out/parts/{carId}/{partId}/`.
4. Copy/adapt bake script → `public/models/parts/{carId}-{partId}.glb` with class-appropriate `targetSpan` / `maxH` / facing.
5. Wire `partGlbUrl` / bake table, set `preferGlb: true` for that `carId`, anchors from mesh bounds + look sheet.
6. Tests: size/material/bounds + garage e2e for that car + Tripo-only preferGlb lock in `tests/car-parts.test.ts`.

**Hard rule:** silhouette Teile on cars are Tripo-only. Do not leave `preferGlb: false` once `public/models/parts/{carId}-{partId}.glb` ships. Procedural builders remain load-time fallback + `better_brakes` / `big_wheels` hints only.

## Concept art tips for Tripo

- **Isolated prop on plain/studio ground** — Tripo latches onto silhouette; avoid busy full-car scenes for small parts.
- **One primary volume** — scoops, bottles, spike bar, coil; skip tiny panel gaps Tripo cannot preserve.
- **High contrast outlines** — Asphalt-Comic lock; match `assets/art-style/asphalt-comic-reference.png`.
- **Clear facing** — label mentally which side is “nose”; bake `toward` must match mount yaw in `carParts.ts`.

## Car body bakes (shared idea)

Scripts like `bake-blitz-tripo.mjs` / `bake-bison-tripo.mjs`:

- Source: `assets/tripo-out/{carId}/`
- Normalize length/height, sit wheels, strip lights/cameras
- Output: `public/models/cars/{carId}.glb`
- Then: paint bake hooks in `loadCarGltf.ts` / `paintAuthoredWhite.ts`, stickers, outlines

## Mesh segment detach/remount (Bison tires)

Goal: remove a welded sub-part from the car, then add it back as named nodes with **correct color + texture**, without destroying BodyPaint.

### Authoring inputs

| Input | Path / note |
|-------|-------------|
| Good body (single atlas) | `assets/tripo-out/bison/bison-pre-wheel-split.glb` |
| Segment job out | `assets/tripo-out/bison/segment-tires-v2/` (gitignored) |
| Comic tire albedo | `assets/tripo-concepts/bison-tire-albedo.png` (Asphalt-Comic side-view disk) |
| Bake | `npm run cars:bake-bison-segmented-wheels` → `public/models/cars/bison.glb` |

### Tripo segment

1. Credits OK (`tripo balance`).
2. Upload / use file token for the **textured** car GLB (same visual as pre-split body).
3. Run **mesh segment v2 `simple`** (not `smartsegment` fine — too many body fragments).
4. Confirm four tire parts (low, compact disks) in the segment `model.glb` / preview.

Exact CLI flags evolve — use `tripo mesh segment --help` / Tripo docs; park outputs under `assets/tripo-out/bison/segment-tires-v2/`.

### Bake contract (`scripts/bake-bison-segmented-wheels.mjs`)

1. Orient segment like car bakes (`flatten`, bake transforms, `facePosZFromTripoX`, cab toward +Z, `centerSitScale`).
2. Collect 4 tire meshes by bounds; map to corners `FL|FR|RL|RR`.
3. Load **pre-split body**; punch tire ellipsoids out of BodyPaint (keep atlas + UVs on remaining faces).
4. Remount each tire as `StockWheel_{corner}` (mesh + node translation = tire center).
5. **Texture:**
   - Shared material `Tire` + embedded comic PNG.
   - Rubber: annulus disk UVs (YZ → UV) so tread samples the albedo ring.
   - **Both** ±X face disks (full 0–1 albedo) slightly outside half-width — garage ¾ often shows the inboard flank; faces edge-on from pure front.
6. Do **not** merge segment body shards into BodyPaint.

### Runtime contract

- `convertToComicMaterial`: keep Tire `map`; `NearestFilter` + no mipmaps; unmapped rubber → `ComicPalette.tire`.
- `hasAuthoredStockWheels` → `collectWheelUvTriangles` returns **empty** (Tire UV space ≠ BodyPaint).
- Bison / Käferkraft Große Räder: `usesScaledStockWheels` + scale **root** `StockWheel_*` only + hub drop `radius×(scale−1)` so tops stay on the stock fender line (no procedural overlays; never scale GLTF `…_1` children).
- Wheel roll: axle = thinnest local AABB axis (Bison X, Käferkraft Z); front yaw negated vs stick; no garage idle spin.
- Garage paint: `bakeAuthoredGreenToPaint` on BodyPaint only; verify swatches on **owned** Bison.

### Failure modes (segment / wheels)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Grey clay wheels | Map stripped / flat toon / UV on rubber ring only | Keep map; face disks + comic albedo; dark `ComicPalette.tire` |
| Front hubcaps warped / oval | Segment tire filled the hub; annulus UVs mapped spoke art onto rubber | Carve hub hole (`filterFacesOutsideHub`); tread-only annulus (`albedoR0≥0.58`); hub art on face disks only |
| Wheels explode into fenders | Scale applied to GLTF `StockWheel_*_1` children too | Scale **root** `StockWheel_FL|FR|RL|RR` only (`isStockWheelRoot`) |
| Scaled tires clip arch | Hub stays put while radius grows up | Hub drop `radius×(scale−1)+clearance`; stance `wheelLift` matches sink |
| Body mottled / paint “broken” | StockWheel UVs in paint-skip mask | `collectWheelUvTriangles` empty when StockWheel_* present |
| Body atlas scrambled | Body rebuilt from segment fragments | Keep pre-split BodyPaint; punch only |
| Detach looks wrong | BodyPaint UV carve / extract | Use segment + remount (this section) |
| `smartsegment` unusable | Too many body pieces | Prefer segment v2 `simple` |

### Mesh segment detach/remount (Blitz wheels + spoiler)

Same punch/remount contract as Bison. Body: `blitz-pre-wheel-split.glb`. Segment: `assets/tripo-out/blitz/segment-wheels-spoiler-v1/`. Bake: `npm run cars:bake-blitz-segmented-parts`. Runtime: `StockWheel_*` roll/steer; `StockSpoiler` visible only with Heckspoiler.

## Failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Bake exits missing GLB | Tripo not finished / wrong `-o` | Re-run make; check `findSourceGlb` paths |
| Part faces sideways | Forgot face+Z or wrong `toward` | Adjust bake job; remount yaw |
| Scoop on roof | Snap max-Y near windshield | Set `preferY` / smaller `snapRadius` |
| Wrong car silhouette | Reused Blitz kit | Per-car GLB or procedural; `preferGlb: false` |
| 0 credits | Empty Tripo balance | Ask user to `tripo topup` |

## Related paths

- Mounts: `src/render/carParts.ts`, `src/render/carPartBuilders.ts`
- Look sheets: `assets/tripo-concepts/parts-look/README.md`
- Shipped parts: `public/models/parts/README.md`
- TECH overview: `TECH.md` § Car visuals / Race FX / Track kit
