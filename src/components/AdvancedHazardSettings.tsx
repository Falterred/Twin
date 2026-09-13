/**
 * Part 8 - Component 4: AdvancedHazardSettings
 *
 * Collapsible panel for the user-editable simulation assumptions (hazard overrides),
 * collapsed by default so first-time users are not buried in probability controls.
 *
 * Props: overrides: Partial<HazardOverrides>,
 *        onChange: (overrides: Partial<HazardOverrides>) => void
 *
 * Notes:
 *   - Base event probabilities are entered and displayed as percentages, converted to
 *     and from decimals at this boundary.
 *   - Income variability (IncomeNoiseParams) has its own subsection.
 *   - The assumed fallback APR (newCreditLineAprPct) is editable.
 *   - "Reset to defaults" restores DEFAULT_HAZARD_OVERRIDES in full.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, HelpCircle, Activity } from 'lucide-react';
import { DEFAULT_HAZARD_OVERRIDES, type HazardOverrides, type IncomeNoiseParams } from '../engine/state';

export interface AdvancedHazardSettingsProps {
  overrides: Partial<HazardOverrides>;
  onChange: (overrides: Partial<HazardOverrides>) => void;
}

export function AdvancedHazardSettings({
  overrides,
  onChange,
}: AdvancedHazardSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Merge with defaults for display values
  const current: HazardOverrides = {
    ...DEFAULT_HAZARD_OVERRIDES,
    ...overrides,
    incomeNoise: {
      ...DEFAULT_HAZARD_OVERRIDES.incomeNoise,
      ...(overrides.incomeNoise ?? {}),
    },
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_HAZARD_OVERRIDES });
  };

  const updateProbability = (key: keyof Omit<HazardOverrides, 'incomeNoise' | 'newCreditLineAprPct'>, pctVal: number) => {
    const decimal = Math.max(0, Math.min(100, pctVal)) / 100;
    onChange({ ...overrides, [key]: decimal });
  };

  const updateNoise = (key: keyof IncomeNoiseParams, pctVal: number) => {
    const decimal = Math.max(0, Math.min(100, pctVal)) / 100;
    const nextNoise: IncomeNoiseParams = {
      stable: current.incomeNoise.stable,
      variable: current.incomeNoise.variable,
      volatile: current.incomeNoise.volatile,
      [key]: decimal,
    };
    onChange({ ...overrides, incomeNoise: nextNoise });
  };

  return (
    <div className="card-surface rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Advanced Simulation Assumptions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {isOpen ? 'Hide' : 'Tune base hazards'}
          </span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Customize monthly event baseline chances and noise parameters.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset to defaults
            </button>
          </div>

          {/* Subsection 1: Discrete Event Probabilities */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Monthly Event Probabilities
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prob-job-loss" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Job Loss Chance (%/mo)
                </label>
                <input
                  id="prob-job-loss"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={Number((current.jobLossBaseProb * 100).toFixed(2))}
                  onChange={(e) => updateProbability('jobLossBaseProb', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="prob-medical-routine" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Routine Medical (%/mo)
                </label>
                <input
                  id="prob-medical-routine"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={Number((current.medicalRoutineBaseProb * 100).toFixed(2))}
                  onChange={(e) => updateProbability('medicalRoutineBaseProb', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="prob-medical-tail" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Major Medical (%/mo)
                </label>
                <input
                  id="prob-medical-tail"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={Number((current.medicalTailBaseProb * 100).toFixed(2))}
                  onChange={(e) => updateProbability('medicalTailBaseProb', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="prob-housing-spike" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Housing Cost Hike (%/mo)
                </label>
                <input
                  id="prob-housing-spike"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={Number((current.housingSpikeBaseProb * 100).toFixed(2))}
                  onChange={(e) => updateProbability('housingSpikeBaseProb', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="prob-bonus" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Bonus Probability (%/mo)
                </label>
                <input
                  id="prob-bonus"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={Number((current.bonusBaseProb * 100).toFixed(2))}
                  onChange={(e) => updateProbability('bonusBaseProb', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="prob-windfall" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Windfall Probability (%/mo)
                </label>
                <input
                  id="prob-windfall"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={Number((current.windfallBaseProb * 100).toFixed(2))}
                  onChange={(e) => updateProbability('windfallBaseProb', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Subsection 2: Continuous Income Variability (grouped separately per spec) */}
          <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/50 space-y-3">
            <div className="flex items-center gap-1.5">
              <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Income Variability (Monthly Fluctuation StdDev)
              </h4>
              <div className="relative group cursor-pointer">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <div className="absolute left-0 bottom-5 hidden group-hover:block w-48 p-2 bg-slate-900 text-slate-200 text-[10px] rounded shadow-lg z-10">
                  Continuous month-to-month swings applied to income tiers.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="noise-stable" className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Stable (Salary)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="noise-stable"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={Number((current.incomeNoise.stable * 100).toFixed(0))}
                    onChange={(e) => updateNoise('stable', Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label htmlFor="noise-variable" className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Variable (Freelance)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="noise-variable"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={Number((current.incomeNoise.variable * 100).toFixed(0))}
                    onChange={(e) => updateNoise('variable', Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label htmlFor="noise-volatile" className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Volatile (Commissions)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="noise-volatile"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={Number((current.incomeNoise.volatile * 100).toFixed(0))}
                    onChange={(e) => updateNoise('volatile', Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subsection 3: Last-resort fallback assumed rate */}
          <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
            <label htmlFor="assumed-apr" className="block text-slate-600 dark:text-slate-400 mb-1">
              Last-resort Credit Line Assumed APR (%)
            </label>
            <input
              id="assumed-apr"
              type="number"
              step="0.5"
              min="0"
              value={current.newCreditLineAprPct}
              onChange={(e) => onChange({ ...overrides, newCreditLineAprPct: Number(e.target.value) || 0 })}
              className="w-36 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
