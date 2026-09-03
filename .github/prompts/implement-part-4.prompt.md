---
description: "Implement and test Part 4 Monte Carlo probabilistic financial simulations in Twin"
name: "Implement Part 4 Monte Carlo Engine"
argument-hint: "Implement the Part 4 probabilistic engine using the existing deterministic and scoring layers"
agent: "agent"
---

Implement Part 4 of the Financial Decision Optimizer in:

C:\Users\user\VScode\Twin

Use this specification:

C:\Users\user\VScode\valier_outputs\Twin plans\04_probabilistic_engine.md

Parts 1, 2, 3, and 5 are already implemented and tested. Reuse their existing types and functions:

- `src/engine/constants.ts`
- `src/engine/deterministic.ts`
- `src/engine/scoring.ts`
- `src/engine/stress.ts`
- `src/engine/__tests__/verify_phase1.ts`
- `src/engine/__tests__/verify_phase3_and_5.ts`

## Important Constraints

- Do not recreate or reinitialize the project.
- Do not implement Parts 6, 7, or 8.
- Do not implement LLM functionality.
- Do not add React UI components.
- Do not modify Parts 1, 2, 3, or 5 behavior unless compatibility requires a minimal change.
- Do not duplicate deterministic simulation formulas.
- Do not commit or push changes.
- Keep all work local to the `Twin` repository.
- Use the existing TypeScript style and dependencies.
- Keep probabilistic calculations pure where practical.
- Preserve the existing deterministic API and test behavior.

## Before Coding

1. Read the complete Part 4 plan.
2. Inspect the existing Part 1, Part 2, Part 3, and Part 5 modules and tests.
3. Identify any ambiguity in the plan that requires a new implementation decision.
4. If adding a decision, document it in:

   `C:\Users\user\VScode\valier_outputs\Twin plans\04_probabilistic_engine.md`

Do not silently introduce behavior that is absent from the plan.

## Part 4: Probabilistic Monte Carlo Engine

Create a new module under:

`src/engine/probabilistic.ts`

Implement the following types and functions.

### Types

Create and export a probabilistic timeline type equivalent to the plan:

```ts
interface SimPointP {
  month: number;
  p10: number;
  p50: number;
  p90: number;
  efP10: number;
  efP50: number;
  efP90: number;
}
```

Create appropriate exported types for Monte Carlo results if needed. Keep the types compatible with the existing deterministic `SimPointD` and Part 3 `ActionResult` structures.

### Gaussian Sampling

Implement and export:

```ts
function gaussianRandom(mean: number, stdDev: number): number
```

Use the Box-Muller transform.

Requirements:

- Return samples with the requested mean and standard deviation.
- Avoid invalid logarithm input when the random value is zero.
- Handle zero standard deviation deterministically.
- Do not introduce an external random-number dependency.

### Monte Carlo Runner

Implement and export a function similar to:

```ts
simulateActionMC(
  actionId: string,
  state: DerivedState,
  runs?: number,
): SimPointP[]
```

Use a default of 300 runs.

For each run:

1. Create 13 monthly income values.
2. Sample income using the existing `incomeVariancePct`.
3. Create 13 monthly expense values.
4. Apply the planned 6% monthly probability of an additional ₹15,000 expense shock.
5. Invoke the existing `simulateAction()` function with the sampled arrays.
6. Collect liquid cash and emergency-fund ratio values for every month.

Do not copy or rewrite the six deterministic action formulas.

### Percentiles

For each month, independently calculate:

- Cash p10, p50, and p90
- Emergency-fund-ratio p10, p50, and p90

Use sorted samples and the percentile indexes specified in the plan. Ensure every output timeline contains exactly 13 points for months 0 through 12.

Handle edge cases safely:

- `runs <= 0`
- `runs === 1`
- zero income
- zero expenses
- zero emergency-fund targets
- negative or unusual sampled values

Use a clear, documented interpretation for invalid run counts rather than returning malformed data.

### Probabilistic Evaluation

Implement a function similar to:

```ts
evaluateAllProbabilistic(state: DerivedState): ActionResult[]
```

It must:

1. Run Monte Carlo simulations for all six actions.
2. Produce probabilistic timelines.
3. Calculate probabilistic safety using:

```text
safety_prob = runs where the minimum emergency-fund ratio is at least 1.0 / total runs
```

4. Reuse the Part 3 scoring and constraint concepts where possible.
5. Preserve the existing `ActionResult` shape as much as possible.
6. Include `survivesShock` using the Part 5 shock layer or an equivalent probabilistic interpretation documented in the Part 4 plan.
7. Keep disqualified actions visible and ensure they cannot outrank valid actions.
8. Keep deterministic and probabilistic evaluation separate; do not alter `evaluateAllDeterministic()`.

If the existing Part 3 module requires a small reusable helper to support probabilistic inputs, extract only the minimal shared logic and preserve current behavior.

## Testing

Create:

`src/engine/__tests__/verify_phase4.ts`

Use the repository's existing lightweight verification style.

Test:

- `gaussianRandom(0, 1)` over a large sample has approximately zero mean and unit standard deviation.
- Zero standard deviation returns the mean.
- Monte Carlo output contains six-action-compatible timelines with exactly 13 points.
- Percentiles are ordered correctly: p10 <= p50 <= p90.
- Emergency-fund percentiles are ordered correctly.
- Default execution uses 300 runs.
- Custom run counts work.
- Invalid run counts are handled clearly.
- Income variance differs between stable and variable states.
- Expense shocks use the planned 6% monthly probability and ₹15,000 amount.
- The existing deterministic simulation functions are reused.
- Zero income and zero expenses do not produce `NaN` or `Infinity`.
- Zero emergency-fund targets are handled safely.
- Probabilistic evaluation returns all six actions.
- Probabilistic scores are finite and clamped to `[0, 1]`.
- Probabilistic results preserve action metadata.
- Disqualified actions remain visible but cannot be recommended over valid actions.
- Deterministic evaluation results remain unchanged after probabilistic evaluation.
- Existing Part 1, Part 2, Part 3, and Part 5 tests continue to pass.

## Test Script

Update `package.json` only if necessary so `npm test` runs the new verification file in addition to the existing tests. Preserve all existing test commands.

For example:

```json
"test": "tsx src/engine/__tests__/verify_phase1.ts && tsx src/engine/__tests__/verify_phase3_and_5.ts && tsx src/engine/__tests__/verify_phase4.ts"
```

## Validation

Run:

```bash
npm test
npm run build
npm run lint
```

Resolve errors caused by the Part 4 implementation. Do not fix unrelated issues.

## Final Checklist

Before finishing, verify:

- [ ] Part 4 plan was read completely.
- [ ] Any new Part 4 decisions were documented in the plan.
- [ ] Box-Muller Gaussian sampling is implemented.
- [ ] 300-run Monte Carlo simulation is implemented.
- [ ] Income variance is applied.
- [ ] Expense shocks are applied.
- [ ] p10/p50/p90 cash bands are implemented.
- [ ] p10/p50/p90 emergency-fund bands are implemented.
- [ ] Probabilistic safety probability is implemented.
- [ ] Six probabilistic action results are returned.
- [ ] Existing deterministic behavior remains intact.
- [ ] Tests pass.
- [ ] Build passes.
- [ ] Lint passes.
- [ ] No commit or push was performed.
- [ ] Parts 6, 7, and 8 remain untouched.

Report:

- Files changed
- Plan-document updates
- Part 4 features implemented
- Tests added or updated
- Test result
- Build result
- Lint result
- Any intentional interpretation of an ambiguity
- Confirmation that no commit or push occurred
