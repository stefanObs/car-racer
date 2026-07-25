# Track Spec (Crash Circuit)

Machine-oriented rules for level files and the ad-hoc segment generator.

## Themes

| `theme` | Signature ideas (1–2 obstacles) |
|---------|----------------------------------|
| `harbor` | containers as blockers, wide straights |
| `canyon` | choke points, long drops visually outside walls |
| `city` | uneven cobble patches, construction barriers |
| `scrapyard` | barrels, tire_stack props |
| `mountain` | hairpins, tire walls dominate corners |
| `beach` | wider grass risk, mild uneven sand bleed |
| `factory` | uneven_field plates, concrete_barrier |

Always keep asphalt / grass / wall materials readable (Asphalt-Comic palette).

## Segments (ad-hoc + editor primitives)

| `type` | Params (typical) | Outer wall default |
|--------|------------------|--------------------|
| `straight` | `length`, `width` | `concrete` |
| `curve_l` / `curve_r` | `radius`, `angleDeg`, `width` | `tire` |
| `s_curve` | `length`, `amplitude`, `width` | `tire` on bends |
| `uneven_field` | `length`, `intensity` (0–1) | inherit from neighbors |
| `choke` | `length`, `width` (narrower) | `concrete` or `tire` if curved |

Generator stitches segments into a closed loop; samples grass width from level params.

**No self-cross:** centerline must not intersect itself. Ad-hoc uses consistent `curve_r` corners. A future bridge segment may allow over/under only with walls that block the wrong deck.

## Obstacle clarity

| Type | Passable? | Height cue |
|------|-----------|------------|
| `concrete_barrier` / `tire_stack` | **No** — solid collision | Tall (~1m+), yellow/tire markings |
| `uneven` rumble | **Yes** — drive over | Low zebra strip |
| `oil` | **Yes** — drive through | Flat puddle + sheen; grip kill |

## Level JSON schema (handcrafted)

```json
{
  "id": "blitz_cup_01_hafenstart",
  "kind": "cup",
  "displayName": "Hafenstart",
  "description": "Kurze Einführungsrunde — Linie halten, Gras meiden.",
  "locale": "de",
  "theme": "harbor",
  "classCup": "sport",
  "cupIndex": 1,
  "laps": 3,
  "recommendedClass": "sport",
  "weather": "clear",
  "gripMultiplier": 1.0,
  "track": {
    "closedLoop": true,
    "asphaltWidth": 12,
    "grassWidth": 3,
    "centerline": [[0, 0], [40, 0], [60, 20]],
    "segments": [
      { "type": "straight", "length": 40, "width": 12 },
      { "type": "curve_r", "radius": 18, "angleDeg": 90, "width": 12 }
    ],
    "walls": {
      "rule": "tire_in_corners_concrete_on_straights"
    }
  },
  "obstacles": [
    { "type": "uneven", "position": [20, 0], "radius": 6, "intensity": 0.4 }
  ],
  "spawn": {
    "grid": [[-8, -2], [-8, 2], [-12, -2], [-12, 2]],
    "headingDeg": 0
  },
  "checkpoints": [
    { "id": "start", "position": [0, 0], "width": 14 },
    { "id": "s1", "position": [40, 0], "width": 14 }
  ],
  "ai": {
    "racingLine": [[0, 0], [40, 0], [60, 20]],
    "respawnPoints": [[5, 0], [45, 5]]
  },
  "rewards": {
    "currency": "CHF",
    "placePurse": [500, 350, 250, 150, 100, 80],
    "starsOnTop3": true
  }
}
```

Minimal required keys: `id`, `kind`, `displayName`, `theme`, `track` (with cross-section widths + path/segments), `spawn`, `checkpoints`, `ai.racingLine`.

## Ad-hoc request params

```json
{
  "seed": "A7F2",
  "length": "medium",
  "curviness": 0.55,
  "unevenRatio": 0.2,
  "grassWidth": 3,
  "theme": "city",
  "laps": 3
}
```

Generator must: close loop, assign walls by segment type, place start/finish, build AI line on asphalt center, optionally sprinkle `uneven` by `unevenRatio`.

## Cup file layout

```
levels/
  cups/
    sport/
      01_hafenstart.json
      ...
    pickup/
      ...
  free/
    hafenstart.json
  adhoc/
    seeds.json
```

`free/` entries may reference the same `id` as a cup track (shared asset) with `"kind": "free"`.

## Difficulty levers (editor)

| Lever | Soft | Hard |
|-------|------|------|
| `grassWidth` | narrow | wide (beach) |
| `uneven` intensity | 0.2–0.4 | 0.7+ |
| asphalt `width` | wide tempo | choke |
| `gripMultiplier` | 1.0 | 0.85 rain/night |
| obstacle count | 0–2 intro | 5–8 focus races |

Catch-up is **runtime**, not authored per waypoint — do not bake rubber-band into track JSON.
