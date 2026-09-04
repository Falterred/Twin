# Financial Decision Optimizer - Implementation Plans

This folder contains the step-by-step, highly detailed technical implementation plans for the Financial Decision Optimizer prototype, split into 8 logical modules as specified in the architecture document.

## Build Order & Index

1. **[Part 1: Constants, Data Model, and Derived State](./01_constants_and_data_model.md)**
   Establishes the typescript schemas, initial configurations, and state derivation logic.
2. **[Part 2: Deterministic Simulation Engine](./02_deterministic_engine.md)**
   Implements the mathematical recurrence relations for all 6 purchasing actions over a 12-month horizon.
3. **[Part 3: Scoring Function & Constraint Evaluator](./03_scoring_function.md)**
   Translates raw financial timelines into a normalized 0-1 objective score weighted by user risk profiles, including hard disqualification rules.
4. **[Part 4: Probabilistic Engine (Monte Carlo)](./04_probabilistic_engine.md)**
   Adds intelligent variance via Box-Muller Gaussian sampling, running 300 alternate futures per action to map confidence bands.
5. **[Part 5: Stress-Test Shock Layer](./05_stress_test_shock.md)**
   Simulates catastrophic month-2 combined shocks (income drop + surprise expense) to measure structural resilience.
6. **[Part 6: Counterfactual Explanation Search](./06_counterfactual_search.md)**
   Applies heuristic binary search algorithms to calculate what alternative inputs would flip the engine's top recommendation.
7. **[Part 7: UI Components](./07_ui_components.md)**
   Specifies the pure React/Tailwind/Recharts layout layers, guaranteeing visual decoupling from business logic.
8. **[Part 8: State Management & Recompute Flow](./08_state_and_recompute_flow.md)**
   Connects all pieces into a single unified `<App>` component with strict unidirectional state pipelines and debounced memoization.

---

*These plans are formulated prior to writing any source code to guarantee exact compliance with the original PDF specification, identify edge cases, and design robust isolated test strategies.*
