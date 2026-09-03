// Part 5: Stress-Test Shock Layer

import { SHOCK_PARAMS, type DerivedState } from './constants';
import type { SimPointD } from './deterministic';

const FIRST_MONTH = 0;
const LAST_MONTH = 12;

function safeEmergencyFundRatio(cash: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return cash / target;
}

function validateTimeline(timeline: SimPointD[]): void {
  if (timeline.length !== LAST_MONTH + 1) {
    throw new RangeError('Stress-test timelines must contain 13 monthly points');
  }

  timeline.forEach((point, index) => {
    if (
      point.month !== index
      || !Number.isFinite(point.liquidCash)
      || !Number.isFinite(point.emergencyFundRatio)
      || !Number.isFinite(point.debtBalance)
    ) {
      throw new RangeError('Stress-test timelines must contain finite points for months 0 through 12');
    }
  });
}

/** Return a shocked copy of a deterministic timeline. */
export function applyShock(
  state: DerivedState,
  timeline: SimPointD[],
): SimPointD[] {
  validateTimeline(timeline);

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

  if (!Number.isFinite(state.emergencyFundTargetRs)) return false;

  return applyShock(state, timeline).every((point) => point.emergencyFundRatio >= 0.5);
}