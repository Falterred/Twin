/**
 * Part 2 - Decision Input & Decision Diff
 *
 * Captures the user's single "what if" decision as a structured, machine-applicable
 * diff against their FinancialSnapshot.
 *
 * Free-text parsing is explicitly out of scope for v1. The schema is kept flat and
 * self-describing so a future version could populate it from an LLM call unchanged,
 * but this module contains no parsing, NLP, network or LLM code path whatsoever.
 *
 * Depends on Part 1 (types only).
 */
import type {
  DebtInstrument,
  DebtType,
  ExpenseCategory,
  ExpenseCategoryType,
  FinancialSnapshot,
  IncomeSource,
  IncomeStability,
} from './state';

// ---------------------------------------------------------------------------
// Exact type contracts
// ---------------------------------------------------------------------------

export type DecisionType =
  | 'new_debt'            // take on a new loan/EMI/credit line
  | 'income_change'       // job change, raise, pay cut, lose a side income
  | 'new_expense'         // recurring new expense (rent increase, subscription, new dependent)
  | 'one_time_expense'    // single large purchase paid in cash at month 0
  | 'none';               // baseline-only run, no decision (used internally for pure baseline mode)

export type NewDebtDecision = {
  kind: 'new_debt';
  debtType: DebtType;             // from Part 1
  principal: number;              // Rs, > 0
  annualRatePct: number;          // >= 0
  termMonths: number;             // > 0, integer
  label: string;                  // user-facing, e.g. "Car EMI"
};

export type IncomeChangeDecision = {
  kind: 'income_change';
  targetIncomeSourceId: string | null; // id of existing IncomeSource to modify, or null = "new income source"
  changeType: 'replace' | 'percent_delta' | 'add_new';
  newMonthlyAmount?: number;      // required if changeType === 'replace' or 'add_new'
  percentDelta?: number;          // required if changeType === 'percent_delta', e.g. -0.30 for "30% less"
  newStability?: IncomeStability; // required if changeType === 'replace' or 'add_new'
  newLabel?: string;              // required if changeType === 'add_new'
};

export type NewExpenseDecision = {
  kind: 'new_expense';
  label: string;
  monthlyAmount: number;          // Rs, > 0
  expenseType: ExpenseCategoryType;
  startMonth: number;             // 0-11, month index the recurring expense begins
};

export type OneTimeExpenseDecision = {
  kind: 'one_time_expense';
  label: string;
  amount: number;                 // Rs, > 0
  atMonth: number;                // 0-11
};

export type NoDecision = { kind: 'none' };

export type DecisionDiff =
  | NewDebtDecision
  | IncomeChangeDecision
  | NewExpenseDecision
  | OneTimeExpenseDecision
  | NoDecision;

// Source tag: always 'structured_form' in this version. Reserved 'llm_parsed' value
// is declared but must never be produced by any code in this version.
export type DecisionSource = 'structured_form' | 'llm_parsed';

export type DecisionInput = {
  diff: DecisionDiff;
  source: DecisionSource;   // must equal 'structured_form' everywhere in v1
};

// Timing information for decisions that cannot live on the static snapshot shape.
export type TimedEffect =
  | { kind: 'recurring_expense_from'; expenseId: string; startMonth: number }
  | { kind: 'one_time_expense'; amount: number; atMonth: number; label: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Freshly generated id. Web Crypto's randomUUID is available on globalThis in every
 * target runtime: evergreen browsers under Vite, and Node 19+ for the test suite.
 */
function generateId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Standard amortization formula:
 *   r = annualRatePct / 12 / 100
 *   n = termMonths
 *   r === 0 -> principal / n
 *   else    -> principal * r * (1+r)^n / ((1+r)^n - 1)
 */
export function computeAmortizedMonthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  const r = annualRatePct / 12 / 100;
  const n = termMonths;
  if (r === 0) {
    return principal / n;
  }
  const growth = Math.pow(1 + r, n);
  return (principal * r * growth) / (growth - 1);
}

function requireIncomeSource(
  snapshot: FinancialSnapshot,
  targetIncomeSourceId: string | null,
  changeType: IncomeChangeDecision['changeType'],
): IncomeSource {
  if (targetIncomeSourceId === null) {
    throw new RangeError(
      "income_change with changeType '" + changeType + "' requires targetIncomeSourceId",
    );
  }
  const source = snapshot.incomeSources.find((entry) => entry.id === targetIncomeSourceId);
  if (source === undefined) {
    throw new RangeError(
      "income_change targetIncomeSourceId '" + targetIncomeSourceId + "' was not found in snapshot.incomeSources",
    );
  }
  return source;
}

// ---------------------------------------------------------------------------
// applyDecisionToSnapshot
// ---------------------------------------------------------------------------

/**
 * Produces the decision-twin's month-0 starting snapshot.
 *
 * The baseline twin always uses the untouched original snapshot. This function
 * deep-clones the input and never mutates it.
 *
 * Debts and income changes take effect at month 0 by definition in v1. Only expenses
 * carry timing information, surfaced through the returned timedEffects side channel
 * (consumed by the scenario runner, Part 5) because it does not belong in the static
 * snapshot shape.
 */
export function applyDecisionToSnapshot(
  snapshot: FinancialSnapshot,
  decision: DecisionDiff,
): { snapshot: FinancialSnapshot; timedEffects: TimedEffect[] } {
  const nextSnapshot = structuredClone(snapshot);

  switch (decision.kind) {
    case 'new_debt': {
      const minMonthlyPayment = computeAmortizedMonthlyPayment(
        decision.principal,
        decision.annualRatePct,
        decision.termMonths,
      );
      const newDebt: DebtInstrument = {
        id: generateId(),
        type: decision.debtType,
        label: decision.label,
        balance: decision.principal,
        annualRatePct: decision.annualRatePct,
        minMonthlyPayment,
        termMonthsRemaining: decision.termMonths,
      };
      nextSnapshot.debts.push(newDebt);

      // New debts are not assumed to be the user's preferred first fallback by default;
      // insert immediately before NEW_CREDIT_LINE (the user can reorder in the UI).
      const newCreditLineIndex = nextSnapshot.debtFallbackOrder.indexOf('NEW_CREDIT_LINE');
      if (newCreditLineIndex === -1) {
        nextSnapshot.debtFallbackOrder.push(newDebt.id, 'NEW_CREDIT_LINE');
      } else {
        nextSnapshot.debtFallbackOrder.splice(newCreditLineIndex, 0, newDebt.id);
      }

      return { snapshot: nextSnapshot, timedEffects: [] };
    }

    case 'income_change': {
      if (decision.changeType === 'replace') {
        if (decision.newMonthlyAmount === undefined) {
          throw new RangeError("income_change with changeType 'replace' requires newMonthlyAmount");
        }
        if (decision.newStability === undefined) {
          throw new RangeError("income_change with changeType 'replace' requires newStability");
        }
        const source = requireIncomeSource(nextSnapshot, decision.targetIncomeSourceId, 'replace');
        source.monthlyAmount = decision.newMonthlyAmount;
        source.stability = decision.newStability;
      } else if (decision.changeType === 'percent_delta') {
        if (decision.percentDelta === undefined) {
          throw new RangeError("income_change with changeType 'percent_delta' requires percentDelta");
        }
        const source = requireIncomeSource(nextSnapshot, decision.targetIncomeSourceId, 'percent_delta');
        const adjusted = source.monthlyAmount * (1 + decision.percentDelta);
        source.monthlyAmount = Math.max(0, adjusted);
      } else {
        if (decision.newMonthlyAmount === undefined) {
          throw new RangeError("income_change with changeType 'add_new' requires newMonthlyAmount");
        }
        if (decision.newStability === undefined) {
          throw new RangeError("income_change with changeType 'add_new' requires newStability");
        }
        if (decision.newLabel === undefined) {
          throw new RangeError("income_change with changeType 'add_new' requires newLabel");
        }
        const newSource: IncomeSource = {
          id: generateId(),
          label: decision.newLabel,
          monthlyAmount: decision.newMonthlyAmount,
          stability: decision.newStability,
        };
        nextSnapshot.incomeSources.push(newSource);
      }

      return { snapshot: nextSnapshot, timedEffects: [] };
    }

    case 'new_expense': {
      // startMonth is deliberately NOT stored on ExpenseCategory (Part 1's type does not
      // include it); it travels through timedEffects to the scenario runner (Part 5).
      const newExpense: ExpenseCategory = {
        id: generateId(),
        label: decision.label,
        type: decision.expenseType,
        monthlyAmount: decision.monthlyAmount,
      };
      nextSnapshot.expenses.push(newExpense);

      const timedEffects: TimedEffect[] = [
        { kind: 'recurring_expense_from', expenseId: newExpense.id, startMonth: decision.startMonth },
      ];
      return { snapshot: nextSnapshot, timedEffects };
    }

    case 'one_time_expense': {
      // No change to the snapshot's recurring structures: a one-off month-N cash
      // deduction consumed directly by the scenario runner.
      const timedEffects: TimedEffect[] = [
        { kind: 'one_time_expense', amount: decision.amount, atMonth: decision.atMonth, label: decision.label },
      ];
      return { snapshot: nextSnapshot, timedEffects };
    }

    case 'none':
    default: {
      return { snapshot: nextSnapshot, timedEffects: [] };
    }
  }
}
