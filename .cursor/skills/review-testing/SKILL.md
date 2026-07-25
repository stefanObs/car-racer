---
name: review-testing
description: >-
  Playtest, QA, regression, graphics-consistency, and UX review for Crash Circuit
  against CONCEPT.md. Always start the dev server and verify in a real browser.
  Always use when reviewing, testing, playtesting, QAing, verifying UX, checking
  regressions across levels, validating art consistency, assessing doability for
  the target player, or finishing player-facing changes.
---

# Review & Testing (Crash Circuit)

Source of truth: `CONCEPT.md`. Cross-check art with `.cursor/skills/asphalt-comic-art/`, tracks with `.cursor/skills/level-editor/`, bugs with `.cursor/skills/clean-programming/` (reproduce → failing test → fix).

**Most important characteristics:**

1. **Tests if it is doable for a user**
2. **Tests regression in all levels**
3. **Verifies if the graphics etc. are consistent**
4. **Verifies the UX**
5. **Always starts the server and tests in a browser** (mandatory)

Full checklists: [checklists.md](checklists.md).

## Mandatory: server + browser

**Never** claim a player-facing change or review is done from unit tests / code reading alone.

### Boot

1. From repo root, start the app (prefer `./start.sh` / `start.bat` / `.\start.ps1`, or `npm run dev`).
2. Wait until the dev URL is ready (default **http://127.0.0.1:5173/**).
3. Open that URL in the **browser automation tools** (cursor-ide-browser): navigate → lock → snapshot/screenshot → interact.
4. Confirm the **Hauptmenü** is visible (not a blank/dark screen, not a boot-error unless that is the bug under test).
5. Exercise the flow under test with clicks/keys in the browser; take screenshots for visual/graphics checks.
6. Note render mode if shown (`2D-Fallback` vs WebGL).
7. Unlock the browser when finished; leave the server running only if still needed.

### Anti-hang (agents)

**Never** run `pkill -f vite`, `pkill -f playwright`, or similar broad process-name kills.

Those patterns match the **agent shell argv** (the command text often contains `vite` / `playwright`) and kill the agent mid-run. The server never starts, `AwaitShell` waits forever, and the test agent looks stuck.

To free the port instead:

```bash
npm run free:dev          # kills only the listener on :5173
# or kill by saved PID: kill "$(cat /tmp/cc-dev.pid)"
```

Prefer `npm run test:e2e` for automated smoke (Playwright starts/stops its own server). For manual browser review, start once with `npm run dev` / `./start.sh` and reuse that server.

### Browser smoke (minimum every review)

| Step | Pass if |
|------|---------|
| Load `/` | Title Crash Circuit; menu heading + Cup / Freier Modus / Garage |
| Open Cup | Level list visible; can select an unlocked race |
| Start race | HUD shows place/lap; canvas draws track or 2D fallback |
| Open Garage | Parts/paint/CHF visible |
| No console blocker | No uncaught errors that blank the UI |

If the server fails to start, **that is a blocker** — fix start scripts / deps before continuing.

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
- [ ] 2. Start server + open browser (mandatory)
- [ ] 3. Browser smoke (menu / cup or free / race or garage)
- [ ] 4. Player-doability pass (cold eyes, German UI, core loop)
- [ ] 5. UX pass (screens §9 + HUD readability)
- [ ] 6. Graphics consistency (Asphalt-Comic + track zones) via screenshots
- [ ] 7. Regression: ALL shipped levels + sample ad-hoc seeds
- [ ] 8. Concept compliance (mechanics & economy)
- [ ] 9. Report with severity + repro steps + browser evidence
```

## 1) User doability

Walk the **Kernschleife** as a new player **in the browser**:

Menü → Cup/Frei/Ad-hoc → Rennen → Ergebnis → Garage (Schmuck/Kauf/Tuning) → nächstes Rennen.

Check:

- First race understandable in &lt;2 minutes (steer, gas, brake, nitro)
- Parts show **advantage + disadvantage** in one sentence each
- Combos visible when they apply
- Catch-up feels tense but a clean player can still gap the AI
- Currency shown as **CHF** / Fr., rewards explained on results
- No soft-lock in garage, menus, or post-K.O. respawn

## 2) Regression — all levels

For **every** cup/free level id (see `src/data/levels.ts` / `levels/`), plus representative ad-hoc seeds:

| Check | Fail if |
|-------|---------|
| Loads / starts | Crash, black screen, missing spawn |
| Lap completable | Stuck geometry, invisible walls, broken checkpoints |
| Cross-section | Missing grass or wrong wall type (tires in corners, concrete on straights) |
| AI | Off-track, stalled, rubber-band that prevents clean wins |
| Rewards | Wrong/missing CHF; stars only where cup expects |
| Performance | Unplayable hitch on target desktop/browser |

Run unit/smoke tests (`npm test`) **and** browser checks. Never claim “regression green” without listing which level IDs were run and that the server+browser smoke passed.

## 3) Graphics consistency

Against Asphalt-Comic (`reference.png` / style bible), judged from **browser screenshots**:

- Cel-shade, thick outlines, flat bold colors — not photoreal / neon-purple / diorama / low-poly
- Asphalt vs grass vs tire wall vs concrete **instantly** distinguishable (WebGL; 2D-Fallback may be flatter — still readable zones)
- Damage stages + **heal FX** readable when in race
- Stickers/livery sit flat on paint; cosmetics never look like stat buffs
- UI chrome matches game art language

## 4) UX verification

Screens from concept §9 must exist and flow cleanly **in the browser**:

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
- Freier Modus / Ad-hoc clearly secondary to Cup career  
- **Controller / tablet** paths remain reachable (touch controls visible on narrow viewports)

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
- Review skipped server+browser verification

## Report format

```markdown
# Review: <scope>
**Build / branch:** …
**Server:** http://127.0.0.1:5173/ (started: yes/no)
**Browser:** smoke steps run + brief result
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
- Server + browser: …
- Doability: …
- UX: …
- Graphics: …
- Level regression: … / … passed
- Concept: …
```

Severity: **Blocker** = unshippable for target player or breaks levels/art/UX badly; **Major** = wrong vs concept or painful; **Minor** = polish.
