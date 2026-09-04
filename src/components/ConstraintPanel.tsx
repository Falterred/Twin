// ─────────────────────────────────────────────────────────────
// ConstraintPanel — Financial input sliders & selects
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  CreditCard,
  PiggyBank,
  Calendar,
  Percent,
} from 'lucide-react';
import type { RawInputs, Urgency, IncomeStability } from '../engine/constants';
import { formatINR } from '../utils';
import { HelpTooltip } from './HelpTooltip';

interface ConstraintPanelProps {
  inputs: RawInputs;
  onChange: (patch: Partial<RawInputs>) => void;
}

/* ─── Slider Config ─── */

interface SliderDef {
  key: keyof RawInputs;
  label: string;
  help?: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  suffix?: string;
}

const formatRupee = (v: number) => formatINR(v);
const formatMonths = (v: number) => `${v} mo`;
const formatPct = (v: number) => `${v}%`;

const CASH_SLIDERS: SliderDef[] = [
  { key: 'liquidCash',      label: 'Liquid Cash',        help: 'Money in your bank account available for emergency or down payment',        icon: <Wallet className="w-4 h-4" />,      min: 0,      max: 10_00_000, step: 5000,  format: formatRupee },
  { key: 'monthlyIncome',   label: 'Monthly Income',     help: 'Your average monthly take-home pay (after taxes & deductions)',     icon: <TrendingUp className="w-4 h-4" />,  min: 10_000, max: 5_00_000,  step: 5000,  format: formatRupee },
  { key: 'monthlyExpenses', label: 'Monthly Expenses',   help: 'Fixed monthly costs: rent, food, utilities, insurance, etc.',   icon: <IndianRupee className="w-4 h-4" />, min: 5_000,  max: 3_00_000,  step: 2500,  format: formatRupee },
  { key: 'existingEMI',     label: 'Existing EMI',       help: 'Any ongoing loan payments (car, credit card, personal loan)',       icon: <CreditCard className="w-4 h-4" />,  min: 0,      max: 1_00_000,  step: 1000,  format: formatRupee },
];

const PURCHASE_SLIDERS: SliderDef[] = [
  { key: 'itemPrice',          label: 'Item Price',         help: 'Full retail price of the item you want to buy', icon: <ShoppingCart className="w-4 h-4" />, min: 5_000, max: 10_00_000, step: 5000, format: formatRupee },
  { key: 'emergencyFundMonths', label: 'Emergency Buffer',  help: 'Target months of expenses to keep as savings (6 mo is recommended)',  icon: <PiggyBank className="w-4 h-4" />,   min: 1,     max: 12,        step: 1,    format: formatMonths },
  { key: 'emiTenureMonths',    label: 'EMI Tenure',         help: 'How many months to spread loan payments (12 months is common)',         icon: <Calendar className="w-4 h-4" />,    min: 3,     max: 36,        step: 1,    format: formatMonths },
  { key: 'emiAnnualRatePct',   label: 'EMI Interest Rate',  help: 'Annual interest rate on loan (typical: 12–14% for personal loans)',  icon: <Percent className="w-4 h-4" />,     min: 0,     max: 30,        step: 0.5,  format: formatPct },
];

/* ─── Section Accordion ─── */

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const sectionId = `section-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="glass-card p-4 hover:border-blue-400/40 dark:hover:border-blue-600/40
      transition-all duration-200 group">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={sectionId}
        className="flex items-center justify-between w-full text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">{icon}</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</span>
        </div>
        <div className="transition-transform duration-300">
          {open ? (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
          )}
        </div>
      </button>
      {open && (
        <div id={sectionId} className="mt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Single Slider ─── */

interface SliderRowProps {
  def: SliderDef;
  value: number;
  onChange: (v: number) => void;
}

function SliderRow({ def, value, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor={`slider-${String(def.key)}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            {def.icon}
            <span className="group">{def.label}</span>
          </label>
          {def.help && <HelpTooltip text={def.help} />}
        </div>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg tabular-nums
          transition-all duration-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400">
          {def.format(value)}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          id={`slider-${String(def.key)}`}
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-blue-500 hover:accent-blue-600 transition-all duration-200
            cursor-pointer h-2 rounded-full bg-slate-200 dark:bg-slate-700
            appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-blue-500
            [&::-webkit-slider-thumb]:to-blue-600 [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
            [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200
            [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-lg
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-blue-500
            [&::-moz-range-thumb]:to-blue-600 [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab
            [&::-moz-range-thumb]:active:cursor-grabbing"
        />
      </div>
    </div>
  );
}

/* ─── Select Dropdown ─── */

interface SelectRowProps {
  label: string;
  help?: string;
  icon: React.ReactNode;
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

function SelectRow({ label, help, icon, id, value, options, onChange }: SelectRowProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          {icon}
          {label}
        </label>
        {help && <HelpTooltip text={help} />}
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-medium px-3 py-2 rounded-xl border
          border-slate-200 dark:border-slate-700
          bg-white dark:bg-slate-800
          text-slate-900 dark:text-slate-100
          focus:outline-none focus:ring-2 focus:ring-blue-500/40
          transition-all cursor-pointer hover:border-blue-400 dark:hover:border-blue-600"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Main Panel ─── */

const URGENCY_OPTIONS = [
  { value: 'urgent', label: 'Urgent — need it now' },
  { value: 'can_wait', label: 'Can wait a few months' },
  { value: 'nice_to_have', label: 'Nice to have — flexible' },
];

const STABILITY_OPTIONS = [
  { value: 'stable', label: 'Stable — salaried / predictable' },
  { value: 'variable', label: 'Variable — freelance / seasonal' },
];

export function ConstraintPanel({ inputs, onChange }: ConstraintPanelProps) {
  function handleSlider(key: keyof RawInputs) {
    return (v: number) => onChange({ [key]: v });
  }

  return (
    <aside className="flex flex-col gap-3 w-full">
      {/* Cash & Income */}
      <Section title="Cash & Income" icon={<Wallet className="w-4 h-4" />}>
        {CASH_SLIDERS.map((def) => (
          <SliderRow
            key={String(def.key)}
            def={def}
            value={inputs[def.key] as number}
            onChange={handleSlider(def.key)}
          />
        ))}
      </Section>

      {/* Purchase & Loan */}
      <Section title="Purchase & Loan" icon={<ShoppingCart className="w-4 h-4" />}>
        {PURCHASE_SLIDERS.map((def) => (
          <SliderRow
            key={String(def.key)}
            def={def}
            value={inputs[def.key] as number}
            onChange={handleSlider(def.key)}
          />
        ))}
      </Section>

      {/* Preferences */}
      <Section title="Preferences" icon={<TrendingUp className="w-4 h-4" />} defaultOpen={false}>
        <SelectRow
          label="Purchase Urgency"
          help="How soon do you need to make the purchase?"
          icon={<Calendar className="w-4 h-4" />}
          id="select-urgency"
          value={inputs.urgency}
          options={URGENCY_OPTIONS}
          onChange={(v) => onChange({ urgency: v as Urgency })}
        />
        <SelectRow
          label="Income Stability"
          help="Is your income consistent or does it vary by season/project?"
          icon={<TrendingUp className="w-4 h-4" />}
          id="select-stability"
          value={inputs.incomeStability}
          options={STABILITY_OPTIONS}
          onChange={(v) => onChange({ incomeStability: v as IncomeStability })}
        />
      </Section>
    </aside>
  );
}
