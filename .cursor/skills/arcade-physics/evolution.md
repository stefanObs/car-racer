# Arcade physics evolution

## Versioning

Physics **rules** live in `CONCEPT.md` §§4.2–4.7 (dokumentstand bump when rules move).  
Implementation notes and feel decisions log **here** (newest first).

## Decision log

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
