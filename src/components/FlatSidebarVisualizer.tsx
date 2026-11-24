/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Studio Sidebar Flat Pattern (3-3-5) Visualizer & 61.8% B-Wave Verifier
 * Visualizes Regular, Irregular, and Running Flat geometries, verifies B-wave retracement
 * against the 61.8% threshold, and integrates live RulesEngine pattern classification flags.
 */

import React, { useMemo, useState } from 'react';
import { Candle, FlatSubtype, PatternFamily, WaveRole, WaveScenario } from '../types/elliott';
import { RulesEngine, PATTERN_LABELS_FA, isExcludedFlat } from '../engine/rulesEngine';
import { PatternEngines } from '../engine/patternEngines';
import {
  Layers,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  ArrowUpLeft,
  SlidersHorizontal
} from 'lucide-react';

interface FlatSidebarVisualizerProps {
  scenario: WaveScenario;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onApplyPattern?: (pattern: PatternFamily) => void;
  compact?: boolean;
}

type StructureSelectionMode = 'AUTO' | '3-3-5' | '3-3-3' | '5-3-5';
type FlatVariantFocus = 'AUTO' | FlatSubtype;

const EIGHT_SUBTYPE_MATRIX: Array<{
  id: FlatSubtype;
  en: string;
  fa: string;
  bRule: string;
  cRule: string;
  targetPattern: PatternFamily;
  sampleB: number;
  sampleC: number;
  riskTag?: string;
}> = [
  {
    id: 'REGULAR',
    en: 'Regular',
    fa: 'متعارف',
    bRule: 'B: ۸۱–۱۰۰٪',
    cRule: 'C: ۸۱–۱۰۰٪',
    targetPattern: 'FLAT_REGULAR',
    sampleB: 90,
    sampleC: 90
  },
  {
    id: 'B_DEFICIENT',
    en: 'B-Deficient',
    fa: 'ناقص B',
    bRule: 'B: ۶۱.۸–۸۱٪',
    cRule: 'C: ۸۱–۱۰۰٪',
    targetPattern: 'FLAT_REGULAR',
    sampleB: 70,
    sampleC: 90
  },
  {
    id: 'C_DEFICIENT',
    en: 'C-Deficient',
    fa: 'ناقص C',
    bRule: 'B: ۸۱–۱۰۰٪',
    cRule: 'C: ۶۱.۸–۸۱٪',
    targetPattern: 'FLAT_REGULAR',
    sampleB: 90,
    sampleC: 70,
    riskTag: 'پرریسک'
  },
  {
    id: 'DOUBLE_DEFICIENT',
    en: 'Double-Deficient',
    fa: 'ناقص دوگانه',
    bRule: 'B: ۶۱.۸–۸۱٪',
    cRule: 'C: ۶۱.۸–۸۱٪',
    targetPattern: 'FLAT_REGULAR',
    sampleB: 70,
    sampleC: 70,
    riskTag: 'بسیار پرریسک'
  },
  {
    id: 'IRREGULAR',
    en: 'Irregular',
    fa: 'نامنظم',
    bRule: 'B: ۱۰۰–۱۳۸.۲٪',
    cRule: 'C: ۸۱–۱۰۰٪+',
    targetPattern: 'FLAT_EXPANDED',
    sampleB: 112,
    sampleC: 102
  },
  {
    id: 'IRREGULAR_DEFICIENT',
    en: 'Irregular-Deficient',
    fa: 'نامنظم ناقص',
    bRule: 'B: ۱۰۰–۱۳۸.۲٪',
    cRule: 'C: ۶۱.۸–۸۱٪',
    targetPattern: 'FLAT_EXPANDED',
    sampleB: 112,
    sampleC: 72
  },
  {
    id: 'IRREGULAR_EXTENDED',
    en: 'Irregular-Extended',
    fa: 'نامنظم کشیده',
    bRule: 'B: > ۱۳۸.۲٪',
    cRule: 'C: ≥ ۱۰۰٪',
    targetPattern: 'FLAT_EXPANDED',
    sampleB: 150,
    sampleC: 120
  },
  {
    id: 'RUNNING_DEPRECATED',
    en: 'Running',
    fa: 'جاری (حذف)',
    bRule: 'B: > ۱۰۰٪',
    cRule: 'C: < ۶۱.۸٪',
    targetPattern: 'FLAT_RUNNING',
    sampleB: 112,
    sampleC: 48,
    riskTag: 'حذف'
  }
];

const SUBTYPE_BY_ID: Record<FlatSubtype, (typeof EIGHT_SUBTYPE_MATRIX)[number]> = Object.fromEntries(
  EIGHT_SUBTYPE_MATRIX.map(item => [item.id, item])
) as Record<FlatSubtype, (typeof EIGHT_SUBTYPE_MATRIX)[number]>;

export const FlatPatternInspector: React.FC<FlatSidebarVisualizerProps> = ({
  scenario,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onApplyPattern,
  compact = false
}) => {
  const [structureMode, setStructureMode] = useState<StructureSelectionMode>('AUTO');
  const [variantFocus, setVariantFocus] = useState<FlatVariantFocus>('AUTO');

  const resolvedInternalSubwaves = useMemo<[3 | 5, 3 | 5, 3 | 5] | undefined>(() => {
    if (structureMode === '3-3-5') return [3, 3, 5];
    if (structureMode === '3-3-3') return [3, 3, 3];
    if (structureMode === '5-3-5') return [5, 3, 5];
    return undefined;
  }, [structureMode]);

  const summary = useMemo(
    () =>
      RulesEngine.validateStructure(
        scenario.patternType,
        scenario.vertices,
        scenario.direction,
        parentRole,
        parentWaveLabel,
        candles,
        resolvedInternalSubwaves ? { internalSubwaves: resolvedInternalSubwaves } : undefined
      ),
    [
      scenario.patternType,
      scenario.vertices,
      scenario.direction,
      parentRole,
      parentWaveLabel,
      candles,
      resolvedInternalSubwaves
    ]
  );

  const flatReport = useMemo(
    () =>
      PatternEngines.analyzeFlat(
        scenario,
        candles,
        resolvedInternalSubwaves ? { internalSubwaves: resolvedInternalSubwaves } : undefined
      ),
    [scenario, candles, resolvedInternalSubwaves]
  );

  const flatFlag = summary.flatPatternFlag;
  const marketTerminalFlag = summary.marketTerminalFlag;
  const has3PlusVerts = scenario.vertices.length >= 3;
  const excludedByRunningHelper = isExcludedFlat(scenario, candles);

  const detectedSubtype: FlatSubtype =
    flatFlag?.subtype ??
    flatReport.subtype ??
    (scenario.patternType === 'FLAT_RUNNING'
      ? 'RUNNING_DEPRECATED'
      : scenario.patternType === 'FLAT_EXPANDED'
      ? 'IRREGULAR'
      : 'REGULAR');

  const activeSubtype: FlatSubtype = variantFocus !== 'AUTO' ? variantFocus : detectedSubtype;
  const activeMeta = SUBTYPE_BY_ID[activeSubtype] || SUBTYPE_BY_ID.REGULAR;

  const liveBPct = has3PlusVerts
    ? flatFlag?.bRetracePct ?? flatReport.bPctOfA
    : activeMeta.sampleB;
  const liveCPct =
    scenario.vertices.length >= 4
      ? flatFlag?.cPctOfB ?? flatReport.cPctOfB
      : activeMeta.sampleC;

  const is335Selected =
    structureMode === '3-3-5' ||
    (structureMode === 'AUTO' &&
      (Boolean(flatFlag?.isStructure335) ||
        scenario.patternType === 'FLAT_REGULAR' ||
        scenario.patternType === 'FLAT_EXPANDED' ||
        scenario.patternType === 'FLAT_RUNNING'));

  const passesB618 = liveBPct > 61.8 + 1e-4;
  const isFlatClassified = is335Selected && passesB618;

  // Build normalized SVG points for 0 -> A -> B -> C schematic (using live ratios or variant preview)
  const svgGeometry = useMemo(() => {
    const plotLeft = 24;
    const plotRight = 256;
    const y0 = 36; // Origin (0) — 100% retracement baseline
    const yA = 104; // End of Wave A — 0% retracement baseline
    const spanA = yA - y0; // 68px = 100% of Wave A

    const ratioB = Math.max(0.1, Math.min(1.65, liveBPct / 100));
    const ratioC = Math.max(0.2, Math.min(1.5, liveCPct / 100));

    const yB = yA - spanA * ratioB;
    const spanB = Math.abs(yA - yB);
    const yC = Math.min(138, Math.max(14, yB + Math.max(12, spanB * ratioC)));

    const y618 = yA - spanA * 0.618;
    const y81 = yA - spanA * 0.81;

    const x0 = plotLeft;
    const xA = plotLeft + (plotRight - plotLeft) * 0.32;
    const xB = plotLeft + (plotRight - plotLeft) * 0.66;
    const xC = plotRight;

    return {
      plotLeft,
      plotRight,
      y0,
      yA,
      y618,
      y81,
      pts: [
        { lbl: '0', x: x0, y: y0 },
        { lbl: 'A', x: xA, y: yA },
        { lbl: 'B', x: xB, y: yB },
        { lbl: 'C', x: xC, y: yC }
      ]
    };
  }, [liveBPct, liveCPct]);

  // Progress bar scale: 0% to 150%
  const gaugeMax = 150;
  const clampPct = (val: number) => Math.max(0, Math.min(100, (val / gaugeMax) * 100));
  const threshold618Pos = clampPct(61.8);
  const threshold100Pos = clampPct(100);
  const bMarkerPos = clampPct(liveBPct);

  const recommendedPattern = flatFlag?.suggestedPattern ?? activeMeta.targetPattern;
  const needsPatternApply =
    Boolean(onApplyPattern) &&
    !scenario.isLocked &&
    isFlatClassified &&
    scenario.patternType !== recommendedPattern;

  const macroSubtypeNameEn = activeMeta.en;
  const macroSubtypeNameFa = activeMeta.fa;

  return (
    <section
      data-testid="flat-pattern-inspector"
      aria-label="بازرس الگوی فلت (Flat Pattern Inspector)"
      className="rounded-xl bg-[#0b1324] border border-slate-800 overflow-hidden divide-y divide-slate-800/80"
    >
      {/* Header & Live Classification Banner */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">
              بازرس الگوی فلت (Flat Pattern Inspector)
            </h4>
            <div className="text-[10.5px] text-slate-400 truncate">
              ساختار {flatFlag?.structureSignature || (is335Selected ? '۳-۳-۵' : 'نامشخص')} · {macroSubtypeNameFa} ({macroSubtypeNameEn})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <span
            data-testid="inspector-flat-subtype-badge"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-bold font-mono tabular-nums ${
              activeSubtype === 'RUNNING_DEPRECATED' || excludedByRunningHelper
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                : isFlatClassified
                ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200'
                : is335Selected && !passesB618
                ? 'bg-rose-500/15 border-rose-500/45 text-rose-200'
                : 'bg-amber-500/15 border-amber-500/45 text-amber-200'
            }`}
          >
            {isFlatClassified && !flatFlag?.isRunningExcluded && !excludedByRunningHelper ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {isFlatClassified
                ? `${macroSubtypeNameEn}${excludedByRunningHelper ? ' · Excluded' : ''}`
                : is335Selected
                ? 'B ≤ 61.8% (Zigzag)'
                : flatFlag?.structureSignature || 'انتخاب ساختار'}
            </span>
          </span>
        </div>
      </div>

      {/* MarketTerminalValidator Visual Warning Banner + Running Flat Exclusion Notice */}
      {(marketTerminalFlag?.isFlatAtMarketEnd || flatFlag?.isRunningExcluded) && (
        <div
          data-testid="sidebar-flat-terminal-warning"
          className="px-3.5 py-2 bg-rose-950/35 text-rose-100 space-y-1 text-[10.5px]"
        >
          {marketTerminalFlag?.isFlatAtMarketEnd && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-rose-200">{marketTerminalFlag.warningLabelFa}</div>
                <p className="text-[10px] text-rose-200/85 leading-relaxed">
                  {marketTerminalFlag.warningReasonFa}
                </p>
              </div>
            </div>
          )}
          {flatFlag?.isRunningExcluded && flatFlag.exclusionReasonFa && (
            <div className="flex items-start gap-1.5 pt-1 border-t border-rose-500/20">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[10px] font-semibold text-rose-200 leading-relaxed">
                {flatFlag.exclusionReasonFa}
              </p>
            </div>
          )}
        </div>
      )}

      {/* B/A & C/B Live Ratio + Detected Sub-Type Summary Strip */}
      <div className="px-3.5 py-2 bg-slate-950/60 space-y-1.5 text-[10.5px]">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-slate-400 text-[9.5px]">اصلاح B به A</div>
            <div
              className={`font-mono font-bold tabular-nums mt-0.5 ${
                passesB618 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {liveBPct}%
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[9.5px]">نسبت C به B</div>
            <div className="font-mono font-bold tabular-nums text-cyan-300 mt-0.5">
              {liveCPct}%
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[9.5px]">زیرنوع فلت (۸گانه)</div>
            <div className="font-semibold text-amber-300 truncate mt-0.5">
              {macroSubtypeNameFa} ({macroSubtypeNameEn})
            </div>
          </div>
        </div>
        <div className="pt-1 border-t border-slate-800/70 flex items-center justify-between gap-2 text-[10px] text-slate-300">
          <span className="truncate">{flatFlag?.subtype ? flatReport.subtypeLabelFa : `${activeMeta.fa} (${activeMeta.en})`}</span>
          <span className="font-mono tabular-nums text-slate-400 shrink-0">
            {activeMeta.bRule} · {activeMeta.cRule}
          </span>
        </div>
      </div>

      {/* Wave Structure 3-3-5 Selector + All 8 Session 13 Flat Sub-types Matrix */}
      <div className="px-3.5 py-2.5 space-y-2 text-[10.5px]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-slate-400 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>ساختار درونی انتخابی:</span>
          </span>
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(
              [
                { id: 'AUTO', label: 'خودکار' },
                { id: '3-3-5', label: '۳-۳-۵ (فلت)' },
                { id: '3-3-3', label: '۳-۳-۳' },
                { id: '5-3-5', label: '۵-۳-۵' }
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStructureMode(opt.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                  structureMode === opt.id
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* All 8 Session 13 Flat Sub-Types Mapping Grid */}
        <div data-testid="inspector-8-subtype-matrix" className="grid grid-cols-2 gap-1.5">
          {EIGHT_SUBTYPE_MATRIX.map(item => {
            const isSelectedVariant = activeSubtype === item.id;
            const isRunningRow = item.id === 'RUNNING_DEPRECATED';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setVariantFocus(prev => (prev === item.id ? 'AUTO' : item.id));
                  if (structureMode === 'AUTO' && !is335Selected) {
                    setStructureMode('3-3-5');
                  }
                }}
                className={`p-2 rounded-lg border text-right transition-colors ${
                  isSelectedVariant
                    ? isRunningRow
                      ? 'bg-rose-950/40 border-rose-500/60 text-white'
                      : 'bg-amber-950/35 border-amber-500/60 text-white'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10.5px] font-bold truncate">{item.fa}</span>
                  <span className="text-[9px] font-mono text-slate-300 shrink-0">{item.en}</span>
                </div>
                <div className="font-mono tabular-nums text-[9.5px] text-amber-300 mt-0.5">
                  {item.bRule} · {item.cRule}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Geometry & 61.8% Threshold Canvas (Shown cleanly whenever 3-3-5 or Flat mode active) */}
      <div className="px-3.5 py-2.5 space-y-2.5">
        {!is335Selected && (
          <div className="text-[10.5px] text-amber-300 bg-amber-950/20 border border-amber-500/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
            <span>ساختار فعلی «{flatFlag?.structureSignature || 'غیراز ۳-۳-۵'}» است؛ برای آزمون فلت ۳-۳-۵ را انتخاب کنید.</span>
            <button
              type="button"
              onClick={() => setStructureMode('3-3-5')}
              className="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-100 font-bold whitespace-nowrap shrink-0"
            >
              تست ۳-۳-۵
            </button>
          </div>
        )}

        {/* B-Wave 61.8% Ratio Verification Meter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="text-slate-300 font-semibold">
              راستی‌آزمایی نسبت موج B به موج A (قانون &gt; ۶۱.۸٪)
            </span>
            <span
              className={`font-mono font-bold tabular-nums ${
                passesB618 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              B/A: {liveBPct}% · C/B: {liveCPct}%
            </span>
          </div>

          <div className="relative h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            {/* Simple Zigzag Zone (0..61.8%) */}
            <div
              className="absolute inset-y-0 left-0 bg-rose-500/20"
              style={{ width: `${threshold618Pos}%` }}
            />
            {/* Regular Flat Zone (61.8..100%) */}
            <div
              className="absolute inset-y-0 bg-emerald-500/25"
              style={{
                left: `${threshold618Pos}%`,
                width: `${threshold100Pos - threshold618Pos}%`
              }}
            />
            {/* Irregular / Running Zone (>100%) */}
            <div
              className="absolute inset-y-0 right-0 bg-amber-500/25"
              style={{ left: `${threshold100Pos}%` }}
            />

            {/* 61.8% Marker */}
            <div
              className="absolute inset-y-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${threshold618Pos}%` }}
              title="مرز قانون فلت: ۶۱.۸٪"
            />
            {/* 100% Marker */}
            <div
              className="absolute inset-y-0 w-0.5 bg-cyan-400/80 z-10"
              style={{ left: `${threshold100Pos}%` }}
              title="مرز فلت متعارف / نامنظم: ۱۰۰٪"
            />

            {/* Live B-Wave Ratio Indicator Pin */}
            <div
              className={`absolute top-0.5 bottom-0.5 w-2 rounded-full z-20 transition-all duration-200 ${
                passesB618 ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
              style={{ left: `calc(${bMarkerPos}% - 4px)` }}
              title={`موج B: ${liveBPct}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[9.5px] font-mono tabular-nums text-slate-400">
            <span>0%</span>
            <span className="text-amber-300">۶۱.۸٪ (مرز فلت)</span>
            <span className="text-cyan-300">۱۰۰٪ (نامنظم)</span>
            <span>۱۵۰٪+</span>
          </div>
        </div>

        {/* Interactive SVG 0-A-B-C Schematic vs 61.8% & 100% Reference Lines */}
        {!compact && (
          <div className="rounded-lg bg-slate-950/85 border border-slate-800/90 p-2">
            <svg
              viewBox="0 0 280 144"
              className="w-full h-36 select-none"
              role="img"
              aria-label={`نمودار شماتیک الگوی فلت: B برابر ${liveBPct} درصد موج A`}
            >
              {/* 100% Wave A Origin Baseline */}
              <line
                x1={svgGeometry.plotLeft - 6}
                y1={svgGeometry.y0}
                x2={svgGeometry.plotRight + 6}
                y2={svgGeometry.y0}
                stroke="#22d3ee"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.65}
              />
              <text
                x={svgGeometry.plotRight + 4}
                y={svgGeometry.y0 - 3}
                textAnchor="end"
                className="fill-cyan-300 text-[8.5px] font-mono"
              >
                100% A
              </text>

              {/* 61.8% Mandatory Flat Threshold Line */}
              <line
                x1={svgGeometry.plotLeft - 6}
                y1={svgGeometry.y618}
                x2={svgGeometry.plotRight + 6}
                y2={svgGeometry.y618}
                stroke="#f59e0b"
                strokeWidth={1.2}
                strokeDasharray="4 2"
              />
              <text
                x={svgGeometry.plotRight + 4}
                y={svgGeometry.y618 - 3}
                textAnchor="end"
                className="fill-amber-300 text-[8.5px] font-mono font-bold"
              >
                61.8% min
              </text>

              {/* Wave A bottom baseline */}
              <line
                x1={svgGeometry.plotLeft - 6}
                y1={svgGeometry.yA}
                x2={svgGeometry.plotRight + 6}
                y2={svgGeometry.yA}
                stroke="#334155"
                strokeWidth={0.9}
              />

              {/* Wave 0 -> A -> B -> C Polyline */}
              <polyline
                points={svgGeometry.pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={isFlatClassified ? '#10b981' : '#f43f5e'}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />

              {/* Subwave Annotations (3) - (3) - (5) */}
              <text
                x={(svgGeometry.pts[0].x + svgGeometry.pts[1].x) / 2 - 8}
                y={(svgGeometry.pts[0].y + svgGeometry.pts[1].y) / 2}
                className="fill-slate-400 text-[8.5px] font-mono"
              >
                A(3)
              </text>
              <text
                x={(svgGeometry.pts[1].x + svgGeometry.pts[2].x) / 2 - 10}
                y={(svgGeometry.pts[1].y + svgGeometry.pts[2].y) / 2}
                className="fill-amber-300 text-[8.5px] font-mono font-bold"
              >
                B(3) {liveBPct}%
              </text>
              <text
                x={(svgGeometry.pts[2].x + svgGeometry.pts[3].x) / 2 - 12}
                y={(svgGeometry.pts[2].y + svgGeometry.pts[3].y) / 2}
                className="fill-cyan-300 text-[8.5px] font-mono"
              >
                C(5)
              </text>

              {/* Pivot Points */}
              {svgGeometry.pts.map(pt => (
                <g key={pt.lbl}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={3.5}
                    fill={pt.lbl === 'B' ? (passesB618 ? '#10b981' : '#f43f5e') : '#38bdf8'}
                    stroke="#0f172a"
                    strokeWidth={1.2}
                  />
                  <text
                    x={pt.x}
                    y={pt.lbl === 'A' ? pt.y + 11 : pt.y - 6}
                    textAnchor="middle"
                    className="fill-white text-[9px] font-mono font-bold"
                  >
                    {pt.lbl}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Active Variant & RulesEngine Flag Summary */}
        <div className="space-y-1 text-[10.5px] text-slate-300 leading-relaxed">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-white">{flatReport.subtypeLabelFa}</span>
            {variantFocus !== 'AUTO' && (
              <button
                type="button"
                onClick={() => setVariantFocus('AUTO')}
                className="text-[10px] text-cyan-300 hover:text-cyan-200 underline"
              >
                بازگشت به داده زنده
              </button>
            )}
          </div>
          <p className="text-slate-400">
            {flatFlag?.reasonFa || `${activeMeta.fa} (${activeMeta.en}): ${activeMeta.bRule} · ${activeMeta.cRule}`}
          </p>
          {flatReport.tradingPolicyReasonFa && (
            <p
              className={`text-[10px] font-medium ${
                flatReport.tradingPolicyAction === 'ALLOW_PAST_KNOT_UNTANGLING'
                  ? 'text-emerald-300'
                  : flatReport.tradingPolicyAction === 'ALLOW_WITH_CAUTION'
                  ? 'text-amber-300'
                  : 'text-rose-300'
              }`}
            >
              {flatReport.tradingPolicyReasonFa}
            </p>
          )}
        </div>

        {/* One-Click Morph to Flagged Flat Pattern */}
        {needsPatternApply && onApplyPattern && (
          <button
            type="button"
            onClick={() => onApplyPattern(recommendedPattern)}
            className="w-full py-1.5 px-3 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-100 text-[11px] font-bold flex items-center justify-between gap-2 transition-colors"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>تبدیل خودکار به {PATTERN_LABELS_FA[recommendedPattern].split('(')[0].trim()}</span>
            </span>
            <ArrowUpLeft className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
      </div>
    </section>
  );
};

export const FlatSidebarVisualizer = FlatPatternInspector;
