---
name: arcade-physics
description: >-
  Owns Crash Circuit arcade driving physics: Eigenschaften scaling, grip/slide,
  handling turn circle, mass contact shove, Schanze jumps, nitro, brakes, walls,
  and surfaces. Use when changing vehicle sim, race feel, car stats→forces,
  collision impulse, jumping/landing, nitro boost, or evolving driving physics.
---

# Arcade physics (Crash Circuit)

**Source of truth for rules:** `CONCEPT.md` §§4.2–4.7  
**Implementation home:** `src/sim/vehicle.ts` (+ `zones.ts`, `damage.ts`, `catchup.ts`, `race.ts`)  
**Feel lock tests:** `tests/arcade-physics.test.ts`, `tests/arcade-feel.test.ts`, wall/impact suites

This skill is the **physics owner**. Cursor subagent: `.cursor/agents/arcade-physics.md`. Own the feel, evolve it deliberately, keep Eigenschaften mapping honest. Do not invent parallel physics docs outside this skill + CONCEPT.

**Do not** split `CarState` or rewrite `vehicle.ts` because the file is large — see `.cursor/skills/architecture/`. Also read when coding: `.cursor/skills/clean-programming/` + architecture. When rules change: `.cursor/skills/game-concept/`. Player-facing feel: `.cursor/skills/review-testing/` (server + browser).

Detailed stat→force table: [stat-map.md](stat-map.md). Decision log: [evolution.md](evolution.md).

## Hard invariants (change only with explicit user OK + CONCEPT bump)

1. **Arcade, not sim** — Gewicht + Grip + Impuls; no realistic tire/drift model (no Pacejka)
2. **Eigenschaften drive forces** — Beschleunigung, Tempo, Grip, Handling, Masse, Federung, Panzerung, Nitro (+ `brakeBonus` from Teile) scale behavior; cosmetics grant **no** stats
3. **Coast on lift** — releasing throttle rolls out; no abrupt dump
4. **Front-steer path** — nose yaws with Handling; velocity follows behind (rear stable under grip); **no tank pivot at standstill**; turn authority scales with forward speed
5. **Brake → reverse** — brake scrub to stop, then held brake drives reverse along −heading (lower reverse cap); throttle exits reverse; nitro forward-only
6. **Slide when grip is short** — yaw from Handling; lateral pull from Grip; **arcade outside-drift** (nose leads, velocity seeks ~26–40° slip) via Drift hold **or** high-speed oversteer
7. **Mass decides shove** — light cars get pushed / rebound more; heavy hold the line; car–car also uses closing speed, hit direction, and Bug/Flanke/Heck zone (CONCEPT §4.5)
8. **Schanzen = real airtime** — `y`/`vy`; landing needs Grip + Federung
9. **Grass penalty never removed** — Federung / grassMitigation only mitigate (`zones.ts`)
10. **Walls bounce + cooldown damage** — no per-frame grind spam (`IMPACT_DAMAGE_COOLDOWN`); hits still KO quickly (Low Damage setting restores pre–Fast-KO hit amounts)
11. **Ramming is spice** — contact impulse + light damage; no ram-primary scoring
12. **Nitro punches** — rising-edge kick + strong continuous shove + clear speed headroom (forward); start only at ~35% tank; slow refill; no crumb spray
13. **Delivery** — version → commit `master` → push

## Module map

| Concern | File / symbol |
|---------|----------------|
| Step integration | `stepCar` in `src/sim/vehicle.ts` |
| Turn circle / front-steer | `yawRateFor` (Handling, Masse, forward speed; no standstill pivot) |
| Brake / reverse | `brakeForceFor` + reverse thrust after stop (held brake) |
| Nitro force | `nitroForceFor` (`nitroBonus`, damage mult; forward-only) |
| Lateral grip | `gripPullRate` → slide (cut by `drift`); rear follows nose |
| Arcade drift | `driftIntent` → `car.drift`; mini-turbo on exit |
| Nitro | `nitroWantsBoost` + `nitroKickFor` (edge) + `nitroForceFor` + headroom |
| Jump / land | `stepJump`, `isAirborne`, ramp via `passableObstacleMods` |
| K.O. respawn | `KO_RESPAWN_SECONDS` + `placeOnRacingLine` |
| Car–car | `resolveContact` (mass + closing speed + direction/zone per CONCEPT §4.5; `ramBonus`) |
| Obstacles | `resolveObstacles` (infinite-mass bounce × mass) |
| Walls | `applyWallBounce` |
| Surfaces | `src/sim/zones.ts` `surfaceAt` |
| Damage mults | `src/sim/damage.ts` |
| Catch-up | `src/sim/catchup.ts` |
| Stats merge | `src/data/parts.ts` `mergeStats` |
| Car bases | `src/data/cars.ts` |
| Visual height | `RaceRenderer.sync` uses `car.y` / `car.vy` |

Keep helpers **pure and exported** so tests can lock feel without full races.

## Evolve physics (deliberate)

Physics may change — only through an explicit evolution step:

```
Task Progress:
- [ ] 1. Trigger: playtest note, user ask, balance pain, or CONCEPT change
- [ ] 2. Map to CONCEPT §4.x — if rule missing/wrong, evolve CONCEPT first (game-concept skill)
- [ ] 3. Name Eigenschaften affected (which bars / Teile bonuses)
- [ ] 4. Write or extend failing feel test in tests/arcade-physics.test.ts (or sibling)
- [ ] 5. Change the smallest clear layer in src/sim/ (prefer helpers over stepCar spaghetti)
- [ ] 6. Prove car-class diffs still read (Blitz ≠ Bunker ≠ Donnerbüchse)
- [ ] 7. Log decision in evolution.md; bump CONCEPT dokumentstand if rules moved
- [ ] 8. Player-facing: review-testing (server + browser / Playwright race smoke)
- [ ] 9. Version → commit master → push
```

**Never** leave a new physics rule only in code comments.

## Change recipes

### Tune a constant (BASE_TOP, GRAVITY, …)
1. Adjust named export in `vehicle.ts`
2. Update / add arcade-physics assertion that would fail on the old value
3. Note in evolution.md if player-noticeable

### Remap an Eigenschaft
1. Update [stat-map.md](stat-map.md) + CONCEPT §4.3 in the same change
2. Implement in the helper that owns that force
3. Lock with a test that compares two cars or part on/off (e.g. `better_brakes`)

### New force / air / contact behavior
1. CONCEPT rule first (testable for ~10+)
2. Prefer new exported helper + call from `stepCar` / `resolveContact`
3. Render only if state already exists (`y`) or add field with createCarState defaults
4. Sync review checklists if HUD/feel expectations change

### Balance one car class
1. Prefer `src/data/cars.ts` / parts deltas — not one-off branches in `stepCar`
2. Tests: that class vs another on the axis you changed (accel, slip, shove, nitro)

## Anti-patterns

- Tank controls (velocity glued to heading / spot-turn at rest) or full tire sim
- Ignoring Masse on contact / obstacle bounce
- Fake jump via render hop only (must be `y`/`vy`)
- Silent CONCEPT drift (“code feels better” without evolution step)
- Mixing large unrelated refactors into a physics feel change
- Breaking coast / wall cooldown / grass-never-removed / front-steer / brake→reverse invariants

## Parent agent / Task delegation

When the user asks to change driving feel, physics, grip, nitro, jumps, or car shove:

1. **Read this skill** (and `stat-map.md` if remapping)
2. For large physics evolutions, spawn a focused Task (`generalPurpose`) whose prompt includes: read this skill + CONCEPT §4 + run `npm test -- tests/arcade-physics.test.ts tests/arcade-feel.test.ts`
3. Always pair with clean-programming; finish with review-testing if players feel it

## Definition of done

- [ ] CONCEPT §4 still true (or deliberately evolved + logged)
- [ ] Eigenschaften mapping in stat-map.md matches code
- [ ] `tests/arcade-physics.test.ts` (+ feel/wall/impact as needed) green
- [ ] No sim-creep; arcade invariants held
- [ ] Versioned, committed on `master`, pushed
