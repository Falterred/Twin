/**
 * Part 8 - Component 9: ScenarioSpotlightCards
 *
 * Quick-access entry points for the best-case and worst-case simulations, chosen by
 * maximum and minimum endingNetWorth among the decision-twin trajectories.
 *
 * Props: bestScenario: ScenarioTrajectory | null, worstScenario: ScenarioTrajectory | null,
 *        onSelectScenario: (trajectory: ScenarioTrajectory) => void
 */
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import type { ScenarioTrajectory } from '../engine/scenarioRunner';
import { formatRupees } from '../utils/formatters';

export interface ScenarioSpotlightCardsProps {
  bestScenario: ScenarioTrajectory | null;
  worstScenario: ScenarioTrajectory | null;
  onSelectScenario: (trajectory: ScenarioTrajectory) => void;
}

export function ScenarioSpotlightCards({
  bestScenario,
  worstScenario,
  onSelectScenario,
}: ScenarioSpotlightCardsProps) {
  if (!bestScenario || !worstScenario) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Scenario Spotlights
        </h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Click any scenario to explore its month-by-month story
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Worst Case Scenario Card */}
        <div className="card-surface rounded-xl p-5 border-l-4 border-l-rose-500 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Worst Case Scenario</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Scenario #{worstScenario.scenarioIndex + 1}
              </span>
            </div>

            <div className="mt-3 space-y-1">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Ending Net Worth:</div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatRupees(worstScenario.endingNetWorth)}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              {worstScenario.everFailedMonth ? (
                <div className="text-rose-600 dark:text-rose-400 font-medium">
                  Experienced uncovered cash shortfalls.
                </div>
              ) : worstScenario.everBreachedFund ? (
                <div className="text-amber-600 dark:text-amber-400">
                  Drained emergency fund to zero during the year.
                </div>
              ) : (
                <div className="text-slate-500">Fund balance stayed above zero all year.</div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectScenario(worstScenario)}
            className="w-full mt-2 py-2 px-3 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Read Worst Scenario Story</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Best Case Scenario Card */}
        <div className="card-surface rounded-xl p-5 border-l-4 border-l-emerald-500 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>Best Case Scenario</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Scenario #{bestScenario.scenarioIndex + 1}
              </span>
            </div>

            <div className="mt-3 space-y-1">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Ending Net Worth:</div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatRupees(bestScenario.endingNetWorth)}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                Ended the year with reserves intact and lower debt.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectScenario(bestScenario)}
            className="w-full mt-2 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Read Best Scenario Story</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
