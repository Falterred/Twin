// ─────────────────────────────────────────────────────────────
// ModeToggle — Deterministic / Probabilistic segmented pill
// ─────────────────────────────────────────────────────────────

import { Activity, BarChart3 } from 'lucide-react';
import type { SimMode } from '../engine/constants';

interface ModeToggleProps {
  mode: SimMode;
  onChange: (mode: SimMode) => void;
}

const MODES: { value: SimMode; label: string; sublabel: string; icon: React.ReactNode }[] = [
  {
    value: 'deterministic',
    label: 'Deterministic',
    sublabel: '12-Month Lines',
    icon: <Activity className="w-4 h-4" />,
  },
  {
    value: 'probabilistic',
    label: 'Probabilistic',
    sublabel: 'Monte Carlo Bands',
    icon: <BarChart3 className="w-4 h-4" />,
  },
];

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="glass-card p-1 inline-flex gap-1 w-full sm:w-auto" id="mode-toggle">
      {MODES.map((m) => {
        const isActive = mode === m.value;
        return (
          <button
            key={m.value}
            id={`mode-${m.value}`}
            onClick={() => onChange(m.value)}
            aria-pressed={isActive}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              text-sm font-semibold transition-all duration-300 cursor-pointer
              ${isActive
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95'
              }`}
          >
            <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
              {m.icon}
            </span>
            <span className="hidden sm:inline">{m.label}</span>
            <span className="text-[10px] font-normal opacity-70 hidden lg:inline">
              {m.sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
