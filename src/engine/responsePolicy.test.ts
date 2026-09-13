import { describe, expect, it } from 'vitest';

import { applyResponsePolicy, type MonthOutcome } from './responsePolicy';
import { DEFAULT_HAZARD_OVERRIDES } from './state';
import type { DebtInstrument, EmergencyFundState, HazardOverrides } from './state';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

function overrides(partial: Partial<HazardOverrides> = {}): HazardOverrides {
  return { ...DEFAULT_HAZARD_OVERRIDES, ...partial };
}

function fund(balance: number): EmergencyFundState {
  return { balance, targetMonths: 6, isInvested: false };
}

function debt(
  id: string,
  type: DebtInstrument['type'],
  balance: number,
  annualRatePct: number,
  minMonthlyPayment: number,
  termMonthsRemaining: number | null = 24,
): DebtInstrument {
  return { id, type, label: id, balance, annualRatePct, minMonthlyPayment, termMonthsRemaining };
}

function card(balance: number, annualRatePct = 24, minMonthlyPayment = 5000): DebtInstrument {
  return debt('cc', 'credit_card', balance, annualRatePct, minMonthlyPayment, null);
}

function personalLoan(balance: number, annualRatePct = 12, minMonthlyPayment = 10000): DebtInstrument {
  return debt('pl', 'personal_loan', balance, annualRatePct, minMonthlyPayment, 24);
}

const NEW_LINE = 'NEW_CREDIT_LINE';

function run(
  cashBeforeResponse: number,
  liquidCashOutsideFund: number,
  emergencyFund: EmergencyFundState,
  debts: DebtInstrument[],
  debtFallbackOrder: string[],
  hazardOverrides: HazardOverrides = overrides(),
  month = 0,
): MonthOutcome {
  return applyResponsePolicy(
    cashBeforeResponse,
    liquidCashOutsideFund,
    emergencyFund,
    debts,
    debtFallbackOrder,
    month,
    hazardOverrides,
  );
}

// ---------------------------------------------------------------------------
// Step 1 - positive cashflow
// ---------------------------------------------------------------------------

describe('response policy - positive cashflow', () => {
  it('records no draws and accumulates surplus in endingCash', () => {
    const outcome = run(5000, 10000, fund(50000), [], [NEW_LINE], overrides(), 3);
    expect(outcome).toEqual({
      month: 3,
      cashBeforeResponse: 5000,
      emergencyFundDraw: 0,
      debtDraws: [],
      newCreditLineDraw: 0,
      shortfallUncovered: 0,
      endingCash: 15000,
      endingFundBalance: 50000,
      endingDebtBalances: {},
    });
    expect('NEW_CREDIT_LINE' in outcome.endingDebtBalances).toBe(false);
  });

  it('treats exactly-zero cashflow as the no-draw path', () => {
    const outcome = run(0, 12345, fund(50000), [], [NEW_LINE]);
    expect(outcome.endingCash).toBe(12345);
    expect(outcome.emergencyFundDraw).toBe(0);
    expect(outcome.shortfallUncovered).toBe(0);
  });

  it('still amortizes debts and never auto-pays-down above the minimum', () => {
    const cc = card(50000, 24, 5000);
    const pl = personalLoan(200000, 12, 10000);
    const outcome = run(5000, 10000, fund(50000), [cc, pl], ['cc', 'pl', NEW_LINE]);
    expect(outcome.endingCash).toBe(15000);
    expect(outcome.debtDraws).toEqual([]);
    expect(outcome.endingDebtBalances.cc).toBe(46000);
    expect(outcome.endingDebtBalances.pl).toBe(192000);
  });
});

// ---------------------------------------------------------------------------
// Step A - liquid cash first
// ---------------------------------------------------------------------------

describe('response policy - Step A (liquid cash)', () => {
  it('absorbs a shortfall below available liquid cash with no fund or debt draws', () => {
    const outcome = run(-3000, 10000, fund(50000), [], [NEW_LINE], overrides(), 1);
    expect(outcome.endingCash).toBe(7000);
    expect(outcome.emergencyFundDraw).toBe(0);
    expect(outcome.endingFundBalance).toBe(50000);
    expect(outcome.debtDraws).toEqual([]);
    expect(outcome.newCreditLineDraw).toBe(0);
    expect(outcome.shortfallUncovered).toBe(0);
  });

  it('absorbs exactly all liquid cash without touching the fund', () => {
    const outcome = run(-10000, 10000, fund(50000), [], [NEW_LINE]);
    expect(outcome.endingCash).toBe(0);
    expect(outcome.emergencyFundDraw).toBe(0);
    expect(outcome.endingFundBalance).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// Step B - emergency fund
// ---------------------------------------------------------------------------

describe('response policy - Step B (emergency fund)', () => {
  it('partially drains the fund once liquid cash is exhausted', () => {
    const outcome = run(-30000, 10000, fund(50000), [], [NEW_LINE], overrides(), 2);
    expect(outcome.endingCash).toBe(0);
    expect(outcome.emergencyFundDraw).toBe(20000);
    expect(outcome.endingFundBalance).toBe(30000);
    expect(outcome.debtDraws).toEqual([]);
    expect(outcome.newCreditLineDraw).toBe(0);
    expect(outcome.shortfallUncovered).toBe(0);
  });

  it('fully drains the fund and passes the remainder to the fallback chain', () => {
    const cc = card(50000, 24, 5000);
    const outcome = run(-80000, 10000, fund(50000), [cc], ['cc', NEW_LINE], overrides(), 4);
    expect(outcome.endingCash).toBe(0);
    expect(outcome.emergencyFundDraw).toBe(50000);
    expect(outcome.endingFundBalance).toBe(0);
    expect(outcome.debtDraws).toEqual([{ debtId: 'cc', amount: 20000 }]);
    expect(outcome.newCreditLineDraw).toBe(0);
    expect(outcome.shortfallUncovered).toBe(0);
    expect(outcome.endingDebtBalances.cc).toBe(66400);
  });
});

// ---------------------------------------------------------------------------
// Step C - credit card and NEW_CREDIT_LINE
// ---------------------------------------------------------------------------

describe('response policy - Step C (debt fallback chain)', () => {
  it('forces a NEW_CREDIT_LINE draw when no credit card can absorb the shortfall', () => {
    const pl = personalLoan(200000, 12, 10000);
    const outcome = run(-100000, 10000, fund(50000), [pl], ['pl', NEW_LINE], overrides(), 5);
    expect(outcome.newCreditLineDraw).toBe(40000);
    expect(outcome.shortfallUncovered).toBe(0);
    expect(outcome.debtDraws).toEqual([]);
    expect(outcome.endingDebtBalances[NEW_LINE]).toBe(40800);
    expect(outcome.endingDebtBalances.pl).toBe(192000);
  });

  it('skips an installment debt ranked first and lets the next credit card absorb', () => {
    const pl = personalLoan(200000, 12, 10000);
    const cc = card(50000, 24, 5000);
    const outcome = run(-100000, 10000, fund(50000), [pl, cc], ['pl', 'cc', NEW_LINE], overrides(), 6);
    expect(outcome.debtDraws).toEqual([{ debtId: 'cc', amount: 40000 }]);
    expect(outcome.newCreditLineDraw).toBe(0);
    expect(outcome.endingDebtBalances.pl).toBe(192000);
    expect(outcome.endingDebtBalances.cc).toBe(86800);
  });

  it('skips auto_loan and mortgage installment debts too', () => {
    const auto = debt('auto', 'auto_loan', 100000, 9, 3000, 36);
    const mortgage = debt('mort', 'mortgage', 2000000, 7, 15000, 240);
    const outcome = run(-60000, 10000, fund(0), [auto, mortgage], ['auto', 'mort', NEW_LINE], overrides(), 10);
    expect(outcome.debtDraws).toEqual([]);
    expect(outcome.newCreditLineDraw).toBe(50000);
    expect(outcome.shortfallUncovered).toBe(0);
  });

  it('silently skips an unknown fallback id', () => {
    const outcome = run(-70000, 10000, fund(50000), [], ['ghost', NEW_LINE], overrides(), 7);
    expect(outcome.newCreditLineDraw).toBe(10000);
    expect(outcome.shortfallUncovered).toBe(0);
  });

  it('reads newCreditLineAprPct dynamically from hazardOverrides', () => {
    const zeroRate = run(-100000, 10000, fund(50000), [], [NEW_LINE], overrides({ newCreditLineAprPct: 0 }));
    expect(zeroRate.newCreditLineDraw).toBe(40000);
    expect(zeroRate.endingDebtBalances[NEW_LINE]).toBe(40000);

    const rate12 = run(-100000, 10000, fund(50000), [], [NEW_LINE], overrides({ newCreditLineAprPct: 12 }));
    expect(rate12.endingDebtBalances[NEW_LINE]).toBe(40400);

    const rate24 = run(-100000, 10000, fund(50000), [], [NEW_LINE], overrides({ newCreditLineAprPct: 24 }));
    expect(rate24.endingDebtBalances[NEW_LINE]).toBe(40800);
  });
});

// ---------------------------------------------------------------------------
// Step D - shortfallUncovered
// ---------------------------------------------------------------------------

describe('response policy - Step D (total failure)', () => {
  it('tracks an uncovered shortfall without NaN or Infinity when no rung can absorb it', () => {
    const pl = personalLoan(200000, 12, 10000);
    const outcome = run(-100000, 10000, fund(50000), [pl], ['pl'], overrides(), 8);
    expect(outcome.shortfallUncovered).toBe(40000);
    expect(Number.isFinite(outcome.shortfallUncovered)).toBe(true);
    expect(outcome.endingCash).toBe(0);
    expect(outcome.debtDraws).toEqual([]);
    expect(outcome.newCreditLineDraw).toBe(0);
    expect(outcome.endingDebtBalances.pl).toBe(192000);
  });
});

// ---------------------------------------------------------------------------
// Step 7 - amortization / interest accrual
// ---------------------------------------------------------------------------

describe('response policy - debt amortization', () => {
  it('accrues one month of interest then subtracts the minimum payment (credit card)', () => {
    const cc = card(50000, 24, 5000);
    const outcome = run(0, 0, fund(0), [cc], [NEW_LINE]);
    expect(outcome.endingDebtBalances.cc).toBe(46000);
  });

  it('accrues one month of interest then subtracts the minimum payment (installment)', () => {
    const pl = personalLoan(200000, 12, 10000);
    const outcome = run(0, 0, fund(0), [pl], [NEW_LINE]);
    expect(outcome.endingDebtBalances.pl).toBe(192000);
  });

  it('accrues interest on a drawn credit-card balance before subtracting the minimum', () => {
    const cc = card(10000, 36, 1000);
    const outcome = run(-40000, 0, fund(0), [cc], ['cc', NEW_LINE]);
    // (10000 + 40000) * 1.03 - 1000 = 50500
    expect(outcome.debtDraws).toEqual([{ debtId: 'cc', amount: 40000 }]);
    expect(outcome.endingDebtBalances.cc).toBe(50500);
  });

  it('floors a balance at zero when the minimum payment exceeds the accrued balance', () => {
    const smallCard = card(1000, 36, 5000);                                   // 1030 - 5000 -> 0
    const smallLoan = debt('small', 'personal_loan', 100, 12, 100000, 12);    // 101 - 100000 -> 0
    const outcome = run(1000, 0, fund(0), [smallCard, smallLoan], ['small', NEW_LINE], overrides(), 9);
    expect(outcome.endingDebtBalances.cc).toBe(0);
    expect(outcome.endingDebtBalances.small).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Invariants + input safety
// ---------------------------------------------------------------------------

describe('response policy - invariants', () => {
  it('always returns endingCash >= 0', () => {
    const scenarios: Array<[number, number, number, DebtInstrument[], string[]]> = [
      [-1, 0, 0, [], [NEW_LINE]],
      [-1000, 0, 500, [], [NEW_LINE]],
      [-1000, 500, 0, [], [NEW_LINE]],
      [-100000, 50000, 25000, [card(1000)], ['cc', NEW_LINE]],
      [-100000, 10000, 50000, [personalLoan(1000)], ['pl']],
      [25000, 0, 0, [], [NEW_LINE]],
    ];
    for (const [cash, liquid, fundBalance, debts, order] of scenarios) {
      const outcome = run(cash, liquid, fund(fundBalance), debts, order);
      expect(outcome.endingCash).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(outcome.endingCash)).toBe(true);
      expect(outcome.shortfallUncovered).toBeGreaterThanOrEqual(0);
    }
  });

  it('never mutates its inputs', () => {
    const cc = card(50000, 24, 5000);
    const fundState = fund(50000);
    const debts = [cc];
    const order = ['cc', NEW_LINE];
    const before = JSON.stringify({ cc, fundState, debts, order });
    run(-80000, 10000, fundState, debts, order, overrides(), 4);
    expect(JSON.stringify({ cc, fundState, debts, order })).toBe(before);
  });
});
