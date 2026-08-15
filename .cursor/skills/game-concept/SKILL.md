---
name: game-concept
description: >-
  Owns Crash Circuit CONCEPT.md: refines design, evolves the concept
  deliberately, and keeps implementation aligned. Always use when changing
  game design, writing or updating CONCEPT.md, adding or scoping features,
  MVP planning, resolving design-vs-code drift, or whenever implementation
  might contradict the concept. Default skill (with clean-programming) for
  any gameplay/feature implementation task.
---

# Game Concept (Crash Circuit)

**Source of truth:** `CONCEPT.md`  
**Goal:** refine ideas clearly, evolve the concept on purpose, and make sure **implementation follows the concept** (not the other way around by accident).

Evolution process & invariants: [evolution.md](evolution.md).

Sibling skills must stay aligned when concept changes:

| Area | Skill |
|------|--------|
| Art | `.cursor/skills/asphalt-comic-art/` |
| 3D / Tripo | `.cursor/skills/tripo-3d-assets/` |
| Levels | `.cursor/skills/level-editor/` |
| Arcade physics / race feel | `.cursor/skills/arcade-physics/` |
| Code quality | `.cursor/skills/clean-programming/` |
| QA / UX / regression | `.cursor/skills/review-testing/` |

## Hard invariants (change only with explicit user OK)

Do not “quietly” reverse these in code, levels, or copy:

1. **Core fantasy** = fast tuned racing; contact/ramming is **spice**, not the goal (no ram button / ram-primary score)
2. **Audience** = ~10+, **German** UI/copy
3. **Track cross-section** = asphalt → grass → wall (tires in corners, concrete on straights)
4. **Grass** penalty reduced by suspension, **never** removed
5. **Damage** heals over time with visible FX; K.O. respawns
6. **Currency** = **CHF**; cosmetics (paint/stickers) grant **no** stats
7. **Parts** always have advantage **and** disadvantage; synergies can offset cons
8. **Modes** = Cup + Freier Modus + Training + Ad-hoc; catch-up helps trailing cars but clean play can still lead; Training is solo and unranked
9. **Art lock** = Asphalt-Comic
10. **Input / platform** = fully playable with **keyboard**, **controller/gamepad**, and **tablet (touch)** — race + all menus/garage; not desktop-only
11. **Free-only tech** = no paid engines or paid runtime dependencies; see `TECH.md`
12. **Delivery** = each implementation step is **versioned**, **committed**, and **pushed to `master`**; **no feature branches** (see `TECH.md` § Delivery)

If a feature fights an invariant: **stop**, propose a concept amendment, get approval, update `CONCEPT.md`, then implement.

## Refine the concept

When the user adds or changes design ideas:

1. Read current `CONCEPT.md` end-to-end for conflicts
2. Rewrite into precise, testable rules (numbers/ranges when useful)
3. Prefer one clear rule over three vague ones
4. Call out trade-offs and what is **out of scope** for MVP vs later
5. Update the summary table / document version at the bottom of `CONCEPT.md`
6. Propagate: update affected sibling skills/specs (`track-spec`, style bible, review checklists) in the **same** change set when rules move

**Refinement bar:** a 10-year-old player outcome or a unit/QA check should be able to validate the rule.

## Evolve the concept (deliberate)

Concept may change — only through an explicit evolution step:

```
Task Progress:
- [ ] 1. Trigger: new idea, playtest learning, impl discovery, or user correction
- [ ] 2. Impact: which §§ / invariants / skills / levels break?
- [ ] 3. Proposal: short diff of CONCEPT wording (before → after)
- [ ] 4. User confirmation if an invariant or large scope shift
- [ ] 5. Edit CONCEPT.md (bump version note, e.g. v2 → v3)
- [ ] 6. Sync sibling skills + example levels if needed
- [ ] 7. Note follow-up impl / QA tasks
```

Log non-trivial decisions in [evolution.md](evolution.md) (Decision log).

Never leave code as the only place a new rule lives.

## Implementation follows concept

Before and while building:

1. Map the task to concrete `CONCEPT.md` sections
2. Reject or redesign impl that violates invariants
3. Name modules/APIs after concept language (`grassPenalty`, `healDamage`, `chf`, not vague `misc`)
4. Tests and review-testing checklists assert concept rules, not accidental behavior
5. After impl: if reality taught a better rule, **evolve CONCEPT first** (or same PR), then keep code matched

**Drift check** (run when reviewing features or “does this still match?”):

| Question | Action if no |
|----------|----------------|
| Is it in CONCEPT? | Add to concept or cut feature |
| Does code match CONCEPT? | Fix code or evolve concept intentionally |
| Do skills/levels match CONCEPT? | Sync them |
| Does QA cover the rule? | Extend review-testing / tests |

## Output when refining

When updating design for the user, prefer:

1. **Verdict** — what changed and why  
2. **CONCEPT diff summary** — sections touched  
3. **Impl implications** — what to build/change/test  
4. **Skill sync** — which skills/files updated  

Do not invent parallel design docs that replace `CONCEPT.md`.
