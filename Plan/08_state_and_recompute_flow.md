# Part 8: Top-Level State Management & Recompute Flow Wiring

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

### Isolated Testing & Verification Strategy
* **Test 1: Zero-State Mutation**: Dragging a slider updates `stagedInputs` at 60fps, but `TimelineChart` only updates every 120ms (debounce verified).
* **Test 2: Mode Toggle Latency**: Clicking 'Probabilistic' swaps the `useMemo` branch. The `<TimelineChart>` smoothly transitions from lines to area bands. Clicking back to 'Deterministic' should be nearly instantaneous (browser cache/V8 optimization).
* **Test 3: Infinite Loop Protection**: Guarantee that no `useEffect` cycles exist that mutate state based on `evaluationResults`, ensuring unidirectional purity.

### Explicitly Flagged Ambiguities & Decisions
* **Design Decision (Debounce Layer)**: We chose to debounce the input propagation to the engines, rather than debouncing the chart render. This saves battery/compute on probabilistic Monte Carlo loops when the user is rapidly scrubbing a range slider.

---

## Summary of Verification Plan

| Phase | Test Scope | Verification Method |
| :--- | :--- | :--- |
| **Part 1-3** | Deterministic Engine & Scoring | Console unit test harness verifying per-action timelines and min-max score bounds. |
| **Part 4** | Monte Carlo Engine | Verify Box-Muller distribution math and measure execution time (< 50ms for 21,600 steps). |
| **Part 5-6** | Shock & Counterfactual | Verify shock caution flags render properly and binary search converges on minimum delta. |
| **Part 7-8** | Full React Artifact | End-to-end UI testing: interactive sliders, mode toggle swap, chart band rendering, responsiveness. |
