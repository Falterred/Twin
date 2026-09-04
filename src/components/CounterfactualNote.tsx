// ─────────────────────────────────────────────────────────────
// CounterfactualNote — "What-If" recommendation flip pill
// ─────────────────────────────────────────────────────────────

import { Lightbulb, ArrowRight } from 'lucide-react';
import type { CounterfactualResult } from '../engine/counterfactual';
import type { SimMode } from '../engine/constants';
import { formatINR, ACTION_LABEL_MAP, ACTION_COLOR_MAP } from '../utils';

interface CounterfactualNoteProps {
  result: CounterfactualResult | null;
  mode: SimMode;
}

export function CounterfactualNote({ result, mode }: CounterfactualNoteProps) {
  if (!result) return null;

  const targetLabel = ACTION_LABEL_MAP[result.wouldFlipTo] ?? result.wouldFlipTo;
  const targetColor = ACTION_COLOR_MAP[result.wouldFlipTo] ?? '#2563eb';

  let explanation = '';
  if (result.field === 'liquidCash') {
    explanation = `If your liquid savings were ${formatINR(Math.round(result.delta))} higher, `;
  } else if (result.field === 'itemPrice') {
    explanation = `If the item price dropped by ${formatINR(Math.round(result.delta))}, `;
  } else if (result.field === 'emergencyFundMonths') {
    const months = Math.max(1, Math.round(result.delta));
    explanation = `If your emergency buffer target were ${months} month${months > 1 ? 's' : ''} higher, `;
  } else {
    explanation = `With a small adjustment to ${result.field}, `;
  }

  return (
    <div
      id="counterfactual-note"
      className="glass-card p-4 sm:p-5 border-l-4 !rounded-lg
        transition-all duration-300 hover:shadow-lg hover:scale-[1.01]
        group relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
      style={{ borderLeftColor: targetColor }}
    >
      {/* Animated background gradient */}
      <div className="absolute -top-4 -right-4 w-24 h-24 opacity-5 rounded-full"
        style={{ backgroundColor: targetColor }}
      />
      
      <div className="flex items-center gap-3 flex-1 min-w-[240px] relative z-10 flex-wrap">
        <div className="p-2 rounded-lg bg-amber-500/15 text-amber-500 dark:text-amber-400 shrink-0
          group-hover:scale-110 group-hover:bg-amber-500/25 transition-all duration-300">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            <span className="font-semibold text-slate-900 dark:text-slate-100">💡 What-If Insight: </span>
            {explanation}
            <span className="font-bold bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${targetColor}, ${targetColor}cc)` }}>
              {targetLabel}
            </span>{' '}
            would become the optimal choice.
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'probabilistic' ? '(This is the deterministic baseline sensitivity)' : '(This is the baseline what-if analysis)'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 
        bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900
        text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700
        group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-all duration-200">
        <span>Current</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        <span style={{ color: targetColor }} className="font-bold">{targetLabel}</span>
      </div>
    </div>
  );
}
