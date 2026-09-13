/**
 * Part 4 - Response Policy (Emergency Fund & Debt Fallback)
 *
 * Defines exactly what happens the moment a month's cash flow goes negative. Called by
 * the scenario runner (Part 5) once per scenario per month, after that month's
 * income/expenses/events are computed.
 *
 * Depends on Parts 1-3 for types only. The assumed new-credit-line rate is read from the
 * consolidated HazardOverrides value passed in by the caller (never a local constant).
 */
import type { DebtInstrument, EmergencyFundState, HazardOverrides } from './state';

export type MonthOutcome = {
  month: number;
  cashBeforeResponse: number;      // income - expenses - min debt payments - event costs + event income, before any draw
  emergencyFundDraw: number;       // ₹ drawn from emergency fund this month, >= 0
  debtDraws: { debtId: string; amount: number }[]; // amounts drawn from each fallback debt this month, in fallback order
  newCreditLineDraw: number;       // ₹ drawn via 'NEW_CREDIT_LINE' fallback, >= 0
  shortfallUncovered: number;      // ₹ still unmet after exhausting ALL fallbacks — this is TOTAL FAILURE for the month
  endingCash: number;              // liquidCashOutsideFund after response, >= 0 always (shortfall is tracked separately, cash floor is 0)
  endingFundBalance: number;
  endingDebtBalances: Record<string, number>; // debtId -> balance after this month's draw + minimum payment
};

const NEW_CREDIT_LINE_ID = 'NEW_CREDIT_LINE';

/**
 * Applies the deterministic response policy for one month.
 *
 * Cascade: liquid cash -> emergency fund -> existing credit cards -> 'NEW_CREDIT_LINE'.
 *
 * v1 rules:
 *  - credit cards and 'NEW_CREDIT_LINE' have unlimited draw limits;
 *  - installment debts (personal_loan/auto_loan/mortgage) are structurally inert as
 *    draw sources and are silently skipped during the fallback chain;
 *  - positive-cashflow months never auto-pay-down debt above the minimum — surplus
 *    simply accumulates in endingCash;
 *  - inputs are never mutated; updated balances are returned in the outcome.
 */
export function applyResponsePolicy(
  cashBeforeResponse: number,
  liquidCashOutsideFund: number,
  emergencyFund: EmergencyFundState,
  debts: DebtInstrument[],
  debtFallbackOrder: string[],
  month: number,
  hazardOverrides: HazardOverrides,
): MonthOutcome {
  // Working copies so the caller's debts are never mutated.
  const workingDebts = debts.map((debt) => ({ debt, balance: debt.balance }));
  const debtById = new Map<string, { debt: DebtInstrument; balance: number }>();
  for (const entry of workingDebts) {
    debtById.set(entry.debt.id, entry);
  }

  const debtDraws: { debtId: string; amount: number }[] = [];
  let emergencyFundDraw = 0;
  let newCreditLineDraw = 0;
  let shortfallUncovered = 0;
  let endingFundBalance = emergencyFund.balance;
  let liquidCash = liquidCashOutsideFund;
  let shortfall = cashBeforeResponse < 0 ? -cashBeforeResponse : 0;
  let endingCash: number;

  if (shortfall === 0) {
    // Step 1: no draws needed; surplus simply accumulates in liquid cash.
    endingCash = liquidCash + cashBeforeResponse;
  } else {
    // Step A: liquid cash absorbs first.
    const absorbedByLiquid = Math.min(shortfall, liquidCash);
    liquidCash -= absorbedByLiquid;
    shortfall -= absorbedByLiquid;

    // Step B: emergency fund absorbs next. (Part 5 only routes discrete shocks here;
    // the response policy simply drains it once ordinary cash is exhausted.)
    if (shortfall > 0) {
      emergencyFundDraw = Math.min(shortfall, endingFundBalance);
      endingFundBalance -= emergencyFundDraw;
      shortfall -= emergencyFundDraw;
    }

    // Step C: debt fallback chain, in the user-defined order.
    if (shortfall > 0) {
      for (const entry of debtFallbackOrder) {
        if (entry === NEW_CREDIT_LINE_ID) {
          // Unlimited-draw implicit credit line at hazardOverrides.newCreditLineAprPct.
          newCreditLineDraw += shortfall;
          shortfall = 0;
          break;
        }
        const target = debtById.get(entry);
        if (target === undefined) {
          continue; // unknown id — Part 1 validation prevents this; skip defensively.
        }
        if (target.debt.type !== 'credit_card') {
          continue; // installment debts cannot be drawn on in v1.
        }
        // Unlimited credit-card draw: absorb the full remaining shortfall.
        debtDraws.push({ debtId: target.debt.id, amount: shortfall });
        target.balance += shortfall;
        shortfall = 0;
        break;
      }
    }

    // Step D: total failure for the month (unreachable in v1 given the unlimited
    // NEW_CREDIT_LINE rung, but tracked explicitly for aggregation and hazard state).
    if (shortfall > 0) {
      shortfallUncovered = shortfall;
    }

    endingCash = liquidCash;
  }

  // Step 7: interest accrual then minimum payment, for every debt, floor at 0.
  // Credit cards revolve at annualRatePct; installment debts amortize on the same
  // interest-then-payment basis (their minimum payment already covers the interest
  // portion), so both share this formula.
  const endingDebtBalances: Record<string, number> = {};
  for (const entry of workingDebts) {
    const monthlyRate = entry.debt.annualRatePct / 12 / 100;
    const accrued = entry.balance * (1 + monthlyRate);
    endingDebtBalances[entry.debt.id] = Math.max(0, accrued - entry.debt.minMonthlyPayment);
  }

  // The implicit new credit line is scenario-local: its balance after this month's draw
  // plus revolving interest. Part 5 threads this value forward within the scenario.
  if (newCreditLineDraw > 0) {
    const monthlyRate = hazardOverrides.newCreditLineAprPct / 12 / 100;
    endingDebtBalances[NEW_CREDIT_LINE_ID] = Math.max(0, newCreditLineDraw * (1 + monthlyRate));
  }

  return {
    month,
    cashBeforeResponse,
    emergencyFundDraw,
    debtDraws,
    newCreditLineDraw,
    shortfallUncovered,
    endingCash,
    endingFundBalance,
    endingDebtBalances,
  };
}
