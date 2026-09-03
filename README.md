# Twin: Financial Decision Optimizer

Twin is a financial decision optimizer prototype built with React, TypeScript, Vite, and Tailwind CSS. It compares major-purchase strategies against cash-flow, debt, emergency-fund, uncertainty, and stress-test outcomes.

## Current Status

Version `v0.2.0` includes Parts 1 through 5 of the engine:

- [x] Part 1: Constants, data models, and derived state
- [x] Part 2: Deterministic 12-month simulations
- [x] Part 3: Scoring and constraint evaluation
- [x] Part 4: Probabilistic Monte Carlo simulations
- [x] Part 5: Stress-test shock evaluation
- [ ] Part 6: Counterfactual explanations
- [ ] Part 7: React UI components
- [ ] Part 8: Application state and recompute flow

The current engine evaluates six strategies:

- Buy now
- EMI or loan
- Wait three months
- Buy a cheaper model
- Buy refurbished
- Invest and delay

The probabilistic engine runs multiple possible income and expense futures, then reports percentile bands and safety probabilities. The stress layer tests a month-two income-loss and surprise-expense scenario.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
```

## Scripts

```bash
npm run dev      # Start the Vite development server
npm run build    # Type-check and build for production
npm test         # Run all engine verification harnesses
npm run lint     # Run Oxlint
npm run preview  # Preview the production build
```

## Project Structure

```text
src/
├── App.tsx
├── main.tsx
└── engine/
    ├── constants.ts
    ├── deterministic.ts
    ├── scoring.ts
    ├── stress.ts
    ├── probabilistic.ts
    └── __tests__/
        ├── verify_phase1.ts
        ├── verify_phase3_and_5.ts
        └── verify_phase4.ts
```

## Version History

- `v0.1.0`: Foundation snapshot with Parts 1, 2, 3, and 5
- `v0.2.0`: Parts 1 through 5, including Monte Carlo and hardened stress tests

The tagged versions remain available so earlier project states can be checked out at any time.
