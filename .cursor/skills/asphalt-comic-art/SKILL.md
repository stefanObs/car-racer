---
name: asphalt-comic-art
description: >-
  Enforces Crash Circuit Asphalt-Comic art direction (cel-shaded, thick outlines,
  bold flat colors). Always use when generating images, concept art, UI mockups,
  vehicle or track assets, VFX, moodboards, style prompts, HUD/menu look, CSS
  styling that defines the game look, or any visual for this game — including
  GenerateImage calls.
---

# Asphalt-Comic Art (Crash Circuit)

**Locked style:** Option 1 — Asphalt-Comic. Do not switch to diorama, neon-tuner, poster, or low-poly unless the user explicitly overrides.

**Canonical reference:** Read [reference.png](reference.png) before generating or judging art. Repo copy: `assets/art-style/asphalt-comic-reference.png`.

For palette hex and prompt blocks, see [style-bible.md](style-bible.md).

## Mandatory look

- Cel-shaded / hard shading (few value steps, no soft PBR)
- Thick dark outlines on cars and key props
- Bold flat local colors; clear silhouettes
- Cartoon-hard, readable, ages 10+ — not chibi, not photoreal materials
- Chase or slightly elevated rear camera for racing shots
- Sunny or clear daylight as default; themes tint background only

## Vehicle category fidelity (required)

Cars must **read like real vehicles of their class**, not generic toy blobs:

| Class (game) | Real-world cue (aspire to) |
|--------------|----------------------------|
| Sportwagen (Blitz) | Modern coupe / GT proportions — low nose, cabin set back, wide rear haunches |
| Pick-up (Bison) | Real pickup — separate cab, open bed, upright greenhouse, higher ride |
| Buggy | Open/off-road buggy — roll cage, short wheelbase, fat tires, exposed |
| Hot Rod | Classic hot rod — long hood, chopped cabin, big rear tires, loud stance |
| Panzerwagen | Armored truck / APC-lite — boxy armor, heavy wheels, blunt nose |

Still **Asphalt-Comic**: flat paint, outlines, 2–3 shade steps. **Not** photoreal chrome/PBR.

**Engine-renderable:** prefer clear primary volumes (body, cabin, wheels, 1–2 signature props) that three.js toon meshes can match. Avoid tiny panel gaps, soft fillets, or photo detail that cannot ship in-game.

**Target sheet:** [car-category-targets.png](../../../assets/art-style/car-category-targets.png) — use when designing or judging car meshes/overlays.

## Track readability (always)

```
Asphalt (full speed) → Grass (slower) → Wall
Walls: tire stacks in corners (black/orange) · concrete on straights (gray)
```

Uneven track = visible chassis bounce/wobble. Suspension-heavy cars look calmer.

## Game VFX language

| State | Visual |
|-------|--------|
| Damage light | dents, light smoke |
| Damage heavy | heavy smoke, sparks, slight lean |
| Healing | brief repair sparks, smoke fading, body “settling” |
| Nitro | short orange/cyan trail — no purple bloom |
| Stickers | flat decals (flames, symbols) on paint — cosmetic only |

## GenerateImage workflow

1. Read `reference.png`.
2. Start the prompt with the locked style lock from [style-bible.md](style-bible.md).
3. Pass `reference.png` via `reference_image_paths` when the tool supports it.
4. Describe subject + track zones + camera; keep outlines and flat color explicit.
5. Reject/regenerate if the result looks photoreal, low-poly, neon-purple, or toy-diorama.

## Do / Don't

**Do:** thick outlines, flat fills, hard shadows, readable grass vs asphalt vs wall, sticker-friendly car sides, **category-faithful silhouettes** (real-world class cues).

**Don't:** photoreal materials, purple/magenta glow defaults, cream+terracotta poster look, soft AO-heavy realism, voxel/low-poly, miniature flock grass, UI clutter unless asked, **generic same-blob cars** for different classes.

## In-engine / CSS assets

Match the same language: flat fills, 2–3 shade steps, dark stroke on sprites/meshes, high-contrast track materials. Prefer decals over complex texturing.
