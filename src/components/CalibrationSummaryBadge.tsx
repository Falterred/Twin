/**
 * Part 8 - Component 8: CalibrationSummaryBadge
 *
 * Small badge showing the current riskProfile and explaining its role in tuning hazard
 * severity multipliers. This reflects hazard severity, not a rating or recommendation
 * about the user's plan.
 *
 * Props: riskProfile: RiskProfile
 */
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import type { RiskProfile } from '../engine/state';

export interface CalibrationSummaryBadgeProps {
  riskProfile: RiskProfile;
}

export function CalibrationSummaryBadge({ riskProfile }: CalibrationSummaryBadgeProps) {
  let label = 'Balanced';
  let tooltip = 'Balanced: routine hazard severity (1.0x baseline severity).';
  let colorClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  let Icon = Shield;

  if (riskProfile === 'conservative') {
    label = 'Conservative';
    tooltip = 'Conservative: we simulate more severe events (1.25x severity) to stress-test your plan.';
    colorClass = 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    Icon = ShieldAlert;
  } else if (riskProfile === 'aggressive') {
    label = 'Aggressive';
    tooltip = 'Aggressive: less severe events (0.8x severity) applied during simulation.';
    colorClass = 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    Icon = ShieldCheck;
  }

  return (
    <div className="relative group inline-block cursor-help">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass} transition-colors`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label} Sim Stress</span>
      </div>

      {/* Tooltip */}
      <div className="absolute right-0 top-8 hidden group-hover:block w-56 p-2.5 bg-slate-900 text-slate-100 text-[11px] rounded-lg shadow-xl z-20 border border-slate-700 leading-snug">
        {tooltip}
      </div>
    </div>
  );
}
