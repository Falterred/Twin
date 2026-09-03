// ─────────────────────────────────────────────────────────────
// Phase 1 Verification Script
// Run: npx tsx src/engine/__tests__/verify_phase1.ts
// ─────────────────────────────────────────────────────────────

import {
  buildDerivedState,
  DEFAULT_RAW_INPUTS,
} from '../constants';

import {
  calculateMonthlyEMI,
  simulateAction,
  simulateAllActions,
} from '../deterministic';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function approxEq(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) < eps;
}

// ═══════════════════════════════════════════════════════
//  Part 1: Constants & Derived State
// ═══════════════════════════════════════════════════════
console.log('\n══════ Part 1: buildDerivedState ══════');

const ds = buildDerivedState(DEFAULT_RAW_INPUTS);

// Test 0: Current Emergency Fund
assert(
  ds.currentEmergencyFund === DEFAULT_RAW_INPUTS.liquidCash,
  'Current emergency fund = liquid cash',
  `Got ${ds.currentEmergencyFund}`,
);

let rejectedInvalidInput = false;
try {
  buildDerivedState({ ...DEFAULT_RAW_INPUTS, monthlyIncome: Number.NaN });
} catch (error) {
  rejectedInvalidInput = error instanceof RangeError;
}
assert(rejectedInvalidInput, 'Rejects non-finite financial inputs');

const overriddenProfile = buildDerivedState(DEFAULT_RAW_INPUTS, 'conservative');
assert(
  overriddenProfile.riskProfile === 'conservative',
  'Risk profile override updates derived state',
  `Got ${overriddenProfile.riskProfile}`,
);

// Test 1: Emergency Fund Target
assert(
  ds.emergencyFundTargetRs === 6 * 40_000,
  'Emergency fund target = 6 × 40,000 = 240,000',
  `Got ${ds.emergencyFundTargetRs}`,
);

// Test 2: Weight vector switching
const consWeights = buildDerivedState(DEFAULT_RAW_INPUTS, 'conservative').weights;
const aggWeights  = buildDerivedState(DEFAULT_RAW_INPUTS, 'aggressive').weights;
assert(
  consWeights.w1 === 0.40 && consWeights.w5 === 0.10,
  'Conservative: w1=0.40, w5=0.10',
  `Got w1=${consWeights.w1}, w5=${consWeights.w5}`,
);
assert(
  aggWeights.w1 === 0.15 && aggWeights.w5 === 0.25,
  'Aggressive: w1=0.15, w5=0.25',
  `Got w1=${aggWeights.w1}, w5=${aggWeights.w5}`,
);

// Test 3: Income stability variance
const stableDs   = buildDerivedState({ ...DEFAULT_RAW_INPUTS, incomeStability: 'stable' });
const variableDs = buildDerivedState({ ...DEFAULT_RAW_INPUTS, incomeStability: 'variable' });
assert(stableDs.incomeVariancePct === 0.05,   'Stable variance = 0.05');
assert(variableDs.incomeVariancePct === 0.25,  'Variable variance = 0.25');

// Test 4: Zero-expense edge case (no NaN / crash)
const zeroExpDs = buildDerivedState({ ...DEFAULT_RAW_INPUTS, monthlyExpenses: 0 });
assert(
  zeroExpDs.emergencyFundTargetRs === 6 * 1, // Math.max(1, 0) = 1
  'Zero-expense guard: target = 6 × 1 = 6',
  `Got ${zeroExpDs.emergencyFundTargetRs}`,
);

// Test 5: Utility constants
assert(ds.utilityImmediateBonus === 0.15, 'utilityImmediateBonus = 0.15');
assert(ds.utilityDelayPenalty === -0.20,  'utilityDelayPenalty = -0.20');

// ═══════════════════════════════════════════════════════
//  Part 2: Deterministic Simulation Engine
// ═══════════════════════════════════════════════════════
console.log('\n══════ Part 2: Deterministic Engine ══════');

const state = buildDerivedState(DEFAULT_RAW_INPUTS);
const surplus = state.monthlyIncome - state.monthlyExpenses - state.existingEMI;
// 80,000 - 40,000 - 5,000 = 35,000

// ── EMI Helper ──
console.log('\n── calculateMonthlyEMI ──');

const noCostEMI = calculateMonthlyEMI(60_000, 0, 6);
assert(
  approxEq(noCostEMI, 10_000),
  'No-cost EMI: 60,000 / 6 = 10,000',
  `Got ${noCostEMI.toFixed(2)}`,
);

const standardEMI = calculateMonthlyEMI(60_000, 12, 6);
assert(
  standardEMI > 10_000,
  'Standard EMI (12% p.a., 6mo) > 10,000',
  `Got ${standardEMI.toFixed(2)}`,
);

const fullTenureEMI = calculateMonthlyEMI(60_000, 14, 12);
console.log(`  ℹ  14% / 12mo EMI = ₹${fullTenureEMI.toFixed(2)}`);

// ── Action 1: Buy Now ──
console.log('\n── Buy Now ──');
const buyNow = simulateAction('buy_now', state);

assert(buyNow.length === 13, 'Timeline length = 13 points');
assert(
  approxEq(buyNow[0].liquidCash, 150_000 - 60_000),
  'cash[0] = 150,000 − 60,000 = 90,000',
  `Got ${buyNow[0].liquidCash}`,
);
assert(
  approxEq(buyNow[1].liquidCash, 90_000 + surplus),
  'cash[1] = 90,000 + 35,000 = 125,000',
  `Got ${buyNow[1].liquidCash}`,
);
assert(buyNow[0].debtBalance === 0, 'Buy Now: debtBalance = 0');

// ── Action 2: EMI ──
console.log('\n── EMI ──');
const emi = simulateAction('emi', state);

assert(
  approxEq(emi[0].liquidCash, 150_000),
  'EMI cash[0] = 150,000 (no down payment)',
  `Got ${emi[0].liquidCash}`,
);
assert(
  approxEq(emi[0].debtBalance, 60_000),
  'EMI debtBalance[0] = 60,000',
  `Got ${emi[0].debtBalance}`,
);

// For default 12-month tenure, debt should be 0 at month 12
assert(
  approxEq(emi[12].debtBalance, 0, 1),
  'EMI debtBalance[12] ≈ 0 (fully amortized)',
  `Got ${emi[12].debtBalance.toFixed(2)}`,
);

// ── Action 3: Wait 3 Months ──
console.log('\n── Wait 3 Months ──');
const wait3 = simulateAction('wait_3m', state);

assert(
  approxEq(wait3[0].liquidCash, 150_000),
  'Wait3M cash[0] = 150,000 (no deduction yet)',
  `Got ${wait3[0].liquidCash}`,
);

// Verify inflation-adjusted price at month 3
const inflatedPrice3 = 60_000 * Math.pow(1.004, 3);
const expectedCash3 = 150_000 + surplus * 3 - inflatedPrice3;
assert(
  approxEq(wait3[3].liquidCash, expectedCash3, 1),
  `Wait3M cash[3] ≈ ${expectedCash3.toFixed(0)} (after inflation-adjusted deduction)`,
  `Got ${wait3[3].liquidCash.toFixed(2)}`,
);
console.log(`  ℹ  Inflated price at t=3: ₹${inflatedPrice3.toFixed(2)}`);

// ── Action 4: Buy Cheaper ──
console.log('\n── Buy Cheaper ──');
const cheaper = simulateAction('cheaper', state);
const cheaperPrice = 60_000 * 0.70;

assert(
  approxEq(cheaper[0].liquidCash, 150_000 - cheaperPrice),
  `Cheaper cash[0] = 150,000 − ${cheaperPrice} = ${150_000 - cheaperPrice}`,
  `Got ${cheaper[0].liquidCash}`,
);

// ── Action 5: Buy Refurbished ──
console.log('\n── Buy Refurbished ──');
const refurb = simulateAction('refurb', state);
const refurbPrice = 60_000 * 0.55;
const repairCost = refurbPrice * 0.30;

assert(
  approxEq(refurb[0].liquidCash, 150_000 - refurbPrice),
  `Refurb cash[0] = 150,000 − ${refurbPrice} = ${150_000 - refurbPrice}`,
  `Got ${refurb[0].liquidCash}`,
);

// Month 8: verify repair dip
const expectedCash7 = (150_000 - refurbPrice) + surplus * 7;
const expectedCash8 = expectedCash7 + surplus - repairCost;
assert(
  approxEq(refurb[8].liquidCash, expectedCash8, 1),
  `Refurb cash[8] includes repair dip of ₹${repairCost}`,
  `Got ${refurb[8].liquidCash.toFixed(2)}, expected ≈${expectedCash8.toFixed(2)}`,
);

// ── Action 6: Invest + Delay ──
console.log('\n── Invest + Delay ──');
const investDelay = simulateAction('invest_delay', state);

assert(
  approxEq(investDelay[0].liquidCash, 150_000),
  'InvestDelay cash[0] = 150,000',
  `Got ${investDelay[0].liquidCash}`,
);

// Verify compound growth: cash[1] = (150,000 * 1.008 + 35,000) − inflated_price_at_t1
// With defaults, affordMonth = 1 since 186,200 > 60,240
const preDedCash1 = 150_000 * (1 + 0.008) + surplus;
const inflatedPriceT1 = 60_000 * Math.pow(1.004, 1);
const expectedCash1Invest = preDedCash1 - inflatedPriceT1; // purchase triggered at t=1
assert(
  approxEq(investDelay[1].liquidCash, expectedCash1Invest, 1),
  `InvestDelay cash[1] ≈ ${expectedCash1Invest.toFixed(0)} (after purchase at affordMonth=1)`,
  `Got ${investDelay[1].liquidCash.toFixed(2)}`,
);

const expectedCash2Invest = expectedCash1Invest * (1 + state.monthlyInvestReturnPct) + surplus;
assert(
  approxEq(investDelay[2].liquidCash, expectedCash2Invest, 1),
  'InvestDelay compounds the post-purchase balance from month 2',
  `Got ${investDelay[2].liquidCash.toFixed(2)}`,
);

// Verify exponential growth exceeds linear surplus accumulation
const linearCash12 = 150_000 + surplus * 12;
// Note: invest_delay deducts the purchase price at affordMonth, so raw cash won't exceed linear
// We check the *pre-deduction* growth by checking if cash ever exceeded the inflated price
let peakBeforeDeduction = investDelay[0].liquidCash;
for (let t = 1; t <= 12; t++) {
  // Reconstruct pre-deduction cash: if purchase happened, add back the price
  const inflated = 60_000 * Math.pow(1.004, t);
  const preDedCash = investDelay[t].liquidCash + (investDelay[t].liquidCash < investDelay[t - 1].liquidCash && t > 1 ? inflated : 0);
  peakBeforeDeduction = Math.max(peakBeforeDeduction, preDedCash);
}
console.log(`  ℹ  Linear cash at t=12: ₹${linearCash12.toLocaleString()}`);
console.log(`  ℹ  InvestDelay cash[12]: ₹${investDelay[12].liquidCash.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);

// ── simulateAllActions ──
console.log('\n── simulateAllActions ──');
const allTimelines = simulateAllActions(state);
const actionIds = Object.keys(allTimelines);
assert(actionIds.length === 6, `Returns 6 action timelines (got ${actionIds.length})`);

for (const id of actionIds) {
  assert(
    allTimelines[id].length === 13,
    `${id} timeline has 13 points`,
    `Got ${allTimelines[id].length}`,
  );
}

let rejectedShortOverride = false;
try {
  simulateAction('buy_now', state, [state.monthlyIncome], Array(13).fill(state.monthlyExpenses));
} catch (error) {
  rejectedShortOverride = error instanceof RangeError;
}
assert(rejectedShortOverride, 'Rejects income overrides with fewer than 13 values');

let rejectedSparseOverride = false;
try {
  const sparseIncome = new Array<number>(13);
  simulateAction('buy_now', state, sparseIncome, Array(13).fill(state.monthlyExpenses));
} catch (error) {
  rejectedSparseOverride = error instanceof RangeError;
}
assert(rejectedSparseOverride, 'Rejects sparse income overrides');

// ── EMI with tenure > 12 (carryover debt rule) ──
console.log('\n── EMI Carryover Debt (tenure=24) ──');
const longTenureState = buildDerivedState({
  ...DEFAULT_RAW_INPUTS,
  emiTenureMonths: 24,
});
const longEmi = simulateAction('emi', longTenureState);
assert(
  longEmi[12].debtBalance > 0,
  'EMI with 24mo tenure: debtBalance[12] > 0 (carryover)',
  `Got ${longEmi[12].debtBalance.toFixed(2)}`,
);

let rejectedInvalidEMI = false;
try {
  calculateMonthlyEMI(60_000, -1, 12);
} catch (error) {
  rejectedInvalidEMI = error instanceof RangeError;
}
assert(rejectedInvalidEMI, 'Rejects invalid EMI inputs');

// ═══════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════\n');
if (failed > 0) {
  throw new Error(`${failed} verification test(s) failed`);
}
