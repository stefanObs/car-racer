# Arcade physics evolution

## Versioning

Physics **rules** live in `CONCEPT.md` §§4.2–4.7 (dokumentstand bump when rules move).  
Implementation notes and feel decisions log **here** (newest first).

## Decision log

### 2026-08-12 — Skill: arcade-physics subagent
- Trigger: user — implement a subagent that owns physics so it can evolve
- Decision: New skill `.cursor/skills/arcade-physics/` (SKILL + stat-map + this log). Wired into skills-router, AGENTS.md, glob rule. Owns evolve workflow; code stays in `src/sim/vehicle.ts`.
- CONCEPT: §4.2 authorship note → dokumentstand v3.39

### 2026-08-12 — v3.37 Arcade driving physics from Eigenschaften
- Trigger: user — proper arcade physics scaled by car Eigenschaften
- Decision: `vehicle.ts` maps Beschleunigung/Tempo/Grip/Handling/Gewicht/Federung/Nitro (+ brakeBonus) into arcade forces; Schanzen Y airtime; mass impulse contact; render uses `car.y`
- CONCEPT §§4.2, §4.3, §4.6 → v3.37
