import {
  buildDerivedState,
  DEFAULT_RAW_INPUTS,
  SHOCK_PARAMS,
} from '../constants';
import { simulateAction } from '../deterministic';
import { evaluateAllDeterministic } from '../scoring';
import { applyShock, survivesShock } from '../stress';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

function expectThrows(action: () => void): boolean {
  try {
    action();
    return false;
  } catch {
    return true;
  }
}

const state = buildDerivedState(DEFAULT_RAW_INPUTS);
const results = evaluateAllDeterministic(state);

console.log('\nPart 3: Scoring and constraints');
assert(results.length === 6, 'Returns six action results');
assert(results.every((result) => result.timeline.length === 13), 'Every result has 13 timeline points');
assert(results.every((result) => Number.isFinite(result.score) && result.score >= 0 && result.score <= 1), 'Scores are finite and clamped');
assert(results.every((result) => Object.values(result.breakdown).every(Number.isFinite)), 'Breakdowns are finite');
const firstDisqualified = results.findIndex((result) => result.disqualified);
const validResults = firstDisqualified === -1 ? results : results.slice(0, firstDisqualified);
assert(
  validResults.every((result, index) => index === 0 || validResults[index - 1].score >= result.score),
  'Valid results are ranked by descending score',
);
assert(
  firstDisqualified === -1 || results.slice(firstDisqualified).every((result) => result.disqualified),
  'Disqualified results remain after valid results',
);

const lowCash = buildDerivedState({ ...DEFAULT_RAW_INPUTS, liquidCash: 20_000 });
const lowCashBuy = evaluateAllDeterministic(lowCash).find((result) => result.id === 'buy_now');
assert(lowCashBuy?.disqualified === true && Boolean(lowCashBuy.disqualifyReason), 'Negative cash disqualifies with a reason');

const lowSafety = buildDerivedState({ ...DEFAULT_RAW_INPUTS, liquidCash: 100_000 });
const lowSafetyBuy = evaluateAllDeterministic(lowSafety).find((result) => result.id === 'buy_now');
assert(lowSafetyBuy?.disqualified === true && Boolean(lowSafetyBuy.disqualifyReason?.includes('emergency-fund')), 'Early safety breach disqualifies');

const highDti = buildDerivedState({ ...DEFAULT_RAW_INPUTS, monthlyIncome: 10_000 });
const highDtiEmi = evaluateAllDeterministic(highDti).find((result) => result.id === 'emi');
assert(highDtiEmi?.disqualified === true && Boolean(highDtiEmi.disqualifyReason?.includes('debt-to-income')), 'High EMI DTI disqualifies');

const zeroIncomeResults = evaluateAllDeterministic(buildDerivedState({ ...DEFAULT_RAW_INPUTS, monthlyIncome: 0 }));
assert(zeroIncomeResults.every((result) => Object.values(result.breakdown).every(Number.isFinite)), 'Zero income remains finite');
assert(evaluateAllDeterministic(buildDerivedState({ ...DEFAULT_RAW_INPUTS, itemPrice: 0 })).every((result) => Number.isFinite(result.score)), 'Equal normalization values remain finite');
assert(
  JSON.stringify(evaluateAllDeterministic(buildDerivedState({ ...DEFAULT_RAW_INPUTS, riskProfile: 'conservative' }))) !==
  JSON.stringify(evaluateAllDeterministic(buildDerivedState({ ...DEFAULT_RAW_INPUTS, riskProfile: 'aggressive' }))),
  'Risk profiles affect evaluation',
);

console.log('\nPart 5: Stress test');
const baseTimeline = simulateAction('buy_now', state);
const original = baseTimeline.map((point) => ({ ...point }));
const shocked = applyShock(state, baseTimeline);
const expectedShock = state.monthlyIncome * SHOCK_PARAMS.incomeDropPct + SHOCK_PARAMS.surpriseExpense;
assert(shocked[0].liquidCash === original[0].liquidCash, 'Month 0 remains unchanged');
assert(shocked[1].liquidCash === original[1].liquidCash, 'Shock starts at month 2');
assert(shocked[2].liquidCash === original[2].liquidCash - expectedShock, 'Shock includes lost income and surprise expense');
assert(shocked.slice(2).every((point, index) => point.liquidCash === original[index + 2].liquidCash - expectedShock), 'Shock propagates through months 2 through 12');
assert(shocked.every((point) => point.emergencyFundRatio === point.liquidCash / state.emergencyFundTargetRs), 'Shocked ratios are recalculated');
assert(JSON.stringify(baseTimeline) === JSON.stringify(original), 'Original timeline is unchanged');
assert(shocked[0] !== baseTimeline[0] && shocked[12] !== baseTimeline[12], 'Timeline points are cloned');
assert(shocked.every((point, index) => point.debtBalance === original[index].debtBalance), 'Debt balances are preserved');
assert(survivesShock(state, baseTimeline) === false, 'Default buy-now path fails the shock');
assert(survivesShock(buildDerivedState({ ...DEFAULT_RAW_INPUTS, liquidCash: 400_000 }), simulateAction('buy_now', buildDerivedState({ ...DEFAULT_RAW_INPUTS, liquidCash: 400_000 }))), 'High cash path survives the shock');
assert(survivesShock(state, []) === false, 'Empty timelines fail safely');
let rejectedInvalidTarget = false;
try {
  buildDerivedState({ ...DEFAULT_RAW_INPUTS, monthlyExpenses: Number.NaN });
} catch (error) {
  rejectedInvalidTarget = error instanceof RangeError;
}
assert(rejectedInvalidTarget, 'Invalid emergency-fund targets fail safely');
assert(expectThrows(() => applyShock(state, baseTimeline.slice(0, 12))), 'Malformed timelines are rejected');

const normal = evaluateAllDeterministic(state);
const evaluationSnapshot = normal.map((result) => ({
  id: result.id,
  score: result.score,
  breakdown: { ...result.breakdown },
}));
normal.forEach((result) => {
  applyShock(state, result.timeline);
  survivesShock(state, result.timeline);
});
assert(normal.every((result, index) => result.id === evaluationSnapshot[index].id), 'Shock does not change ranking');
assert(normal.every((result, index) => result.score === evaluationSnapshot[index].score), 'Shock does not change scores');
assert(normal.every((result, index) => JSON.stringify(result.breakdown) === JSON.stringify(evaluationSnapshot[index].breakdown)), 'Shock does not change score breakdowns');
assert(normal.every((result) => typeof result.survivesShock === 'boolean'), 'Shock status is present without changing evaluation');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} verification test(s) failed`);