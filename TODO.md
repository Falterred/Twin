# Twin Implementation TODO

## Completed

- [x] Part 1: Constants, data model, and derived state
- [x] Part 2: Deterministic simulation engine
- [x] Part 3: Scoring function and constraint evaluator
- [x] Part 5: Stress-test shock layer
- [x] Part 4: Probabilistic Monte Carlo engine

## Remaining Planned Work

- [ ] Part 6: Counterfactual explanation search
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