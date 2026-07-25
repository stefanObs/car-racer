---
name: clean-programming
description: >-
  Enforces clean code, maintainability-first refactors, mandatory tests,
  reproduce-before-fix, and root-cause analysis before bug fixes for Crash
  Circuit. Always use when writing, editing, reviewing, refactoring, optimizing,
  debugging, or testing any code in this repository. Default skill (with
  game-concept) for every implementation task.
---

# Clean Programming (Crash Circuit)

Non-negotiable habits for all code work in this project:

1. **Clean code**
2. **Refactor and optimize for simple maintainability and clarity**
3. **Always test**
4. **Always reproduce first before fixing an issue**
5. **Always perform a root cause analysis, verify it, then fix** (when fixing a bug)

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

## Bug workflow: reproduce → root cause → verify → fix

When a bug must be fixed, do **not** jump to a patch. Follow this order:

```
Task Progress:
- [ ] 1. Restate observed vs expected behavior
- [ ] 2. Reproduce reliably (command, input, level seed, browser steps)
- [ ] 3. Capture evidence (failing test, log, screenshot, stack trace)
- [ ] 4. Root cause analysis (RCA): name the underlying mechanism, not just the symptom
- [ ] 5. Verify the RCA (prove it — see below)
- [ ] 6. Write or extend a failing test that locks the repro / RCA
- [ ] 7. Fix the verified root cause (smallest clear change)
- [ ] 8. Confirm the repro is gone, tests pass, and (if UI) browser check
- [ ] 9. Only then tidy/refactor if needed
```

### Root cause analysis (required)

State explicitly:

1. **Symptom** — what the user/dev sees  
2. **Immediate trigger** — input, state, or call that surfaces it  
3. **Root cause** — the incorrect assumption, logic, data, or integration that makes the trigger produce the symptom  
4. **Why not a side effect** — why a nearby symptom fix would be wrong or incomplete  

Reject “fixes” that only hide the symptom (extra retries, swallowing errors, UI band-aids) unless the RCA shows that *is* the correct layer — and say so.

### Verify the RCA before coding the fix

Prove the analysis with at least one of:

- A **minimal failing test** that fails for the stated reason  
- A **targeted experiment** (toggle the suspected line/state and watch the symptom appear/disappear)  
- **Runtime evidence** (log/breakpoint/screenshot) that matches the causal chain  

If verification fails, revise the RCA — do not ship a speculative fix.

**Never** “fix by guess” without repro + verified RCA. If unreproducible, investigate until it is — or document what blocked repro/RCA and stop before speculative patches.

## Definition of done

- [ ] Code is easy to read and scoped to the task
- [ ] Touchpoints are clearer / simpler where you edited
- [ ] Tests cover the change; suite (or relevant subset) is green
- [ ] For bugs: repro → **RCA written** → **RCA verified** → fix → re-verified
- [ ] Step is **versioned**, **committed on `master`**, and **pushed** (no feature branches)
- [ ] Player-facing changes: **server started** and **verified in browser** (review-testing)
