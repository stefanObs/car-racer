# Arcade physics evolution

## Versioning

Physics **rules** live in `CONCEPT.md` §§4.2–4.7 (dokumentstand bump when rules move).  
Implementation notes and feel decisions log **here** (newest first).

## Decision log

### 2026-08-15 — Nitro min charge + slower refill

- Trigger: user — nitro resupplies too fast; cannot spray all the time
- RCA: `boosting = input.nitro && car.nitro > 0` let an empty tank refill a crumb, then rising-edge `nitroKickFor` every other frame while the button stayed down
- Decision: `NITRO_ENGAGE_MIN` 0.35 to start; continue while `nitroHeld` until empty; `NITRO_RECHARGE` 0.1 → 0.04 (~25 s empty→full)
- Tests: arcade-physics crumb-hold, recharge rate, continue-below-min

### 2026-08-15 — F4 Debug-Raster pad

- Trigger: user — debug track that is only a big plane + white grid to see turning
- Decision: Dev-only (F4). 1 km asphalt square, 5 m white raster, no AI/walls/countdown. Not in Cup/Free. Yellow +X / cyan +Z origin marks.
- Tests: `tests/debug-pad.test.ts`

### 2026-08-15 — Omegatal wall seal + tire bumper + corridor lock

- Trigger: user — holes in Omegatal walls; walls should bounce like bumpers; jumped a wall onto another stretch
- RCA: `planWallPlacements` skipped modules that failed dual-ribbon asphalt clearance → ~car-sized along gaps. `nearestOnTrack` could snap to a parallel far-along ribbon once you left the verge; `alongWeight>1` then froze `distanceAlong` on centerline vertices so progress never caught up. Physics walls are a lateral limit — tire restitution was a scrape, so holes + mild bounce felt like ghosting through.
- Decision: tile walls on this ribbon's wall line (nudge outward, never skip a stretch); hard `maxAlongGap` corridor (not a heavy alongWeight); tire walls restitution 0.88 / damp 0.78
- Tests: Omegatal along-gap seal; airborne hop stays on ribbon; Hafenstart along advances; tire bumper outbound vel

### 2026-08-15 — Schanze fringe launch steal

- Trigger: user — jumps no longer working
- RCA: `stepJump` fired at `rampLaunch > 0.12` (outer fringe) and set `y` airborne, so the car never received the full center punch; hops stayed ~1 m and clipped the tall Tripo wedge
- Decision: gate launch at `RAMP_LAUNCH_GATE` 0.6; scale ramp kits to `RAMP_COMIC_HEIGHT` 0.58 m so hops clear the mesh
- Tests: fringe must not launch; racing-line cup ramps peakY>2.2

### 2026-08-14 — Comic Schanze launch + float

- Trigger: user — jumps more extreme / comic
- Decision: launch `(10.5 + speed×0.38)×ramp`; `GRAVITY` 38→30; landing impact divisor 18→22 (less harsh slip for higher hops)
- Tests: arcade-physics ramp `vy>8` and peakY>2.2

### 2026-08-14 — v0.3.172 stronger trailing catch-up
- Trigger: user — cars behind P1 a bit faster so they can keep up
- Decision: `catchUpMultipliers` last-of-6 accel 1.18→1.30, topSpeed 1.06→1.12 (still linear by place; leader unchanged; ceiling < magnet)
- Tests: `tests/catchup.test.ts` + mvp catch-up bound

### 2026-08-14 — v0.3.150 Auto↔Auto-Bump impl (CONCEPT v3.75)
- Trigger: user — implement improved ram concept
- Decision: `contactHitZone` / `contactDirectionClass` / aggressor + `resolveContact` scales impulse by dir×zone, Heck forward shove, Flanke yaw kick, Spike stronger on aggressor nose; soft contacts still separation-only
- Tests: `tests/contact-bump.test.ts`

### 2026-08-14 — v3.75 Auto↔Auto-Bump (Masse × Speed × Richtung × Ort)
- Trigger: user — concept for car bumps by weight, direction, hit location, relative speed
- Decision: CONCEPT §4.5 expands arcade contact model: mass split, closing-speed hardness, frontal/schräg/streifend, Bug/Flanke/Heck effects + aggressor/victim; still spice, no ram button / no sim deform
- Impl follow-up: evolve `resolveContact` (+ yaw torque helpers); lock with feel tests
- CONCEPT dokumentstand → v3.75

### 2026-08-14 — v0.3.147 Phase C: pedal priority + high-speed coast
- Trigger: CONCEPT v3.74 polish
- Decision: brake wins over throttle when both pressed; mild extra coast above ~22 speed (still not abrupt dump)
- Tests: brake+gas slows vs gas-only

### 2026-08-14 — v0.3.146 Phase B: Front-Steer (no tank pivot)
- Trigger: CONCEPT v3.74 Front-Steer
- RCA: `yawRateFor` had `speedBuild` floor 0.4 → standstill spin-in-place
- Decision: bicycle-lite `min(1, speed/6.2)` (zero at rest); invert steer while reverse; mid/high-speed cut unchanged so drift paths stay stable
- Tests: standstill yaw≈0; crawl > stopped; reverse steer sign flips

### 2026-08-14 — v0.3.144 Phase A: Bremse→Rückwärts
- Trigger: CONCEPT v3.74 impl
- RCA (prior): brake only scrubbed inside `speed > ε`; grip pull to nose flipped any reverse velocity forward
- Decision: `wantsReverse` / `reverseAccelFor` / reverse top ~42%; face −heading while reversing; nitro forward-only; Hilfe + touch hint
- Tests: arcade-feel reverse cases

### 2026-08-14 — v3.74 Arcade Front-Steer + Bremse→Rückwärts
- Trigger: user — more realistic driving feel; front wheels turn / rear stable; hold brake → reverse after stop
- Decision: CONCEPT §4.2–4.3 — bicycle-lite front-steer (no tank pivot); brake scrubs then held brake reverses (~35–50% reverse cap); nitro forward-only; Kart outside-drift kept. No Pacejka. Impl follow-up: `yawRateFor` + reverse in `stepCar`.
- CONCEPT dokumentstand → v3.74

### 2026-08-14 — Kart outside-drift (natural slip pose)
- Trigger: user — drifting still feels unnatural; research Kart/outside-drift sources
- Sources: Mario Kart Wii TAS (IV can lag facing ~45° on outside-drift); MK outside- vs inside-drift guides (nose leads, path outside)
- RCA: outward lateral velocity feed *plus* pull-to-heading fought each other → chaotic slip; path yaw matched nose → grass/wall; MT snap + grass clamp ate exit pace
- Decision: `driftTargetSlip` / `integrateVelocityFacing` seek nose-inside / path-outside slip (cap ~40°); remove raw outward feed; near-zero grip pull while drifting; MT blends toward nose + `miniTurboGrace` top headroom; oversteer needs near-full stick
- CONCEPT §4.2 → outside-drift; dokumentstand v3.58

### 2026-08-13 — Softer post-drift slowdown
- Trigger: user — exit slowdown after drifting feels harsh
- RCA: slip scrub ramped up as `drift` fell (exit felt like a brake); exit lerp snapped grip back; drag relief ended too early
- Decision: gentler exit lerp; much softer lat scrub; drag relief while drift > 0.12; MINI_TURBO_KICK 8.5; feel tests lock ≥90% pace retention

### 2026-08-13 — v3.46 Oversteer auto-drift + accel/nitro retune
- Trigger: user — drift into hard corners; wrong drift pose; slower accel; stronger nitro
- RCA: lateral feed pushed inward (wrong side of heading); pose lean ignored real slip; BASE_ACCEL too snappy; nitro still mild; grip *deleted* lateral on exit → pace dump + wrong feel
- Decision: outward rear kick; lean from slip angle; auto-oversteer at high speed; BASE_ACCEL 15; BASE_NITRO 125 / kick 14; grip rotates velocity toward nose (preserve pace); mini-turbo realigns onto heading
- CONCEPT §4.2–4.3 → v3.46

### 2026-08-12 — v3.42 Dedicated Drift control
- Trigger: user — still no drifting after implicit powerslide
- RCA: drift was only hard-steer auto; no discoverable control like Kart R
- Decision: Drift action Strg/E · LB · Touch; `driftIntent` requires hold; HUD „DRIFT“; stronger slide feed
- CONCEPT §4.2–4.3 → v3.42

### 2026-08-12 — v3.40 Kart-style powerslide + punchy nitro
- Trigger: user — feel should be Mario Kart / Split Second; no real drifting; nitro lame
- RCA: grip pull too sticky (tank corners); nitro only mild continuous force under ~10% headroom
- Decision: `driftIntent` powerslide (hard steer + tempo), lateral feed + yaw open + mini-turbo; nitro rising-edge kick + BASE_NITRO 88 + ~32% headroom; Drift! style popup
- CONCEPT §4.2–4.3 → v3.40

### 2026-08-12 — Skill: arcade-physics subagent
- Trigger: user — implement a subagent that owns physics so it can evolve
- Decision: New skill `.cursor/skills/arcade-physics/` (SKILL + stat-map + this log). Wired into skills-router, AGENTS.md, glob rule. Owns evolve workflow; code stays in `src/sim/vehicle.ts`.
- CONCEPT: §4.2 authorship note → dokumentstand v3.39

### 2026-08-12 — v3.37 Arcade driving physics from Eigenschaften
- Trigger: user — proper arcade physics scaled by car Eigenschaften
- Decision: `vehicle.ts` maps Beschleunigung/Tempo/Grip/Handling/Gewicht/Federung/Nitro (+ brakeBonus) into arcade forces; Schanzen Y airtime; mass impulse contact; render uses `car.y`
- CONCEPT §§4.2, §4.3, §4.6 → v3.37
