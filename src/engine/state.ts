/**
 * Part 1 - State Model, Constants & Derived State
 *
 * Financial Twin Simulator (Twin2), ground-up rebuild.
 *
 * This module is the zero-dependency foundation: every other part imports its data
 * shapes from here and must not redefine them.
 *
 * Implementation note (flagged per docs/vision/01_PRINCIPLES.md #8, "favor the thing
 * that is harder to fake"):
 *   DEFAULT_HAZARD_OVERRIDES and HAZARD_SEVERITY_MULTIPLIER are declared in this file
 *   rather than in Part 3 (hazards.ts). Part 1 has zero runtime dependencies and is
 *   implemented/tested before Part 3 exists; a value import from './hazards' would
 *   create the runtime cycle state -> hazards -> state. Part 3 (which already imports
 *   the HazardOverrides *type* from this module) re-exports these two names, so there
 *   remains exactly one source of truth for the shipped default values.
 *
 *   DecisionDiff is owned by Part 2 (src/engine/decision.ts). It is imported with
 *   import type so the reference is fully erased at runtime and Part 1 stays runnable
 *   and testable in isolation.
 */
import type { DecisionDiff } from './decision';

// ---------- Income ----------
export type IncomeStability = 'stable' | 'variable' | 'volatile';

export type IncomeSource = {
  id: string;                 // uuid
  label: string;               // user-facing name, e.g. "Salary", "Freelance design"
  monthlyAmount: number;       // ₹, must be >= 0
  stability: IncomeStability;  // drives income-noise stdDev (see Part 3)
};

// ---------- Debt ----------
export type DebtType = 'personal_loan' | 'credit_card' | 'auto_loan' | 'mortgage';

export type DebtInstrument = {
  id: string;                  // uuid
  type: DebtType;
  label: string;
  balance: number;             // outstanding principal, ₹, >= 0
  annualRatePct: number;       // APR, >= 0
  minMonthlyPayment: number;   // ₹, >= 0 (required minimum, always paid if affordable)
  termMonthsRemaining: number | null; // null = revolving (credit card), integer >= 0 for installment debt
};

// ---------- Expenses ----------
export type ExpenseCategoryType = 'fixed' | 'discretionary' | 'seasonal';

export type ExpenseCategory = {
  id: string;
  label: string;
  type: ExpenseCategoryType;
  monthlyAmount: number;       // ₹, baseline monthly value, >= 0
  // Only used when type === 'seasonal'. Multiplier applied to monthlyAmount for that calendar month index (0-11).
  // Length must be exactly 12 if present. e.g. higher in Nov/Dec for festive spend.
  seasonalMultipliers?: number[];
};

// ---------- Emergency Fund ----------
export type EmergencyFundState = {
  balance: number;              // ₹, current liquid balance earmarked as emergency fund, >= 0
  targetMonths: number;         // e.g. 6 (months of essential fixed expenses)
  isInvested: boolean;          // NEW — default false. Enables market_move exposure (Part 3).
};

// ---------- Risk Profile ----------
export type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

// ---------- Baseline Snapshot (the user's real current state) ----------
export type FinancialSnapshot = {
  incomeSources: IncomeSource[];       // at least 1 entry required
  debts: DebtInstrument[];             // 0 or more
  expenses: ExpenseCategory[];         // at least 1 entry required
  emergencyFund: EmergencyFundState;
  liquidCashOutsideFund: number;       // ₹, spendable savings not earmarked as emergency fund, >= 0
  riskProfile: RiskProfile;
  debtFallbackOrder: string[];         // ordered array of DebtInstrument.id (+ special id 'NEW_CREDIT_LINE'),
                                        // user-defined priority for which debt absorbs a shortfall first.
                                        // See Part 4 for how this is populated/suggested.
};

// ---------- Simulation Configuration ----------
export type SimConfig = {
  scenarioCount: 50 | 100 | 300;       // user-selectable, see Part 5
  horizonMonths: 12;                   // fixed at 12 for v1
  randomSeed?: number;                 // optional, for reproducible debugging/testing
};

// ---------- Hazard/Assumption Overrides (type lives here; defaults & behavior live in Part 3) ----------
// Defined in Part 1, not Part 3, specifically to avoid a circular dependency: DerivedState
// (this file) needs to hold a HazardOverrides value, but Part 3 (hazards.ts) depends on
// Part 1's types. Putting the shape here and the behavior/defaults in Part 3 keeps the
// build order (Part 1 has zero dependencies) intact. Part 3 imports this type; it does not
// redefine it.
export type IncomeNoiseParams = {
  stable: number;    // stdDev as a fraction of monthlyAmount, default 0.05
  variable: number;  // default 0.25
  volatile: number;  // default 0.45
};

export type HazardOverrides = {
  jobLossBaseProb: number;              // default 0.02
  medicalRoutineBaseProb: number;       // default 0.08
  medicalTailBaseProb: number;          // default 0.005
  housingSpikeBaseProb: number;         // default 0.015
  bonusBaseProb: number;                // default 0.04
  windfallBaseProb: number;             // default 0.008
  incomeNoise: IncomeNoiseParams;       // see Part 3 for how this is consumed
  newCreditLineAprPct: number;          // default 24.0, consumed by Part 4
};

// ---------- Derived State (computed once per snapshot+decision+config) ----------
export type DerivedState = {
  snapshot: FinancialSnapshot;
  decision: DecisionDiff;              // see Part 2
  totalMonthlyIncome: number;          // sum of incomeSources[].monthlyAmount (pre-noise, pre-event baseline figure - used for target/ratio math, not for actual monthly simulation, which draws fresh noisy income each month per Part 3/5)
  totalFixedExpenses: number;          // sum of expenses where type === 'fixed'
  totalMinDebtPayments: number;        // sum of debts[].minMonthlyPayment
  emergencyFundTargetRs: number;       // emergencyFund.targetMonths * totalFixedExpenses
  hazardSeverityMultiplier: number;    // from riskProfile, see Part 3 Section "Risk Profile Coupling"
  config: SimConfig;
  hazardOverrides: HazardOverrides;    // NEW - user-editable simulation assumptions, type defined in Part 3. Always populated: DEFAULT_HAZARD_OVERRIDES merged with any user overrides, never partial/undefined by the time it reaches this type.
};

// ---------------------------------------------------------------------------
// Shipped assumption defaults (single source of truth; Part 3 re-exports these)
// ---------------------------------------------------------------------------

export const DEFAULT_HAZARD_OVERRIDES: HazardOverrides = {
  jobLossBaseProb: 0.02,
  medicalRoutineBaseProb: 0.08,
  medicalTailBaseProb: 0.005,
  housingSpikeBaseProb: 0.015,
  bonusBaseProb: 0.04,
  windfallBaseProb: 0.008,
  incomeNoise: { stable: 0.05, variable: 0.25, volatile: 0.45 },
  newCreditLineAprPct: 24.0,
};

/**
 * Risk-profile coupling: conservative users see harsher tail assumptions
 * (worst-case planning), aggressive users see lighter ones. Passed into the event
 * engine (Part 3) - it never alters any other math in this file.
 */
export const HAZARD_SEVERITY_MULTIPLIER: Record<RiskProfile, number> = {
  conservative: 1.25,
  balanced: 1.0,
  aggressive: 0.8,
};

// ---------------------------------------------------------------------------
// Validation (the single choke point - every downstream module assumes these
// rules already hold and never re-validates raw numeric ranges)
// ---------------------------------------------------------------------------

const INCOME_STABILITIES = ['stable', 'variable', 'volatile'] as const;
const DEBT_TYPES = ['personal_loan', 'credit_card', 'auto_loan', 'mortgage'] as const;
const EXPENSE_TYPES = ['fixed', 'discretionary', 'seasonal'] as const;
const RISK_PROFILES = ['conservative', 'balanced', 'aggressive'] as const;
const SCENARIO_COUNTS = [50, 100, 300] as const;

const NEW_CREDIT_LINE_ID = 'NEW_CREDIT_LINE';

function describe(value: unknown): string {
  if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
  if (typeof value === 'string') return '"' + value + '"';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return String(value);
}

function assertFiniteNonNegative(value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(field + ' must be a finite number >= 0 (received ' + describe(value) + ')');
  }
}

function assertPositiveFinite(value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(field + ' must be a finite number > 0 (received ' + describe(value) + ')');
  }
}

function assertOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): asserts value is T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    const options = allowed.map((option) => "'" + option + "'").join(' | ');
    throw new RangeError(field + ' must be one of ' + options + ' (received ' + describe(value) + ')');
  }
}

function validateFinancialSnapshot(snapshot: FinancialSnapshot): void {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new RangeError('snapshot must be a FinancialSnapshot object (received ' + describe(snapshot) + ')');
  }

  if (!Array.isArray(snapshot.incomeSources) || snapshot.incomeSources.length < 1) {
    throw new RangeError('snapshot.incomeSources must contain at least one income source');
  }
  if (!Array.isArray(snapshot.expenses) || snapshot.expenses.length < 1) {
    throw new RangeError('snapshot.expenses must contain at least one expense category');
  }
  if (!Array.isArray(snapshot.debts)) {
    throw new RangeError('snapshot.debts must be an array (0 or more debt instruments)');
  }

  snapshot.incomeSources.forEach((source, index) => {
    const field = 'snapshot.incomeSources[' + index + ']';
    assertOneOf(source.stability, INCOME_STABILITIES, field + '.stability');
    assertFiniteNonNegative(source.monthlyAmount, field + '.monthlyAmount');
  });

  snapshot.debts.forEach((debt, index) => {
    const field = 'snapshot.debts[' + index + ']';
    assertOneOf(debt.type, DEBT_TYPES, field + '.type');
    assertFiniteNonNegative(debt.balance, field + '.balance');
    assertFiniteNonNegative(debt.annualRatePct, field + '.annualRatePct');
    assertFiniteNonNegative(debt.minMonthlyPayment, field + '.minMonthlyPayment');
    if (debt.termMonthsRemaining !== null) {
      const term = debt.termMonthsRemaining;
      if (typeof term !== 'number' || !Number.isFinite(term) || !Number.isInteger(term) || term < 0) {
        throw new RangeError(
          field + '.termMonthsRemaining must be null or a non-negative integer (received ' + describe(term) + ')',
        );
      }
    }
  });

  snapshot.expenses.forEach((expense, index) => {
    const field = 'snapshot.expenses[' + index + ']';
    assertOneOf(expense.type, EXPENSE_TYPES, field + '.type');
    assertFiniteNonNegative(expense.monthlyAmount, field + '.monthlyAmount');
    if (expense.seasonalMultipliers !== undefined) {
      if (!Array.isArray(expense.seasonalMultipliers) || expense.seasonalMultipliers.length !== 12) {
        const received = Array.isArray(expense.seasonalMultipliers)
          ? expense.seasonalMultipliers.length + ' entries'
          : describe(expense.seasonalMultipliers);
        throw new RangeError(
          field + '.seasonalMultipliers must have length exactly 12 when present (received ' + received + ')',
        );
      }
      expense.seasonalMultipliers.forEach((multiplier, monthIndex) => {
        assertFiniteNonNegative(multiplier, field + '.seasonalMultipliers[' + monthIndex + ']');
      });
    }
  });

  const fund = snapshot.emergencyFund;
  if (fund === null || typeof fund !== 'object') {
    throw new RangeError('snapshot.emergencyFund must be an EmergencyFundState object (received ' + describe(fund) + ')');
  }
  assertFiniteNonNegative(fund.balance, 'snapshot.emergencyFund.balance');
  assertPositiveFinite(fund.targetMonths, 'snapshot.emergencyFund.targetMonths');

  assertFiniteNonNegative(snapshot.liquidCashOutsideFund, 'snapshot.liquidCashOutsideFund');
  assertOneOf(snapshot.riskProfile, RISK_PROFILES, 'snapshot.riskProfile');

  validateDebtFallbackOrder(snapshot);
}

function validateDebtFallbackOrder(snapshot: FinancialSnapshot): void {
  const order = snapshot.debtFallbackOrder;
  if (!Array.isArray(order)) {
    throw new RangeError('snapshot.debtFallbackOrder must be an array of debt ids (received ' + describe(order) + ')');
  }

  const seen = new Set<string>();
  for (const id of order) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new RangeError('snapshot.debtFallbackOrder must contain non-empty string ids (received ' + describe(id) + ')');
    }
    if (seen.has(id)) {
      throw new RangeError("snapshot.debtFallbackOrder contains duplicate id '" + id + "'");
    }
    seen.add(id);
  }

  for (const debt of snapshot.debts) {
    if (!seen.has(debt.id)) {
      throw new RangeError("snapshot.debtFallbackOrder is missing debt id '" + debt.id + "'");
    }
  }

  if (!seen.has(NEW_CREDIT_LINE_ID)) {
    throw new RangeError("snapshot.debtFallbackOrder must contain 'NEW_CREDIT_LINE' exactly once (missing)");
  }

  const knownIds = new Set<string>(snapshot.debts.map((debt) => debt.id));
  knownIds.add(NEW_CREDIT_LINE_ID);
  for (const id of seen) {
    if (!knownIds.has(id)) {
      throw new RangeError("snapshot.debtFallbackOrder contains unknown id '" + id + "'");
    }
  }
}

function validateSimConfig(config: SimConfig): void {
  if (config === null || typeof config !== 'object') {
    throw new RangeError('config must be a SimConfig object (received ' + describe(config) + ')');
  }
  if (!(SCENARIO_COUNTS as readonly number[]).includes(config.scenarioCount)) {
    throw new RangeError('config.scenarioCount must be one of 50 | 100 | 300 (received ' + describe(config.scenarioCount) + ')');
  }
  if (config.horizonMonths !== 12) {
    throw new RangeError('config.horizonMonths must be 12 for v1 (received ' + describe(config.horizonMonths) + ')');
  }
  if (config.randomSeed !== undefined) {
    if (typeof config.randomSeed !== 'number' || !Number.isFinite(config.randomSeed)) {
      throw new RangeError('config.randomSeed must be a finite number when present (received ' + describe(config.randomSeed) + ')');
    }
  }
}

function validateHazardOverrides(overrides: HazardOverrides): void {
  // mergeHazardOverrides always builds incomeNoise as a fresh object, so a partial or
  // null nested override surfaces here as undefined fields (rejected as non-finite)
  // rather than as a null/non-object value.
  assertFiniteNonNegative(overrides.jobLossBaseProb, 'hazardOverrides.jobLossBaseProb');
  assertFiniteNonNegative(overrides.medicalRoutineBaseProb, 'hazardOverrides.medicalRoutineBaseProb');
  assertFiniteNonNegative(overrides.medicalTailBaseProb, 'hazardOverrides.medicalTailBaseProb');
  assertFiniteNonNegative(overrides.housingSpikeBaseProb, 'hazardOverrides.housingSpikeBaseProb');
  assertFiniteNonNegative(overrides.bonusBaseProb, 'hazardOverrides.bonusBaseProb');
  assertFiniteNonNegative(overrides.windfallBaseProb, 'hazardOverrides.windfallBaseProb');
  assertFiniteNonNegative(overrides.newCreditLineAprPct, 'hazardOverrides.newCreditLineAprPct');
  // A partial incomeNoise override is NOT deep-merged field-by-field (Part 1 testing
  // strategy): the caller (Part 9's UI state) must always send all three fields. A
  // missing field becomes undefined here and is rejected as non-finite.
  assertFiniteNonNegative(overrides.incomeNoise.stable, 'hazardOverrides.incomeNoise.stable');
  assertFiniteNonNegative(overrides.incomeNoise.variable, 'hazardOverrides.incomeNoise.variable');
  assertFiniteNonNegative(overrides.incomeNoise.volatile, 'hazardOverrides.incomeNoise.volatile');
}

function mergeHazardOverrides(overrides: Partial<HazardOverrides>): HazardOverrides {
  const provided = overrides ?? {};
  const merged: HazardOverrides = {
    ...DEFAULT_HAZARD_OVERRIDES,
    ...provided,
    // Top-level shallow merge only: an override of incomeNoise replaces the whole
    // nested object rather than merging into the default's three fields.
    incomeNoise:
      provided.incomeNoise !== undefined
        ? { ...provided.incomeNoise }
        : { ...DEFAULT_HAZARD_OVERRIDES.incomeNoise },
  };
  validateHazardOverrides(merged);
  return merged;
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

export function buildDerivedState(
  snapshot: FinancialSnapshot,
  decision: DecisionDiff,
  config: SimConfig,
  hazardOverrides: Partial<HazardOverrides>,   // caller (Part 9) passes whatever the user has changed; this function merges it over DEFAULT_HAZARD_OVERRIDES
): DerivedState {
  validateFinancialSnapshot(snapshot);
  validateSimConfig(config);
  const mergedHazardOverrides = mergeHazardOverrides(hazardOverrides);

  // Deep-clone on the way in so downstream parts can never mutate the caller's objects
  // (structuredClone handles the nested arrays/objects).
  const clonedSnapshot = structuredClone(snapshot);
  const clonedDecision = structuredClone(decision);

  const totalMonthlyIncome = clonedSnapshot.incomeSources.reduce(
    (sum, source) => sum + source.monthlyAmount,
    0,
  );
  const totalFixedExpenses = clonedSnapshot.expenses
    .filter((expense) => expense.type === 'fixed')
    .reduce((sum, expense) => sum + expense.monthlyAmount, 0);
  const totalMinDebtPayments = clonedSnapshot.debts.reduce(
    (sum, debt) => sum + debt.minMonthlyPayment,
    0,
  );
  const emergencyFundTargetRs = clonedSnapshot.emergencyFund.targetMonths * totalFixedExpenses;
  const hazardSeverityMultiplier = HAZARD_SEVERITY_MULTIPLIER[clonedSnapshot.riskProfile];

  return {
    snapshot: clonedSnapshot,
    decision: clonedDecision,
    totalMonthlyIncome,
    totalFixedExpenses,
    totalMinDebtPayments,
    emergencyFundTargetRs,
    hazardSeverityMultiplier,
    config: { ...config },
    hazardOverrides: mergedHazardOverrides,
  };
}
