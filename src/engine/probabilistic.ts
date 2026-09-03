// Part 4: Probabilistic Monte Carlo Engine

import {
  ACTIONS,
  SHOCK_PARAMS,
  type ActionConfig,
  type DerivedState,
  type Urgency,
} from './constants';
import {
  calculateMonthlyEMI,
  simulateAction,
  type SimPointD,
} from './deterministic';
import { applyShock } from './stress';

export const DEFAULT_RUNS = 300;
const MONTHS = 13;
const EXPENSE_SHOCK_PROBABILITY = 0.06;
const EPSILON = 1e-9;

export interface SimPointP {
  month: number;
  p10: number;
  p50: number;
  p90: number;
  efP10: number;
  efP50: number;
  efP90: number;
}

export interface ProbabilisticScoreBreakdown {
  safety: number;
  oppCost: number;
  delayCost: number;
  debtBurden: number;
  utility: number;
}

export interface ProbabilisticActionResult {
  id: string;
  label: string;
  color: string;
  timeline: SimPointP[];
  score: number;
  breakdown: ProbabilisticScoreBreakdown;
  disqualified: boolean;
  disqualifyReason: string | null;
  survivesShock: boolean;
}

interface MonteCarloRun {
  timeline: SimPointD[];
  survivesShock: boolean;
}

interface RawTerms extends ProbabilisticScoreBreakdown {
  disqualifyReason: string | null;
}

const IMMEDIATE_ACTIONS = new Set(['buy_now', 'emi', 'cheaper', 'refurb']);
const URGENCY_BASE: Record<Urgency, number> = {
  urgent: 1.0,
  can_wait: 0.5,
  nice_to_have: 0.2,
};
const URGENCY_PENALTY: Record<Urgency, number> = {
  urgent: 0.4,
  can_wait: 0.15,
  nice_to_have: 0.0,
};

/** Generate a normally distributed sample using the Box-Muller transform. */
export function gaussianRandom(mean: number, stdDev: number): number {
  if (stdDev === 0) return mean;
  let first = 0;
  while (first === 0) first = Math.random();
  const second = Math.random();
  const standardNormal = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  return mean + standardNormal * stdDev;
}

function percentile(sortedValues: number[], fraction: number): number {
  const index = Math.min(sortedValues.length - 1, Math.floor(fraction * sortedValues.length));
  return sortedValues[index];
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min <= EPSILON) {
    return values.map(() => 0);
  }
  return values.map((value) => (value - min) / (max - min + EPSILON));
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function safeDivide(numerator: number, denominator: number, zeroDenominator = 0): number {
  if (denominator === 0) return zeroDenominator;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : zeroDenominator;
}

function sampleInputs(state: DerivedState): { income: number[]; expenses: number[] } {
  const income = Array.from({ length: MONTHS }, () => Math.max(
    0,
    gaussianRandom(state.monthlyIncome, state.monthlyIncome * state.incomeVariancePct),
  ));
  const expenses = Array.from({ length: MONTHS }, () => (
    state.monthlyExpenses
    + (Math.random() < EXPENSE_SHOCK_PROBABILITY ? SHOCK_PARAMS.surpriseExpense : 0)
  ));
  return { income, expenses };
}

function runMonteCarlo(actionId: string, state: DerivedState, runs: number): MonteCarloRun[] {
  if (!Number.isInteger(runs) || runs <= 0) {
    throw new RangeError('Monte Carlo runs must be a positive integer');
  }

  return Array.from({ length: runs }, () => {
    const sampled = sampleInputs(state);
    const timeline = simulateAction(actionId, state, sampled.income, sampled.expenses);
    const shockedTimeline = applyShock(state, timeline);
    const survived = shockedTimeline.every((point) => point.emergencyFundRatio >= 0.5);
    return { timeline, survivesShock: survived };
  });
}

function buildPercentileTimeline(runs: MonteCarloRun[]): SimPointP[] {
  return Array.from({ length: MONTHS }, (_, month) => {
    const cashValues = runs.map((run) => run.timeline[month].liquidCash).sort((a, b) => a - b);
    const ratioValues = runs.map((run) => run.timeline[month].emergencyFundRatio).sort((a, b) => a - b);
    return {
      month,
      p10: percentile(cashValues, 0.10),
      p50: percentile(cashValues, 0.50),
      p90: percentile(cashValues, 0.90),
      efP10: percentile(ratioValues, 0.10),
      efP50: percentile(ratioValues, 0.50),
      efP90: percentile(ratioValues, 0.90),
    };
  });
}

/** Run Monte Carlo simulations and return monthly percentile bands. */
export function simulateActionMC(
  actionId: string,
  state: DerivedState,
  runs = DEFAULT_RUNS,
): SimPointP[] {
  return buildPercentileTimeline(runMonteCarlo(actionId, state, runs));
}

function waitingMonths(state: DerivedState, actionId: string): number {
  if (actionId === 'wait_3m') return 3;
  if (actionId !== 'invest_delay') return 0;

  let cash = state.liquidCash;
  const surplus = state.monthlyIncome - state.monthlyExpenses - state.existingEMI;
  for (let month = 1; month <= 12; month++) {
    cash = cash * (1 + state.monthlyInvestReturnPct) + surplus;
    const price = state.itemPrice * Math.pow(1 + state.monthlyInflationPct, month);
    if (cash >= price) return month;
  }
  return 13;
}

function capitalUsedNow(state: DerivedState, actionId: string): number {
  if (actionId === 'buy_now') return state.itemPrice;
  if (actionId === 'cheaper') return state.itemPrice * 0.70;
  if (actionId === 'refurb') return state.itemPrice * 0.55;
  return 0;
}

function rawTerms(state: DerivedState, config: ActionConfig, runs: MonteCarloRun[]): RawTerms {
  const medianTimeline = buildPercentileTimeline(runs);
  const medianPoints = medianTimeline.map((point) => ({
    month: point.month,
    liquidCash: point.p50,
    emergencyFundRatio: point.efP50,
    debtBalance: 0,
  }));
  const negativeCash = medianPoints.find((point) => point.liquidCash < 0);
  const unsafeEarly = medianPoints.find((point) => point.month <= 2 && point.emergencyFundRatio < 0.5);
  const monthlyEMI = config.id === 'emi'
    ? calculateMonthlyEMI(state.itemPrice, state.emiAnnualRatePct, state.emiTenureMonths)
    : 0;
  const dti = safeDivide(state.existingEMI + monthlyEMI, state.monthlyIncome, monthlyEMI > 0 ? 1 : 0);
  const reasons: string[] = [];
  if (negativeCash) reasons.push(`median cash is negative at month ${negativeCash.month}`);
  if (unsafeEarly) reasons.push(`median emergency-fund ratio is below 0.5 at month ${unsafeEarly.month}`);
  if (config.id === 'emi' && dti > 0.5) reasons.push(`EMI debt-to-income ratio is ${dti.toFixed(2)}, above 0.50`);

  const survivalCount = runs.filter((run) => run.timeline.every((point) => point.emergencyFundRatio >= 1.0)).length;
  const capital = capitalUsedNow(state, config.id);
  const waited = waitingMonths(state, config.id);
  const isImmediate = IMMEDIATE_ACTIONS.has(config.id);
  return {
    safety: safeDivide(survivalCount, runs.length),
    oppCost: safeDivide(capital, state.itemPrice) * state.monthlyInvestReturnPct * 12,
    delayCost: waited * state.monthlyInflationPct + URGENCY_PENALTY[state.urgency],
    debtBurden: dti,
    utility: URGENCY_BASE[state.urgency]
      + (isImmediate ? state.utilityImmediateBonus : state.utilityDelayPenalty),
    disqualifyReason: reasons.length > 0 ? reasons.join('; ') : null,
  };
}

/** Evaluate all actions using probabilistic timelines and survival probabilities. */
export function evaluateAllProbabilistic(
  state: DerivedState,
  runs = DEFAULT_RUNS,
): ProbabilisticActionResult[] {
  const simulations = ACTIONS.map((action) => ({
    config: action,
    runs: runMonteCarlo(action.id, state, runs),
  }));
  const terms = simulations.map(({ config, runs: actionRuns }) => rawTerms(state, config, actionRuns));
  const normalized: Record<keyof ProbabilisticScoreBreakdown, number[]> = {
    safety: normalize(terms.map((term) => term.safety)),
    oppCost: normalize(terms.map((term) => term.oppCost)),
    delayCost: normalize(terms.map((term) => term.delayCost)),
    debtBurden: normalize(terms.map((term) => term.debtBurden)),
    utility: normalize(terms.map((term) => term.utility)),
  };

  const results = simulations.map(({ config, runs: actionRuns }, index): ProbabilisticActionResult => {
    const breakdown: ProbabilisticScoreBreakdown = {
      safety: normalized.safety[index],
      oppCost: normalized.oppCost[index],
      delayCost: normalized.delayCost[index],
      debtBurden: normalized.debtBurden[index],
      utility: normalized.utility[index],
    };
    const score = clamp(
      state.weights.w1 * breakdown.safety
      - state.weights.w2 * breakdown.oppCost
      - state.weights.w3 * breakdown.delayCost
      - state.weights.w4 * breakdown.debtBurden
      + state.weights.w5 * breakdown.utility,
    );
    return {
      id: config.id,
      label: config.label,
      color: config.color,
      timeline: buildPercentileTimeline(actionRuns),
      score,
      breakdown,
      disqualified: terms[index].disqualifyReason !== null,
      disqualifyReason: terms[index].disqualifyReason,
      survivesShock: actionRuns.filter((run) => run.survivesShock).length >= actionRuns.length / 2,
    };
  });

  return results.sort((left, right) => {
    if (left.disqualified !== right.disqualified) return left.disqualified ? 1 : -1;
    return right.score - left.score;
  });
}