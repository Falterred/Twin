# Part 1: Constants, Data Model, and Derived State

### Reasoning & Dependencies
Part 1 forms the foundational type definitions, lookup tables, and state transformation logic required by all downstream simulation and scoring modules. It has zero external dependencies.

### Input / Output Contracts
* **Inputs**: `RawInputs` object from UI controls & `riskProfile` selection.
* **Outputs**: `DerivedState` object containing computed targets, variance parameters, and risk weights.

```typescript
// Input Schema (RawInputs)
type RawInputs = {
  liquidCash: number;           // Initial liquid savings (₹)
  monthlyIncome: number;        // Monthly net income (₹)
  monthlyExpenses: number;      // Monthly expenses (₹)
  existingEMI: number;          // Current monthly debt obligations (₹)
  emergencyFundMonths: number;  // Safety target in months of expense (default: 6)
  itemPrice: number;            // Purchase cost (₹)
  urgency: 'urgent' | 'can_wait' | 'nice_to_have';
  incomeStability: 'stable' | 'variable';
  emiTenureMonths: number;      // EMI duration (default: 12)
  emiAnnualRatePct: number;     // Interest rate % (0 for no-cost EMI)
  mode: 'deterministic' | 'probabilistic';
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
};

// Output Schema (DerivedState)
type DerivedState = RawInputs & {
  currentEmergencyFund: number;   // Earmarked liquid savings
  emergencyFundTargetRs: number;  // emergencyFundMonths * monthlyExpenses
  incomeVariancePct: number;      // 0.05 (stable) vs 0.25 (variable)
  weights: { w1: number; w2: number; w3: number; w4: number; w5: number };
  monthlyInvestReturnPct: number; // 0.008 (~10% p.a.)
  monthlyInflationPct: number;    // 0.004 (~5% p.a.)
};
```

### Exact Implementation Steps
1. **Define Action Configuration `ACTIONS`**: Array of 6 actions (`id`, `label`, `color`).
2. **Define `WEIGHT_TABLE`**: Map `riskProfile` to `{ w1, w2, w3, w4, w5 }` as per Section 4.4.
3. **Define `SHOCK_PARAMS`**: `{ month: 2, incomeDropPct: 1.0, surpriseExpense: 15000 }`.
4. **Implement `buildDerivedState(rawInputs, riskProfile)`**: Transform raw state into `DerivedState`.

### Isolated Testing Strategy
* Run unit tests on `buildDerivedState` with sample `RawInputs`.
* Assert `emergencyFundTargetRs === rawInputs.emergencyFundMonths * rawInputs.monthlyExpenses`.
* Assert `weights` dynamically change when `riskProfile` shifts between `conservative`, `balanced`, and `aggressive`.

### Explicitly Flagged Ambiguities
> [!NOTE]
> Spec Section 2.2 defines `currentEmergencyFund` in `DerivedState`, but Section 3/4 calculations use `cash[t] / emergencyFundTargetRs` for safety ratios. We explicitly define `currentEmergencyFund = rawInputs.liquidCash` for probe reference while using `emergencyFundTargetRs` for safety calculation.

### Error Handling Decisions
- `buildDerivedState` rejects non-finite financial inputs and negative financial values.
- EMI tenure must be a non-negative integer and the interest rate must be non-negative.
- Unknown risk profiles are rejected instead of silently falling back to balanced weights.
