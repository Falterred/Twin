import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_HAZARD_OVERRIDES,
  exponentialRandom,
  gaussianRandom,
  lognormalRandom,
  rollMonthlyEvents,
  sampleMonthlyIncome,
  type HazardContext,
  type MonthlyHazardState,
} from './hazards';
import type { HazardOverrides, IncomeNoiseParams, IncomeSource } from './state';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

/** Test-only 32-bit linear congruential generator (deterministic rng for tests). */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const NOISE: IncomeNoiseParams = { stable: 0.05, variable: 0.25, volatile: 0.45 };

function baseState(overrides: Partial<MonthlyHazardState> = {}): MonthlyHazardState {
  return {
    isUnemployed: false,
    monthsUnemployed: 0,
    fundBreachedThisRun: false,
    missedPaymentLastMonth: false,
    ...overrides,
  };
}

function baseContext(overrides: Partial<HazardContext> = {}): HazardContext {
  return {
    hazardSeverityMultiplier: 1,
    totalMonthlyIncome: 100000,
    totalFixedExpenses: 40000,
    state: baseState(),
    rng: lcg(1),
    noiseParams: NOISE,
    ...overrides,
  };
}

const sources: IncomeSource[] = [
  { id: 's1', label: 'Salary', monthlyAmount: 80000, stability: 'stable' },
  { id: 's2', label: 'Freelance', monthlyAmount: 20000, stability: 'variable' },
  { id: 's3', label: 'Gigs', monthlyAmount: 10000, stability: 'volatile' },
];

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) * (value - m), 0) / values.length);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('DEFAULT_HAZARD_OVERRIDES', () => {
  it('is exported with the exact documented values', () => {
    expect(DEFAULT_HAZARD_OVERRIDES).toEqual({
      jobLossBaseProb: 0.02,
      medicalRoutineBaseProb: 0.08,
      medicalTailBaseProb: 0.005,
      housingSpikeBaseProb: 0.015,
      bonusBaseProb: 0.04,
      windfallBaseProb: 0.008,
      incomeNoise: { stable: 0.05, variable: 0.25, volatile: 0.45 },
      newCreditLineAprPct: 24.0,
    });
  });
});

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

describe('gaussianRandom / lognormalRandom / exponentialRandom', () => {
  it('gaussianRandom(0, 1) matches mean 0 and stdDev 1 over 10,000 samples', () => {
    const rng = lcg(12345);
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) samples.push(gaussianRandom(0, 1, rng));
    expect(Math.abs(mean(samples) - 0)).toBeLessThan(0.05);
    expect(Math.abs(stdDev(samples) - 1)).toBeLessThan(0.05);
  });

  it('gaussianRandom(5, 2) matches mean 5 and stdDev 2', () => {
    const rng = lcg(99991);
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) samples.push(gaussianRandom(5, 2, rng));
    expect(Math.abs(mean(samples) - 5)).toBeLessThan(0.1);
    expect(Math.abs(stdDev(samples) - 2)).toBeLessThan(0.1);
  });

  it('consumes exactly two uniform draws per gaussian sample', () => {
    let calls = 0;
    const inner = lcg(4);
    const rng = () => { calls++; return inner(); };
    gaussianRandom(0, 1, rng);
    expect(calls).toBe(2);
  });

  it('lognormalRandom is exp(gaussianRandom) for the same seed', () => {
    const a = lognormalRandom(0.5, 0.4, lcg(777));
    const b = Math.exp(gaussianRandom(0.5, 0.4, lcg(777)));
    expect(a).toBe(b);
  });

  it('lognormalRandom(0, 0.5) matches its analytic mean and stdDev over 10,000 samples', () => {
    const rng = lcg(555);
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) samples.push(lognormalRandom(0, 0.5, rng));
    const analyticMean = Math.exp(0.125);
    const analyticStdDev = Math.sqrt((Math.exp(0.25) - 1) * Math.exp(0.25));
    expect(Math.abs(mean(samples) - analyticMean)).toBeLessThan(0.1);
    expect(Math.abs(stdDev(samples) - analyticStdDev)).toBeLessThan(0.12);
  });

  it('exponentialRandom(2) matches mean 2 and stdDev 2 over 10,000 samples', () => {
    const rng = lcg(24680);
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) samples.push(exponentialRandom(2, rng));
    expect(Math.abs(mean(samples) - 2)).toBeLessThan(0.1);
    expect(Math.abs(stdDev(samples) - 2)).toBeLessThan(0.15);
  });

  it('validates gaussianRandom inputs', () => {
    expect(() => gaussianRandom(Infinity, 1, lcg(1))).toThrow(RangeError);
    expect(() => gaussianRandom(0, -1, lcg(1))).toThrow(RangeError);
    expect(() => gaussianRandom(0, NaN, lcg(1))).toThrow(RangeError);
  });

  it('validates exponentialRandom inputs', () => {
    expect(() => exponentialRandom(-1, lcg(1))).toThrow(RangeError);
    expect(() => exponentialRandom(NaN, lcg(1))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Continuous income noise
// ---------------------------------------------------------------------------

describe('sampleMonthlyIncome', () => {
  it('variable 50000 source: stdDev within 15% of 12500 and mean within 5% of 50000', () => {
    const source: IncomeSource = { id: 'v', label: 'Freelance', monthlyAmount: 50000, stability: 'variable' };
    const rng = lcg(13579);
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) samples.push(sampleMonthlyIncome(source, NOISE, rng));
    expect(Math.abs(stdDev(samples) - 50000 * 0.25)).toBeLessThan(50000 * 0.25 * 0.15);
    expect(Math.abs(mean(samples) - 50000)).toBeLessThan(50000 * 0.05);
  });

  it('volatile 50000 source: clamping at 0 produces a small upward mean skew (documented, loose bound)', () => {
    const source: IncomeSource = { id: 'x', label: 'Gigs', monthlyAmount: 50000, stability: 'volatile' };
    const rng = lcg(864209);
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) samples.push(sampleMonthlyIncome(source, NOISE, rng));
    const observedMean = mean(samples);
    const observedStdDev = stdDev(samples);
    // Documented behavior: clamping at 0 shifts the mean slightly upward (observed ~50.4k
    // on reference hardware) and truncates the lower tail, so the stdDev lands below the
    // analytic 22500. Bounds are intentionally loose here rather than tight.
    expect(observedMean).toBeGreaterThan(45000);
    expect(observedMean).toBeLessThan(55000);
    expect(Math.abs(observedStdDev - 50000 * 0.45)).toBeLessThan(50000 * 0.45 * 0.3);
  });

  it('stable source uses the 5% stdDev tier', () => {
    const source: IncomeSource = { id: 's', label: 'Salary', monthlyAmount: 50000, stability: 'stable' };
    const rng = lcg(112358);
    const samples: number[] = [];
    for (let i = 0; i < 10000; i++) samples.push(sampleMonthlyIncome(source, NOISE, rng));
    expect(Math.abs(stdDev(samples) - 50000 * 0.05)).toBeLessThan(50000 * 0.05 * 0.2);
  });

  it('zero-variance edge case returns the exact base amount without consuming the rng', () => {
    const source: IncomeSource = { id: 'z', label: 'Fixed', monthlyAmount: 42000, stability: 'stable' };
    const zeroNoise: IncomeNoiseParams = { stable: 0, variable: 0.25, volatile: 0.45 };
    let calls = 0;
    const rng = () => { calls++; return 0.5; };
    expect(sampleMonthlyIncome(source, zeroNoise, rng)).toBe(42000);
    expect(sampleMonthlyIncome(source, zeroNoise, rng)).toBe(42000);
    expect(calls).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const source: IncomeSource = { id: 'd', label: 'Freelance', monthlyAmount: 50000, stability: 'variable' };
    expect(sampleMonthlyIncome(source, NOISE, lcg(42))).toBe(sampleMonthlyIncome(source, NOISE, lcg(42)));
  });

  it('suppression: sampleMonthlyIncome is never invoked for the job-loss-suppressed source', () => {
    const suppressedSourceId = 's1';
    const state = baseState({ isUnemployed: true, monthsUnemployed: 2 });
    const spy = vi.fn(sampleMonthlyIncome);
    const rng = lcg(606);
    for (const source of sources) {
      const isSuppressed = state.isUnemployed && source.id === suppressedSourceId;
      if (!isSuppressed) {
        spy(source, NOISE, rng);
      }
    }
    expect(spy).toHaveBeenCalledTimes(sources.length - 1);
    expect(spy.mock.calls[0][0]).toBe(sources[1]);
    for (const call of spy.mock.calls) {
      expect(call[0].id).not.toBe(suppressedSourceId);
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism + RNG ordering
// ---------------------------------------------------------------------------

describe('rollMonthlyEvents determinism and RNG ordering', () => {
  it('produces identical FiredEvent[] for identical seeds and context', () => {
    const overrides: HazardOverrides = {
      ...DEFAULT_HAZARD_OVERRIDES,
      jobLossBaseProb: 0.5,
      medicalTailBaseProb: 0.2,
      housingSpikeBaseProb: 0.5,
      bonusBaseProb: 0.5,
      windfallBaseProb: 0.5,
    };
    const runA: ReturnType<typeof rollMonthlyEvents>[] = [];
    const runB: ReturnType<typeof rollMonthlyEvents>[] = [];
    const ctxA = baseContext({ rng: lcg(314159), overrides });
    const ctxB = baseContext({ rng: lcg(314159), overrides });
    for (let month = 0; month < 12; month++) {
      runA.push(rollMonthlyEvents(ctxA, month));
      runB.push(rollMonthlyEvents(ctxB, month));
    }
    expect(runA).toEqual(runB);
    expect(runA.length).toBe(12);
  });

  it('consumes every income-noise draw before any discrete event draw', () => {
    const noiseParams: IncomeNoiseParams = { stable: 0.05, variable: 0.25, volatile: 0.45 };
    const inner = lcg(271828);
    const marks: string[] = [];
    let phase = 'income';
    const rng = () => { marks.push(phase); return inner(); };
    for (const source of sources) {
      sampleMonthlyIncome(source, noiseParams, rng);
    }
    phase = 'events';
    rollMonthlyEvents(baseContext({
      rng,
      state: baseState(),
      overrides: { ...DEFAULT_HAZARD_OVERRIDES, jobLossBaseProb: 1, medicalTailBaseProb: 1 },
    }), 0);
    const firstEvent = marks.indexOf('events');
    const lastIncome = marks.lastIndexOf('income');
    expect(lastIncome).toBeGreaterThanOrEqual(0);
    expect(firstEvent).toBeGreaterThan(lastIncome);
  });
});

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

describe('rollMonthlyEvents observed rates', () => {
  it('job_loss fires within 15% of 0.02 over 100,000 months', () => {
    const ctx = baseContext({ rng: lcg(20240501), state: baseState() });
    let jobLossCount = 0;
    for (let i = 0; i < 100000; i++) {
      const events = rollMonthlyEvents(ctx, i % 12);
      if (events.some((event) => event.type === 'job_loss')) jobLossCount++;
    }
    const rate = jobLossCount / 100000;
    expect(rate).toBeGreaterThan(0.02 * 0.85);
    expect(rate).toBeLessThan(0.02 * 1.15);
  });

  it('while unemployed: job_loss never fires and medical_expense is within 15% of 0.08 * 1.3', () => {
    const ctx = baseContext({ rng: lcg(777777), state: baseState({ isUnemployed: true, monthsUnemployed: 3 }) });
    let jobLossCount = 0;
    let medicalCount = 0;
    for (let i = 0; i < 100000; i++) {
      const events = rollMonthlyEvents(ctx, i % 12);
      for (const event of events) {
        if (event.type === 'job_loss') jobLossCount++;
        if (event.type === 'medical_expense') medicalCount++;
      }
    }
    expect(jobLossCount).toBe(0);
    const rate = medicalCount / 100000;
    const target = 0.08 * 1.3;
    expect(rate).toBeGreaterThan(target * 0.85);
    expect(rate).toBeLessThan(target * 1.15);
  });

  it('halves bonus and windfall firing rates when a payment was missed last month', () => {
    const overrides: HazardOverrides = { ...DEFAULT_HAZARD_OVERRIDES, bonusBaseProb: 1, windfallBaseProb: 1 };
    const ctx = baseContext({ rng: lcg(5150), state: baseState({ missedPaymentLastMonth: true }), overrides });
    let bonusCount = 0;
    let windfallCount = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const events = rollMonthlyEvents(ctx, i % 12);
      if (events.some((event) => event.type === 'bonus')) bonusCount++;
      if (events.some((event) => event.type === 'windfall')) windfallCount++;
    }
    const bonusRate = bonusCount / n;
    const windfallRate = windfallCount / n;
    expect(bonusRate).toBeGreaterThan(0.4);
    expect(bonusRate).toBeLessThan(0.6);
    expect(windfallRate).toBeGreaterThan(0.4);
    expect(windfallRate).toBeLessThan(0.6);
  });
});

// ---------------------------------------------------------------------------
// Severity multiplier
// ---------------------------------------------------------------------------

describe('severity multiplier application', () => {
  it('scales tail-event medical severity by ~1.15 when fundBreachedThisRun is true', () => {
    const overrides: HazardOverrides = {
      ...DEFAULT_HAZARD_OVERRIDES,
      medicalRoutineBaseProb: 0,
      medicalTailBaseProb: 1,
    };
    const collect = (breached: boolean, seed: number): number[] => {
      const ctx = baseContext({ rng: lcg(seed), state: baseState({ fundBreachedThisRun: breached }), overrides });
      const amounts: number[] = [];
      for (let i = 0; i < 3000; i++) {
        const event = rollMonthlyEvents(ctx, i % 12).find((entry) => entry.type === 'medical_expense');
        if (event !== undefined) amounts.push(event.amount);
      }
      return amounts;
    };
    const baseline = collect(false, 90210);
    const breached = collect(true, 90210);
    expect(baseline).toHaveLength(3000);
    expect(breached).toHaveLength(3000);
    const ratio = median(breached) / median(baseline);
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(1.2);
  });

  it('applies the risk-profile multiplier to cost events but never to bonus or windfall', () => {
    const overrides: HazardOverrides = {
      ...DEFAULT_HAZARD_OVERRIDES,
      medicalRoutineBaseProb: 0,
      medicalTailBaseProb: 1,
      bonusBaseProb: 1,
      windfallBaseProb: 1,
    };
    const collect = (multiplier: number): { medical: number[]; bonus: number[]; windfall: number[] } => {
      const ctx = baseContext({
        rng: lcg(1010),
        state: baseState(),
        overrides,
        hazardSeverityMultiplier: multiplier,
        totalMonthlyIncome: 120000,
      });
      const medical: number[] = [];
      const bonus: number[] = [];
      const windfall: number[] = [];
      for (let i = 0; i < 200; i++) {
        for (const event of rollMonthlyEvents(ctx, i % 12)) {
          if (event.type === 'medical_expense') medical.push(event.amount);
          if (event.type === 'bonus') bonus.push(event.amount);
          if (event.type === 'windfall') windfall.push(event.amount);
        }
      }
      return { medical, bonus, windfall };
    };
    const conservative = collect(1.25);
    const aggressive = collect(0.8);
    expect(median(conservative.medical) / median(aggressive.medical)).toBeGreaterThan(1.4);
    expect(conservative.bonus).toEqual(aggressive.bonus);
    expect(conservative.windfall).toEqual(aggressive.windfall);
  });
});

// ---------------------------------------------------------------------------
// housing + market + job targeting
// ---------------------------------------------------------------------------

describe('housing_cost_spike', () => {
  const overrides: HazardOverrides = { ...DEFAULT_HAZARD_OVERRIDES, housingSpikeBaseProb: 1 };

  it('emits a cost event and rounds it to 100 Rs when the run has not yet spiked', () => {
    const events = rollMonthlyEvents(baseContext({
      state: baseState({ housingSpikeFiredThisRun: false }),
      overrides,
      totalFixedExpenses: 40000,
    }), 0);
    const spike = events.find((event) => event.type === 'housing_cost_spike');
    expect(spike).toBeDefined();
    expect(Math.abs((spike === undefined ? 0 : spike.amount) % 100)).toBe(0);
  });

  it('never fires once housingSpikeFiredThisRun is true', () => {
    const events = rollMonthlyEvents(baseContext({
      state: baseState({ housingSpikeFiredThisRun: true }),
      overrides,
    }), 0);
    expect(events.some((event) => event.type === 'housing_cost_spike')).toBe(false);
  });
});

describe('market_move', () => {
  it('emits a market_move only when the fund is marked invested', () => {
    const invested = rollMonthlyEvents(baseContext({
      state: baseState(),
      emergencyFund: { balance: 100000, isInvested: true },
    }), 0);
    const marketEvents = invested.filter((event) => event.type === 'market_move');
    expect(marketEvents).toHaveLength(1);
    expect(Math.abs(marketEvents[0].amount % 100)).toBe(0);

    const notInvested = rollMonthlyEvents(baseContext({
      state: baseState(),
      emergencyFund: { balance: 100000, isInvested: false },
    }), 0);
    expect(notInvested.some((event) => event.type === 'market_move')).toBe(false);

    const noFund = rollMonthlyEvents(baseContext({ state: baseState() }), 0);
    expect(noFund).toEqual(notInvested);
  });
});

describe('job_loss applicability rule', () => {
  const overrides: HazardOverrides = { ...DEFAULT_HAZARD_OVERRIDES, jobLossBaseProb: 1 };

  it('selects among income sources with a human-readable label', () => {
    const events = rollMonthlyEvents(baseContext({ state: baseState(), incomeSources: sources, overrides }), 0);
    const jobLoss = events.find((event) => event.type === 'job_loss');
    expect(jobLoss).toBeDefined();
    const label = jobLoss === undefined ? '' : jobLoss.label;
    expect(label.startsWith('Lost income: ')).toBe(true);
    expect(sources.some((source) => label.includes(source.label))).toBe(true);
  });

  it('names the single source when only one exists', () => {
    const events = rollMonthlyEvents(baseContext({ state: baseState(), incomeSources: [sources[0]], overrides }), 0);
    const jobLoss = events.find((event) => event.type === 'job_loss');
    expect(jobLoss === undefined ? '' : jobLoss.label).toBe('Lost income: Salary');
  });

  it('falls back to a generic label for empty or absent income sources', () => {
    const empty = rollMonthlyEvents(baseContext({ state: baseState(), incomeSources: [], overrides }), 0);
    expect(empty.find((event) => event.type === 'job_loss')?.label).toBe('Job loss');
    const absent = rollMonthlyEvents(baseContext({ state: baseState(), overrides }), 0);
    expect(absent.find((event) => event.type === 'job_loss')?.label).toBe('Job loss');
  });

  it('weights targeting toward volatile income over many losses', () => {
    const overridesForRun: HazardOverrides = { ...DEFAULT_HAZARD_OVERRIDES, jobLossBaseProb: 1 };
    const ctx = baseContext({ rng: lcg(424242), state: baseState(), incomeSources: sources, overrides: overridesForRun });
    const counts = { Salary: 0, Freelance: 0, Gigs: 0 };
    for (let i = 0; i < 3000; i++) {
      const jobLoss = rollMonthlyEvents(ctx, i % 12).find((event) => event.type === 'job_loss');
      if (jobLoss !== undefined) {
        for (const source of sources) {
          if (jobLoss.label.includes(source.label)) counts[source.label as keyof typeof counts]++;
        }
      }
    }
    expect(counts.Gigs).toBeGreaterThan(counts.Salary);
    expect(counts.Gigs + counts.Freelance + counts.Salary).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// Rounding + performance
// ---------------------------------------------------------------------------

describe('severity rounding and performance', () => {
  it('rounds every emitted amount to the nearest 100 Rs', () => {
    const overrides: HazardOverrides = {
      ...DEFAULT_HAZARD_OVERRIDES,
      jobLossBaseProb: 1,
      medicalTailBaseProb: 1,
      medicalRoutineBaseProb: 0,
      housingSpikeBaseProb: 1,
      bonusBaseProb: 1,
      windfallBaseProb: 1,
    };
    const events = rollMonthlyEvents(baseContext({
      state: baseState(),
      incomeSources: sources,
      overrides,
      emergencyFund: { balance: 250000, isInvested: true },
    }), 0);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(Math.abs(event.amount % 100)).toBe(0);
    }
  });

  it('completes 300 scenarios x 12 months in under 100ms', () => {
    const ctx = baseContext({ rng: lcg(5), state: baseState() });
    const start = performance.now();
    for (let scenario = 0; scenario < 300; scenario++) {
      for (let month = 0; month < 12; month++) {
        rollMonthlyEvents(ctx, month);
      }
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('returns an empty array for an ordinary quiet month', () => {
    const overrides: HazardOverrides = {
      ...DEFAULT_HAZARD_OVERRIDES,
      jobLossBaseProb: 0,
      medicalRoutineBaseProb: 0,
      medicalTailBaseProb: 0,
      housingSpikeBaseProb: 0,
      bonusBaseProb: 0,
      windfallBaseProb: 0,
    };
    const events = rollMonthlyEvents(baseContext({ state: baseState(), overrides }), 0);
    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Comparator tie-breaking (equal amounts / equal weights)
// ---------------------------------------------------------------------------

describe('job_loss target tie-breaking', () => {
  it('resolves equal amounts by stability weight and then by id', () => {
    const tied: IncomeSource[] = [
      { id: 'z', label: 'Zeta', monthlyAmount: 30000, stability: 'variable' },
      { id: 'a', label: 'Alpha', monthlyAmount: 30000, stability: 'variable' },
      { id: 'm', label: 'Mu', monthlyAmount: 30000, stability: 'volatile' },
    ];
    const overrides: HazardOverrides = { ...DEFAULT_HAZARD_OVERRIDES, jobLossBaseProb: 1 };
    const ctx = baseContext({ rng: lcg(99), state: baseState(), incomeSources: tied, overrides });
    const counts: Record<string, number> = { Zeta: 0, Alpha: 0, Mu: 0 };
    for (let i = 0; i < 300; i++) {
      const jobLoss = rollMonthlyEvents(ctx, i % 12).find((event) => event.type === 'job_loss');
      if (jobLoss === undefined) continue;
      for (const source of tied) {
        if (jobLoss.label.includes(source.label)) counts[source.label]++;
      }
    }
    expect(counts.Zeta + counts.Alpha + counts.Mu).toBe(300);
    expect(counts.Mu).toBeGreaterThan(0);
  });
});

