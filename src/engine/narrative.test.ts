import { describe, expect, it } from 'vitest';

import {
  applyForkEdits,
  generateNarrative,
  type ForkEditableField,
  type NarrativeLine,
} from './narrative';
import { buildDerivedState, type FinancialSnapshot, type HazardOverrides } from './state';
import type { FiredEvent } from './hazards';
import type { MonthOutcome } from './responsePolicy';
import { forkFromCheckpoint, runSimulation } from './scenarioRunner';
import type { MonthlyCheckpoint, ScenarioTrajectory } from './scenarioRunner';
import type { DecisionDiff } from './decision';
import type { SimConfig } from './state';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const NO_EVENTS: Partial<HazardOverrides> = {
  jobLossBaseProb: 0,
  medicalRoutineBaseProb: 0,
  medicalTailBaseProb: 0,
  housingSpikeBaseProb: 0,
  bonusBaseProb: 0,
  windfallBaseProb: 0,
};

const NO_NOISE = { stable: 0, variable: 0, volatile: 0 };

type MonthSpec = {
  events?: FiredEvent[];
  emergencyFundDraw?: number;
  shortfallUncovered?: number;
  cashBeforeResponse?: number;
  liquidCash?: number;
  isUnemployed?: boolean;
  monthsUnemployed?: number;
};

function baseSnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    incomeSources: [
      { id: 'inc-1', label: 'Salary', monthlyAmount: 50000, stability: 'stable' },
      { id: 'inc-2', label: 'Freelance', monthlyAmount: 20000, stability: 'variable' },
    ],
    debts: [
      {
        id: 'debt-1',
        type: 'personal_loan',
        label: 'Loan',
        balance: 100000,
        annualRatePct: 12,
        minMonthlyPayment: 5000,
        termMonthsRemaining: 24,
      },
      {
        id: 'debt-2',
        type: 'credit_card',
        label: 'Card',
        balance: 20000,
        annualRatePct: 36,
        minMonthlyPayment: 3000,
        termMonthsRemaining: null,
      },
    ],
    expenses: [{ id: 'exp-1', label: 'Rent', type: 'fixed', monthlyAmount: 20000 }],
    emergencyFund: { balance: 100000, targetMonths: 6, isInvested: false },
    liquidCashOutsideFund: 50000,
    riskProfile: 'balanced',
    debtFallbackOrder: ['debt-1', 'debt-2', 'NEW_CREDIT_LINE'],
    ...overrides,
  };
}

function firedEvent(type: FiredEvent['type'], amount: number, label: string, month: number): FiredEvent {
  return { type, month, amount, label };
}

function makeTrajectory(specs: MonthSpec[]): ScenarioTrajectory {
  const checkpoints: MonthlyCheckpoint[] = specs.map((spec, month) => {
    const outcome: MonthOutcome = {
      month,
      cashBeforeResponse: spec.cashBeforeResponse ?? 0,
      emergencyFundDraw: spec.emergencyFundDraw ?? 0,
      debtDraws: [],
      newCreditLineDraw: 0,
      shortfallUncovered: spec.shortfallUncovered ?? 0,
      endingCash: 0,
      endingFundBalance: 0,
      endingDebtBalances: {},
    };
    return {
      month,
      snapshot: baseSnapshot({ liquidCashOutsideFund: spec.liquidCash ?? 0 }),
      hazardState: {
        isUnemployed: spec.isUnemployed ?? false,
        monthsUnemployed: spec.monthsUnemployed ?? 0,
        fundBreachedThisRun: false,
        missedPaymentLastMonth: false,
      },
      firedEvents: spec.events ?? [],
      outcome,
      newCreditLineBalance: 0,
    };
  });
  return {
    scenarioIndex: 0,
    seed: 1,
    checkpoints,
    finalState: baseSnapshot(),
    everBreachedFund: false,
    everFailedMonth: false,
    endingNetWorth: 0,
  };
}

function flatSpecs(count = 12): MonthSpec[] {
  const specs: MonthSpec[] = [];
  for (let index = 0; index < count; index++) {
    specs.push({});
  }
  return specs;
}

function lineAt(lines: NarrativeLine[], month: number): NarrativeLine | undefined {
  return lines.find((line) => line.month === month);
}

// ---------------------------------------------------------------------------
// generateNarrative
// ---------------------------------------------------------------------------

describe('generateNarrative - quiet months and summaries', () => {
  it('emits only the month-0 opening and month-11 closing lines for a quiet trajectory', () => {
    const lines = generateNarrative(makeTrajectory(flatSpecs()));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      month: 0,
      text: 'Month 0: Starting position.',
      tone: 'neutral',
      relatedEvents: [],
    });
    expect(lines[1]).toEqual({
      month: 11,
      text: 'Month 11: Closing position.',
      tone: 'neutral',
      relatedEvents: [],
    });
  });
});

describe('generateNarrative - job_loss', () => {
  it('emits one line at the firing month with the drawn duration and a setback tone', () => {
    const specs = flatSpecs();
    specs[4] = { events: [firedEvent('job_loss', 0, 'Lost income: Salary', 4)] };
    specs[5] = { isUnemployed: true, monthsUnemployed: 1 };
    specs[6] = { isUnemployed: true, monthsUnemployed: 2 };
    specs[7] = { isUnemployed: true, monthsUnemployed: 3 };

    const lines = generateNarrative(makeTrajectory(specs));
    const monthFour = lines.filter((line) => line.month === 4);
    expect(monthFour).toHaveLength(1);
    expect(monthFour[0].text).toBe('Month 4: Lost Salary income. Expected back around month 7.');
    expect(monthFour[0].tone).toBe('setback');
    expect(monthFour[0].relatedEvents).toHaveLength(1);
  });

  it('falls back to the raw label when the event carries no source prefix', () => {
    const specs = flatSpecs();
    specs[4] = { events: [firedEvent('job_loss', 0, 'Job loss', 4)] };
    const lines = generateNarrative(makeTrajectory(specs));
    expect(lineAt(lines, 4)?.text).toBe(
      'Month 4: Lost Job loss income. Expected back around month 4.',
    );
  });

  it('reports a zero-month duration when the job loss fires in the final month', () => {
    const specs = flatSpecs();
    specs[11] = { events: [firedEvent('job_loss', 0, 'Lost income: Salary', 11)] };
    const lines = generateNarrative(makeTrajectory(specs));
    expect(lineAt(lines, 11)?.text).toBe(
      'Month 11: Lost Salary income. Expected back around month 11.',
    );
  });
});

describe('generateNarrative - event templates', () => {
  it('describes a tail medical expense', () => {
    const specs = flatSpecs();
    specs[2] = { events: [firedEvent('medical_expense', -120000, 'Medical expense', 2)] };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 2);
    expect(line?.text).toBe('Month 2: A major medical expense hit — ₹1,20,000.');
    expect(line?.tone).toBe('setback');
    expect(line?.relatedEvents).toHaveLength(1);
  });

  it('describes a housing cost spike', () => {
    const specs = flatSpecs();
    specs[3] = { events: [firedEvent('housing_cost_spike', -20000, 'Housing cost spike', 3)] };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 3);
    expect(line?.text).toBe(
      'Month 3: Rent/housing costs jumped by ₹20,000/month, ongoing for the rest of the year.',
    );
    expect(line?.tone).toBe('setback');
  });

  it('describes a windfall with a relief tone', () => {
    const specs = flatSpecs();
    specs[2] = { events: [firedEvent('windfall', 30000, 'Windfall', 2)] };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 2);
    expect(line?.text).toBe('Month 2: An unexpected ₹30,000 windfall.');
    expect(line?.tone).toBe('relief');
  });

  it('folds a routine medical expense with no fund draw silently', () => {
    const specs = flatSpecs();
    specs[2] = { events: [firedEvent('medical_expense', -5000, 'Medical expense', 2)] };
    const lines = generateNarrative(makeTrajectory(specs));
    expect(lineAt(lines, 2)).toBeUndefined();
    expect(lines).toHaveLength(2);
  });

  it('describes a routine medical expense only when it triggered a fund draw', () => {
    const specs = flatSpecs();
    specs[2] = {
      events: [firedEvent('medical_expense', -5000, 'Medical expense', 2)],
      emergencyFundDraw: 8000,
    };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 2);
    expect(line?.text).toBe(
      'Month 2: Regular expenses outpaced income; ₹8,000 drawn from the emergency fund.',
    );
    expect(line?.tone).toBe('caution');
    expect(line?.relatedEvents).toHaveLength(1);
  });

  it('suppresses job_regained events, which have no narrative template', () => {
    const specs = flatSpecs();
    specs[2] = { events: [firedEvent('job_regained', 0, 'Job regained', 2)] };
    expect(lineAt(generateNarrative(makeTrajectory(specs)), 2)).toBeUndefined();
  });

  it('selects the highest-severity event when several fire in one month', () => {
    const specs = flatSpecs();
    specs[2] = {
      events: [
        firedEvent('bonus', 30000, 'Bonus', 2),
        firedEvent('windfall', 40000, 'Windfall', 2),
        firedEvent('housing_cost_spike', -20000, 'Housing cost spike', 2),
      ],
      cashBeforeResponse: 50000,
    };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 2);
    expect(line?.text).toBe(
      'Month 2: Rent/housing costs jumped by ₹20,000/month, ongoing for the rest of the year.',
    );
  });
});

describe('generateNarrative - bonus and fund draw', () => {
  it('emits a relief line for a bonus that prevented a fund draw', () => {
    const specs = flatSpecs();
    specs[2] = {
      events: [firedEvent('bonus', 30000, 'Bonus', 2)],
      cashBeforeResponse: 10000,
      liquidCash: 0,
    };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 2);
    expect(line?.text).toBe('Month 2: A ₹30,000 bonus kept this month out of the emergency fund.');
    expect(line?.tone).toBe('relief');
  });

  it('suppresses a bonus that did not change the month cashflow', () => {
    const specs = flatSpecs();
    specs[2] = {
      events: [firedEvent('bonus', 30000, 'Bonus', 2)],
      cashBeforeResponse: 50000,
    };
    expect(lineAt(generateNarrative(makeTrajectory(specs)), 2)).toBeUndefined();
  });

  it('suppresses a bonus that did not outrun the available liquid cash', () => {
    const specs = flatSpecs();
    specs[2] = {
      events: [firedEvent('bonus', 30000, 'Bonus', 2)],
      cashBeforeResponse: 10000,
      liquidCash: 50000,
    };
    expect(lineAt(generateNarrative(makeTrajectory(specs)), 2)).toBeUndefined();
  });

  it('suppresses a bonus when the month drew on the fund anyway and reports the draw', () => {
    const specs = flatSpecs();
    specs[2] = {
      events: [firedEvent('bonus', 30000, 'Bonus', 2)],
      cashBeforeResponse: 10000,
      liquidCash: 0,
      emergencyFundDraw: 4000,
    };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 2);
    expect(line?.text).toBe(
      'Month 2: Regular expenses outpaced income; ₹4,000 drawn from the emergency fund.',
    );
    expect(line?.relatedEvents).toEqual([]);
  });

  it('emits a fund-draw line when no event fired that month', () => {
    const specs = flatSpecs();
    specs[2] = { emergencyFundDraw: 12000 };
    const line = lineAt(generateNarrative(makeTrajectory(specs)), 2);
    expect(line?.text).toBe(
      'Month 2: Regular expenses outpaced income; ₹12,000 drawn from the emergency fund.',
    );
    expect(line?.tone).toBe('caution');
  });
});

describe('generateNarrative - total failure override', () => {
  it('always emits the uncovered-shortfall line, even when a bonus fired', () => {
    const specs = flatSpecs();
    specs[7] = {
      events: [firedEvent('bonus', 30000, 'Bonus', 7)],
      cashBeforeResponse: 10000,
      shortfallUncovered: 4200,
    };
    const lines = generateNarrative(makeTrajectory(specs));
    const line = lineAt(lines, 7);
    expect(line?.text).toBe(
      "Month 7: Even after the emergency fund and available credit, ₹4,200 couldn't be covered this month.",
    );
    expect(line?.tone).toBe('setback');
    expect(line?.relatedEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// applyForkEdits
// ---------------------------------------------------------------------------

describe('applyForkEdits', () => {
  it('applies a debt balance edit to a deep clone only', () => {
    const snapshot = baseSnapshot();
    const before = JSON.stringify(snapshot);
    const edited = applyForkEdits(snapshot, [{ field: 'debt.debt-1.balance', value: 42 }]);

    expect(edited.debts[0].balance).toBe(42);
    expect(edited.debts[1].balance).toBe(20000);
    expect(edited.emergencyFund.balance).toBe(100000);
    expect(edited.liquidCashOutsideFund).toBe(50000);
    expect(edited).not.toBe(snapshot);
    expect(edited.debts).not.toBe(snapshot.debts);
    expect(edited.debts[0]).not.toBe(snapshot.debts[0]);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('applies fund, liquid-cash and income-source edits', () => {
    const snapshot = baseSnapshot();
    const edited = applyForkEdits(snapshot, [
      { field: 'emergencyFund.balance', value: 999 },
      { field: 'liquidCashOutsideFund', value: 777 },
      { field: 'incomeSource.inc-2.monthlyAmount', value: 12345 },
    ]);

    expect(edited.emergencyFund.balance).toBe(999);
    expect(edited.liquidCashOutsideFund).toBe(777);
    expect(edited.incomeSources[1].monthlyAmount).toBe(12345);
    expect(edited.incomeSources[0].monthlyAmount).toBe(50000);
    expect(snapshot.emergencyFund.balance).toBe(100000);
    expect(snapshot.liquidCashOutsideFund).toBe(50000);
    expect(snapshot.incomeSources[1].monthlyAmount).toBe(20000);
  });

  it('throws for an unknown debt id instead of silently ignoring it', () => {
    const snapshot = baseSnapshot();
    expect(() => applyForkEdits(snapshot, [{ field: 'debt.missing.balance', value: 1 }])).toThrow(
      /Unknown debtId/,
    );
  });

  it('throws for an unknown income source id', () => {
    const snapshot = baseSnapshot();
    expect(() =>
      applyForkEdits(snapshot, [{ field: 'incomeSource.missing.monthlyAmount', value: 1 }]),
    ).toThrow(/Unknown incomeSourceId/);
  });

  it('throws for a field shape that matches no supported edit', () => {
    const snapshot = baseSnapshot();
    const bogus = { field: 'bogus', value: 1 } as unknown as ForkEditableField;
    expect(() => applyForkEdits(snapshot, [bogus])).toThrow(/Unknown fork edit field/);
  });

  it('throws for template fields with a mismatched suffix', () => {
    const snapshot = baseSnapshot();
    const badDebt = { field: 'debt.debt-1.monthlyAmount', value: 1 } as unknown as ForkEditableField;
    const badIncome = {
      field: 'incomeSource.inc-1.balance',
      value: 1,
    } as unknown as ForkEditableField;
    expect(() => applyForkEdits(snapshot, [badDebt])).toThrow(/Unknown fork edit field/);
    expect(() => applyForkEdits(snapshot, [badIncome])).toThrow(/Unknown fork edit field/);
  });
});

// ---------------------------------------------------------------------------
// Integration with Part 5 forking
// ---------------------------------------------------------------------------

describe('narrative + forkFromCheckpoint integration', () => {
  function buildDriftingDownDerived(): ReturnType<typeof buildDerivedState> {
    const decision: DecisionDiff = { kind: 'none' };
    const config: SimConfig = { scenarioCount: 50, horizonMonths: 12, randomSeed: 2024 };
    return buildDerivedState(
      baseSnapshot({
        incomeSources: [{ id: 'inc-1', label: 'Salary', monthlyAmount: 50000, stability: 'stable' }],
        debts: [],
        debtFallbackOrder: ['NEW_CREDIT_LINE'],
        expenses: [{ id: 'exp-1', label: 'Rent', type: 'fixed', monthlyAmount: 55000 }],
        liquidCashOutsideFund: 0,
        emergencyFund: { balance: 50000, targetMonths: 6, isInvested: false },
      }),
      decision,
      config,
      { ...NO_EVENTS, incomeNoise: NO_NOISE },
    );
  }

  it('keeps early narrative lines identical when a topped-up fork removes a later breach', () => {
    const derivedState = buildDriftingDownDerived();
    const original = runSimulation(derivedState)[0].baseline;

    expect(original.everBreachedFund).toBe(true);
    const breachMonth = original.checkpoints.find(
      (checkpoint) => checkpoint.outcome.endingFundBalance === 0,
    )?.month;
    expect(breachMonth).toBe(9);

    const editedSnapshot = applyForkEdits(original.checkpoints[6].snapshot, [
      { field: 'emergencyFund.balance', value: 500000 },
    ]);
    expect(original.checkpoints[6].snapshot.emergencyFund.balance).toBe(20000);

    const forked = forkFromCheckpoint(derivedState, original, 6, editedSnapshot);
    expect(forked.everBreachedFund).toBe(false);
    for (let month = 6; month < 12; month++) {
      expect(forked.checkpoints[month].outcome.endingFundBalance).toBeGreaterThan(0);
    }

    const originalLines = generateNarrative(original);
    const forkedLines = generateNarrative(forked);
    expect(forkedLines.filter((line) => line.month <= 5)).toEqual(
      originalLines.filter((line) => line.month <= 5),
    );
    expect(originalLines.length).toBeGreaterThan(0);
  });
});
