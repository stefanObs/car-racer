# Concept Evolution

## Versioning

Track in the footer of `CONCEPT.md`:

```text
*Dokumentstand: Konzept vN — <one-line focus>.*
```

Bump **N** when invariants, core loop, economy, modes, or art lock change. Typos / clarity-only edits need no bump.

## Decision log

Append newest first.

### 2026-07-25 — v0.2.3 Start scripts bootstrap Node

- Start scripts download portable Node into `.tools/` when Node is not preinstalled
- Unix: curl|wget|python3 + tar; Windows: PowerShell download/expand; bat delegates to ps1

### 2026-07-25 — v0.2.1 Cross-platform start scripts

- Added `start.sh`, `start.bat`, `start.ps1` + alwaysApply rule that they must keep working
- README / AGENTS / skills-router updated

### 2026-07-25 — v0.2.0 MVP implementation

- Trigger: user — implement the MVP
- Shipped: 2 cars, 5 cup levels, free mode, garage (paint/stickers/parts/synergies), race sim with zones/damage/heal/KO/catch-up/AI, DE UI, keyboard+gamepad+touch
- Version 0.2.0 on master

### 2026-07-25 — v3.2 Stack adopted + master-only delivery

- Trigger: user — use recommended tech; each step versioned, committed, pushed to master; no branches
- Decision: Adopt TS/Vite/three.js stack; delivery invariant #12; scaffold as v0.1.0 on master
- CONCEPT/TECH/AGENTS/rules synced; clean-programming DoD updated

### 2026-07-25 — v3.1 Free-only tech stack recommendation

- Trigger: user asked for optimal free-to-use tech stack
- Decision: Primary = TypeScript + Vite + three.js + HTML UI + Vitest/Playwright; alt = Godot 4; reject Unity/Unreal as deps; custom arcade physics first
- CONCEPT §§ touched: §12, §13 footer → v3.1; new `TECH.md`
- Skills synced: game-concept invariant #11
- Impl follow-ups: scaffold Vite/TS when ready to prototype

### 2026-07-25 — v3 Controller + Tablet required

- Trigger: user — game must be playable with controller and on tablet
- Decision: keyboard, gamepad, and tablet touch are first-class (race + menus); moved out of “Danach”
- CONCEPT §§ touched: header platform, §4.2, §7.4, §9, §11 MVP, §13 → v3
- Skills synced: game-concept invariant #10, review-testing doability/UX
- Impl follow-ups: input layer, focus UI, touch controls, tablet layout QA

### 2026-07-25 — Skill router + always-use

- `AGENTS.md` + `.cursor/rules/skills-router.mdc` mandate reading every matching project skill
- All five skills: alwaysApply rules; descriptions use “Always use when…”
- Level-editor rule elevated to alwaysApply (conditional body)

### 2026-07-25 — v2 baseline locked into skills

- Core = tuned racing speed; ramming = spice
- Damage heals over time + FX; track asphalt→grass→wall
- CHF; stickers; free + ad-hoc modes; catch-up with skill ceiling
- Art = Asphalt-Comic
- Skills: asphalt-comic-art, level-editor, clean-programming, review-testing, game-concept

### Template

```markdown
### YYYY-MM-DD — vN <title>
- Trigger: …
- Decision: …
- CONCEPT §§ touched: …
- Skills/levels synced: …
- Impl follow-ups: …
```

## Amendment patterns

| Situation | Pattern |
|-----------|---------|
| User corrects design | Update CONCEPT → sync skills → fix code |
| Code discovers edge case | Propose CONCEPT rule → approve → implement |
| Playtest fails doability | Prefer UX/tuning in CONCEPT + review-testing; avoid silent mechanic rewrites |
| Scope creep | Park under CONCEPT “Danach” / open decisions; do not half-implement |

## Alignment anti-patterns

- Feature ships only in code with no CONCEPT line  
- CONCEPT says A, HUD teaches B  
- Level JSON breaks cross-section rules  
- “Temporary” ram button left in  
- New currency or English-only UI “just for MVP” without CONCEPT change  
