// ─────────────────────────────────────────────────────────────
// TimelineChart — Recharts ComposedChart for both modes
// ─────────────────────────────────────────────────────────────

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { SimMode } from '../engine/constants';
import type { ActionResult } from '../engine/scoring';
import type { ProbabilisticActionResult } from '../engine/probabilistic';
import { formatINR } from '../utils';

/* ─── Props ─── */

interface TimelineChartProps {
  mode: SimMode;
  deterministicResults?: ActionResult[];
  probabilisticResults?: ProbabilisticActionResult[];
  emergencyFundTarget: number;
}

/* ─── Custom Tooltip ─── */

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="glass-card p-3 !rounded-xl text-xs shadow-xl max-w-xs">
      <p className="font-semibold text-slate-900 dark:text-slate-50 mb-2">
        Month {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload
          .filter((p) => p.value !== undefined && !String(p.dataKey ?? '').endsWith('_band'))
          .map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: p.color }}
                />
                <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                  {p.name}
                </span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatINR(p.value ?? 0)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ─── Chart Data Transforms ─── */

function buildDeterministicData(results: ActionResult[]) {
  const months = 13;
  return Array.from({ length: months }, (_, i) => {
    const point: Record<string, number> = { month: i };
    for (const r of results) {
      if (r.timeline[i]) {
        point[r.id] = Math.round(r.timeline[i].liquidCash);
      }
    }
    return point;
  });
}

function buildProbabilisticData(results: ProbabilisticActionResult[]) {
  const months = 13;
  return Array.from({ length: months }, (_, i) => {
    const point: Record<string, number> = { month: i };
    for (const r of results) {
      if (r.timeline[i]) {
        point[`${r.id}_p50`] = Math.round(r.timeline[i].p50);
        point[`${r.id}_band`] = [
          Math.round(r.timeline[i].p10),
          Math.round(r.timeline[i].p90),
        ] as unknown as number;
      }
    }
    return point;
  });
}

/* ─── Main Component ─── */

export function TimelineChart({
  mode,
  deterministicResults,
  probabilisticResults,
  emergencyFundTarget,
}: TimelineChartProps) {
  const isDeterministic = mode === 'deterministic';
  const results = isDeterministic ? deterministicResults : probabilisticResults;

  if (!results || results.length === 0) {
    return (
      <div className="glass-card p-8 flex items-center justify-center h-[400px]">
        <p className="text-sm text-slate-400">No simulation data available</p>
      </div>
    );
  }

  const data = isDeterministic
    ? buildDeterministicData(deterministicResults!)
    : buildProbabilisticData(probabilisticResults!);
  const chartSummary = isDeterministic
    ? `Deterministic projection showing liquid cash for ${results.length} strategies from month 0 through month 12.`
    : `Monte Carlo projection showing p10 to p90 liquid-cash ranges for ${results.length} strategies from month 0 through month 12.`;

  return (
    <section className="glass-card p-4 sm:p-6" aria-labelledby="timeline-chart-title">
      <h2 id="timeline-chart-title" className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4">
        12-Month Liquid Cash Projection
        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
          {isDeterministic ? '(Deterministic)' : '(Monte Carlo p10–p90)'}
        </span>
      </h2>
      <p className="sr-only">{chartSummary}</p>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `M${v}`}
            stroke="currentColor"
            className="text-slate-400"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => {
              if (Math.abs(v) >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
              if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
              return String(v);
            }}
            stroke="currentColor"
            className="text-slate-400"
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />

          {/* Emergency fund target reference */}
          <ReferenceLine
            y={emergencyFundTarget}
            stroke="#ef4444"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `EF Target ${formatINR(emergencyFundTarget)}`,
              position: 'right',
              style: { fontSize: 10, fill: '#ef4444' },
            }}
          />

          {isDeterministic
            ? /* Deterministic: solid lines */
              results.map((r) => (
                <Line
                  key={r.id}
                  type="monotone"
                  dataKey={r.id}
                  name={r.label}
                  stroke={r.color}
                  strokeWidth={r.disqualified ? 1 : 2.5}
                  strokeDasharray={r.disqualified ? '4 4' : undefined}
                  dot={false}
                  opacity={r.disqualified ? 0.4 : 1}
                  animationDuration={600}
                />
              ))
            : /* Probabilistic: area bands + median line */
              (results as ProbabilisticActionResult[]).flatMap((r) => [
                <Area
                  key={`${r.id}_area`}
                  type="monotone"
                  dataKey={`${r.id}_band`}
                  name={`${r.label} (p10–p90)`}
                  fill={r.color}
                  stroke="none"
                  fillOpacity={r.disqualified ? 0.05 : 0.12}
                  legendType="none"
                  animationDuration={600}
                />,
                <Line
                  key={`${r.id}_median`}
                  type="monotone"
                  dataKey={`${r.id}_p50`}
                  name={r.label}
                  stroke={r.color}
                  strokeWidth={r.disqualified ? 1 : 2}
                  strokeDasharray={r.disqualified ? '4 4' : undefined}
                  dot={false}
                  opacity={r.disqualified ? 0.4 : 1}
                  animationDuration={600}
                />,
              ])
          }
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
