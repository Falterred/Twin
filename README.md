# Twin

Twin is a Financial Decision Optimizer prototype built with React, TypeScript, Vite, and Tailwind CSS.

The current implementation includes:

- Raw and derived financial input models
- Risk-profile weighting constants
- Six purchasing-action configurations
- Deterministic 12-month simulations
- EMI amortization calculations
- A phase-one verification harness

The scoring, Monte Carlo, stress-test, counterfactual, and interactive UI plans are documented separately and are not yet implemented.

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
npm test         # Run the Part 1 and Part 2 verification harness
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
    └── __tests__/
        └── verify_phase1.ts
```
