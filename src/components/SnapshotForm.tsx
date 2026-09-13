/**
 * Part 8 - Component 1: SnapshotForm
 *
 * Input and editing interface for the user's baseline financial snapshot. Manages
 * repeatable arrays for income sources, debts and expense categories, liquid reserves,
 * risk profile, and the user's debt fallback absorption order.
 *
 * Props: snapshot: FinancialSnapshot, onChange: (s: FinancialSnapshot) => void
 *
 * Notes:
 *   - emergencyFund.isInvested is exposed via an explicit toggle (enables market_move exposure).
 *   - 'NEW_CREDIT_LINE' in debtFallbackOrder is fully movable to any position (not pinned),
 *     defaulting to the end per ascending-APR suggestions.
 *   - termMonthsRemaining is editable, with an explicit revolving affordance that stores null.
 *   - Seasonal expenses expose the optional 12-month multiplier array required by Part 1.
 */
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
  Wallet,
  Building2,
  TrendingUp,
} from 'lucide-react';
import type {
  FinancialSnapshot,
  IncomeSource,
  IncomeStability,
  DebtInstrument,
  DebtType,
  ExpenseCategory,
  ExpenseCategoryType,
  RiskProfile,
} from '../engine/state';
import { generateId } from '../utils/formatters';

export interface SnapshotFormProps {
  snapshot: FinancialSnapshot;
  onChange: (snapshot: FinancialSnapshot) => void;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function defaultSeasonalMultipliers(): number[] {
  return MONTH_LABELS.map(() => 1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnapshotForm({ snapshot, onChange }: SnapshotFormProps) {
  // Income update handlers
  const handleAddIncome = () => {
    const newSource: IncomeSource = {
      id: generateId(),
      label: 'Secondary Income',
      monthlyAmount: 20000,
      stability: 'variable',
    };
    onChange({
      ...snapshot,
      incomeSources: [...snapshot.incomeSources, newSource],
    });
  };

  const handleUpdateIncome = (index: number, patch: Partial<IncomeSource>) => {
    const updated = snapshot.incomeSources.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onChange({ ...snapshot, incomeSources: updated });
  };

  const handleRemoveIncome = (index: number) => {
    if (snapshot.incomeSources.length <= 1) return; // Keep at least one
    onChange({
      ...snapshot,
      incomeSources: snapshot.incomeSources.filter((_, i) => i !== index),
    });
  };

  // Debt update handlers
  const handleAddDebt = () => {
    const newDebtId = generateId();
    const newDebt: DebtInstrument = {
      id: newDebtId,
      type: 'personal_loan',
      label: 'New Debt',
      balance: 100000,
      annualRatePct: 12.0,
      minMonthlyPayment: 5000,
      termMonthsRemaining: 24,
    };
    // Insert new debt into fallback order right before NEW_CREDIT_LINE by default
    const fallback = [...snapshot.debtFallbackOrder];
    const nclIndex = fallback.indexOf('NEW_CREDIT_LINE');
    if (nclIndex >= 0) {
      fallback.splice(nclIndex, 0, newDebtId);
    } else {
      fallback.push(newDebtId);
    }
    onChange({
      ...snapshot,
      debts: [...snapshot.debts, newDebt],
      debtFallbackOrder: fallback,
    });
  };

  const handleUpdateDebt = (index: number, patch: Partial<DebtInstrument>) => {
    const updated = snapshot.debts.map((debt, i) =>
      i === index ? { ...debt, ...patch } : debt,
    );
    onChange({ ...snapshot, debts: updated });
  };

  const handleRemoveDebt = (index: number) => {
    const debtId = snapshot.debts[index].id;
    onChange({
      ...snapshot,
      debts: snapshot.debts.filter((_, i) => i !== index),
      debtFallbackOrder: snapshot.debtFallbackOrder.filter((id) => id !== debtId),
    });
  };

  // Expense update handlers
  const handleAddExpense = () => {
    const newExpense: ExpenseCategory = {
      id: generateId(),
      label: 'Other Expense',
      type: 'discretionary',
      monthlyAmount: 5000,
    };
    onChange({
      ...snapshot,
      expenses: [...snapshot.expenses, newExpense],
    });
  };

  const handleUpdateExpense = (index: number, patch: Partial<ExpenseCategory>) => {
    const updated = snapshot.expenses.map((expense, i) =>
      i === index ? { ...expense, ...patch } : expense,
    );
    onChange({ ...snapshot, expenses: updated });
  };

  const handleRemoveExpense = (index: number) => {
    if (snapshot.expenses.length <= 1) return;
    onChange({
      ...snapshot,
      expenses: snapshot.expenses.filter((_, i) => i !== index),
    });
  };

  const handleUpdateExpenseType = (index: number, type: ExpenseCategoryType) => {
    const patch: Partial<ExpenseCategory> = { type };
    // Part 1 requires a 12-entry multiplier array when seasonal multipliers are present.
    if (type === 'seasonal' && snapshot.expenses[index].seasonalMultipliers === undefined) {
      patch.seasonalMultipliers = defaultSeasonalMultipliers();
    }
    handleUpdateExpense(index, patch);
  };

  const handleUpdateSeasonalMultiplier = (index: number, monthIndex: number, value: number) => {
    const current = snapshot.expenses[index].seasonalMultipliers ?? defaultSeasonalMultipliers();
    const next = current.map((multiplier, i) => (i === monthIndex ? Math.max(0, value) : multiplier));
    handleUpdateExpense(index, { seasonalMultipliers: next });
  };

  // Fallback order re-ordering
  const moveFallbackItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= snapshot.debtFallbackOrder.length) return;
    const reordered = [...snapshot.debtFallbackOrder];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange({ ...snapshot, debtFallbackOrder: reordered });
  };

  const getFallbackItemLabel = (id: string): string => {
    if (id === 'NEW_CREDIT_LINE') return 'Last-resort Credit Line (assumed rate)';
    const debt = snapshot.debts.find((d) => d.id === id);
    return debt ? `${debt.label} (${debt.annualRatePct}% APR)` : id;
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Income Sources */}
      <div className="card-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
              Monthly Income Sources
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddIncome}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Income
          </button>
        </div>

        <div className="space-y-3">
          {snapshot.incomeSources.map((source, index) => (
            <div
              key={source.id}
              className="grid grid-cols-12 gap-2 items-center bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-xs"
            >
              <div className="col-span-11 col-start-1 row-start-1">
                <label htmlFor={`income-label-${source.id}`} className="sr-only">
                  Income Label
                </label>
                <input
                  id={`income-label-${source.id}`}
                  type="text"
                  value={source.label}
                  onChange={(e) => handleUpdateIncome(index, { label: e.target.value })}
                  placeholder="Label"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-6 col-start-1 row-start-2">
                <label htmlFor={`income-amount-${source.id}`} className="sr-only">
                  Monthly Amount
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1 text-slate-400 text-xs">₹</span>
                  <input
                    id={`income-amount-${source.id}`}
                    type="number"
                    min="0"
                    step="1000"
                    value={source.monthlyAmount || ''}
                    onChange={(e) =>
                      handleUpdateIncome(index, { monthlyAmount: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-5 pr-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="col-span-6 col-start-7 row-start-2">
                <label htmlFor={`income-stability-${source.id}`} className="sr-only">
                  Stability
                </label>
                <select
                  id={`income-stability-${source.id}`}
                  value={source.stability}
                  onChange={(e) =>
                    handleUpdateIncome(index, { stability: e.target.value as IncomeStability })
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="stable">Stable</option>
                  <option value="variable">Variable</option>
                  <option value="volatile">Volatile</option>
                </select>
              </div>

              <div className="col-span-1 col-start-12 row-start-1 text-right">
                <button
                  type="button"
                  onClick={() => handleRemoveIncome(index)}
                  disabled={snapshot.incomeSources.length <= 1}
                  aria-label={`Remove income source ${source.label}`}
                  className="text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Existing Debts */}
      <div className="card-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
              Existing Debts
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddDebt}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Debt
          </button>
        </div>

        {snapshot.debts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">No existing debts recorded.</p>
        ) : (
          <div className="space-y-3">
            {snapshot.debts.map((debt, index) => (
              <div
                key={debt.id}
                className="bg-slate-50/70 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-xs space-y-2"
              >
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <label htmlFor={`debt-label-${debt.id}`} className="sr-only">
                      Debt Label
                    </label>
                    <input
                      id={`debt-label-${debt.id}`}
                      type="text"
                      value={debt.label}
                      onChange={(e) => handleUpdateDebt(index, { label: e.target.value })}
                      placeholder="e.g. Personal Loan"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-5">
                    <label htmlFor={`debt-type-${debt.id}`} className="sr-only">
                      Debt Type
                    </label>
                    <select
                      id={`debt-type-${debt.id}`}
                      value={debt.type}
                      onChange={(e) => handleUpdateDebt(index, { type: e.target.value as DebtType })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="personal_loan">Personal Loan</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="auto_loan">Auto Loan</option>
                      <option value="mortgage">Mortgage</option>
                    </select>
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveDebt(index)}
                      aria-label={`Remove debt ${debt.label}`}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                  <div>
                    <label htmlFor={`debt-balance-${debt.id}`} className="block text-[10px] text-slate-500 dark:text-slate-400">
                      Balance (₹)
                    </label>
                    <input
                      id={`debt-balance-${debt.id}`}
                      type="number"
                      min="0"
                      step="5000"
                      value={debt.balance || ''}
                      onChange={(e) =>
                        handleUpdateDebt(index, { balance: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor={`debt-rate-${debt.id}`} className="block text-[10px] text-slate-500 dark:text-slate-400">
                      APR (%)
                    </label>
                    <input
                      id={`debt-rate-${debt.id}`}
                      type="number"
                      min="0"
                      step="0.5"
                      value={debt.annualRatePct || ''}
                      onChange={(e) =>
                        handleUpdateDebt(index, { annualRatePct: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor={`debt-minpay-${debt.id}`} className="block text-[10px] text-slate-500 dark:text-slate-400">
                      Min Pay (₹/mo)
                    </label>
                    <input
                      id={`debt-minpay-${debt.id}`}
                      type="number"
                      min="0"
                      step="500"
                      value={debt.minMonthlyPayment || ''}
                      onChange={(e) =>
                        handleUpdateDebt(index, { minMonthlyPayment: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor={`debt-term-${debt.id}`} className="block text-[10px] text-slate-500 dark:text-slate-400">
                      Months Left
                    </label>
                    <input
                      id={`debt-term-${debt.id}`}
                      type="number"
                      min="0"
                      step="1"
                      value={debt.termMonthsRemaining ?? ''}
                      onChange={(e) =>
                        handleUpdateDebt(index, {
                          termMonthsRemaining:
                            e.target.value === ''
                              ? null
                              : Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <label
                  htmlFor={`debt-revolving-${debt.id}`}
                  className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer"
                >
                  <input
                    id={`debt-revolving-${debt.id}`}
                    type="checkbox"
                    checked={debt.termMonthsRemaining === null}
                    onChange={(e) =>
                      handleUpdateDebt(index, { termMonthsRemaining: e.target.checked ? null : 24 })
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Revolving debt (no fixed term)
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Monthly Expenses */}
      <div className="card-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
              Monthly Expenses
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddExpense}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Expense
          </button>
        </div>

        <div className="space-y-3">
          {snapshot.expenses.map((expense, index) => (
            <div
              key={expense.id}
              className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-xs space-y-2"
            >
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-11 col-start-1 row-start-1">
                  <label htmlFor={`expense-label-${expense.id}`} className="sr-only">
                    Expense Label
                  </label>
                  <input
                    id={`expense-label-${expense.id}`}
                    type="text"
                    value={expense.label}
                    onChange={(e) => handleUpdateExpense(index, { label: e.target.value })}
                    placeholder="e.g. Rent"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-6 col-start-1 row-start-2">
                  <label htmlFor={`expense-amount-${expense.id}`} className="sr-only">
                    Monthly Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1 text-slate-400 text-xs">₹</span>
                    <input
                      id={`expense-amount-${expense.id}`}
                      type="number"
                      min="0"
                      step="1000"
                      value={expense.monthlyAmount || ''}
                      onChange={(e) =>
                        handleUpdateExpense(index, { monthlyAmount: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-5 pr-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="col-span-6 col-start-7 row-start-2">
                  <label htmlFor={`expense-type-${expense.id}`} className="sr-only">
                    Expense Type
                  </label>
                  <select
                    id={`expense-type-${expense.id}`}
                    value={expense.type}
                    onChange={(e) =>
                      handleUpdateExpenseType(index, e.target.value as ExpenseCategoryType)
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="discretionary">Discretionary</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>

                <div className="col-span-1 col-start-12 row-start-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveExpense(index)}
                    disabled={snapshot.expenses.length <= 1}
                    aria-label={`Remove expense ${expense.label}`}
                    className="text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {expense.type === 'seasonal' && (
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 space-y-1">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Seasonal multipliers (1.0 = a normal month), applied to the monthly amount
                  </p>
                  <div className="grid grid-cols-12 gap-1">
                    {MONTH_LABELS.map((monthLabel, monthIndex) => {
                      const multipliers = expense.seasonalMultipliers ?? defaultSeasonalMultipliers();
                      return (
                        <div key={monthLabel}>
                          <label
                            htmlFor={`expense-seasonal-${expense.id}-${monthIndex}`}
                            className="block text-[9px] text-center text-slate-400 dark:text-slate-500"
                          >
                            {monthLabel}
                          </label>
                          <input
                            id={`expense-seasonal-${expense.id}-${monthIndex}`}
                            type="number"
                            min="0"
                            step="0.1"
                            value={multipliers[monthIndex]}
                            onChange={(e) =>
                              handleUpdateSeasonalMultiplier(index, monthIndex, Number(e.target.value) || 0)
                            }
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-0.5 py-1 text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Emergency Fund & Reserves */}
      <div className="card-surface rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
            Reserves & Risk Profile
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="emergency-balance" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Emergency Fund Balance
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">₹</span>
              <input
                id="emergency-balance"
                type="number"
                min="0"
                step="5000"
                value={snapshot.emergencyFund.balance || ''}
                onChange={(e) =>
                  onChange({
                    ...snapshot,
                    emergencyFund: {
                      ...snapshot.emergencyFund,
                      balance: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="emergency-target" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Target Cushion (Months)
            </label>
            <input
              id="emergency-target"
              type="number"
              min="1"
              max="24"
              value={snapshot.emergencyFund.targetMonths || ''}
              onChange={(e) =>
                onChange({
                  ...snapshot,
                  emergencyFund: {
                    ...snapshot.emergencyFund,
                    targetMonths: Math.max(1, Number(e.target.value) || 1),
                  },
                })
              }
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="liquid-cash" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Liquid Cash Outside Fund
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">₹</span>
              <input
                id="liquid-cash"
                type="number"
                min="0"
                step="5000"
                value={snapshot.liquidCashOutsideFund || ''}
                onChange={(e) =>
                  onChange({
                    ...snapshot,
                    liquidCashOutsideFund: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="risk-profile" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
              Risk Profile (Sim Stress)
            </label>
            <select
              id="risk-profile"
              value={snapshot.riskProfile}
              onChange={(e) =>
                onChange({ ...snapshot, riskProfile: e.target.value as RiskProfile })
              }
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="conservative">Conservative (1.25x severity)</option>
              <option value="balanced">Balanced (1.0x severity)</option>
              <option value="aggressive">Aggressive (0.8x severity)</option>
            </select>
          </div>
        </div>

        {/* Correction 1: Explicit toggle for emergencyFund.isInvested */}
        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-start gap-2.5">
          <input
            id="fund-invested-toggle"
            type="checkbox"
            checked={snapshot.emergencyFund.isInvested}
            onChange={(e) =>
              onChange({
                ...snapshot,
                emergencyFund: {
                  ...snapshot.emergencyFund,
                  isInvested: e.target.checked,
                },
              })
            }
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="fund-invested-toggle" className="text-xs text-slate-600 dark:text-slate-300 leading-snug cursor-pointer">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Emergency fund is market-invested
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Exposes emergency fund balance to monthly market return fluctuations rather than holding cash.
            </span>
          </label>
        </div>
      </div>

      {/* Section 5: Debt Fallback Order (Correction: 'NEW_CREDIT_LINE' is fully movable to any position) */}
      <div className="card-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
            Shortfall Fallback Order
          </h3>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">First to absorb deficit</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
          When a month&apos;s cash deficit exceeds your liquid cash and emergency fund, shortfalls are absorbed in this exact order:
        </p>

        <div className="space-y-1.5 text-xs">
          {snapshot.debtFallbackOrder.map((id, index) => {
            const isCreditLine = id === 'NEW_CREDIT_LINE';
            return (
              <div
                key={id}
                className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                  isCreditLine
                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-400">
                    {index + 1}
                  </span>
                  <span className="font-medium">{getFallbackItemLabel(id)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveFallbackItem(index, 'up')}
                    disabled={index === 0}
                    aria-label={`Move ${getFallbackItemLabel(id)} up`}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFallbackItem(index, 'down')}
                    disabled={index === snapshot.debtFallbackOrder.length - 1}
                    aria-label={`Move ${getFallbackItemLabel(id)} down`}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
