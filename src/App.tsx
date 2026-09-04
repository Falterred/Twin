import { useState, useEffect, useMemo } from 'react';

// Engine
import {
  DEFAULT_RAW_INPUTS,
  buildDerivedState,
  type RawInputs,
  type SimMode,
  type RiskProfile,
} from './engine/constants';
import { evaluateAllDeterministic } from './engine/scoring';
import { evaluateAllProbabilistic } from './engine/probabilistic';
import { findCounterfactual } from './engine/counterfactual';

// Components
import { Header } from './components/Header';
import { CalibrationModal } from './components/CalibrationModal';
import { ConstraintPanel } from './components/ConstraintPanel';
import { ModeToggle } from './components/ModeToggle';
import { TimelineChart } from './components/TimelineChart';
import { RankedActionList } from './components/RankedActionList';
import { CounterfactualNote } from './components/CounterfactualNote';

export default function App() {
  // 1. Top-Level State Management
  const [inputs, setInputs] = useState<RawInputs>(DEFAULT_RAW_INPUTS);
  const [debouncedInputs, setDebouncedInputs] = useState<RawInputs>(DEFAULT_RAW_INPUTS);
  const [mode, setMode] = useState<SimMode>('deterministic');
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);

  // Theme state
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true; // default dark
  });

  // Theme toggle effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Debounce inputs for heavy calculations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInputs(inputs);
    }, 120);
    return () => clearTimeout(timer);
  }, [inputs]);

  const handleInputChange = (patch: Partial<RawInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveProfile = (profile: RiskProfile) => {
    setInputs((prev) => ({ ...prev, riskProfile: profile }));
    setIsCalibrationOpen(false);
  };

  // 2. Unidirectional Memoized Computation Pipeline

  // Guarded evaluation block to prevent React crashes on invalid states
  const {
    derivedState,
    deterministicResults,
    probabilisticResults,
    counterfactual,
    error
  } = useMemo(() => {
    try {
      const derived = buildDerivedState(debouncedInputs, debouncedInputs.riskProfile);

      const detResults = evaluateAllDeterministic(derived);

      const probResults = mode === 'probabilistic'
        ? evaluateAllProbabilistic(derived)
        : undefined;

      const cfResult = findCounterfactual(derived, detResults);

      return {
        derivedState: derived,
        deterministicResults: detResults,
        probabilisticResults: probResults,
        counterfactual: cfResult,
        error: null
      };
    } catch (err) {
      console.error("Simulation error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        let friendlyError = 'We could not calculate this scenario. Please review your financial inputs.';
        if (errorMessage.includes('must be a finite number')) {
          friendlyError = 'Enter a valid number for each financial input.';
        } else if (errorMessage.includes('Financial inputs must use non-negative values')) {
          friendlyError = 'Financial inputs cannot be negative, and EMI tenure must be a whole number.';
        } else if (errorMessage.includes('Unknown risk profile')) {
          friendlyError = 'Choose a supported risk profile and try again.';
        } else if (errorMessage.includes('EMI inputs must be finite')) {
          friendlyError = 'Check the EMI interest rate and tenure values.';
        } else if (errorMessage.includes('Income and expense overrides')) {
          friendlyError = 'The monthly income and expense timeline must contain 13 valid values.';
        } else if (errorMessage.includes('Monte Carlo runs')) {
          friendlyError = 'The uncertainty simulation could not use the requested run count.';
        }

        return {
          derivedState: null,
          deterministicResults: [],
          probabilisticResults: undefined,
          counterfactual: null,
          error: friendlyError
        };
    }
  }, [debouncedInputs, mode]);

  const activeResults = mode === 'probabilistic' && probabilisticResults
    ? probabilisticResults
    : deterministicResults;

  // 3. Responsive Grid Layout
  return (
    <div className="min-h-screen flex flex-col relative transition-colors duration-300">
      <Header
        riskProfile={inputs.riskProfile}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6">

        {/* Left Column: Constraints */}
        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0">
          <ConstraintPanel inputs={inputs} onChange={handleInputChange} />
        </div>

        {/* Right Column: Visualization & Results */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          <div className="flex items-center justify-between flex-wrap gap-4">
            <ModeToggle mode={mode} onChange={setMode} />

            {/* Active Strategy Badge (optional extra info) */}
            {activeResults && activeResults.length > 0 && !activeResults[0].disqualified && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Top Strategy:</span>
                <span className="text-xs font-bold" style={{ color: activeResults[0].color }}>
                  {activeResults[0].label}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              <strong>Error calculating simulation:</strong> {error}
            </div>
          )}

          <TimelineChart
            mode={mode}
            deterministicResults={deterministicResults}
            probabilisticResults={probabilisticResults}
            emergencyFundTarget={derivedState?.emergencyFundTargetRs ?? 0}
          />

          <CounterfactualNote result={counterfactual} mode={mode} />

          <RankedActionList mode={mode} results={activeResults} />
        </div>
      </main>

      {/* Modal Portal */}
      {isCalibrationOpen && (
        <CalibrationModal
          currentProfile={inputs.riskProfile}
          onSave={handleSaveProfile}
          onClose={() => setIsCalibrationOpen(false)}
        />
      )}
    </div>
  );
}
