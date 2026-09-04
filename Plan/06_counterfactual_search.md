# Part 6: Counterfactual Explanation Engine

### Reasoning & Dependencies
Part 6 uses binary search to find the minimum input adjustment (e.g., additional emergency fund or liquid cash) required to flip the ranking between the #1 and #2 recommended actions.

### Input / Output Contracts
* **Inputs**: `DerivedState`, current `ActionResult[]`.
* **Outputs**: Counterfactual explanation object or `null`.

```typescript
type CounterfactualResult = {
  field: string;
  delta: number;
  wouldFlipTo: string; // ID of the #2 action
} | null;
```

### Exact Implementation Steps
1. **Identify Top 2 Actions**: Sort `results` descending by score $\rightarrow$ `first`, `second`.
2. **Implement `findCounterfactual(state, results)`**:
   * Candidate fields: `'liquidCash'`, `'emergencyFundMonths'`, `'itemPrice'`.
   * Binary search bounds: `lo = 0`, `hi = state.itemPrice`.
   * Iterate 15 times:
     * `mid = (lo + hi) / 2`.
     * Build `testState = { ...state, [field]: state[field] + mid }`.
     * Re-evaluate all actions with `testState`.
     * Check if top action changed from `first.id`.
     * Adjust binary search bounds (`lo = mid` vs `hi = mid`).
   * Return `{ field, delta: hi, wouldFlipTo: second.id }` if flip triggers within search bound.

### Isolated Testing Strategy
* Test binary search convergence: verify exact delta value flips ranking when applied to state.
* Test graceful fallback: if probe field produces no flip within bounds, verify engine tries next candidate field before returning `null`.

### Explicitly Flagged Ambiguities
> [!NOTE]
> Spec Section 7 pseudo-code lists `'currentEmergencyFund'` as probe field. We probe `'liquidCash'` and `'emergencyFundMonths'` as primary candidate fields since they map directly to editable UI controls.

### Implementation Decisions
- Part 6 uses deterministic evaluation as its ranking source; probabilistic evaluation remains a separate mode until Part 8 wires mode selection.
- The `itemPrice` candidate decreases the purchase price by the probe delta because the counterfactual represents finding a cheaper purchase.
- `wouldFlipTo` reports the actual new top valid action, not necessarily the original second-place action.
- Candidate fields are searched in the order `liquidCash`, `emergencyFundMonths`, then `itemPrice`.
- Invalid or non-positive search bounds return `null`; every returned delta is finite and non-negative.
- Each probe rebuilds derived state and does not mutate the supplied state, results, or timelines.
- Invalid source state values are rejected by the Part 1 validation boundary before probing.
