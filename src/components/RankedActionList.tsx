// ─────────────────────────────────────────────────────────────
// RankedActionList — Sorted decision cards with score breakdown
// ─────────────────────────────────────────────────────────────

import {
  Trophy,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  TrendingUp,
  Wallet,
  AlertTriangle,
  CreditCard,
  Zap,
} from 'lucide-react';
import type { ActionResult, ScoreBreakdown } from '../engine/scoring';
import type { ProbabilisticActionResult, ProbabilisticScoreBreakdown } from '../engine/probabilistic';
import type { SimMode } from '../engine/constants';

type AnyResult = ActionResult | ProbabilisticActionResult;
type AnyBreakdown = ScoreBreakdown | ProbabilisticScoreBreakdown;

interface RankedActionListProps {
  mode: SimMode;
  results: AnyResult[];
}

/* ─── Breakdown Label Config ─── */

const BREAKDOWN_KEYS: {
  key: keyof AnyBreakdown;
  label: string;
  icon: React.ReactNode;
  color: string;
  isNegative?: boolean;
}[] = [
  { key: 'safety',     label: 'Safety Buffer',   icon: <Wallet className="w-3 h-3" />,        color: '#10b981' },
  { key: 'oppCost',    label: 'Opportunity Cost', icon: <TrendingUp className="w-3 h-3" />,    color: '#f59e0b', isNegative: true },
  { key: 'delayCost',  label: 'Delay Cost',       icon: <AlertTriangle className="w-3 h-3" />, color: '#ef4444', isNegative: true },
  { key: 'debtBurden', label: 'Debt Burden',      icon: <CreditCard className="w-3 h-3" />,    color: '#8b5cf6', isNegative: true },
  { key: 'utility',    label: 'Utility Value',    icon: <Zap className="w-3 h-3" />,            color: '#06b6d4' },
];

/* ─── Single Card ─── */

interface ActionCardProps {
  result: AnyResult;
  rank: number;
  staggerClass: string;
}

function ActionCard({ result, rank, staggerClass }: ActionCardProps) {
  const isTop = rank === 1 && !result.disqualified;
  const scorePercent = Math.round(result.score * 100);

  return (
    <div
      id={`action-card-${result.id}`}
      className={`glass-card p-4 transition-all duration-300 ease-out
        ${staggerClass}
        ${result.disqualified ? 'opacity-60 hover:opacity-70' : 'hover:scale-[1.02] hover:shadow-lg'}
        ${isTop ? 'glow-gold !border-amber-500/40 shadow-lg shadow-amber-500/20' : 'hover:border-blue-400/30 dark:hover:border-blue-600/30'}
        group cursor-default`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Rank badge */}
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white shrink-0
              transition-all duration-200
              ${result.disqualified
                ? 'bg-slate-400 dark:bg-slate-600'
                : isTop
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 group-hover:scale-110 group-hover:shadow-xl'
                  : 'group-hover:scale-110'
              }`}
            style={!result.disqualified && !isTop ? { backgroundColor: result.color } : undefined}
          >
            {result.disqualified ? '—' : `#${rank}`}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                {result.label}
              </h3>
              {isTop && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold
                  bg-gradient-to-r from-amber-400/20 to-emerald-400/20
                  text-amber-600 dark:text-amber-400
                  border border-amber-400/30 rounded-full">
                  <Trophy className="w-3 h-3" />
                  OPTIMAL
                </span>
              )}
            </div>

            {/* Score bar */}
            {!result.disqualified && (
              <div className="flex items-center gap-2 mt-1">
                <div className="progress-bar w-20">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${scorePercent}%`,
                      backgroundColor: result.color,
                    }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                  {scorePercent}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Shock status */}
        <div className="shrink-0">
          {result.survivesShock ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold
              bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shock Safe</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold
              bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shock Risk</span>
            </div>
          )}
        </div>
      </div>

      {/* Disqualification banner */}
      {result.disqualified && result.disqualifyReason && (
        <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-lg
          bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-medium leading-snug">{result.disqualifyReason}</p>
        </div>
      )}

      {/* Score breakdown bars */}
      {!result.disqualified && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {BREAKDOWN_KEYS.map((b) => {
            const val = result.breakdown[b.key];
            const pct = Math.round(val * 100);
            return (
              <div key={b.key} className="flex items-center gap-2">
                <span className="shrink-0" style={{ color: b.color }}>
                  {b.icon}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 w-[72px] truncate">
                  {b.label}
                </span>
                <div className="progress-bar flex-1">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: b.color,
                      opacity: b.isNegative ? 0.7 : 1,
                    }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums w-7 text-right">
                  {pct}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── List ─── */

const STAGGER_CLASSES = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5', 'stagger-6'];

export function RankedActionList({ results }: RankedActionListProps) {
  if (!results || results.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-sm text-slate-400">No results to display</p>
      </div>
    );
  }

  let validRank = 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {results.map((r, i) => {
        if (!r.disqualified) validRank++;
        return (
          <ActionCard
            key={r.id}
            result={r}
            rank={r.disqualified ? 0 : validRank}
            staggerClass={STAGGER_CLASSES[i] ?? ''}
          />
        );
      })}
    </div>
  );
}
