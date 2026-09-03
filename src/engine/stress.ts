// Part 5: Stress-Test Shock Layer

import { SHOCK_PARAMS, type DerivedState } from './constants';
import type { SimPointD } from './deterministic';

const FIRST_MONTH = 0;

function safeEmergencyFundRatio(cash: number, target: number): number {
  if (target <= 0) return Number.NEGATIVE_INFINITY;
  return cash / target;
}

/** Return a shocked copy of a deterministic timeline. */
export function applyShock(
  state: DerivedState,
  timeline: SimPointD[],
): SimPointD[] {
  const shockAmount =
    state.monthlyIncome * SHOCK_PARAMS.incomeDropPct + SHOCK_PARAMS.surpriseExpense;
  const shockMonth = SHOCK_PARAMS.month;

  return timeline.map((point) => {
    const shockedCash = point.month >= shockMonth
      ? point.liquidCash - shockAmount
      : point.liquidCash;

    return {
      ...point,
      liquidCash: shockedCash,
      emergencyFundRatio: safeEmergencyFundRatio(
        shockedCash,
        state.emergencyFundTargetRs,
      ),
    };
  });
}

/** Determine whether the shocked path maintains half of the target fund. */
export function survivesShock(
  state: DerivedState,
  timeline: SimPointD[],
): boolean {
  if (timeline.length === FIRST_MONTH || state.emergencyFundTargetRs <= 0) {
    return false;
  }

  return applyShock(state, timeline).every((point) => point.emergencyFundRatio >= 0.5);
}