---
name: clean-programming
description: >-
  Enforces clean code, maintainability-first refactors, mandatory tests, and
  reproduce-before-fix for Crash Circuit. Always use when writing, editing,
  reviewing, refactoring, optimizing, debugging, or testing any code in this
  repository. Default skill (with game-concept) for every implementation task.
---

# Clean Programming (Crash Circuit)

Non-negotiable habits for all code work in this project:

1. **Clean code**
2. **Refactor and optimize for simple maintainability and clarity**
3. **Always test**
4. **Always reproduce first before fixing an issue**

Details and checklists: [practices.md](practices.md).

## Clean code

- Small functions, one clear job; names that say what and why
- Prefer obvious control flow over cleverness
- No dead code, unused params, or speculative abstractions
- Match existing project style; change only what the task needs
- Comments only for non-obvious intent — never narrate the obvious

## Maintainability & clarity (refactor / optimize)

- Optimize for **reader clarity** first; then measure before micro-optimizing
- Prefer simple data and explicit steps over deep hierarchies
- Extract only when duplication or complexity is real (not “just in case”)
- After behavior changes: leave the touched area clearer than you found it
- Do not mix large refactors with unrelated feature work

## Always test

- New behavior → tests that lock it in (unit and/or integration as fits)
- Bug fix → failing test that reproduces the bug, then fix until green
- Refactor → existing tests must stay green; add coverage if gaps blocked the refactor
- Run the relevant test command before claiming done
- If no harness exists yet, add a minimal one before non-trivial logic ships

## Always reproduce first before fixing

Bug / unexpected behavior workflow — do not skip:

```
Task Progress:
- [ ] 1. Restate the observed vs expected behavior
- [ ] 2. Reproduce reliably (command, input, level seed, steps)
- [ ] 3. Capture evidence (test, log, screenshot, stack trace)
- [ ] 4. Write or extend a failing test that demonstrates the bug
- [ ] 5. Fix the root cause (smallest clear change)
- [ ] 6. Confirm the repro is gone and tests pass
- [ ] 7. Only then tidy/refactor if needed
```

**Never** “fix by guess” without a repro. If unreproducible, investigate until it is — or document what blocked repro and stop before speculative patches.

## Definition of done

- [ ] Code is easy to read and scoped to the task
- [ ] Touchpoints are clearer / simpler where you edited
- [ ] Tests cover the change; suite (or relevant subset) is green
- [ ] For bugs: repro existed first; fix verified against that repro
- [ ] Step is **versioned**, **committed on `master`**, and **pushed** (no feature branches)
- [ ] Player-facing changes: **server started** and **verified in browser** (review-testing)
