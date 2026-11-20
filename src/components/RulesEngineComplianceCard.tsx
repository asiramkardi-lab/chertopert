/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * RulesEngineComplianceCard: Studio Sidebar visualization of RulesEngine evaluation
 * (validityScore, idealnessScore, confidenceScore, Hard/Structure/Fibonacci compliance)
 * using an interactive 5-axis SVG Radar Chart and semantic progress bars.
 */

import React, { useMemo, useState } from 'react';
import { Candle, RuleValidationItem, WaveRole, WaveScenario } from '../types/elliott';
import { PATTERN_LABELS_FA, RulesEngine } from '../engine/rulesEngine';
import { ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, Radar } from 'lucide-react';

interface RulesEngineComplianceCardProps {
  scenario: WaveScenario;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
}

interface RadarAxis {
  key: string;
  labelFa: string;
  value: number; // 0..100
  angleDeg: number;
}

export const RulesEngineComplianceCard: React.FC<RulesEngineComplianceCardProps> = ({
  scenario,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = ''
}) => {
  const [viewMode, setViewMode] = useState<'RADAR_BARS' | 'RULE_BREAKDOWN'>('RADAR_BARS');

  const evaluation = useMemo(() => {
    const summary = RulesEngine.validateStructure(
      scenario.patternType,
      scenario.vertices,
      scenario.direction,
      parentRole,
      parentWaveLabel,
      candles
    );

    const hardRules = summary.rules.filter(r => r.type === 'HARD');
    const fibRules = summary.rules.filter(r => r.type === 'FIBONACCI');
    const structRules = summary.rules.filter(r => r.type === 'STRUCTURE' || r.type === 'SOFT');

    const avgScore = (items: RuleValidationItem[], fallback: number): number => {
      if (items.length === 0) return fallback;
      return Math.round(items.reduce((acc, item) => acc + item.score, 0) / items.length);
    };

    const hardPassCount = hardRules.filter(r => r.passed).length;
    const hardRate =
      hardRules.length > 0 ? Math.round((hardPassCount / hardRules.length) * 100) : summary.isValid ? 100 : 0;
    const fibAvg = avgScore(fibRules, summary.idealnessScore);
    const structAvg = avgScore(structRules, summary.validityScore);

    const softFailsCount = summary.rules.filter(r => r.type !== 'HARD' && !r.passed).length;
    const statusTone: 'VALID' | 'WARNING' | 'INVALID' = !summary.isValid
      ? 'INVALID'
      : softFailsCount > 0 || summary.validityScore < 85
      ? 'WARNING'
      : 'VALID';

    return {
      summary,
      hardRules,
      fibRules,
      structRules,
      hardPassCount,
      hardRate,
      fibAvg,
      structAvg,
      fibPassCount: fibRules.filter(r => r.passed).length,
      structPassCount: structRules.filter(r => r.passed).length,
      statusTone
    };
  }, [scenario.patternType, scenario.vertices, scenario.direction, parentRole, parentWaveLabel, candles]);

  const { summary, statusTone } = evaluation;

  // 5-axis radar math (0..100 mapped onto concentric pentagons)
  const axes: RadarAxis[] = useMemo(
    () => [
      { key: 'validity', labelFa: 'اعتبار', value: summary.validityScore, angleDeg: -90 },
      { key: 'idealness', labelFa: 'ایده‌آل', value: summary.idealnessScore, angleDeg: -18 },
      { key: 'confidence', labelFa: 'اطمینان', value: summary.confidenceScore, angleDeg: 54 },
      { key: 'fib', labelFa: 'فیبوناچی', value: evaluation.fibAvg, angleDeg: 126 },
      { key: 'hard', labelFa: 'قوانین سخت', value: evaluation.hardRate, angleDeg: 198 }
    ],
    [summary.validityScore, summary.idealnessScore, summary.confidenceScore, evaluation.fibAvg, evaluation.hardRate]
  );

  const cx = 110;
  const cy = 96;
  const maxR = 62;

  const polarPoint = (angleDeg: number, pct: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const r = (Math.max(0, Math.min(100, pct)) / 100) * maxR;
    return {
      x: Math.round((cx + r * Math.cos(rad)) * 10) / 10,
      y: Math.round((cy + r * Math.sin(rad)) * 10) / 10
    };
  };

  const dataPoints = axes.map(ax => polarPoint(ax.angleDeg, ax.value));
  const dataPolygon = dataPoints.map(pt => `${pt.x},${pt.y}`).join(' ');

  const radarStroke =
    statusTone === 'VALID' ? '#10b981' : statusTone === 'WARNING' ? '#f59e0b' : '#f43f5e';
  const radarFill =
    statusTone === 'VALID'
      ? 'rgba(16, 185, 129, 0.22)'
      : statusTone === 'WARNING'
      ? 'rgba(245, 158, 11, 0.22)'
      : 'rgba(244, 63, 94, 0.22)';

  const primaryBars = [
    {
      key: 'validity',
      label: 'نمره اعتبار (Validity)',
      value: summary.validityScore,
      barColor:
        summary.validityScore >= 80
          ? 'bg-emerald-500'
          : summary.validityScore >= 50
          ? 'bg-amber-500'
          : 'bg-rose-500',
      textColor:
        summary.validityScore >= 80
          ? 'text-emerald-300'
          : summary.validityScore >= 50
          ? 'text-amber-300'
          : 'text-rose-300'
    },
    {
      key: 'idealness',
      label: 'شاخص ایده‌آل بودن (Idealness)',
      value: summary.idealnessScore,
      barColor:
        summary.idealnessScore >= 80
          ? 'bg-cyan-400'
          : summary.idealnessScore >= 50
          ? 'bg-amber-400'
          : 'bg-rose-500',
      textColor:
        summary.idealnessScore >= 80
          ? 'text-cyan-300'
          : summary.idealnessScore >= 50
          ? 'text-amber-300'
          : 'text-rose-300'
    },
    {
      key: 'confidence',
      label: 'سطح اطمینان (Confidence)',
      value: summary.confidenceScore,
      barColor:
        summary.confidenceScore >= 80
          ? 'bg-indigo-400'
          : summary.confidenceScore >= 50
          ? 'bg-amber-400'
          : 'bg-rose-500',
      textColor:
        summary.confidenceScore >= 80
          ? 'text-indigo-300'
          : summary.confidenceScore >= 50
          ? 'text-amber-300'
          : 'text-rose-300'
    }
  ];

  const statusText =
    statusTone === 'VALID'
      ? 'انطباق کامل'
      : statusTone === 'WARNING'
      ? 'معتبر با هشدار'
      : 'نقض قانون سخت';

  const statusTextColor =
    statusTone === 'VALID'
      ? 'text-emerald-400'
      : statusTone === 'WARNING'
      ? 'text-amber-300'
      : 'text-rose-400';

  return (
    <section
      aria-label="شاخص‌های ارزیابی موتور قوانین"
      className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden"
    >
      {/* Header Row */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusTone === 'VALID' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : statusTone === 'WARNING' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span className="truncate">پایش بصری موتور قوانین</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className={`text-[11px] font-semibold whitespace-nowrap ${statusTextColor}`}>
                {statusText}
              </span>
            </div>
            <div className="text-[10.5px] text-slate-400 truncate mt-0.5">
              {PATTERN_LABELS_FA[scenario.patternType].split('(')[0].trim()} · {scenario.vertices.length} پیوت
            </div>
          </div>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('RADAR_BARS')}
            title="نمایش رادار و نوار پیشرفت"
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              viewMode === 'RADAR_BARS'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radar className="w-3 h-3" />
            <span>رادار</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('RULE_BREAKDOWN')}
            title="نمایش نوار امتیاز تک‌تک قوانین"
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              viewMode === 'RULE_BREAKDOWN'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>قوانین</span>
          </button>
        </div>
      </div>

      {/* Main Visualization Body */}
      {viewMode === 'RADAR_BARS' ? (
        <div className="p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* 5-Axis SVG Compliance Radar Chart */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center">
            <svg
              viewBox="0 0 220 192"
              className="w-full max-w-[200px] h-auto select-none"
              role="img"
              aria-label={`نمودار رادار قوانین: اعتبار ${summary.validityScore} درصد، ایده‌آل ${summary.idealnessScore} درصد، اطمینان ${summary.confidenceScore} درصد`}
            >
              {/* Concentric Grid Pentagons (25%, 50%, 75%, 100%) */}
              {[25, 50, 75, 100].map(level => {
                const ringPts = axes
                  .map(ax => {
                    const pt = polarPoint(ax.angleDeg, level);
                    return `${pt.x},${pt.y}`;
                  })
                  .join(' ');
                return (
                  <polygon
                    key={level}
                    points={ringPts}
                    fill="none"
                    stroke={level === 100 ? '#334155' : '#1e293b'}
                    strokeWidth={level === 100 ? 1.2 : 0.9}
                    strokeDasharray={level === 50 ? '2.5 2.5' : undefined}
                  />
                );
              })}

              {/* Radial Spokes */}
              {axes.map(ax => {
                const outer = polarPoint(ax.angleDeg, 100);
                return (
                  <line
                    key={ax.key}
                    x1={cx}
                    y1={cy}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="#1e293b"
                    strokeWidth={1}
                  />
                );
              })}

              {/* Active Score Polygon */}
              <polygon
                points={dataPolygon}
                fill={radarFill}
                stroke={radarStroke}
                strokeWidth={2}
                strokeLinejoin="round"
                style={{ transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
              />

              {/* Vertex Dots */}
              {dataPoints.map((pt, idx) => (
                <circle
                  key={axes[idx].key}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.2}
                  fill={radarStroke}
                  stroke="#0f172a"
                  strokeWidth={1.2}
                />
              ))}

              {/* Axis Labels */}
              {axes.map(ax => {
                const labelPt = polarPoint(ax.angleDeg, 126);
                const anchor =
                  Math.abs(labelPt.x - cx) < 10
                    ? 'middle'
                    : labelPt.x > cx
                    ? 'start'
                    : 'end';
                return (
                  <text
                    key={`lbl-${ax.key}`}
                    x={labelPt.x}
                    y={labelPt.y}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    className="fill-slate-300 text-[9.5px] font-medium"
                  >
                    {ax.labelFa}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Validity, Idealness, Confidence Progress Bars */}
          <div className="sm:col-span-7 space-y-2.5">
            {primaryBars.map(metric => (
              <div key={metric.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-300 font-medium truncate">{metric.label}</span>
                  <span className={`font-mono font-bold tabular-nums shrink-0 ${metric.textColor}`}>
                    {metric.value}%
                  </span>
                </div>
                <div
                  className="h-2 rounded-full bg-slate-950 border border-slate-800/90 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={metric.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={metric.label}
                >
                  <div
                    className={`h-full rounded-full ${metric.barColor} transition-all duration-200`}
                    style={{ width: `${Math.max(3, Math.min(100, metric.value))}%` }}
                  />
                </div>
              </div>
            ))}

            {/* Quick Category Totals */}
            <div className="pt-1.5 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-[10.5px] font-mono tabular-nums">
              <div>
                <div className="text-slate-500">سخت</div>
                <div className={evaluation.hardPassCount === evaluation.hardRules.length ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                  {evaluation.hardPassCount}/{evaluation.hardRules.length}
                </div>
              </div>
              <div>
                <div className="text-slate-500">ساختار</div>
                <div className="text-cyan-300 font-bold">
                  {evaluation.structPassCount}/{evaluation.structRules.length}
                </div>
              </div>
              <div>
                <div className="text-slate-500">فیبو</div>
                <div className="text-indigo-300 font-bold">
                  {evaluation.fibPassCount}/{evaluation.fibRules.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Per-Rule Score Progress List */
        <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto">
          {summary.rules.map(rule => (
            <div key={rule.ruleId} className="px-3.5 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="text-slate-200 font-medium truncate">{rule.nameFa}</span>
                <span
                  className={`font-mono font-bold tabular-nums shrink-0 ${
                    rule.passed
                      ? 'text-emerald-400'
                      : rule.type === 'HARD'
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }`}
                >
                  {rule.score}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    rule.passed
                      ? 'bg-emerald-500'
                      : rule.type === 'HARD'
                      ? 'bg-rose-500'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.max(4, Math.min(100, rule.score))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clean Footer Metadata Strip (No Static Pills) */}
      <div className="px-3.5 py-2 bg-slate-950/65 border-t border-slate-800 flex items-center justify-between gap-2 text-[10.5px] text-slate-400 font-mono tabular-nums">
        <span>
          ابطال:{' '}
          <strong className="text-slate-200">
            {summary.invalidationPrice > 0 ? summary.invalidationPrice.toLocaleString() : '--'}
          </strong>
        </span>
        <span className="text-slate-600" aria-hidden="true">·</span>
        <span>
          امتیاز کل قوانین:{' '}
          <strong className="text-slate-200">
            {summary.rules.filter(r => r.passed).length}/{summary.rules.length}
          </strong>
        </span>
      </div>
    </section>
  );
};
