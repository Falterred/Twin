import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HAZARD_OVERRIDES,
  HAZARD_SEVERITY_MULTIPLIER,
  buildDerivedState,
  type DebtInstrument,
  type DerivedState,
  type ExpenseCategory,
  type FinancialSnapshot,
  type HazardOverrides,
  type IncomeSource,
  type SimConfig,
} from './state';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

type DecisionArg = Parameters<typeof buildDerivedState>[1];

const validConfig: SimConfig = { scenarioCount: 50, horizonMonths: 12 };

/** Expected shipped defaults (Part 1 owns the single source of truth; Part 3 re-exports them). */
const EXPECTED_DEFAULTS: HazardOverrides = {
  jobLossBaseProb: 0.02,
  medicalRoutineBaseProb: 0.08,
  medicalTailBaseProb: 0.005,
  housingSpikeBaseProb: 0.015,
  bonusBaseProb: 0.04,
  windfallBaseProb: 0.008,
  incomeNoise: { stable: 0.05, variable: 0.25, volatile: 0.45 },
  newCreditLineAprPct: 24.0,
};

const debtA: DebtInstrument = {
  id: 'debt-a',
  type: 'personal_loan',
  label: 'Personal loan',
  balance: 200000,
  annualRatePct: 12,
  minMonthlyPayment: 8000,
  termMonthsRemaining: 24,
};

const debtB: DebtInstrument = {
  id: 'debt-b',
  type: 'credit_card',
  label: 'Credit card',
  balance: 50000,
  annualRatePct: 36,
  minMonthlyPayment: 2500,
  termMonthsRemaining: null,
};

function makeDecision(): DecisionArg {
  return { kind: 'none' } as unknown as DecisionArg;
}

function validSnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    incomeSources: [{ id: 'inc-1', label: 'Salary', monthlyAmount: 85000, stability: 'stable' }],
    debts: [],
    expenses: [{ id: 'exp-1', label: 'Rent', type: 'fixed', monthlyAmount: 20000 }],
    emergencyFund: { balance: 150000, targetMonths: 6, isInvested: false },
    liquidCashOutsideFund: 40000,
    riskProfile: 'balanced',
    debtFallbackOrder: ['NEW_CREDIT_LINE'],
    ...overrides,
  };
}

function badSnapshot(mutate: (snapshot: FinancialSnapshot) => void): FinancialSnapshot {
  const snapshot = validSnapshot();
  mutate(snapshot);
  return snapshot;
}

function build(
  snapshot: FinancialSnapshot,
  overrides: Partial<HazardOverrides> = {},
  config: SimConfig = validConfig,
  decision: DecisionArg = makeDecision(),
): DerivedState {
  return buildDerivedState(snapshot, decision, config, overrides);
}

// A 3-income / 3-expense / 2-debt scenario used across the calculation and validation tests.
function richSnapshot(): FinancialSnapshot {
  return validSnapshot({
    incomeSources: [
      { id: 'inc-1', label: 'Salary', monthlyAmount: 85000, stability: 'stable' },
      { id: 'inc-2', label: 'Freelance design', monthlyAmount: 15000, stability: 'variable' },
      { id: 'inc-3', label: 'Royalties', monthlyAmount: 5000, stability: 'volatile' },
    ] as IncomeSource[],
    expenses: [
      { id: 'exp-fixed', label: 'Rent', type: 'fixed', monthlyAmount: 20000 },
      { id: 'exp-disc', label: 'Dining', type: 'discretionary', monthlyAmount: 8000 },
      { id: 'exp-seas', label: 'Festive', type: 'seasonal', monthlyAmount: 3000, seasonalMultipliers: Array(12).fill(1) },
    ] as ExpenseCategory[],
    debts: [debtA, debtB],
    emergencyFund: { balance: 150000, targetMonths: 6, isInvested: false },
    debtFallbackOrder: ['debt-a', 'debt-b', 'NEW_CREDIT_LINE'],
  });
}

// ---------------------------------------------------------------------------
// Constants / defaults
// ---------------------------------------------------------------------------

describe('Part 1 constants', () => {
  it('ships the documented DEFAULT_HAZARD_OVERRIDES values', () => {
    expect(DEFAULT_HAZARD_OVERRIDES).toEqual(EXPECTED_DEFAULTS);
  });

  it('maps each risk profile to its documented hazard severity multiplier', () => {
    expect(HAZARD_SEVERITY_MULTIPLIER).toEqual({ conservative: 1.25, balanced: 1.0, aggressive: 0.8 });
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: default merging
// ---------------------------------------------------------------------------

describe('buildDerivedState - hazard override merging', () => {
  it('with no overrides, produces hazardOverrides deep-equal to DEFAULT_HAZARD_OVERRIDES', () => {
    const result = build(validSnapshot(), {});
    expect(result.hazardOverrides).toEqual(DEFAULT_HAZARD_OVERRIDES);
    expect(result.hazardOverrides).toEqual(EXPECTED_DEFAULTS);
  });

  it('merges a partial incomeNoise override: only incomeNoise changes, every other field keeps its default', () => {
    const result = build(validSnapshot(), {
      incomeNoise: { stable: 0.1, variable: 0.25, volatile: 0.45 },
    });
    expect(result.hazardOverrides.incomeNoise).toEqual({ stable: 0.1, variable: 0.25, volatile: 0.45 });
    expect(result.hazardOverrides.jobLossBaseProb).toBe(EXPECTED_DEFAULTS.jobLossBaseProb);
    expect(result.hazardOverrides.medicalRoutineBaseProb).toBe(EXPECTED_DEFAULTS.medicalRoutineBaseProb);
    expect(result.hazardOverrides.medicalTailBaseProb).toBe(EXPECTED_DEFAULTS.medicalTailBaseProb);
    expect(result.hazardOverrides.housingSpikeBaseProb).toBe(EXPECTED_DEFAULTS.housingSpikeBaseProb);
    expect(result.hazardOverrides.bonusBaseProb).toBe(EXPECTED_DEFAULTS.bonusBaseProb);
    expect(result.hazardOverrides.windfallBaseProb).toBe(EXPECTED_DEFAULTS.windfallBaseProb);
    expect(result.hazardOverrides.newCreditLineAprPct).toBe(EXPECTED_DEFAULTS.newCreditLineAprPct);
  });

  it('merges a single scalar override without touching any other field', () => {
    const result = build(validSnapshot(), { newCreditLineAprPct: 18 });
    expect(result.hazardOverrides.newCreditLineAprPct).toBe(18);
    expect(result.hazardOverrides.jobLossBaseProb).toBe(EXPECTED_DEFAULTS.jobLossBaseProb);
    expect(result.hazardOverrides.incomeNoise).toEqual(EXPECTED_DEFAULTS.incomeNoise);
  });

  it('does not deep-merge incomeNoise: an incomplete nested object is rejected', () => {
    const incomplete = { incomeNoise: { stable: 0.1 } } as unknown as Partial<HazardOverrides>;
    expect(() => build(validSnapshot(), incomplete)).toThrow(RangeError);
  });

  it('rejects a null incomeNoise override', () => {
    const nullNoise = { incomeNoise: null } as unknown as Partial<HazardOverrides>;
    expect(() => build(validSnapshot(), nullNoise)).toThrow(RangeError);
  });

  it('rejects negative, NaN and Infinity override values', () => {
    expect(() => build(validSnapshot(), { jobLossBaseProb: -0.01 })).toThrow(RangeError);
    expect(() => build(validSnapshot(), { bonusBaseProb: NaN })).toThrow(RangeError);
    expect(() => build(validSnapshot(), { windfallBaseProb: Infinity })).toThrow(RangeError);
  });

  it('treats a null overrides argument as no overrides', () => {
    const result = build(validSnapshot(), null as unknown as Partial<HazardOverrides>);
    expect(result.hazardOverrides).toEqual(DEFAULT_HAZARD_OVERRIDES);
  });

  it('returns a fresh incomeNoise object that is independent of the shipped defaults', () => {
    const result = build(validSnapshot(), {});
    expect(result.hazardOverrides.incomeNoise).not.toBe(DEFAULT_HAZARD_OVERRIDES.incomeNoise);
    result.hazardOverrides.incomeNoise.stable = 0.99;
    expect(DEFAULT_HAZARD_OVERRIDES.incomeNoise.stable).toBe(0.05);
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: calculations
// ---------------------------------------------------------------------------

describe('buildDerivedState - calculations', () => {
  it('computes correct sums for a minimal snapshot (1 income, 1 fixed expense, 0 debts)', () => {
    const result = build(validSnapshot());
    expect(result.totalMonthlyIncome).toBe(85000);
    expect(result.totalFixedExpenses).toBe(20000);
    expect(result.totalMinDebtPayments).toBe(0);
    expect(result.emergencyFundTargetRs).toBe(120000);
  });

  it('counts only fixed expenses toward totalFixedExpenses', () => {
    const result = build(
      validSnapshot({
        expenses: [
          { id: 'exp-fixed', label: 'Rent', type: 'fixed', monthlyAmount: 20000 },
          { id: 'exp-disc', label: 'Dining', type: 'discretionary', monthlyAmount: 8000 },
          { id: 'exp-seas', label: 'Festive', type: 'seasonal', monthlyAmount: 3000, seasonalMultipliers: Array(12).fill(1.5) },
        ],
      }),
    );
    expect(result.totalFixedExpenses).toBe(20000);
  });

  it('sums 3 income sources and 2 debts correctly, and derives the fund target from fixed expenses', () => {
    const result = build(richSnapshot());
    expect(result.totalMonthlyIncome).toBe(105000);
    expect(result.totalFixedExpenses).toBe(20000);
    expect(result.totalMinDebtPayments).toBe(10500);
    expect(result.emergencyFundTargetRs).toBe(120000);
  });

  it('scales the emergency fund target by emergencyFund.targetMonths', () => {
    const result = build(validSnapshot({ emergencyFund: { balance: 150000, targetMonths: 9, isInvested: false } }));
    expect(result.emergencyFundTargetRs).toBe(180000);
  });

  it('passes the config through unchanged', () => {
    const config: SimConfig = { scenarioCount: 300, horizonMonths: 12, randomSeed: 42 };
    const result = build(validSnapshot(), {}, config);
    expect(result.config).toEqual(config);
  });

  it('returns derived state whose snapshot matches the input snapshot shape', () => {
    const snapshot = richSnapshot();
    const result = build(snapshot);
    expect(result.snapshot).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: non-mutation
// ---------------------------------------------------------------------------

describe('buildDerivedState - non-mutation', () => {
  it('does not mutate the snapshot or decision arguments and returns clones', () => {
    const snapshot = richSnapshot();
    const decision = { kind: 'none', nested: { list: [1, 2, 3] } } as unknown as DecisionArg;
    const snapshotBefore = structuredClone(snapshot);
    const decisionBefore = structuredClone(decision);

    const result = buildDerivedState(snapshot, decision, validConfig, {});

    expect(snapshot).toEqual(snapshotBefore);
    expect(decision).toEqual(decisionBefore);
    expect(result.snapshot).not.toBe(snapshot);
    expect(result.decision).not.toBe(decision);

    result.snapshot.incomeSources[0].monthlyAmount = 0;
    (result.decision as unknown as { nested: { list: number[] } }).nested.list.push(4);

    expect(snapshot.incomeSources[0].monthlyAmount).toBe(85000);
    expect((decision as unknown as { nested: { list: number[] } }).nested.list).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Validation Rules: collection shapes
// ---------------------------------------------------------------------------

describe('validation - collection shapes', () => {
  it('rejects a null snapshot', () => {
    expect(() => build(null as unknown as FinancialSnapshot)).toThrow(RangeError);
  });

  it('rejects zero income sources', () => {
    expect(() => build(badSnapshot((s) => { s.incomeSources = []; }))).toThrow(RangeError);
  });

  it('rejects a non-array incomeSources field', () => {
    expect(() => build(badSnapshot((s) => { s.incomeSources = null as unknown as IncomeSource[]; }))).toThrow(RangeError);
  });

  it('rejects zero expense categories', () => {
    expect(() => build(badSnapshot((s) => { s.expenses = []; }))).toThrow(RangeError);
  });

  it('rejects a non-array expenses field', () => {
    expect(() => build(badSnapshot((s) => { s.expenses = null as unknown as ExpenseCategory[]; }))).toThrow(RangeError);
  });

  it('rejects a non-array debts field', () => {
    expect(() => build(badSnapshot((s) => { s.debts = null as unknown as DebtInstrument[]; }))).toThrow(RangeError);
  });

  it('rejects a null emergency fund', () => {
    expect(() => build(badSnapshot((s) => { s.emergencyFund = null as unknown as FinancialSnapshot['emergencyFund']; }))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Validation Rules: enums are rejected, never silently defaulted
// ---------------------------------------------------------------------------

describe('validation - enum values', () => {
  it('rejects an unknown income stability', () => {
    expect(() => build(badSnapshot((s) => {
      s.incomeSources[0].stability = 'gig' as unknown as IncomeSource['stability'];
    }))).toThrow(RangeError);
  });

  it('rejects an unknown debt type', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, type: 'payday' as unknown as DebtInstrument['type'] }]; }))).toThrow(RangeError);
  });

  it('rejects an unknown expense category type', () => {
    expect(() => build(badSnapshot((s) => {
      s.expenses = [{ ...s.expenses[0], type: 'luxury' as unknown as ExpenseCategory['type'] }];
    }))).toThrow(RangeError);
  });

  it('rejects an unknown risk profile', () => {
    expect(() => build(badSnapshot((s) => {
      s.riskProfile = 'moderate' as unknown as FinancialSnapshot['riskProfile'];
    }))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Validation Rules: monetary fields are finite and >= 0
// ---------------------------------------------------------------------------

describe('validation - monetary fields', () => {
  const invalidNumbers: number[] = [-1, -0.01, NaN, Infinity, -Infinity];

  for (const value of invalidNumbers) {
    it('rejects income monthlyAmount = ' + String(value), () => {
      expect(() => build(badSnapshot((s) => { s.incomeSources[0].monthlyAmount = value; }))).toThrow(RangeError);
    });

    it('rejects debt balance = ' + String(value), () => {
      expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, balance: value }]; }))).toThrow(RangeError);
    });

    it('rejects expense monthlyAmount = ' + String(value), () => {
      expect(() => build(badSnapshot((s) => { s.expenses[0].monthlyAmount = value; }))).toThrow(RangeError);
    });

    it('rejects emergencyFund.balance = ' + String(value), () => {
      expect(() => build(badSnapshot((s) => { s.emergencyFund.balance = value; }))).toThrow(RangeError);
    });

    it('rejects liquidCashOutsideFund = ' + String(value), () => {
      expect(() => build(badSnapshot((s) => { s.liquidCashOutsideFund = value; }))).toThrow(RangeError);
    });
  }

  it('rejects a negative annualRatePct', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, annualRatePct: -0.1 }]; }))).toThrow(RangeError);
  });

  it('rejects a negative minMonthlyPayment', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, minMonthlyPayment: -1 }]; }))).toThrow(RangeError);
  });

  it('rejects a NaN minMonthlyPayment', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, minMonthlyPayment: NaN }]; }))).toThrow(RangeError);
  });

  it('accepts annualRatePct = 0 and minMonthlyPayment = 0', () => {
    const result = build(badSnapshot((s) => { s.debts = [{ ...debtA, annualRatePct: 0, minMonthlyPayment: 0 }]; s.debtFallbackOrder = ['debt-a', 'NEW_CREDIT_LINE']; }));
    expect(result.totalMinDebtPayments).toBe(0);
  });

  it('rejects termMonthsRemaining below zero', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, termMonthsRemaining: -1 }]; }))).toThrow(RangeError);
  });

  it('rejects a fractional termMonthsRemaining', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, termMonthsRemaining: 1.5 }]; }))).toThrow(RangeError);
  });

  it('rejects a NaN termMonthsRemaining', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, termMonthsRemaining: NaN }]; }))).toThrow(RangeError);
  });

  it('rejects a non-numeric termMonthsRemaining', () => {
    expect(() => build(badSnapshot((s) => { s.debts = [{ ...debtA, termMonthsRemaining: 'twelve' as unknown as number }]; }))).toThrow(RangeError);
  });

  it('accepts termMonthsRemaining = null (revolving) and an integer >= 0', () => {
    const revolving = build(badSnapshot((s) => { s.debts = [{ ...debtB, termMonthsRemaining: null }]; s.debtFallbackOrder = ['debt-b', 'NEW_CREDIT_LINE']; }));
    expect(revolving.totalMinDebtPayments).toBe(2500);
    const zeroTerm = build(badSnapshot((s) => { s.debts = [{ ...debtA, termMonthsRemaining: 0 }]; s.debtFallbackOrder = ['debt-a', 'NEW_CREDIT_LINE']; }));
    expect(zeroTerm.totalMinDebtPayments).toBe(8000);
  });

  it('rejects emergencyFund.targetMonths = 0', () => {
    expect(() => build(badSnapshot((s) => { s.emergencyFund.targetMonths = 0; }))).toThrow(RangeError);
  });

  it('rejects a negative emergencyFund.targetMonths', () => {
    expect(() => build(badSnapshot((s) => { s.emergencyFund.targetMonths = -6; }))).toThrow(RangeError);
  });

  it('rejects a NaN emergencyFund.targetMonths', () => {
    expect(() => build(badSnapshot((s) => { s.emergencyFund.targetMonths = NaN; }))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Validation Rules: seasonalMultipliers
// ---------------------------------------------------------------------------

describe('validation - seasonalMultipliers', () => {
  it('accepts a seasonal expense with exactly 12 finite multipliers >= 0', () => {
    const result = build(validSnapshot({
      expenses: [{ id: 'exp-seas', label: 'Festive', type: 'seasonal', monthlyAmount: 3000, seasonalMultipliers: Array(12).fill(1.25) }],
    }));
    expect(result.totalFixedExpenses).toBe(0);
  });

  it('rejects a seasonalMultipliers array whose length is not 12', () => {
    expect(() => build(badSnapshot((s) => {
      s.expenses = [{ id: 'exp-seas', label: 'Festive', type: 'seasonal', monthlyAmount: 3000, seasonalMultipliers: Array(11).fill(1) }];
    }))).toThrow(RangeError);
  });

  it('rejects a non-array seasonalMultipliers value', () => {
    expect(() => build(badSnapshot((s) => {
      s.expenses = [{ id: 'exp-seas', label: 'Festive', type: 'seasonal', monthlyAmount: 3000, seasonalMultipliers: 'x' as unknown as number[] }];
    }))).toThrow(RangeError);
  });

  it('rejects a NaN seasonal multiplier', () => {
    expect(() => build(badSnapshot((s) => {
      const multipliers = Array(12).fill(1);
      multipliers[3] = NaN;
      s.expenses = [{ id: 'exp-seas', label: 'Festive', type: 'seasonal', monthlyAmount: 3000, seasonalMultipliers: multipliers }];
    }))).toThrow(RangeError);
  });

  it('rejects a negative seasonal multiplier', () => {
    expect(() => build(badSnapshot((s) => {
      const multipliers = Array(12).fill(1);
      multipliers[2] = -0.5;
      s.expenses = [{ id: 'exp-seas', label: 'Festive', type: 'seasonal', monthlyAmount: 3000, seasonalMultipliers: multipliers }];
    }))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Validation Rules: debtFallbackOrder
// ---------------------------------------------------------------------------

describe('validation - debtFallbackOrder', () => {
  it('accepts an order containing every debt id exactly once plus NEW_CREDIT_LINE exactly once', () => {
    const result = build(richSnapshot());
    expect(result.snapshot.debtFallbackOrder).toEqual(['debt-a', 'debt-b', 'NEW_CREDIT_LINE']);
  });

  it('rejects an order missing one debt id', () => {
    expect(() => build(badSnapshot((s) => {
      s.debts = [debtA, debtB];
      s.debtFallbackOrder = ['debt-a', 'NEW_CREDIT_LINE'];
    }))).toThrow(RangeError);
  });

  it('rejects an order missing NEW_CREDIT_LINE', () => {
    expect(() => build(badSnapshot((s) => {
      s.debts = [debtA];
      s.debtFallbackOrder = ['debt-a'];
    }))).toThrow(RangeError);
  });

  it('rejects a duplicated debt id', () => {
    expect(() => build(badSnapshot((s) => {
      s.debts = [debtA, debtB];
      s.debtFallbackOrder = ['debt-a', 'debt-a', 'debt-b', 'NEW_CREDIT_LINE'];
    }))).toThrow(RangeError);
  });

  it('rejects a duplicated NEW_CREDIT_LINE', () => {
    expect(() => build(badSnapshot((s) => {
      s.debts = [debtA];
      s.debtFallbackOrder = ['debt-a', 'NEW_CREDIT_LINE', 'NEW_CREDIT_LINE'];
    }))).toThrow(RangeError);
  });

  it('rejects an unknown id', () => {
    expect(() => build(badSnapshot((s) => {
      s.debts = [debtA];
      s.debtFallbackOrder = ['debt-a', 'ghost', 'NEW_CREDIT_LINE'];
    }))).toThrow(RangeError);
  });

  it('rejects a non-array debtFallbackOrder', () => {
    expect(() => build(badSnapshot((s) => { s.debtFallbackOrder = null as unknown as string[]; }))).toThrow(RangeError);
  });

  it('rejects a non-string id in the fallback order', () => {
    expect(() => build(badSnapshot((s) => {
      s.debts = [debtA];
      s.debtFallbackOrder = ['debt-a', 42 as unknown as string, 'NEW_CREDIT_LINE'];
    }))).toThrow(RangeError);
  });

  it('rejects an empty-string id in the fallback order', () => {
    expect(() => build(badSnapshot((s) => {
      s.debts = [debtA];
      s.debtFallbackOrder = ['debt-a', '', 'NEW_CREDIT_LINE'];
    }))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Validation Rules: SimConfig boundary
// ---------------------------------------------------------------------------

describe('validation - SimConfig', () => {
  it('rejects a null config', () => {
    expect(() => buildDerivedState(validSnapshot(), makeDecision(), null as unknown as SimConfig, {})).toThrow(RangeError);
  });

  it('rejects a scenarioCount outside 50 | 100 | 300', () => {
    expect(() => build(validSnapshot(), {}, { scenarioCount: 10, horizonMonths: 12 } as unknown as SimConfig)).toThrow(RangeError);
  });

  it('rejects a horizonMonths other than 12', () => {
    expect(() => build(validSnapshot(), {}, { scenarioCount: 50, horizonMonths: 6 } as unknown as SimConfig)).toThrow(RangeError);
  });

  it('rejects a non-finite randomSeed', () => {
    expect(() => build(validSnapshot(), {}, { scenarioCount: 50, horizonMonths: 12, randomSeed: NaN })).toThrow(RangeError);
  });

  it('accepts a finite randomSeed', () => {
    const result = build(validSnapshot(), {}, { scenarioCount: 100, horizonMonths: 12, randomSeed: 7 });
    expect(result.config.randomSeed).toBe(7);
    expect(result.config.scenarioCount).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: risk-profile severity coupling
// ---------------------------------------------------------------------------

describe('hazardSeverityMultiplier by risk profile', () => {
  it('is 1.25 for conservative', () => {
    expect(build(validSnapshot({ riskProfile: 'conservative' })).hazardSeverityMultiplier).toBe(1.25);
  });

  it('is 1.0 for balanced', () => {
    expect(build(validSnapshot({ riskProfile: 'balanced' })).hazardSeverityMultiplier).toBe(1.0);
  });

  it('is 0.8 for aggressive', () => {
    expect(build(validSnapshot({ riskProfile: 'aggressive' })).hazardSeverityMultiplier).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// Validation Rules: non-primitive / non-string inputs reach every guard branch
// ---------------------------------------------------------------------------

describe('validation - non-primitive and non-string inputs', () => {
  it('rejects a non-object snapshot', () => {
    expect(() => build(5 as unknown as FinancialSnapshot)).toThrow(RangeError);
  });

  it('rejects a non-string enum value', () => {
    expect(() => build(badSnapshot((s) => {
      s.incomeSources[0].stability = 42 as unknown as IncomeSource['stability'];
    }))).toThrow(RangeError);
  });

  it('rejects a non-number monetary value', () => {
    expect(() => build(badSnapshot((s) => { s.liquidCashOutsideFund = 'lots' as unknown as number; }))).toThrow(RangeError);
  });

  it('rejects a non-object emergency fund', () => {
    expect(() => build(badSnapshot((s) => { s.emergencyFund = 5 as unknown as FinancialSnapshot['emergencyFund']; }))).toThrow(RangeError);
  });

  it('rejects a non-number targetMonths', () => {
    expect(() => build(badSnapshot((s) => { s.emergencyFund.targetMonths = 'six' as unknown as number; }))).toThrow(RangeError);
  });

  it('rejects a non-array debtFallbackOrder and describes the object value', () => {
    expect(() => build(badSnapshot((s) => { s.debtFallbackOrder = { order: [] } as unknown as string[]; }))).toThrow(RangeError);
  });

  it('rejects a non-numeric randomSeed', () => {
    expect(() => build(validSnapshot(), {}, { scenarioCount: 50, horizonMonths: 12, randomSeed: 'x' as unknown as number })).toThrow(RangeError);
  });
});

