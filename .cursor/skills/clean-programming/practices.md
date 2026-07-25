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

## Test expectations

| Change type | Minimum |
|-------------|---------|
| Pure logic (physics helpers, rewards, segment stitch) | Unit tests |
| Level JSON / generator validity | Schema / validation tests |
| Bug fix | Regression test from the repro |
| UI-only copy | Manual check OK if no logic; still note how you verified |

Name tests after behavior: `grass_penalty_reduced_but_not_zero_with_suspension`.

## Reproduce-before-fix (examples)

**Good**

1. Seed `A7F2`, lap 1, drive onto grass → speed drops to X.  
2. Test `expect(speedOnGrass).toBeCloseTo(X)`.  
3. Fix suspension math.  
4. Test green; manual drive confirms.

**Bad**

- Change suspension constants because “grass feels wrong” with no numbers and no test.

## PR / commit mindset (when asked to commit)

- One concern per commit when practical  
- Message states **why**  
- Do not commit failing tests or commented-out suites  
