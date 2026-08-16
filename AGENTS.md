# Crash Circuit — Agent instructions

This repo’s design and workflow live in project skills. **Use every skill that applies to the task** — read the skill files; do not rely on memory.

## Skills (read when useful)

| Skill | Path | Use when |
|-------|------|----------|
| Game concept | `.cursor/skills/game-concept/SKILL.md` | Design, CONCEPT.md, feature fit, concept vs impl |
| Clean programming | `.cursor/skills/clean-programming/SKILL.md` | Any code change, bugs, refactors, tests |
| Architecture | `.cursor/skills/architecture/SKILL.md` | Layers, imports, GameApp/RaceRenderer, type ownership — **run `npm run test:arch`** |
| Review & testing | `.cursor/skills/review-testing/SKILL.md` | QA, playtest, UX, art consistency, level regression — **always start server + browser** |
| Asphalt-Comic art | `.cursor/skills/asphalt-comic-art/SKILL.md` | Any visuals / image generation |
| Level editor | `.cursor/skills/level-editor/SKILL.md` | Tracks, cups, free/ad-hoc levels — **then `npm run docs:cheatsheets`** |
| Tripo 3D assets | `.cursor/skills/tripo-3d-assets/SKILL.md` | Cars, Teile, FX, track kit, garage props — concept → Tripo → bake GLB. **Cars: silhouette Teile = Tripo GLBs only** (`preferGlb: true`); procedural only for brakes/wheels hints. **Then `npm run docs:cheatsheets`.** |
| Arcade physics | `.cursor/skills/arcade-physics/SKILL.md` | Driving feel, Eigenschaften→forces, grip/slide, jumps, nitro, mass contact — evolve deliberately |

Project Cursor subagents (`.cursor/agents/`): `architecture`, `clean-programming`, `game-concept`, `arcade-physics`, `review-testing`, `level-editor`, `tripo-3d-assets`, `asphalt-comic-art`. Delegate with those names; they read the matching skill.

Source of truth for design: `CONCEPT.md`. Tech (free-only, adopted): `TECH.md`.

**Mesh cheat sheets** (exact node/mesh names + meter grids): [`.cursor/cheatsheets/`](.cursor/cheatsheets/README.md). **Always regenerate** with `npm run docs:cheatsheets` in the same step as car/garage/track/GLB/mount changes — do not leave sheets stale.

**Delivery:** each implementation step → version bump → commit on `master` → push. No feature branches.

**Start:** `./start.sh` / `start.bat` / `.\start.ps1` — must always work; bootstrap portable Node into `.tools/` when Node is not installed (network once).

**Port cleanup:** use `npm run free:dev` — never `pkill -f vite` (self-kills agent shells).

Cursor rules under `.cursor/rules/` (`alwaysApply`) reinforce the same routing — follow them.
