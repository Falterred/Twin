/**
 * Part 5 - Scenario Runner (Paired Baseline/Decision Simulation)
 *
 * The core simulation loop: for each of SimConfig.scenarioCount scenarios, run a
 * baseline twin and a decision twin month-by-month through the same random event
 * stream, producing two parallel 12-month trajectories per scenario whose divergence
 * is attributable to the decision.
 *
 * Depends on Parts 1-4.
 */
import type { DerivedState, FinancialSnapshot } from './state';
import { applyResponsePolicy, type MonthOutcome } from './responsePolicy';
import {
  exponentialRandom,
  rollMonthlyEvents,
  sampleMonthlyIncome,
  type FiredEvent,
  type HazardContext,
  type MonthlyHazardState,
} from './hazards';
import { applyDecisionToSnapshot, type TimedEffect } from './decision';

// ---------------------------------------------------------------------------
// Exact type contracts
// ---------------------------------------------------------------------------

export type MonthlyCheckpoint = {
  month: number;                        // 0-11
  snapshot: FinancialSnapshot;          // full state AT START of this month (post prior month's response) — this is the re-enterable fork point
  hazardState: MonthlyHazardState;
  firedEvents: FiredEvent[];            // events that fired THIS month
  outcome: MonthOutcome;                // response policy result for this month
  newCreditLineBalance: number;         // scenario-local, see Part 4 step 5
};

export type ScenarioTrajectory = {
  scenarioIndex: number;                // 0..scenarioCount-1
  seed: number;                         // RNG seed used for this scenario (shared between baseline/decision pair)
  checkpoints: MonthlyCheckpoint[];     // length 12, months 0-11
  finalState: FinancialSnapshot;
  everBreachedFund: boolean;            // true if emergencyFund.balance hit 0 at any point
  everFailedMonth: boolean;             // true if any month had shortfallUncovered > 0
  endingNetWorth: number;               // liquidCashOutsideFund + emergencyFund.balance - sum(debt balances) at month 11
};

export type PairedScenario = {
  scenarioIndex: number;
  seed: number;
  baseline: ScenarioTrajectory;
  decision: ScenarioTrajectory;
};

// ---------------------------------------------------------------------------
// Lightweight deterministic PRNG (mulberry32), zero dependencies
// ---------------------------------------------------------------------------

function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createHazardState(): MonthlyHazardState {
  return {
    isUnemployed: false,
    monthsUnemployed: 0,
    fundBreachedThisRun: false,
    missedPaymentLastMonth: false,
    housingSpikeFiredThisRun: false,
  };
}

const LOST_INCOME_PREFIX = 'Lost income: ';

type TwinInit = {
  startSnapshot: FinancialSnapshot;
  timedEffects: TimedEffect[];
  derivedState: DerivedState;
  rng: () => number;
  startMonth: number;
  stopMonth: number;
  hazardState: MonthlyHazardState;
  newCreditLineBalance: number;
  suppressedIncomeSourceId: string | null;
  unemployedUntilMonth: number | null;
};

type TwinRun = {
  checkpoints: MonthlyCheckpoint[];
  finalState: FinancialSnapshot;
  everBreachedFund: boolean;
  everFailedMonth: boolean;
  endingNetWorth: number;
};

// ---------------------------------------------------------------------------
// Per-twin monthly loop
// ---------------------------------------------------------------------------

function simulateTwin(init: TwinInit): TwinRun {
  const { derivedState, rng, timedEffects } = init;
  const overrides = derivedState.hazardOverrides;
  const noiseParams = overrides.incomeNoise;

  let snapshot = structuredClone(init.startSnapshot);
  const hazardState = init.hazardState;
  let newCreditLineBalance = init.newCreditLineBalance;
  let suppressedIncomeSourceId = init.suppressedIncomeSourceId;
  let unemployedUntilMonth = init.unemployedUntilMonth;
  let permanentFixedIncrease = 0;
  let everFailedMonth = false;
  const checkpoints: MonthlyCheckpoint[] = [];

  // recurring_expense_from gates an expense until its startMonth; the expense itself
  // already lives in snapshot.expenses (Part 2 appended it).
  const recurringStartByExpenseId = new Map<string, number>();
  for (const effect of timedEffects) {
    if (effect.kind === 'recurring_expense_from') {
      recurringStartByExpenseId.set(effect.expenseId, effect.startMonth);
    }
  }

  for (let month = init.startMonth; month < init.stopMonth; month++) {
    // Checkpoint stores the entry (pre-month) state.
    const entrySnapshot = snapshot;
    const entryHazardState: MonthlyHazardState = { ...hazardState };
    const entryNewCreditLineBalance = newCreditLineBalance;

    // (a) income: per-source noise draws, in array order, BEFORE any event roll.
    let income = 0;
    for (const source of snapshot.incomeSources) {
      if (hazardState.isUnemployed && source.id === suppressedIncomeSourceId) {
        continue; // suppressed source contributes 0 and consumes no draws
      }
      income += sampleMonthlyIncome(source, noiseParams, rng);
    }

    // (b) expenses: fixed + discretionary + seasonal, gated recurring effects, plus the
    // permanent housing-cost step accumulated from prior months.
    let fixedExpenses = 0;
    let otherExpenses = 0;
    for (const expense of snapshot.expenses) {
      const recurringStartMonth = recurringStartByExpenseId.get(expense.id);
      if (recurringStartMonth !== undefined && month < recurringStartMonth) {
        continue;
      }
      const amount = expense.seasonalMultipliers === undefined
        ? expense.monthlyAmount
        : expense.monthlyAmount * expense.seasonalMultipliers[month % 12];
      if (expense.type === 'fixed') {
        fixedExpenses += amount;
      } else {
        otherExpenses += amount;
      }
    }
    const totalFixedExpenses = fixedExpenses + permanentFixedIncrease;
    const totalExpenses = otherExpenses + totalFixedExpenses;

    // (c) one-time expenses scheduled for exactly this month.
    let oneTimeExpenseThisMonth = 0;
    for (const effect of timedEffects) {
      if (effect.kind === 'one_time_expense' && effect.atMonth === month) {
        oneTimeExpenseThisMonth += effect.amount;
      }
    }

    // (d) discrete events for this month.
    const totalMonthlyIncome = snapshot.incomeSources.reduce(
      (sum, source) => sum + source.monthlyAmount,
      0,
    );
    const hazardContext: HazardContext = {
      hazardSeverityMultiplier: derivedState.hazardSeverityMultiplier,
      totalMonthlyIncome,
      totalFixedExpenses,
      state: hazardState,
      rng,
      noiseParams,
      overrides,
      incomeSources: snapshot.incomeSources,
    };
    const firedEvents = rollMonthlyEvents(hazardContext, month);
    let netEventCash = 0;
    for (const event of firedEvents) {
      netEventCash += event.amount;
      if (event.type === 'housing_cost_spike') {
        permanentFixedIncrease += Math.abs(event.amount);
        hazardState.housingSpikeFiredThisRun = true;
      } else if (event.type === 'job_loss') {
        // Part 3 picked the target and encoded it in the label.
        const target = snapshot.incomeSources.find(
          (source) => event.label === LOST_INCOME_PREFIX + source.label,
        )!;
        suppressedIncomeSourceId = target.id;
        // Duration drawn once at job-loss time; loss begins the following month.
        const duration = 1 + Math.floor(exponentialRandom(2.5, rng));
        unemployedUntilMonth = month + Math.min(duration, 12 - month);
      }
    }

    // (e) cash before the response policy.
    const totalMinDebtPayments = snapshot.debts.reduce(
      (sum, debt) => sum + debt.minMonthlyPayment,
      0,
    );
    const cashBeforeResponse =
      income - totalExpenses - totalMinDebtPayments - oneTimeExpenseThisMonth + netEventCash;

    // (f) response policy (Part 4 supplies newCreditLineAprPct via hazardOverrides).
    const outcome = applyResponsePolicy(
      cashBeforeResponse,
      snapshot.liquidCashOutsideFund,
      snapshot.emergencyFund,
      snapshot.debts,
      snapshot.debtFallbackOrder,
      month,
      overrides,
    );

    // Carry the response policy result forward as next month's entry snapshot.
    snapshot = {
      ...snapshot,
      liquidCashOutsideFund: outcome.endingCash,
      emergencyFund: { ...snapshot.emergencyFund, balance: outcome.endingFundBalance },
      debts: snapshot.debts.map((debt) => ({
        ...debt,
        balance: outcome.endingDebtBalances[debt.id],
      })),
    };
    newCreditLineBalance = outcome.endingDebtBalances['NEW_CREDIT_LINE'] ?? 0;

    // (g) hazard-state updates for the month that follows.
    if (outcome.endingFundBalance === 0) {
      hazardState.fundBreachedThisRun = true; // sticky
    }
    hazardState.missedPaymentLastMonth = outcome.shortfallUncovered > 0;
    if (outcome.shortfallUncovered > 0) {
      everFailedMonth = true;
    }

    // (h) checkpoint for this month, holding the entry state.
    checkpoints.push({
      month,
      snapshot: entrySnapshot,
      hazardState: entryHazardState,
      firedEvents,
      outcome,
      newCreditLineBalance: entryNewCreditLineBalance,
    });

    // End-of-month unemployment bookkeeping for the next month's entry state.
    const nextMonth = month + 1;
    hazardState.isUnemployed = unemployedUntilMonth !== null && nextMonth <= unemployedUntilMonth;
    hazardState.monthsUnemployed = hazardState.isUnemployed ? hazardState.monthsUnemployed + 1 : 0;
  }

  const endingNetWorth =
    snapshot.liquidCashOutsideFund +
    snapshot.emergencyFund.balance -
    snapshot.debts.reduce((sum, debt) => sum + debt.balance, 0) -
    newCreditLineBalance;

  return {
    checkpoints,
    finalState: snapshot,
    everBreachedFund: hazardState.fundBreachedThisRun,
    everFailedMonth,
    endingNetWorth,
  };
}

function toTrajectory(
  scenarioIndex: number,
  seed: number,
  run: TwinRun,
  history: MonthlyCheckpoint[],
  historicalFailure: boolean,
): ScenarioTrajectory {
  return {
    scenarioIndex,
    seed,
    checkpoints: [...history, ...run.checkpoints],
    finalState: run.finalState,
    everBreachedFund: run.everBreachedFund,
    everFailedMonth: run.everFailedMonth || historicalFailure,
    endingNetWorth: run.endingNetWorth,
  };
}

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

export function runSimulation(derivedState: DerivedState): PairedScenario[] {
  const baseSeed = derivedState.config.randomSeed ?? Date.now();
  const decisionResult = applyDecisionToSnapshot(derivedState.snapshot, derivedState.decision);
  const pairs: PairedScenario[] = [];

  for (let scenarioIndex = 0; scenarioIndex < derivedState.config.scenarioCount; scenarioIndex++) {
    const seed = baseSeed + scenarioIndex;
    // Two independently-advancing generators from the exact same seed (binding pairing rule).
    const baselineRun = simulateTwin({
      startSnapshot: derivedState.snapshot,
      timedEffects: [],
      derivedState,
      rng: createPrng(seed),
      startMonth: 0,
      stopMonth: 12,
      hazardState: createHazardState(),
      newCreditLineBalance: 0,
      suppressedIncomeSourceId: null,
      unemployedUntilMonth: null,
    });
    const decisionRun = simulateTwin({
      startSnapshot: decisionResult.snapshot,
      timedEffects: decisionResult.timedEffects,
      derivedState,
      rng: createPrng(seed),
      startMonth: 0,
      stopMonth: 12,
      hazardState: createHazardState(),
      newCreditLineBalance: 0,
      suppressedIncomeSourceId: null,
      unemployedUntilMonth: null,
    });

    pairs.push({
      scenarioIndex,
      seed,
      baseline: toTrajectory(scenarioIndex, seed, baselineRun, [], false),
      decision: toTrajectory(scenarioIndex, seed, decisionRun, [], false),
    });
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// forkFromCheckpoint
// ---------------------------------------------------------------------------

export function forkFromCheckpoint(
  derivedState: DerivedState,
  trajectory: ScenarioTrajectory,
  atMonth: number,
  editedSnapshot: FinancialSnapshot,
  newSeed?: number,
): ScenarioTrajectory {
  // v1 fork semantics: resume from the edited checkpoint state. The trajectory does not
  // carry Part 2's timedEffects, and recomputing them via applyDecisionToSnapshot would
  // mint fresh uuids that no longer match the snapshot's expense ids, so future-dated
  // effects are not re-applied here.
  const timedEffects: TimedEffect[] = [];

  const seed = newSeed ?? trajectory.seed;
  const rng = createPrng(seed);
  if (newSeed === undefined) {
    // Advance the generator to the equivalent point by replaying (and discarding) the
    // pre-fork months, so months atMonth..11 continue the original event stream.
    simulateTwin({
      startSnapshot: trajectory.checkpoints[0].snapshot,
      timedEffects,
      derivedState,
      rng,
      startMonth: 0,
      stopMonth: atMonth,
      hazardState: createHazardState(),
      newCreditLineBalance: 0,
      suppressedIncomeSourceId: null,
      unemployedUntilMonth: null,
    });
  }

  const checkpoint = trajectory.checkpoints[atMonth];
  const hazardState: MonthlyHazardState = { ...checkpoint.hazardState };
  let suppressedIncomeSourceId: string | null = null;
  let unemployedUntilMonth: number | null = null;
  if (hazardState.isUnemployed) {
    // Reconstruct the scenario-local unemployment window from the original trajectory:
    // walk forward to the recovery month, and back to the month job_loss fired.
    let endMonth = atMonth;
    for (const future of trajectory.checkpoints.slice(atMonth + 1)) {
      if (!future.hazardState.isUnemployed) {
        break;
      }
      endMonth += 1;
    }
    unemployedUntilMonth = endMonth;

    for (const earlier of trajectory.checkpoints.slice(0, atMonth).reverse()) {
      const jobLoss = earlier.firedEvents.find((event) => event.type === 'job_loss');
      if (jobLoss !== undefined) {
        const target = editedSnapshot.incomeSources.find(
          (source) => jobLoss.label === LOST_INCOME_PREFIX + source.label,
        )!;
        suppressedIncomeSourceId = target.id;
        break;
      }
    }
  }

  const run = simulateTwin({
    startSnapshot: editedSnapshot,
    timedEffects,
    derivedState,
    rng,
    startMonth: atMonth,
    stopMonth: 12,
    hazardState,
    newCreditLineBalance: checkpoint.newCreditLineBalance,
    suppressedIncomeSourceId,
    unemployedUntilMonth,
  });

  const history = trajectory.checkpoints.slice(0, atMonth);
  const historicalFailure = history.some(
    (entry) => entry.outcome.shortfallUncovered > 0,
  );
  return toTrajectory(trajectory.scenarioIndex, seed, run, history, historicalFailure);
}
