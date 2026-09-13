import { describe, expect, it } from 'vitest';

import {
  applyDecisionToSnapshot,
  computeAmortizedMonthlyPayment,
  type DecisionDiff,
  type IncomeChangeDecision,
  type NewDebtDecision,
  type NewExpenseDecision,
  type OneTimeExpenseDecision,
} from './decision';
import type { DebtInstrument, FinancialSnapshot } from './state';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const debtA: DebtInstrument = {
  id: 'debt-existing',
  type: 'personal_loan',
  label: 'Personal loan',
  balance: 120000,
  annualRatePct: 14,
  minMonthlyPayment: 6000,
  termMonthsRemaining: 24,
};

function baseSnapshot(): FinancialSnapshot {
  return {
    incomeSources: [{ id: 'inc-1', label: 'Salary', monthlyAmount: 50000, stability: 'stable' }],
    debts: [],
    expenses: [{ id: 'exp-1', label: 'Rent', type: 'fixed', monthlyAmount: 15000 }],
    emergencyFund: { balance: 150000, targetMonths: 6, isInvested: false },
    liquidCashOutsideFund: 40000,
    riskProfile: 'balanced',
    debtFallbackOrder: ['NEW_CREDIT_LINE'],
  };
}

function snapshotWithExistingDebt(): FinancialSnapshot {
  return {
    ...baseSnapshot(),
    debts: [debtA],
    debtFallbackOrder: [debtA.id, 'NEW_CREDIT_LINE'],
  };
}

function apply(snapshot: FinancialSnapshot, decision: DecisionDiff) {
  return applyDecisionToSnapshot(snapshot, decision);
}

const newDebtDecision: NewDebtDecision = {
  kind: 'new_debt',
  debtType: 'auto_loan',
  principal: 600000,
  annualRatePct: 9,
  termMonths: 48,
  label: 'Car EMI',
};

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: new_debt
// ---------------------------------------------------------------------------

describe('new_debt', () => {
  it('computes minMonthlyPayment with the standard amortization formula (600000 @ 9% over 48 months)', () => {
    const { snapshot, timedEffects } = apply(baseSnapshot(), newDebtDecision);

    expect(snapshot.debts).toHaveLength(1);
    const debt = snapshot.debts[0];
    expect(debt.label).toBe('Car EMI');
    expect(debt.type).toBe('auto_loan');
    expect(debt.balance).toBe(600000);
    expect(debt.annualRatePct).toBe(9);
    expect(debt.termMonthsRemaining).toBe(48);
    expect(debt.minMonthlyPayment).toBeCloseTo(14931.025424, 6);
    expect(timedEffects).toEqual([]);
  });

  it('matches a second hand-computed amortization triple (300000 @ 12% over 36 months)', () => {
    const { snapshot } = apply(baseSnapshot(), {
      kind: 'new_debt',
      debtType: 'personal_loan',
      principal: 300000,
      annualRatePct: 12,
      termMonths: 36,
      label: 'Loan',
    });
    expect(snapshot.debts[0].minMonthlyPayment).toBeCloseTo(9964.292944, 6);
  });

  it('uses principal / n when the annual rate is zero', () => {
    const { snapshot } = apply(baseSnapshot(), {
      kind: 'new_debt',
      debtType: 'personal_loan',
      principal: 120000,
      annualRatePct: 0,
      termMonths: 12,
      label: 'Interest-free',
    });
    expect(snapshot.debts[0].minMonthlyPayment).toBe(10000);
  });

  it('appends the new debt id immediately before NEW_CREDIT_LINE exactly once', () => {
    const { snapshot } = apply(snapshotWithExistingDebt(), newDebtDecision);
    const newId = snapshot.debts[1].id;

    expect(snapshot.debts).toHaveLength(2);
    expect(snapshot.debtFallbackOrder).toEqual([debtA.id, newId, 'NEW_CREDIT_LINE']);
    expect(snapshot.debtFallbackOrder.filter((id) => id === newId)).toHaveLength(1);
    expect(snapshot.debtFallbackOrder.indexOf(newId)).toBe(snapshot.debtFallbackOrder.indexOf('NEW_CREDIT_LINE') - 1);
  });

  it('generates a fresh, unique debt id', () => {
    const first = apply(baseSnapshot(), newDebtDecision).snapshot.debts[0].id;
    const second = apply(baseSnapshot(), newDebtDecision).snapshot.debts[0].id;
    expect(typeof first).toBe('string');
    expect(first.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });

  it('does not mutate the input snapshot', () => {
    const original = snapshotWithExistingDebt();
    const before = structuredClone(original);
    apply(original, newDebtDecision);
    expect(original).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: income_change
// ---------------------------------------------------------------------------

describe('income_change', () => {
  it('percent_delta: -30% on a 50000 source yields 35000', () => {
    const { snapshot, timedEffects } = apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'percent_delta',
      percentDelta: -0.3,
    });
    expect(snapshot.incomeSources[0].monthlyAmount).toBe(35000);
    expect(timedEffects).toEqual([]);
  });

  it('percent_delta: applies a positive raise', () => {
    const { snapshot } = apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'percent_delta',
      percentDelta: 0.1,
    });
    expect(snapshot.incomeSources[0].monthlyAmount).toBeCloseTo(55000, 10);
  });

  it('percent_delta: clamps to 0 when the delta is below -100%', () => {
    const { snapshot } = apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'percent_delta',
      percentDelta: -1.5,
    });
    expect(snapshot.incomeSources[0].monthlyAmount).toBe(0);
  });

  it('percent_delta: clamps to 0 exactly at -100%', () => {
    const { snapshot } = apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'percent_delta',
      percentDelta: -1,
    });
    expect(snapshot.incomeSources[0].monthlyAmount).toBe(0);
  });

  it('replace: sets the amount and stability of the targeted source', () => {
    const { snapshot, timedEffects } = apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'replace',
      newMonthlyAmount: 72000,
      newStability: 'variable',
    });
    expect(snapshot.incomeSources).toHaveLength(1);
    expect(snapshot.incomeSources[0].monthlyAmount).toBe(72000);
    expect(snapshot.incomeSources[0].stability).toBe('variable');
    expect(timedEffects).toEqual([]);
  });

  it('add_new: appends a new IncomeSource and leaves original sources untouched', () => {
    const original = baseSnapshot();
    const sourcesBefore = structuredClone(original.incomeSources);

    const { snapshot, timedEffects } = apply(original, {
      kind: 'income_change',
      targetIncomeSourceId: null,
      changeType: 'add_new',
      newMonthlyAmount: 18000,
      newStability: 'variable',
      newLabel: 'Freelance design',
    });

    expect(snapshot.incomeSources).toHaveLength(2);
    expect(snapshot.incomeSources[0]).toEqual(sourcesBefore[0]);
    expect(snapshot.incomeSources[1].label).toBe('Freelance design');
    expect(snapshot.incomeSources[1].monthlyAmount).toBe(18000);
    expect(snapshot.incomeSources[1].stability).toBe('variable');
    expect(snapshot.incomeSources[1].id).not.toBe(original.incomeSources[0].id);
    expect(timedEffects).toEqual([]);
    expect(original.incomeSources).toEqual(sourcesBefore);
  });

  it('throws RangeError when the target income source id does not exist', () => {
    expect(() => apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: 'nope',
      changeType: 'percent_delta',
      percentDelta: -0.1,
    })).toThrow(RangeError);
  });

  it('throws RangeError when percent_delta omits percentDelta', () => {
    const incomplete = {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'percent_delta',
    } as IncomeChangeDecision;
    expect(() => apply(baseSnapshot(), incomplete)).toThrow(RangeError);
  });

  it('throws RangeError when replace omits newMonthlyAmount', () => {
    const incomplete = {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'replace',
      newStability: 'stable',
    } as IncomeChangeDecision;
    expect(() => apply(baseSnapshot(), incomplete)).toThrow(RangeError);
  });

  it('throws RangeError when add_new omits newLabel', () => {
    const incomplete = {
      kind: 'income_change',
      targetIncomeSourceId: null,
      changeType: 'add_new',
      newMonthlyAmount: 1000,
      newStability: 'stable',
    } as IncomeChangeDecision;
    expect(() => apply(baseSnapshot(), incomplete)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: new_expense
// ---------------------------------------------------------------------------

describe('new_expense', () => {
  const decision: NewExpenseDecision = {
    kind: 'new_expense',
    label: 'Subscription',
    monthlyAmount: 1200,
    expenseType: 'discretionary',
    startMonth: 3,
  };

  it('adds exactly one recurring_expense_from timed effect', () => {
    const { timedEffects } = apply(baseSnapshot(), decision);
    expect(timedEffects).toHaveLength(1);
    expect(timedEffects[0].kind).toBe('recurring_expense_from');
  });

  it('appends one expense with the right monthlyAmount, label and type', () => {
    const { snapshot } = apply(baseSnapshot(), decision);
    expect(snapshot.expenses).toHaveLength(2);
    const expense = snapshot.expenses[1];
    expect(expense.label).toBe('Subscription');
    expect(expense.monthlyAmount).toBe(1200);
    expect(expense.type).toBe('discretionary');
  });

  it('links the timed effect to the appended expense id and carries startMonth', () => {
    const { snapshot, timedEffects } = apply(baseSnapshot(), decision);
    const effect = timedEffects[0];
    expect(effect.kind).toBe('recurring_expense_from');
    if (effect.kind === 'recurring_expense_from') {
      expect(effect.expenseId).toBe(snapshot.expenses[1].id);
      expect(effect.startMonth).toBe(3);
    }
  });

  it('does not store startMonth on the ExpenseCategory', () => {
    const { snapshot } = apply(baseSnapshot(), decision);
    expect('startMonth' in (snapshot.expenses[1] as unknown as Record<string, unknown>)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: one_time_expense
// ---------------------------------------------------------------------------

describe('one_time_expense', () => {
  const decision: OneTimeExpenseDecision = {
    kind: 'one_time_expense',
    label: 'Medical bill',
    amount: 45000,
    atMonth: 4,
  };

  it('leaves the snapshot completely unchanged', () => {
    const original = baseSnapshot();
    const { snapshot } = apply(original, decision);
    expect(snapshot).toEqual(original);
    expect(snapshot.expenses).toHaveLength(1);
    expect(snapshot.debts).toHaveLength(0);
    expect(snapshot.incomeSources).toHaveLength(1);
  });

  it('returns exactly one one_time_expense timed effect', () => {
    const { timedEffects } = apply(baseSnapshot(), decision);
    expect(timedEffects).toHaveLength(1);
    expect(timedEffects[0]).toEqual({ kind: 'one_time_expense', amount: 45000, atMonth: 4, label: 'Medical bill' });
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: none
// ---------------------------------------------------------------------------

describe('none', () => {
  it('returns a snapshot deep-equal to the input and an empty timedEffects array', () => {
    const original = snapshotWithExistingDebt();
    const { snapshot, timedEffects } = apply(original, { kind: 'none' });
    expect(snapshot).toEqual(original);
    expect(timedEffects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Isolated Testing Strategy: immutability
// ---------------------------------------------------------------------------

describe('applyDecisionToSnapshot immutability', () => {
  const cases: Array<[string, DecisionDiff]> = [
    ['new_debt', newDebtDecision],
    ['income_change/replace', { kind: 'income_change', targetIncomeSourceId: 'inc-1', changeType: 'replace', newMonthlyAmount: 1, newStability: 'volatile' }],
    ['income_change/percent_delta', { kind: 'income_change', targetIncomeSourceId: 'inc-1', changeType: 'percent_delta', percentDelta: -0.5 }],
    ['income_change/add_new', { kind: 'income_change', targetIncomeSourceId: null, changeType: 'add_new', newMonthlyAmount: 1, newStability: 'stable', newLabel: 'X' }],
    ['new_expense', { kind: 'new_expense', label: 'X', monthlyAmount: 5, expenseType: 'fixed', startMonth: 0 }],
    ['one_time_expense', { kind: 'one_time_expense', label: 'X', amount: 5, atMonth: 1 }],
    ['none', { kind: 'none' }],
  ];

  for (const [name, decision] of cases) {
    it('never mutates its snapshot argument for ' + name, () => {
      const original = snapshotWithExistingDebt();
      const before = structuredClone(original);
      const result = applyDecisionToSnapshot(original, decision);

      expect(original).toEqual(before);
      expect(result.snapshot).not.toBe(original);
      expect(result.snapshot.incomeSources).not.toBe(original.incomeSources);
      expect(result.snapshot.debts).not.toBe(original.debts);
      expect(result.snapshot.expenses).not.toBe(original.expenses);
      expect(result.snapshot.debtFallbackOrder).not.toBe(original.debtFallbackOrder);

      result.snapshot.incomeSources[0].monthlyAmount = -999;
      expect(original.incomeSources[0].monthlyAmount).toBe(50000);
    });
  }
});

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

describe('computeAmortizedMonthlyPayment', () => {
  it('matches the closed-form formula for a known triple', () => {
    const r = 24 / 12 / 100;
    const n = 24;
    const expected = (100000 * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    expect(computeAmortizedMonthlyPayment(100000, 24, 24)).toBeCloseTo(expected, 10);
    expect(computeAmortizedMonthlyPayment(100000, 24, 24)).toBeCloseTo(5287.109725, 6);
  });

  it('divides principal by term when the rate is zero', () => {
    expect(computeAmortizedMonthlyPayment(24000, 0, 24)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Boundary branches
// ---------------------------------------------------------------------------

describe('boundary branches', () => {
  it('appends the new debt id and the sentinel when the fallback order lacks NEW_CREDIT_LINE', () => {
    const invalidOrderSnapshot: FinancialSnapshot = { ...baseSnapshot(), debtFallbackOrder: [] };
    const { snapshot } = apply(invalidOrderSnapshot, newDebtDecision);
    const newId = snapshot.debts[0].id;
    expect(snapshot.debtFallbackOrder).toEqual([newId, 'NEW_CREDIT_LINE']);
  });

  it('throws RangeError when percent_delta has a null target id', () => {
    expect(() => apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: null,
      changeType: 'percent_delta',
      percentDelta: -0.1,
    })).toThrow(RangeError);
  });

  it('throws RangeError when replace has a null target id', () => {
    expect(() => apply(baseSnapshot(), {
      kind: 'income_change',
      targetIncomeSourceId: null,
      changeType: 'replace',
      newMonthlyAmount: 1,
      newStability: 'stable',
    })).toThrow(RangeError);
  });

  it('throws RangeError when replace omits newStability', () => {
    const incomplete = {
      kind: 'income_change',
      targetIncomeSourceId: 'inc-1',
      changeType: 'replace',
      newMonthlyAmount: 1,
    } as IncomeChangeDecision;
    expect(() => apply(baseSnapshot(), incomplete)).toThrow(RangeError);
  });

  it('throws RangeError when add_new omits newMonthlyAmount', () => {
    const incomplete = {
      kind: 'income_change',
      targetIncomeSourceId: null,
      changeType: 'add_new',
      newStability: 'stable',
      newLabel: 'X',
    } as IncomeChangeDecision;
    expect(() => apply(baseSnapshot(), incomplete)).toThrow(RangeError);
  });

  it('throws RangeError when add_new omits newStability', () => {
    const incomplete = {
      kind: 'income_change',
      targetIncomeSourceId: null,
      changeType: 'add_new',
      newMonthlyAmount: 1,
      newLabel: 'X',
    } as IncomeChangeDecision;
    expect(() => apply(baseSnapshot(), incomplete)).toThrow(RangeError);
  });
});

