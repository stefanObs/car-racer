# Layer import matrix

Enforced by `scripts/check-architecture.mjs` (`npm run test:arch`). Keep this table and the script in sync.

## Graph

```
core (DTOs only; no ui/render/sim/…)
data  → track (exception: levels/debugPad need track types/builders)
track → data
sim   → data, track; type-only `audio/raceEvents`
meta  → data, sim, track
app   → all (composition root)
ui    → data, track, sim, meta, core  (not render, not audio)
render→ data, track, sim, core        (not ui, not meta, not audio)
audio → (internal + data/core if needed; not ui/render/sim/meta/app)
input → (internal + data/core if needed; not ui/render/sim/meta/app/audio)
dev   → data (cheats panel)
```

`main.ts` may import app, render preload, audio.

## Banned (from → into)

| From | Must not import |
|------|-----------------|
| `data` | ui, render, audio, meta, app, sim, input, dev |
| `track` | ui, render, audio, meta, app, sim, input, dev |
| `sim` | ui, render, meta, app, input, dev; audio except type-only `raceEvents` |
| `meta` | ui, render, audio, app, input, dev |
| `ui` | render, audio |
| `render` | ui, meta, audio, app, input |
| `audio` | ui, render, meta, app, sim, input, dev |
| `input` | ui, render, meta, app, sim, audio, dev |
| `core` | ui, render, audio, meta, app, sim, input, dev |

## Ownership locks (same script)

| Token | Define once | Re-export OK |
|-------|-------------|--------------|
| `export type GarageLook =` | `src/render/garageLook.ts` | façade / presenter |
| `export type StickerId =` | `src/data/stickers.ts` | meta, render |
| `new WebGLRenderer(` | `src/render/RaceRenderer.ts` (exactly one) | — |
| `requestAnimationFrame(` | `src/main.ts`, `src/app/GameApp.ts` | — |
| `class GameApp` | `src/app/GameApp.ts` | not under `ui/` |

HUD/theme hex: `src/data/comicPalette.ts`, `src/data/themeColors.ts`, `src/data/paintColors.ts`.
