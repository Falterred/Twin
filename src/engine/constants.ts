// ─────────────────────────────────────────────────────────────
// Part 1: Constants, Data Model, and Derived State
// Ref: Twin/Plan/01_constants_and_data_model.md
// ─────────────────────────────────────────────────────────────

// ───── Type Definitions ─────

export type Urgency = 'urgent' | 'can_wait' | 'nice_to_have';
export type IncomeStability = 'stable' | 'variable';
export type SimMode = 'deterministic' | 'probabilistic';
export type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

export interface RawInputs {
  liquidCash: number;           // Current liquid cash in ₹
  monthlyIncome: number;        // Monthly net income in ₹
  monthlyExpenses: number;      // Monthly recurring expenses in ₹
  existingEMI: number;          // Current monthly EMI obligations in ₹
  emergencyFundMonths: number;  // Target emergency fund in months of expenses
  itemPrice: number;            // Target purchase price in ₹
  urgency: Urgency;
  incomeStability: IncomeStability;
  emiTenureMonths: number;      // Selected EMI tenure in months
  emiAnnualRatePct: number;     // Annual interest rate % (0 for no-cost EMI)
  mode: SimMode;
  riskProfile: RiskProfile;
}

export interface WeightVector {
  w1: number; // safety
  w2: number; // oppCost
  w3: number; // delayCost
  w4: number; // debtBurden
  w5: number; // utility
}

export interface DerivedState extends RawInputs {
  currentEmergencyFund: number;   // Earmarked liquid savings
  emergencyFundTargetRs: number;  // emergencyFundMonths × monthlyExpenses
  incomeVariancePct: number;      // 0.05 (stable) vs 0.25 (variable)
  weights: WeightVector;
  monthlyInvestReturnPct: number; // 0.008 (~10% p.a. equity/FD blended)
  monthlyInflationPct: number;    // 0.004 (~5% p.a.)
  utilityImmediateBonus: number;  // +0.15
  utilityDelayPenalty: number;    // -0.20
}

export interface ActionConfig {
  id: string;
  label: string;
  color: string;
  description: string;
}

// ───── Constants ─────

export const ACTIONS: ActionConfig[] = [
  { id: 'buy_now',       label: 'Buy Now',             color: '#2563eb', description: 'Pay in full immediately from liquid savings' },
  { id: 'emi',           label: 'EMI / Loan',          color: '#8b5cf6', description: 'Spread payment across monthly installments' },
  { id: 'wait_3m',       label: 'Wait 3 Months',       color: '#f59e0b', description: 'Save monthly surplus and buy at month 3' },
  { id: 'cheaper',       label: 'Buy Cheaper Model',   color: '#10b981', description: 'Purchase budget alternative at 30% discount' },
  { id: 'refurb',        label: 'Buy Refurbished',     color: '#ec4899', description: 'Buy certified refurbished at 45% discount' },
  { id: 'invest_delay',  label: 'Invest + Delay',      color: '#06b6d4', description: 'Invest surplus until compound returns fund the purchase' },
];

export const WEIGHT_TABLE: Record<RiskProfile, WeightVector> = {
  conservative: { w1: 0.40, w2: 0.10, w3: 0.15, w4: 0.25, w5: 0.10 },
  balanced:     { w1: 0.25, w2: 0.20, w3: 0.20, w4: 0.20, w5: 0.15 },
  aggressive:   { w1: 0.15, w2: 0.30, w3: 0.15, w4: 0.15, w5: 0.25 },
};

export const SHOCK_PARAMS = {
  month: 2,
  incomeDropPct: 1.0,       // 100% income loss
  surpriseExpense: 15_000,  // ₹15,000 unexpected expense
} as const;

export const CALIBRATION_QUESTIONS = [
  {
    id: 'q1',
    prompt: 'How do you prioritize extra savings vs investment potential?',
    options: [
      { text: 'Keep extra ₹20k safety buffer in savings account', points: -1 },
      { text: 'Invest it in equity/funds for higher expected return', points: 1 },
    ],
  },
  {
    id: 'q2',
    prompt: 'When planning a major purchase:',
    options: [
      { text: 'Pay a bit more upfront for certainty and peace of mind', points: -1 },
      { text: 'Wait and optimize price, even if prices might fluctuate', points: 1 },
    ],
  },
  {
    id: 'q3',
    prompt: 'How do you feel about taking on a monthly installment (EMI)?',
    options: [
      { text: 'Avoid EMIs wherever possible — debt causes anxiety', points: -1 },
      { text: 'Comfortable with low-cost EMI if it keeps liquid cash free', points: 1 },
    ],
  },
] as const;

export const DEFAULT_RAW_INPUTS: RawInputs = {
  liquidCash: 150_000,
  monthlyIncome: 80_000,
  monthlyExpenses: 40_000,
  existingEMI: 5_000,
  emergencyFundMonths: 6,
  itemPrice: 60_000,
  urgency: 'can_wait',
  incomeStability: 'stable',
  emiTenureMonths: 12,
  emiAnnualRatePct: 14,
  mode: 'deterministic',
  riskProfile: 'balanced',
};

// ───── Derived State Builder ─────

/**
 * Transforms raw UI inputs into the full DerivedState consumed by all
 * downstream engines.  Pure function — no side effects.
 */
export function buildDerivedState(
  rawInputs: RawInputs,
  riskProfile?: RiskProfile,
): DerivedState {
  const resolvedProfile = riskProfile ?? rawInputs.riskProfile;

  const numericInputs: (keyof RawInputs)[] = [
    'liquidCash',
    'monthlyIncome',
    'monthlyExpenses',
    'existingEMI',
    'emergencyFundMonths',
    'itemPrice',
    'emiTenureMonths',
    'emiAnnualRatePct',
  ];
  for (const key of numericInputs) {
    if (!Number.isFinite(rawInputs[key])) {
      throw new RangeError(`${key} must be a finite number`);
    }
  }
  if (rawInputs.liquidCash < 0 || rawInputs.monthlyIncome < 0 || rawInputs.monthlyExpenses < 0
    || rawInputs.existingEMI < 0 || rawInputs.emergencyFundMonths < 0 || rawInputs.itemPrice < 0
    || rawInputs.emiTenureMonths < 0 || !Number.isInteger(rawInputs.emiTenureMonths)
    || rawInputs.emiAnnualRatePct < 0) {
    throw new RangeError('Financial inputs must use non-negative values and an integer EMI tenure');
  }
  if (!(resolvedProfile in WEIGHT_TABLE)) {
    throw new RangeError(`Unknown risk profile: "${String(resolvedProfile)}"`);
  }

  return {
    ...rawInputs,

    riskProfile: resolvedProfile,

    currentEmergencyFund: rawInputs.liquidCash,

    // Emergency fund target — guard against 0-expense edge case
    emergencyFundTargetRs:
      rawInputs.emergencyFundMonths * Math.max(1, rawInputs.monthlyExpenses),

    // Income variance for Monte Carlo sampling
    incomeVariancePct: rawInputs.incomeStability === 'variable' ? 0.25 : 0.05,

    // Risk-weighted scoring vector
    weights: WEIGHT_TABLE[resolvedProfile] ?? WEIGHT_TABLE.balanced,

    // Financial constants
    monthlyInvestReturnPct: 0.008,  // ~10% p.a.
    monthlyInflationPct: 0.004,     // ~5% p.a.

    // Utility scaling adjustments
    utilityImmediateBonus: 0.15,
    utilityDelayPenalty: -0.20,
  };
}
