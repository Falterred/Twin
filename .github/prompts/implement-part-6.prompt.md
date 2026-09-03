---
description: "Implement and test Part 6 counterfactual explanation search in Twin"
name: "Implement Part 6 Counterfactual Search"
argument-hint: "Implement binary-search counterfactual explanations using the existing deterministic evaluation pipeline"
agent: "agent"
---

Implement Part 6 of the Financial Decision Optimizer in:

C:\Users\user\VScode\Twin

Use this specification:

C:\Users\user\VScode\valier_outputs\Twin plans\06_counterfactual_search.md

Parts 1 through 5 are already implemented and tested. Reuse their existing types and functions:

- `src/engine/constants.ts`
- `src/engine/deterministic.ts`
- `src/engine/scoring.ts`
- `src/engine/stress.ts`
- `src/engine/probabilistic.ts`
- `src/engine/__tests__/verify_phase1.ts`
- `src/engine/__tests__/verify_phase3_and_5.ts`
- `src/engine/__tests__/verify_phase4.ts`

## Important Constraints

- Do not recreate or reinitialize the project.
- Do not implement Parts 7 or 8.
- Do not add React UI components.
- Do not implement LLM functionality.
- Do not redesign Parts 1 through 5.
- Do not modify existing scoring, deterministic, stress, or probabilistic behavior unless a minimal compatibility change is required.
- Do not duplicate simulation or scoring formulas unnecessarily.
- Do not commit or push changes.
- Keep all work local to the `Twin` repository.
- Use the existing TypeScript style and dependencies.
- Keep counterfactual search functions pure and non-mutating.

## Before Coding

1. Read the complete Part 6 plan.
2. Inspect the existing Parts 1 through 5 modules and tests.
3. Determine whether any counterfactual code already exists.
4. Identify ambiguities in the plan, especially around ranking, modes, and candidate fields.
5. Document any new interpretation in:

   `C:\Users\user\VScode\valier_outputs\Twin plans\06_counterfactual_search.md`

Do not silently introduce behavior that is absent from the plan.

## Part 6: Counterfactual Explanation Engine

Create a new module under:

`src/engine/counterfactual.ts`

Implement and export a result type equivalent to:

```ts
interface CounterfactualResult {
  field: string;
  delta: number;
  wouldFlipTo: string;
}
```

The function must also support returning `null` when no candidate field can flip the recommendation within its search bound.

Implement and export a function similar to:

```ts
findCounterfactual(
  state: DerivedState,
  results: ActionResult[],
): CounterfactualResult | null
```

## Required Behavior

1. Identify the current top two actions from the supplied results.
2. Ignore disqualified actions when selecting the current recommendation and candidate replacement.
3. If there are fewer than two valid actions, return `null`.
4. Use the candidate fields defined by the plan:

   - `liquidCash`
   - `emergencyFundMonths`
   - `itemPrice`

5. For each candidate field:

   - Set `lo = 0`.
   - Set `hi = state.itemPrice`.
   - Perform 15 binary-search iterations.
   - Build a cloned test input/state for each midpoint.
   - Never mutate the original `DerivedState` or `ActionResult[]`.
   - Re-run the deterministic evaluation using the test state.
   - Check whether the top valid action changes from the original recommendation.

6. Return the smallest discovered delta that changes the recommendation:

```ts
{
  field,
  delta,
  wouldFlipTo,
}
```

7. Try the next candidate field if the current field cannot produce a flip within its bound.
8. Return `null` if no field produces a valid flip.
9. Ensure `delta` is finite and non-negative.
10. Ensure `wouldFlipTo` identifies the new top valid action.

## State Handling

The candidate field must be adjusted according to its meaning:

- `liquidCash`: add the delta in rupees.
- `emergencyFundMonths`: add the delta in months.
- `itemPrice`: reduce the item price by the delta because a cheaper purchase may change the recommendation.

Do not add a monetary delta directly to `emergencyFundMonths` without documenting that interpretation. Preserve all other raw inputs when constructing each test state.

Rebuild derived state for every probe using `buildDerivedState()` so weights and derived values remain consistent.

## Ranking and Modes

Use deterministic evaluation for Part 6 unless the Part 6 plan explicitly requires probabilistic evaluation. Document this decision in the Part 6 plan.

The returned explanation must correspond to the same ranking rules used by Part 3:

- Valid actions rank ahead of disqualified actions.
- Scores are compared in descending order.
- Disqualified actions must not become the recommended replacement.

Do not modify the original results while probing.

## Explanation Semantics

The engine should return data only. Do not generate natural-language explanations inside Part 6 beyond the action ID in `wouldFlipTo`.

Part 7 or a future LLM layer may convert the result into text such as:

```text
If your liquid cash were ₹15,000 higher, Buy Now would overtake EMI.
```

Do not implement that UI or LLM explanation layer here.

## Testing

Create:

`src/engine/__tests__/verify_phase6.ts`

Use the repository's existing lightweight verification style.

Add tests for:

- A valid result with at least two eligible actions.
- Correct identification of the current top two valid actions.
- A known state where increasing `liquidCash` flips the recommendation.
- A known state where changing `itemPrice` flips the recommendation if possible.
- Candidate-field fallback when the first field cannot produce a flip.
- `null` when no candidate field can produce a flip.
- Exactly 15 binary-search iterations per candidate field.
- A finite, non-negative delta.
- A valid `wouldFlipTo` action ID.
- Disqualified actions being ignored for recommendation selection.
- Original state remaining unchanged.
- Original results and timelines remaining unchanged.
- Rebuilding derived state for each probe.
- Deterministic ranking rules being preserved.
- Zero or negative item price handling.
- Zero or negative emergency-fund months handling.
- No `NaN` or `Infinity` results.
- Existing Parts 1 through 5 tests continuing to pass.

Avoid brittle assertions against exact floating-point deltas unless the test uses a suitable tolerance. Verify that applying the returned delta actually changes the top valid action when the result is non-null.

## Test Script

Update `package.json` only if necessary so `npm test` runs the new verification file after the existing Part 1, Part 3/5, and Part 4 verification files. Preserve all existing tests and command order.

For example:

```json
"test": "tsx src/engine/__tests__/verify_phase1.ts && tsx src/engine/__tests__/verify_phase3_and_5.ts && tsx src/engine/__tests__/verify_phase4.ts && tsx src/engine/__tests__/verify_phase6.ts"
```

## Validation

Run:

```bash
npm test
npm run build
npm run lint
```

Resolve errors caused by the Part 6 implementation. Do not fix unrelated issues.

## Final Checklist

Before finishing, verify:

- [ ] Part 6 plan was read completely.
- [ ] Any new Part 6 decisions were documented in the plan.
- [ ] Candidate fields are implemented.
- [ ] Top valid actions are identified correctly.
- [ ] Binary search performs 15 iterations per candidate field.
- [ ] Test states are cloned and rebuilt correctly.
- [ ] Original state and results are not mutated.
- [ ] Candidate fallback works.
- [ ] `null` fallback works.
- [ ] Returned deltas are finite and non-negative.
- [ ] Returned replacement IDs are valid.
- [ ] Disqualified actions cannot become recommendations.
- [ ] Existing Parts 1 through 5 behavior remains intact.
- [ ] Tests pass.
- [ ] Build passes.
- [ ] Lint passes.
- [ ] No commit or push was performed.
- [ ] Parts 7 and 8 remain untouched.

Report:

- Files changed
- Plan-document updates
- Part 6 features implemented
- Tests added or updated
- Test result
- Build result
- Lint result
- Any intentional interpretation of an ambiguity
- Confirmation that no commit or push occurred
