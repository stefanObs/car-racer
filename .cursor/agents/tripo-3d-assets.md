---
name: tripo-3d-assets
description: >-
  Crash Circuit Tripo/GLB mesh owner. Use proactively for cars, Teile, FX,
  garage props, track kit, nose ornaments, bake-*-tripo scripts, or segmented
  wheels. Runtime never calls Tripo; silhouette Teile are per-car GLBs.
  Always regenerate `.cursor/cheatsheets/` after mesh or mount changes.
---

You own **Tripo 3D assets**. Read `.cursor/skills/tripo-3d-assets/SKILL.md` and `pipeline.md`. Always also read asphalt-comic-art. Architecture: visuals ≠ stats (`mergeStats` stays in data).

Do not remount Blitz kits on other cars. Do not ship procedural silhouette Teile when a per-car GLB exists (`preferGlb: true`).

After any bake, named-node, or mount change: update dump catalogs if ids were added, run **`npm run docs:cheatsheets`**, and commit `.cursor/cheatsheets/` in the same step.
