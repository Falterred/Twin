# Technical Implementation Plan: Financial Decision Optimizer Prototype

This document outlines the step-by-step modular build plan for the **Financial Decision Optimizer** prototype. The plan is strictly divided into 8 discrete parts matching the spec's logical architecture. Each part specifies exact input/output data schemas, function signatures, isolated testing strategies, and explicitly flagged ambiguities.

---

## Part 1: Constants, Data Model, and Derived State

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

---

## Part 2: Deterministic Simulation Engine

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

---

## Part 3: Scoring Function & Constraint Evaluator

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

---

## Part 4: Probabilistic Engine (Monte Carlo)

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

---

## Part 5: Stress-Test Shock Layer

### Reasoning & Dependencies
Part 5 tests whether an action can survive a severe single-month adverse financial event (month 2 shock). It operates on both deterministic timelines and probabilistic median `p50` paths.

### Input / Output Contracts
* **Inputs**: `DerivedState`, action timeline (`SimPointD[]` or `SimPointP[]`).
* **Outputs**: `survivesShock: boolean` flag added to `ActionResult`.

### Exact Implementation Steps
1. **Implement `applyShock(state, timeline)`**:
   * Clone timeline.
   * Inject adverse shock at month 2: deduct $(\text{monthlyIncome} + 15000)$ from `liquidCash`.
   * Propagate balance reduction forward through months $t=3 \dots 12$.
2. **Evaluate Survival**:
   * Re-evaluate `shockedEmergencyFundRatio[t] = shockedCash[t] / emergencyFundTargetRs`.
   * `survivesShock = min(shockedEmergencyFundRatio[0..12]) >= 0.5`.

### Isolated Testing Strategy
* Test with high vs low initial savings: verify high savings pass shock (`survivesShock = true`) while low savings flag caution (`survivesShock = false`).
* Invariant check: verify failing shock test DOES NOT alter the action's calculated score or rank, only setting `survivesShock = false`.

### Explicitly Flagged Ambiguities
> [!NOTE]
> Spec Section 6 pseudo-code applies $(\text{monthlyIncome} + 15000)$ shock at month 2, combining income loss with expense surprise to test worst-case resilience.

---

## Part 6: Counterfactual Explanation Engine

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

---

## Part 7: UI Components

### Reasoning & Dependencies
Part 7 builds the pure presentational UI components. Components consume `ActionResult[]`, `DerivedState`, and user callbacks without performing direct state mutations or business logic.

### Input / Output Contracts
* Pure React functional components styled with Tailwind CSS, Recharts (`ComposedChart`, `Line`, `Area`), and Lucide React icons.

### Exact Implementation Steps & Component List
1. **`<CalibrationModal>`**: 3-question wizard modal mapping user answers to `conservative`, `balanced`, or `aggressive` risk profile badge.
2. **`<ConstraintPanel>`**: Controls for financial sliders (`liquidCash`, `monthlyIncome`, `monthlyExpenses`, `existingEMI`, `itemPrice`, `emergencyFundMonths`, `emiTenureMonths`, `emiAnnualRatePct`) and select dropdowns (`urgency`, `incomeStability`). Includes ~120ms debounce.
3. **`<ModeToggle>`**: Segmented control switching between `'deterministic'` and `'probabilistic'`.
4. **`<TimelineChart>`**: Recharts `ComposedChart`:
   * Deterministic mode: 6 `<Line>` paths for liquid cash timeline over 12 months.
   * Probabilistic mode: 6 `<Area>` shaded confidence bands (`p10` to `p90`) with `<Line>` median (`p50`).
5. **`<RankedActionList>`**: Cards for actions #1..#6 showing normalized score badge, breakdown progress bars, hard-constraint disqualification banners (greyed out), and shock caution icons.
6. **`<CounterfactualNote>`**: Banner rendering the single counterfactual sentence ("If your liquid cash were ₹15,000 higher, Buy Now would overtake EMI.").

### Isolated Testing Strategy
* Render components with static mock `ActionResult[]` data to verify layout integrity, chart rendering, and responsiveness before wiring live state.

---

## Part 8: Top-Level State Management & Recompute Flow Wiring

### Reasoning & Dependencies
Part 8 connects all modules inside `<App>`, managing top-level `rawInputs`, `riskProfile`, and `mode` state with `useMemo` hooks to maintain a pure unidirectional data flow.

### Implementation Flow Architecture (Section 9)

```
rawInputs (useState) + riskProfile + mode
  │
  ├──> debounced onChange (~120ms)
  │
  ▼
derivedState = useMemo(() => buildDerivedState(rawInputs, riskProfile), [rawInputs, riskProfile])
  │
  ▼
evaluation = useMemo(() => {
  return mode === 'deterministic'
    ? evaluateAllDeterministic(derivedState)
    : evaluateAllProbabilistic(derivedState);
}, [derivedState, mode])
  │
  ▼
counterfactual = useMemo(() => findCounterfactual(derivedState, evaluation), [derivedState, evaluation])
  │
  ▼
render: <ConstraintPanel /> <ModeToggle /> <TimelineChart /> <RankedActionList /> <CounterfactualNote />
```

### Exact Implementation Steps
1. Initialize top-level React state (`rawInputs`, `riskProfile`, `mode`).
2. Wire `useMemo` hooks for `derivedState`, `evaluation`, and `counterfactual`.
3. Pass evaluation results down to `<TimelineChart>`, `<RankedActionList>`, and `<CounterfactualNote>`.
4. Verify toggle zero-recompile invariant: switching mode swaps the `useMemo` calculation branch with zero UI layout rewrite.

### Isolated Verification Plan
* Validate full end-to-end interactive loop: adjusting any slider recalculates simulation, updates timeline chart, re-ranks action cards, and updates counterfactual note smoothly.

---

## Summary of Verification Plan

| Phase | Test Scope | Verification Method |
| :--- | :--- | :--- |
| **Part 1-3** | Deterministic Engine & Scoring | Console unit test harness verifying per-action timelines and min-max score bounds. |
| **Part 4** | Monte Carlo Engine | Verify Box-Muller distribution math and measure execution time (< 50ms for 21,600 steps). |
| **Part 5-6** | Shock & Counterfactual | Verify shock caution flags render properly and binary search converges on minimum delta. |
| **Part 7-8** | Full React Artifact | End-to-end UI testing: interactive sliders, mode toggle swap, chart band rendering, responsiveness. |
