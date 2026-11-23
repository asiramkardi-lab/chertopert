/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Studio Sidebar Flat Pattern (3-3-5) Visualizer & 61.8% B-Wave Verifier
 * Visualizes Regular, Irregular, and Running Flat geometries, verifies B-wave retracement
 * against the 61.8% threshold, and integrates live RulesEngine pattern classification flags.
 */

import React, { useMemo, useState } from 'react';
import { Candle, PatternFamily, WaveRole, WaveScenario } from '../types/elliott';
import { RulesEngine, PATTERN_LABELS_FA } from '../engine/rulesEngine';
import { PatternEngines } from '../engine/patternEngines';
import {
  Layers,
  CheckCircle2,
  ShieldAlert,
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
type FlatVariantFocus = 'AUTO' | 'REGULAR' | 'IRREGULAR' | 'RUNNING';

const VARIANT_REFERENCE: Record<
  'REGULAR' | 'IRREGULAR' | 'RUNNING',
  {
    titleFa: string;
    subtitleFa: string;
    bRuleFa: string;
    cRuleFa: string;
    targetPattern: PatternFamily;
    sampleB: number;
    sampleC: number;
  }
> = {
  REGULAR: {
    titleFa: 'فلت متعارف (Regular)',
    subtitleFa: 'B در بازه ۶۱.۸٪ تا ۱۰۰٪ موج A (ایده‌آل ۸۱–۱۰۰٪)',
    bRuleFa: '۶۱.۸٪ < B ≤ ۱۰۰٪',
    cRuleFa: 'C ≈ ۸۱–۱۰۰٪ B',
    targetPattern: 'FLAT_REGULAR',
    sampleB: 90,
    sampleC: 95
  },
  IRREGULAR: {
    titleFa: 'فلت نامنظم (Irregular)',
    subtitleFa: 'موج B از ۱۰۰٪ مبدأ A فراتر می‌رود و موج C پوشش می‌دهد',
    bRuleFa: 'B > ۱۰۰٪ A',
    cRuleFa: 'C ≥ ۶۱.۸٪ B',
    targetPattern: 'FLAT_EXPANDED',
    sampleB: 118,
    sampleC: 105
  },
  RUNNING: {
    titleFa: 'فلت جاری (Running)',
    subtitleFa: 'B > ۱۰۰٪ A اما C کوتاه و ناکافی (< ۶۱.۸٪ B) — پرریسک',
    bRuleFa: 'B > ۱۰۰٪ A',
    cRuleFa: 'C < ۶۱.۸٪ B',
    targetPattern: 'FLAT_RUNNING',
    sampleB: 112,
    sampleC: 48
  }
};

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
  const has3PlusVerts = scenario.vertices.length >= 3;

  // Determine effective B% and C% (live scenario or focused variant preview if < 3 verts)
  const activeMacro: 'REGULAR' | 'IRREGULAR' | 'RUNNING' =
    variantFocus !== 'AUTO'
      ? variantFocus
      : flatFlag?.macroCategory ??
        (scenario.patternType === 'FLAT_RUNNING'
          ? 'RUNNING'
          : scenario.patternType === 'FLAT_EXPANDED'
          ? 'IRREGULAR'
          : 'REGULAR');

  const liveBPct = has3PlusVerts
    ? flatFlag?.bRetracePct ?? flatReport.bPctOfA
    : VARIANT_REFERENCE[activeMacro].sampleB;
  const liveCPct =
    scenario.vertices.length >= 4
      ? flatFlag?.cPctOfB ?? flatReport.cPctOfB
      : VARIANT_REFERENCE[activeMacro].sampleC;

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

  const recommendedPattern = flatFlag?.suggestedPattern ?? VARIANT_REFERENCE[activeMacro].targetPattern;
  const needsPatternApply =
    Boolean(onApplyPattern) &&
    !scenario.isLocked &&
    isFlatClassified &&
    scenario.patternType !== recommendedPattern;

  const macroSubtypeNameEn =
    activeMacro === 'REGULAR' ? 'Regular' : activeMacro === 'IRREGULAR' ? 'Irregular' : 'Running';
  const macroSubtypeNameFa =
    activeMacro === 'REGULAR' ? 'متعارف' : activeMacro === 'IRREGULAR' ? 'نامنظم' : 'جاری';

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

        <div
          className={`flex items-center gap-1 text-[10.5px] font-bold font-mono tabular-nums shrink-0 ${
            isFlatClassified
              ? 'text-emerald-400'
              : is335Selected && !passesB618
              ? 'text-rose-400'
              : 'text-amber-300'
          }`}
        >
          {isFlatClassified ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>
            {isFlatClassified
              ? `Flat · ${macroSubtypeNameEn}`
              : is335Selected
              ? 'B ≤ 61.8% (Zigzag)'
              : flatFlag?.structureSignature || 'انتخاب ساختار'}
          </span>
        </div>
      </div>

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
            <div className="text-slate-400 text-[9.5px]">زیرنوع فلت</div>
            <div className="font-semibold text-amber-300 truncate mt-0.5">
              {macroSubtypeNameFa} ({macroSubtypeNameEn})
            </div>
          </div>
        </div>
        <div className="pt-1 border-t border-slate-800/70 flex items-center justify-between gap-2 text-[10px] text-slate-300">
          <span className="truncate">{flatFlag?.subtype ? flatReport.subtypeLabelFa : VARIANT_REFERENCE[activeMacro].titleFa}</span>
          <span className="font-mono tabular-nums text-slate-400 shrink-0">
            {VARIANT_REFERENCE[activeMacro].bRuleFa} · {VARIANT_REFERENCE[activeMacro].cRuleFa}
          </span>
        </div>
      </div>

      {/* Wave Structure 3-3-5 Selector + Flat Subtype Preview Switcher */}
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

        {/* 3 Canonical Flat Variants Switcher (Regular / Irregular / Running) */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['REGULAR', 'IRREGULAR', 'RUNNING'] as const).map(variant => {
            const meta = VARIANT_REFERENCE[variant];
            const isSelectedVariant = activeMacro === variant;
            return (
              <button
                key={variant}
                type="button"
                onClick={() => {
                  setVariantFocus(prev => (prev === variant ? 'AUTO' : variant));
                  if (structureMode === 'AUTO' && !is335Selected) {
                    setStructureMode('3-3-5');
                  }
                }}
                className={`p-2 rounded-lg border text-right transition-colors ${
                  isSelectedVariant
                    ? 'bg-amber-950/35 border-amber-500/55 text-white'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="text-[10.5px] font-bold truncate">
                  {variant === 'REGULAR' ? 'متعارف' : variant === 'IRREGULAR' ? 'نامنظم' : 'جاری'}
                </div>
                <div className="font-mono tabular-nums text-[9.5px] text-amber-300 mt-0.5">
                  {meta.bRuleFa}
                </div>
                <div className="font-mono tabular-nums text-[9px] text-slate-400">
                  {meta.cRuleFa}
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
            {flatFlag?.reasonFa || VARIANT_REFERENCE[activeMacro].subtitleFa}
          </p>
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
