/**
 * Part 8 - Component 3: SimConfigControl
 *
 * Segmented control for simulation configuration parameters; currently controls
 * scenarioCount (50 | 100 | 300), plus the explicit "Re-run scenarios" affordance that
 * regenerates config.randomSeed.
 *
 * Every onChange here spreads the existing config object rather than reconstructing it, so
 * randomSeed survives ordinary edits untouched.
 *
 * Props: config: SimConfig, onChange: (config: SimConfig) => void,
 *        onRerunScenarios: () => void
 */
import { Sliders, RefreshCw } from 'lucide-react';
import type { SimConfig } from '../engine/state';

export interface SimConfigControlProps {
  config: SimConfig;
  onChange: (config: SimConfig) => void;
  onRerunScenarios: () => void;
}

export function SimConfigControl({ config, onChange, onRerunScenarios }: SimConfigControlProps) {
  const counts: (50 | 100 | 300)[] = [50, 100, 300];

  return (
    <div className="card-surface rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sliders className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <div>
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Scenario Sample Count
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Number of paired random 12-month runs
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          {counts.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onChange({ ...config, scenarioCount: count })}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                config.scenarioCount === count
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {count}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRerunScenarios}
          title="Generate a new set of random scenarios"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Re-run scenarios
        </button>
      </div>
    </div>
  );
}
