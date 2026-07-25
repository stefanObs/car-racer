# Review & Testing Checklists

Use with [SKILL.md](SKILL.md). Tick items; note failures with repro.

## 0. Server + browser (mandatory)

- [ ] Dev server started (`./start.sh` or `npm run dev`) **or** `npm run test:e2e` (Playwright starts it)
- [ ] Port free via `npm run free:dev` if needed — **never** `pkill -f vite` (kills the agent)
- [ ] URL opens (default http://127.0.0.1:5173/)
- [ ] Browser snapshot/screenshot: Hauptmenü visible (Crash Circuit + Cup / Freier Modus / Garage)
- [ ] Not stuck on blank/dark screen or unexplained boot-error
- [ ] Click through at least: Menü → Cup or Garage → back
- [ ] If racing was in scope: start one race; HUD + track/canvas visible
- [ ] Note WebGL vs `2D-Fallback` if shown
- [ ] Automated smoke: `npm run test:e2e` green when changing boot/menu/race entry

## A. Doability (10+ player)

- [ ] German labels make sense without slang walls of text
- [ ] Can start a race from cold boot in ≤3 clicks/keys after first tutorial moment
- [ ] Steering/gas/brake/nitro discovered without a manual
- [ ] Knows why they got slower (grass / uneven / damage) from visuals alone
- [ ] Heal-over-time is noticeable
- [ ] After K.O., understands they are back and can still place
- [ ] Garage: can equip a part and see both pro and con
- [ ] Synergy/combo name appears when relevant and is understandable
- [ ] Winning feels earned; losing after mistakes feels fair
- [ ] 7–15 min session can unlock or buy something meaningful (CHF pacing / cup unlock)
- [ ] Full session doable on **controller** (menus + race, visible focus)
- [ ] Full session doable on **tablet** (touch race controls + menus, landscape, large targets)
- [ ] Menu focus moves with D-Pad / arrows; A/Enter confirms; B/Esc backs (not only mouse)

## B. UX by screen

### Hauptmenü
- [ ] Cup / Freier Modus / Ad-hoc / Garage / Einstellungen present and labeled
- [ ] Focus order / default CTA points at Cup for new players

### Cup-Karte
- [ ] Nodes readable; locked vs open clear
- [ ] Stars / recommendation visible
- [ ] Back navigation safe

### Freier Modus / Ad-hoc
- [ ] Track list or seed field works
- [ ] Laps / AI options understandable
- [ ] Seed shown for ad-hoc share/replay

### Garage
- [ ] Car turntable / preview
- [ ] Parts list with Vor- & Nachteil
- [ ] Stats bars update live
- [ ] Combo callout when tags match
- [ ] Paint + Aufkleber editor; cosmetics clearly non-power
- [ ] Prices in CHF

### Renn-HUD
- [ ] Place, lap, mini-map
- [ ] Damage + heal hint
- [ ] Nitro meter
- [ ] Style popup uses CHF
- [ ] Does not hide apex / upcoming wall type

### Ergebnis
- [ ] Podium / places
- [ ] CHF breakdown (base + style − malus)
- [ ] Next race / Garage CTAs

## C. Graphics consistency

- [ ] Matches Asphalt-Comic reference (outlines, flat color, hard shade)
- [ ] No purple glow / photoreal / diorama / low-poly drift
- [ ] Grass ≠ asphalt ≠ tire wall ≠ concrete
- [ ] Uneven surfaces read as buckel/wobble opportunity
- [ ] Damage and heal FX on-model and readable
- [ ] Stickers aligned; no z-fight / stretch
- [ ] Menus share the same visual language as race view

## D. Per-level regression card

Copy per level ID:

```
Level: <id>  Theme: <theme>  Kind: cup|free|adhoc
- [ ] Load / spawn / heading OK
- [ ] Checkpoints count laps correctly
- [ ] Finish triggers results + CHF
- [ ] Grass band present; penalty feels real
- [ ] Corner barriers = tires; straights = concrete
- [ ] Obstacles match cup beat (intro = sparse)
- [ ] AI finishes; no soft-lock
- [ ] Clean drive can lead (catch-up not oppressive)
- [ ] No major frame drops
Result: pass / fail — notes:
```

## E. Full regression sweep

1. Enumerate all `levels/cups/**/*.json` and `levels/free/**/*.json`
2. Run automated smoke if available
3. Fill a regression card for each (or batch by theme if unchanged and previously green — still re-run **changed** levels 100%)
4. Ad-hoc: run ≥3 seeds including `levels/adhoc/seeds.json` examples + one random
5. Attach ID list to the review report

## F. Concept red lines

- [ ] No dedicated ram control or ram score as main goal
- [ ] Suspension reduces grass penalty but leaves a remainder
- [ ] Damage regenerates with FX
- [ ] Player-facing money is CHF
- [ ] Cosmetics ≠ stats
- [ ] Core loop still “fast tuned racing”
- [ ] Controller + tablet supported for race and menus (not deferred)
