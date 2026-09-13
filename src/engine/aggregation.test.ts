import { describe, expect, it } from 'vitest';

import {
  aggregateResults,
  type AggregatedResult,
  type FrequencyStat,
  type MonthlyBand,
} from './aggregation';
import type { DebtInstrument, FinancialSnapshot } from './state';
import type { FiredEvent, MonthlyHazardState } from './hazards';
import type { MonthOutcome } from './responsePolicy';
import type { MonthlyCheckpoint, PairedScenario, ScenarioTrajectory } from './scenarioRunner';

// ---------------------------------------------------------------------------
// Synthetic trajectory builders (hand-picked values, never randomly generated)
// ---------------------------------------------------------------------------

type MonthOverride = {
  cash: number;
  fund: number;
  debt?: Record<string, number>;
  events?: FiredEvent[];
  preLiquid?: number;
  preFund?: number;
};

type TrajectorySpec = {
  scenarioIndex?: number;
  startingLiquid?: number;
  startingFund?: number;
  startingDebts?: DebtInstrument[];
  months?: MonthOverride[];
  finalCash?: number;
  finalFund?: number;
  finalDebts?: DebtInstrument[];
  everBreachedFund?: boolean;
  everFailedMonth?: boolean;
  endingNetWorth?: number;
};

function baseSnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    incomeSources: [{ id: 'inc-1', label: 'Salary', monthlyAmount: 50000, stability: 'stable' }],
    debts: [],
    expenses: [{ id: 'exp-1', label: 'Rent', type: 'fixed', monthlyAmount: 20000 }],
    emergencyFund: { balance: 0, targetMonths: 6, isInvested: false },
    liquidCashOutsideFund: 0,
    riskProfile: 'balanced',
    debtFallbackOrder: ['NEW_CREDIT_LINE'],
    ...overrides,
  };
}

function makeHazardState(): MonthlyHazardState {
  return {
    isUnemployed: false,
    monthsUnemployed: 0,
    fundBreachedThisRun: false,
    missedPaymentLastMonth: false,
  };
}

function flatMonths(month: MonthOverride, count = 12): MonthOverride[] {
  const months: MonthOverride[] = [];
  for (let index = 0; index < count; index++) {
    months.push({ ...month });
  }
  return months;
}

function monthsWith(entries: Array<{ month: number; events: FiredEvent[] }>): MonthOverride[] {
  const months = flatMonths({ cash: 0, fund: 0 });
  for (const entry of entries) {
    months[entry.month] = { cash: 0, fund: 0, events: entry.events };
  }
  return months;
}

function makeTrajectory(spec: TrajectorySpec = {}): ScenarioTrajectory {
  const months = spec.months ?? flatMonths({ cash: 0, fund: 0 });
  const startingLiquid = spec.startingLiquid ?? 0;
  const startingFund = spec.startingFund ?? 0;
  const debts = spec.startingDebts ?? [];

  const checkpoints: MonthlyCheckpoint[] = months.map((monthSpec, month) => {
    const outcome: MonthOutcome = {
      month,
      cashBeforeResponse: 0,
      emergencyFundDraw: 0,
      debtDraws: [],
      newCreditLineDraw: 0,
      shortfallUncovered: 0,
      endingCash: monthSpec.cash,
      endingFundBalance: monthSpec.fund,
      endingDebtBalances: monthSpec.debt ?? {},
    };
    const snapshot = baseSnapshot({
      liquidCashOutsideFund: monthSpec.preLiquid ?? startingLiquid,
      emergencyFund: {
        balance: monthSpec.preFund ?? startingFund,
        targetMonths: 6,
        isInvested: false,
      },
      debts,
    });
    return {
      month,
      snapshot,
      hazardState: makeHazardState(),
      firedEvents: monthSpec.events ?? [],
      outcome,
      newCreditLineBalance: 0,
    };
  });

  return {
    scenarioIndex: spec.scenarioIndex ?? 0,
    seed: 1,
    checkpoints,
    finalState: baseSnapshot({
      liquidCashOutsideFund: spec.finalCash ?? 0,
      emergencyFund: { balance: spec.finalFund ?? 0, targetMonths: 6, isInvested: false },
      debts: spec.finalDebts ?? [],
    }),
    everBreachedFund: spec.everBreachedFund ?? false,
    everFailedMonth: spec.everFailedMonth ?? false,
    endingNetWorth: spec.endingNetWorth ?? 0,
  };
}

function makePaired(
  baseline: ScenarioTrajectory[],
  decision: ScenarioTrajectory[],
): PairedScenario[] {
  return baseline.map((trajectory, index) => ({
    scenarioIndex: index,
    seed: index,
    baseline: trajectory,
    decision: decision[index],
  }));
}

function tenTrajectories(specFn: (index: number) => TrajectorySpec): ScenarioTrajectory[] {
  const trajectories: ScenarioTrajectory[] = [];
  for (let index = 0; index < 10; index++) {
    trajectories.push(makeTrajectory({ scenarioIndex: index, ...specFn(index) }));
  }
  return trajectories;
}

function statById(result: AggregatedResult, id: string): FrequencyStat {
  const stat = result.stats.find((entry) => entry.id === id);
  if (stat === undefined) {
    throw new Error('missing frequency stat: ' + id);
  }
  return stat;
}

// ---------------------------------------------------------------------------
// Percentile bands
// ---------------------------------------------------------------------------

describe('computeBands', () => {
  it('matches hand-computed p10/p50/p90 for a known 10-scenario set', () => {
    const baseline: ScenarioTrajectory[] = [];
    for (let index = 0; index < 10; index++) {
      baseline.push(
        makeTrajectory({
          scenarioIndex: index,
          months: flatMonths({
            cash: (index + 1) * 10,
            fund: (index + 1) * 100,
            debt: { NEW_CREDIT_LINE: (index + 1) * 20 },
          }),
        }),
      );
    }
    const result = aggregateResults(makePaired(baseline, baseline));

    expect(result.baselineBands).toHaveLength(12);
    expect(result.decisionBands).toHaveLength(12);

    const band: MonthlyBand = result.baselineBands[0];
    expect(band.month).toBe(0);
    // cash series 110..1100 -> sorted indices floor(0.1*10)=1, 5, 9
    expect(band.p10).toBe(220);
    expect(band.p50).toBe(660);
    expect(band.p90).toBe(1100);
    // fund series 100..1000
    expect(band.fundP10).toBe(200);
    expect(band.fundP50).toBe(600);
    expect(band.fundP90).toBe(1000);
    // debt series 20..200
    expect(band.debtP10).toBe(40);
    expect(band.debtP50).toBe(120);
    expect(band.debtP90).toBe(200);

    // Every month repeats the same flat synthetic values.
    expect(result.baselineBands[11].p50).toBe(660);
    expect(result.decisionBands[0].p50).toBe(660);
  });

  it('collapses p10/p50/p90 for a single scenario', () => {
    const only = makeTrajectory({
      months: flatMonths({ cash: 500, fund: 500, debt: { NEW_CREDIT_LINE: 100 } }),
    });
    const result = aggregateResults(makePaired([only], [only]));

    expect(result.scenarioCount).toBe(1);
    expect(result.baselineBands).toHaveLength(12);
    const band = result.baselineBands[0];
    expect(band.p10).toBe(1000);
    expect(band.p50).toBe(1000);
    expect(band.p90).toBe(1000);
    expect(band.fundP10).toBe(500);
    expect(band.fundP50).toBe(500);
    expect(band.fundP90).toBe(500);
    expect(band.debtP10).toBe(100);
    expect(band.debtP50).toBe(100);
    expect(band.debtP90).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Frequency stats
// ---------------------------------------------------------------------------

describe('computeFrequencyStats', () => {
  it('emits the required stats in the documented order', () => {
    const result = aggregateResults(makePaired([makeTrajectory()], [makeTrajectory()]));
    expect(result.stats.map((stat) => stat.id)).toEqual([
      'fund_breach',
      'any_month_failed',
      'ends_with_more_debt',
      'covers_100k_shock',
      'pays_off_ahead_of_schedule',
      'positive_net_worth_swing',
    ]);
  });

  it('computes fund_breach fractions and severity (1/10 baseline vs 3/10 decision)', () => {
    const baseline = tenTrajectories((index) => ({ everBreachedFund: index < 1 }));
    const decision = tenTrajectories((index) => ({ everBreachedFund: index < 3 }));
    const result = aggregateResults(makePaired(baseline, decision));
    const stat = statById(result, 'fund_breach');

    expect(result.scenarioCount).toBe(10);
    expect(stat.baselinePct).toBe(10);
    expect(stat.decisionPct).toBe(30);
    expect(stat.deltaPct).toBe(20);
    expect(stat.severity).toBe('negative');
  });

  it('computes any_month_failed from everFailedMonth', () => {
    const baseline = [makeTrajectory({ everFailedMonth: true }), makeTrajectory()];
    const decision = [makeTrajectory({ everFailedMonth: true }), makeTrajectory({ everFailedMonth: true })];
    const stat = statById(aggregateResults(makePaired(baseline, decision)), 'any_month_failed');

    expect(stat.baselinePct).toBe(50);
    expect(stat.decisionPct).toBe(100);
    expect(stat.deltaPct).toBe(50);
    expect(stat.severity).toBe('negative');
  });

  it('computes ends_with_more_debt from the month-11 debt component', () => {
    const loan: DebtInstrument = {
      id: 'loan',
      type: 'personal_loan',
      label: 'Loan',
      balance: 100000,
      annualRatePct: 12,
      minMonthlyPayment: 5000,
      termMonthsRemaining: 12,
    };
    // debt component = finalCash + finalFund - endingNetWorth
    const moreDebt = makeTrajectory({ startingDebts: [loan], endingNetWorth: -200000 });
    const lessDebt = makeTrajectory({ startingDebts: [loan], endingNetWorth: -50000 });
    const stat = statById(
      aggregateResults(makePaired([moreDebt, lessDebt], [moreDebt, lessDebt])),
      'ends_with_more_debt',
    );

    expect(stat.baselinePct).toBe(50);
    expect(stat.decisionPct).toBe(50);
    expect(stat.deltaPct).toBe(0);
    expect(stat.severity).toBe('neutral');
  });

  it('computes positive_net_worth_swing against starting net worth', () => {
    const better = makeTrajectory({ startingLiquid: 10000, endingNetWorth: 50000 });
    const worse = makeTrajectory({ startingLiquid: 10000, endingNetWorth: 5000 });
    const stat = statById(
      aggregateResults(makePaired([better, worse], [better, worse])),
      'positive_net_worth_swing',
    );

    expect(stat.baselinePct).toBe(50);
    expect(stat.decisionPct).toBe(50);
    expect(stat.severity).toBe('neutral');
  });

  it('restricts covers_100k_shock to scenarios with a tail shock', () => {
    const tailShock: FiredEvent = {
      type: 'medical_expense',
      month: 2,
      amount: -120000,
      label: 'Medical expense',
    };
    const subThreshold: FiredEvent = {
      type: 'medical_expense',
      month: 4,
      amount: -50000,
      label: 'Medical expense',
    };
    const bonus: FiredEvent = { type: 'bonus', month: 1, amount: 30000, label: 'Bonus' };

    const covered = makeTrajectory({
      startingLiquid: 200000,
      months: monthsWith([{ month: 2, events: [tailShock] }]),
    });
    const uncovered = makeTrajectory({
      startingLiquid: 50000,
      months: monthsWith([{ month: 2, events: [tailShock] }]),
    });
    const notQualifying = makeTrajectory({
      months: monthsWith([
        { month: 1, events: [bonus] },
        { month: 4, events: [subThreshold] },
      ]),
    });

    const scenarios = [covered, uncovered, notQualifying];
    const stat = statById(aggregateResults(makePaired(scenarios, scenarios)), 'covers_100k_shock');

    // 2 of 3 scenarios qualify; 1 of those 2 was covered.
    expect(stat.baselinePct).toBe(50);
    expect(stat.decisionPct).toBe(50);
    expect(stat.deltaPct).toBe(0);
    expect(stat.severity).toBe('neutral');
  });

  it('restricts pays_off_ahead_of_schedule to scenarios with installment debt', () => {
    const installment: DebtInstrument = {
      id: 'loan',
      type: 'personal_loan',
      label: 'Loan',
      balance: 100000,
      annualRatePct: 12,
      minMonthlyPayment: 5000,
      termMonthsRemaining: 6,
    };
    const revolving: DebtInstrument = {
      id: 'card',
      type: 'credit_card',
      label: 'Card',
      balance: 20000,
      annualRatePct: 36,
      minMonthlyPayment: 3000,
      termMonthsRemaining: null,
    };

    const loanMonths = (zeroAtMonth: number | null): MonthOverride[] => {
      const months = flatMonths({ cash: 0, fund: 0, debt: { loan: 10000, card: 20000 } });
      if (zeroAtMonth !== null) {
        months[zeroAtMonth] = { cash: 0, fund: 0, debt: { loan: 0, card: 20000 } };
      }
      return months;
    };

    const debts = [installment, revolving];
    const ahead = makeTrajectory({ startingDebts: debts, months: loanMonths(3) });
    const onSchedule = makeTrajectory({ startingDebts: debts, months: loanMonths(5) });
    const never = makeTrajectory({ startingDebts: debts, months: loanMonths(null) });
    const noInstallment = makeTrajectory({ startingDebts: [revolving] });

    const scenarios = [ahead, onSchedule, never, noInstallment];
    const stat = statById(
      aggregateResults(makePaired(scenarios, scenarios)),
      'pays_off_ahead_of_schedule',
    );

    // 3 of 4 scenarios have installment debt; 1 of those 3 paid off early.
    expect(stat.baselinePct).toBeCloseTo((1 / 3) * 100, 10);
    expect(stat.decisionPct).toBeCloseTo((1 / 3) * 100, 10);
    expect(stat.deltaPct).toBe(0);
    expect(stat.severity).toBe('neutral');
  });

  it('reports N/A for conditional stats with no qualifying scenarios', () => {
    const scenarios = [makeTrajectory(), makeTrajectory()];
    const result = aggregateResults(makePaired(scenarios, scenarios));

    const shock = statById(result, 'covers_100k_shock');
    expect(Number.isNaN(shock.baselinePct)).toBe(true);
    expect(Number.isNaN(shock.decisionPct)).toBe(true);
    expect(Number.isNaN(shock.deltaPct)).toBe(true);
    expect(shock.severity).toBe('neutral');

    const payoff = statById(result, 'pays_off_ahead_of_schedule');
    expect(Number.isNaN(payoff.baselinePct)).toBe(true);
    expect(Number.isNaN(payoff.decisionPct)).toBe(true);
    expect(Number.isNaN(payoff.deltaPct)).toBe(true);
    expect(payoff.severity).toBe('neutral');
  });

  it('assigns severity from stat direction and the 2-point noise floor', () => {
    // Bad stat made worse -> negative.
    expect(
      statById(
        aggregateResults(
          makePaired(
            tenTrajectories((index) => ({ everBreachedFund: index < 1 })),
            tenTrajectories((index) => ({ everBreachedFund: index < 3 })),
          ),
        ),
        'fund_breach',
      ).severity,
    ).toBe('negative');

    // Bad stat improved -> positive.
    expect(
      statById(
        aggregateResults(
          makePaired(
            tenTrajectories((index) => ({ everBreachedFund: index < 5 })),
            tenTrajectories((index) => ({ everBreachedFund: index < 2 })),
          ),
        ),
        'fund_breach',
      ).severity,
    ).toBe('positive');

    // Good stat improved -> positive.
    const goodBase = tenTrajectories((index) => ({
      startingLiquid: 1000,
      endingNetWorth: index < 2 ? 5000 : 0,
    }));
    const goodBetter = tenTrajectories((index) => ({
      startingLiquid: 1000,
      endingNetWorth: index < 5 ? 5000 : 0,
    }));
    expect(
      statById(
        aggregateResults(makePaired(goodBase, goodBetter)),
        'positive_net_worth_swing',
      ).severity,
    ).toBe('positive');

    // Good stat worsened -> negative.
    expect(
      statById(
        aggregateResults(makePaired(goodBetter, goodBase)),
        'positive_net_worth_swing',
      ).severity,
    ).toBe('negative');
  });
});

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

describe('aggregateResults invariants', () => {
  it('always returns 12 bands and exact delta arithmetic for every stat', () => {
    const baseline = tenTrajectories((index) => ({
      everBreachedFund: index < 4,
      everFailedMonth: index < 2,
      startingLiquid: 1000,
      endingNetWorth: index < 6 ? 5000 : 0,
    }));
    const decision = tenTrajectories((index) => ({
      everBreachedFund: index < 1,
      everFailedMonth: index < 3,
      startingLiquid: 1000,
      endingNetWorth: index < 3 ? 5000 : 0,
    }));

    const result = aggregateResults(makePaired(baseline, decision));

    expect(result.baselineBands).toHaveLength(12);
    expect(result.decisionBands).toHaveLength(12);
    expect(result.scenarioCount).toBe(10);
    for (const stat of result.stats) {
      // Object.is keeps NaN === NaN for the N/A stats.
      expect(Object.is(stat.deltaPct, stat.decisionPct - stat.baselinePct)).toBe(true);
    }
  });
});
