// Part 3: Scoring Function and Constraint Evaluator

import {
  ACTIONS,
  type ActionConfig,
  type DerivedState,
  type Urgency,
} from './constants';
import {
  calculateMonthlyEMI,
  simulateAllActions,
  type SimPointD,
} from './deterministic';
import { survivesShock } from './stress';

export interface ScoreBreakdown {
  safety: number;
  oppCost: number;
  delayCost: number;
  debtBurden: number;
  utility: number;
}

export interface ActionResult {
  id: string;
  label: string;
  color: string;
  timeline: SimPointD[];
  score: number;
  breakdown: ScoreBreakdown;
  disqualified: boolean;
  disqualifyReason: string | null;
  survivesShock: boolean;
}

interface RawTerms extends ScoreBreakdown {
  disqualifyReason: string | null;
}

const EPSILON = 1e-9;
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

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function safeDivide(numerator: number, denominator: number, zeroDenominator = 0): number {
  if (denominator === 0) return zeroDenominator;
  return Number.isFinite(numerator / denominator) ? numerator / denominator : zeroDenominator;
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min <= EPSILON) {
    return values.map(() => 0);
  }
  return values.map((value) => (value - min) / (max - min + EPSILON));
}

function actionConfig(id: string): ActionConfig {
  const config = ACTIONS.find((action) => action.id === id);
  if (!config) throw new Error(`Unknown action ID: "${id}"`);
  return config;
}

function waitingMonths(state: DerivedState, actionId: string): number {
  if (actionId === 'wait_3m') return 3;
  if (actionId !== 'invest_delay') return 0;

  let cash = state.liquidCash;
  const surplus = state.monthlyIncome - state.monthlyExpenses - state.existingEMI;
  for (let month = 1; month <= 12; month++) {
    cash = cash * (1 + state.monthlyInvestReturnPct) + surplus;
    const inflatedPrice = state.itemPrice * Math.pow(1 + state.monthlyInflationPct, month);
    if (cash >= inflatedPrice) return month;
  }
  return 13;
}

function capitalUsedNow(state: DerivedState, actionId: string): number {
  switch (actionId) {
    case 'buy_now': return state.itemPrice;
    case 'cheaper': return state.itemPrice * 0.70;
    case 'refurb': return state.itemPrice * 0.55;
    default: return 0;
  }
}

function newMonthlyEMI(state: DerivedState, actionId: string): number {
  return actionId === 'emi'
    ? calculateMonthlyEMI(state.itemPrice, state.emiAnnualRatePct, state.emiTenureMonths)
    : 0;
}

function rawTerms(state: DerivedState, config: ActionConfig, timeline: SimPointD[]): RawTerms {
  const earlyPoints = timeline.filter((point) => point.month <= 2);
  const negativeCash = timeline.find((point) => point.liquidCash < 0);
  const unsafeEarlyPoint = earlyPoints.find((point) => point.emergencyFundRatio < 0.5);
  const monthlyEMI = newMonthlyEMI(state, config.id);
  const dti = safeDivide(state.existingEMI + monthlyEMI, state.monthlyIncome, monthlyEMI > 0 ? 1 : 0);
  const reasons: string[] = [];

  if (negativeCash) reasons.push(`cash is negative at month ${negativeCash.month}`);
  if (unsafeEarlyPoint) reasons.push(`emergency-fund ratio is below 0.5 at month ${unsafeEarlyPoint.month}`);
  if (config.id === 'emi' && dti > 0.5) reasons.push(`EMI debt-to-income ratio is ${dti.toFixed(2)}, above 0.50`);

  const minimumSafety = timeline.length === 0
    ? 0
    : Math.min(...timeline.map((point) => point.emergencyFundRatio));
  const price = state.itemPrice;
  const used = capitalUsedNow(state, config.id);
  const waited = waitingMonths(state, config.id);
  const isImmediate = IMMEDIATE_ACTIONS.has(config.id);

  return {
    safety: clamp(minimumSafety),
    oppCost: safeDivide(used, price) * state.monthlyInvestReturnPct * 12,
    delayCost: waited * state.monthlyInflationPct + URGENCY_PENALTY[state.urgency],
    debtBurden: dti,
    utility: URGENCY_BASE[state.urgency]
      + (isImmediate ? state.utilityImmediateBonus : state.utilityDelayPenalty),
    disqualifyReason: reasons.length > 0 ? reasons.join('; ') : null,
  };
}

/** Evaluate and rank all deterministic purchasing actions. */
export function evaluateAllDeterministic(state: DerivedState): ActionResult[] {
  const timelines = simulateAllActions(state);
  const configs = ACTIONS.map((action) => actionConfig(action.id));
  const terms = configs.map((config) => rawTerms(state, config, timelines[config.id]));
  const termNames: (keyof ScoreBreakdown)[] = [
    'safety', 'oppCost', 'delayCost', 'debtBurden', 'utility',
  ];
  const normalized = Object.fromEntries(
    termNames.map((name) => [name, normalize(terms.map((term) => term[name]))]),
  ) as Record<keyof ScoreBreakdown, number[]>;

  const results = configs.map((config, index): ActionResult => {
    const breakdown: ScoreBreakdown = {
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
    const disqualified = terms[index].disqualifyReason !== null;

    return {
      id: config.id,
      label: config.label,
      color: config.color,
      timeline: timelines[config.id].map((point) => ({ ...point })),
      score,
      breakdown,
      disqualified,
      disqualifyReason: terms[index].disqualifyReason,
      survivesShock: survivesShock(state, timelines[config.id]),
    };
  });

  return results.sort((left, right) => {
    if (left.disqualified !== right.disqualified) return left.disqualified ? 1 : -1;
    return right.score - left.score;
  });
}