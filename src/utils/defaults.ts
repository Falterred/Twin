/**
 * Default Initial States for Financial Twin Simulator
 *
 * Part 9 step 1: first-load defaults are deliberately placeholder-obvious, NOT realistic
 * sample numbers. They are empty-but-valid - state.ts requires at least one income source,
 * at least one expense category, emergencyFund.targetMonths > 0, and 'NEW_CREDIT_LINE'
 * present exactly once in debtFallbackOrder - so the engine never receives an invalid
 * DerivedState. App.tsx renders an empty-state prompt instead of simulated output until the
 * user supplies real numbers and a decision.
 */

import type { FinancialSnapshot, SimConfig } from '../engine/state';
import type { DecisionDiff } from '../engine/decision';

export const INITIAL_SNAPSHOT: FinancialSnapshot = {
  incomeSources: [
    {
      id: 'income-salary-1',
      label: 'Salary',
      monthlyAmount: 0,
      stability: 'stable',
    },
  ],
  debts: [],
  expenses: [
    {
      id: 'expense-fixed-1',
      label: 'Rent & Essentials',
      type: 'fixed',
      monthlyAmount: 0,
    },
  ],
  emergencyFund: {
    balance: 0,
    targetMonths: 6,
    isInvested: false,
  },
  liquidCashOutsideFund: 0,
  riskProfile: 'balanced',
  debtFallbackOrder: ['NEW_CREDIT_LINE'],
};

export const INITIAL_DECISION: DecisionDiff = {
  kind: 'none',
};

/**
 * Walkthrough example data (Priya's real numbers and her car-EMI decision, per
 * docs/vision/03_USER_WALKTHROUGH.md). Deliberately NOT the first-load default: it is offered
 * behind the empty state's "Load example data" action, so a first-time user can see a fully
 * populated simulation on demand without shipping realistic-looking sample numbers as the
 * app's initial state (Part 9 step 1).
 */
export const EXAMPLE_SNAPSHOT: FinancialSnapshot = {
  incomeSources: [
    {
      id: 'income-salary-1',
      label: 'Salary',
      monthlyAmount: 85000,
      stability: 'stable',
    },
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
    {
      id: 'expense-fixed-1',
      label: 'Rent & Essentials',
      type: 'fixed',
      monthlyAmount: 45000,
    },
    {
      id: 'expense-discretionary-1',
      label: 'Discretionary',
      type: 'discretionary',
      monthlyAmount: 20000,
    },
  ],
  emergencyFund: {
    balance: 150000,
    targetMonths: 6,
    isInvested: false,
  },
  liquidCashOutsideFund: 40000,
  riskProfile: 'balanced',
  debtFallbackOrder: ['debt-personal-1', 'NEW_CREDIT_LINE'],
};

export const EXAMPLE_DECISION: DecisionDiff = {
  kind: 'new_debt',
  debtType: 'auto_loan',
  label: 'Car EMI',
  principal: 600000,
  annualRatePct: 9.0,
  termMonths: 48,
};

export const INITIAL_CONFIG: SimConfig = {
  scenarioCount: 100,
  horizonMonths: 12,
};
