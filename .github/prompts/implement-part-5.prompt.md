---
description: "Implement and test Part 5 stress-test shock evaluation in Twin"
name: "Implement Part 5 Stress Test"
argument-hint: "Implement the month-2 financial shock layer using the existing deterministic and scoring engines"
agent: "agent"
---

Implement Part 5 of the Financial Decision Optimizer in:

C:\Users\user\VScode\Twin

Use this specification:

C:\Users\user\VScode\valier_outputs\Twin plans\05_stress_test_shock.md

Parts 1, 2, 3, and 4 are already implemented and tested. Reuse their existing types and functions:

- `src/engine/constants.ts`
- `src/engine/deterministic.ts`
- `src/engine/scoring.ts`
- `src/engine/probabilistic.ts`
- `src/engine/__tests__/verify_phase1.ts`
- `src/engine/__tests__/verify_phase3_and_5.ts`
- `src/engine/__tests__/verify_phase4.ts`

## Important Constraints

- Do not recreate or reinitialize the project.
- Do not implement Parts 6, 7, or 8.
- Do not implement LLM functionality.
- Do not add React UI components.
- Do not add new Monte Carlo behavior; Part 4 already owns probabilistic simulation.
- Do not modify Parts 1, 2, 3, or 4 behavior unless a minimal compatibility change is required.
- Do not duplicate deterministic simulation formulas.
- Do not commit or push changes.
- Keep all work local to the `Twin` repository.
- Use the existing TypeScript style and dependencies.
- Keep stress-test functions pure and non-mutating.

## Before Coding

1. Read the complete Part 5 plan.
2. Inspect the existing Part 1, Part 2, Part 3, and Part 4 modules and tests.
3. Determine whether Part 5 already exists partially or completely.
4. Identify any ambiguity that requires a new implementation decision.
5. If adding a decision, document it in:

   `C:\Users\user\VScode\valier_outputs\Twin plans\05_stress_test_shock.md`

Do not silently introduce behavior that is absent from the plan.

## Part 5: Stress-Test Shock Layer

Implement or complete the stress-test module under:

`src/engine/stress.ts`

Reuse `SHOCK_PARAMS` from `src/engine/constants.ts`.

The default shock is:

```text
month 2:
  income loss = monthlyIncome * SHOCK_PARAMS.incomeDropPct
  surprise expense = SHOCK_PARAMS.surpriseExpense
  total cash reduction = income loss + surprise expense
```

With the current constants, this equals:

```text
monthlyIncome + ₹15,000
```

## Required Function: applyShock

Implement and export:

```ts
applyShock(
  state: DerivedState,
  timeline: SimPointD[],
): SimPointD[]
```

Requirements:

- Return a new cloned timeline.
- Never mutate the original timeline or its points.
- Apply the shock at month 2.
- Preserve months exactly.
- Preserve debt balances exactly.
- Subtract the shock amount from month 2 cash.
- Propagate the same cash reduction through months 3–12.
- Leave months 0 and 1 unchanged.
- Recalculate emergency-fund ratios for every returned point.
- Handle empty or malformed timelines clearly.
- Avoid producing invalid ratios from zero or invalid emergency-fund targets.

For a deterministic timeline, the expected behavior is:

```text
shockedCash[t] = originalCash[t]                         for t < 2
shockedCash[t] = originalCash[t] - shockAmount           for t >= 2
```

Do not change the original timeline.

## Required Function: survivesShock

Implement and export:

```ts
survivesShock(
  state: DerivedState,
  timeline: SimPointD[],
): boolean
```

Requirements:

- Apply the shock using `applyShock`.
- Return `true` only when every shocked emergency-fund ratio from month 0 through month 12 is at least `0.5`.
- Return `false` for an empty timeline.
- Return `false` when the emergency-fund target is zero or invalid.
- Never mutate the original timeline.
- Never change scores, rankings, or deterministic simulation results.

## Integration With Existing Results

Verify that Part 3 action results receive a valid:

```ts
survivesShock: boolean
```

If integration is missing, make the smallest compatible change necessary so every deterministic action result includes stress-survival status.

Do not use shocked cash to recalculate the normal score or score breakdown. Stress status must remain informational and independent from ranking.

If Part 4 probabilistic results already include shock-survival behavior, preserve it. Do not redesign Part 4 unless required for a direct Part 5 compatibility issue.

## Testing

Create or update a focused verification file such as:

`src/engine/__tests__/verify_phase5.ts`

Use the repository's existing lightweight verification style.

Add tests for:

- A high-cash scenario surviving the shock.
- A low-cash scenario failing the shock.
- Shock beginning exactly at month 2.
- Shock amount equaling lost monthly income plus ₹15,000.
- Months 0 and 1 remaining unchanged.
- Month 2 cash being reduced correctly.
- The reduction propagating through months 3–12.
- Original timeline remaining unchanged.
- Original timeline points not being mutated.
- Debt balances remaining unchanged.
- Emergency-fund ratios being recalculated.
- Empty timeline behavior.
- Zero or invalid emergency-fund target behavior.
- `survivesShock` returning a boolean.
- Existing Part 3 scores remaining unchanged after stress evaluation.
- Existing Part 3 ranking remaining unchanged after stress evaluation.
- Existing Part 4 tests continuing to pass.

## Test Script

Update `package.json` only if necessary so `npm test` runs the new verification file in addition to all existing verification files. Preserve the existing tests and command order.

For example:

```json
"test": "tsx src/engine/__tests__/verify_phase1.ts && tsx src/engine/__tests__/verify_phase3_and_5.ts && tsx src/engine/__tests__/verify_phase4.ts && tsx src/engine/__tests__/verify_phase5.ts"
```

Avoid duplicate test files if Part 5 coverage already exists in `verify_phase3_and_5.ts`; extend the existing file instead when that is cleaner.

## Validation

Run:

```bash
npm test
npm run build
npm run lint
```

Resolve errors caused by the Part 5 implementation. Do not fix unrelated issues.

## Final Checklist

Before finishing, verify:

- [ ] Part 5 plan was read completely.
- [ ] Any new Part 5 decisions were documented in the plan.
- [ ] The month-2 income-loss shock is implemented.
- [ ] The ₹15,000 surprise expense is included.
- [ ] Shocked timelines are cloned.
- [ ] Source timelines are never mutated.
- [ ] Month and debt values are preserved.
- [ ] Cash reduction propagates through month 12.
- [ ] Emergency-fund ratios are recalculated.
- [ ] Survival threshold is `0.5`.
- [ ] Empty and invalid-input behavior is safe.
- [ ] Part 3 scores and rankings remain unchanged.
- [ ] Part 4 behavior remains intact.
- [ ] Tests pass.
- [ ] Build passes.
- [ ] Lint passes.
- [ ] No commit or push was performed.
- [ ] Parts 6, 7, and 8 remain untouched.

Report:

- Files changed
- Plan-document updates
- Part 5 features implemented
- Tests added or updated
- Test result
- Build result
- Lint result
- Any intentional interpretation of an ambiguity
- Confirmation that no commit or push occurred
