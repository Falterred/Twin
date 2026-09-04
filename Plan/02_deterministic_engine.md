# Part 2: Deterministic Simulation Engine

### Reasoning & Dependencies
Part 2 implements the per-action 12-month deterministic recurrence formulas (Section 3). It consumes `DerivedState` from Part 1 and produces monthly `SimPointD[]` timelines.

### Input / Output Contracts
* **Inputs**: `DerivedState`, optional `overrideIncome[]` and `overrideExpenses[]` (for Monte Carlo re-use).
* **Outputs**: `SimPointD[]` array of length 13 ($t = 0 \dots 12$).

```typescript
type SimPointD = {
  month: number;               // 0..12
  liquidCash: number;          // Cash balance at month t
  emergencyFundRatio: number; // liquidCash / emergencyFundTargetRs
  debtBalance: number;         // Remaining principal for EMI action, 0 for others
};
```

### Exact Implementation Steps
1. **Base Surplus Calculation**: `surplus = monthlyIncome - monthlyExpenses - existingEMI`.
2. **Action 1 (`Buy Now`)**: Deduct `itemPrice` at $t=0$, accumulate `surplus` for $t=1..12$.
3. **Action 2 (`EMI`)**: Amortization monthly installment $r = \text{rate}/12/100$, $n = \text{tenure}$. Subtract $\text{monthlyEMI}$ for $t \le n$, track remaining `debtBalance[t]`.
4. **Action 3 (`Wait 3 Months`)**: Accumulate surplus $t=1..2$; deduct $\text{itemPrice} \times (1 + \text{inflation})^3$ at $t=3$; accumulate surplus $t=4..12$.
5. **Action 4 (`Buy Cheaper Model`)**: Same recurrence as Buy Now using $\text{cheaperPrice} = \text{itemPrice} \times 0.7$.
6. **Action 5 (`Buy Refurbished`)**: Same recurrence as Buy Now using $\text{refurbPrice} = \text{itemPrice} \times 0.55$; inject repair dip at $t=8$: $\text{cash}[8] -= \text{refurbPrice} \times 0.3$.
7. **Action 6 (`Invest + Delay`)**: Cash compounds at $(1 + \text{monthlyInvestReturnPct})$ plus surplus each month. Compute `affordMonth` where $\text{cash}[t] \ge \text{itemPrice} \times (1 + \text{inflation})^t$.
8. **Helper `simulateAction(actionId, state, overrideIncome, overrideExpenses)`**: Master runner returning `SimPointD[]`.

### Isolated Testing Strategy
* Test Buy Now: verify `cash[0] === liquidCash - itemPrice` and linear growth.
* Test EMI: verify `debtBalance[n] === 0` and correct amortization formula output.
* Test Wait 3 Months: verify price drop happens strictly at $t=3$ with inflation compound.
* Test Refurbished: verify cash step-down at $t=8$.

### Explicitly Flagged Ambiguities
> [!NOTE]
> For `Invest + Delay`, when item price is reached at `affordMonth`, cash continues compounding in the simulation to present a 12-month timeline, while `delayCost` in scoring penalizes based on `affordMonth`.

### Error Handling Decisions
- Income and expense override arrays must contain exactly 13 present, finite values; sparse or malformed arrays are rejected.
- Unknown action IDs and invalid EMI parameters throw clear errors.
