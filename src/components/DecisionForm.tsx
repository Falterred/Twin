/**
 * Part 8 - Component 2: DecisionForm
 *
 * Captures the single user-specified financial decision under test, as a structured
 * DecisionDiff. Segmented control across DecisionType ('new_debt' | 'income_change' |
 * 'new_expense' | 'one_time_expense' | 'none').
 *
 * Props: decision: DecisionDiff, onChange: (decision: DecisionDiff) => void,
 *        snapshot: FinancialSnapshot (required, populates targetIncomeSourceId options)
 *
 * Constraints:
 *   - No free-text decision parsing exists anywhere in this component. The only text
 *     inputs are the label fields that Part 2's decision types require.
 *   - Tab switching builds a fresh diff, so no fields leak across decision types.
 */
import { Sparkles, DollarSign, CreditCard, ShoppingBag, Calendar, Ban } from 'lucide-react';
import type { FinancialSnapshot, DebtType, ExpenseCategoryType, IncomeStability } from '../engine/state';
import type {
  DecisionDiff,
  DecisionType,
  NewDebtDecision,
  IncomeChangeDecision,
  NewExpenseDecision,
  OneTimeExpenseDecision,
  NoDecision,
} from '../engine/decision';

export interface DecisionFormProps {
  decision: DecisionDiff;
  onChange: (decision: DecisionDiff) => void;
  snapshot: FinancialSnapshot;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DecisionForm({ decision, onChange, snapshot }: DecisionFormProps) {
  const currentKind: DecisionType = decision.kind;

  // Clean type change handler with fresh defaults to avoid cross-type field leakage
  const handleTypeChange = (newKind: DecisionType) => {
    if (newKind === decision.kind) return;

    switch (newKind) {
      case 'new_debt': {
        const next: NewDebtDecision = {
          kind: 'new_debt',
          debtType: 'auto_loan',
          principal: 500000,
          annualRatePct: 9.0,
          termMonths: 48,
          label: 'Car EMI',
        };
        onChange(next);
        break;
      }
      case 'income_change': {
        const firstSourceId = snapshot.incomeSources[0]?.id ?? null;
        const next: IncomeChangeDecision = {
          kind: 'income_change',
          targetIncomeSourceId: firstSourceId,
          changeType: 'percent_delta',
          percentDelta: 0.15,
        };
        onChange(next);
        break;
      }
      case 'new_expense': {
        const next: NewExpenseDecision = {
          kind: 'new_expense',
          label: 'New Rent Increase',
          monthlyAmount: 8000,
          expenseType: 'fixed',
          startMonth: 3,
        };
        onChange(next);
        break;
      }
      case 'one_time_expense': {
        const next: OneTimeExpenseDecision = {
          kind: 'one_time_expense',
          label: 'Home Renovation',
          amount: 150000,
          atMonth: 2,
        };
        onChange(next);
        break;
      }
      case 'none':
      default: {
        const next: NoDecision = { kind: 'none' };
        onChange(next);
        break;
      }
    }
  };

  return (
    <div className="card-surface rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
            Decision Under Test
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Simulated against baseline
        </span>
      </div>

      {/* Segmented Control Tabs */}
      <div className="grid grid-cols-5 gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => handleTypeChange('new_debt')}
          className={`py-1.5 px-1 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
            currentKind === 'new_debt'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span className="text-[10px]">New Debt</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('income_change')}
          className={`py-1.5 px-1 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
            currentKind === 'income_change'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span className="text-[10px]">Income</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('new_expense')}
          className={`py-1.5 px-1 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
            currentKind === 'new_expense'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="text-[10px]">Recurring</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('one_time_expense')}
          className={`py-1.5 px-1 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
            currentKind === 'one_time_expense'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-[10px]">One-Time</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('none')}
          className={`py-1.5 px-1 rounded-md font-medium flex flex-col items-center gap-1 transition-all ${
            currentKind === 'none'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Ban className="w-3.5 h-3.5" />
          <span className="text-[10px]">None</span>
        </button>
      </div>

      {/* Sub-form 1: New Debt */}
      {decision.kind === 'new_debt' && (
        <div className="space-y-3 pt-2 text-xs">
          <div>
            <label htmlFor="debt-decision-label" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Loan / Purchase Name
            </label>
            <input
              id="debt-decision-label"
              type="text"
              value={decision.label}
              onChange={(e) => onChange({ ...decision, label: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="debt-decision-principal" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Principal (₹)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">₹</span>
                <input
                  id="debt-decision-principal"
                  type="number"
                  min="1000"
                  step="10000"
                  value={decision.principal || ''}
                  onChange={(e) =>
                    onChange({ ...decision, principal: Math.max(1, Number(e.target.value) || 0) })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="debt-decision-type" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Debt Instrument Type
              </label>
              <select
                id="debt-decision-type"
                value={decision.debtType}
                onChange={(e) => onChange({ ...decision, debtType: e.target.value as DebtType })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="auto_loan">Auto Loan / EMI</option>
                <option value="personal_loan">Personal Loan</option>
                <option value="credit_card">Credit Card</option>
                <option value="mortgage">Mortgage</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="debt-decision-apr" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Annual Interest Rate (APR %)
              </label>
              <input
                id="debt-decision-apr"
                type="number"
                min="0"
                step="0.5"
                value={decision.annualRatePct || ''}
                onChange={(e) =>
                  onChange({ ...decision, annualRatePct: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="debt-decision-term" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Term (Months)
              </label>
              <input
                id="debt-decision-term"
                type="number"
                min="1"
                step="6"
                value={decision.termMonths || ''}
                onChange={(e) =>
                  onChange({ ...decision, termMonths: Math.max(1, Math.round(Number(e.target.value) || 1)) })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-form 2: Income Change */}
      {decision.kind === 'income_change' && (
        <div className="space-y-3 pt-2 text-xs">
          <div>
            <label htmlFor="income-change-type" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Change Mode
            </label>
            <select
              id="income-change-type"
              value={decision.changeType}
              onChange={(e) => {
                const ct = e.target.value as 'replace' | 'percent_delta' | 'add_new';
                if (ct === 'add_new') {
                  onChange({
                    ...decision,
                    changeType: 'add_new',
                    targetIncomeSourceId: null,
                    newMonthlyAmount: 30000,
                    newStability: 'stable',
                    newLabel: 'Side Business',
                  });
                } else if (ct === 'replace') {
                  onChange({
                    ...decision,
                    changeType: 'replace',
                    targetIncomeSourceId: decision.targetIncomeSourceId ?? snapshot.incomeSources[0]?.id ?? null,
                    newMonthlyAmount: 90000,
                    newStability: 'stable',
                  });
                } else {
                  onChange({
                    ...decision,
                    changeType: 'percent_delta',
                    targetIncomeSourceId: decision.targetIncomeSourceId ?? snapshot.incomeSources[0]?.id ?? null,
                    percentDelta: 0.15,
                  });
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="percent_delta">Percentage Raise / Cut (%)</option>
              <option value="replace">Replace Existing Source Amount</option>
              <option value="add_new">Add Brand New Income Source</option>
            </select>
          </div>

          {decision.changeType !== 'add_new' && (
            <div>
              <label htmlFor="target-income-source" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Target Income Source
              </label>
              <select
                id="target-income-source"
                value={decision.targetIncomeSourceId ?? ''}
                onChange={(e) => onChange({ ...decision, targetIncomeSourceId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {snapshot.incomeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label} (₹{source.monthlyAmount.toLocaleString('en-IN')}/mo)
                  </option>
                ))}
              </select>
            </div>
          )}

          {decision.changeType === 'percent_delta' && (
            <div>
              <label htmlFor="income-percent-delta" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Change Percentage (e.g. +20% or -15%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="income-percent-delta"
                  type="number"
                  step="5"
                  value={decision.percentDelta !== undefined ? Math.round(decision.percentDelta * 100) : 0}
                  onChange={(e) =>
                    onChange({ ...decision, percentDelta: (Number(e.target.value) || 0) / 100 })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-500 dark:text-slate-400">%</span>
              </div>
            </div>
          )}

          {decision.changeType === 'replace' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="income-replace-amount" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  New Monthly Amount
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">₹</span>
                  <input
                    id="income-replace-amount"
                    type="number"
                    min="0"
                    step="5000"
                    value={decision.newMonthlyAmount || ''}
                    onChange={(e) =>
                      onChange({ ...decision, newMonthlyAmount: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="income-replace-stability" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  New Stability
                </label>
                <select
                  id="income-replace-stability"
                  value={decision.newStability ?? 'stable'}
                  onChange={(e) =>
                    onChange({ ...decision, newStability: e.target.value as IncomeStability })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="stable">Stable</option>
                  <option value="variable">Variable</option>
                  <option value="volatile">Volatile</option>
                </select>
              </div>
            </div>
          )}

          {decision.changeType === 'add_new' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="income-new-label" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  Income Label
                </label>
                <input
                  id="income-new-label"
                  type="text"
                  value={decision.newLabel ?? ''}
                  onChange={(e) => onChange({ ...decision, newLabel: e.target.value })}
                  placeholder="e.g. Freelance Consulting"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="income-new-amount" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    Monthly Amount (₹)
                  </label>
                  <input
                    id="income-new-amount"
                    type="number"
                    min="0"
                    step="5000"
                    value={decision.newMonthlyAmount || ''}
                    onChange={(e) =>
                      onChange({ ...decision, newMonthlyAmount: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="income-new-stability" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    Stability
                  </label>
                  <select
                    id="income-new-stability"
                    value={decision.newStability ?? 'stable'}
                    onChange={(e) =>
                      onChange({ ...decision, newStability: e.target.value as IncomeStability })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="stable">Stable</option>
                    <option value="variable">Variable</option>
                    <option value="volatile">Volatile</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-form 3: New Recurring Expense */}
      {decision.kind === 'new_expense' && (
        <div className="space-y-3 pt-2 text-xs">
          <div>
            <label htmlFor="new-expense-label" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Expense Label
            </label>
            <input
              id="new-expense-label"
              type="text"
              value={decision.label}
              onChange={(e) => onChange({ ...decision, label: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="new-expense-amount" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Monthly Amount
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">₹</span>
                <input
                  id="new-expense-amount"
                  type="number"
                  min="0"
                  step="1000"
                  value={decision.monthlyAmount || ''}
                  onChange={(e) =>
                    onChange({ ...decision, monthlyAmount: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-expense-type" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Category Type
              </label>
              <select
                id="new-expense-type"
                value={decision.expenseType}
                onChange={(e) =>
                  onChange({ ...decision, expenseType: e.target.value as ExpenseCategoryType })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="fixed">Fixed</option>
                <option value="discretionary">Discretionary</option>
              </select>
            </div>

            <div>
              <label htmlFor="new-expense-start" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Starts Month
              </label>
              <input
                id="new-expense-start"
                type="number"
                min="0"
                max="11"
                value={decision.startMonth}
                onChange={(e) =>
                  onChange({
                    ...decision,
                    startMonth: Math.min(11, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-form 4: One-time Expense */}
      {decision.kind === 'one_time_expense' && (
        <div className="space-y-3 pt-2 text-xs">
          <div>
            <label htmlFor="onetime-label" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Purchase Description
            </label>
            <input
              id="onetime-label"
              type="text"
              value={decision.label}
              onChange={(e) => onChange({ ...decision, label: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="onetime-amount" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                One-off Cost (₹)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">₹</span>
                <input
                  id="onetime-amount"
                  type="number"
                  min="0"
                  step="5000"
                  value={decision.amount || ''}
                  onChange={(e) =>
                    onChange({ ...decision, amount: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="onetime-month" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                Occurs at Month Index (0-11)
              </label>
              <input
                id="onetime-month"
                type="number"
                min="0"
                max="11"
                value={decision.atMonth}
                onChange={(e) =>
                  onChange({
                    ...decision,
                    atMonth: Math.min(11, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-form 5: None */}
      {decision.kind === 'none' && (
        <div className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
          Pure baseline run selected. Both twins run your snapshot without modifications.
        </div>
      )}
    </div>
  );
}
