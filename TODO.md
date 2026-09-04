# Twin Implementation TODO

## Completed (Parts 1-8)

- [x] Part 1: Constants, data model, and derived state
- [x] Part 2: Deterministic simulation engine
- [x] Part 3: Scoring function and constraint evaluator
- [x] Part 4: Probabilistic Monte Carlo engine
- [x] Part 5: Stress-test shock layer
- [x] Part 6: Counterfactual explanation search
- [x] Part 7: React UI components (Glassmorphism, Recharts, Forms)
- [x] Part 8: State management and recompute flow (Memoization, Debounce)

## Post-v0.4.0 Enhancements (Future Scope)

- [ ] Automated browser / end-to-end (E2E) testing suite (Playwright / Cypress)
- [ ] Multi-year life-event simulation and dependency modeling
- [ ] Correlated life events and job-loss modeling
- [ ] Persistent autonomous financial twin
- [ ] LLM explanation layer for natural language financial advice

## Release v0.4.0 Quality Notes

- [x] User-facing error guidance
- [x] Core ARIA labels and keyboard dismissal
- [x] Accessible chart summary
- [x] CI workflow for lint, test, and build
- [x] Release metadata synchronized to 0.4.0

## Detailed Module Checklists

### Part 3 (Scoring)
- [x] Evaluate all six deterministic action timelines
- [x] Apply cash, safety, and EMI DTI constraints
- [x] Calculate and normalize five score terms
- [x] Apply risk-profile weights
- [x] Return sorted action results with readable disqualification reasons

### Part 4 (Probabilistic)
- [x] Implement Box-Muller Gaussian sampling
- [x] Run 300 sampled futures per action by default
- [x] Apply income variance and expense shocks
- [x] Calculate p10, p50, and p90 cash and emergency-fund bands
- [x] Calculate probabilistic safety and action scores
- [x] Preserve deterministic engine behavior

### Part 5 (Stress Test)
- [x] Apply the month-2 combined income and surprise-expense shock
- [x] Preserve source timelines and debt balances
- [x] Propagate shocked cash through the remaining horizon
- [x] Calculate shock survival status
- [x] Keep shock status independent from score and ranking

### Part 6 (Counterfactuals)
- [x] Probe liquid cash, emergency-fund months, and item price
- [x] Rebuild derived state for every probe
- [x] Use 15-step binary search per candidate field
- [x] Preserve original state and results
- [x] Fall back across candidate fields
- [x] Return finite counterfactual deltas or null

### Part 7 & 8 (UI & Integration)
- [x] Implement all 7 React components
- [x] Establish Design Tokens and Theme Variables in CSS
- [x] Map UI events to component states
- [x] Debounce slider inputs by ~120ms
- [x] Memoize full calculation pipeline gracefully
- [x] WCAG Accessibility improvements (ARIA roles, Keyboard navigation)