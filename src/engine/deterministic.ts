// ─────────────────────────────────────────────────────────────
// Part 2: Deterministic Simulation Engine
// Ref: Twin/Plan/02_deterministic_engine.md
// ─────────────────────────────────────────────────────────────

import { ACTIONS, type DerivedState } from './constants';

// ───── Type Definitions ─────

export interface SimPointD {
  month: number;              // 0..12
  liquidCash: number;         // Projected liquid cash at end of month t (₹)
  emergencyFundRatio: number; // liquidCash / emergencyFundTargetRs
  debtBalance: number;        // Outstanding loan principal at month t (₹)
}

// ───── Helpers ─────

/**
 * Standard amortization formula.
 * Returns the fixed monthly EMI payment for a given principal, annual rate,
 * and tenure.  For zero-rate (no-cost) EMIs, falls back to simple division.
 */
export function calculateMonthlyEMI(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  if (!Number.isFinite(principal) || principal < 0
    || !Number.isFinite(annualRatePct) || annualRatePct < 0
    || !Number.isFinite(tenureMonths) || tenureMonths < 0
    || !Number.isInteger(tenureMonths)) {
    throw new RangeError('EMI inputs must be finite, non-negative, and tenure must be an integer');
  }
  if (tenureMonths === 0) return principal; // edge: instant payoff
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const compounded = Math.pow(1 + r, tenureMonths);
  return principal * (r * compounded) / (compounded - 1);
}

// ───── Per-Action Simulators ─────

function simulateBuyNow(state: DerivedState, income: number[], expenses: number[]): SimPointD[] {
  const pts: SimPointD[] = [];
  let cash = state.liquidCash - state.itemPrice;

  pts.push({
    month: 0,
    liquidCash: cash,
    emergencyFundRatio: cash / state.emergencyFundTargetRs,
    debtBalance: 0,
  });

  for (let t = 1; t <= 12; t++) {
    const surplus = income[t] - expenses[t] - state.existingEMI;
    cash += surplus;
    pts.push({
      month: t,
      liquidCash: cash,
      emergencyFundRatio: cash / state.emergencyFundTargetRs,
      debtBalance: 0,
    });
  }
  return pts;
}

function simulateEMI(state: DerivedState, income: number[], expenses: number[]): SimPointD[] {
  const pts: SimPointD[] = [];
  const r = state.emiAnnualRatePct / 12 / 100;
  const n = state.emiTenureMonths;
  const monthlyEMI = calculateMonthlyEMI(state.itemPrice, state.emiAnnualRatePct, n);

  let cash = state.liquidCash;
  let debt = state.itemPrice;

  pts.push({
    month: 0,
    liquidCash: cash,
    emergencyFundRatio: cash / state.emergencyFundTargetRs,
    debtBalance: debt,
  });

  for (let t = 1; t <= 12; t++) {
    const surplus = income[t] - expenses[t] - state.existingEMI;

    if (t <= n) {
      const interest = debt * r;
      const principalPaid = monthlyEMI - interest;
      debt = Math.max(0, debt - principalPaid);
      cash = cash + surplus - monthlyEMI;
    } else {
      debt = 0;
      cash = cash + surplus;
    }

    pts.push({
      month: t,
      liquidCash: cash,
      emergencyFundRatio: cash / state.emergencyFundTargetRs,
      debtBalance: debt,
    });
  }
  return pts;
}

function simulateWait3M(state: DerivedState, income: number[], expenses: number[]): SimPointD[] {
  const pts: SimPointD[] = [];
  let cash = state.liquidCash;

  pts.push({
    month: 0,
    liquidCash: cash,
    emergencyFundRatio: cash / state.emergencyFundTargetRs,
    debtBalance: 0,
  });

  for (let t = 1; t <= 12; t++) {
    const surplus = income[t] - expenses[t] - state.existingEMI;
    cash += surplus;

    // Inflation-adjusted price deducted at month 3
    if (t === 3) {
      const inflatedPrice = state.itemPrice * Math.pow(1 + state.monthlyInflationPct, 3);
      cash -= inflatedPrice;
    }

    pts.push({
      month: t,
      liquidCash: cash,
      emergencyFundRatio: cash / state.emergencyFundTargetRs,
      debtBalance: 0,
    });
  }
  return pts;
}

function simulateCheaper(state: DerivedState, income: number[], expenses: number[]): SimPointD[] {
  const pts: SimPointD[] = [];
  const cheaperPrice = state.itemPrice * 0.70;
  let cash = state.liquidCash - cheaperPrice;

  pts.push({
    month: 0,
    liquidCash: cash,
    emergencyFundRatio: cash / state.emergencyFundTargetRs,
    debtBalance: 0,
  });

  for (let t = 1; t <= 12; t++) {
    const surplus = income[t] - expenses[t] - state.existingEMI;
    cash += surplus;
    pts.push({
      month: t,
      liquidCash: cash,
      emergencyFundRatio: cash / state.emergencyFundTargetRs,
      debtBalance: 0,
    });
  }
  return pts;
}

function simulateRefurb(state: DerivedState, income: number[], expenses: number[]): SimPointD[] {
  const pts: SimPointD[] = [];
  const refurbPrice = state.itemPrice * 0.55;
  const repairCost = refurbPrice * 0.30;
  let cash = state.liquidCash - refurbPrice;

  pts.push({
    month: 0,
    liquidCash: cash,
    emergencyFundRatio: cash / state.emergencyFundTargetRs,
    debtBalance: 0,
  });

  for (let t = 1; t <= 12; t++) {
    const surplus = income[t] - expenses[t] - state.existingEMI;
    cash += surplus;

    // Repair cost dip injected at month 8
    if (t === 8) {
      cash -= repairCost;
    }

    pts.push({
      month: t,
      liquidCash: cash,
      emergencyFundRatio: cash / state.emergencyFundTargetRs,
      debtBalance: 0,
    });
  }
  return pts;
}

function simulateInvestDelay(state: DerivedState, income: number[], expenses: number[]): SimPointD[] {
  const pts: SimPointD[] = [];
  let cash = state.liquidCash;
  let affordMonth = 13; // sentinel: never affordable within horizon

  pts.push({
    month: 0,
    liquidCash: cash,
    emergencyFundRatio: cash / state.emergencyFundTargetRs,
    debtBalance: 0,
  });

  // Phase 1: Compound growth until we can afford the inflated price
  for (let t = 1; t <= 12; t++) {
    const surplus = income[t] - expenses[t] - state.existingEMI;
    cash = cash * (1 + state.monthlyInvestReturnPct) + surplus;

    const inflatedPrice = state.itemPrice * Math.pow(1 + state.monthlyInflationPct, t);
    if (affordMonth === 13 && cash >= inflatedPrice) {
      affordMonth = t;
      cash -= inflatedPrice;
    }

    pts.push({
      month: t,
      liquidCash: cash,
      emergencyFundRatio: cash / state.emergencyFundTargetRs,
      debtBalance: 0,
    });
  }

  return pts;
}

// ───── Master Dispatcher ─────

const ACTION_SIMULATORS: Record<string, (state: DerivedState, income: number[], expenses: number[]) => SimPointD[]> = {
  buy_now: simulateBuyNow,
  emi: simulateEMI,
  wait_3m: simulateWait3M,
  cheaper: simulateCheaper,
  refurb: simulateRefurb,
  invest_delay: simulateInvestDelay,
};

/**
 * Simulate a single action's 13-month trajectory.
 *
 * Optional `overrideIncome` and `overrideExpenses` arrays (length 13, t=0..12)
 * allow the Monte Carlo engine in Part 4 to inject sampled variance without
 * duplicating any simulation logic.
 */
export function simulateAction(
  actionId: string,
  state: DerivedState,
  overrideIncome?: number[],
  overrideExpenses?: number[],
): SimPointD[] {
  const income = overrideIncome ?? Array(13).fill(state.monthlyIncome);
  const expenses = overrideExpenses ?? Array(13).fill(state.monthlyExpenses);

  const hasInvalidOverride = (values: number[]): boolean => Array.from({ length: 13 }, (_, index) => (
    !Object.prototype.hasOwnProperty.call(values, index) || !Number.isFinite(values[index])
  )).some(Boolean);
  if (income.length !== 13 || expenses.length !== 13
    || hasInvalidOverride(income) || hasInvalidOverride(expenses)) {
    throw new RangeError('Income and expense overrides must contain 13 monthly values');
  }

  const simulator = ACTION_SIMULATORS[actionId];
  if (!simulator) {
    throw new Error(`Unknown action ID: "${actionId}"`);
  }
  return simulator(state, income, expenses);
}

/**
 * Run deterministic simulations for all 6 actions and return a keyed map
 * of their timelines.
 */
export function simulateAllActions(
  state: DerivedState,
): Record<string, SimPointD[]> {
  const result: Record<string, SimPointD[]> = {};
  for (const action of ACTIONS) {
    result[action.id] = simulateAction(action.id, state);
  }
  return result;
}
