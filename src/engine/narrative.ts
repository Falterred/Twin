/**
 * Part 7 - Scenario Drill-Down, Narrative & Forking
 *
 * The "lived experience" layer: turning one ScenarioTrajectory into a readable story,
 * and letting the user edit a checkpoint and re-simulate forward (forkFromCheckpoint,
 * Part 5).
 *
 * Narrative text is deterministic string templating, never LLM-generated, and is
 * deliberately factual/descriptive rather than advisory. Depends on Parts 5-6.
 */
import type { FinancialSnapshot } from './state';
import type { FiredEvent } from './hazards';
import type { MonthlyCheckpoint, ScenarioTrajectory } from './scenarioRunner';
import { formatRupees } from '../utils/formatters';

// ---------------------------------------------------------------------------
// Exact type contracts
// ---------------------------------------------------------------------------

export type NarrativeLine = {
  month: number;
  text: string;                  // one or two sentences, plain language
  tone: 'neutral' | 'caution' | 'setback' | 'relief'; // drives UI icon/color, see Parts 9-10
  relatedEvents: FiredEvent[];   // the events (if any) that this line describes
};

export type ForkEditableField =
  | { field: 'emergencyFund.balance'; value: number }
  | { field: 'liquidCashOutsideFund'; value: number }
  | { field: `debt.${string}.balance`; value: number }        // template-literal keyed by debtId
  | { field: 'incomeSource.' extends string ? `incomeSource.${string}.monthlyAmount` : never; value: number };

// ---------------------------------------------------------------------------
// Narrative generation
// ---------------------------------------------------------------------------

const TAIL_MEDICAL_MIN_RUPEES = 80000;

const LOST_INCOME_PREFIX = 'Lost income: ';

const DEBT_FIELD_PREFIX = 'debt.';
const DEBT_FIELD_SUFFIX = '.balance';
const INCOME_FIELD_PREFIX = 'incomeSource.';
const INCOME_FIELD_SUFFIX = '.monthlyAmount';

// Severity ranking: lower is more severe. The strict order is
// job_loss > tail medical > housing spike > routine medical > windfall > bonus.
const RANK_JOB_LOSS = 1;
const RANK_TAIL_MEDICAL = 2;
const RANK_HOUSING_SPIKE = 3;
const RANK_ROUTINE_MEDICAL = 4;
const RANK_WINDFALL = 5;
const RANK_BONUS = 6;

function hasTailMedicalAmount(event: FiredEvent): boolean {
  return Math.abs(event.amount) >= TAIL_MEDICAL_MIN_RUPEES;
}

/**
 * A bonus is only narrative-worthy when it actually changed the month: the bonus
 * turned a negative cashflow month into a non-negative one AND, without it, the
 * shortfall would have exceeded the entry liquid cash (i.e. it prevented a fund draw).
 */
function isMeaningfulBonus(event: FiredEvent, checkpoint: MonthlyCheckpoint): boolean {
  if (checkpoint.outcome.emergencyFundDraw > 0) {
    return false;
  }
  const cashWithoutBonus = checkpoint.outcome.cashBeforeResponse - event.amount;
  if (cashWithoutBonus >= 0) {
    return false;
  }
  return -cashWithoutBonus > checkpoint.snapshot.liquidCashOutsideFund;
}

/** Rank of an event for narrative selection, or null when it must stay silent. */
function rankEvent(event: FiredEvent, checkpoint: MonthlyCheckpoint): number | null {
  switch (event.type) {
    case 'job_loss':
      return RANK_JOB_LOSS;
    case 'medical_expense':
      if (hasTailMedicalAmount(event)) {
        return RANK_TAIL_MEDICAL;
      }
      // Routine medicals are noise unless they triggered a fund draw.
      return checkpoint.outcome.emergencyFundDraw > 0 ? RANK_ROUTINE_MEDICAL : null;
    case 'housing_cost_spike':
      return RANK_HOUSING_SPIKE;
    case 'windfall':
      return RANK_WINDFALL;
    case 'bonus':
      return isMeaningfulBonus(event, checkpoint) ? RANK_BONUS : null;
    default:
      // job_regained / market_move have no narrative template in v1.
      return null;
  }
}

function selectHighestSeverityEvent(checkpoint: MonthlyCheckpoint): FiredEvent | null {
  let selected: FiredEvent | null = null;
  let selectedRank = Number.POSITIVE_INFINITY;
  for (const event of checkpoint.firedEvents) {
    const rank = rankEvent(event, checkpoint);
    if (rank !== null && rank < selectedRank) {
      selectedRank = rank;
      selected = event;
    }
  }
  return selected;
}

/** Duration in months of the job loss that fired at fireMonth, read from entry states. */
function unemploymentDuration(trajectory: ScenarioTrajectory, fireMonth: number): number {
  let duration = 0;
  for (let index = fireMonth + 1; index < trajectory.checkpoints.length; index++) {
    if (!trajectory.checkpoints[index].hazardState.isUnemployed) {
      break;
    }
    duration += 1;
  }
  return duration;
}

function jobLossLine(
  trajectory: ScenarioTrajectory,
  checkpoint: MonthlyCheckpoint,
  event: FiredEvent,
): NarrativeLine {
  const sourceLabel = event.label.startsWith(LOST_INCOME_PREFIX)
    ? event.label.slice(LOST_INCOME_PREFIX.length)
    : event.label;
  const backMonth = checkpoint.month + unemploymentDuration(trajectory, checkpoint.month);
  return {
    month: checkpoint.month,
    text: "Month " + checkpoint.month + ": Lost " + sourceLabel + " income. Expected back around month " + backMonth + ".",
    tone: 'setback',
    relatedEvents: [event],
  };
}

/**
 * Fund-draw lines are 'caution' (amber), not 'setback' (rose): an ordinary draw on the
 * emergency fund is less severe than job loss, a tail medical shock, a housing spike or
 * total failure, and Part 10 requires the two severities to be visually distinguishable.
 */
function fundDrawLine(month: number, amount: number, relatedEvents: FiredEvent[]): NarrativeLine {
  return {
    month,
    text: "Month " + month + ": Regular expenses outpaced income; " + formatRupees(amount) + " drawn from the emergency fund.",
    tone: 'caution',
    relatedEvents,
  };
}

function eventLine(
  trajectory: ScenarioTrajectory,
  checkpoint: MonthlyCheckpoint,
  event: FiredEvent,
): NarrativeLine {
  const month = checkpoint.month;
  switch (event.type) {
    case 'job_loss':
      return jobLossLine(trajectory, checkpoint, event);
    case 'medical_expense':
      if (hasTailMedicalAmount(event)) {
        return {
          month,
          text: "Month " + month + ": A major medical expense hit — " + formatRupees(Math.abs(event.amount)) + ".",
          tone: 'setback',
          relatedEvents: [event],
        };
      }
      // Selected routine medical: it only qualifies via a fund draw, so the narrative
      // is the provided fund-draw template.
      return fundDrawLine(month, checkpoint.outcome.emergencyFundDraw, [event]);
    case 'housing_cost_spike':
      return {
        month,
        text: "Month " + month + ": Rent/housing costs jumped by " + formatRupees(Math.abs(event.amount)) + "/month, ongoing for the rest of the year.",
        tone: 'setback',
        relatedEvents: [event],
      };
    case 'windfall':
      return {
        month,
        text: "Month " + month + ": An unexpected " + formatRupees(event.amount) + " windfall.",
        tone: 'relief',
        relatedEvents: [event],
      };
    default:
      // Only a meaningful bonus can reach here (rankEvent filters everything else).
      return {
        month,
        text: "Month " + month + ": A " + formatRupees(event.amount) + " bonus kept this month out of the emergency fund.",
        tone: 'relief',
        relatedEvents: [event],
      };
  }
}

function buildMonthlyLine(
  trajectory: ScenarioTrajectory,
  checkpoint: MonthlyCheckpoint,
): NarrativeLine | null {
  // Total failure overrides every other condition.
  if (checkpoint.outcome.shortfallUncovered > 0) {
    return {
      month: checkpoint.month,
      text: "Month " + checkpoint.month + ": Even after the emergency fund and available credit, " + formatRupees(checkpoint.outcome.shortfallUncovered) + " couldn't be covered this month.",
      tone: 'setback',
      relatedEvents: checkpoint.firedEvents,
    };
  }

  const winner = selectHighestSeverityEvent(checkpoint);
  if (winner !== null) {
    return eventLine(trajectory, checkpoint, winner);
  }

  if (checkpoint.outcome.emergencyFundDraw > 0) {
    return fundDrawLine(checkpoint.month, checkpoint.outcome.emergencyFundDraw, []);
  }

  if (checkpoint.month === 0) {
    return { month: 0, text: "Month 0: Starting position.", tone: 'neutral', relatedEvents: [] };
  }

  if (checkpoint.month === 11) {
    return { month: 11, text: "Month 11: Closing position.", tone: 'neutral', relatedEvents: [] };
  }

  return null;
}

export function generateNarrative(trajectory: ScenarioTrajectory): NarrativeLine[] {
  const lines: NarrativeLine[] = [];
  for (const checkpoint of trajectory.checkpoints) {
    const line = buildMonthlyLine(trajectory, checkpoint);
    if (line !== null) {
      lines.push(line);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Fork edits
// ---------------------------------------------------------------------------

export function applyForkEdits(
  checkpointSnapshot: FinancialSnapshot,
  edits: ForkEditableField[],
): FinancialSnapshot {
  const edited = structuredClone(checkpointSnapshot);

  for (const edit of edits) {
    if (edit.field === 'emergencyFund.balance') {
      edited.emergencyFund.balance = edit.value;
    } else if (edit.field === 'liquidCashOutsideFund') {
      edited.liquidCashOutsideFund = edit.value;
    } else if (edit.field.startsWith(DEBT_FIELD_PREFIX) && edit.field.endsWith(DEBT_FIELD_SUFFIX)) {
      const debtId = edit.field.slice(DEBT_FIELD_PREFIX.length, edit.field.length - DEBT_FIELD_SUFFIX.length);
      const debt = edited.debts.find((entry) => entry.id === debtId);
      if (debt === undefined) {
        throw new Error('Unknown debtId in fork edit: ' + debtId);
      }
      debt.balance = edit.value;
    } else if (edit.field.startsWith(INCOME_FIELD_PREFIX) && edit.field.endsWith(INCOME_FIELD_SUFFIX)) {
      const incomeSourceId = edit.field.slice(INCOME_FIELD_PREFIX.length, edit.field.length - INCOME_FIELD_SUFFIX.length);
      const source = edited.incomeSources.find((entry) => entry.id === incomeSourceId);
      if (source === undefined) {
        throw new Error('Unknown incomeSourceId in fork edit: ' + incomeSourceId);
      }
      source.monthlyAmount = edit.value;
    } else {
      throw new Error('Unknown fork edit field: ' + edit.field);
    }
  }

  return edited;
}
