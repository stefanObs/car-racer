---
name: review-testing
description: >-
  Playtest, QA, regression, graphics-consistency, and UX review for Crash Circuit
  against CONCEPT.md. Always use when reviewing, testing, playtesting, QAing,
  verifying UX, checking regressions across levels, validating art consistency,
  assessing doability for the target player, or finishing player-facing changes
  that need a verification pass.
---

# Review & Testing (Crash Circuit)

Source of truth: `CONCEPT.md`. Cross-check art with `.cursor/skills/asphalt-comic-art/`, tracks with `.cursor/skills/level-editor/`, bugs with `.cursor/skills/clean-programming/` (reproduce → failing test → fix).

**Most important characteristics:**

1. **Tests if it is doable for a user**
2. **Tests regression in all levels**
3. **Verifies if the graphics etc. are consistent**
4. **Verifies the UX**

Full checklists: [checklists.md](checklists.md).

## Target player (doability)

- Audience: boy ~**10+**, language **German**, session success in **15–30 min**
- Platforms: **Desktop keyboard**, **controller/gamepad**, and **tablet touch** — all first-class
- Core fantasy: **tuned cars racing fast** — not a ram-focused game (no ram button)
- Must be completable without reading a manual: icons + short German copy
- Soft skill floor (assists optional) + hard skill ceiling (clean drive pulls away from AI)
- Frustration checks: damage **heals** with visible FX; K.O. respawns fair; grass/walls readable
- Input: full loop (menus + garage + race) on controller and tablet, not race-only

**Doability verdict** (required in every review report):

| Rating | Meaning |
|--------|---------|
| ✅ Doable | 10+ can finish the flow with brief trial-and-error |
| ⚠️ Stretch | Needs clearer UX, assists, or tuning |
| ❌ Blocked | Soft-locks, illegible feedback, or unfair AI/track |

## Workflow

```
Task Progress:
- [ ] 1. Scope: feature / PR / full pass / single cup
- [ ] 2. Player-doability pass (cold eyes, German UI, core loop)
- [ ] 3. UX pass (screens §9 + HUD readability)
- [ ] 4. Graphics consistency (Asphalt-Comic + track zones)
- [ ] 5. Regression: ALL shipped levels + sample ad-hoc seeds
- [ ] 6. Concept compliance (mechanics & economy)
- [ ] 7. Report with severity + repro steps (clean-programming if fixing)
```

## 1) User doability

Walk the **Kernschleife** as a new player:

Menü → Cup/Frei/Ad-hoc → Rennen → Ergebnis → Garage (Schmuck/Kauf/Tuning) → nächstes Rennen.

Check:

- First race understandable in &lt;2 minutes (steer, gas, brake, nitro)
- Parts show **advantage + disadvantage** in one sentence each
- Combos visible when they apply
- Catch-up feels tense but a clean player can still gap the AI
- Currency shown as **CHF** / Fr., rewards explained on results
- No soft-lock in garage, menus, or post-K.O. respawn

## 2) Regression — all levels

For **every** file under `levels/cups/**` and `levels/free/**`, plus representative `levels/adhoc` seeds:

| Check | Fail if |
|-------|---------|
| Loads / starts | Crash, black screen, missing spawn |
| Lap completable | Stuck geometry, invisible walls, broken checkpoints |
| Cross-section | Missing grass or wrong wall type (tires in corners, concrete on straights) |
| AI | Off-track, stalled, rubber-band that prevents clean wins |
| Rewards | Wrong/missing CHF; stars only where cup expects |
| Performance | Unplayable hitch on target desktop/browser |

Automate what you can (level load, schema validation, smoke boot). **Manually** spot-check at least one race per theme and every new/changed level.

Never claim “regression green” without listing which level IDs were run.

## 3) Graphics consistency

Against Asphalt-Comic (`reference.png` / style bible):

- Cel-shade, thick outlines, flat bold colors — not photoreal / neon-purple / diorama / low-poly
- Asphalt vs grass vs tire wall vs concrete **instantly** distinguishable
- Damage stages + **heal FX** readable; nitro trail restrained
- Stickers/livery sit flat on paint; cosmetics never look like stat buffs
- Theme tints backgrounds only; track language stays consistent
- UI chrome matches game art language (no random design-system clash)

## 4) UX verification

Screens from concept §9 must exist and flow cleanly:

1. Hauptmenü — Cup / Freier Modus / Ad-hoc / Garage / Einstellungen  
2. Cup-Karte — nodes, stars, recommended class  
3. Freier Modus / Ad-hoc — track or seed, options, start  
4. Garage — turntable, parts, stats + combo, paint, sticker editor  
5. Renn-HUD — place, lap, mini-map, damage (+ heal hint), nitro, style popups (`+50 CHF`)  
6. Ergebnis — podium, CHF breakdown, continue / garage  

UX rules:

- German throughout; short sentences; icon + text  
- Primary actions obvious; no dead ends  
- HUD does not obscure racing line; critical info glanceable  
- Garage trade-offs and combos scannable for a 10-year-old  
- Freier Modus / Ad-hoc clearly secondary to Cup career (progress rules match concept)
- **Controller:** focus navigation through all screens; no mouse-required dead ends  
- **Tablet:** touch targets large enough; race overlays usable with thumbs; layouts work in landscape tablet sizes

## Concept compliance (quick gate)

Fail review if any are true:

- Ram button or ram-as-primary scoring
- Damage never heals / no heal feedback
- Grass penalty removed entirely by suspension
- Cosmetics grant stats
- Currency not CHF in player-facing UI
- Intro cup is an obstacle gauntlet
- Catch-up makes perfect play unable to lead
- Race or menus require mouse/keyboard only (no usable controller or tablet path)

## Report format

```markdown
# Review: <scope>
**Build / branch:** …
**Levels run:** <id list or “all N”>
**Doability:** ✅ / ⚠️ / ❌ — <one line>

## Findings
### 🔴 Blocker
- … (repro)
### 🟡 Major
- …
### 🟢 Minor / polish
- …

## Pass summary
- Doability: …
- UX: …
- Graphics: …
- Level regression: … / … passed
- Concept: …
```

Severity: **Blocker** = unshippable for target player or breaks levels/art/UX badly; **Major** = wrong vs concept or painful; **Minor** = polish.
