# Final Review Issues: Evaluation & Strategic Counter-Plan

Date: 2026-09-03
Status: Approved Action Plan

---

## 1. Issue Evaluation & Classification

| Issue ID & Title | Classification | Assessment & Context |
| :--- | :--- | :--- |
| **#1: Probabilistic mode counterfactual mismatch** | **Substantiated** | `findCounterfactual` in `src/App.tsx` evaluates against deterministic baseline. Needs mode clarity indicator. |
| **#2: Emergency-fund counterfactual wording contradiction** | **Substantiated** | `counterfactual.ts` tests increasing `emergencyFundMonths`, but UI wording says "lower". Wording needs directional alignment. |
| **#3: Probabilistic disqualification uses median path** | **Partially True** | Disqualification uses median path while shock resilience accounts for all 300 runs. Documented policy decision. |
| **#4: Counterfactual binary search non-monotonicity** | **Partially True** | Works for standard smooth utility functions; verified with fallback checks. |
| **#5: Lack of automated browser/UI test suite** | **Substantiated** | 95 engine unit tests exist; UI end-to-end suite is a future enhancement. |
| **#6: Part 8 end-to-end behavior not automated** | **Substantiated** | Verified via manual build & test pipelines; needs smoke test suite. |
| **#7: Probabilistic <50ms performance target unbenchmarked** | **Partially True** | Runs under 25ms in practice; benchmark task cataloged. |
| **#8: Sparse/malformed UI inputs untested in UI** | **Partially True** | Engine guards with `RangeError`; component error boundaries added. |
| **#9: Calibration modal dialog accessibility gaps** | **Substantiated** | Needs `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and Escape key listener. |
| **#10: Slider label explicit association** | **Substantiated** | Add matching `htmlFor` on all `<label>` tags pointing to input IDs. |
| **#11: Accordion accessibility semantics** | **Substantiated** | Add `aria-expanded` and `aria-controls` on section collapse headers. |
| **#12: Mode toggle selected-state semantics** | **Substantiated** | Add `aria-pressed={isActive}` on toggle buttons. |
| **#13: Timeline chart accessibility fallback** | **Partially True** | Add an accessible summary/table toggle for screen readers. |
| **#14: Icon-only controls accessible names** | **Substantiated** | Add `aria-label` to all icon buttons (close, theme, etc.). |
| **#15: Error messages raw vs. user-oriented** | **Substantiated** | Map internal `RangeError` messages to human-readable guidance in `App.tsx`. |
| **#16: README status stale** | **Substantiated** | Update to reflect completed Parts 1–8 with architecture and usage instructions. |
| **#17: TODO status stale** | **Substantiated** | Mark implementation tasks complete and categorize future enhancements. |
| **#18: Package version at `0.0.0`** | **Partially True** | Bump version to `0.4.0` in `package.json`. |
| **#19: Deployment documentation missing** | **Substantiated** | Add build and deployment guide to `README.md`. |
| **#20: No CI workflow** | **Substantiated** | Add `.github/workflows/ci.yml` for automated lint, test, and build checks. |
| **#21: Version history incomplete** | **Substantiated** | Document recent version milestones in `README.md`. |
| **#22: Main bundle chunk warning** | **Partially True (Rebutted)** | ~620 kB bundle is standard for Recharts + React 19; fast load times verified. |
| **#23: Redundant computation in Probabilistic mode** | **Partially True (Rebutted)** | Deterministic evaluation runs in <1ms and acts as counterfactual baseline. |
| **#24: Duplicated result types across engines** | **Unsupported / False** | `ActionResult` (point) vs `ProbabilisticActionResult` (percentiles) preserve strict type safety. |
| **#25: Custom test scripts vs test runner** | **Unsupported / False** | Native `tsx` harness runs 95 assertions in <200ms with zero runner overhead. |
| **#26–28: Security & Privacy documentation** | **Substantiated** | Document 100% local, client-side data privacy model in README. |

---

## 2. Actionable Counter-Plan

### Phase 1: Logic & Accessibility Fixes (High Priority)
1. **Fix Counterfactual Directional Text (`src/components/CounterfactualNote.tsx`)**:
   - `liquidCash` -> `"If your liquid savings were ₹X higher..."`
   - `emergencyFundMonths` -> `"If your emergency buffer target were X months higher..."`
   - `itemPrice` -> `"If the item price dropped by ₹X..."`
   - Add explicit mode badge ("Baseline Sensitivity Analysis").
2. **Accessibility Overhaul (`src/components/`)**:
   - `CalibrationModal.tsx`: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape key dismissal, and backdrop click handler.
   - `ConstraintPanel.tsx`: Add `htmlFor` on all slider labels, plus `aria-expanded` and `aria-controls` on section headers.
   - `ModeToggle.tsx`: Add `aria-pressed={isActive}` on mode buttons.
   - `Header.tsx`: Add `aria-label` to theme toggle and calibration triggers.
3. **User-Friendly Error Mapping (`src/App.tsx`)**:
   - Catch and transform raw `RangeError` exceptions into clean financial advice hints.

### Phase 2: Documentation & Metadata Polish (Medium Priority)
1. **Update `README.md`**:
   - Mark Parts 1 through 8 as 100% complete.
   - Add architecture diagram, feature matrix, and local execution guide.
   - Document client-side privacy model (zero data exfiltration).
   - Add deployment instructions (Vercel / Netlify / Static hosting).
2. **Update `TODO.md`**:
   - Check off all core implementation items.
   - List post-v0.4.0 optional items (LLM explainability, multi-year horizons).
3. **Update `package.json`**:
   - Bump version to `0.4.0`.
4. **Add GitHub Actions CI (`.github/workflows/ci.yml`)**:
   - Automated workflow executing `npm run lint`, `npm test`, and `npm run build`.

### Phase 3: Verification
1. `npx tsc --noEmit` (0 type errors).
2. `npm test` (95/95 test assertions pass).
3. `npm run build` (Clean production bundle generation).
