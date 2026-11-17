/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AnglePenetrationWidget:
 * Graphical sidebar widget analyzing Elliott Wave impact angles & Fibonacci penetration depths
 * to project calibrated Short-Term and Medium-Term price targets with confidence percentages.
 */

import React, { useMemo, useState } from 'react';
import { Candle, WaveRole, WaveScenario } from '../types/elliott';
import { AnglePenetrationEngine, CalibratedAngleTarget } from '../engine/anglePenetrationEngine';
import {
  Compass,
  Crosshair,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Target,
  Activity
} from 'lucide-react';

interface AnglePenetrationWidgetProps {
  scenario: WaveScenario;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
}

type HorizonFilter = 'ALL' | 'SHORT' | 'MEDIUM';

export const AnglePenetrationWidget: React.FC<AnglePenetrationWidgetProps> = ({
  scenario,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = ''
}) => {
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilter>('ALL');
  const [selectedLegIdx, setSelectedLegIdx] = useState<number | null>(null);

  const report = useMemo(
    () => AnglePenetrationEngine.analyze(scenario, candles, parentRole, parentWaveLabel),
    [scenario, candles, parentRole, parentWaveLabel]
  );

  const focusedLeg =
    (selectedLegIdx !== null ? report.legAngles.find(l => l.legIndex === selectedLegIdx) : null) ||
    report.activeLegAngle;

  const displayedTargets = useMemo<CalibratedAngleTarget[]>(() => {
    if (horizonFilter === 'SHORT') return report.shortTermTargets;
    if (horizonFilter === 'MEDIUM') return report.mediumTermTargets;
    return [...report.shortTermTargets, ...report.mediumTermTargets];
  }, [horizonFilter, report.shortTermTargets, report.mediumTermTargets]);

  // SVG Quarter-Protractor Polar Geometry (origin bottom-left inside 135x112 SVG)
  const originX = 20;
  const originY = 96;
  const radius = 78;

  const toRad = (deg: number) => (Math.min(86, Math.max(4, deg)) * Math.PI) / 180;
  const activeDeg = focusedLeg?.absAngleDeg ?? 45;
  const prevDeg = report.previousComparableAngle?.absAngleDeg ?? null;

  const activeTipX = originX + radius * Math.cos(toRad(activeDeg));
  const activeTipY = originY - radius * Math.sin(toRad(activeDeg));

  const prevTipX = prevDeg !== null ? originX + (radius - 14) * Math.cos(toRad(prevDeg)) : null;
  const prevTipY = prevDeg !== null ? originY - (radius - 14) * Math.sin(toRad(prevDeg)) : null;

  // Wedge fill path from 0 deg (baseline) to activeDeg
  const wedgeArcFlag = 0;
  const wedgePath = `M ${originX} ${originY} L ${originX + radius} ${originY} A ${radius} ${radius} 0 ${wedgeArcFlag} 0 ${activeTipX.toFixed(1)} ${activeTipY.toFixed(1)} Z`;

  // Corridor Price Scale Math for Graphical Short vs Medium Range Map
  const corridorStats = useMemo(() => {
    const allPrices = [
      report.currentPrice,
      report.invalidationPrice,
      ...report.shortTermTargets.map(t => t.price),
      ...report.mediumTermTargets.map(t => t.price)
    ].filter(p => Number.isFinite(p) && p > 0);
    if (allPrices.length < 2) return null;
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const span = Math.max(1e-6, maxP - minP);
    const pct = (p: number) => Math.max(3, Math.min(97, ((p - minP) / span) * 100));
    return { minP, maxP, pct };
  }, [report]);

  const isNextBull = report.nextDirection === 'BULLISH';

  return (
    <div className="bg-[#091122] border border-slate-800 rounded-2xl p-4 space-y-4">
      {/* Widget Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
              رادار زوایای برخورد، نفوذ و اهداف قیمتی
            </h3>
            <p className="text-[10.5px] text-slate-400 truncate">
              {scenario.name} · تخمین کوتاه‌مدت و میان‌مدت با وزن‌دهی زاویه
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 font-mono tabular-nums">
          <span className="text-[10px] font-sans text-slate-400">اطمینان ترکیبی</span>
          <span
            className={`text-sm font-black ${
              report.overallConfidencePct >= 75
                ? 'text-emerald-400'
                : report.overallConfidencePct >= 58
                ? 'text-amber-300'
                : 'text-rose-400'
            }`}
          >
            {report.overallConfidencePct}%
          </span>
        </div>
      </div>

      {/* SECTION 1: Graphical Impact Angle Protractor + Wave Slope Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>نقاله گرافیکی زاویه برخورد امواج</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
              isNextBull
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
            }`}
          >
            {isNextBull ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isNextBull ? 'برآیند صعودی' : 'برآیند نزولی'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* SVG Polar Angle Gauge */}
          <div
            className="sm:col-span-6 flex items-center justify-center bg-slate-950/75 border border-slate-800/80 rounded-xl p-2"
            dir="ltr"
          >
            <svg viewBox="0 0 135 112" className="w-full max-w-[185px] h-auto overflow-visible">
              <defs>
                <linearGradient id="feiAngleWedge" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.38" />
                </linearGradient>
              </defs>

              {/* Concentric Protractor Arcs */}
              {[0.45, 0.72, 1].map((scale, idx) => {
                const r = radius * scale;
                return (
                  <path
                    key={idx}
                    d={`M ${originX + r} ${originY} A ${r} ${r} 0 0 0 ${originX} ${originY - r}`}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray={idx < 2 ? '2.5 2.5' : undefined}
                  />
                );
              })}

              {/* Degree Reference Lines (24, 45, 60 deg) */}
              {[24, 45, 60].map(deg => {
                const x = originX + radius * Math.cos(toRad(deg));
                const y = originY - radius * Math.sin(toRad(deg));
                const lx = originX + (radius + 11) * Math.cos(toRad(deg));
                const ly = originY - (radius + 11) * Math.sin(toRad(deg));
                return (
                  <g key={deg}>
                    <line
                      x1={originX}
                      y1={originY}
                      x2={x}
                      y2={y}
                      stroke={deg === 45 ? '#334155' : '#1e293b'}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={lx}
                      y={ly + 3}
                      fill="#64748b"
                      fontSize="7.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {deg}°
                    </text>
                  </g>
                );
              })}

              {/* Baseline Horizontal & Vertical Axes */}
              <line x1={originX} y1={originY} x2={originX + radius + 4} y2={originY} stroke="#475569" strokeWidth="1.2" />
              <line x1={originX} y1={originY} x2={originX} y2={originY - radius - 4} stroke="#334155" strokeWidth="1" />

              {/* Active Angle Shaded Wedge */}
              <path d={wedgePath} fill="url(#feiAngleWedge)" />

              {/* Previous Comparable Wave Vector (Amber Dashed) */}
              {prevTipX !== null && prevTipY !== null && (
                <>
                  <line
                    x1={originX}
                    y1={originY}
                    x2={prevTipX}
                    y2={prevTipY}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    opacity="0.85"
                  />
                  <circle cx={prevTipX} cy={prevTipY} r="2.6" fill="#f59e0b" />
                </>
              )}

              {/* Active Wave Impact Vector (Cyan Luminous Ray) */}
              <line
                x1={originX}
                y1={originY}
                x2={activeTipX}
                y2={activeTipY}
                stroke="#22d3ee"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx={activeTipX} cy={activeTipY} r="3.6" fill="#22d3ee" stroke="#083344" strokeWidth="1.2" />
              <circle cx={originX} cy={originY} r="3" fill="#e2e8f0" />

              {/* Direct Center Angle Readout */}
              <text
                x={originX + 6}
                y={originY - 6}
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {activeDeg.toFixed(1)}°
              </text>
            </svg>
          </div>

          {/* Numeric Angle Readout & Verdict */}
          <div className="sm:col-span-6 space-y-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">گام منتخب:</span>
                <span className="font-mono font-bold text-white">
                  {focusedLeg ? focusedLeg.label : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">زاویه برخورد / شیب:</span>
                <span className="font-mono font-black text-cyan-300 tabular-nums">
                  {activeDeg.toFixed(1)}°
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">زاویه همگرایی تراز:</span>
                <span className="font-mono font-bold text-indigo-300 tabular-nums">
                  {report.convergenceAngleDeg.toFixed(1)}°
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">دلتا نسبت به هم‌نقش:</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    report.momentumDeltaDeg >= 0 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {report.momentumDeltaDeg > 0 ? `+${report.momentumDeltaDeg}°` : `${report.momentumDeltaDeg}°`}
                </span>
              </div>
            </div>

            <div className="text-[10.5px] text-slate-300 leading-relaxed">
              {focusedLeg?.regimeLabelFa || 'تعادل حرکتی'} — {report.impactVerdictFa}
            </div>
          </div>
        </div>

        {/* Clickable Per-Wave Slope Histogram */}
        {report.legAngles.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>مقایسه زاویه امواج (برای بازبینی هر موج کلیک کنید):</span>
              <span className="font-mono tabular-nums">مرجع ایده‌آل: ۴۵°</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {report.legAngles.slice(-5).map(leg => {
                const isSelected = focusedLeg?.legIndex === leg.legIndex;
                const heightPct = Math.min(100, Math.max(14, (leg.absAngleDeg / 84) * 100));
                return (
                  <button
                    key={leg.legIndex}
                    type="button"
                    onClick={() => setSelectedLegIdx(leg.legIndex)}
                    className={`p-1.5 rounded-lg border text-center transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/45 border-cyan-500/60'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="h-9 flex items-end justify-center mb-1">
                      <div
                        className={`w-3.5 rounded-t transition-all ${
                          leg.absAngleDeg >= 60
                            ? 'bg-emerald-400'
                            : leg.absAngleDeg >= 42
                            ? 'bg-cyan-400'
                            : leg.isDivergentWeakness
                            ? 'bg-rose-400'
                            : 'bg-amber-400'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <div className="font-mono text-[9.5px] font-bold text-white truncate">{leg.label}</div>
                    <div className="font-mono text-[9px] text-slate-400 tabular-nums">{leg.absAngleDeg}°</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Graphical Fibonacci Penetration Depth Meter */}
      <div className="border-t border-slate-800/80 pt-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>نردبان گرافیکی سطوح نفوذ الیوت</span>
          </span>
          <span className="font-mono tabular-nums text-[10.5px] text-white">
            نفوذ فعلی: <strong className="text-amber-300">{report.penetration.currentRetraceOrBreakPct}%</strong>
          </span>
        </div>

        {/* Visual Depth Track 0% -> 100% with Golden Zone Highlight */}
        <div className="space-y-1" dir="ltr">
          <div className="relative h-4 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            {/* Golden Zone 50%..61.8% */}
            <div
              className="absolute top-0 bottom-0 bg-emerald-500/20 border-x border-emerald-500/45"
              style={{ left: '50%', width: '11.8%' }}
            />
            {/* Current Penetration Fill */}
            <div
              className={`h-full rounded-l-full transition-all ${
                report.penetration.currentRetraceOrBreakPct >= 100
                  ? 'bg-rose-500/75'
                  : report.penetration.goldenZoneActive
                  ? 'bg-emerald-500/75'
                  : 'bg-amber-500/70'
              }`}
              style={{ width: `${Math.min(100, Math.max(4, report.penetration.currentRetraceOrBreakPct))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono tabular-nums text-slate-500 px-0.5">
            <span>0%</span>
            <span>38.2%</span>
            <span className="text-emerald-400 font-bold">50–61.8%</span>
            <span>78.6%</span>
            <span className="text-rose-400">100%</span>
          </div>
        </div>

        {/* Key Structural Penetrations */}
        <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[10px]">
          <div className="p-1.5 rounded-lg bg-slate-950/75 border border-slate-800">
            <div className="font-sans text-[9.5px] text-slate-400">نفوذ ۲ در ۱</div>
            <div
              className={`font-bold ${
                report.penetration.wave2IntoWave1Pct !== null && report.penetration.wave2IntoWave1Pct >= 100
                  ? 'text-rose-400'
                  : 'text-emerald-300'
              }`}
            >
              {report.penetration.wave2IntoWave1Pct !== null ? `${report.penetration.wave2IntoWave1Pct}%` : '—'}
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-950/75 border border-slate-800">
            <div className="font-sans text-[9.5px] text-slate-400">نفوذ ۴ در ۱</div>
            <div
              className={`font-bold ${
                report.penetration.wave4IntoWave1Pct && report.penetration.wave4IntoWave1Pct > 0
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}
            >
              {report.penetration.wave4IntoWave1Pct !== null ? `${report.penetration.wave4IntoWave1Pct}%` : '—'}
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-950/75 border border-slate-800">
            <div className="font-sans text-[9.5px] text-slate-400">برتری ۳ بر ۱</div>
            <div className="font-bold text-cyan-300">
              {report.penetration.wave3BreakoutPct !== null ? `+${report.penetration.wave3BreakoutPct}%` : '—'}
            </div>
          </div>
        </div>

        {/* Individual Penetration Level Rows */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          {report.penetration.levels.map(lvl => (
            <div
              key={lvl.id}
              title={lvl.significanceFa}
              className={`px-2 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 ${
                lvl.status === 'TESTING'
                  ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-100'
                  : lvl.status === 'VIOLATED'
                  ? 'bg-rose-950/35 border-rose-500/45 text-rose-100'
                  : lvl.status === 'PENETRATED'
                  ? 'bg-amber-950/25 border-amber-500/35 text-amber-100'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1 min-w-0">
                {lvl.status === 'TESTING' ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : lvl.status === 'VIOLATED' ? (
                  <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                ) : lvl.status === 'PENETRATED' ? (
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                ) : (
                  <Target className="w-3 h-3 text-slate-500 shrink-0" />
                )}
                <span className="font-mono font-bold truncate">{lvl.ratioLabel}</span>
              </div>
              <span className="font-mono tabular-nums text-white font-semibold">
                {lvl.price.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-300 leading-relaxed">{report.penetration.structuralRiskFa}</p>
      </div>

      {/* SECTION 3: Graphical Short-Term & Medium-Term Targets with Confidence */}
      <div className="border-t border-slate-800/80 pt-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>اهداف قیمتی کوتاه‌مدت و میان‌مدت</span>
          </span>

          {/* Horizon Segmented Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            {(
              [
                { id: 'ALL', label: 'همه' },
                { id: 'SHORT', label: `کوتاه‌مدت (${report.shortTermTargets.length})` },
                { id: 'MEDIUM', label: `میان‌مدت (${report.mediumTermTargets.length})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHorizonFilter(tab.id)}
                className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  horizonFilter === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Graphical Price Corridor Ruler */}
        {corridorStats && (
          <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5" dir="ltr">
            <div className="relative h-6 flex items-center">
              <div className="w-full h-1.5 rounded-full bg-slate-800" />
              {/* Invalidation Marker */}
              <div
                className="absolute w-2.5 h-4 rounded-sm bg-rose-500 border border-rose-200 -translate-x-1/2"
                style={{ left: `${corridorStats.pct(report.invalidationPrice)}%` }}
                title={`ابطال: ${report.invalidationPrice.toLocaleString()}`}
              />
              {/* Current Price Pin */}
              <div
                className="absolute w-2.5 h-5 rounded-sm bg-white border border-slate-900 -translate-x-1/2 z-10"
                style={{ left: `${corridorStats.pct(report.currentPrice)}%` }}
                title={`قیمت فعلی: ${report.currentPrice.toLocaleString()}`}
              />
              {/* Short-term markers (Cyan) */}
              {report.shortTermTargets.map(t => (
                <div
                  key={t.id}
                  className="absolute w-2.5 h-3.5 rounded-full bg-cyan-400 border border-cyan-950 -translate-x-1/2"
                  style={{ left: `${corridorStats.pct(t.price)}%` }}
                  title={`${t.titleFa}: ${t.price.toLocaleString()} (${t.confidencePct}%)`}
                />
              ))}
              {/* Medium-term markers (Emerald) */}
              {report.mediumTermTargets.map(t => (
                <div
                  key={t.id}
                  className="absolute w-2.5 h-3.5 rounded-full bg-emerald-400 border border-emerald-950 -translate-x-1/2"
                  style={{ left: `${corridorStats.pct(t.price)}%` }}
                  title={`${t.titleFa}: ${t.price.toLocaleString()} (${t.confidencePct}%)`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 text-[9.5px] font-sans text-slate-400 flex-wrap" dir="rtl">
              <span className="inline-flex items-center gap-1 text-rose-300 font-mono tabular-nums">
                <ShieldAlert className="w-3 h-3 shrink-0" />
                <span>ابطال: {report.invalidationPrice.toLocaleString()}</span>
              </span>
              <span className="text-white font-mono tabular-nums">
                فعلی: {report.currentPrice.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-300">
                <Crosshair className="w-3 h-3 shrink-0" />
                <span>کوتاه‌مدت</span>
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Target className="w-3 h-3 shrink-0" />
                <span>میان‌مدت</span>
              </span>
            </div>
          </div>
        )}

        {/* Target Cards with Graphical Confidence Progress Bars */}
        {displayedTargets.length === 0 ? (
          <div className="text-[11px] text-slate-400 text-center py-3">
            حداقل ۲ پیوت معتبر برای محاسبه تارگت لازم است.
          </div>
        ) : (
          <div className="space-y-2">
            {displayedTargets.map(tgt => {
              const isShort = tgt.horizon === 'SHORT';
              const signedDist = tgt.distancePct > 0 ? `+${tgt.distancePct}%` : `${tgt.distancePct}%`;
              return (
                <div
                  key={tgt.id}
                  className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold shrink-0 border ${
                          isShort
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {tgt.horizon === 'SHORT' ? 'کوتاه‌مدت' : 'میان‌مدت'} · {tgt.ratioLabel}
                      </span>
                      <span className="text-[11px] font-bold text-white truncate">{tgt.titleFa}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                      <span
                        className={`text-[10px] font-semibold ${
                          tgt.distancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {signedDist}
                      </span>
                      <strong className="text-xs text-white">{tgt.price.toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* Graphical Confidence Progress Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 shrink-0">درصد اطمینان:</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden" dir="ltr">
                      <div
                        className={`h-full rounded-full ${
                          tgt.confidencePct >= 75
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                            : tgt.confidencePct >= 58
                            ? 'bg-gradient-to-r from-amber-500 to-cyan-400'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${tgt.confidencePct}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-[10.5px] font-black text-cyan-300 shrink-0">
                      {tgt.confidencePct}%
                    </span>
                    <span className="font-mono tabular-nums text-[9.5px] text-slate-400 shrink-0">
                      R/R {tgt.riskReward}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2 flex-wrap">
                    <span className="truncate">{tgt.penetrationBasisFa}</span>
                    <span className="text-cyan-300/90 shrink-0">{tgt.angleAlignmentFa}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
