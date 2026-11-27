/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * BahariSession1819Panel: Interactive Session 18 (Wave Extensions & 3-Point TMV)
 * + Session 19 (8-Wave Personality, 3D Signal Confirmation, Risk Trailing Stop & Price Action Role)
 * studio panel. Works cleanly on desktop and mobile viewports.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Candle, WaveDirection, WaveScenario } from '../types/elliott';
import {
  ExtensionEngine,
  validateWaveExtension,
  detectWave3Extension,
  detectWave5Extension
} from '../engine/extensionEngine';
import { PatternEngines } from '../engine/patternEngines';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Layers,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';

interface BahariSession1819PanelProps {
  scenario: WaveScenario;
  candles: Candle[];
  onHoverLeg?: (legIndex: number | null) => void;
  defaultSection?: 'ALL' | 'EXTENSIONS' | 'PROFILES' | 'RISK_PLAN';
}

export const BahariSession1819Panel: React.FC<BahariSession1819PanelProps> = ({
  scenario,
  candles,
  onHoverLeg,
  defaultSection = 'ALL'
}) => {
  const [activeSection, setActiveSection] = useState<'EXTENSIONS' | 'PROFILES' | 'RISK_PLAN'>(
    defaultSection === 'PROFILES'
      ? 'PROFILES'
      : defaultSection === 'RISK_PLAN'
      ? 'RISK_PLAN'
      : 'EXTENSIONS'
  );

  // Manual/Auto 3-Point X-Y-Z coordinates for interactive TMV projection
  const autoX = scenario.vertices[0]?.price ?? candles[0]?.low ?? 100;
  const autoY = scenario.vertices[1]?.price ?? Math.round(autoX * 1.1);
  const autoZ = scenario.vertices[2]?.price ?? Math.round(autoX * 1.04);

  const [manualTmvMode, setManualTmvMode] = useState(false);
  const [tmvX, setTmvX] = useState<number>(autoX);
  const [tmvY, setTmvY] = useState<number>(autoY);
  const [tmvZ, setTmvZ] = useState<number>(autoZ);
  const [tmvDir, setTmvDir] = useState<WaveDirection>(scenario.direction);

  useEffect(() => {
    if (!manualTmvMode) {
      setTmvX(autoX);
      setTmvY(autoY);
      setTmvZ(autoZ);
      setTmvDir(scenario.direction);
    }
  }, [manualTmvMode, autoX, autoY, autoZ, scenario.direction, scenario.id]);

  // Session 19 Interactive Execution Checklist State
  const [hasWaveCounting, setHasWaveCounting] = useState(true);
  const [usesIndicators, setUsesIndicators] = useState(true);
  const [usesClassicPatterns, setUsesClassicPatterns] = useState(true);
  const [usesTabloFlow, setUsesTabloFlow] = useState(false);
  const [trailingStopActive, setTrailingStopActive] = useState(true);
  const [steppedTakeProfit, setSteppedTakeProfit] = useState(true);
  const [hasPositionSizing, setHasPositionSizing] = useState(true);
  const [hasExitPlan, setHasExitPlan] = useState(true);

  // Live Session 18 calculations
  const extValidation = useMemo(
    () => validateWaveExtension(scenario, candles),
    [scenario, candles]
  );
  const wave3Ext = useMemo(() => detectWave3Extension(scenario), [scenario]);
  const wave5Ext = useMemo(() => detectWave5Extension(scenario), [scenario]);

  const effectiveTmvResult = useMemo(() => {
    if (manualTmvMode) {
      return ExtensionEngine.calculateTMVTargets({
        x: tmvX,
        y: tmvY,
        z: tmvZ,
        direction: tmvDir
      });
    }
    return ExtensionEngine.calculateTMVTargets(scenario);
  }, [manualTmvMode, tmvX, tmvY, tmvZ, tmvDir, scenario]);

  const tmvShort618 = useMemo(() => {
    const span = Math.abs(tmvY - tmvX);
    if (span <= 0) return null;
    const raw = tmvDir === 'BULLISH' ? tmvZ + span * 0.618 : tmvZ - span * 0.618;
    return Math.round(raw * 100) / 100;
  }, [tmvX, tmvY, tmvZ, tmvDir]);

  // Live Session 19 calculations
  const waveTraits = useMemo(
    () => PatternEngines.analyzeSession19WaveCharacteristics(scenario, candles),
    [scenario, candles]
  );

  const signalReadiness = useMemo(
    () =>
      PatternEngines.evaluateSignalGenerationMethods({
        hasWaveCounting,
        usesIndicators,
        usesClassicPatterns,
        usesTabloFlow
      }),
    [hasWaveCounting, usesIndicators, usesClassicPatterns, usesTabloFlow]
  );

  const riskReadiness = useMemo(
    () =>
      PatternEngines.evaluateRiskManagementReadiness({
        trailingStopActive,
        steppedTakeProfit
      }),
    [trailingStopActive, steppedTakeProfit]
  );

  const capitalReadiness = useMemo(
    () =>
      PatternEngines.evaluateCapitalManagementPostChart({
        hasWaveCounting,
        hasRiskManagement: trailingStopActive,
        hasPositionSizing,
        hasExitPlan
      }),
    [hasWaveCounting, trailingStopActive, hasPositionSizing, hasExitPlan]
  );

  const priceActionEval = useMemo(
    () =>
      PatternEngines.evaluatePriceActionRole({
        usesPriceAction: usesClassicPatterns,
        hasWaveCounting,
        usesIndicators,
        usesTablo: usesTabloFlow
      }),
    [usesClassicPatterns, hasWaveCounting, usesIndicators, usesTabloFlow]
  );

  const extWaveLabelFa =
    extValidation.extendedWave === 'WAVE_1'
      ? 'کشیدگی موج ۱'
      : extValidation.extendedWave === 'WAVE_3'
      ? 'کشیدگی موج ۳'
      : extValidation.extendedWave === 'WAVE_5'
      ? 'کشیدگی موج ۵'
      : 'ساختار متعادل (بدون کشیدگی شدید)';

  return (
    <section
      data-testid="bahari-session-18-19-panel"
      onClick={e => e.stopPropagation()}
      className="rounded-xl bg-[#0a1223] border border-slate-800 overflow-hidden space-y-0"
    >
      {/* Panel Header & Section Switcher */}
      <div className="p-3 bg-slate-950/70 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>کشیدگی امواج، TMV سه‌نقطه‌ای و پلن معاملاتی (جلسات ۱۸ و ۱۹)</span>
          </div>
          <span
            className={`text-[10.5px] font-bold ${
              wave5Ext.dangerBell
                ? 'text-rose-300'
                : extValidation.extendedWave
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {extWaveLabelFa}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 text-[10.5px]">
          <button
            type="button"
            onClick={() => setActiveSection('EXTENSIONS')}
            className={`py-1.5 px-2 rounded-md font-semibold transition-colors whitespace-nowrap ${
              activeSection === 'EXTENSIONS'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            کشیدگی و TMV (۱۸)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('PROFILES')}
            className={`py-1.5 px-2 rounded-md font-semibold transition-colors whitespace-nowrap ${
              activeSection === 'PROFILES'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            شخصیت ۸ موج ({waveTraits.items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('RISK_PLAN')}
            className={`py-1.5 px-2 rounded-md font-semibold transition-colors whitespace-nowrap ${
              activeSection === 'RISK_PLAN'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            سیگنال و ریسک (۱۹)
          </button>
        </div>
      </div>

      {/* SECTION 1: Session 18 Wave Extensions & 3-Point TMV Calculator */}
      {activeSection === 'EXTENSIONS' && (
        <div className="p-3 space-y-3 text-[11px]">
          {/* Wave 1 / 3 / 5 Extension Live Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Wave 1 Extension */}
            <div
              className={`p-2.5 rounded-lg border space-y-1 ${
                extValidation.isWave1Extended
                  ? 'bg-amber-950/25 border-amber-500/45'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-slate-100">کشیدگی موج ۱</span>
                <span
                  className={`font-mono text-[10px] font-bold ${
                    extValidation.isWave1Extended ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  {extValidation.isWave1Extended ? 'فعال' : 'عادی'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                پوشش قبلی: {extValidation.priorMoveCoveragePct}٪ · موج ۲:{' '}
                {extValidation.wave2RetracePct !== null ? `${extValidation.wave2RetracePct}٪` : '—'}
              </div>
              <div className="text-[10px] text-slate-300 leading-relaxed">
                شرط: پوشش ۱۰۰٪ موج قبل و اصلاح موج ۲ کمتر از ۳۸.۲٪
              </div>
            </div>

            {/* Wave 3 Extension */}
            <div
              className={`p-2.5 rounded-lg border space-y-1 ${
                wave3Ext.isWave3Extended
                  ? 'bg-emerald-950/25 border-emerald-500/45'
                  : wave3Ext.status === 'BORDERLINE'
                  ? 'bg-amber-950/25 border-amber-500/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-slate-100">کشیدگی موج ۳</span>
                <span
                  className={`font-mono text-[10px] font-bold ${
                    wave3Ext.isWave3Extended
                      ? 'text-emerald-300'
                      : wave3Ext.status === 'BORDERLINE'
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {wave3Ext.isWave3Extended
                    ? 'تاییدشده'
                    : wave3Ext.status === 'BORDERLINE'
                    ? 'مرزی ۳۸.۲٪'
                    : 'عادی'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                موج ۳/۱: {wave3Ext.wave3PctOf1 !== null ? `${wave3Ext.wave3PctOf1}٪` : '—'} · موج ۴:{' '}
                {wave3Ext.wave4RetracePct !== null ? `${wave3Ext.wave4RetracePct}٪` : '—'}
              </div>
              <div className="text-[10px] text-slate-300 leading-relaxed">
                شرط: موج ۳ &gt; ۱۶۱.۸٪ موج ۱ و اصلاح موج ۴ &lt; ۳۸.۲٪ موج ۳
              </div>
            </div>

            {/* Wave 5 Extension */}
            <div
              className={`p-2.5 rounded-lg border space-y-1 ${
                wave5Ext.dangerBell
                  ? 'bg-rose-950/35 border-rose-500/55'
                  : wave5Ext.isWave5Extended
                  ? 'bg-amber-950/25 border-amber-500/45'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-slate-100">کشیدگی موج ۵</span>
                <span
                  className={`font-mono text-[10px] font-bold ${
                    wave5Ext.dangerBell
                      ? 'text-rose-300'
                      : wave5Ext.isWave5Extended
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {wave5Ext.dangerBell
                    ? 'زنگ خطر ریزش!'
                    : wave5Ext.isWave5Extended
                    ? 'کشیده'
                    : 'عادی'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                موج ۵/۳: {wave5Ext.wave5PctOf3 !== null ? `${wave5Ext.wave5PctOf3}٪` : '—'}
              </div>
              <div className="text-[10px] text-slate-300 leading-relaxed">
                عبور از ۲۰۰٪ موج ۳ نشانه فرسایش روند و نیاز به سیو سود پله‌ای است.
              </div>
            </div>
          </div>

          {/* Consequences & Engine Reasoning */}
          {(extValidation.consequencesFa.length > 0 || wave3Ext.reasonFa) && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-[10.5px]">
              <div className="font-bold text-cyan-300">{extValidation.reasonFa}</div>
              {extValidation.consequencesFa.slice(0, 3).map((item, idx) => (
                <div key={idx} className="text-slate-300 leading-relaxed">
                  • {item}
                </div>
              ))}
            </div>
          )}

          {/* Interactive 3-Point TMV Calculator (X - Y - Z) */}
          <div className="p-3 rounded-xl bg-slate-950/85 border border-sky-500/30 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold text-sky-300">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span>محاسبه‌گر سه‌نقطه‌ای اهداف حرکت (TMV)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setManualTmvMode(v => !v)}
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold transition-colors ${
                    manualTmvMode
                      ? 'bg-sky-600/30 border-sky-400/60 text-sky-100'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {manualTmvMode ? 'ویرایش دستی فعال' : 'همگام با نقاط چارت'}
                </button>
                {manualTmvMode && (
                  <button
                    type="button"
                    onClick={() => setManualTmvMode(false)}
                    title="بازگشت به نقاط خودکار چارت"
                    className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Editable X, Y, Z & Direction Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <label className="space-y-1 block">
                <span className="text-slate-400 block">نقطه X (شروع موج ۱)</span>
                <input
                  type="number"
                  value={tmvX}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (Number.isNaN(val)) return;
                    setManualTmvMode(true);
                    setTmvX(val);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-sky-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400 block">نقطه Y (پایان موج ۱)</span>
                <input
                  type="number"
                  value={tmvY}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (Number.isNaN(val)) return;
                    setManualTmvMode(true);
                    setTmvY(val);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-sky-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400 block">نقطه Z (پایان موج ۲)</span>
                <input
                  type="number"
                  value={tmvZ}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (Number.isNaN(val)) return;
                    setManualTmvMode(true);
                    setTmvZ(val);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-sky-500"
                />
              </label>

              <div className="space-y-1">
                <span className="text-slate-400 block">جهت روند</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualTmvMode(true);
                    setTmvDir(d => (d === 'BULLISH' ? 'BEARISH' : 'BULLISH'));
                  }}
                  className={`w-full py-1 px-2 rounded border text-xs font-bold flex items-center justify-center gap-1 ${
                    tmvDir === 'BULLISH'
                      ? 'bg-emerald-950/40 border-emerald-500/45 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/45 text-rose-300'
                  }`}
                >
                  {tmvDir === 'BULLISH' ? (
                    <>
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>صعودی</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>نزولی</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Calculated TMV Trio Readout */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono tabular-nums text-[10px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-sans text-slate-400">اولیه (TMV&apos;)</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {effectiveTmvResult.tmvPrime !== null ? effectiveTmvResult.tmvPrime.toLocaleString() : '—'}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-sans text-slate-400">کوتاه (۶۱.۸٪)</div>
                <div className="text-xs font-bold text-cyan-300 mt-0.5">
                  {tmvShort618 !== null ? tmvShort618.toLocaleString() : '—'}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/40">
                <div className="font-sans text-emerald-300 font-semibold">ایده‌آل (۱۰۰٪)</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {effectiveTmvResult.tmvIdeal !== null ? effectiveTmvResult.tmvIdeal.toLocaleString() : '—'}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-amber-950/25 border border-amber-500/40">
                <div className="font-sans text-amber-300 font-semibold">کشیده (۱۶۱.۸٪)</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {effectiveTmvResult.tmvAlternate !== null
                    ? effectiveTmvResult.tmvAlternate.toLocaleString()
                    : '—'}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-purple-950/25 border border-purple-500/35 col-span-2 sm:col-span-1">
                <div className="font-sans text-purple-300">اکسترم (۲۶۱.۸٪)</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {effectiveTmvResult.tmvAlternate2618 !== null
                    ? effectiveTmvResult.tmvAlternate2618.toLocaleString()
                    : '—'}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">قاعده کلیدی TMV در برابر PRZ:</strong> سطح TMV هدف حداقلی حرکت موج است (انتظار می‌رود قیمت به آن برسد)، در حالی که PRZ محدوده احتمالی توقف و بازگشت قیمت محسوب می‌شود.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Session 19 8-Wave Personality Profiles (Waves 1..5, A..C) */}
      {activeSection === 'PROFILES' && (
        <div
          className="p-3 space-y-2.5 text-[11px]"
          onMouseLeave={() => onHoverLeg?.(null)}
        >
          {waveTraits.waveAIdentificationWarningFa && (
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/35 text-amber-200 text-[10.5px] leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{waveTraits.waveAIdentificationWarningFa}</span>
            </div>
          )}

          {waveTraits.items.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-400 text-center">
              برای تحلیل شخصیت موج‌ها حداقل ۲ نقطه پیوت لازم است.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {waveTraits.items.map((w, idx) => (
                <div
                  key={`${w.label}-${idx}`}
                  onMouseEnter={() => onHoverLeg?.(idx)}
                  onMouseLeave={() => onHoverLeg?.(null)}
                  className={`p-2.5 rounded-lg border transition-colors space-y-1 ${
                    w.valid
                      ? 'bg-slate-950/75 border-slate-800 hover:border-cyan-500/50'
                      : 'bg-rose-950/25 border-rose-500/45'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-cyan-300 text-xs">{w.label}</span>
                      <span
                        className={`text-[10px] font-semibold ${
                          w.role === 'MOTIVE' ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {w.role === 'MOTIVE' ? 'اصلی' : 'اصلاحی'}
                      </span>
                      {w.lengthPctOfRef !== null && (
                        <span className="font-mono tabular-nums text-[10px] text-slate-400">
                          ({w.lengthPctOfRef}٪)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[9.5px] font-mono tabular-nums shrink-0">
                      <span className="text-slate-400">{w.candleSpan} کندل</span>
                      <span
                        className={`font-sans font-semibold ${
                          w.volumeProfile === 'HIGH'
                            ? 'text-emerald-300'
                            : w.volumeProfile === 'LOW'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                        }`}
                      >
                        · حجم {w.volumeProfile === 'HIGH' ? 'بالا' : w.volumeProfile === 'LOW' ? 'کم' : 'متعادل'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">{w.traitFa}</p>
                </div>
              ))}
            </div>
          )}

          {waveTraits.warnings.length > 0 && (
            <div className="p-2 rounded-lg bg-rose-950/25 border border-rose-500/35 space-y-1 text-[10px] text-rose-200">
              {waveTraits.warnings.map((warn, i) => (
                <div key={i}>• {warn}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Session 19 Interactive Risk, Signal 3D, Price Action & Capital Plan */}
      {activeSection === 'RISK_PLAN' && (
        <div className="p-3 space-y-3 text-[11px]">
          {/* Risk Readiness Banner */}
          <div
            className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 flex-wrap ${
              riskReadiness.riskLevel === 'CONTROLLED' && capitalReadiness.complete
                ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100'
                : 'bg-rose-950/30 border-rose-500/45 text-rose-100'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0">
              {riskReadiness.riskLevel === 'CONTROLLED' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-bold">
                  {riskReadiness.status === 'COMPLETE_RISK_MANAGEMENT'
                    ? 'مدیریت ریسک کامل و کنترل‌شده'
                    : 'هشدار ریسک بالا: حد ضرر متحرک غیرفعال است'}
                </div>
                <p className="text-[10px] opacity-90 leading-relaxed">
                  {riskReadiness.reasonFa} — {capitalReadiness.reasonFa}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Checkboxes for Risk & Capital Management */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-2">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>مدیریت سرمایه و ریسک معامله</span>
              </div>
              <div className="space-y-1.5 text-[10.5px]">
                {[
                  {
                    label: 'موج‌شماری پایه و جهت روند مشخص است',
                    checked: hasWaveCounting,
                    toggle: () => setHasWaveCounting(v => !v)
                  },
                  {
                    label: 'حد ضرر متحرک (Trailing Stop) روی سطوح TMV فعال است',
                    checked: trailingStopActive,
                    toggle: () => setTrailingStopActive(v => !v)
                  },
                  {
                    label: 'سیو سود و خروج پله‌ای (فروش پلکانی روی اهداف)',
                    checked: steppedTakeProfit,
                    toggle: () => setSteppedTakeProfit(v => !v)
                  },
                  {
                    label: 'حجم پوزیشن و ورود پله‌ای تنظیم شده است',
                    checked: hasPositionSizing,
                    toggle: () => setHasPositionSizing(v => !v)
                  },
                  {
                    label: 'نقطه خروج و حد ابطال قطعی ثبت شده است',
                    checked: hasExitPlan,
                    toggle: () => setHasExitPlan(v => !v)
                  }
                ].map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={item.toggle}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 3D Signal Confirmation & Price Action Role */}
            <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-2">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>سیگنال سه‌بعدی و جایگاه پرایس اکشن</span>
              </div>
              <div className="space-y-1.5 text-[10.5px]">
                {[
                  {
                    label: 'اندیکاتورها (واگرایی RSI / MACD و میانگین متحرک)',
                    checked: usesIndicators,
                    toggle: () => setUsesIndicators(v => !v)
                  },
                  {
                    label: 'پرایس اکشن و الگوهای کلاسیک (خط روند / S&R / کندل تایید)',
                    checked: usesClassicPatterns,
                    toggle: () => setUsesClassicPatterns(v => !v)
                  },
                  {
                    label: 'تابلوخوانی و جریان نقدینگی (حجم معاملات / قدرت خریدار)',
                    checked: usesTabloFlow,
                    toggle: () => setUsesTabloFlow(v => !v)
                  }
                ].map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={item.toggle}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[10px]">
                <div
                  className={`flex items-center gap-1.5 font-semibold ${
                    signalReadiness.complete ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {signalReadiness.complete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{signalReadiness.reasonFa}</span>
                </div>
                <div
                  className={`leading-relaxed ${
                    priceActionEval.status === 'INCOMPLETE_STANDALONE'
                      ? 'text-rose-300 font-semibold'
                      : priceActionEval.status === 'COMPLETE'
                      ? 'text-cyan-300'
                      : 'text-slate-300'
                  }`}
                >
                  • {priceActionEval.reasonFa}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
