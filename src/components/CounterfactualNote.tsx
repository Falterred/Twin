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
      className="glass-card p-3.5 sm:p-4 border-l-4 !rounded-xl animate-fade-in flex items-center justify-between gap-3 flex-wrap relative overflow-hidden"
      style={{ borderLeftColor: targetColor }}
    >
      {/* Background subtle badge */}
      <div className="absolute -top-3 -right-3 text-[10px] font-bold text-slate-200 dark:text-slate-800/50 uppercase tracking-widest rotate-12 pointer-events-none select-none">
        {mode === 'probabilistic' ? 'Deterministic Baseline' : 'Baseline Sensitivity'}
      </div>
      
      <div className="flex items-center gap-2.5 flex-1 min-w-[240px] z-10">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400 shrink-0">
          <Lightbulb className="w-4 h-4" />
        </div>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
          <span className="font-semibold text-slate-900 dark:text-slate-100">What-If Insight: </span>
          {explanation}
          <span className="font-semibold" style={{ color: targetColor }}>
            {targetLabel}
          </span>{' '}
          would overtake as the #1 optimal choice.
        </p>
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
        <span>{mode === 'probabilistic' ? 'Deterministic baseline' : 'Baseline'}</span>
        <ArrowRight className="w-3 h-3" />
        <span style={{ color: targetColor }}>{targetLabel}</span>
      </div>
    </div>
  );
}
