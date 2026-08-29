---
name: level-editor
description: >-
  Designs, authors, validates, and generates Crash Circuit race tracks and level
  data (cups, free mode, ad-hoc seeds). Always use when creating or editing
  levels, tracks, segments, obstacles, spawns, AI racing lines, cup progression,
  procedural/ad-hoc tracks, track physics zones (asphalt/grass/wall), or files
  under levels/ or tracks/.
---

# Level Editor (Crash Circuit)

Read this skill before creating or changing any track/level. Concept source: `CONCEPT.md` §§4.4–4.6, §8. Art must follow `.cursor/skills/asphalt-comic-art/` when visuals are involved.

**Core fantasy reminder:** Levels serve **fast tuned racing**. Contact is spice. Layouts reward clean lines; grass/uneven/walls punish sloppy driving.

For segment catalog, JSON schema, and cup templates see [track-spec.md](track-spec.md).

## Non-negotiable track cross-section

Every driveable edge must layer:

```
Asphalt (full speed) → Grass (speed penalty) → Wall
```

| Zone | Rules |
|------|--------|
| **Asphalt** | Racing surface; place uneven patches / oil / props here |
| **Grass** | Always present outside asphalt; slows car; good suspension **reduces but never removes** penalty |
| **Wall** | **Tire** walls in **corners**; **concrete** on **straights** / non-corner edges |

Do not omit grass. Do not put concrete as the default in hairpins. Do not put tire walls along long straights unless thematically justified as an on-track obstacle (props), not as the outer barrier.

## Obstacle palette (placeable)

| ID | Role | Notes |
|----|------|--------|
| `uneven` | Signature pacing | Chassis hop/wobble; suspension mitigates strongly |
| `oil` | Grip kill | Readable shiny puddle; suspension barely helps |
| `tire_stack` | On-track bounce | Light damage; not the same as outer tire **wall** |
| `concrete_barrier` | Hard on-track block | Medium damage |
| `barrel` | Moving hazard | Optional; keep rare |
| `ramp` | Jump | Landing needs grip; suspension stabilizes |

Obstacles support racing — they are not a demolition derby. Prefer 1–2 signature obstacle types per theme.

## Level kinds

| Kind | Purpose |
|------|---------|
| `cup` | Handcrafted career race (~10 per vehicle class) |
| `free` | Unlocked track selectable in Freier Modus |
| `training` | Same layouts as cup, all selectable, solo / no ranking |
| `adhoc` | Segment-built from seed + parameters |

### Cup beat (per class, ~10 races)

1. Intro — few obstacles, teach class  
2–4. Standard theme variations  
5. Wide tempo track — overtakes + first uneven  
6–7. Obstacle focus (oil / buckel / ramps)  
8. Night/rain — grip down (theme skin)  
9. Boss — stronger AI + one layout trick  
10. Finale — longer lap, mixed AI classes  

### Ad-hoc generation rules

- Build from segments only (see [track-spec.md](track-spec.md)): straight, curve_l/r, s_curve, uneven_field, choke  
- **Prefer one turn direction** for closed ovals so the centerline never self-intersects  
- Always close a valid loop with start/finish + AI path  
- Always apply asphalt→grass→wall (tire in curves, concrete else)  
- Expose seed string (e.g. `A7F2`) for share/replay  
- Parameters: length, curviness, uneven_ratio, grass_width, theme  
- Validate with `trackSelfIntersects`; if true, regenerate or fall back to a plain oval  
- Crossings require an authored **bridge** + section **wall** (not in ad-hoc MVP)

## Authoring workflow

```
Task Progress:
- [ ] 1. Pick kind (cup / free / adhoc) + theme + target class/cup index
- [ ] 2. Define lap length & rhythm (straight–corner–recovery)
- [ ] 3. Draw centerline / segments; auto-attach grass + correct walls
- [ ] 4. Place spawn grid, checkpoints, AI racing line + pit/respawn points
- [ ] 5. Place obstacles sparingly; verify suspension/grass teaching moments
- [ ] 6. Write level JSON per track-spec.md
- [ ] 7. Run validation checklist below
- [ ] 8. If art/mockup: asphalt-comic-art skill + reference.png
- [ ] 9. `npm run docs:cheatsheets` (update `TRACKS` in `scripts/dump-mesh-cheatsheets.mjs` if you added a cup)
```

## Validation checklist

- [ ] Cross-section asphalt → grass → wall everywhere driveable
- [ ] Corner outer barriers = tires; straight outer barriers = concrete
- [ ] **Centerline does not self-intersect** (no figure-8 without bridge + section wall)
- [ ] **Racing corridor clear** — solid obstacles at verge, not blocking the obvious middle path
- [ ] Passable props are low + high-contrast (rumble/oil); tall props collide and look blocking
- [ ] Start/finish + ≥1 checkpoint sector; AI polyline stays on asphalt
- [ ] **Start/finish seam** — approach and departure heading align (no U-turn / spur outside the loop)
- [ ] Respawn points near track, not inside walls
- [ ] Intro cups are not obstacle gauntlets
- [ ] Uneven sections leave a clean racing line (not forced pure chaos)
- [ ] No “ram-only” arena as a main cup race
- [ ] Theme has ≤2 signature obstacle types
- [ ] German `displayName` / short blurb for UI
- [ ] CHF/rewards fields only if cup/career (free may omit stars)

## Output locations

- Handcrafted: `levels/cups/<class>/<id>.json`
- Shared free roster: `levels/free/<id>.json`
- Ad-hoc is runtime; store seeds under `levels/adhoc/seeds.json` if persisted

When implementing editor UI or generator code, keep this skill’s rules as the source of truth for legality — not ad-hoc exceptions in code comments.

**In-game overlay:** **F8 Strecken-Editor** places kit props on a live cup mesh and copies an F8 patch; it does not replace this skill’s legality (asphalt → grass → wall, no self-cross). Bake overlay placements into scenery/JSON in a later step when an agent applies the patch.

**Cheat sheets:** cup layout, theme kit, or obstacle changes must refresh `.cursor/cheatsheets/track-*.md` via `npm run docs:cheatsheets` in the same step.
