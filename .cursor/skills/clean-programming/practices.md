# Programming Practices

## Clean code heuristics

| Prefer | Avoid |
|--------|--------|
| Explicit names (`grassSpeedPenalty`) | Abbreviations, generic `data` / `tmp` |
| Early return / guard clauses | Deep nesting |
| Pure functions where easy | Hidden global mutation |
| Single module owning a rule (e.g. track cross-section) | Copy-pasted magic numbers |
| Typed boundaries at module edges | “Any” bags of props |

Game rules (asphalt → grass → wall, damage heal, catch-up) live in **one** place each — call sites stay thin.

## Refactor / optimize guide

1. Make it **correct** (with tests).
2. Make it **clear** (rename, extract, delete).
3. Make it **fast** only with a measured hotspot.

Allowed quick wins without profiling: remove duplicate work in a hot loop you already touched, avoid allocs in per-frame paths when the clearer version is equally simple.

Forbidden: rewriting architecture “while here”; optimizing unread code paths; adding caches without an ownership story.

Layer imports, type ownership, and “what not to split” live in `.cursor/skills/architecture/`. Do not invent a parallel stack (ECS, React, second WebGL canvas). Static lock: `npm run test:arch`.

## Test expectations

| Change type | Minimum |
|-------------|---------|
| Pure logic (physics helpers, rewards, segment stitch) | Unit tests |
| Level JSON / generator validity | Schema / validation tests |
| Bug fix | Regression test from the repro |
| UI-only copy | Manual check OK if no logic; still note how you verified |

Name tests after behavior: `grass_penalty_reduced_but_not_zero_with_suspension`.

## Reproduce → RCA → verify → fix (examples)

**Good**

1. Repro: Seed `A7F2`, lap 1, drive onto grass → speed drops to X.  
2. RCA: grass zone uses full `speedFactor` but suspension mitigation was applied after clamp, so mitigation never ran.  
3. Verify RCA: unit test with high suspension still shows unmitigated factor; flipping order in a spike confirms.  
4. Failing test locks the expected mitigated (but not zero) penalty.  
5. Fix the order / formula at the zone helper.  
6. Test green; browser drive confirms.

**Bad**

- Change suspension constants because “grass feels wrong” with no repro numbers, no RCA, and no verification.  
- Catch the error in the UI and show “OK” while the sim stays wrong.

### RCA write-up template (bugs)

```markdown
**Symptom:** …
**Trigger:** …
**Root cause:** …
**Verified by:** (test / experiment / evidence)
**Fix plan:** (one place, why that layer)
```

## PR / commit mindset (when asked to commit)

- One concern per commit when practical  
- Message states **why**  
- Do not commit failing tests or commented-out suites  
