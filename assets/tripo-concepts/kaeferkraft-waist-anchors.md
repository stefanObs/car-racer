# Käferkraft `Waist` anchor picker

Pick **front + rear** IDs per side. Mesh space, meters, **nose −X**. Left `z = −0.55`, right `z = +0.55`.

![Käferkraft Waist anchors](./kaeferkraft-waist-anchors.png)

Red ring = **now**. Orange = candidate. Example: `LF3` + `LR2`.

| ID | x | y | z | Meaning |
| --- | --- | --- | --- | --- |
| `LF1` / `RF1` | -0.55 | 0.96 | ±0.55 | deeper into teal cowl |
| `LF2` / `RF2` | -0.32 | 0.96 | ±0.55 | **now** (front) |
| `LF3` / `RF3` | -0.32 | 0.72 | ±0.55 | lower sill / hip |
| `LF4` / `RF4` | -0.32 | 1.15 | ±0.55 | higher belt / A-pillar |
| `LR1` / `RR1` | 0.40 | 0.85 | ±0.55 | seat-back foot |
| `LR2` / `RR2` | 0.58 | 0.96 | ±0.55 | **now** (rear joint) |
| `LR3` / `RR3` | 0.58 | 1.20 | ±0.55 | rear hoop mid |
| `LR4` / `RR4` | 0.90 | 0.90 | ±0.55 | rear deck behind seats |

Live poles: `Waist` / `WaistToFrontTop` in `public/models/parts/kaeferkraft-reinforced_frame.glb`. This picker does not move them until you name IDs.

Rebuild image: `node scripts/overlay-kaeferkraft-waist-anchors.mjs`
