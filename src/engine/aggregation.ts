/**
 * Part 6 - Outcome Aggregation
 *
 * Turns PairedScenario[] (hundreds of raw trajectories) into the summary statistics the
 * UI actually shows: percentile bands per month, and plain-language event-frequency
 * stats. Depends on Part 5.
 *
 * The percentile month-index convention is pinned down here: "the value at month t" is
 * read from that month's MonthOutcome end-of-month figures
 * (endingCash + endingFundBalance), never re-derived by callers.
 */
import type { DebtInstrument } from './state';
import type { MonthlyCheckpoint, PairedScenario, ScenarioTrajectory } from './scenarioRunner';

// ---------------------------------------------------------------------------
// Exact type contracts
// ---------------------------------------------------------------------------

export type MonthlyBand = {
  month: number;
  p10: number; p50: number; p90: number;       // liquidCash + emergencyFund combined ("total accessible cash")
  fundP10: number; fundP50: number; fundP90: number; // emergencyFund.balance alone
  debtP10: number; debtP50: number; debtP90: number; // total debt balance across all instruments
};

export type FrequencyStat = {
  id: string;                     // stable key, e.g. 'fund_breach', 'covers_100k_shock'
  label: string;                  // human-readable, e.g. "Dropped below emergency fund at some point"
  baselinePct: number;            // 0-100, % of baseline scenarios where this was true
  decisionPct: number;            // 0-100, % of decision scenarios where this was true
  deltaPct: number;               // decisionPct - baselinePct, signed
  severity: 'positive' | 'neutral' | 'negative'; // for UI color coding
};

export type AggregatedResult = {
  baselineBands: MonthlyBand[];   // length 12
  decisionBands: MonthlyBand[];   // length 12
  stats: FrequencyStat[];
  scenarioCount: number;
};

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const HORIZON_MONTHS = 12;
const TAIL_SHOCK_MIN_RUPEES = 80000;
const NA_QUALIFYING_FRACTION = 0.05;
const NEUTRAL_DELTA_FLOOR = 2;

// ---------------------------------------------------------------------------
// Percentile bands
// ---------------------------------------------------------------------------

function percentileSummary(values: number[]): { p10: number; p50: number; p90: number } {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p10: sorted[Math.floor(0.10 * sorted.length)],
    p50: sorted[Math.floor(0.50 * sorted.length)],
    p90: sorted[Math.floor(0.90 * sorted.length)],
  };
}

function totalDebt(debtBalances: Record<string, number>): number {
  let sum = 0;
  for (const balance of Object.values(debtBalances)) {
    sum += balance;
  }
  return sum;
}

function computeBands(trajectories: ScenarioTrajectory[]): MonthlyBand[] {
  const bands: MonthlyBand[] = [];
  for (let month = 0; month < HORIZON_MONTHS; month++) {
    const cashSeries: number[] = [];
    const fundSeries: number[] = [];
    const debtSeries: number[] = [];
    for (const trajectory of trajectories) {
      const outcome = trajectory.checkpoints[month].outcome;
      cashSeries.push(outcome.endingCash + outcome.endingFundBalance);
      fundSeries.push(outcome.endingFundBalance);
      debtSeries.push(totalDebt(outcome.endingDebtBalances));
    }
    const cash = percentileSummary(cashSeries);
    const fund = percentileSummary(fundSeries);
    const debt = percentileSummary(debtSeries);
    bands.push({
      month,
      p10: cash.p10,
      p50: cash.p50,
      p90: cash.p90,
      fundP10: fund.p10,
      fundP50: fund.p50,
      fundP90: fund.p90,
      debtP10: debt.p10,
      debtP50: debt.p50,
      debtP90: debt.p90,
    });
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Frequency stats
// ---------------------------------------------------------------------------

type StatOutcome = boolean | null; // null = scenario does not qualify for this stat

type StatDefinition = {
  id: string;
  label: string;
  isBad: boolean;
  evaluate: (trajectory: ScenarioTrajectory) => StatOutcome;
};

function startingDebts(trajectory: ScenarioTrajectory): DebtInstrument[] {
  return trajectory.checkpoints[0].snapshot.debts;
}

function startingTotalDebt(trajectory: ScenarioTrajectory): number {
  let sum = 0;
  for (const debt of startingDebts(trajectory)) {
    sum += debt.balance;
  }
  return sum;
}

function startingNetWorth(trajectory: ScenarioTrajectory): number {
  const snapshot = trajectory.checkpoints[0].snapshot;
  return snapshot.liquidCashOutsideFund + snapshot.emergencyFund.balance - startingTotalDebt(trajectory);
}

/** Month-11 debt component of endingNetWorth: total debt + the scenario-local new credit line. */
function endingDebtComponent(trajectory: ScenarioTrajectory): number {
  const finalState = trajectory.finalState;
  return finalState.liquidCashOutsideFund + finalState.emergencyFund.balance - trajectory.endingNetWorth;
}

/**
 * Conditional stat: only scenarios where a medical tail shock (>= Rs 80,000) actually
 * fired qualify. "Covered" means the pre-response emergency fund + liquid cash at that
 * month could absorb the shock without a fallback draw.
 */
function coversTailShock(trajectory: ScenarioTrajectory): StatOutcome {
  for (let month = 0; month < HORIZON_MONTHS; month++) {
    const checkpoint: MonthlyCheckpoint = trajectory.checkpoints[month];
    const shock = checkpoint.firedEvents.find(
      (event) => event.type === 'medical_expense' && Math.abs(event.amount) >= TAIL_SHOCK_MIN_RUPEES,
    );
    if (shock !== undefined) {
      const snapshot = checkpoint.snapshot;
      const available = snapshot.liquidCashOutsideFund + snapshot.emergencyFund.balance;
      return available >= Math.abs(shock.amount);
    }
  }
  return null;
}

/**
 * Conditional stat: only scenarios that started with at least one installment debt
 * qualify. "Ahead of schedule" means every installment debt reached a zero balance
 * strictly before the month it was originally due to finish.
 */
function paysOffAheadOfSchedule(trajectory: ScenarioTrajectory): StatOutcome {
  const installmentDebts = startingDebts(trajectory).filter(
    (debt) => debt.termMonthsRemaining !== null,
  );
  if (installmentDebts.length === 0) {
    return null;
  }
  for (const debt of installmentDebts) {
    const scheduledPayoffMonth = (debt.termMonthsRemaining as number) - 1;
    let paidOffMonth = -1;
    for (let month = 0; month < HORIZON_MONTHS; month++) {
      if (trajectory.checkpoints[month].outcome.endingDebtBalances[debt.id] === 0) {
        paidOffMonth = month;
        break;
      }
    }
    if (paidOffMonth < 0 || paidOffMonth >= scheduledPayoffMonth) {
      return false;
    }
  }
  return true;
}

const STAT_DEFINITIONS: StatDefinition[] = [
  {
    id: 'fund_breach',
    label: 'Dropped below emergency fund at some point',
    isBad: true,
    evaluate: (trajectory) => trajectory.everBreachedFund,
  },
  {
    id: 'any_month_failed',
    label: 'Had at least one month with an uncovered shortfall',
    isBad: true,
    evaluate: (trajectory) => trajectory.everFailedMonth,
  },
  {
    id: 'ends_with_more_debt',
    label: 'Ended the year owing more than they started with',
    isBad: true,
    evaluate: (trajectory) => endingDebtComponent(trajectory) > startingTotalDebt(trajectory),
  },
  {
    id: 'covers_100k_shock',
    label: 'Covered a large medical expense from cash and fund',
    isBad: false,
    evaluate: coversTailShock,
  },
  {
    id: 'pays_off_ahead_of_schedule',
    label: 'Paid off an installment debt ahead of schedule',
    isBad: false,
    evaluate: paysOffAheadOfSchedule,
  },
  {
    id: 'positive_net_worth_swing',
    label: 'Ended the year with a higher net worth',
    isBad: false,
    evaluate: (trajectory) => trajectory.endingNetWorth > startingNetWorth(trajectory),
  },
];

/**
 * Percentage of qualifying scenarios for which the stat held. Conditional stats return
 * NaN ("N/A") when fewer than 5% of scenarios qualified, rather than a misleading 0/100.
 * Computed at full float precision; no rounding here (display rounding is the UI's job).
 */
function conditionalPercentage(
  evaluate: (trajectory: ScenarioTrajectory) => StatOutcome,
  trajectories: ScenarioTrajectory[],
): number {
  let qualifying = 0;
  let hits = 0;
  for (const trajectory of trajectories) {
    const outcome = evaluate(trajectory);
    if (outcome === null) {
      continue;
    }
    qualifying += 1;
    if (outcome) {
      hits += 1;
    }
  }
  if (qualifying / trajectories.length < NA_QUALIFYING_FRACTION) {
    return NaN;
  }
  return (hits / qualifying) * 100;
}

function severityFor(isBad: boolean, deltaPct: number): FrequencyStat['severity'] {
  if (Number.isNaN(deltaPct) || Math.abs(deltaPct) < NEUTRAL_DELTA_FLOOR) {
    return 'neutral';
  }
  if (isBad ? deltaPct > 0 : deltaPct < 0) {
    return 'negative';
  }
  return 'positive';
}

function computeFrequencyStats(
  baseline: ScenarioTrajectory[],
  decision: ScenarioTrajectory[],
): FrequencyStat[] {
  return STAT_DEFINITIONS.map((definition) => {
    const baselinePct = conditionalPercentage(definition.evaluate, baseline);
    const decisionPct = conditionalPercentage(definition.evaluate, decision);
    const deltaPct = decisionPct - baselinePct;
    return {
      id: definition.id,
      label: definition.label,
      baselinePct,
      decisionPct,
      deltaPct,
      severity: severityFor(definition.isBad, deltaPct),
    };
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function aggregateResults(paired: PairedScenario[]): AggregatedResult {
  const baseline = paired.map((scenario) => scenario.baseline);
  const decision = paired.map((scenario) => scenario.decision);
  return {
    baselineBands: computeBands(baseline),
    decisionBands: computeBands(decision),
    stats: computeFrequencyStats(baseline, decision),
    scenarioCount: paired.length,
  };
}
