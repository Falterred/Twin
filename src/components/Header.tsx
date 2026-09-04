// ─────────────────────────────────────────────────────────────
// Header — Brand, risk profile badge, theme toggle
// ─────────────────────────────────────────────────────────────

import { Moon, Sun, Settings2, Sparkles } from 'lucide-react';
import type { RiskProfile } from '../engine/constants';
import { capitalize } from '../utils';

interface HeaderProps {
  riskProfile: RiskProfile;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenCalibration: () => void;
}

const PROFILE_STYLES: Record<RiskProfile, string> = {
  conservative: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  balanced: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  aggressive: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

export function Header({ riskProfile, isDark, onToggleTheme, onOpenCalibration }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 glass-card rounded-none border-t-0 border-x-0 px-6 py-3">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
              Twin
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">
              Financial Decision Optimizer
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Risk Profile Badge */}
          <button
            id="calibration-trigger"
            onClick={onOpenCalibration}
            aria-label="Open risk profile calibration"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border
              transition-all duration-200 hover:scale-105 cursor-pointer
              ${PROFILE_STYLES[riskProfile]}`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {capitalize(riskProfile)}
          </button>

          {/* Theme Toggle */}
          <button
            id="theme-toggle"
            onClick={onToggleTheme}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl
              bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700
              text-slate-600 dark:text-slate-300
              hover:bg-slate-200 dark:hover:bg-slate-700
              transition-all duration-200 cursor-pointer"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="w-4.5 h-4.5 transition-transform duration-300 rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="w-4.5 h-4.5 transition-transform duration-300 rotate-0 hover:-rotate-12" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
