# Tech Stack — Crash Circuit

**Constraint:** only **free-to-use** technology (no paid engines, no paid SaaS required to build/ship/play, no revenue-gated “free” tiers as a dependency). Prefer **OSI-approved / permissive OSS** (MIT, Apache-2.0, BSD, zlib, OFL, CC0).

This free/OSS policy applies to **dependencies and tools**, not to a commercial
reuse grant for Crash Circuit itself. **Project source and original assets** are
**PolyForm Noncommercial 1.0.0** — see `LICENSE` and `NOTICE`. Third-party
packages keep their own licenses.

**Aligned with:** `CONCEPT.md` v3 — browser game; keyboard + **controller** + **tablet**; Asphalt-Comic; JSON levels; German UI; clean tests.

---

## 1. Adopted stack (locked)

The **primary** recommendation below is **adopted**. Implement with this stack only unless the concept is explicitly amended.

## Delivery workflow (mandatory)

Each **implementation step**:

1. Implement + test (clean-programming / review-testing as applicable)
2. **Versionize** — bump semver in `package.json` (and note in commit message as `vX.Y.Z`)
3. **Commit on `master`**
4. **Push to `origin/master`**

**No feature branches.** No long-lived side branches. Master is the only integration line.

---

## 2. Stack details

| Layer | Choice | License (typical) | Why |
|-------|--------|-------------------|-----|
| Language | **TypeScript** | Apache-2.0 (TS) | Fits clean-programming skill; safe refactors; good IDE help |
| Tooling | **Vite** + npm/pnpm | MIT | Fast free toolchain; great for browser + tablet |
| 3D render | **three.js** | MIT | Chase/2.5D camera, toon/cel materials, decals for stickers |
| Race physics | **Custom arcade vehicle** first; optional **Rapier** (`@dimforge/rapier3d`) later | Apache-2.0 | Arcade feel > sim; Rapier free if you need solid contact later |
| Track / zones | Own code + existing `levels/**/*.json` | — | Matches level-editor skill; asphalt/grass/wall as volumes or materials |
| UI (menus/garage/HUD) | **HTML + CSS** overlay on the canvas | — | Best for **tablet hit targets**, focus rings for **gamepad**, German copy, CHF formatting |
| Input | **Keyboard** + **Gamepad API** + **Touch** layer (one action map) | Web standards | Concept §4.2 — one logical actions → three devices |
| Audio | **Web Audio** (native; Howler optional) | MIT / web platform | Free SFX/music playback |
| State / save | Modules + **localStorage** (optional later: file export) | — | No backend required for MVP |
| Tests | **Vitest** (unit + `npm run test:arch` layer guard) + **Playwright** (smoke/e2e, free) | MIT | Always-test + architecture lock + review-testing automation |
| Lint/format | **ESLint** + **Prettier** | MIT | Clarity/maintainability |
| Hosting (optional) | **GitHub Pages** / **Cloudflare Pages** | free tiers | Static web build; no paid host required |
| CI (optional) | **GitHub Actions** | free for public repos | Test on PR |

### Why this stack fits Crash Circuit

1. **Browser-first** matches the concept platform (desktop + tablet in one build).
2. **Controller + touch** are first-class in the browser (Gamepad API + touch DOM/canvas); HTML UI makes garage/sticker editing far easier than pure in-canvas UI.
3. **Asphalt-Comic**: three.js supports flat/toon lighting, outlines (e.g. force-field / outline pass or mesh clones), decals for Aufkleber.
4. **Level JSON** already started under `levels/` — loaders stay simple; ad-hoc segment stitch is plain TS.
5. **Tests**: pure TS modules for grass penalty, damage heal, CHF purse, catch-up, track validation — no engine lock-in.
6. **100% free**: no Unity/Unreal seat, no paid asset-store requirement, no mandatory cloud.

### Suggested repo shape

```
src/
  core/           # time, version, celebrate DTO
  app/            # GameApp (only tick driver), screens, raceFlow, uiActions
  input/          # ActionMap: throttle, brake, steer, nitro, ui*
  sim/            # vehicle, damage, catch-up, zones (grass/wall)
  meta/           # save, CHF, shops, race rewards
  render/         # three.js scene, toon materials, VFX (read CarState; never write it)
  track/          # JSON load, segment mesh, ad-hoc generator
  ui/             # HTML menus, garage, HUD — no GameApp
  audio/
  data/           # cars, parts, cosmetics, i18n/de.json
levels/           # already present
public/models/cars/  # GLB car visuals (Blender exports); collision = silhouette radius
tests/
```

**One-way imports:** `data` → `track` → `sim` → `meta` → `app` → (`ui` | `render` | `audio` | `input`). Lower layers never import `ui/`, `render/`, or `audio/` implementations. `meta/` never imports `ui/` or `render/`. `ui/` never imports `render/` (HUD/theme hex lives in `data/`). `data/` owns catalogs (paint hex, nose-vs-sticker); render/UI read them. Cosmetics never enter `mergeStats`. Sim never calls `gameAudio`. Render never writes `CarState`. `GameApp` is the only frame driver (`src/app/GameApp.ts`); next features land in the extracted modules, not back into GameApp or RaceRenderer.

**Skill:** `.cursor/skills/architecture/`. **Static lock:** `npm run test:arch` (`scripts/check-architecture.mjs`, also run by `npm test`). Do not split `CarState` / `vehicle.ts` for size; do not add a second WebGL canvas.

### Car visuals (GLB import)

- Drop `{carId}.glb` into `public/models/cars/` (see README there).
- Tunables: `src/data/carModels.ts` (`scale`, `yaw`, `collisionRadius`).
- Boot calls `preloadCarModels()`; all five GLBs are required (no procedural fallback).
- Bison mesh: Tripo3D authoring bake (`cars:bake-bison-tripo`); runtime is the shipped GLB (no Tripo at play time).
- Donnerbüchse mesh: Tripo3D authoring bake (`cars:bake-donnerbuechse-tripo`); runtime is the shipped GLB (no Tripo at play time).
- Bunker mesh: Tripo3D authoring bake (`cars:bake-bunker-tripo`); runtime is the shipped GLB (no Tripo at play time).
- Käferkraft mesh + nose props: Tripo3D authoring bake (`cars:bake-kaeferkraft-tripo`); runtime is the shipped GLBs (no Tripo at play time).
- Blitz mesh: Tripo3D authoring bake (`cars:bake-blitz-tripo`); runtime is the shipped GLB (no Tripo at play time).
- Blitz equipped Teile: small add-on GLBs (`public/models/parts/blitz-*.glb`) — visuals only; stats stay in `mergeStats`. Bake: `cars:bake-blitz-parts-tripo`. **Agent skill:** `.cursor/skills/tripo-3d-assets/` (concept → Tripo → bake). Other cars use class procedural parts until per-car kits ship — do not remount Blitz kits on them.
- Loader strips lights/cameras and uses mesh-only bounds (embedded Spotlights otherwise break autoscale).
- **Collision** is a circle (`collisionRadius`) — visual mesh may overhang.
- Provenance: `public/models/cars/SOURCES.md`

### Race FX (shared, all cars)

- Damage smoke, repair sparks, and nitro trails are **shared** Tripo meshes (`public/models/fx/`), not per-car cosmetics and not stickers.
- Boot: `preloadFxModels()`. `upgradeCarFx` swaps placeholder spheres after `buildComicCar` using the car mesh rear (−Z).
- Nitro uses orange/cyan exhaust jets with **A/B flicker poses** (`nitro-*-b.glb`) swapped while boosting.
- Sim contract unchanged: `RaceRenderer` shows/hides/animates from damage stage, `healFx`, and nitro drain. Nitro is orange/cyan (`#FF7A18` / `#3DB9C7`) — no purple bloom.
- Authoring bake: `fx:bake-tripo` from `assets/tripo-out/fx/` (gitignored). Provenance: `public/models/fx/README.md`.


### Track kit (walls + theme scenery)

- Asphalt/grass ribbons stay spline-extruded. Discrete walls/obstacles/scenery use a Tripo kit in `public/models/track/`.
- Boot **awaits** `preloadTrackModels()` for the full kit (16 GLBs); race start awaits again so cup / free / ad-hoc never build with box fallbacks.
- Tire modules on corners, concrete + chain-link fence on straights; on-track `tire_stack` / `concrete_barrier` stay compact props (not the long outer-wall modules).
- Harbor: crane / container / tank / warehouse. Cups 2–5 + ad-hoc aliases: grandstand, palm, hut, tower, building, cliff, spire, tree, warehouse, scrub.
- Scenery anchors stay outside asphalt+grass (`SCENERY_CLEARANCE`); solid obstacles stay on the verge so the center corridor stays clear.
- Collision/physics unchanged (visuals may overhang).
- Authoring bake: `track:bake-tripo` from `assets/tripo-out/track/` (gitignored). Provenance: `public/models/track/SOURCES.md`.

### Camera (locks open decision toward MVP)

**Flat chase / slightly elevated 3D** behind the car (concept recommendation). Readable line, grass, and wall types — not top-down sim, not cinematic only. Follows `car.y` during Schanze airtime.

### Arcade physics (sim)

- Implementation: `src/sim/vehicle.ts` (zones/damage/catchup/race helpers).
- **Agent skill:** `.cursor/skills/arcade-physics/` — evolve feel via Eigenschaften mapping + feel tests; do not grow a parallel physics design doc.
- Lock tests: `tests/arcade-physics.test.ts`, `tests/arcade-feel.test.ts`.
- **Dev pad (F4):** 1 km asphalt square + white 5 m raster (`src/data/debugPad.ts`) — handling sandbox, not a cup track. No AI, no walls, no countdown.

### Dev cheats (always-on overlay)

| Key | Action |
|-----|--------|
| F1 | Toggle `data-dev-name` overlay |
| F2 | Set CHF |
| F3 | Force-finish current race at a chosen place |
| F4 | Start Debug-Raster pad (handling) |
| F5 | Mesh studio: car on green (violet if the paint is green), mesh names + mesh-space meters; RMB copies. Right **Komponenten** list selects occluded/inner nodes. **E** / **Platzieren**: click mesh, **K** one edge, **R** turn, **S** scale 1:1, **X** stretch axes, **G** move; [ ] yaw; +/− size; Home resets |
| F6 | Photo mode (hide UI chrome) |
| F7 | Live Teile swap this race only |

---

## 3. Strong alternative (also fully free)

| Stack | Notes |
|-------|--------|
| **Godot 4** (MIT) | Excellent input map (keyboard/pad/touch), built-in editor, export to Web + desktop. Use if you prefer an all-in-one game IDE. Import the same JSON levels via a small loader. Web export is viable but heavier to debug than Vite; garage UI is more work than HTML. |

Pick **Godot** if the team wants editor-driven iteration over web-native UI. Pick **TypeScript + three.js** if browser/tablet UX and JSON-in-repo workflow matter more (default for this repo).

---

## 4. Free-to-use policy (hard)

**Allowed**

- OSS engines/libs with permissive or weak-copyleft licenses you can comply with (MIT, Apache-2.0, BSD, zlib, MPL with compliance, etc.)
- Free fonts (OFL/SIL), CC0/CC-BY assets with attribution if required
- Free hosting/CI that does not require payment to ship the game

**Not allowed as dependencies**

- Paid engines or seats (Unity Pro, etc.) — even “Personal free under revenue cap” is avoided so the project never depends on a commercial license threshold
- Paid middleware required at runtime (proprietary physics SDKs, paid multiplayer relays for MVP)
- Assets/plugins that require purchase to build
- Fonts/music you cannot legally redistribute

Document third-party licenses in `NOTICE` (and `public/models/*/SOURCES.md` for
assets) when shipping. Project license: `LICENSE` (PolyForm Noncommercial 1.0.0).

---

## 5. Compared options (why not default)

| Option | Free? | Verdict for Crash Circuit |
|--------|-------|---------------------------|
| **Phaser** (2D) | Yes (MIT) | Weak fit for chase 3D + stickers-on-mesh; possible for pure top-down fork — not optimal |
| **Babylon.js** | Yes (Apache-2.0) | Fine alternative to three.js; slightly heavier; pick one and stay |
| **PlayCanvas engine** | OSS exists | Possible; smaller community than three.js for this team size |
| **Unity** | Personal “free” with caps | **Rejected** under free-only policy (commercial license surface) |
| **Unreal** | Source available, EULA | **Rejected** for web/tablet MVP cost/complexity + license model |
| **React Three Fiber** | Yes (MIT) | Optional later for garage viewer; **not required** — keep game loop in plain TS modules for clarity |
| **cannon-es** | Yes (MIT) | OK lightweight physics if not using Rapier; still prefer custom arcade first |

---

## 6. Feature → tech mapping

| Concept need | Implementation approach |
|--------------|-------------------------|
| Asphalt → grass → wall | Track materials / overlap queries; wall type by segment (tire vs concrete) |
| Uneven + suspension | Height noise / bump impulses scaled by suspension stat |
| Damage heal + FX | Sim state machine + particle/spark meshes + HUD |
| Catch-up | Pure function of place gap → accel/top-speed multipliers (unit-tested) |
| Garage / stickers | HTML UI + canvas/decals on car mesh; cosmetics flag `affectsStats: false` |
| CHF | `Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' })` |
| Controller | Gamepad polling → ActionMap; UI focus trap in HTML |
| Tablet | Touch controls overlay; `pointer` events; CSS `dvh` / landscape layout |
| Ad-hoc tracks | Segment stitch from `track-spec.md`; seed string |
| Cup / free / training | Data-driven from `levels/` (training = solo, unranked) |

---

## 7. MVP build order (tech)

1. ✅ Vite + TS + canvas/three boot + ActionMap (keyboard)
2. ✅ One loop track + grass/wall volumes
3. ✅ Arcade drive + chase camera (WebGL / Asphalt-Comic; no Canvas2D fallback)
4. ✅ Gamepad + touch overlays; HTML main menu
5. ✅ Damage/heal, basic AI, CHF results
6. ✅ Garage (paint, stickers, parts, synergies)
7. ✅ Vitest for sim rules + **Playwright smoke** (load menu → cup → race)
8. ✅ Tablet layout pass + controller menu pass (review-testing)
9. ✅ Ad-hoc seed tracks (segment stitch + shareable seed)

---

## 8. Decision status

| Topic | Status |
|-------|--------|
| Primary stack | **Adopted:** TypeScript + Vite + three.js + HTML UI + Vitest/Playwright |
| Alt stack | Godot 4 (MIT) — not in use |
| Physics | Custom arcade → Rapier only if needed |
| Camera | Flat chase 3D for MVP |
| Free-only | **Invariant** — see policy §4 |
| Delivery | Each step versioned + committed + pushed on **`master` only** (no branches) |
