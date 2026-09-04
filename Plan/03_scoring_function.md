# Part 3: Scoring Function & Constraint Evaluator

### Reasoning & Dependencies
Part 3 evaluates hard constraints and normalizes the 5 scoring terms ($0 \dots 1$) across actions, applying risk weights $w_1 \dots w_5$. It depends on Part 1 and Part 2.

### Input / Output Contracts
* **Inputs**: `DerivedState`, timeline map of `SimPointD[]` for all 6 actions.
* **Outputs**: Sorted `ActionResult[]` array.

```typescript
type ActionResult = {
  id: string;
  label: string;
  color: string;
  timeline: SimPointD[] | SimPointP[];
  score: number; // Clamped 0-1
  breakdown: { safety: number; oppCost: number; delayCost: number; debtBurden: number; utility: number };
  disqualified: boolean;
  disqualifyReason: string | null;
  survivesShock: boolean;
};
```

### Exact Implementation Steps
1. **Hard Constraint Checks**:
   * Cash insolvency: `cash[t] < 0` for any $t \in [0..12]$.
   * Immediate safety breach: `emergencyFundRatio[t] < 0.5` for any $t \in [0..2]$.
   * DTI ceiling: EMI action disqualified if `(existingEMI + monthlyEMI) / monthlyIncome > 0.5`.
2. **Compute Raw Terms (0-1 unweighted)**:
   * `safety`: $\min(\text{emergencyFundRatio}[0..12])$ clamped $[0,1]$.
   * `oppCost`: $(\text{capitalUsedNow} / \text{itemPrice}) \times \text{monthlyInvestReturnPct} \times 12$.
   * `delayCost`: $\text{monthsWaited} \times \text{monthlyInflationPct} + \text{urgencyPenalty}(\text{urgency})$.
   * `debtBurden`: $(\text{existingEMI} + \text{newEMI}) / \text{monthlyIncome}$.
   * `utility`: Base urgency rating (`urgent`: 1.0, `can_wait`: 0.5, `nice_to_have`: 0.2), adjusted $-0.2$ for delay actions and $+0.1$ for immediate buy/EMI.
3. **Min-Max Normalization**: Across the 6 actions for each term: $\frac{\text{val} - \min}{\max - \min + \epsilon}$.
4. **Weighted Score**: $\text{Score} = w_1 \cdot \text{safety} - w_2 \cdot \text{oppCost} - w_3 \cdot \text{delayCost} - w_4 \cdot \text{debtBurden} + w_5 \cdot \text{utility}$. Clamped to $[0,1]$.

### Isolated Testing Strategy
* Test constraint disqualification: pass low `liquidCash` to force `cash[t] < 0` and verify `disqualified === true` with explicit `disqualifyReason`.
* Test score sensitivity: toggle `riskProfile` between `conservative` and `aggressive` and verify `safety` vs `oppCost` weighting shifts the top-ranked action.

### Explicitly Flagged Ambiguities
> [!NOTE]
> Urgency penalty values in `delayCost` are specified as `urgencyPenalty(urgency)` in the spec. We define standard numerical mappings: `urgent` $= 0.4$, `can_wait` $= 0.15$, `nice_to_have` $= 0.0$.

### Implementation Decisions
- Zero denominators are handled without producing `NaN` or `Infinity`.
- Min-max normalization returns `0` when all values in a term are equal.
- Disqualified actions remain visible, but valid actions are always ranked ahead of disqualified actions.
- Waiting periods are 0 months for immediate actions, 3 months for `wait_3m`, and the first affordable month for `invest_delay` (13 when it is not affordable in the horizon).
- Evaluation does not mutate deterministic timelines.
