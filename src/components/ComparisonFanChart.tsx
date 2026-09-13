/**
 * Part 8 - Component 5: ComparisonFanChart
 *
 * Core comparison visualization using a Recharts ComposedChart. Renders two 12-month
 * percentile bands (p10-p90) with median p50 lines for the baseline (slate) and the
 * decision (blue) twin.
 *
 * Props: baselineBands: MonthlyBand[], decisionBands: MonthlyBand[],
 *        showIndividualLines: boolean,
 *        individualBaselineSample: ScenarioTrajectory[],
 *        individualDecisionSample: ScenarioTrajectory[],
 *        onToggleIndividualLines: () => void,
 *        onSelectScenario: (trajectory: ScenarioTrajectory) => void
 *
 * Notes:
 *   - Accessible data table fallback toggle ("View as Table") for screen readers.
 *   - Colorblind accessibility: distinct dashed/solid stroke styling in addition to hue.
 *   - Up to 20 individual clickable scenario lines when toggled (sampling is Part 9's job).
 *   - Indian currency tooltips.
 */
import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Eye, Table, LineChart as ChartIcon } from 'lucide-react';
import type { MonthlyBand } from '../engine/aggregation';
import type { ScenarioTrajectory } from '../engine/scenarioRunner';
import { formatRupees, formatRupeesCompact } from '../utils/formatters';

export interface ComparisonFanChartProps {
  baselineBands: MonthlyBand[];
  decisionBands: MonthlyBand[];
  showIndividualLines: boolean;
  individualBaselineSample: ScenarioTrajectory[];
  individualDecisionSample: ScenarioTrajectory[];
  onToggleIndividualLines: () => void;
  onSelectScenario: (trajectory: ScenarioTrajectory) => void;
}

interface ChartDataPoint {
  month: string;
  monthIndex: number;
  baselineP10: number;
  baselineP50: number;
  baselineP90: number;
  baselineRange: [number, number];
  decisionP10: number;
  decisionP50: number;
  decisionP90: number;
  decisionRange: [number, number];
  [key: string]: unknown;
}

export function ComparisonFanChart({
  baselineBands,
  decisionBands,
  showIndividualLines,
  individualBaselineSample,
  individualDecisionSample,
  onToggleIndividualLines,
  onSelectScenario,
}: ComparisonFanChartProps) {
  const [showTableFallback, setShowTableFallback] = useState(false);

  // Prepare combined data array for 12 months
  const chartData: ChartDataPoint[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, month) => {
      const base = baselineBands[month] ?? { p10: 0, p50: 0, p90: 0 };
      const dec = decisionBands[month] ?? { p10: 0, p50: 0, p90: 0 };

      const point: ChartDataPoint = {
        month: `M${month}`,
        monthIndex: month,
        baselineP10: base.p10,
        baselineP50: base.p50,
        baselineP90: base.p90,
        baselineRange: [base.p10, base.p90],
        decisionP10: dec.p10,
        decisionP50: dec.p50,
        decisionP90: dec.p90,
        decisionRange: [dec.p10, dec.p90],
      };

      if (showIndividualLines) {
        individualBaselineSample.forEach((t) => {
          const outcome = t.checkpoints[month]?.outcome;
          if (outcome) {
            point[`base_line_${t.scenarioIndex}`] = outcome.endingCash + outcome.endingFundBalance;
          }
        });
        individualDecisionSample.forEach((t) => {
          const outcome = t.checkpoints[month]?.outcome;
          if (outcome) {
            point[`dec_line_${t.scenarioIndex}`] = outcome.endingCash + outcome.endingFundBalance;
          }
        });
      }

      return point;
    });
  }, [
    baselineBands,
    decisionBands,
    showIndividualLines,
    individualBaselineSample,
    individualDecisionSample,
  ]);

  return (
    <div className="card-surface rounded-xl p-6 space-y-4">
      {/* Header with Title and View Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            12-Month Total Accessible Cash Range (p10–p90)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Liquid cash + emergency fund balance across all simulated scenarios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Accessible Table Fallback Toggle */}
          <button
            type="button"
            onClick={() => setShowTableFallback(!showTableFallback)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle accessible data table view"
          >
            {showTableFallback ? (
              <>
                <ChartIcon className="w-3.5 h-3.5 text-blue-600" /> Show Fan Chart
              </>
            ) : (
              <>
                <Table className="w-3.5 h-3.5 text-slate-500" /> View as Table
              </>
            )}
          </button>

          {/* Individual Scenarios Toggle */}
          <button
            type="button"
            onClick={onToggleIndividualLines}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              showIndividualLines
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Show individual scenarios</span>
          </button>
        </div>
      </div>

      {/* Main View: Chart or Table */}
      {showTableFallback ? (
        /* Accessible Table Fallback */
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-900 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">Month</th>
                <th scope="col" className="px-3 py-2 text-right">Baseline p10</th>
                <th scope="col" className="px-3 py-2 text-right">Baseline Median</th>
                <th scope="col" className="px-3 py-2 text-right">Baseline p90</th>
                <th scope="col" className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">Decision p10</th>
                <th scope="col" className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">Decision Median</th>
                <th scope="col" className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">Decision p90</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {chartData.map((row) => (
                <tr key={row.monthIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                  <td className="px-3 py-1.5 font-medium">Month {row.monthIndex}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatRupees(row.baselineP10)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{formatRupees(row.baselineP50)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatRupees(row.baselineP90)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-blue-600 dark:text-blue-400">{formatRupees(row.decisionP10)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium text-blue-600 dark:text-blue-400">{formatRupees(row.decisionP50)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-blue-600 dark:text-blue-400">{formatRupees(row.decisionP90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Visual Recharts Fan Chart */
        <div className="h-84 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.15} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                tickFormatter={formatRupeesCompact}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0]?.payload as ChartDataPoint;
                  if (!d) return null;
                  return (
                    <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs space-y-2">
                      <div className="font-semibold text-slate-300 border-b border-slate-700 pb-1">
                        Month {d.monthIndex} Range
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">Baseline (Median):</span>
                          <span className="font-mono font-medium">{formatRupees(d.baselineP50)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          p10: {formatRupees(d.baselineP10)} · p90: {formatRupees(d.baselineP90)}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t border-slate-800">
                        <div className="flex items-center justify-between gap-4 text-blue-400">
                          <span className="font-medium">With Decision:</span>
                          <span className="font-mono font-bold">{formatRupees(d.decisionP50)}</span>
                        </div>
                        <div className="text-[10px] text-blue-400/70 font-mono">
                          p10: {formatRupees(d.decisionP10)} · p90: {formatRupees(d.decisionP90)}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="plainline"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
              />

              {/* Baseline Band & Median Line */}
              <Area
                type="monotone"
                dataKey="baselineRange"
                fill="#64748b"
                fillOpacity={0.16}
                stroke="none"
                name="Baseline Range (p10–p90)"
              />
              <Line
                type="monotone"
                dataKey="baselineP50"
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="Baseline Median"
              />

              {/* Decision Band & Median Line */}
              <Area
                type="monotone"
                dataKey="decisionRange"
                fill="#2563eb"
                fillOpacity={0.22}
                stroke="none"
                name="With Decision Range (p10–p90)"
              />
              <Line
                type="monotone"
                dataKey="decisionP50"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                name="Decision Median"
              />

              {/* Optional individual line overlays */}
              {showIndividualLines &&
                individualBaselineSample.map((t) => (
                  <Line
                    key={`base-${t.scenarioIndex}`}
                    type="monotone"
                    dataKey={`base_line_${t.scenarioIndex}`}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeOpacity={0.25}
                    dot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />
                ))}

              {showIndividualLines &&
                individualDecisionSample.map((t) => (
                  <Line
                    key={`dec-${t.scenarioIndex}`}
                    type="monotone"
                    dataKey={`dec_line_${t.scenarioIndex}`}
                    stroke="#2563eb"
                    strokeWidth={1.2}
                    strokeOpacity={0.4}
                    dot={false}
                    legendType="none"
                    isAnimationActive={false}
                    className="cursor-pointer hover:stroke-amber-400 transition-colors"
                    onClick={() => onSelectScenario(t)}
                    activeDot={{
                      r: 4,
                      onClick: () => onSelectScenario(t),
                      className: 'cursor-pointer',
                    }}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {showIndividualLines && !showTableFallback && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center italic">
          Tip: Hover over or click individual blue lines to inspect that specific trajectory in the drilldown log.
        </p>
      )}
    </div>
  );
}
