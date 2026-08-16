# Käferkraft `Waist` anchor picker

Pick **front + rear** IDs per side. Mesh space, meters, **nose −X**. Left `z ≈ −0.49…−0.60`, right `z ≈ +0.53…0.64` (picks + 1.5× rail width outboard).

![Käferkraft Waist anchors](./kaeferkraft-waist-anchors.png)

Red ring on the sheet is a **candidate grid** — live poles use BodyPaint garage picks (caps buried 8 cm into the hull):

| Side | Front (nose −X) | Rear |
| --- | --- | --- |
| Left −Z | (−0.551, 1.029, −0.490) | (0.574, 1.061, −0.603) |
| Right +Z (BodyPaint + 1.5× width toward viewer-right) | (−0.534, 1.001, 0.529) | (0.553, 1.015, 0.639) |

| ID | x | y | z | Meaning |
| --- | --- | --- | --- | --- |
| `LF1` / `RF1` | -0.55 | 0.96 | ±0.55 | deeper into teal cowl |
| `LF2` / `RF2` | -0.32 | 0.96 | ±0.55 | previous front |
| `LF3` / `RF3` | -0.32 | 0.72 | ±0.55 | lower sill / hip |
| `LF4` / `RF4` | -0.32 | 1.15 | ±0.55 | higher belt / A-pillar |
| `LR1` / `RR1` | 0.40 | 0.85 | ±0.55 | seat-back foot |
| `LR2` / `RR2` | 0.58 | 0.96 | ±0.55 | previous rear joint |
| `LR3` / `RR3` | 0.58 | 1.20 | ±0.55 | rear hoop mid |
| `LR4` / `RR4` | 0.90 | 0.90 | ±0.55 | rear deck behind seats |

Live poles: `Waist` / `WaistToFrontTop` in `public/models/parts/kaeferkraft-reinforced_frame.glb`. Rebuild with `node scripts/bake-kaeferkraft-pole-frame.mjs`.

Rebuild picker image: `node scripts/overlay-kaeferkraft-waist-anchors.mjs`