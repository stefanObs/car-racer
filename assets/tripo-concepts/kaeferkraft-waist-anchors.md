# Käferkraft waist rails

Live poles are **detached**. Command **`WaistL`** or **`WaistR`** — never a shared `Waist` name.

Mesh space, meters, **nose −X**. Caps bury 8 cm into the hull. Poles are charcoal (`Dark`, same as the stock cage).

| Node | From behind | Front | Rear |
| --- | --- | --- | --- |
| `WaistL` | −Z | (−0.571, 1.061, −0.449) | (0.570, 1.051, −0.600) |
| `WaistR` | +Z | (−0.504, 1.061, 0.490) | (0.579, 1.063, 0.570) |

Stays (cage cap stops at the BodyPaint pick, not through the far side):

| Node | Cage end |
| --- | --- |
| `WaistToFrontTop_L` | (−0.070, 1.586, −0.458) |
| `WaistToFrontTop_R` | (−0.053, 1.591, 0.440) |

![Käferkraft Waist anchors](./kaeferkraft-waist-anchors.png)

Picker grid (candidates only):

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

Rebuild poles: `node scripts/bake-kaeferkraft-pole-frame.mjs`  
Rebuild picker image: `node scripts/overlay-kaeferkraft-waist-anchors.mjs`
