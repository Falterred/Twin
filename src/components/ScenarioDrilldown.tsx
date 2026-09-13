/**
 * Part 8 - Component 7: ScenarioDrilldown
 *
 * Detailed inspection of a single 12-month scenario trajectory:
 *   - a single-scenario line chart (liquid cash, emergency fund, total debt);
 *   - a scrollable narrative log (deterministic plain-language story of the year);
 *   - a per-checkpoint "Edit & fork from here" form exposing every ForkEditableField;
 *   - a violet ReferenceLine (#8b5cf6) marking where a fork diverged;
 *   - a focus trap plus Escape-key closure for accessibility.
 *
 * Props: trajectory: ScenarioTrajectory, narrative: NarrativeLine[],
 *        onForkAtMonth: (month: number, edits: ForkEditableField[]) => void,
 *        onClose: () => void, forkMonth?: number | null
 */
import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  X,
  GitFork,
  AlertCircle,
  TrendingUp,
  Minus,
  Save,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { ScenarioTrajectory } from '../engine/scenarioRunner';
import type { NarrativeLine, ForkEditableField } from '../engine/narrative';
import { formatRupees, formatRupeesCompact } from '../utils/formatters';

export interface ScenarioDrilldownProps {
  trajectory: ScenarioTrajectory;
  narrative: NarrativeLine[];
  onForkAtMonth: (month: number, edits: ForkEditableField[]) => void;
  onClose: () => void;
  forkMonth?: number | null;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ScenarioDrilldown({
  trajectory,
  narrative,
  onForkAtMonth,
  onClose,
  forkMonth = null,
}: ScenarioDrilldownProps) {
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape closes the modal; Tab cycles within it (focus trap).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }

      const container = modalRef.current;
      if (!container) {
        return;
      }
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const isInside = active !== null && container.contains(active);

      if (e.shiftKey) {
        if (!isInside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!isInside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on modal
    modalRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Chart data for single scenario
  const chartData = trajectory.checkpoints.map((cp) => {
    const outcome = cp.outcome;
    const totalDebt = Object.values(outcome.endingDebtBalances).reduce((a, b) => a + b, 0);
    return {
      month: `M${cp.month}`,
      monthIndex: cp.month,
      liquidCash: outcome.endingCash,
      emergencyFund: outcome.endingFundBalance,
      totalDebt,
      netWorth: outcome.endingCash + outcome.endingFundBalance - totalDebt,
    };
  });

  // State for the inline fork edit form
  const [forkFundBalance, setForkFundBalance] = useState<number>(0);
  const [forkLiquidCash, setForkLiquidCash] = useState<number>(0);
  const [forkDebtEdits, setForkDebtEdits] = useState<Record<string, number>>({});
  const [forkIncomeEdits, setForkIncomeEdits] = useState<Record<string, number>>({});

  const editingCheckpoint = editingMonth === null ? null : trajectory.checkpoints[editingMonth];

  const handleOpenForkEditor = (month: number) => {
    const checkpoint = trajectory.checkpoints[month];
    if (!checkpoint) return;
    setEditingMonth(month);
    setForkFundBalance(checkpoint.snapshot.emergencyFund.balance);
    setForkLiquidCash(checkpoint.snapshot.liquidCashOutsideFund);

    const initialDebts: Record<string, number> = {};
    checkpoint.snapshot.debts.forEach((d) => {
      initialDebts[d.id] = d.balance;
    });
    setForkDebtEdits(initialDebts);

    const initialIncomes: Record<string, number> = {};
    checkpoint.snapshot.incomeSources.forEach((i) => {
      initialIncomes[i.id] = i.monthlyAmount;
    });
    setForkIncomeEdits(initialIncomes);
  };

  const handleApplyFork = (e: FormEvent) => {
    e.preventDefault();
    if (editingMonth === null) return;

    const checkpoint = trajectory.checkpoints[editingMonth];
    const edits: ForkEditableField[] = [
      { field: 'emergencyFund.balance', value: forkFundBalance },
      { field: 'liquidCashOutsideFund', value: forkLiquidCash },
    ];

    // Only emit debt/income edits whose value actually changed at this checkpoint.
    Object.entries(forkDebtEdits).forEach(([debtId, balance]) => {
      const debt = checkpoint.snapshot.debts.find((entry) => entry.id === debtId);
      if (debt !== undefined && debt.balance !== balance) {
        edits.push({ field: `debt.${debtId}.balance`, value: balance });
      }
    });

    Object.entries(forkIncomeEdits).forEach(([sourceId, amount]) => {
      const source = checkpoint.snapshot.incomeSources.find((entry) => entry.id === sourceId);
      if (source !== undefined && source.monthlyAmount !== amount) {
        edits.push({ field: `incomeSource.${sourceId}.monthlyAmount`, value: amount });
      }
    });

    onForkAtMonth(editingMonth, edits);
    setEditingMonth(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drilldown-title"
      ref={modalRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 outline-none"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="drilldown-title" className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Scenario #{trajectory.scenarioIndex + 1} Story & Drilldown</span>
              {forkMonth !== null && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                  Forked at Month {forkMonth}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Follow month-by-month events or fork from any checkpoint to test an alternate cushion.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drilldown modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split view (Chart on top/left, Narrative log on right) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 12-Month Single Scenario Chart */}
          <div className="lg:col-span-7 space-y-4">
            <div className="card-surface rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                12-Month Balances for This Trajectory
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.15} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis
                      tickFormatter={formatRupeesCompact}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded shadow-lg text-xs space-y-1">
                            <div className="font-semibold text-slate-300">Month {d.monthIndex}</div>
                            <div className="text-emerald-400">Cash: {formatRupees(d.liquidCash)}</div>
                            <div className="text-blue-400">Emergency Fund: {formatRupees(d.emergencyFund)}</div>
                            <div className="text-rose-400">Total Debt: {formatRupees(d.totalDebt)}</div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />

                    {/* Optional ReferenceLine marking fork divergence */}
                    {forkMonth !== null && (
                      <ReferenceLine
                        x={`M${forkMonth}`}
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        label={{
                          value: `⑂ M${forkMonth}`,
                          fill: '#8b5cf6',
                          fontSize: 10,
                          fontWeight: 600,
                          position: 'insideTopRight',
                          offset: 4,
                        }}
                      />
                    )}

                    <Line
                      type="monotone"
                      dataKey="emergencyFund"
                      stroke="#2563eb"
                      strokeWidth={2}
                      name="Emergency Fund"
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="liquidCash"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      name="Liquid Cash"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalDebt"
                      stroke="#f43f5e"
                      strokeWidth={1.5}
                      name="Total Debt"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fork Edit Sub-form (When active) */}
            {editingMonth !== null && (
              <form
                onSubmit={handleApplyFork}
                className="card-surface rounded-xl p-5 border-2 border-violet-500/80 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Forking From Month {editingMonth}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingMonth(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Adjust entry balances at this month to see how the same bad-luck events would have played out with a different cushion.
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label htmlFor="fork-fund" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                      Emergency Fund Balance (₹)
                    </label>
                    <input
                      id="fork-fund"
                      type="number"
                      min="0"
                      step="5000"
                      value={forkFundBalance}
                      onChange={(e) => setForkFundBalance(Number(e.target.value) || 0)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-right font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="fork-cash" className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">
                      Liquid Cash Outside Fund (₹)
                    </label>
                    <input
                      id="fork-cash"
                      type="number"
                      min="0"
                      step="5000"
                      value={forkLiquidCash}
                      onChange={(e) => setForkLiquidCash(Number(e.target.value) || 0)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-right font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {editingCheckpoint !== null && editingCheckpoint.snapshot.debts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Debt balances at this month
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {editingCheckpoint.snapshot.debts.map((debt) => (
                        <div key={debt.id}>
                          <label
                            htmlFor={`fork-debt-${debt.id}`}
                            className="block text-slate-600 dark:text-slate-400 mb-1 font-medium"
                          >
                            {debt.label} (₹)
                          </label>
                          <input
                            id={`fork-debt-${debt.id}`}
                            type="number"
                            min="0"
                            step="5000"
                            value={forkDebtEdits[debt.id] ?? debt.balance}
                            onChange={(e) =>
                              setForkDebtEdits((prev) => ({
                                ...prev,
                                [debt.id]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-right font-mono text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editingCheckpoint !== null && editingCheckpoint.snapshot.incomeSources.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Income amounts at this month
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {editingCheckpoint.snapshot.incomeSources.map((source) => (
                        <div key={source.id}>
                          <label
                            htmlFor={`fork-income-${source.id}`}
                            className="block text-slate-600 dark:text-slate-400 mb-1 font-medium"
                          >
                            {source.label} (₹/mo)
                          </label>
                          <input
                            id={`fork-income-${source.id}`}
                            type="number"
                            min="0"
                            step="5000"
                            value={forkIncomeEdits[source.id] ?? source.monthlyAmount}
                            onChange={(e) =>
                              setForkIncomeEdits((prev) => ({
                                ...prev,
                                [source.id]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-right font-mono text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingMonth(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" /> Re-simulate from Month {editingMonth}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: Narrative Log */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Chronological Event Log</span>
              <span className="text-[11px] font-normal text-slate-500">{narrative.length} entries</span>
            </h3>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {trajectory.checkpoints.map((cp) => {
                const monthLines = narrative.filter((line) => line.month === cp.month);

                return (
                  <div
                    key={cp.month}
                    className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                      editingMonth === cp.month
                        ? 'border-violet-500 bg-violet-50/40 dark:bg-violet-950/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Month {cp.month}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenForkEditor(cp.month)}
                        className="flex items-center gap-1 text-[11px] text-violet-600 dark:text-violet-400 hover:underline font-medium"
                      >
                        <GitFork className="w-3 h-3" /> Edit & fork from here
                      </button>
                    </div>

                    {monthLines.length > 0 ? (
                      <div className="space-y-1.5">
                        {monthLines.map((line, idx) => {
                          const isSetback = line.tone === 'setback';
                          const isCaution = line.tone === 'caution';
                          const isRelief = line.tone === 'relief';

                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg leading-relaxed flex items-start gap-2 ${
                                isSetback
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                                  : isCaution
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                  : isRelief
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isSetback ? (
                                <AlertOctagon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                              ) : isCaution ? (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                              ) : isRelief ? (
                                <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
                              ) : (
                                <Minus className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                              )}
                              <span>{line.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        Standard month. Routine expenses and income with no acute events.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
