# Concept Evolution

## Versioning

Track in the footer of `CONCEPT.md`:

```text
*Dokumentstand: Konzept vN — <one-line focus>.*
```

Bump **N** when invariants, core loop, economy, modes, or art lock change. Typos / clarity-only edits need no bump.

## Decision log

Append newest first.

### 2026-07-26 — v3.17 Käferkraft bumper lamps are car headlights

- Trigger: user — red Totenkopf lamps belong to the car; style as front headlights with textures
- Decision: EyeRed meshes stay visible on all nose variants; comic headlight atlas (chrome bezel + warm lens). Only Skull + front horns toggle with Totenkopf.
- CONCEPT §§ touched: §6.2 → v3.17

### 2026-07-26 — v3.16 Käferkraft nose props (Bidr / Hund)

- Trigger: user — horns belong to skull; default bare; Stier→Bidr bird; Sternkopf→Hund dog
- Decision: Free3D links were Personal Use / blocked → Sketchfab CC-BY bird + sitting dog. Skull+Dark horns toggle together. Default kit sticker `none`.
- CONCEPT §§ touched: §6.2 → v3.16

### 2026-07-26 — v3.15 Sticker textures + buggy nose

- Trigger: user — textures instead of overlays; car-specific stickers; buggy nose models; Bunker ironClad door replaceable
- Decision: Bake stickers into albedo (side/hood/door). Käferkraft uses nose mesh variants (not decals). Bunker door UV slots swap IronClad badge.
- CONCEPT §§ touched: §6.2 → v3.15
- Impl: `carStickers.ts`, `buggyNose.ts`

### 2026-07-25 — v3.11 Readable track layouts

- Trigger: user — no unclear passables; no self-cross (else bridge+wall); clear corridor; cannot leave track
- Decision: Cups/ad-hoc = same-turn ovals (no figure-8). Solid blockers at verge only. Passable = low rumble/oil with markings. Walls keep cars in. Bridges deferred until a layout truly needs a crossing.
- CONCEPT §§ touched: §4.4 layout rules, §4.6 obstacle clarity → v3.11
- Skills: level-editor checklist + track-spec; validateTrack self-cross tests

### 2026-07-25 — v3.10 Arcade driving feel

- Trigger: user — improve car driving to feel more like a racing game
- Decision: Keep “Gewicht + Grip + Impuls” (no full drift sim). Velocity can slip vs heading; yaw rate drops at high speed; lighter drag / coast; punchier accel/nitro. Tests lock steer curve, coast, slip angle.
- CONCEPT §§ touched: §4.2 → v3.10
- Impl: `src/sim/vehicle.ts` stepCar rewrite

### 2026-07-25 — v3.7 Category-faithful car silhouettes

- Trigger: user — art should strive for looks close to real cars of each category; sample target image
- Decision: Keep Asphalt-Comic (cel, outlines, flat color — not photoreal materials). Add rule that proportions/type cues match real category vehicles and stay engine-renderable. Canonical sample sheet: `assets/art-style/car-category-targets.png`
- CONCEPT §§ touched: §2 visual; §5.1 art note; §13 summary → v3.7
- Skills: asphalt-comic-art SKILL + style-bible vehicle targets

### 2026-07-25 — v3.6 Garage is the home hub

- Trigger: user — boot into garage; emphasize equipping; make garage look good
- Decision: Default screen = Garage with race CTAs + equip-first parts UI; comic 3D bay backdrop; slim Hilfe screen replaces old main menu hub
- CONCEPT §§ touched: §9 UX flow → v3.6
- Skills: asphalt-comic garage look; review e2e updated for garage-first boot

### 2026-07-25 — v3.5 Per-car kits + class silhouettes

- Trigger: user — distinguishable car models; add-ons must not auto-share across car types
- Decision: Sport (Blitz) vs Pick-up (Bison) get distinct comic meshes; save v2 stores parts/paint/sticker per car; v1 global inventory migrates onto the then-active car only
- CONCEPT §§ touched: §5.1 kits note; §13 summary → v3.5
- Skills: asphalt-comic silhouettes; clean-programming tests for migration RCA

### 2026-07-25 — v3.4 Ad-hoc seed tracks shipped

- Trigger: user — continue next step after MVP tech order complete
- Decision: Implement CONCEPT §8.4 ad-hoc from segment stitch + shareable seed in main menu
- CONCEPT/TECH touched: §11 Danach → delivered note; TECH build order step 9; footer → v3.4
- Skills: level-editor rules followed (asphalt→grass→wall, tire corners)

### 2026-07-25 — v3.3 Session pacing 7–15 min

- Trigger: user — planned pacing so 7–15 min can unlock or buy something meaningful
- Decision: Successful short session = 7–15 min; ≤2 intro mid-pack races afford a starter part; P1 first race affords a solid early part; early cups prefer 2 laps
- CONCEPT §§ touched: §3 loop, §4.8 economy pacing, §13 summary → v3.3
- Skills synced: review-testing doability checklist; game-concept evolution log
- Impl: intro purses, starter part prices, early cup laps, economy pacing tests

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
