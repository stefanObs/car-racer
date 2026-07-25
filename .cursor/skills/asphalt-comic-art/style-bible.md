# Asphalt-Comic Style Bible

## Style lock (prepend to every image prompt)

```
Crash Circuit Asphalt-Comic style: cel-shaded arcade racing art, thick dark outlines,
bold flat colors, hard shading (2–3 value steps), clear silhouettes, cartoon-hard not
photoreal, not chibi, not low-poly, not miniature diorama, not purple neon glow.
Match reference: sunny readable track, sportscar with comic outlines.
```

## Palette (default daylight)

| Role | Hex | Notes |
|------|-----|--------|
| Asphalt | `#4A4F57` | slight warm gray, painted not photo |
| Asphalt line | `#E8E2D6` | flat lane marks |
| Grass | `#3F8F3A` | obvious speed-penalty zone |
| Tire wall | `#1A1A1A` + `#E85D04` | corners only |
| Concrete wall | `#8B9098` | straights |
| Sky | `#5BA3D9` | simple gradient ok |
| Accent red (hero car example) | `#E03131` | swap per paint |
| Outline | `#1B1B1F` | thick on cars/props |
| Smoke | `#9AA0A6` | damage |
| Repair spark | `#FFE066` | heal FX |
| Nitro | `#FF7A18` / `#3DB9C7` | short trail only |

Theme variants (harbor, canyon, factory) recolor **backgrounds only**; keep asphalt/grass/wall language consistent.

## Camera

- Default race: chase, slightly elevated, car lower-center frame
- Garage: three-quarter studio turntable, same outline/shade language
- Avoid extreme widescreen lens distortion

## Prompt checklist

- [ ] Style lock paragraph included
- [ ] `reference_image_paths` → skill `reference.png` or `assets/art-style/asphalt-comic-reference.png`
- [ ] Asphalt / grass / wall called out when track visible
- [ ] No purple glow, no photoreal, no diorama, no low-poly
- [ ] Subject readable at a glance (silhouette test)

## Example subjects

- Hero red sportscar on harbor straight, grass + concrete wall
- Pick-up exiting corner beside tire wall, light damage smoke
- Garage turntable: car with flame stickers, cel-shaded
- Uneven buckel section: chassis visibly hopping
