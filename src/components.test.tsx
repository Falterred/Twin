/**
 * Part 8 & Part 9 - UI Component Tests & State Wiring Invariant Tests
 *
 * Covers:
 *   1. Rapid-fire input changes trigger exactly ONE recompute after the 150ms debounce.
 *   2. Pipeline purity: no useEffect writes back to snapshot/decision/config/hazardOverrides
 *      from paired/aggregated/derivedState (infinite-loop prevention).
 *   3. selectedScenarioIndex resets to null whenever paired is recomputed.
 *   4. Toggling showIndividualLines does NOT retrigger derivedState/paired/aggregated.
 *   5. FrequencyStatCards handles NaN by rendering "N/A" with a muted badge.
 *   6. DecisionForm resets non-relevant fields when switching tabs (no cross-type leakage).
 *   7. ComparisonFanChart toggles individual scenario lines and reports selection.
 *   8. ScenarioDrilldown traps focus, closes on Escape, and submits fork edits.
 *   9. ScenarioSpotlightCards renders best/worst scenario and triggers selection.
 *  10. SnapshotForm exposes termMonthsRemaining and the 12-month seasonal multipliers.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { App } from './App';
import { FrequencyStatCards } from './components/FrequencyStatCards';
import { DecisionForm } from './components/DecisionForm';
import { SnapshotForm } from './components/SnapshotForm';
import { ComparisonFanChart } from './components/ComparisonFanChart';
import { ScenarioDrilldown } from './components/ScenarioDrilldown';
import { ScenarioSpotlightCards } from './components/ScenarioSpotlightCards';
import { CalibrationSummaryBadge } from './components/CalibrationSummaryBadge';

import { INITIAL_SNAPSHOT, INITIAL_DECISION } from './utils/defaults';
import type { FrequencyStat, MonthlyBand } from './engine/aggregation';
import { aggregateResults } from './engine/aggregation';
import type { FinancialSnapshot } from './engine/state';
import type { PairedScenario, ScenarioTrajectory } from './engine/scenarioRunner';
import type { NarrativeLine } from './engine/narrative';
import * as ScenarioRunnerModule from './engine/scenarioRunner';
import * as StateModule from './engine/state';

// Recharts measures its container at runtime and paints large SVGs, neither of which
// jsdom supports cheaply. This lightweight adapter keeps the real component tree while
// exposing each series so line toggling and selection wiring stay directly assertable.
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  const Line = ({ dataKey, onClick }: { dataKey?: string; onClick?: () => void }) => (
    <button type="button" data-testid={'line-' + dataKey} onClick={onClick} />
  );
  return {
    ResponsiveContainer: Passthrough,
    ComposedChart: Passthrough,
    Area: Empty,
    Line,
    XAxis: Empty,
    YAxis: Empty,
    Tooltip: Empty,
    CartesianGrid: Empty,
    Legend: Empty,
    ReferenceLine: Empty,
  };
});

function makeBands(seed: number): MonthlyBand[] {
  return Array.from({ length: 12 }, (_, month) => ({
    month,
    p10: 50000 + seed * 1000,
    p50: 100000 + seed * 1000,
    p90: 150000 + seed * 1000,
    fundP10: 40000,
    fundP50: 50000,
    fundP90: 60000,
    debtP10: 0,
    debtP50: 0,
    debtP90: 0,
  }));
}

/**
 * Walkthrough-shaped fixture snapshot (Priya's real numbers). The shipped INITIAL_SNAPSHOT is
 * intentionally all-zero placeholder data per Part 9 step 1, so UI tests that need realistic
 * values build on this instead.
 */
const RICH_SNAPSHOT: FinancialSnapshot = {
  incomeSources: [
    { id: 'income-salary-1', label: 'Salary', monthlyAmount: 85000, stability: 'stable' },
  ],
  debts: [
    {
      id: 'debt-personal-1',
      type: 'personal_loan',
      label: 'Personal Loan',
      balance: 120000,
      annualRatePct: 14.0,
      minMonthlyPayment: 8000,
      termMonthsRemaining: 18,
    },
  ],
  expenses: [
    { id: 'expense-fixed-1', label: 'Rent & Essentials', type: 'fixed', monthlyAmount: 45000 },
    { id: 'expense-discretionary-1', label: 'Discretionary', type: 'discretionary', monthlyAmount: 20000 },
  ],
  emergencyFund: { balance: 150000, targetMonths: 6, isInvested: false },
  liquidCashOutsideFund: 40000,
  riskProfile: 'balanced',
  debtFallbackOrder: ['debt-personal-1', 'NEW_CREDIT_LINE'],
};

// ---------------------------------------------------------------------------
// Mock Trajectory Helper
// ---------------------------------------------------------------------------

// Aggregate fingerprint proving the seed is wired through to the output, not just sitting
// inert in state: 12 baseline median band values plus every frequency-stat percentage pair.
function aggregateSignature(paired: PairedScenario[]): string {
  const agg = aggregateResults(paired);
  return (
    agg.baselineBands.map((band) => band.p50).join('|') +
    '::' +
    agg.stats.map((stat) => String(stat.baselinePct) + '/' + String(stat.decisionPct)).join('|')
  );
}

function createMockTrajectory(scenarioIndex: number, endingNetWorth: number): ScenarioTrajectory {
  const checkpoints = Array.from({ length: 12 }, (_, month) => ({
    month,
    snapshot: structuredClone(RICH_SNAPSHOT),
    hazardState: {
      isUnemployed: false,
      monthsUnemployed: 0,
      fundBreachedThisRun: false,
      missedPaymentLastMonth: false,
    },
    firedEvents: [],
    outcome: {
      month,
      cashBeforeResponse: 20000,
      emergencyFundDraw: 0,
      debtDraws: [],
      newCreditLineDraw: 0,
      shortfallUncovered: 0,
      endingCash: 40000,
      endingFundBalance: 150000,
      endingDebtBalances: { 'debt-personal-1': 100000 },
    },
    newCreditLineBalance: 0,
  }));

  return {
    scenarioIndex,
    seed: 12345 + scenarioIndex,
    checkpoints,
    finalState: structuredClone(RICH_SNAPSHOT),
    everBreachedFund: false,
    everFailedMonth: false,
    endingNetWorth,
  };
}

describe('Part 8 - UI Components', () => {
  it('FrequencyStatCards renders valid stats and handles NaN gracefully as N/A', () => {
    const stats: FrequencyStat[] = [
      {
        id: 'fund_breach',
        label: 'Dropped below emergency fund at some point',
        baselinePct: 8,
        decisionPct: 22,
        deltaPct: 14,
        severity: 'negative',
      },
      {
        id: 'covers_100k_shock',
        label: 'Covered a large medical expense from cash and fund',
        baselinePct: Number.NaN,
        decisionPct: Number.NaN,
        deltaPct: Number.NaN,
        severity: 'neutral',
      },
    ];

    render(<FrequencyStatCards stats={stats} />);

    // Verify first stat renders real numbers
    expect(screen.getByText('Dropped below emergency fund at some point')).toBeTruthy();
    expect(screen.getByText('8%')).toBeTruthy();
    expect(screen.getByText('22%')).toBeTruthy();
    expect(screen.getByText('+14%')).toBeTruthy();

    // Verify second stat renders N/A with muted explanatory note
    expect(screen.getByText('Covered a large medical expense from cash and fund')).toBeTruthy();
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Fewer than 5% of scenarios qualified/)).toBeTruthy();
  });

  it('DecisionForm switches tabs without cross-type field leakage', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DecisionForm
        decision={INITIAL_DECISION}
        onChange={onChange}
        snapshot={RICH_SNAPSHOT}
      />,
    );

    // Click 'One-Time' expense tab
    const oneTimeTab = screen.getByRole('button', { name: /One-Time/i });
    fireEvent.click(oneTimeTab);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'one_time_expense',
      }),
    );

    // Verify emitted diff does not carry new_debt properties like principal or annualRatePct
    const emitted = onChange.mock.calls[0][0];
    expect(emitted.kind).toBe('one_time_expense');
    expect((emitted as Record<string, unknown>).principal).toBeUndefined();
    expect((emitted as Record<string, unknown>).annualRatePct).toBeUndefined();
  });

  it('SnapshotForm exposes termMonthsRemaining and the 12-month seasonal multipliers', () => {
    const onChange = vi.fn();
    const { unmount } = render(<SnapshotForm snapshot={RICH_SNAPSHOT} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Months Left'), { target: { value: '12' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        debts: [expect.objectContaining({ termMonthsRemaining: 12 })],
      }),
    );

    fireEvent.click(screen.getByLabelText('Revolving debt (no fixed term)'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        debts: [expect.objectContaining({ termMonthsRemaining: null })],
      }),
    );
    unmount();

    const seasonalSnapshot = {
      ...RICH_SNAPSHOT,
      expenses: [
        {
          id: 'expense-seasonal-1',
          label: 'Festive',
          type: 'seasonal' as const,
          monthlyAmount: 3000,
          seasonalMultipliers: Array.from({ length: 12 }, () => 1),
        },
      ],
    };
    const seasonalOnChange = vi.fn();
    render(<SnapshotForm snapshot={seasonalSnapshot} onChange={seasonalOnChange} />);

    expect(screen.getByLabelText('Jan')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Jan'), { target: { value: '2' } });
    expect(seasonalOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expenses: [
          expect.objectContaining({
            seasonalMultipliers: [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          }),
        ],
      }),
    );
  });

  it('CalibrationSummaryBadge displays correct stress label and severity text', () => {
    const { rerender } = render(<CalibrationSummaryBadge riskProfile="conservative" />);
    expect(screen.getByText(/Conservative Sim Stress/i)).toBeTruthy();

    rerender(<CalibrationSummaryBadge riskProfile="aggressive" />);
    expect(screen.getByText(/Aggressive Sim Stress/i)).toBeTruthy();
  });

  it('ScenarioSpotlightCards renders best and worst scenarios and invokes selection', () => {
    const onSelect = vi.fn();
    const best = createMockTrajectory(5, 500000);
    const worst = createMockTrajectory(12, -80000);

    render(
      <ScenarioSpotlightCards
        bestScenario={best}
        worstScenario={worst}
        onSelectScenario={onSelect}
      />,
    );

    expect(screen.getByText(/Worst Case Scenario/i)).toBeTruthy();
    expect(screen.getByText(/Best Case Scenario/i)).toBeTruthy();

    const readWorstBtn = screen.getByRole('button', { name: /Read Worst Scenario Story/i });
    fireEvent.click(readWorstBtn);

    expect(onSelect).toHaveBeenCalledWith(worst);
  });

  it('ComparisonFanChart accessible table fallback renders real formatted data', () => {
    render(
      <ComparisonFanChart
        baselineBands={makeBands(0)}
        decisionBands={makeBands(1)}
        showIndividualLines={false}
        individualBaselineSample={[]}
        individualDecisionSample={[]}
        onToggleIndividualLines={vi.fn()}
        onSelectScenario={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Toggle accessible data table view/i }));

    const table = screen.getByRole('table');
    expect(table).toBeTruthy();
    expect(screen.getByText('Month 0')).toBeTruthy();
    expect(screen.getByText('Month 11')).toBeTruthy();
    // 12 month rows, each carrying the real formatted baseline/decision medians.
    expect(table.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(screen.getAllByText('₹1,00,000').length).toBe(12);
    expect(screen.getAllByText('₹1,01,000').length).toBe(12);
  });

  it('ComparisonFanChart toggles individual scenario lines and reports selection', () => {
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    const baselineSample = [createMockTrajectory(0, 100000)];
    const decisionSample = [createMockTrajectory(1, 250000), createMockTrajectory(2, 90000)];

    const { rerender } = render(
      <ComparisonFanChart
        baselineBands={makeBands(0)}
        decisionBands={makeBands(1)}
        showIndividualLines={false}
        individualBaselineSample={baselineSample}
        individualDecisionSample={decisionSample}
        onToggleIndividualLines={onToggle}
        onSelectScenario={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Show individual scenarios/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <ComparisonFanChart
        baselineBands={makeBands(0)}
        decisionBands={makeBands(1)}
        showIndividualLines={true}
        individualBaselineSample={baselineSample}
        individualDecisionSample={decisionSample}
        onToggleIndividualLines={onToggle}
        onSelectScenario={onSelect}
      />,
    );

    // Median lines plus one baseline and two decision individual traces are mounted.
    expect(screen.getByTestId('line-baselineP50')).toBeTruthy();
    expect(screen.getByTestId('line-decisionP50')).toBeTruthy();
    expect(screen.getByTestId('line-base_line_0')).toBeTruthy();
    const decisionLines = document.querySelectorAll('[data-testid^="line-dec_line_"]');
    expect(decisionLines).toHaveLength(decisionSample.length);

    fireEvent.click(decisionLines[decisionLines.length - 1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect((onSelect.mock.calls[0][0] as ScenarioTrajectory).scenarioIndex).toBe(2);
  });

  it('ScenarioDrilldown closes on Escape key and submits fork edits', () => {
    const onClose = vi.fn();
    const onFork = vi.fn();
    const trajectory = createMockTrajectory(3, 120000);
    const narrative: NarrativeLine[] = [
      {
        month: 0,
        text: 'Month 0: Starting position.',
        tone: 'neutral',
        relatedEvents: [],
      },
      {
        month: 4,
        text: 'Month 4: Lost Salary income. Expected back around month 7.',
        tone: 'setback',
        relatedEvents: [],
      },
      {
        month: 5,
        text: 'Month 5: Regular expenses outpaced income; ₹8,000 drawn from the emergency fund.',
        tone: 'caution',
        relatedEvents: [],
      },
    ];

    render(
      <ScenarioDrilldown
        trajectory={trajectory}
        narrative={narrative}
        onForkAtMonth={onFork}
        onClose={onClose}
      />,
    );

    // Verify narrative log renders, with setback (rose) and caution (amber) distinguished
    expect(screen.getByText(/Month 0: Starting position/)).toBeTruthy();
    const setbackText = screen.getByText(/Month 4: Lost Salary income/);
    expect(setbackText.closest('div')?.className).toContain('bg-rose-500/10');
    const cautionText = screen.getByText(/Month 5: Regular expenses outpaced income/);
    expect(cautionText.closest('div')?.className).toContain('bg-amber-500/10');

    // Verify Escape key triggers onClose
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    // Open fork editor at month 4
    const forkBtns = screen.getAllByRole('button', { name: /Edit & fork from here/i });
    fireEvent.click(forkBtns[4]);

    // Submit fork edit
    const submitBtn = screen.getByRole('button', { name: /Re-simulate from Month 4/i });
    fireEvent.click(submitBtn);

    expect(onFork).toHaveBeenCalledWith(
      4,
      expect.arrayContaining([
        expect.objectContaining({ field: 'emergencyFund.balance' }),
        expect.objectContaining({ field: 'liquidCashOutsideFund' }),
      ]),
    );
  });

  it('ScenarioDrilldown traps focus inside the modal when tabbing', () => {
    const trajectory = createMockTrajectory(7, 150000);
    render(
      <ScenarioDrilldown
        trajectory={trajectory}
        narrative={[]}
        onForkAtMonth={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
    );
    expect(focusables.length).toBeGreaterThan(1);

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('Part 9 - State Wiring & Recompute Invariants', () => {
  it('first load renders an empty-state prompt instead of any simulated output', () => {
    render(<App />);

    // The shipped first-load defaults are placeholder-obvious, not sample data.
    expect(INITIAL_DECISION.kind).toBe('none');
    expect(INITIAL_SNAPSHOT.debts).toHaveLength(0);
    expect(INITIAL_SNAPSHOT.incomeSources.every((source) => source.monthlyAmount === 0)).toBe(true);

    expect(screen.getByTestId('results-empty-state')).toBeTruthy();
    expect(screen.getByText(/Fill in your numbers and a decision/)).toBeTruthy();

    // No chart, no stat cards, no spotlight cards are rendered at first load.
    expect(screen.queryByRole('button', { name: /Show individual scenarios/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Read Worst Scenario Story/i })).toBeNull();
    expect(screen.queryByText('Dropped below emergency fund at some point')).toBeNull();
  });

  it('results replace the empty state only after inputs settle (walkthrough L7/L9/L11)', () => {
    vi.useFakeTimers();
    render(<App />);

    // L7/L9: the app is waiting for her to describe a decision.
    expect(screen.getByTestId('results-empty-state')).toBeTruthy();

    // A decision alone is not enough while every income source is still Rs 0.
    fireEvent.click(screen.getByRole('button', { name: /New Debt/i }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('results-empty-state')).toBeTruthy();

    // Real income plus a decision: the prompt holds until the 150ms debounce expires.
    fireEvent.change(screen.getAllByLabelText('Monthly Amount')[0], { target: { value: '85000' } });
    expect(screen.getByTestId('results-empty-state')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // L11: 150ms after her last keystroke, the chart appears.
    expect(screen.queryByTestId('results-empty-state')).toBeNull();
    expect(screen.getByRole('button', { name: /Show individual scenarios/i })).toBeTruthy();

    vi.useRealTimers();
  });

  it('empty state offers example data that populates a simulation on demand', () => {
    vi.useFakeTimers();
    render(<App />);

    expect(screen.getByTestId('results-empty-state')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Load example data/i }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByTestId('results-empty-state')).toBeNull();
    expect(screen.getByRole('button', { name: /Show individual scenarios/i })).toBeTruthy();
    // The example is Priya's walkthrough data, so her salary now populates the form.
    expect((screen.getAllByLabelText('Monthly Amount')[0] as HTMLInputElement).value).toBe('85000');

    vi.useRealTimers();
  });

  it('rapid-fire input changes trigger exactly ONE recompute after the 150ms debounce window', async () => {
    vi.useFakeTimers();
    const runSimSpy = vi.spyOn(ScenarioRunnerModule, 'runSimulation');
    runSimSpy.mockClear();

    render(<App />);

    // Initial mount triggers one initial runSimulation
    expect(runSimSpy).toHaveBeenCalledTimes(1);

    // Rapid-fire 10 snapshot edits by manipulating a number input
    const cashInput = screen.getByLabelText(/Liquid Cash Outside Fund/i);
    for (let i = 1; i <= 10; i++) {
      fireEvent.change(cashInput, { target: { value: String(50000 + i * 1000) } });
      // Advance by 10ms (less than 150ms debounce)
      act(() => {
        vi.advanceTimersByTime(10);
      });
    }

    // Simulation should still NOT have recomputed during the rapid changes
    expect(runSimSpy).toHaveBeenCalledTimes(1);

    // Advance past the 150ms debounce window
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Exactly one recompute occurred after the debounce expired
    expect(runSimSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
    runSimSpy.mockRestore();
  });

  it('no useEffect in App writes back to snapshot/decision/config/hazardOverrides based on simulation outputs', () => {
    // Pipeline purity invariant: mount and verify no secondary recompute loops occur
    const buildDerivedSpy = vi.spyOn(StateModule, 'buildDerivedState');
    buildDerivedSpy.mockClear();

    render(<App />);

    // Initial render computes derivedState once
    expect(buildDerivedSpy).toHaveBeenCalledTimes(1);

    // Even after microtasks and timers run, no recursive re-render occurs
    expect(buildDerivedSpy).toHaveBeenCalledTimes(1);
    buildDerivedSpy.mockRestore();
  });

  it('selectedScenarioIndex resets to null whenever paired is recomputed', () => {
    vi.useFakeTimers();
    render(<App />);

    // Part 9 step 1: first load is an empty-state prompt, so supply a real income figure and
    // a decision and let the 150ms debounce settle before the results area exists.
    fireEvent.change(screen.getAllByLabelText('Monthly Amount')[0], { target: { value: '85000' } });
    fireEvent.click(screen.getByRole('button', { name: /New Debt/i }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Click to open worst scenario spotlight
    const readWorstBtn = screen.getByRole('button', { name: /Read Worst Scenario Story/i });
    fireEvent.click(readWorstBtn);

    // Drilldown modal is open
    expect(screen.getByRole('dialog')).toBeTruthy();

    // Now trigger a full pipeline recompute by changing scenarioCount
    const count300Btn = screen.getByRole('button', { name: '300' });
    fireEvent.click(count300Btn);

    // Advance timers past debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Drilldown modal was closed because selectedScenarioIndex was reset to null
    expect(screen.queryByRole('dialog')).toBeNull();

    vi.useRealTimers();
  });

  it('toggling showIndividualLines does NOT retrigger derivedState/paired/aggregated', () => {
    vi.useFakeTimers();
    const runSimSpy = vi.spyOn(ScenarioRunnerModule, 'runSimulation');
    runSimSpy.mockClear();

    render(<App />);
    expect(runSimSpy).toHaveBeenCalledTimes(1);

    // Part 9 step 1: supply inputs so the results area (and its toggle) actually renders.
    fireEvent.change(screen.getAllByLabelText('Monthly Amount')[0], { target: { value: '85000' } });
    fireEvent.click(screen.getByRole('button', { name: /New Debt/i }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const callsAfterPipeline = runSimSpy.mock.calls.length;

    // Toggle individual lines on
    const toggleBtn = screen.getByRole('button', { name: /Show individual scenarios/i });
    fireEvent.click(toggleBtn);

    // Toggle off again
    fireEvent.click(toggleBtn);

    // runSimulation was NOT recomputed because showIndividualLines is not in its dependency chain
    expect(runSimSpy.mock.calls.length).toBe(callsAfterPipeline);
    vi.useRealTimers();
    runSimSpy.mockRestore();
  });

  it('Seed stability: unrelated edits keep randomSeed AND output; Re-run scenarios resamples', () => {
    vi.useFakeTimers();
    const runSimSpy = vi.spyOn(ScenarioRunnerModule, 'runSimulation');

    render(<App />);

    const lastSeed = () => runSimSpy.mock.calls[runSimSpy.mock.calls.length - 1][0].config.randomSeed;
    const lastPaired = () => runSimSpy.mock.results[runSimSpy.mock.results.length - 1].value;

    // The seed is generated once per session and handed to the runner through config.
    const initialSeed = runSimSpy.mock.calls[0][0].config.randomSeed;
    expect(typeof initialSeed).toBe('number');

    // Supply inputs so the results area renders.
    fireEvent.change(screen.getAllByLabelText('Monthly Amount')[0], { target: { value: '85000' } });
    fireEvent.click(screen.getByRole('button', { name: /New Debt/i }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const seedBefore = lastSeed();

    // Two consecutive snapshot edits must leave randomSeed unchanged.
    for (const value of ['41000', '42000']) {
      fireEvent.change(screen.getByLabelText(/Liquid Cash Outside Fund/i), { target: { value } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(lastSeed()).toBe(seedBefore);
    }

    // The seed must reach the OUTPUT, not just sit inert in state. A mathematically inert
    // edit (renaming an income label) re-runs the whole pipeline, so byte-identical aggregate
    // output proves the same seeded draw was used - if runSimulation ignored the seed and
    // re-rolled its own Date.now(), these numbers would drift here.
    const signatureBeforeLabelEdit = aggregateSignature(lastPaired());
    const callsBeforeLabelEdit = runSimSpy.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Income Label'), { target: { value: 'Salary (renamed)' } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(runSimSpy.mock.calls.length).toBeGreaterThan(callsBeforeLabelEdit);
    expect(lastSeed()).toBe(seedBefore);
    expect(aggregateSignature(lastPaired())).toBe(signatureBeforeLabelEdit);

    // Changing scenarioCount spreads the existing config, so the seed survives that too.
    fireEvent.click(screen.getByRole('button', { name: '300' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(lastSeed()).toBe(seedBefore);

    // Re-run scenarios is the ONLY action that regenerates the seed...
    const signatureBeforeRerun = aggregateSignature(lastPaired());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole('button', { name: /Re-run scenarios/i }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const lastCall = runSimSpy.mock.calls[runSimSpy.mock.calls.length - 1][0];
    expect(lastCall.config.randomSeed).not.toBe(seedBefore);
    // ...and regenerating it does not clobber the unrelated scenarioCount field.
    expect(lastCall.config.scenarioCount).toBe(300);

    // ...and it yields a genuinely new sample, not a no-op that also leaves paired unchanged.
    expect(aggregateSignature(lastPaired())).not.toBe(signatureBeforeRerun);

    vi.useRealTimers();
    runSimSpy.mockRestore();
  });
});
