# Twin Implementation TODO

## Completed

- [x] Part 1: Constants, data model, and derived state
- [x] Part 2: Deterministic simulation engine
- [x] Part 3: Scoring function and constraint evaluator
- [x] Part 5: Stress-test shock layer
- [x] Part 4: Probabilistic Monte Carlo engine
- [x] Part 6: Counterfactual explanation search

## Remaining Planned Work

- [ ] Part 7: React UI components
- [ ] Part 8: State management and recompute flow

## Part 3 Checklist

- [x] Evaluate all six deterministic action timelines
- [x] Apply cash, safety, and EMI DTI constraints
- [x] Calculate and normalize five score terms
- [x] Apply risk-profile weights
- [x] Return sorted action results with readable disqualification reasons

## Part 5 Checklist

- [x] Apply the month-2 combined income and surprise-expense shock
- [x] Preserve source timelines and debt balances
- [x] Propagate shocked cash through the remaining horizon
- [x] Calculate shock survival status
- [x] Keep shock status independent from score and ranking

## Part 4 Checklist

- [x] Implement Box-Muller Gaussian sampling
- [x] Run 300 sampled futures per action by default
- [x] Apply income variance and expense shocks
- [x] Calculate p10, p50, and p90 cash and emergency-fund bands
- [x] Calculate probabilistic safety and action scores
- [x] Preserve deterministic engine behavior

## Part 6 Checklist

- [x] Probe liquid cash, emergency-fund months, and item price
- [x] Rebuild derived state for every probe
- [x] Use 15-step binary search per candidate field
- [x] Preserve original state and results
- [x] Fall back across candidate fields
- [x] Return finite counterfactual deltas or null