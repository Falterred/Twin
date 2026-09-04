# Part 5: Stress-Test Shock Layer

### Reasoning & Dependencies
Part 5 tests whether an action can survive a severe single-month adverse financial event (month 2 shock). It operates on both deterministic timelines and probabilistic median `p50` paths.

### Input / Output Contracts
* **Inputs**: `DerivedState`, action timeline (`SimPointD[]` or `SimPointP[]`).
* **Outputs**: `survivesShock: boolean` flag added to `ActionResult`.

### Exact Implementation Steps
1. **Implement `applyShock(state, timeline)`**:
   * Clone timeline.
   * Inject adverse shock at month 2: deduct $(\text{monthlyIncome} + 15000)$ from `liquidCash`.
   * Propagate balance reduction forward through months $t=3 \dots 12$.
2. **Evaluate Survival**:
   * Re-evaluate `shockedEmergencyFundRatio[t] = shockedCash[t] / emergencyFundTargetRs`.
   * `survivesShock = min(shockedEmergencyFundRatio[0..12]) >= 0.5`.

### Isolated Testing Strategy
* Test with high vs low initial savings: verify high savings pass shock (`survivesShock = true`) while low savings flag caution (`survivesShock = false`).
* Invariant check: verify failing shock test DOES NOT alter the action's calculated score or rank, only setting `survivesShock = false`.

### Explicitly Flagged Ambiguities
> [!NOTE]
> Spec Section 6 pseudo-code applies $(\text{monthlyIncome} + 15000)$ shock at month 2, combining income loss with expense surprise to test worst-case resilience.

### Implementation Decisions
- `applyShock` returns a deep-cloned timeline and never mutates its input.
- The shock reduction is applied at month 2 and carried through months 3-12; month and debt values are preserved.
- Shock status is informational and does not alter scores, score breakdowns, or ranking.
- Invalid emergency-fund targets produce a failed survival result rather than `NaN` or `Infinity`.
- Stress-test timelines must contain exactly 13 finite points for months 0 through 12; malformed timelines are rejected.
- Invalid financial state inputs are rejected at the Part 1 boundary before stress evaluation.
