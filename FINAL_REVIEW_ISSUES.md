# Final Review Issues

Date: 2026-09-03

## Overall Status

The project is partially finished. Parts 1 through 8 are represented in the codebase, and the engine validation passes, but the application is not yet production-ready.

## Priority 1: Correctness Issues

### 1. Probabilistic mode uses the wrong counterfactual results

File: `src/App.tsx`

The app calculates the counterfactual from deterministic results regardless of the selected mode:

```tsx
const cfResult = findCounterfactual(derived, detResults);
```

The chart and ranked list use probabilistic results when probabilistic mode is active. This can make the UI show a probabilistic recommendation while the counterfactual note describes a deterministic ranking.

Required action:

- Make counterfactual evaluation mode-aware, or
- Clearly label the counterfactual as deterministic when probabilistic mode is selected.

### 2. Emergency-fund counterfactual text can contradict the calculation

Files: `src/engine/counterfactual.ts`, `src/components/CounterfactualNote.tsx`

The engine increases `emergencyFundMonths`, but the UI wording describes the required buffer as becoming lower. This can communicate advice opposite to the actual calculation.

Required action:

- Generate wording based on the field direction.
- Use "higher" for `liquidCash` and `emergencyFundMonths`.
- Use "lower" for `itemPrice`.

### 3. Probabilistic disqualification uses only the median path

File: `src/engine/probabilistic.ts`

Probabilistic hard constraints are evaluated from median cash and median emergency-fund values. An action may remain valid even when many pessimistic simulated paths become insolvent or breach the emergency-fund threshold.

Required action:

Choose and document a policy, such as:

- Disqualify if any simulated path fails.
- Disqualify when failure probability exceeds a defined threshold.
- Use the p10 path for conservative constraints.

The policy should be consistent with the product's risk profile and financial safety goals.

### 4. Counterfactual binary search assumes monotonic winner changes

File: `src/engine/counterfactual.ts`

The search assumes that once a candidate change flips the winner, larger changes continue to keep the new winner. Normalization, disqualification, and multiple score terms can make ranking changes non-monotonic.

Required action:

- Test monotonicity assumptions, or
- Verify the discovered threshold with neighboring points and a final ranking check, or
- Use a bounded scan when binary-search assumptions do not hold.

## Priority 2: Testing and Stability Issues

### 5. No browser or UI test suite

Files: `src/components/`, `src/App.tsx`, `package.json`

The current tests are engine verification scripts. They do not verify the actual product workflow.

Missing tests include:

- Default application rendering
- Constraint slider updates
- Select control updates
- Debounced recalculation
- Calibration modal flow
- Risk-profile updates
- Theme toggle
- Deterministic/probabilistic mode switching
- Chart rendering
- Ranked action display
- Counterfactual note updates
- Error-state rendering
- Mobile layout

Required action:

Add a browser/component test setup and at least a smoke-test suite for the primary user workflow.

### 6. Part 8 end-to-end behavior is not verified

File: `valier_outputs/Twin plans/08_state_and_recompute_flow.md`

The App integration exists, but there are no automated tests proving that input changes propagate through the complete pipeline.

Required action:

Test that:

- Input changes update derived state.
- Debounce delays heavy recomputation by approximately 120 ms.
- Mode switching changes the evaluation branch.
- Rankings and chart data update.
- Counterfactual output updates.
- No infinite state/effect loop occurs.

### 7. Probabilistic performance target is not tested

File: `valier_outputs/Twin plans/04_probabilistic_engine.md`

The plan describes a performance target below 50 ms for the Monte Carlo workload, but there is no benchmark or regression check.

Required action:

Add a non-flaky benchmark or documented performance measurement. Treat the target as environment-dependent.

### 8. Sparse and malformed UI inputs are not tested

The engine has boundary validation, but there are no UI tests proving that invalid values cannot reach the engine through controls or browser events.

Required action:

Test invalid, empty, zero, and extreme UI inputs and verify a clear error state.

## Priority 3: Accessibility and UX Issues

### 9. Calibration modal lacks dialog accessibility

File: `src/components/CalibrationModal.tsx`

The modal lacks:

- `role="dialog"`
- `aria-modal="true"`
- An accessible dialog label
- Focus trapping
- Escape-key dismissal
- Focus restoration to the trigger

Required action:

Implement accessible modal behavior and keyboard navigation.

### 10. Slider labels are not explicitly associated with controls

File: `src/components/ConstraintPanel.tsx`

Visible labels are not consistently connected to their input elements using matching `htmlFor` and `id` values.

Required action:

Give every control a stable ID and associate its label explicitly.

### 11. Accordion state lacks accessibility semantics

File: `src/components/ConstraintPanel.tsx`

Accordion buttons do not consistently expose:

- `aria-expanded`
- `aria-controls`
- A stable controlled-panel ID

Required action:

Add the appropriate expanded/collapsed semantics.

### 12. Mode toggle lacks selected-state semantics

File: `src/components/ModeToggle.tsx`

The selected mode is visually indicated, but the buttons do not expose an explicit selected state such as `aria-pressed`.

Required action:

Expose the active mode to assistive technologies and keyboard users.

### 13. Chart accessibility is limited

File: `src/components/TimelineChart.tsx`

The chart has no explicit accessible summary or equivalent data table fallback. Users who cannot inspect the visual chart may not be able to understand the financial projections.

Required action:

Add a concise chart summary and an accessible tabular or text alternative.

### 14. Icon-only controls need accessible names

Files: `src/components/Header.tsx`, `src/components/CalibrationModal.tsx`, and related components

Icon-only controls need reliable `aria-label` values or visible accessible names.

Required action:

Audit every icon button and add accessible names and visible focus states.

### 15. Error messages are not fully user-oriented

File: `src/App.tsx`

The application catches calculation errors and displays the raw error message. This is useful for development but may be confusing to end users and may expose internal implementation wording.

Required action:

Map known validation errors to friendly messages while retaining detailed diagnostics for development.

## Priority 4: Documentation and Release Issues

### 16. README status is stale

File: `README.md`

The README still reports Parts 6, 7, and 8 as incomplete, although Part 6 and the Part 7/8 implementation exist in the current codebase.

Required action:

Update the current status table and project structure.

### 17. TODO status does not match current implementation

File: `TODO.md`

The TODO file still marks Parts 7 and 8 as incomplete even though their component and integration code exists. It should distinguish implementation from verification gaps.

Required action:

Mark the implementation status accurately and add remaining UI testing/accessibility tasks.

### 18. Package version is still `0.0.0`

File: `package.json`

The repository has releases through `v0.3.1`, but the package metadata still reports version `0.0.0`.

Required action:

Synchronize package metadata with the release strategy, or document why the package version intentionally differs.

### 19. Deployment documentation is missing

Files: `README.md`, project configuration

There are no documented deployment steps, supported hosting targets, production environment assumptions, or browser support expectations.

Required action:

Document the production build and deployment process.

### 20. No continuous integration workflow

Directory: `.github/`

The repository contains prompts but no visible CI workflow that runs tests, build, and lint on pushes or pull requests.

Required action:

Add CI only after deciding the supported Node version and package-manager policy.

### 21. Version history is not fully reflected in documentation

File: `README.md`

The README version history stops before the latest release and does not mention the Part 6 and error-handling releases accurately.

Required action:

Document `v0.3.0` and `v0.3.1`, or replace the manual history with links to GitHub releases/tags.

## Priority 5: Performance and Maintainability

### 22. Main production bundle is large

Build output reports a JavaScript chunk of approximately 620 kB, which exceeds Vite's usual 500 kB warning threshold.

Potential improvements:

- Code-split Recharts.
- Lazy-load non-critical UI.
- Configure manual chunks where appropriate.
- Measure actual load performance before optimizing.

### 23. Probabilistic mode performs redundant work

File: `src/App.tsx`

When probabilistic mode is selected, the app still calculates deterministic results and a deterministic counterfactual in the same memoized block. This may perform:

- Six deterministic simulations.
- Six Monte Carlo simulations.
- Repeated deterministic evaluations for counterfactual search.

Required action:

- Make calculations mode-aware.
- Defer or schedule expensive counterfactual work.
- Avoid calculating results that are not needed for the current view.

### 24. Engine result types are duplicated

Files: `src/engine/scoring.ts`, `src/engine/probabilistic.ts`

Deterministic and probabilistic action result and breakdown types have parallel structures. This can drift over time.

Required action:

Consider extracting shared metadata/result contracts while preserving the distinct deterministic and percentile timeline types.

### 25. Test scripts are custom harnesses rather than a test framework

File: `package.json`

The lightweight scripts are useful, but they do not provide standard test isolation, reporting, mocking, coverage, or browser testing.

Required action:

Adopt a test framework when UI and integration testing begins, while retaining focused mathematical tests where useful.

## Security and Privacy Review

### 26. No hardcoded credentials were found

No API keys, passwords, or credentials were identified in the reviewed project.

### 27. Client-side financial data handling is not documented

The current app appears client-side and does not have a backend or persistence layer. However, the README does not clearly state whether financial inputs are stored, transmitted, or discarded.

Required action:

Document the data-flow and privacy model before adding persistence or an LLM service.

### 28. Future LLM integration will require a security boundary

LLM functionality is future scope, not a current defect. Before adding it, define:

- What financial data may leave the device.
- API-key handling through a server-side boundary.
- Redaction and minimization.
- Prompt-injection defenses.
- Logging and retention rules.
- User consent.
- Cost and rate limits.

## Product Scope Limitations

These are not bugs in the current Parts 1–8 scope, but they limit the product's realism:

- No multi-year life-event simulation.
- No job-loss or salary-change event chains.
- No medical, family, rent, or dependency modeling.
- No correlated life events.
- No learning from user behavior.
- No persistent autonomous financial twin.
- No LLM explanation layer.

These should be planned as a later product extension rather than silently added to Parts 1–8.

## Current Validation

The current automated engine validation passes:

```text
95 assertions passed
npm run build: passed
npm run lint: passed
```

This does not prove that the browser UI and full user workflow are correct because UI and end-to-end tests are missing.

## Release Recommendation

Do not describe the project as fully finished yet. It is suitable as a functioning prototype after addressing the high-priority correctness issues and adding a basic UI smoke-test suite.
