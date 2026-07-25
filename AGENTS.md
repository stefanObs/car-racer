# Crash Circuit — Agent instructions

This repo’s design and workflow live in project skills. **Use every skill that applies to the task** — read the skill files; do not rely on memory.

## Skills (read when useful)

| Skill | Path | Use when |
|-------|------|----------|
| Game concept | `.cursor/skills/game-concept/SKILL.md` | Design, CONCEPT.md, feature fit, concept vs impl |
| Clean programming | `.cursor/skills/clean-programming/SKILL.md` | Any code change, bugs, refactors, tests |
| Review & testing | `.cursor/skills/review-testing/SKILL.md` | QA, playtest, UX, art consistency, level regression |
| Asphalt-Comic art | `.cursor/skills/asphalt-comic-art/SKILL.md` | Any visuals / image generation |
| Level editor | `.cursor/skills/level-editor/SKILL.md` | Tracks, cups, free/ad-hoc levels |

Source of truth for design: `CONCEPT.md`. Tech (free-only, adopted): `TECH.md`.

**Delivery:** each implementation step → version bump → commit on `master` → push. No feature branches.

**Start:** `./start.sh` (Linux/macOS), `start.bat` / `.\start.ps1` (Windows) — must always work.

Cursor rules under `.cursor/rules/` (`alwaysApply`) reinforce the same routing — follow them.
