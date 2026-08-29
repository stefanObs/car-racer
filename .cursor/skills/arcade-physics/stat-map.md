# Eigenschaften → arcade forces

Keep this table matched to `src/sim/vehicle.ts` + `mergeStats`. Update in the **same** change as code or CONCEPT §4.3.

## Core pillars (garage bars)

| Eigenschaft | Stat field | Primary code effect |
|-------------|------------|---------------------|
| Beschleunigung | `accel` | Throttle force: `BASE_ACCEL * accel` |
| Tempo | `topSpeed` | Cap: `BASE_TOP * topSpeed` (× surface, damage, catch-up); nitro headroom overrides |
| Grip | `grip` | `gripPullRate` + `driftIntent` ease (low Grip = easier powerslide); landing slip |
| Handling | `handling` | `yawRateFor` front-steer turn authority (scales with forward speed; no standstill pivot); part of `brakeForceFor` |
| Federung | `suspension` | `zones` bump/grass; softer launch/land in `stepJump` |
| Panzerung | `armor` | Hit severity via `applyHit` (not locomotion) |
| Gewicht | `mass` | `resolveContact` impulse; obstacle rebound; wider turn / slightly weaker brakes |

## Bonuses / arcade extras

| Bonus | Source | Effect |
|-------|--------|--------|
| Nitro | class `nitroBonus` + `nitro_kit` | Rising-edge `nitroKickFor` + strong `nitroForceFor` + ~42%+ headroom; start only at `NITRO_ENGAGE_MIN` (~35%); slow `NITRO_RECHARGE`; reduced drag while boosting; **forward-only** |
| Bremsen | `better_brakes` → `brakeBonus` | Multiplies `brakeForceFor` (scrub before reverse engage) |
| Ram | `spike_bumper` → `ramBonus` | Stronger contact impulse + damage share |
| Gras | class / synergy `grassMitigation` | `surfaceAt` grass speed/grip soften (never full remove) |
| Arcade-Drift | Drift hold **or** hard steer at high speed (oversteer) | Outside-drift: `driftTargetSlip` + `integrateVelocityFacing`; mini-turbo + brief grass top grace |
| Rückwärts | held `brake` after near-stop | Reverse thrust along −heading; reverse top ~35–50% forward; throttle exits reverse |

## Surfaces & air

| Situation | Behavior |
|-----------|----------|
| Asphalt | Full stats |
| Gras | Speed + grip down; Federung mitigates only |
| Öl | `passableObstacleMods` gripMul crash |
| Uneben / rumble | bump wobble; Federung damps |
| Schanze (`ramp`) | `rampLaunch` ≥ `RAMP_LAUNCH_GATE` → `stepJump` airtime (fringe does not punch) |
| Airborne | Weak steer/throttle/brake; tiny grip pull; no drift; skip wall/obstacle solid until land |

## Contact

| Pair | Model |
|------|--------|
| Car–car | CONCEPT §4.5: mass split + closing-speed impulse; **hit direction** (frontal / schräg / streifend) + **hit zone** (Bug / Flanke / Heck) bias shove, yaw torque, and damage; `ramBonus` spices impulse; soft separating contacts = separation only |
| Car–obstacle | Fixed ≈ ∞ mass; rebound scales `1/mass` |
| Car–wall | Reflect outward velocity; mass affects bounce; strong damage on cooldown; KO → 3 s on racing line |

## Test anchors

Prefer asserting **relative** class/part diffs over absolute magic numbers:

- Blitz accel ≫ Bunker; Donnerbüchse accel ≥ Blitz / Käferkraft
- Blitz topSpeed ≥ Donnerbüchse > Bison / Käferkraft ≫ Bunker
- Käferkraft grassMitigation ≥ Bunker > Bison > Blitz / Donnerbüchse (never full remove)
- Käferkraft suspension ≫ Bunker (Gras strong, hops still mediocre on Bunker)
- Armor: Bunker ≥ Käferkraft ≫ Blitz; Masse: Bunker ≥ Bison ≫ Käferkraft / Blitz
- Donnerbüchse nitroBonus unique peak among stock classes
- `better_brakes` stops shorter mid-brake window
- Low Grip → higher `car.drift` than high Grip
- Blitz yawRate > Bunker at same **forward** speed
- Standstill + full steer → near-zero yaw (no tank pivot)
- Hold brake from speed → stop → reverse along −heading; throttle recovers forward
- Light car displaces more than heavy on head-on contact
- Rear-hit shove on lighter car > side-hit yaw on same pair at matched closing speed (once §4.5 zones land)
- Frontal aggressor applies more impulse than streifend at same closing speed
- Nitro kick in one frame; sustained nitro ≫ throttle and above stock top; no nitro shove in reverse
- Nitro does not start below ~35%; holding an empty tank does not stutter-kick; refill is slower than a 10 s empty→full
- Hard steer at speed → `drift > 0.45` and readable slip
- Ramp / `stepJump` sets `y`/`vy` then lands
