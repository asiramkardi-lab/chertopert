/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Session 12 (011-flat-pattern-types-engine) UI Component:
 * Flat Pattern 3-3-5 Disambiguation, 8 Subtypes, B > 61.8% Law, Wave C Shape & Market Context Risk.
 */

import React, { useMemo, useState } from 'react';
import { Layers, ShieldAlert, CheckCircle2, AlertTriangle, GitBranch, Compass } from 'lucide-react';
import { Candle, FlatAnalysisOptions, FlatAnalysisReport, WaveScenario } from '../types/elliott';
import { PatternEngines } from '../engine/patternEngines';

interface FlatPatternPanelProps {
  scenario: WaveScenario;
  candles: Candle[];
}

export const FlatPatternPanel: React.FC<FlatPatternPanelProps> = ({ scenario, candles }) => {
  const [simContext, setSimContext] = useState<'AUTO' | 'PAST' | 'END_CONFIRMED' | 'END_UNCONFIRMED'>('AUTO');
  const [simSubwaves, setSimSubwaves] = useState<'AUTO' | '3-3-5' | '3-3-3' | '5-3-5' | '3-5-5'>('AUTO');
  const [simCShape, setSimCShape] = useState<'AUTO' | 'IDEAL' | 'DIAGONAL' | 'TERMINAL'>('AUTO');
  const [simEnv, setSimEnv] = useState<'AUTO' | 'LOW_ANALYST' | 'IRAN_1401' | 'HIGH_STOPS'>('AUTO');

  const options = useMemo<FlatAnalysisOptions>(() => {
    const opts: FlatAnalysisOptions = {};
    if (simSubwaves === '3-3-5') opts.internalSubwaves = [3, 3, 5];
    else if (simSubwaves === '3-3-3') opts.internalSubwaves = [3, 3, 3];
    else if (simSubwaves === '5-3-5') opts.internalSubwaves = [5, 3, 5];
    else if (simSubwaves === '3-5-5') opts.internalSubwaves = [3, 5, 5];
    if (simContext === 'PAST') {
      opts.isMarketEnd = false;
      opts.hasConfirmation = true;
    } else if (simContext === 'END_CONFIRMED') {
      opts.isMarketEnd = true;
      opts.hasConfirmation = true;
    } else if (simContext === 'END_UNCONFIRMED') {
      opts.isMarketEnd = true;
      opts.hasConfirmation = false;
    }

    if (simCShape !== 'AUTO') {
      opts.cSubStructure = simCShape;
    }

    if (simEnv === 'LOW_ANALYST') {
      opts.analystAdoptionPct = 10;
      opts.marketProfile = 'LOW_ANALYST';
    } else if (simEnv === 'IRAN_1401') {
      opts.marketProfile = 'IRAN_1401';
      opts.analystAdoptionPct = 50;
    } else if (simEnv === 'HIGH_STOPS') {
      opts.stopClusterDensity = 'HIGH';
    }
    return opts;
  }, [simContext, simSubwaves, simCShape, simEnv]);

  const report: FlatAnalysisReport = useMemo(
    () => PatternEngines.analyzeFlat(scenario, candles, options),
    [scenario, candles, options]
  );

  const disambiguationLabelFa =
    report.disambiguationKind === 'FLAT'
      ? 'فلت استاندارد (۳-۳-۵)'
      : report.disambiguationKind === 'SIMPLE_ZIGZAG'
      ? 'زیگزاگ سیمپل (B < ۶۱.۸٪ یا ۳-۳-۳)'
      : report.disambiguationKind === 'IDEAL_ZIGZAG'
      ? 'زیگزاگ ایده‌آل (۵-۳-۵)'
      : report.disambiguationKind === 'COMPLEX_COMBINATION'
      ? 'ترکیبی (B > ۶۱.۸٪ + C=۳)'
      : report.disambiguationKind === 'RARE_ANTICYCLE_FLAT'
      ? 'نادر آنتی‌سیکل + فلت (۳-۵-۵)'
      : 'ساختار نامعتبر';

  const credibilityStyle =
    report.contextCredibilityTier === 'HIGH'
      ? 'text-emerald-400'
      : report.contextCredibilityTier === 'MEDIUM'
      ? 'text-amber-300'
      : 'text-rose-400';

  const credibilityLabelFa =
    report.contextCredibilityTier === 'HIGH'
      ? 'بالا (مناسب تحلیل/گره‌گشایی)'
      : report.contextCredibilityTier === 'MEDIUM'
      ? 'متوسط (با تایید)'
      : 'پایین (انتهای بازار پرریسک)';

  const StatusIcon = report.isSevereRunning || !report.usableAtCurrentContext
    ? ShieldAlert
    : report.detected
    ? CheckCircle2
    : AlertTriangle;

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="rounded-xl bg-[#0b1324] border border-slate-800 p-3 space-y-2.5 text-[10.5px] cursor-default"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-slate-100 font-bold">
          <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>تحلیلگر تخصصی فلت و ۸ زیرگونه (جلسه ۱۲)</span>
        </div>
        <div
          className={`flex items-center gap-1 font-bold ${
            report.detected && report.usableAtCurrentContext
              ? 'text-emerald-400'
              : report.usableAtCurrentContext
              ? 'text-amber-300'
              : 'text-rose-400'
          }`}
        >
          <StatusIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{report.subtypeLabelFa}</span>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[10px]">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-slate-400">بافت بازار:</span>
          {(
            [
              { id: 'AUTO', label: 'خودکار' },
              { id: 'PAST', label: 'گذشته بازار' },
              { id: 'END_CONFIRMED', label: 'انتهای بازار+تایید' },
              { id: 'END_UNCONFIRMED', label: 'انتهای بازار بدون تایید' }
            ] as const
          ).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSimContext(item.id)}
              className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                simContext === item.id
                  ? 'bg-indigo-600/35 text-indigo-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">ساختار:</span>
            {(
              [
                { id: 'AUTO', label: 'خودکار' },
                { id: '3-3-5', label: '۳-۳-۵' },
                { id: '3-3-3', label: '۳-۳-۳' },
                { id: '5-3-5', label: '۵-۳-۵' },
                { id: '3-5-5', label: '۳-۵-۵' }
              ] as const
            ).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSimSubwaves(item.id)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono transition-colors ${
                  simSubwaves === item.id
                    ? 'bg-emerald-600/30 text-emerald-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">فرم موج C:</span>
            {(
              [
                { id: 'AUTO', label: 'خودکار' },
                { id: 'IDEAL', label: 'ایده‌آل' },
                { id: 'DIAGONAL', label: 'قطری' },
                { id: 'TERMINAL', label: 'ترمینال' }
              ] as const
            ).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSimCShape(item.id)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                  simCShape === item.id
                    ? 'bg-cyan-600/30 text-cyan-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">محیط/استاپ:</span>
            {(
              [
                { id: 'AUTO', label: 'خودکار' },
                { id: 'LOW_ANALYST', label: 'تحلیلگر کم' },
                { id: 'IRAN_1401', label: 'ایران ۱۴۰۱' },
                { id: 'HIGH_STOPS', label: 'استاپ زیاد' }
              ] as const
            ).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSimEnv(item.id)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                  simEnv === item.id
                    ? 'bg-amber-600/30 text-amber-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-300">
        <span>
          ساختار: <strong className="font-mono tabular-nums text-white">{report.structureSignature}</strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          B/A:{' '}
          <strong className={`font-mono tabular-nums ${report.bOver618Valid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {report.bPctOfA}٪
          </strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          C/B: <strong className="font-mono tabular-nums text-cyan-300">{report.cPctOfB}٪</strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          قانون ۶۱.۸٪:{' '}
          <strong className={report.bOver618Valid ? 'text-emerald-400' : 'text-rose-400'}>
            {report.bOver618Valid ? (report.isBorderlineB618 ? 'مرزی محقق' : 'محقق') : 'نقض (زیگزاگ سیمپل)'}
          </strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          اطمینان:{' '}
          <strong className={`font-mono tabular-nums ${credibilityStyle}`}>
            {Math.round(report.confidence * 100)}٪ ({credibilityLabelFa})
          </strong>
        </span>
      </div>

      {/* Technical Decomposition & Wave C Geometry */}
      <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[10px] text-slate-300">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-slate-200 font-semibold">
            <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>ابهام‌زدایی: {disambiguationLabelFa}</span>
          </span>
          <span className="text-slate-400">
            {report.idealPlusAntiCycleConfirmed
              ? 'ترکیب A-B ایده‌آل (۳-۳) + C آنتی‌سیکل (۵) تایید شد'
              : 'فاقد تایید کامل ترکیب فلت ۳-۳-۵'}
          </span>
        </div>

        <p className="text-slate-400 leading-relaxed flex items-center gap-1.5">
          <Compass className="w-3 h-3 text-indigo-400 shrink-0" />
          <span>
            {report.cSubStructureLabelFa}
            {report.knotUntanglerRecommended || report.isWave4KnotUntangler
              ? ' · پیشنهاد گره‌گشایی زیرموج‌ها در گذشته بازار'
              : ''}
          </span>
        </p>

        <p className="text-slate-400 leading-relaxed">{report.vsSimpleZigzagFa}</p>
      </div>

      {/* Market Evolution & Actor Psychology Notes */}
      {(report.evolutionDominantPatternFa || report.actorPsychologyNoteFa) && (
        <div className="pt-1.5 border-t border-slate-800/80 space-y-0.5 text-[10px] text-slate-300">
          {report.evolutionDominantPatternFa && (
            <p className="text-cyan-300 leading-relaxed">{report.evolutionDominantPatternFa}</p>
          )}
          {report.actorPsychologyNoteFa && (
            <p className="text-amber-300 leading-relaxed">{report.actorPsychologyNoteFa}</p>
          )}
        </div>
      )}

      {/* Warnings & Borderline Notes */}
      {(report.warnings.length > 0 || (report.borderlineNotesFa && report.borderlineNotesFa.length > 0)) && (
        <div className="pt-1.5 border-t border-slate-800/80 space-y-0.5 text-[10px]">
          {report.borderlineNotesFa?.map((note, idx) => (
            <p key={`bn-${idx}`} className="text-slate-300 leading-relaxed">
              • {note}
            </p>
          ))}
          {report.warnings.map((w, idx) => (
            <p key={`warn-${idx}`} className="text-amber-300 leading-relaxed">
              • {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
