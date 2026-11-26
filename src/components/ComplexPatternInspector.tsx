/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Session 16 Complex Patterns (015-complex-patterns-engine) Inspector & Interactive Simulator
 * Covers: 9 standard corrective combos (Z-X-Z..T-X-T), main-pattern combos (I-X-Z, G-X-F),
 * X-Wave validation (>=3 candles; Single/Zigzag/Impulsive), 3-Cardinal-Rule check,
 * 7-tier priority ladder, credibility cost (~1% visibility), market-end restriction, and Fars (فارس) case study.
 */

import React, { useMemo, useState } from 'react';
import {
  Candle,
  ComplexAnalysisOptions,
  PatternFamily,
  WaveScenario,
  WaveVertex
} from '../types/elliott';
import { RulesEngine } from '../engine/rulesEngine';
import { PatternEngines } from '../engine/patternEngines';
import {
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  SlidersHorizontal,
  RotateCcw,
  ArrowUpLeft,
  Sparkles
} from 'lucide-react';

interface ComplexPatternInspectorProps {
  scenario: WaveScenario;
  scenarios?: WaveScenario[];
  candles: Candle[];
  onApplyPattern?: (pattern: PatternFamily) => void;
  onApplyVertices?: (vertices: WaveVertex[]) => void;
  compact?: boolean;
}

type SimSignatureMode =
  | 'AUTO'
  | 'Z-X-Z'
  | 'Z-X-F'
  | 'F-X-T'
  | 'F-X-F'
  | 'T-X-Z'
  | 'T-X-T'
  | 'I-X-Z'
  | 'Z-X-I'
  | 'F-X-I'
  | 'G-X-F'
  | 'G-X-G'
  | 'TERM-X-TERM'
  | 'I-X-I'
  | 'Z-X-F-X-Z'
  | 'Z-X-Z-X-Z-X-Z'
  | 'Z';

type SimXWaveMode =
  | 'AUTO'
  | 'ZIGZAG_535'
  | 'ZIGZAG_333'
  | 'ZIGZAG_355'
  | 'IMPULSIVE'
  | 'SINGLE_4'
  | 'INVALID_2';
type SimCardinalMode = 'AUTO' | 'PASS_ALL' | 'FAIL_R1' | 'FAIL_R3' | 'FAIL_R2';
type SimContextMode = 'AUTO' | 'PAST_KNOT' | 'MARKET_END_NO_CONF' | 'MARKET_END_SIMPLE_OK' | 'MARKET_END_CONFIRMED';

export const ComplexPatternInspector: React.FC<ComplexPatternInspectorProps> = ({
  scenario,
  scenarios,
  candles,
  onApplyPattern,
  onApplyVertices,
  compact = false
}) => {
  const [sigMode, setSigMode] = useState<SimSignatureMode>('AUTO');
  const [xWaveMode, setXWaveMode] = useState<SimXWaveMode>('AUTO');
  const [cardinalMode, setCardinalMode] = useState<SimCardinalMode>('AUTO');
  const [contextMode, setContextMode] = useState<SimContextMode>('AUTO');
  const [hasSimpleConfirmation, setHasSimpleConfirmation] = useState<boolean>(false);

  const complexOptions: ComplexAnalysisOptions | undefined = useMemo(() => {
    const opts: ComplexAnalysisOptions = {};
    let hasAny = false;
    if (sigMode !== 'AUTO') {
      opts.signature = sigMode;
      hasAny = true;
    }
    if (xWaveMode === 'ZIGZAG_535' || xWaveMode === 'ZIGZAG_333' || xWaveMode === 'ZIGZAG_355') {
      opts.xWaveKind = 'ZIGZAG';
      opts.xWaveCandles = xWaveMode === 'ZIGZAG_535' ? 11 : xWaveMode === 'ZIGZAG_355' ? 9 : 7;
      hasAny = true;
    } else if (xWaveMode === 'IMPULSIVE') {
      opts.xWaveKind = 'IMPULSIVE';
      opts.xWaveCandles = 6;
      hasAny = true;
    } else if (xWaveMode === 'SINGLE_4') {
      opts.xWaveKind = 'SINGLE';
      opts.xWaveCandles = 4;
      hasAny = true;
    } else if (xWaveMode === 'INVALID_2') {
      opts.xWaveKind = 'SINGLE';
      opts.xWaveCandles = 2;
      hasAny = true;
    }
    if (cardinalMode === 'PASS_ALL') {
      opts.wave2RetracePctOf1 = 61.8;
      opts.wave4RetracePctOf3 = 38.2;
      hasAny = true;
    } else if (cardinalMode === 'FAIL_R1') {
      opts.wave2RetracePctOf1 = 104;
      opts.wave4RetracePctOf3 = 38.2;
      hasAny = true;
    } else if (cardinalMode === 'FAIL_R3') {
      opts.wave2RetracePctOf1 = 55;
      opts.wave4RetracePctOf3 = 105;
      hasAny = true;
    }
    if (contextMode === 'PAST_KNOT') {
      opts.isMarketEnd = false;
      hasAny = true;
    } else if (contextMode === 'MARKET_END_NO_CONF') {
      opts.isMarketEnd = true;
      opts.simplePatternPossible = false;
      opts.hasStrongConfirmation = false;
      hasAny = true;
    } else if (contextMode === 'MARKET_END_SIMPLE_OK') {
      opts.isMarketEnd = true;
      opts.simplePatternPossible = true;
      hasAny = true;
    } else if (contextMode === 'MARKET_END_CONFIRMED') {
      opts.isMarketEnd = true;
      opts.simplePatternPossible = false;
      opts.hasStrongConfirmation = true;
      hasAny = true;
    }
    if (hasSimpleConfirmation) {
      opts.hasSimpleConfirmation = true;
      hasAny = true;
    }
    return hasAny ? opts : undefined;
  }, [sigMode, xWaveMode, cardinalMode, contextMode, hasSimpleConfirmation]);

  const validation = useMemo(() => {
    const evalScenario: WaveScenario =
      cardinalMode === 'FAIL_R2'
        ? {
            ...scenario,
            vertices: [
              { label: '0', price: 100, candleIndex: 0, timestamp: 1, isConfirmed: true },
              { label: 'W', price: 220, candleIndex: 5, timestamp: 2, isConfirmed: true },
              { label: 'X', price: 160, candleIndex: 9, timestamp: 3, isConfirmed: true },
              { label: 'Y', price: 205, candleIndex: 14, timestamp: 4, isConfirmed: true },
              { label: 'X2', price: 175, candleIndex: 18, timestamp: 5, isConfirmed: true },
              { label: 'Z', price: 300, candleIndex: 24, timestamp: 6, isConfirmed: true }
            ]
          }
        : scenario;
    return RulesEngine.ComplexPatternValidator(evalScenario, candles, complexOptions);
  }, [scenario, candles, complexOptions, cardinalMode]);

  const report = validation.report;

  const farsPreview = useMemo(
    () =>
      PatternEngines.evaluateFarsWaveStructure({
        signature: sigMode === 'AUTO' ? 'Z-X-F-X-Z' : sigMode,
        cardinalRulesPassed: report.threeCardinalPassed,
        x1Candles: report.xWaveCandleCount || 5,
        x2Candles: Math.max(4, report.xWaveCandleCount || 5)
      }),
    [sigMode, report.threeCardinalPassed, report.xWaveCandleCount]
  );

  const xWaveCardEval = useMemo(() => {
    const subSig =
      xWaveMode === 'ZIGZAG_535'
        ? '5-3-5'
        : xWaveMode === 'ZIGZAG_333'
        ? '3-3-3'
        : xWaveMode === 'ZIGZAG_355'
        ? '3-5-5'
        : undefined;
    const kind =
      xWaveMode === 'AUTO'
        ? 'AUTO'
        : xWaveMode.startsWith('ZIGZAG')
        ? 'ZIGZAG'
        : xWaveMode === 'IMPULSIVE'
        ? 'IMPULSIVE'
        : 'SINGLE';
    return PatternEngines.evaluateXWave({
      kind,
      candleCount: report.xWaveCandleCount,
      subwaveSignature: subSig,
      slotRole: 'CORRECTIVE'
    });
  }, [xWaveMode, report.xWaveCandleCount]);

  const simpleRecommender = useMemo(
    () =>
      PatternEngines.recommendSimpleCountingInComplex({
        simpleZPossible: contextMode === 'MARKET_END_SIMPLE_OK' || report.patternSignature === 'Z',
        standardZXZPossible: report.standard || report.patternSignature === 'Z-X-Z',
        nonStandardChainPossible: !report.standard && report.isComplexPattern
      }),
    [contextMode, report.patternSignature, report.standard, report.isComplexPattern]
  );

  const comboMatrixItems = useMemo(() => {
    const signatures: Array<{ sig: SimSignatureMode; label: string; group: 'CORRECTIVE_9' | 'MAIN' }> = [
      { sig: 'Z-X-Z', label: 'Z-X-Z', group: 'CORRECTIVE_9' },
      { sig: 'Z-X-F', label: 'Z-X-F', group: 'CORRECTIVE_9' },
      { sig: 'F-X-T', label: 'F-X-T', group: 'CORRECTIVE_9' },
      { sig: 'F-X-F', label: 'F-X-F', group: 'CORRECTIVE_9' },
      { sig: 'T-X-Z', label: 'T-X-Z', group: 'CORRECTIVE_9' },
      { sig: 'T-X-T', label: 'T-X-T', group: 'CORRECTIVE_9' },
      { sig: 'I-X-Z', label: 'I-X-Z', group: 'MAIN' },
      { sig: 'Z-X-I', label: 'Z-X-I', group: 'MAIN' },
      { sig: 'F-X-I', label: 'F-X-I', group: 'MAIN' },
      { sig: 'G-X-F', label: 'G-X-F', group: 'MAIN' },
      { sig: 'G-X-G', label: 'G-X-G', group: 'MAIN' },
      { sig: 'TERM-X-TERM', label: 'TERM-X-TERM', group: 'MAIN' },
      { sig: 'I-X-I', label: 'I-X-I', group: 'MAIN' }
    ];
    return signatures.map(item => ({
      ...item,
      eval: PatternEngines.evaluateComplexCombinationSignature(item.sig)
    }));
  }, []);

  const conversionCandidates = useMemo(
    () =>
      RulesEngine.ComplexPatternEngine.scanForComplexCandidates(
        scenarios && scenarios.length > 0 ? scenarios : [scenario],
        candles
      ),
    [scenarios, scenario, candles]
  );

  const priorityLadder = [
    { rank: 1, code: 'I', label: 'ایده‌آل' },
    { rank: 2, code: 'G', label: 'قطر' },
    { rank: 3, code: 'T', label: 'ترمینال' },
    { rank: 4, code: 'Z', label: 'زیگزاگ' },
    { rank: 5, code: 'F', label: 'فلت' },
    { rank: 6, code: 'Tri', label: 'مثلث' },
    { rank: 7, code: 'W-X-Y', label: 'ترکیبی' }
  ];

  return (
    <div
      data-testid="complex-pattern-inspector"
      className="rounded-xl bg-[#0b1324] border border-slate-800 p-4 space-y-4 text-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 font-bold text-white">
            <GitMerge className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="truncate">بازرس الگوهای ترکیبی و موج X (جلسه ۱۶)</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums flex items-center gap-2 flex-wrap">
            <span>امضا: <strong className="text-slate-200">{report.patternSignature}</strong></span>
            <span aria-hidden="true">·</span>
            <span>{report.standard ? 'استاندارد (۲ الگو)' : report.isComplexPattern ? 'غیراستاندارد' : 'ساده‌شماری'}</span>
            <span aria-hidden="true">·</span>
            <span>اولویت: {report.priorityRank}/۷</span>
          </div>
        </div>
        <div className="text-left shrink-0 font-mono tabular-nums">
          <div className={`text-sm font-bold ${report.threeCardinalPassed && report.xWaveValid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {report.confidence}%
          </div>
          <div className="text-[10px] text-slate-400">
            اعتبار: {report.credibilityTier === 'HIGH' ? 'بالا' : report.credibilityTier === 'MEDIUM' ? 'متوسط' : 'کم (~۱٪)'}
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (clean hairline surfaces, tabular numerals, zero pills) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-900/70 border border-slate-800/80 p-2.5 space-y-1">
          <div className="text-[10px] text-slate-400">وضعیت ترکیب</div>
          <div className={`font-bold font-mono tabular-nums ${
            !report.isComplexPattern ? 'text-cyan-300' : report.standard ? 'text-emerald-300' : 'text-amber-300'
          }`}>
            {!report.isComplexPattern
              ? 'الگوی ساده'
              : report.combinationTier === 'STANDARD_2'
              ? 'استاندارد ۲الگویی'
              : report.combinationTier === 'NON_STANDARD_3'
              ? 'غیراستاندارد ۳الگویی'
              : 'غیراستاندارد شدید'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {report.rarityStatus === 'RARE' ? 'نادر' : report.rarityStatus === 'VERY_RARE' ? 'بسیار نادر' : 'رایج/استاندارد'}
          </div>
        </div>

        <div className="rounded-lg bg-slate-900/70 border border-slate-800/80 p-2.5 space-y-1">
          <div className="text-[10px] text-slate-400">موج رابط X (جلسه ۱۷)</div>
          <div className={`font-bold font-mono tabular-nums ${xWaveCardEval.isValid ? 'text-emerald-300' : 'text-rose-300'}`}>
            {xWaveCardEval.isValid ? `${report.xWaveCandleCount} کندل · معتبر` : `${report.xWaveCandleCount} کندل · نامعتبر`}
          </div>
          <div className="text-[10px] text-slate-400 truncate font-mono">
            {xWaveCardEval.xWaveSubType} · {xWaveCardEval.xWaveRarity}
          </div>
        </div>

        <div className="rounded-lg bg-slate-900/70 border border-slate-800/80 p-2.5 space-y-1">
          <div className="text-[10px] text-slate-400">۳ قانون بنیادین</div>
          <div className={`font-bold font-mono tabular-nums ${report.threeCardinalPassed ? 'text-emerald-300' : 'text-rose-300'}`}>
            {report.threeCardinalPassed ? '۳ از ۳ برقرار' : `نقض قانون ${report.violatedRules.join('، ')}`}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {report.isMarketEndRestricted ? 'ممنوع انتهای بازار' : 'زمینه مجاز'}
          </div>
        </div>
      </div>

      {/* 7-Tier Counting Priority Ladder (Session 16 §2.5) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px] text-slate-400">
          <span>هرم اولویت شمارش ۷ سطحی (ساده ← ترکیبی آخرین راه‌حل)</span>
          <span className="font-mono tabular-nums">{report.recommend}</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {priorityLadder.map(step => {
            const isCurrent = report.priorityRank === step.rank;
            return (
              <div
                key={step.rank}
                className={`rounded-md border px-1.5 py-1.5 text-center transition-colors ${
                  isCurrent
                    ? step.rank === 7
                      ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                      : 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="font-mono font-bold text-[10px] tabular-nums">{step.rank}. {step.code}</div>
                <div className="text-[9.5px] truncate">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Session 16 Simulator */}
      {!compact && (
        <div className="border-t border-slate-800/80 pt-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
              <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span>شبیه‌ساز قوانین جلسه ۱۶</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSigMode('AUTO');
                setXWaveMode('AUTO');
                setCardinalMode('AUTO');
                setContextMode('AUTO');
                setHasSimpleConfirmation(false);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>بازنشانی</span>
            </button>
          </div>

          {/* Signature Selector */}
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400">ترکیب الگوها و مخفف‌ها (I, G, TERM, F, Z, T, X)</div>
            <div className="flex flex-wrap gap-1">
              {(
                ['AUTO', 'Z-X-Z', 'Z-X-F', 'F-X-T', 'F-X-F', 'T-X-Z', 'T-X-T', 'I-X-Z', 'Z-X-I', 'F-X-I', 'G-X-F', 'G-X-G', 'TERM-X-TERM', 'I-X-I', 'Z-X-F-X-Z', 'Z-X-Z-X-Z-X-Z', 'Z'] as SimSignatureMode[]
              ).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSigMode(mode)}
                  className={`px-2 py-1 rounded-md border text-[10px] font-mono whitespace-nowrap shrink-0 transition-colors ${
                    sigMode === mode
                      ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {mode === 'AUTO' ? 'خودکار' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* X-Wave Mode */}
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400">ساختار و زیرگونه موج رابط X (تکموج / زیگزاگ ۵-۳-۵، ۳-۳-۳، ۳-۵-۵ / شتابدار)</div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'AUTO', label: 'خودکار' },
                  { id: 'SINGLE_4', label: 'تکموج (۴ کندل)' },
                  { id: 'ZIGZAG_535', label: 'زیگزاگ ۵-۳-۵' },
                  { id: 'ZIGZAG_333', label: 'زیگزاگ ۳-۳-۳' },
                  { id: 'ZIGZAG_355', label: 'زیگزاگ ۳-۵-۵' },
                  { id: 'IMPULSIVE', label: 'شتابدار (نادر)' },
                  { id: 'INVALID_2', label: '۲ کندل (نامعتبر)' }
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setXWaveMode(opt.id)}
                  className={`px-2 py-1 rounded-md border text-[10px] whitespace-nowrap shrink-0 transition-colors ${
                    xWaveMode === opt.id
                      ? opt.id === 'INVALID_2'
                        ? 'bg-rose-600 border-rose-400 text-white font-bold'
                        : 'bg-indigo-600 border-indigo-400 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3 Cardinal Rules + Context Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400">آزمون ۳ قانون بنیادین در ترکیبی</div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'AUTO', label: 'خودکار' },
                    { id: 'PASS_ALL', label: 'هر ۳ برقرار' },
                    { id: 'FAIL_R1', label: 'نقض ۱ (W2≥۱۰۰٪)' },
                    { id: 'FAIL_R2', label: 'نقض ۲ (W3 کوتاه‌تر)' },
                    { id: 'FAIL_R3', label: 'نقض ۳ (W4≥۱۰۰٪)' }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCardinalMode(opt.id)}
                    className={`px-2 py-1 rounded-md border text-[10px] whitespace-nowrap shrink-0 transition-colors ${
                      cardinalMode === opt.id
                        ? opt.id.startsWith('FAIL')
                          ? 'bg-rose-600 border-rose-400 text-white font-bold'
                          : 'bg-indigo-600 border-indigo-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] text-slate-400">محدودیت انتهای بازار و ساده‌شماری</div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'AUTO', label: 'خودکار' },
                    { id: 'PAST_KNOT', label: 'گذشته (گره‌گشایی)' },
                    { id: 'MARKET_END_NO_CONF', label: 'انتهای بازار' },
                    { id: 'MARKET_END_SIMPLE_OK', label: 'ساده ممکن' },
                    { id: 'MARKET_END_CONFIRMED', label: 'انتها + تأیید قوی' }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setContextMode(opt.id)}
                    className={`px-2 py-1 rounded-md border text-[10px] whitespace-nowrap shrink-0 transition-colors ${
                      contextMode === opt.id
                        ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setHasSimpleConfirmation(prev => !prev)}
                  className={`px-2 py-1 rounded-md border text-[10px] whitespace-nowrap shrink-0 transition-colors ${
                    hasSimpleConfirmation
                      ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  تأیید از الگوی ساده
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Detected Complex Conversion Candidates (ComplexPatternEngine.scanForComplexCandidates) */}
      {!compact && conversionCandidates.length > 0 && (
        <div
          data-testid="complex-conversion-candidates"
          className="border-t border-slate-800/80 pt-3 space-y-2"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-violet-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>کاندیداهای خودکار تبدیل به الگوی ترکیبی (اسکن سناریوها)</span>
            </span>
            <span className="font-mono tabular-nums text-[10px] text-slate-400">
              {conversionCandidates.length} مورد
            </span>
          </div>
          <div className="space-y-1.5">
            {conversionCandidates.slice(0, 3).map(cand => (
              <div
                key={cand.candidateId}
                className="rounded-lg bg-slate-900/75 border border-slate-800 p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-white font-mono tabular-nums">
                    <span className="text-violet-300">{cand.suggestedSignature}</span>
                    <span className="text-slate-500">·</span>
                    <span>{cand.xWaveCandles} کندل X</span>
                    <span className="text-slate-500">·</span>
                    <span className={cand.coreRulesPassed ? 'text-emerald-300' : 'text-amber-300'}>
                      اطمینان {cand.confidence}%
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">{cand.reasonFa}</p>
                </div>
                {onApplyPattern && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onApplyVertices && cand.suggestedVertices.length >= 4) {
                        onApplyVertices(cand.suggestedVertices);
                      }
                      onApplyPattern('COMPLEX_COMBINATION');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/50 text-violet-100 text-[10px] font-bold whitespace-nowrap shrink-0 transition-colors"
                  >
                    تبدیل با X-Wave
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session 17 ComboMatrix + Simple Recommender + Fars 5-Leg Breakdown */}
      {!compact && (
        <div className="border-t border-slate-800/80 pt-3 space-y-2.5" data-testid="session17-combo-matrix">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-200">
            <span>ماتریس نایابی ترکیب‌های استاندارد و اصلی (جلسه ۱۷)</span>
            <span className="font-mono text-[10px] text-indigo-300">
              پیشنهاد ساده: {simpleRecommender.selectedCount}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {comboMatrixItems.map(item => {
              const tier = item.eval.rarityTier17;
              const tierClass =
                tier === 'MOST_COMMON' || tier === 'COMMON'
                  ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                  : tier === 'LESS_COMMON'
                  ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200'
                  : tier === 'RARE'
                  ? 'border-amber-700/60 bg-amber-950/30 text-amber-200'
                  : 'border-rose-700/60 bg-rose-950/30 text-rose-200';
              return (
                <button
                  key={item.sig}
                  type="button"
                  onClick={() => setSigMode(item.sig)}
                  className={`rounded-md border px-2 py-1 text-right transition-colors ${
                    sigMode === item.sig ? 'ring-1 ring-indigo-400 ' : ''
                  }${tierClass}`}
                >
                  <div className="font-mono font-bold text-[10px]">{item.label}</div>
                  <div className="text-[9px] opacity-85 font-mono">{tier}</div>
                </button>
              );
            })}
          </div>
          <div className="rounded-lg bg-slate-900/75 border border-slate-800 p-2 text-[10.5px] text-slate-300">
            <span className="font-bold text-indigo-300">توصیه ساده‌شماری: </span>
            {simpleRecommender.reasonFa}
          </div>
        </div>
      )}

      {/* Recommendation & Fars Practical Case Summary */}
      <div className="border-t border-slate-800/80 pt-3 space-y-2">
        <div className="flex items-start gap-2 text-[11px] leading-relaxed">
          {report.threeCardinalPassed && report.xWaveValid && !report.isMarketEndRestricted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : report.violatedRules.length > 0 || !report.xWaveValid ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="text-slate-200 font-semibold">{report.recommendFa}</div>
            <div className="text-[10.5px] text-slate-400">{report.credibilityNoteFa}</div>
            <div className="text-[10.5px] text-slate-300">
              مثال عملی فارس (TSE_FARS): {farsPreview.reasonFa}
            </div>
            {farsPreview.legsBreakdown.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5 font-mono text-[10px]">
                {farsPreview.legsBreakdown.map((leg, idx) => (
                  <span
                    key={`${leg.slot}-${idx}`}
                    className={`px-1.5 py-0.5 rounded border ${
                      leg.code.startsWith('X')
                        ? 'bg-violet-950/50 border-violet-700/60 text-violet-200'
                        : 'bg-slate-900 border-slate-700 text-slate-200'
                    }`}
                  >
                    {leg.slot}: {leg.code}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {onApplyPattern && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onApplyPattern('ZIGZAG')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10.5px] font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              <span>ترجیح ساده‌شماری (زیگزاگ)</span>
            </button>
            <button
              type="button"
              onClick={() => onApplyPattern('COMPLEX_COMBINATION')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowUpLeft className="w-3.5 h-3.5 shrink-0" />
              <span>اعمال الگوی ترکیبی (W-X-Y)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
