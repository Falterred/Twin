// Part 6: Counterfactual Explanation Search

import {
  buildDerivedState,
  type DerivedState,
  type RawInputs,
} from './constants';
import { evaluateAllDeterministic, type ActionResult } from './scoring';

const SEARCH_ITERATIONS = 15;
const CANDIDATE_FIELDS = ['liquidCash', 'emergencyFundMonths', 'itemPrice'] as const;
type CandidateField = typeof CANDIDATE_FIELDS[number];

export interface CounterfactualResult {
  field: CandidateField;
  delta: number;
  wouldFlipTo: string;
}

function topValidAction(results: ActionResult[]): ActionResult | undefined {
  return results
    .filter((result) => !result.disqualified)
    .sort((left, right) => right.score - left.score)[0];
}

function probeInputs(state: DerivedState, field: CandidateField, delta: number): RawInputs {
  const rawInputs: RawInputs = { ...state };

  if (field === 'itemPrice') {
    rawInputs.itemPrice = state.itemPrice - delta;
  } else {
    rawInputs[field] = state[field] + delta;
  }

  return rawInputs;
}

function findFieldCounterfactual(
  state: DerivedState,
  originalTopId: string,
  replacementId: string,
  field: CandidateField,
): CounterfactualResult | null {
  if (!Number.isFinite(state.itemPrice) || state.itemPrice <= 0) return null;

  const changesWinner = (delta: number): boolean => {
    const testState = buildDerivedState(probeInputs(state, field, delta));
    const nextTop = topValidAction(evaluateAllDeterministic(testState));
    return nextTop !== undefined && nextTop.id !== originalTopId;
  };

  const upperBound = state.itemPrice;
  if (!changesWinner(upperBound)) return null;

  let lo = 0;
  let hi = upperBound;
  for (let iteration = 0; iteration < SEARCH_ITERATIONS; iteration++) {
    const mid = (lo + hi) / 2;
    if (changesWinner(mid)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  if (!changesWinner(hi) || !Number.isFinite(hi) || hi < 0) return null;

  const finalState = buildDerivedState(probeInputs(state, field, hi));
  const finalTop = topValidAction(evaluateAllDeterministic(finalState));
  if (!finalTop || finalTop.id === originalTopId) return null;

  return {
    field,
    delta: hi,
    wouldFlipTo: finalTop.id || replacementId,
  };
}

/** Find the smallest supported input change that changes the recommendation. */
export function findCounterfactual(
  state: DerivedState,
  results: ActionResult[],
): CounterfactualResult | null {
  const eligible = results
    .filter((result) => !result.disqualified)
    .sort((left, right) => right.score - left.score);
  const originalTop = eligible[0];
  const originalSecond = eligible[1];
  if (!originalTop || !originalSecond) return null;

  for (const field of CANDIDATE_FIELDS) {
    const result = findFieldCounterfactual(state, originalTop.id, originalSecond.id, field);
    if (result) return result;
  }

  return null;
}