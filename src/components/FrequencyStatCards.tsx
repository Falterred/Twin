/**
 * Part 8 - Component 6: FrequencyStatCards
 *
 * Plain-language event-frequency comparison cards. Renders baseline vs decision
 * percentages, the signed delta, and severity colours.
 *
 * Props: stats: FrequencyStat[]
 *
 * Conditional stats return NaN when too few scenarios qualified; each numeric field is
 * checked with Number.isNaN() and rendered as a muted "N/A" card rather than a
 * misleading 0% or "NaN%".
 */
import { AlertCircle, CheckCircle2, MinusCircle, HelpCircle } from 'lucide-react';
import type { FrequencyStat } from '../engine/aggregation';
import { formatPct, formatSignedDeltaPct } from '../utils/formatters';

export interface FrequencyStatCardsProps {
  stats: FrequencyStat[];
}

export function FrequencyStatCards({ stats }: FrequencyStatCardsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Risk & Outcome Frequencies
        </h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Compared across all simulated scenarios
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((stat) => {
          const isBaselineNaN = Number.isNaN(stat.baselinePct);
          const isDecisionNaN = Number.isNaN(stat.decisionPct);
          const isDeltaNaN = Number.isNaN(stat.deltaPct);
          const isNA = isBaselineNaN || isDecisionNaN || isDeltaNaN;

          // Severity colors
          let severityBadge = (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              <MinusCircle className="w-3 h-3" /> Neutral
            </span>
          );

          if (isNA) {
            severityBadge = (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded">
                <HelpCircle className="w-3 h-3" /> N/A
              </span>
            );
          } else if (stat.severity === 'negative') {
            severityBadge = (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                <AlertCircle className="w-3 h-3" /> More Risk
              </span>
            );
          } else if (stat.severity === 'positive') {
            severityBadge = (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/60">
                <CheckCircle2 className="w-3 h-3" /> Favorable
              </span>
            );
          }

          return (
            <div
              key={stat.id}
              className={`card-surface rounded-xl p-4 flex flex-col justify-between transition-all ${
                isNA ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/40' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">
                    {stat.label}
                  </h4>
                  {severityBadge}
                </div>

                {isNA ? (
                  <div className="py-2">
                    <span className="text-lg font-bold text-slate-400 dark:text-slate-500 font-mono">
                      N/A
                    </span>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">
                      Fewer than 5% of scenarios qualified for this condition.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Baseline:</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {formatPct(stat.baselinePct)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">With Decision:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                        {formatPct(stat.decisionPct)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!isNA && (
                <div className="pt-3 mt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">Net Change:</span>
                  <span
                    className={`font-mono font-bold ${
                      stat.severity === 'negative'
                        ? 'text-rose-600 dark:text-rose-400'
                        : stat.severity === 'positive'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {formatSignedDeltaPct(stat.deltaPct)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
