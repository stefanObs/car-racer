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
| Nitro | class `nitroBonus` + `nitro_kit` | Rising-edge `nitroKickFor` + strong `nitroForceFor` + ~42%+ headroom; reduced drag while boosting; **forward-only** |
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
| Schanze (`ramp`) | `rampLaunch` → `stepJump` airtime |
| Airborne | Weak steer/throttle/brake; tiny grip pull; no drift; skip wall/obstacle solid until land |

## Contact

| Pair | Model |
|------|--------|
| Car–car | Separate by mass; impulse along normal from closing speed × restitution × ram |
| Car–obstacle | Fixed ≈ ∞ mass; rebound scales `1/mass` |
| Car–wall | Reflect outward velocity; mass affects bounce; damage on cooldown |

## Test anchors

Prefer asserting **relative** class/part diffs over absolute magic numbers:

- Blitz accel ≫ Bunker
- `better_brakes` stops shorter mid-brake window
- Low Grip → higher `car.drift` than high Grip
- Blitz yawRate > Bunker at same **forward** speed
- Standstill + full steer → near-zero yaw (no tank pivot)
- Hold brake from speed → stop → reverse along −heading; throttle recovers forward
- Light car displaces more than heavy on head-on contact
- Nitro kick in one frame; sustained nitro ≫ throttle and above stock top; no nitro shove in reverse
- Hard steer at speed → `drift > 0.45` and readable slip
- Ramp / `stepJump` sets `y`/`vy` then lands
