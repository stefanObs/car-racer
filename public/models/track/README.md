# Track kit GLBs

Asphalt-Comic wall and harbor scenery modules. Collision stays on the spline ribbon (visuals may overhang).

| File | Use |
|------|-----|
| `tire-wall.glb` | Corner outer walls + `tire_stack` obstacles |
| `concrete-wall.glb` | Straight outer walls + `concrete_barrier` obstacles |
| `fence.glb` | Chain-link panel on top of concrete |
| `crane.glb` | Harbor / city gantry |
| `container.glb` | Optional harbor stacks (runtime tint); primitive fallback if absent |
| `tank.glb` | Optional silo; primitive fallback if absent |

Rebuild: `npm run track:bake-tripo` (needs gitignored `assets/tripo-out/track/`).
See [SOURCES.md](./SOURCES.md).
