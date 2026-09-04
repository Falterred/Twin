# Twin: Financial Decision Optimizer

Twin is a financial decision optimizer prototype built with React, TypeScript, Vite, and Tailwind CSS. It compares major-purchase strategies against cash-flow, debt, emergency-fund, uncertainty, and stress-test outcomes.

## Current Status

Version `v0.4.0` marks the completion of the core engine and frontend integration (Parts 1–8):

- [x] Part 1: Constants, data models, and derived state
- [x] Part 2: Deterministic 12-month simulations
- [x] Part 3: Scoring and constraint evaluation
- [x] Part 4: Probabilistic Monte Carlo simulations
- [x] Part 5: Stress-test shock evaluation
- [x] Part 6: Counterfactual explanations
- [x] Part 7: React UI components
- [x] Part 8: Application state and recompute flow

The application evaluates six strategies:
1. Buy now
2. EMI or loan
3. Wait three months
4. Buy a cheaper model
5. Buy refurbished
6. Invest and delay

The probabilistic engine runs 300 possible income and expense futures, then reports percentile bands (`p10-p90`). The stress layer tests a month-two income-loss and surprise-expense scenario. A counterfactual engine automatically determines which small tweak to inputs would change the optimal recommendation.

## Architecture

- **Engine (`src/engine/`)**: Pure functional TypeScript mathematical models. Tested in isolation using `tsx`.
- **UI (`src/components/`)**: React 19 functional components styled with Tailwind CSS v4 and Recharts for data visualization.
- **State (`src/App.tsx`)**: Unidirectional data flow. Slider inputs are debounced (~120ms) and fed into the engine pipeline, producing a fully memoized state re-evaluation on every change without dropping frames.

## Security & Data Privacy

**Twin operates entirely client-side.**
- Zero financial data leaves your browser.
- No analytics, trackers, or telemetry are included.
- All Monte Carlo simulations and scoring algorithms execute directly in the local JavaScript engine.

## Requirements

- Node.js 20 or newer
- npm

## Setup & Development

```bash
npm install
npm run dev      # Start the Vite development server at localhost
```

## Available Scripts

```bash
npm run dev      # Start the development server
npm run build    # Type-check and build for production
npm test         # Run all engine verification harnesses (95 tests)
npm run lint     # Run Oxlint
npm run preview  # Preview the production build locally
```

## Deployment

The application compiles to static HTML, CSS, and JS. It can be deployed to any static host (Vercel, Netlify, AWS S3, GitHub Pages).

1. Build the project:
   ```bash
   npm run build
   ```
2. Deploy the `dist/` folder to your hosting provider.

## Version History

- `v0.1.0`: Foundation snapshot with Parts 1, 2, 3, and 5
- `v0.2.0`: Parts 1 through 5, including Monte Carlo and hardened stress tests
- `v0.3.0` & `v0.3.1`: Counterfactual binary search engine (Part 6) and error handling improvements
- `v0.4.0`: Full UI implementation (Part 7) and state wiring (Part 8), accessibility enhancements, and finalize release.
