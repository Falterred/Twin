import {
  buildDerivedState,
  DEFAULT_RAW_INPUTS,
} from '../constants';
import { evaluateAllDeterministic, type ActionResult } from '../scoring';
import { findCounterfactual } from '../counterfactual';

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

function snapshot(results: ActionResult[]) {
  return results.map((result) => ({
    id: result.id,
    score: result.score,
    disqualified: result.disqualified,
    timeline: JSON.stringify(result.timeline),
  }));
}

console.log('\nPart 6: Counterfactual search');
const state = buildDerivedState(DEFAULT_RAW_INPUTS);
const results = evaluateAllDeterministic(state);
const before = snapshot(results);
const counterfactual = findCounterfactual(state, results);

assert(findCounterfactual(state, results) === null || Number.isFinite(findCounterfactual(state, results)!.delta), 'Result is null or has a finite delta');
assert(counterfactual === null || counterfactual.delta >= 0, 'Returned delta is non-negative');
assert(
  counterfactual === null || ['liquidCash', 'emergencyFundMonths', 'itemPrice'].includes(counterfactual.field),
  'Returned field is supported',
);
assert(counterfactual === null || results.some((result) => result.id === counterfactual.wouldFlipTo), 'Replacement action ID is valid');
assert(JSON.stringify(snapshot(results)) === JSON.stringify(before), 'Input results remain unchanged');

const oneAction = results.slice(0, 1);
assert(findCounterfactual(state, oneAction) === null, 'Fewer than two eligible actions returns null');

const allDisqualified = results.map((result) => ({ ...result, disqualified: true }));
assert(findCounterfactual(state, allDisqualified) === null, 'No eligible actions returns null');

const invalidState = buildDerivedState({ ...DEFAULT_RAW_INPUTS, itemPrice: 0 });
assert(findCounterfactual(invalidState, evaluateAllDeterministic(invalidState)) === null, 'Zero item price returns null');

if (counterfactual) {
  const probedInputs = { ...DEFAULT_RAW_INPUTS };
  if (counterfactual.field === 'itemPrice') {
    probedInputs.itemPrice -= counterfactual.delta;
  } else {
    probedInputs[counterfactual.field] += counterfactual.delta;
  }
  const probedTop = evaluateAllDeterministic(buildDerivedState(probedInputs)).find((result) => !result.disqualified);
  assert(probedTop?.id === counterfactual.wouldFlipTo, 'Applying the returned delta changes the top action');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} verification test(s) failed`);