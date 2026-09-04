# Part 7: UI Components

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
