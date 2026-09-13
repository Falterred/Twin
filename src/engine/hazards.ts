/**
 * Part 3 - Event & Hazard Engine
 *
 * Defines every random-event type, its base probability, its severity distribution,
 * and the small set of state-dependent hazard multipliers that let events compound
 * without full joint-probability modeling.
 *
 * Depends on Part 1 (types). Consumed by Part 5 (scenario runner), which calls this
 * module once per scenario per month.
 *
 * Design constraint (binding): every event's probability lookup and severity draw is
 * O(1) per event per month - a small number of scalar multiplications and one or two
 * random draws. No joint distributions, no Monte-Carlo-within-Monte-Carlo, no lookahead.
 *
 * IncomeNoiseParams and HazardOverrides are TYPE-DEFINED in Part 1
 * (src/engine/state.ts) to avoid a circular dependency. This file imports both types
 * and re-exports the canonical DEFAULT_HAZARD_OVERRIDES value (whose one source of truth
 * lives in Part 1 so that Part 1 can build DerivedState with zero dependencies).
 */
import type {
  HazardOverrides,
  IncomeNoiseParams,
  IncomeSource,
  IncomeStability,
} from './state';
import { DEFAULT_HAZARD_OVERRIDES } from './state';

export { DEFAULT_HAZARD_OVERRIDES };

// ---------------------------------------------------------------------------
// Exact type contracts
// ---------------------------------------------------------------------------

export type EventType =
  | 'job_loss'
  | 'job_regained'         // internal recovery event, not user-facing as a "shock"
  | 'medical_expense'
  | 'housing_cost_spike'
  | 'bonus'
  | 'windfall'
  | 'market_move';         // affects investable/emergency-fund balances, if modeled as market-linked (v1: fund is cash, so this affects liquidCashOutsideFund only if user marks it invested - see Part 4 note)

export type FiredEvent = {
  type: EventType;
  month: number;                 // 0-11
  amount: number;                // Rs signed: negative = cost/shock, positive = income/windfall. 0 for job_loss/job_regained (handled via income suppression, not a cash amount).
  label: string;                 // human-readable, used by narrative generation (Part 7)
};

// Tracks the minimal state needed for hazard multipliers. Recomputed each month by the scenario runner.
export type MonthlyHazardState = {
  isUnemployed: boolean;         // true if job_loss fired and job_regained has not yet fired
  monthsUnemployed: number;      // consecutive months, 0 if employed
  fundBreachedThisRun: boolean;  // true once emergencyFund.balance has hit 0 at any prior month in this scenario
  missedPaymentLastMonth: boolean; // true if the prior month's response policy hit total failure (Part 4)
  // Extension owned by the scenario runner (Part 5): housing hikes are permanent but the
  // spec fires them at most once per scenario, and rollMonthlyEvents is stateless per month.
  housingSpikeFiredThisRun?: boolean;
};

// Optional emergency-fund view needed for the market_move row of the event table. The
// Part 4 addendum adds isInvested to EmergencyFundState; this narrow shape keeps Part 3
// decoupled from that snapshot field while still letting the runner opt in.
export type HazardEmergencyFundView = {
  balance: number;
  isInvested: boolean;
};

export type HazardContext = {
  hazardSeverityMultiplier: number;  // from DerivedState, risk-profile-driven
  totalMonthlyIncome: number;
  totalFixedExpenses: number;
  state: MonthlyHazardState;
  rng: () => number;                 // uniform [0,1) generator, seeded per scenario (see Part 5)
  noiseParams: IncomeNoiseParams;    // sourced from HazardOverrides.incomeNoise
  // Extension: the consolidated base-rate surface for this month. Defaults to
  // DEFAULT_HAZARD_OVERRIDES when omitted so documented callers keep working, while the
  // advanced settings panel (Part 9) can still make every base rate user-editable.
  overrides?: HazardOverrides;
  // Extension: income sources for the job_loss applicability rule (weighted targeting).
  incomeSources?: IncomeSource[];
  // Extension: emergency fund for the market_move row; inert unless isInvested is true.
  emergencyFund?: HazardEmergencyFundView;
};

// ---------------------------------------------------------------------------
// Continuous income noise + statistical helpers
// ---------------------------------------------------------------------------

/**
 * Box-Muller transform. Uses the injected rng exclusively (never Math.random) so
 * scenario streams are seedable and paired baseline/decision runs stay comparable.
 * Consumes exactly two uniform draws per call, including when stdDev === 0.
 * Validation: mean must be finite; stdDev must be finite and >= 0.
 */
export function gaussianRandom(mean: number, stdDev: number, rng: () => number): number {
  if (!Number.isFinite(mean)) {
    throw new RangeError('gaussianRandom mean must be a finite number (received ' + String(mean) + ')');
  }
  if (!Number.isFinite(stdDev) || stdDev < 0) {
    throw new RangeError('gaussianRandom stdDev must be a finite number >= 0 (received ' + String(stdDev) + ')');
  }
  const u1 = 1 - rng();   // in (0, 1], so Math.log is always finite
  const u2 = rng();       // in [0, 1)
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

export function lognormalRandom(mu: number, sigma: number, rng: () => number): number {
  return Math.exp(gaussianRandom(mu, sigma, rng));
}

export function exponentialRandom(mean: number, rng: () => number): number {
  if (!Number.isFinite(mean) || mean < 0) {
    throw new RangeError('exponentialRandom mean must be a finite number >= 0 (received ' + String(mean) + ')');
  }
  return -mean * Math.log(1 - rng());
}

/**
 * Continuous per-source income noise. Runs every month for every income source
 * regardless of whether any discrete event fires. Zero-variance edge case: when a
 * stability tier's stdDev is exactly 0, return the base amount without touching the
 * rng at all, so the shared seeded sequence is not perturbed.
 */
export function sampleMonthlyIncome(
  source: IncomeSource,
  noiseParams: IncomeNoiseParams,
  rng: () => number,
): number {
  const stdDevFraction = noiseParams[source.stability];
  if (stdDevFraction === 0) {
    return source.monthlyAmount;
  }
  const noisyAmount = source.monthlyAmount * (1 + gaussianRandom(0, stdDevFraction, rng));
  return Math.max(0, noisyAmount);
}

// ---------------------------------------------------------------------------
// Discrete monthly events
// ---------------------------------------------------------------------------

const STABILITY_WEIGHTS: Record<IncomeStability, number> = {
  volatile: 3,
  variable: 2,
  stable: 1,
};

function roundToNearest100(amount: number): number {
  return Math.round(amount / 100) * 100;
}

/**
 * job_loss applicability rule: weight selection probability by stability
 * (volatile 3, variable 2, stable 1), then pick by monthlyAmount descending among
 * equally-weighted ties. Returns null when no income sources are available.
 */
function selectJobLossTarget(
  sources: IncomeSource[] | undefined,
  rng: () => number,
): IncomeSource | null {
  if (sources === undefined || sources.length === 0) {
    return null;
  }
  const weighted = sources
    .map((source) => ({ source, weight: STABILITY_WEIGHTS[source.stability] }))
    .sort((a, b) =>
      (b.source.monthlyAmount - a.source.monthlyAmount) ||
      (b.weight - a.weight) ||
      a.source.id.localeCompare(b.source.id),
    );
  if (weighted.length === 1) {
    return weighted[0].source;
  }
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = rng() * totalWeight;
  let chosen = weighted[0].source;
  for (const entry of weighted) {
    threshold -= entry.weight;
    if (threshold < 0) {
      chosen = entry.source;
      break;
    }
  }
  return chosen;
}

/**
 * Rolls every discrete event for one month.
 *
 * Binding RNG consumption order (baseline/decision pairing depends on it):
 *   job_loss -> medical_expense -> housing_cost_spike -> bonus -> windfall -> market_move
 * (Income-noise draws are consumed by the caller BEFORE this function, once per income
 * source in snapshot.incomeSources order.)
 */
export function rollMonthlyEvents(ctx: HazardContext, month: number): FiredEvent[] {
  const overrides = ctx.overrides ?? DEFAULT_HAZARD_OVERRIDES;
  const state = ctx.state;
  const rng = ctx.rng;
  const events: FiredEvent[] = [];
  // Cost-event severity multiplier: risk profile x (fundBreached ? 1.15 : 1).
  const costSeverityMultiplier = ctx.hazardSeverityMultiplier * (state.fundBreachedThisRun ? 1.15 : 1);

  // 1) job_loss - skipped entirely while already unemployed (rule 2).
  if (!state.isUnemployed) {
    if (rng() < overrides.jobLossBaseProb) {
      const target = selectJobLossTarget(ctx.incomeSources, rng);
      events.push({
        type: 'job_loss',
        month,
        amount: 0,
        label: target === null ? 'Job loss' : 'Lost income: ' + target.label,
      });
    }
  }

  // 2) medical_expense - routine lognormal, or an independent tail event that replaces it.
  {
    const routineProb = overrides.medicalRoutineBaseProb * (state.isUnemployed ? 1.3 : 1);
    const tailProb = overrides.medicalTailBaseProb;
    const routineRoll = rng();
    const tailRoll = rng();
    let rawSeverity: number | null = null;
    if (tailRoll < tailProb) {
      rawSeverity = 80000 + rng() * (300000 - 80000);
    } else if (routineRoll < routineProb) {
      rawSeverity = Math.max(500, lognormalRandom(8.5, 0.6, rng));
    }
    if (rawSeverity !== null) {
      events.push({
        type: 'medical_expense',
        month,
        amount: -roundToNearest100(rawSeverity * costSeverityMultiplier),
        label: 'Medical expense',
      });
    }
  }

  // 3) housing_cost_spike - cost event; at most once per scenario (runner-tracked flag).
  if (state.housingSpikeFiredThisRun !== true) {
    if (rng() < overrides.housingSpikeBaseProb) {
      const fraction = 0.10 + rng() * (0.35 - 0.10);
      const rawSeverity = fraction * ctx.totalFixedExpenses;
      events.push({
        type: 'housing_cost_spike',
        month,
        amount: -roundToNearest100(rawSeverity * costSeverityMultiplier),
        label: 'Housing cost spike',
      });
    }
  }

  // 4) bonus - positive, income-scaled, never severity-scaled.
  {
    const bonusProb = overrides.bonusBaseProb * (state.missedPaymentLastMonth ? 0.5 : 1);
    if (rng() < bonusProb) {
      const rawSeverity = (0.5 + rng() * (2.0 - 0.5)) * (ctx.totalMonthlyIncome / 12);
      events.push({
        type: 'bonus',
        month,
        amount: roundToNearest100(rawSeverity),
        label: 'Bonus',
      });
    }
  }

  // 5) windfall - positive, rare, income-independent, never severity-scaled.
  {
    const windfallProb = overrides.windfallBaseProb * (state.missedPaymentLastMonth ? 0.5 : 1);
    if (rng() < windfallProb) {
      const rawSeverity = 20000 + rng() * (150000 - 20000);
      events.push({
        type: 'windfall',
        month,
        amount: roundToNearest100(rawSeverity),
        label: 'Windfall',
      });
    }
  }

  // 6) market_move - always consumes its return draw (fixed order), but only surfaces as
  // an event when the user marks the emergency fund as invested. Inert by default.
  {
    const marketReturn = gaussianRandom(0.005, 0.035, rng);
    const fund = ctx.emergencyFund;
    if (fund !== undefined && fund.isInvested) {
      events.push({
        type: 'market_move',
        month,
        amount: roundToNearest100(fund.balance * marketReturn),
        label: 'Market move',
      });
    }
  }

  return events;
}
