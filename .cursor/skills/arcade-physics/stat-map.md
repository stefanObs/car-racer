# Eigenschaften → arcade forces

Keep this table matched to `src/sim/vehicle.ts` + `mergeStats`. Update in the **same** change as code or CONCEPT §4.3.

## Core pillars (garage bars)

| Eigenschaft | Stat field | Primary code effect |
|-------------|------------|---------------------|
| Beschleunigung | `accel` | Throttle force: `BASE_ACCEL * accel` |
| Tempo | `topSpeed` | Cap: `BASE_TOP * topSpeed` (× surface, damage, catch-up) |
| Grip | `grip` | `gripPullRate` — higher = less slip; landing slip mitigation |
| Handling | `handling` | `yawRateFor` turn authority; part of `brakeForceFor` |
| Federung | `suspension` | `zones` bump/grass; softer launch/land in `stepJump` |
| Panzerung | `armor` | Hit severity via `applyHit` (not locomotion) |
| Gewicht | `mass` | `resolveContact` impulse share; obstacle rebound; wider turn / slightly weaker brakes |

## Bonuses (not full bars)

| Bonus | Source | Effect |
|-------|--------|--------|
| Nitro | class `nitroBonus` + `nitro_kit` | `nitroForceFor`; speed headroom while boosting; faster drain |
| Bremsen | `better_brakes` → `brakeBonus` | Multiplies `brakeForceFor` |
| Ram | `spike_bumper` → `ramBonus` | Stronger contact impulse + damage share |
| Gras | class / synergy `grassMitigation` | `surfaceAt` grass speed/grip soften (never full remove) |

## Surfaces & air

| Situation | Behavior |
|-----------|----------|
| Asphalt | Full stats |
| Gras | Speed + grip down; Federung mitigates only |
| Öl | `passableObstacleMods` gripMul crash |
| Uneben / rumble | bump wobble; Federung damps |
| Schanze (`ramp`) | `rampLaunch` → `stepJump` airtime |
| Airborne | Weak steer/throttle/brake; tiny grip pull; skip wall/obstacle solid until land |

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
- Low Grip slips more than high Grip at matched Handling/Masse
- Blitz yawRate > Bunker at same speed
- Light car displaces more than heavy on head-on contact
- Nitro > throttle-only; Hot Rod nitro force > stock 0 bonus
- Ramp / `stepJump` sets `y`/`vy` then lands
