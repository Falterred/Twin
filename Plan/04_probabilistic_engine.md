# Part 4: Probabilistic Engine (Monte Carlo)

### Reasoning & Dependencies
Part 4 runs 300 randomized simulation passes per action using Box-Muller Gaussian sampling, extracting percentile bands (`p10`, `p50`, `p90`) and replacing `safety` with `safety_prob`. It depends on Part 1, 2, and 3.

### Input / Output Contracts
* **Inputs**: `DerivedState`, `RUNS = 300`.
* **Outputs**: `SimPointP[]` per action and probabilistic `ActionResult[]`.

```typescript
type SimPointP = {
  month: number;
  p10: number; p50: number; p90: number; // liquidCash percentiles
  efP10: number; efP50: number; efP90: number; // emergencyFundRatio percentiles
};
```

### Exact Implementation Steps
1. **Gaussian Sampling Helper**: Implement `gaussianRandom(mean, stdDev)` via Box-Muller transform.
2. **Monte Carlo Runner `simulateActionMC(actionId, state, runs=300)`**:
   * For each run $1 \dots 300$, sample monthly income using `incomeVariancePct` and inject a 6% monthly probability of $+15000$ expense shock.
   * Invoke `simulateAction` with sampled arrays.
   * Collect cash and emergency fund ratio arrays across all runs.
3. **Percentile Extraction**: Sort results per month $t$ and extract `p10`, `p50`, `p90` at indices $\lfloor 0.10 \times \text{RUNS} \rfloor$, $\lfloor 0.50 \times \text{RUNS} \rfloor$, $\lfloor 0.90 \times \text{RUNS} \rfloor$.
4. **Probabilistic Scoring `scoreActionMC`**:
   * Compute $\text{safety\_prob} = \frac{\text{count}(\text{runs where } \min(\text{efRatio}) \ge 1.0)}{\text{RUNS}}$.
   * Substitute $\text{safety\_prob}$ for `safety` in the Section 4 scoring formula.

### Isolated Testing Strategy
* Test Box-Muller random generator: assert output mean $\approx 0$ and stdDev $\approx 1$ across 10,000 samples.
* Test performance: measure execution time for 300 runs $\times 12$ months $\times 6$ actions ($21,600$ iterations) — must complete in $< 50\text{ms}$.
* Invariant check: verify `SimPointP` timeline length matches `SimPointD` timeline length ($13$ points).

### Explicitly Flagged Ambiguities
> [!NOTE]
> In Monte Carlo mode, percentiles for `liquidCash` and `emergencyFundRatio` are extracted independently per month to form smooth confidence bands.

### Implementation Decisions
- Probabilistic timelines use a dedicated `SimPointP` type because percentile points do not have a single deterministic debt balance.
- `safety_prob` is the direct fraction of sampled paths whose minimum emergency-fund ratio is at least 1.0; it is used as the safety term before the shared min-max normalization step.
- Expense shocks add ₹15,000 to sampled monthly expenses with a 6% probability per month. They do not also remove income; the combined deterministic income-loss shock remains Part 5 behavior.
- Non-positive run counts throw a `RangeError`; one run is supported and produces identical p10, p50, and p90 values.
- Sampled income is clamped at zero to avoid impossible negative income while preserving the configured variance model.
- Probabilistic shock survival is true when at least half of sampled paths survive the Part 5 emergency-fund threshold.
- Probabilistic evaluation returns a dedicated result type with the same metadata, scoring, constraint, and shock fields as deterministic results.
- Gaussian means and standard deviations must be finite, with standard deviation non-negative; invalid arguments are rejected.
