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

interface ConstraintPanelProps {
  inputs: RawInputs;
  onChange: (patch: Partial<RawInputs>) => void;
}

/* ─── Slider Config ─── */

interface SliderDef {
  key: keyof RawInputs;
  label: string;
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
  { key: 'liquidCash',      label: 'Liquid Cash',        icon: <Wallet className="w-4 h-4" />,      min: 0,      max: 10_00_000, step: 5000,  format: formatRupee },
  { key: 'monthlyIncome',   label: 'Monthly Income',     icon: <TrendingUp className="w-4 h-4" />,  min: 10_000, max: 5_00_000,  step: 5000,  format: formatRupee },
  { key: 'monthlyExpenses', label: 'Monthly Expenses',   icon: <IndianRupee className="w-4 h-4" />, min: 5_000,  max: 3_00_000,  step: 2500,  format: formatRupee },
  { key: 'existingEMI',     label: 'Existing EMI',       icon: <CreditCard className="w-4 h-4" />,  min: 0,      max: 1_00_000,  step: 1000,  format: formatRupee },
];

const PURCHASE_SLIDERS: SliderDef[] = [
  { key: 'itemPrice',          label: 'Item Price',         icon: <ShoppingCart className="w-4 h-4" />, min: 5_000, max: 10_00_000, step: 5000, format: formatRupee },
  { key: 'emergencyFundMonths', label: 'Emergency Buffer',  icon: <PiggyBank className="w-4 h-4" />,   min: 1,     max: 12,        step: 1,    format: formatMonths },
  { key: 'emiTenureMonths',    label: 'EMI Tenure',         icon: <Calendar className="w-4 h-4" />,    min: 3,     max: 36,        step: 1,    format: formatMonths },
  { key: 'emiAnnualRatePct',   label: 'EMI Interest Rate',  icon: <Percent className="w-4 h-4" />,     min: 0,     max: 30,        step: 0.5,  format: formatPct },
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
    <div className="glass-card p-4">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={sectionId}
        className="flex items-center justify-between w-full text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-500 dark:text-blue-400">{icon}</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div id={sectionId} className="mt-4 flex flex-col gap-5">{children}</div>}
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
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={`slider-${String(def.key)}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          {def.icon}
          {def.label}
        </label>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md tabular-nums">
          {def.format(value)}
        </span>
      </div>
      <input
        type="range"
        id={`slider-${String(def.key)}`}
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

/* ─── Select Dropdown ─── */

interface SelectRowProps {
  label: string;
  icon: React.ReactNode;
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

function SelectRow({ label, icon, id, value, options, onChange }: SelectRowProps) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
        {icon}
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-medium px-3 py-2 rounded-xl border
          border-slate-200 dark:border-slate-700
          bg-white dark:bg-slate-800
          text-slate-900 dark:text-slate-100
          focus:outline-none focus:ring-2 focus:ring-blue-500/40
          transition-all cursor-pointer"
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
          icon={<Calendar className="w-4 h-4" />}
          id="select-urgency"
          value={inputs.urgency}
          options={URGENCY_OPTIONS}
          onChange={(v) => onChange({ urgency: v as Urgency })}
        />
        <SelectRow
          label="Income Stability"
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
