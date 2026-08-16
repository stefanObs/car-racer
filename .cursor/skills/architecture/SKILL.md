---
name: architecture
description: >-
  Owns Crash Circuit layered architecture: one-way imports, composition root,
  type ownership, and what not to split. Always use when adding files, moving
  modules, changing imports, growing GameApp/RaceRenderer/vehicle.ts, or when
  a change might leak ui/render into data/sim/meta. Default skill (with
  game-concept + clean-programming) for every implementation task.
---

# Architecture (Crash Circuit)

**Source of truth:** `TECH.md` (stack + one-way imports). This skill is the **architecture subagent**.

Stack: Vite + TypeScript + three.js + HTML overlay. **No** ECS, React, or second WebGL canvas.

Also read: `.cursor/skills/clean-programming/`. Design vs impl: `.cursor/skills/game-concept/`. Layer table: [layers.md](layers.md).

**Static lock:** after any `src/` import or ownership change, run `npm run test:arch` (also part of `npm test`). Do not ship if it fails.

## Hard rules

1. **One-way imports** — `data` → `track` → `sim` → `meta` → `app` → (`ui` | `render` | `audio` | `input`). See [layers.md](layers.md). Do not “just import” a higher layer.
2. **Catalogs live in `data/`** — paint hex, comic palette, theme surface colors, sticker ids, nose-vs-sticker. Render and UI **read** data; they do not own duplicate unions or hex.
3. **Types owned once** — `GarageLook` in `src/render/garageLook.ts`; `StickerId` in `src/data/stickers.ts`. Other files re-export only (`export type { … } from`).
4. **Cosmetics never enter `mergeStats`** — paint/stickers grant no stats (`CONCEPT`).
5. **Render never writes `CarState` kinematics** — read `x/z/vx/heading/hp/nitro`; sim owns writes.
6. **Sim never calls `gameAudio`** — emit `RaceAudioEvent` DTOs; app plays them. Type-only import of `audio/raceEvents` is the only sim→audio exception.
7. **One tick driver** — `src/app/GameApp.ts` is the composition root. `src/main.ts` owns the rAF loop that calls `app.tick`. Do not add a second game loop in sim/render/ui.
8. **One WebGL renderer** — `RaceRenderer` constructs the only `WebGLRenderer`. Idle garage is a presenter on the same scene, not a second canvas.

## Do not reopen (size is not a failure)

| Leave it | Why |
|----------|-----|
| `src/sim/vehicle.ts` / `CarState` | Arcade vehicle owner. Do not split for line count. |
| Two WebGL contexts / splitting `RaceRenderer` into race vs garage renderers | One canvas, shared resize/lights. |
| Extracting settings/orbit/nav from `GameApp` “just in case” | It is a thick shell, not a god class. Next features land in extracted modules (`raceFlow`, `uiActions`, screens, presenters). |
| ECS / React / Rapier unless CONCEPT + TECH explicitly adopt them | Locked stack. |

## Where new code goes

| Kind of change | Home |
|----------------|------|
| Catalog, hex, ids, i18n | `src/data/` |
| Track JSON / stitch / zones geometry | `src/track/` |
| Driving, damage, race session | `src/sim/` |
| Save, CHF, shops, rewards | `src/meta/` |
| Tick, screen routing, glue | `src/app/` (`GameApp` only if it is truly root glue) |
| HTML menus / HUD strings | `src/ui/` — **must not** import `src/render/` |
| three.js meshes, VFX, garage 3D | `src/render/` — **must not** import `src/ui/` |
| SFX playback | `src/audio/` (app calls it) |
| Keyboard / gamepad / touch map | `src/input/` |

`ui/` and `render/` may **read** `sim` snapshots (`CarState`, `RaceSession`) and `track` builders. They must not own sim writes.

## Agent checklist

```
Task Progress:
- [ ] 1. Map the change to a layer (table above)
- [ ] 2. New imports only go **down** the graph (or allowed snapshot reads)
- [ ] 3. No second GarageLook / StickerId / palette / theme hex
- [ ] 4. Do not grow GameApp / RaceRenderer with feature logic that has a home
- [ ] 5. `npm run test:arch` green (or full `npm test`)
- [ ] 6. If cars/garage/tracks/named nodes/mounts changed: `npm run docs:cheatsheets`
```

If a feature needs a new shared token (color, id, DTO), put it in `data/` or `core/` — never copy it into ui and render.
