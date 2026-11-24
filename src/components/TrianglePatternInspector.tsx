/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Session 14 Triangle Pattern (A-B-C-D-E, 3-3-3-3-3) Inspector & Interactive Simulator
 * Visualizes Contracting vs Expanding vs Parallel geometries, corrective slot frequencies (4:50%, B:30%, 2:20%),
 * tradability, counter-trend alignment, trendline touches, Wave-E exit continuation, and Zob Ahan reference.
 */

import React, { useMemo, useState } from 'react';
import {
  Candle,
  PatternFamily,
  TriangleAnalysisOptions,
  WaveRole,
  WaveScenario
} from '../types/elliott';
import { RulesEngine, PATTERN_LABELS_FA } from '../engine/rulesEngine';
import { PatternEngines } from '../engine/patternEngines';
import {
  Triangle,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  ArrowUpLeft,
  SlidersHorizontal,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

interface TrianglePatternInspectorProps {
  scenario: WaveScenario;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onApplyPattern?: (pattern: PatternFamily) => void;
  compact?: boolean;
}

type SimSlotMode = 'AUTO' | '4' | 'B' | '2' | '3' | '5';
type SimSubwaveMode = 'AUTO' | '3-3-3-3-3' | '5-5-5-5-5' | '3-5-3-5-3';
type SimBreakoutMode = 'AUTO' | 'WITH_TREND' | 'NONE' | 'COUNTER_TREND';
type SimMarketState = 'AUTO' | 'INDECISIVE' | 'CONFIDENT_TREND';
type SimTouchesMode = 'AUTO' | 0 | 1 | 2 | 3;

export const TrianglePatternInspector: React.FC<TrianglePatternInspectorProps> = ({
  scenario,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onApplyPattern,
  compact = false
}) => {
  const [slotMode, setSlotMode] = useState<SimSlotMode>('AUTO');
  const [subwaveMode, setSubwaveMode] = useState<SimSubwaveMode>('AUTO');
  const [breakoutMode, setBreakoutMode] = useState<SimBreakoutMode>('AUTO');
  const [marketState, setMarketState] = useState<SimMarketState>('AUTO');
  const [touchesMode, setTouchesMode] = useState<SimTouchesMode>('AUTO');

  const effectiveRole: WaveRole = useMemo(() => {
    if (slotMode === 'AUTO') return parentRole;
    return slotMode === '2' || slotMode === '4' || slotMode === 'B' ? 'CORRECTIVE' : 'MOTIVE';
  }, [slotMode, parentRole]);

  const effectiveWaveLabel: string = useMemo(() => {
    if (slotMode === 'AUTO') return parentWaveLabel;
    return `موج ${slotMode}`;
  }, [slotMode, parentWaveLabel]);

  const triangleOptions: TriangleAnalysisOptions | undefined = useMemo(() => {
    const opts: TriangleAnalysisOptions = {};
    let hasAny = false;
    if (subwaveMode === '3-3-3-3-3') {
      opts.internalSubwaves = [3, 3, 3, 3, 3];
      hasAny = true;
    } else if (subwaveMode === '5-5-5-5-5') {
      opts.internalSubwaves = [5, 5, 5, 5, 5];
      hasAny = true;
    } else if (subwaveMode === '3-5-3-5-3') {
      opts.internalSubwaves = [3, 5, 3, 5, 3];
      hasAny = true;
    }
    if (breakoutMode !== 'AUTO') {
      opts.breakoutDirection = breakoutMode;
      opts.breakoutConfirmed = breakoutMode !== 'NONE';
      hasAny = true;
    }
    if (marketState !== 'AUTO') {
      opts.marketState = marketState;
      hasAny = true;
    }
    if (touchesMode !== 'AUTO') {
      opts.trendlineUpperTouches = touchesMode;
      opts.trendlineLowerTouches = touchesMode;
      hasAny = true;
    }
    return hasAny ? opts : undefined;
  }, [subwaveMode, breakoutMode, marketState, touchesMode]);

  const validationResult = useMemo(
    () =>
      RulesEngine.TrianglePatternValidator(
        scenario.patternType,
        scenario.vertices,
        scenario.direction,
        effectiveRole,
        effectiveWaveLabel,
        candles,
        triangleOptions
      ),
    [
      scenario.patternType,
      scenario.vertices,
      scenario.direction,
      effectiveRole,
      effectiveWaveLabel,
      candles,
      triangleOptions
    ]
  );

  const report = validationResult.report;

  const resolvedSlot = useMemo<'2' | '4' | 'B' | '5' | '1' | '3'>(() => {
    if (slotMode !== 'AUTO') return slotMode;
    const clean = parentWaveLabel.replace(/موج/g, '').replace(/[()VW\s]/g, '').toUpperCase();
    if (clean.includes('2')) return '2';
    if (clean.includes('B')) return 'B';
    if (clean.includes('5')) return '5';
    if (clean.includes('3')) return '3';
    if (clean.includes('1')) return '1';
    return '4';
  }, [slotMode, parentWaveLabel]);

  const zobReference = useMemo(
    () =>
      PatternEngines.evaluateZobPracticalTriangle({
        waveSlot: resolvedSlot,
        triangleType: report.triangleType === 'EXPANDING' ? 'EXPANDING' : 'CONTRACTING',
        subwaves: report.subwaveCounts || [3, 3, 3, 3, 3],
        breakoutPullbackConfirmed: breakoutMode === 'WITH_TREND'
      }),
    [resolvedSlot, report.triangleType, report.subwaveCounts, breakoutMode]
  );

  const isSimulationActive =
    slotMode !== 'AUTO' ||
    subwaveMode !== 'AUTO' ||
    breakoutMode !== 'AUTO' ||
    marketState !== 'AUTO' ||
    touchesMode !== 'AUTO';

  // Normalized 0 -> A -> B -> C -> D -> E -> Breakout SVG geometry
  const svgGeom = useMemo(() => {
    const x0 = 16;
    const xA = 54;
    const xB = 96;
    const xC = 138;
    const xD = 180;
    const xE = 222;
    const xOut = 266;

    const verts = scenario.vertices;
    const has5Plus = verts.length >= 6;
    const isBull = scenario.direction === 'BULLISH';

    let yPoints: Array<{ lbl: string; x: number; y: number }>;
    if (has5Plus && !report.isParallelRectangle) {
      const slice = verts.slice(0, 6);
      const prices = slice.map(v => v.price);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const span = Math.max(0.01, maxP - minP);
      const mapY = (p: number) => 114 - ((p - minP) / span) * 86;
      const xs = [x0, xA, xB, xC, xD, xE];
      const lbls = ['0', 'A', 'B', 'C', 'D', 'E'];
      yPoints = slice.map((v, idx) => ({
        lbl: lbls[idx],
        x: xs[idx],
        y: Math.round(mapY(v.price) * 10) / 10
      }));
    } else if (report.triangleType === 'EXPANDING') {
      yPoints = [
        { lbl: '0', x: x0, y: isBull ? 104 : 36 },
        { lbl: 'A', x: xA, y: isBull ? 56 : 84 },
        { lbl: 'B', x: xB, y: isBull ? 86 : 54 },
        { lbl: 'C', x: xC, y: isBull ? 42 : 98 },
        { lbl: 'D', x: xD, y: isBull ? 102 : 38 },
        { lbl: 'E', x: xE, y: isBull ? 28 : 112 }
      ];
    } else {
      yPoints = [
        { lbl: '0', x: x0, y: isBull ? 114 : 26 },
        { lbl: 'A', x: xA, y: isBull ? 30 : 110 },
        { lbl: 'B', x: xB, y: isBull ? 102 : 38 },
        { lbl: 'C', x: xC, y: isBull ? 44 : 96 },
        { lbl: 'D', x: xD, y: isBull ? 88 : 52 },
        { lbl: 'E', x: xE, y: isBull ? 62 : 78 }
      ];
    }

    const ptA = yPoints[1];
    const ptB = yPoints[2];
    const ptC = yPoints[3];
    const ptD = yPoints[4];
    const ptE = yPoints[5];

    const yOut =
      breakoutMode === 'COUNTER_TREND'
        ? isBull
          ? 122
          : 18
        : isBull
        ? 18
        : 122;

    const upperP1 = ptA.y <= ptB.y ? ptA : ptB;
    const upperP2 = ptC.y <= ptD.y ? ptC : ptD;
    const lowerP1 = ptA.y >= ptB.y ? ptA : ptB;
    const lowerP2 = ptC.y >= ptD.y ? ptC : ptD;

    const extendY = (p1: { x: number; y: number }, p2: { x: number; y: number }, tx: number) => {
      const dx = Math.max(1, p2.x - p1.x);
      return p1.y + ((p2.y - p1.y) * (tx - p1.x)) / dx;
    };

    return {
      pts: yPoints,
      upperLine: {
        x1: upperP1.x - 8,
        y1: extendY(upperP1, upperP2, upperP1.x - 8),
        x2: xE + 10,
        y2: extendY(upperP1, upperP2, xE + 10)
      },
      lowerLine: {
        x1: lowerP1.x - 8,
        y1: extendY(lowerP1, lowerP2, lowerP1.x - 8),
        x2: xE + 10,
        y2: extendY(lowerP1, lowerP2, xE + 10)
      },
      breakoutPt: { x: xOut, y: yOut, fromX: ptE.x, fromY: ptE.y }
    };
  }, [scenario.vertices, scenario.direction, report.triangleType, report.isParallelRectangle, breakoutMode]);

  const recommendedPattern: PatternFamily | null = useMemo(() => {
    if (!report.positionValid && report.expectedReplacementPattern) {
      return report.expectedReplacementPattern;
    }
    if (report.subwaveCounts?.every(c => c === 5)) {
      return 'ENDING_DIAGONAL';
    }
    if (report.triangleType === 'EXPANDING') return 'TRIANGLE_EXPANDING';
    if (report.triangleType === 'CONTRACTING') return 'TRIANGLE_CONVERGING';
    return null;
  }, [report.positionValid, report.expectedReplacementPattern, report.subwaveCounts, report.triangleType]);

  const showApplyMorph =
    Boolean(onApplyPattern) &&
    !scenario.isLocked &&
    recommendedPattern !== null &&
    recommendedPattern !== scenario.patternType;

  const tradabilityColor =
    report.tradabilityStatus === 'TRADABLE'
      ? 'text-emerald-300 border-emerald-500/45 bg-emerald-500/15'
      : report.tradabilityStatus === 'WITH_CAUTION'
      ? 'text-amber-200 border-amber-500/45 bg-amber-500/15'
      : 'text-rose-200 border-rose-500/45 bg-rose-500/15';

  const tradabilityShortFa =
    report.tradabilityStatus === 'TRADABLE'
      ? 'معامله‌پذیر'
      : report.tradabilityStatus === 'WITH_CAUTION'
      ? 'با احتیاط'
      : 'غیرمعامله‌پذیر';

  return (
    <section
      data-testid="triangle-pattern-inspector"
      aria-label="بازرس الگوی مثلث (A-B-C-D-E)"
      className="rounded-xl bg-[#0b1324] border border-slate-800 overflow-hidden divide-y divide-slate-800/80"
    >
      {/* Header Row */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Triangle className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">
              بازرس الگوی مثلث (جلسه ۱۴ — A-B-C-D-E)
            </h4>
            <div className="text-[10.5px] text-slate-400 truncate font-mono tabular-nums">
              {report.subwaveSignature || '3-3-3-3-3'} · {report.positionSlotLabelFa} · فراوانی {report.frequencyPct}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            data-testid="inspector-triangle-tradability-status"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-bold ${tradabilityColor}`}
          >
            {report.tradabilityStatus === 'TRADABLE' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : report.tradabilityStatus === 'WITH_CAUTION' ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{tradabilityShortFa}</span>
          </span>
        </div>
      </div>

      {/* Warning Banner for Invalid Slot, Parallel Rectangle, Mixed Trendlines, or 5-Wave Diagonal Mismatch */}
      {(!report.positionValid ||
        report.isParallelRectangle ||
        report.isMixedTrendlines ||
        !report.subwaveStructureValid ||
        !report.namingValid) && (
        <div
          data-testid="triangle-inspector-warnings"
          className="px-3.5 py-2 bg-rose-950/30 text-rose-100 space-y-1 text-[10.5px]"
        >
          {!report.positionValid && (
            <div className="flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                مثلث در موج {resolvedSlot} مجاز نیست؛ مثلث فقط در امواج اصلاحی ۲ (۲۰٪)، ۴ (۵۰٪) یا B (۳۰٪) تشکیل می‌شود
                {resolvedSlot === '5' ? ' (در موج ۵ قطر پایانی بررسی شود).' : '.'}
              </span>
            </div>
          )}
          {report.isParallelRectangle && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>خطوط روند موازی هستند: الگوی مستطیل تشخیص داده شد و مثلث محسوب نمی‌شود.</span>
            </div>
          )}
          {!report.subwaveStructureValid && report.subwaveMismatchWarningFa && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{report.subwaveMismatchWarningFa}</span>
            </div>
          )}
          {!report.namingValid && scenario.vertices.length >= 6 && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>نام‌گذاری پیوت‌های مثلث باید A-B-C-D-E باشد (نه ۱-۲-۳-۴-۵ مخصوص قطر).</span>
            </div>
          )}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="px-3.5 py-2.5 bg-slate-950/60 space-y-2 text-[10.5px]">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-slate-400 text-[9.5px]">نوع مثلث</div>
            <div
              className={`font-bold mt-0.5 truncate ${
                report.triangleType === 'CONTRACTING'
                  ? 'text-emerald-300'
                  : report.triangleType === 'EXPANDING'
                  ? 'text-amber-300'
                  : 'text-rose-300'
              }`}
            >
              {report.isParallelRectangle
                ? 'مستطیل (نامعتبر)'
                : report.triangleType === 'EXPANDING'
                ? 'گستشی (Expanding)'
                : report.triangleType === 'CONTRACTING'
                ? 'مانع (Contracting)'
                : 'نامعتبر'}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[9.5px]">ساختار و نام‌گذاری</div>
            <div className="font-mono font-bold tabular-nums text-cyan-300 mt-0.5">
              {report.subwaveSignature || '3-3-3-3-3'} · {report.namingValid ? 'A-B-C-D-E ✓' : 'بازبینی'}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[9.5px]">جایگاه / فراوانی</div>
            <div
              className={`font-mono font-bold tabular-nums mt-0.5 ${
                report.positionValid ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              موج {resolvedSlot} · {report.frequencyPct}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-800/70">
          <div>
            <div className="text-slate-400 text-[9.5px]">هم‌راستایی خلاف روند</div>
            <div
              className={`font-semibold mt-0.5 truncate ${
                report.counterTrendVerdict === 'VALID'
                  ? 'text-emerald-300'
                  : report.counterTrendVerdict === 'RARE_ENDING_TRIANGLE'
                  ? 'text-amber-300'
                  : 'text-rose-300'
              }`}
            >
              {report.counterTrendVerdict === 'VALID'
                ? 'خلاف روند اصلی ✓'
                : report.counterTrendVerdict === 'RARE_ENDING_TRIANGLE'
                ? 'هم‌شیب نادر'
                : 'جایگاه نامعتبر'}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[9.5px]">برخورد خط روند</div>
            <div
              className={`font-mono font-bold tabular-nums mt-0.5 ${
                report.trendlineStrengthStatus === 'VALID'
                  ? 'text-emerald-300'
                  : report.trendlineStrengthStatus === 'WEAK'
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }`}
            >
              {report.upperTrendlineTouches ?? 2}/{report.lowerTrendlineTouches ?? 2} برخورد (
              {report.trendlineStrengthStatus === 'VALID'
                ? 'معتبر'
                : report.trendlineStrengthStatus === 'WEAK'
                ? 'ضعیف'
                : 'نامعتبر'}
              )
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[9.5px]">موج بعدی پس از E</div>
            <div className="font-mono font-bold text-indigo-300 mt-0.5 truncate">
              {report.nextExpectedWave === 'WAVE_5'
                ? 'شروع موج ۵'
                : report.nextExpectedWave === 'WAVE_C'
                ? 'شروع موج C'
                : report.nextExpectedWave === 'WAVE_3'
                ? 'شروع موج ۳'
                : 'در انتظار E'}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Session 14 Simulator Controls */}
      <div className="px-3.5 py-2.5 space-y-2 text-[10.5px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>شبیه‌ساز قوانین جلسه ۱۴:</span>
          </span>
          {isSimulationActive && (
            <button
              type="button"
              onClick={() => {
                setSlotMode('AUTO');
                setSubwaveMode('AUTO');
                setBreakoutMode('AUTO');
                setMarketState('AUTO');
                setTouchesMode('AUTO');
              }}
              className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>بازگشت به خودکار</span>
            </button>
          )}
        </div>

        {/* Position Slot Selector (4:50%, B:30%, 2:20%, vs 3/5 Invalid) */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-slate-400 text-[10px]">موقعیت موج:</span>
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(
              [
                { id: 'AUTO', label: 'خودکار' },
                { id: '4', label: '۴ (۵۰٪)' },
                { id: 'B', label: 'B (۳۰٪)' },
                { id: '2', label: '۲ (۲۰٪)' },
                { id: '3', label: '۳ ✕' },
                { id: '5', label: '۵ ✕' }
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSlotMode(opt.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap ${
                  slotMode === opt.id
                    ? opt.id === '3' || opt.id === '5'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Internal Subwave Structure Selector */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-slate-400 text-[10px]">ساختار درونی:</span>
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(
              [
                { id: 'AUTO', label: 'خودکار' },
                { id: '3-3-3-3-3', label: '۳-۳-۳-۳-۳' },
                { id: '5-5-5-5-5', label: '۵-۵-۵-۵-۵ (قطر)' },
                { id: '3-5-3-5-3', label: 'مختلط' }
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSubwaveMode(opt.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap ${
                  subwaveMode === opt.id
                    ? opt.id === '3-3-3-3-3'
                      ? 'bg-emerald-600 text-white font-bold'
                      : opt.id === 'AUTO'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-amber-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Breakout, Market Psychology & Trendline Touches Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(
              [
                { id: 'AUTO', label: 'شکست: خودکار' },
                { id: 'WITH_TREND', label: 'هم‌روند' },
                { id: 'NONE', label: 'در انتظار' },
                { id: 'COUNTER_TREND', label: 'خلاف روند' }
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBreakoutMode(opt.id)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors whitespace-nowrap ${
                  breakoutMode === opt.id
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(
              [
                { id: 'AUTO', label: 'برخورد: خودکار' },
                { id: 2, label: '۲+' },
                { id: 1, label: '۱' },
                { id: 0, label: '۰' }
              ] as const
            ).map(opt => (
              <button
                key={String(opt.id)}
                type="button"
                onClick={() => setTouchesMode(opt.id)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono transition-colors whitespace-nowrap ${
                  touchesMode === opt.id
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Schematic Canvas (0-A-B-C-D-E + Converging/Expanding Trendlines + Breakout Arrow) */}
      {!compact && (
        <div className="px-3.5 py-2.5 bg-slate-950/85">
          <svg
            viewBox="0 0 284 140"
            className="w-full h-36 select-none rounded-lg border border-slate-800/80 bg-[#070d1a]"
            role="img"
            aria-label="نمودار شماتیک الگوی مثلث A-B-C-D-E و خطوط روند"
          >
            {/* Upper & Lower Converging/Expanding Trendlines */}
            <line
              x1={svgGeom.upperLine.x1}
              y1={svgGeom.upperLine.y1}
              x2={svgGeom.upperLine.x2}
              y2={svgGeom.upperLine.y2}
              stroke="#22d3ee"
              strokeWidth={1.2}
              strokeDasharray="4 2"
              opacity={report.trendlineStrengthStatus === 'INVALID' ? 0.25 : 0.85}
            />
            <line
              x1={svgGeom.lowerLine.x1}
              y1={svgGeom.lowerLine.y1}
              x2={svgGeom.lowerLine.x2}
              y2={svgGeom.lowerLine.y2}
              stroke="#f59e0b"
              strokeWidth={1.2}
              strokeDasharray="4 2"
              opacity={report.trendlineStrengthStatus === 'INVALID' ? 0.25 : 0.85}
            />

            {/* A-B-C-D-E Zigzag Wave Path */}
            <polyline
              points={svgGeom.pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={report.detected ? '#10b981' : '#f43f5e'}
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {/* Breakout Continuation Projection */}
            <line
              x1={svgGeom.breakoutPt.fromX}
              y1={svgGeom.breakoutPt.fromY}
              x2={svgGeom.breakoutPt.x}
              y2={svgGeom.breakoutPt.y}
              stroke={breakoutMode === 'COUNTER_TREND' ? '#f43f5e' : '#38bdf8'}
              strokeWidth={1.6}
              strokeDasharray="3 2"
            />
            <text
              x={svgGeom.breakoutPt.x - 4}
              y={svgGeom.breakoutPt.y + (svgGeom.breakoutPt.y < 60 ? -4 : 10)}
              textAnchor="end"
              className="fill-cyan-300 text-[8.5px] font-mono font-bold"
            >
              {report.nextExpectedWave === 'WAVE_5'
                ? 'W5'
                : report.nextExpectedWave === 'WAVE_C'
                ? 'WC'
                : report.nextExpectedWave === 'WAVE_3'
                ? 'W3'
                : 'Break'}
            </text>

            {/* Pivot Nodes & 3-3-3-3-3 Leg Annotations */}
            {svgGeom.pts.map((pt, idx) => {
              const next = svgGeom.pts[idx + 1];
              const subDigit = report.subwaveCounts?.[idx] ?? 3;
              return (
                <g key={pt.lbl}>
                  {next && (
                    <text
                      x={(pt.x + next.x) / 2}
                      y={(pt.y + next.y) / 2 - 2}
                      textAnchor="middle"
                      className="fill-slate-400 text-[7.5px] font-mono"
                    >
                      ({subDigit})
                    </text>
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={pt.lbl === 'E' ? 4 : 3.2}
                    fill={pt.lbl === 'E' ? '#10b981' : '#38bdf8'}
                    stroke="#0f172a"
                    strokeWidth={1.2}
                  />
                  <text
                    x={pt.x}
                    y={pt.y > 70 ? pt.y + 10 : pt.y - 6}
                    textAnchor="middle"
                    className="fill-white text-[9px] font-mono font-bold"
                  >
                    {pt.lbl}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Practical Insights: Continuation, Indecision Psychology, and Zob Ahan (ذوب) Study */}
      <div className="px-3.5 py-2.5 space-y-1.5 text-[10.5px] leading-relaxed">
        <div className="flex items-start gap-1.5 text-slate-200">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">{report.continuationLabelFa}</span>
            {report.nextExpectedWaveLabelFa && (
              <p className="text-[10px] text-cyan-300 mt-0.5">{report.nextExpectedWaveLabelFa}</p>
            )}
          </div>
        </div>

        {report.indecisionAssessmentFa && (
          <p className="text-[10px] text-slate-400">{report.indecisionAssessmentFa}</p>
        )}

        <div
          data-testid="zob-practical-triangle-note"
          className="p-2 rounded-lg bg-slate-950/75 border border-slate-800/90 text-[10px] space-y-0.5"
        >
          <div className="font-bold text-amber-300">مطالعه موردی جلسه ۱۴ — ذوب‌آهن اصفهان (ذوب):</div>
          <div className="text-slate-300">{zobReference.recommendedSetupFa}</div>
        </div>

        {showApplyMorph && recommendedPattern && onApplyPattern && (
          <button
            type="button"
            onClick={() => onApplyPattern(recommendedPattern)}
            className="w-full mt-1 py-1.5 px-3 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-100 text-[11px] font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>تبدیل سناریو به {PATTERN_LABELS_FA[recommendedPattern].split('(')[0].trim()}</span>
            </span>
            <ArrowUpLeft className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
      </div>
    </section>
  );
};
