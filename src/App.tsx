/**
 * Part 9 - Top-Level State Management & Recompute Flow
 *
 * Single root component wiring every engine module and UI component through one pure,
 * unidirectional useMemo pipeline:
 *   debounced inputs -> buildDerivedState -> runSimulation -> aggregateResults -> sampleForDisplay
 *
 * Invariants:
 *   - Input changes are debounced (~150ms) so keystrokes do not rerun the simulation.
 *   - Forking only affects forkOverrides for the open drilldown view; it never leaks into
 *     runSimulation or aggregateResults.
 *   - selectedScenarioIndex resets to null on any full recompute of paired.
 *   - Toggling showIndividualLines does not retrigger simulation or aggregation.
 *   - No useEffect writes back to snapshot/decision/config/hazardOverrides.
 *   - The results area renders an empty-state prompt (never simulated output) while
 *     decision.kind === 'none' or every income source is Rs 0.
 *   - randomSeed lives in config state, generated once per session; only the explicit
 *     "Re-run scenarios" action regenerates it, so ordinary edits never reshuffle the draw.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Moon, Sun, Layers } from 'lucide-react';
import type { FinancialSnapshot, SimConfig, HazardOverrides } from './engine/state';
import { buildDerivedState } from './engine/state';
import type { DecisionDiff } from './engine/decision';
import { runSimulation, forkFromCheckpoint, type ScenarioTrajectory, type PairedScenario } from './engine/scenarioRunner';
import { aggregateResults } from './engine/aggregation';
import { generateNarrative, applyForkEdits, type ForkEditableField } from './engine/narrative';

import { SnapshotForm } from './components/SnapshotForm';
import { DecisionForm } from './components/DecisionForm';
import { SimConfigControl } from './components/SimConfigControl';
import { AdvancedHazardSettings } from './components/AdvancedHazardSettings';
import { ComparisonFanChart } from './components/ComparisonFanChart';
import { FrequencyStatCards } from './components/FrequencyStatCards';
import { ScenarioSpotlightCards } from './components/ScenarioSpotlightCards';
import { ScenarioDrilldown } from './components/ScenarioDrilldown';
import { CalibrationSummaryBadge } from './components/CalibrationSummaryBadge';

import {
  INITIAL_SNAPSHOT,
  INITIAL_DECISION,
  INITIAL_CONFIG,
  EXAMPLE_SNAPSHOT,
  EXAMPLE_DECISION,
} from './utils/defaults';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleForDisplay(paired: PairedScenario[], n: number): {
  baselineSample: ScenarioTrajectory[];
  decisionSample: ScenarioTrajectory[];
} {
  if (paired.length === 0) {
    return { baselineSample: [], decisionSample: [] };
  }
  const count = Math.min(n, paired.length);
  const baselineSample: ScenarioTrajectory[] = [];
  const decisionSample: ScenarioTrajectory[] = [];

  for (let i = 0; i < count; i++) {
    const index = Math.floor((i * paired.length) / count);
    baselineSample.push(paired[index].baseline);
    decisionSample.push(paired[index].decision);
  }

  return { baselineSample, decisionSample };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Initialize theme class on mount / toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Primary Input States
  const [snapshot, setSnapshot] = useState<FinancialSnapshot>(INITIAL_SNAPSHOT);
  const [decision, setDecision] = useState<DecisionDiff>(INITIAL_DECISION);
  // The random seed is generated ONCE per session (lazy initializer) and stored in config
  // state, so every recompute draws from the same random stream. It is regenerated only by
  // the explicit "Re-run scenarios" action below - never by ordinary edits to
  // snapshot/decision/hazardOverrides, and never by Date.now() falling through inside
  // runSimulation on each call.
  const [config, setConfig] = useState<SimConfig>(() => ({
    ...INITIAL_CONFIG,
    randomSeed: Date.now(),
  }));
  const [hazardOverrides, setHazardOverrides] = useState<Partial<HazardOverrides>>({});

  // UI Interactive States
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number | null>(null);
  const [showIndividualLines, setShowIndividualLines] = useState<boolean>(false);
  const [forkOverrides, setForkOverrides] = useState<Map<string, ScenarioTrajectory>>(new Map());
  const [forkMonth, setForkMonth] = useState<number | null>(null);

  // 150ms Debounced values for expensive recomputation pipeline
  const [debouncedInputs, setDebouncedInputs] = useState({
    snapshot,
    decision,
    config,
    hazardOverrides,
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInputs({
        snapshot,
        decision,
        config,
        hazardOverrides,
      });
    }, 150);

    return () => clearTimeout(handler);
  }, [snapshot, decision, config, hazardOverrides]);

  // Part 9 step 1 - first-load empty state. Evaluated against the DEBOUNCED inputs so the
  // prompt holds until real results exist for the new inputs; this is what makes the
  // walkthrough's "150ms after her last keystroke, the chart appears" literally true.
  const isEmptyInputs =
    debouncedInputs.decision.kind === 'none' ||
    debouncedInputs.snapshot.incomeSources.every((source) => source.monthlyAmount === 0);

  // Step 1: buildDerivedState
  const derivedState = useMemo(() => {
    return buildDerivedState(
      debouncedInputs.snapshot,
      debouncedInputs.decision,
      debouncedInputs.config,
      debouncedInputs.hazardOverrides,
    );
  }, [
    debouncedInputs.snapshot,
    debouncedInputs.decision,
    debouncedInputs.config,
    debouncedInputs.hazardOverrides,
  ]);

  // Step 2: runSimulation
  const paired = useMemo(() => {
    return runSimulation(derivedState);
  }, [derivedState]);

  // Binding invariant: reset selectedScenarioIndex and fork states whenever paired recomputes
  useEffect(() => {
    setSelectedScenarioIndex(null);
    setForkOverrides(new Map());
    setForkMonth(null);
  }, [paired]);

  // Step 3: aggregateResults
  const aggregated = useMemo(() => {
    return aggregateResults(paired);
  }, [paired]);

  // Step 4: sampleForDisplay
  const { baselineSample, decisionSample } = useMemo(() => {
    return sampleForDisplay(paired, 20);
  }, [paired]);

  // Spotlight Scenarios: lowest and highest endingNetWorth decision trajectories
  const { bestScenario, worstScenario } = useMemo(() => {
    if (paired.length === 0) return { bestScenario: null, worstScenario: null };

    let best = paired[0].decision;
    let worst = paired[0].decision;

    for (const pair of paired) {
      if (pair.decision.endingNetWorth > best.endingNetWorth) {
        best = pair.decision;
      }
      if (pair.decision.endingNetWorth < worst.endingNetWorth) {
        worst = pair.decision;
      }
    }

    return { bestScenario: best, worstScenario: worst };
  }, [paired]);

  // Drilldown Trajectory: read from forkOverrides if present, else original decision trajectory
  const activeDrilldownTrajectory = useMemo(() => {
    if (selectedScenarioIndex === null) return null;
    const key = `${selectedScenarioIndex}-decision`;
    const forked = forkOverrides.get(key);
    if (forked) return forked;

    const original = paired.find((p) => p.scenarioIndex === selectedScenarioIndex);
    return original ? original.decision : null;
  }, [selectedScenarioIndex, forkOverrides, paired]);

  // Narrative for the active drilldown trajectory
  const activeNarrative = useMemo(() => {
    if (!activeDrilldownTrajectory) return [];
    return generateNarrative(activeDrilldownTrajectory);
  }, [activeDrilldownTrajectory]);

  // Handlers
  const handleSelectScenario = useCallback((trajectory: ScenarioTrajectory) => {
    setSelectedScenarioIndex(trajectory.scenarioIndex);
  }, []);

  const handleCloseDrilldown = useCallback(() => {
    setSelectedScenarioIndex(null);
  }, []);

  // The ONLY path that regenerates randomSeed: an explicit re-roll of the scenario draw.
  // The functional updater spreads the current config so unrelated fields survive.
  const handleRerunScenarios = useCallback(() => {
    setConfig((current) => ({ ...current, randomSeed: Date.now() }));
  }, []);

  // Populates the form with the walkthrough's example so a first-time user can see a fully
  // populated simulation on demand, without realistic sample numbers being the default state.
  const handleLoadExample = useCallback(() => {
    setSnapshot(structuredClone(EXAMPLE_SNAPSHOT));
    setDecision(structuredClone(EXAMPLE_DECISION));
  }, []);

  const handleForkAtMonth = useCallback(
    (month: number, edits: ForkEditableField[]) => {
      if (!activeDrilldownTrajectory) return;

      const currentCheckpoint = activeDrilldownTrajectory.checkpoints[month];
      if (!currentCheckpoint) return;

      const editedSnapshot = applyForkEdits(currentCheckpoint.snapshot, edits);
      const newTrajectory = forkFromCheckpoint(
        derivedState,
        activeDrilldownTrajectory,
        month,
        editedSnapshot,
      );

      const key = `${activeDrilldownTrajectory.scenarioIndex}-decision`;
      setForkOverrides((prev) => {
        const next = new Map(prev);
        next.set(key, newTrajectory);
        return next;
      });
      setForkMonth(month);
    },
    [activeDrilldownTrajectory, derivedState],
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Financial Twin
                </h1>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Stress-test real life decisions through 12 months of uncertainty
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CalibrationSummaryBadge riskProfile={snapshot.riskProfile} />

            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label="Toggle dark and light theme"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column: fixed 400px input rail on desktop (Part 10 layout grid) */}
          <section
            aria-label="Simulation Inputs"
            className="w-full lg:w-[400px] lg:shrink-0 space-y-6"
          >
            <SnapshotForm snapshot={snapshot} onChange={setSnapshot} />
            <DecisionForm decision={decision} onChange={setDecision} snapshot={snapshot} />
            <SimConfigControl
              config={config}
              onChange={setConfig}
              onRerunScenarios={handleRerunScenarios}
            />
            <AdvancedHazardSettings overrides={hazardOverrides} onChange={setHazardOverrides} />
          </section>

          {/* Right Column: Visualization & Statistics */}
          <section
            aria-label="Simulation Outcomes"
            className="w-full lg:flex-1 min-w-0 space-y-6"
          >
            {isEmptyInputs ? (
              <div
                data-testid="results-empty-state"
                className="card-surface rounded-2xl p-10 text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Layers className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  Nothing to simulate yet
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Fill in your numbers and a decision to see how it plays out.
                </p>
                <button
                  type="button"
                  onClick={handleLoadExample}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                >
                  Load example data
                </button>
              </div>
            ) : (
              <>
                <ComparisonFanChart
                  baselineBands={aggregated.baselineBands}
                  decisionBands={aggregated.decisionBands}
                  showIndividualLines={showIndividualLines}
                  individualBaselineSample={baselineSample}
                  individualDecisionSample={decisionSample}
                  onToggleIndividualLines={() => setShowIndividualLines(!showIndividualLines)}
                  onSelectScenario={handleSelectScenario}
                />

                <FrequencyStatCards stats={aggregated.stats} />

                <ScenarioSpotlightCards
                  bestScenario={bestScenario}
                  worstScenario={worstScenario}
                  onSelectScenario={handleSelectScenario}
                />
              </>
            )}
          </section>
        </div>
      </main>

      {/* Drilldown Modal (When a scenario is selected) */}
      {selectedScenarioIndex !== null && activeDrilldownTrajectory && (
        <ScenarioDrilldown
          trajectory={activeDrilldownTrajectory}
          narrative={activeNarrative}
          onForkAtMonth={handleForkAtMonth}
          onClose={handleCloseDrilldown}
          forkMonth={forkMonth}
        />
      )}
    </div>
  );
}
