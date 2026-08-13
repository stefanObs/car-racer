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
| `reinforced_frame` | Grey | +z | 1.7 | 0.85 |
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

**Not in JOBS:** `rear_spoiler` — `scripts/extract-blitz-stock-and-spoiler.mjs` cuts wing faces from a historical Blitz GLB (`git show 292c6a6:…` or `--from=`).

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
