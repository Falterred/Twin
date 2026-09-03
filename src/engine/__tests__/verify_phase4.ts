import {
  buildDerivedState,
  DEFAULT_RAW_INPUTS,
} from '../constants';
import {
  DEFAULT_RUNS,
  evaluateAllProbabilistic,
  gaussianRandom,
  simulateActionMC,
} from '../probabilistic';

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

console.log('\nPart 4: Probabilistic engine');
const state = buildDerivedState(DEFAULT_RAW_INPUTS);
const timeline = simulateActionMC('buy_now', state);
assert(timeline.length === 13, 'Default Monte Carlo timeline has 13 points');
assert(timeline[0].month === 0 && timeline[12].month === 12, 'Timeline months span 0 through 12');
assert(timeline.every((point) => point.p10 <= point.p50 && point.p50 <= point.p90), 'Cash percentiles are ordered');
assert(timeline.every((point) => point.efP10 <= point.efP50 && point.efP50 <= point.efP90), 'Emergency-fund percentiles are ordered');
assert(DEFAULT_RUNS === 300, 'Default run count is 300');
assert(simulateActionMC('emi', state, 1).every((point) => point.p10 === point.p50 && point.p50 === point.p90), 'Single-run percentiles are identical');
assert(expectThrows(() => simulateActionMC('buy_now', state, 0)), 'Non-positive runs are rejected');

assert(gaussianRandom(123, 0) === 123, 'Zero-deviation Gaussian returns its mean');
assert(expectThrows(() => gaussianRandom(Number.NaN, 1)), 'Invalid Gaussian mean is rejected');
assert(expectThrows(() => gaussianRandom(0, -1)), 'Invalid Gaussian deviation is rejected');
const gaussianSamples = Array.from({ length: 2_000 }, () => gaussianRandom(0, 1));
const sampleMean = gaussianSamples.reduce((sum, value) => sum + value, 0) / gaussianSamples.length;
const sampleVariance = gaussianSamples.reduce((sum, value) => sum + value ** 2, 0) / gaussianSamples.length - sampleMean ** 2;
assert(Math.abs(sampleMean) < 0.12 && Math.abs(Math.sqrt(sampleVariance) - 1) < 0.12, 'Gaussian samples approximate N(0, 1)');

const results = evaluateAllProbabilistic(state, 20);
assert(results.length === 6, 'Probabilistic evaluation returns six actions');
assert(results.every((result) => result.timeline.length === 13), 'Probabilistic results contain 13-point timelines');
assert(results.every((result) => Number.isFinite(result.score) && result.score >= 0 && result.score <= 1), 'Probabilistic scores are finite and clamped');
assert(results.every((result) => Object.values(result.breakdown).every(Number.isFinite)), 'Probabilistic breakdowns are finite');
const firstDisqualified = results.findIndex((result) => result.disqualified);
assert(firstDisqualified === -1 || results.slice(firstDisqualified).every((result) => result.disqualified), 'Disqualified results are ranked last');
assert(results.every((result) => typeof result.survivesShock === 'boolean'), 'Shock survival status is present');

const zeroState = buildDerivedState({ ...DEFAULT_RAW_INPUTS, monthlyIncome: 0, monthlyExpenses: 0 });
const zeroResults = evaluateAllProbabilistic(zeroState, 5);
assert(zeroResults.every((result) => Object.values(result.breakdown).every(Number.isFinite)), 'Zero income and expenses remain finite');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} verification test(s) failed`);