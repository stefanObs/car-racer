# Track kit provenance

All modules are Tripo3D image-to-mesh from Asphalt-Comic concepts in `assets/tripo-concepts/track-*.png`. Authoring-time only — the game ships the baked GLBs under this folder (no Tripo at play time).

| Prop | Concept | Bake |
|------|---------|------|
| Tire wall | `track-tire-wall.png` | `npm run track:bake-tripo` |
| Concrete wall | `track-concrete-wall.png` | same |
| Fence | `track-fence.png` | same |
| Crane | `track-crane.png` | same |
| Container | `track-container.png` | optional — primitive fallback if GLB absent |
| Tank | `track-tank.png` | optional — primitive fallback if GLB absent |

Style lock: `.cursor/skills/asphalt-comic-art/reference.png`.
