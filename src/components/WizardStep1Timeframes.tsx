/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Wizard Step 1: Timeframe Boundaries (Highest & Lowest Valid TF) + Absolute Bottom Inspection & Refinement
 */

import React from 'react';
import {
  TimeframeBoundaryReport,
  WaveVertex,
  Candle
} from '../types/elliott';
import { TIMEFRAME_LABELS_FA, getLowerTimeframe } from '../data/sampleMarketData';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import {
  Compass,
  Anchor,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Layers,
  Crosshair,
  ShieldAlert
} from 'lucide-react';

interface WizardStep1TimeframesProps {
  assetMarketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  maxAllowedDegree: number;
  boundaryReport: TimeframeBoundaryReport;
  confirmedHighestTF: string;
  confirmedLowestTF: string;
  previewTF: string;
  onChangeHighestTF: (tf: string) => void;
  onChangeLowestTF: (tf: string) => void;
  onSelectPreviewTF: (tf: string) => void;
  absoluteBottom: WaveVertex;
  highestTfCandles: Candle[];
  lowerTfCorrespondingCount: number;
  isPickingBottom: boolean;
  onTogglePickBottom: () => void;
  onResetAutoBottom: () => void;
  onInspectLowerTfWindow: () => void;
  isInspectingLowerWindow: boolean;
  onProceedToStep2: () => void;
}

const TF_ORDER = ['1M', '1W', '1D', '4H', '1H', '15M'];

export const WizardStep1Timeframes: React.FC<WizardStep1TimeframesProps> = ({
  assetMarketType,
  maxAllowedDegree,
  boundaryReport,
  confirmedHighestTF,
  confirmedLowestTF,
  previewTF,
  onChangeHighestTF,
  onChangeLowestTF,
  onSelectPreviewTF,
  absoluteBottom,
  highestTfCandles,
  lowerTfCorrespondingCount,
  isPickingBottom,
  onTogglePickBottom,
  onResetAutoBottom,
  onInspectLowerTfWindow,
  isInspectingLowerWindow,
  onProceedToStep2
}) => {
  const remainingCandlesAfterBottom = Math.max(0, highestTfCandles.length - 1 - absoluteBottom.candleIndex);
  const hasMinCandlesFromBottom = remainingCandlesAfterBottom >= 8;

  // Check if any candle after absoluteBottom has a strictly lower low (violating Absolute Bottom C14)
  const brokenLowerLow = highestTfCandles
    .slice(absoluteBottom.candleIndex + 1)
    .some(c => c.low < absoluteBottom.price * 0.998);

  const lowerTF = getLowerTimeframe(confirmedHighestTF);
  const highestIdx = TF_ORDER.indexOf(confirmedHighestTF);
  const lowestIdx = TF_ORDER.indexOf(confirmedLowestTF);
  const tfRangeInvalid = highestIdx > lowestIdx;

  const canProceed = !tfRangeInvalid && hasMinCandlesFromBottom;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Step Title & Principle */}
        <div className="space-y-1.5 pb-3 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>مرحله ۱: مرز تایم‌فریم و کف مطلق</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">C02 · C14 · C15</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            سیستم به‌صورت خودکار بالاترین و پایین‌ترین تایم‌فریم قابل شمارش را بر اساس تعداد کندل، پیوت‌ها، نوسان (ATR) و محدودیت درجه بازار ارزیابی کرده است. شما می‌توانید محدوده و نقطه شروع (کف مطلق) را مستقیماً اصلاح کنید.
          </p>
        </div>

        {/* Market Degree Cap Notice */}
        {assetMarketType === 'TSE_IRAN' && (
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-300 mb-0.5">قاعده بورس تهران (حداکثر {maxAllowedDegree} درجه):</strong>
              طبق مستند بهاری، در بورس ایران تنها ۴ درجه موج‌شماری معتبر است (V، W، بولد، ساده) و تایم‌فریم‌های زیر ۴ ساعته به‌دلیل نویز و محدودیت نقدشوندگی از محدوده معتبر خارج می‌شوند.
            </div>
          </div>
        )}

        {/* Recommended Range Summary & User Override Controls */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">محدوده انتخابی شما</span>
            <span className="text-[11px] text-cyan-400 font-mono tabular-nums">
              پیشنهاد سیستم: {boundaryReport.highestValidTF} تا {boundaryReport.lowestValidTF}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 block">بالاترین تایم‌فریم (شروع کلان)</label>
              <select
                value={confirmedHighestTF}
                onChange={e => onChangeHighestTF(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                {TF_ORDER.filter(tf => boundaryReport.evaluations[tf]).map(tf => (
                  <option key={tf} value={tf}>
                    {TIMEFRAME_LABELS_FA[tf] || tf}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 block">پایین‌ترین تایم‌فریم (حد فرکتال)</label>
              <select
                value={confirmedLowestTF}
                onChange={e => onChangeLowestTF(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                {TF_ORDER.filter(tf => boundaryReport.evaluations[tf]).map(tf => (
                  <option key={tf} value={tf}>
                    {TIMEFRAME_LABELS_FA[tf] || tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tfRangeInvalid && (
            <div className="text-xs text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>بالاترین تایم‌فریم باید بزرگ‌تر یا مساوی پایین‌ترین تایم‌فریم باشد.</span>
            </div>
          )}
        </div>

        {/* Timeframe Evidence Table / Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">ارزیابی و مدارک هر تایم‌فریم</span>
            <span className="text-[11px] text-slate-500">برای پیش‌نمایش روی نمودار کلیک کنید</span>
          </div>

          <div className="space-y-1.5">
            {TF_ORDER.map(tf => {
              const ev = boundaryReport.evaluations[tf];
              if (!ev) return null;
              const isSelectedPreview = previewTF === tf && !isInspectingLowerWindow;
              const isHighest = confirmedHighestTF === tf;
              const isLowest = confirmedLowestTF === tf;
              const degInfo = DEGREE_CONFIGS[ev.highestDegreePossible];

              return (
                <button
                  key={tf}
                  onClick={() => onSelectPreviewTF(tf)}
                  className={`w-full text-right p-2.5 rounded-lg border transition-colors ${
                    isSelectedPreview
                      ? 'bg-slate-800/80 border-cyan-500/50'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-white w-8">{tf}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] text-slate-300 font-mono tabular-nums">
                        {ev.candleCount} کندل
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {ev.pivotCount} پیوت
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                        ATR {ev.atrPercent}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-medium">
                      {isHighest && <span className="text-cyan-400">بالاترین</span>}
                      {isLowest && <span className="text-indigo-400">پایین‌ترین</span>}
                      {ev.isEligibleForCounting ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {ev.reasonFa} <span className="text-slate-500">({degInfo.nameFa})</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Absolute Bottom Refinement & Lower-TF Correspondence Inspection */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-amber-400" />
              <span>اصلاح کف مطلق (نقطه شروع شمارش)</span>
            </h3>
            <span className="text-[11px] font-mono text-amber-300 tabular-nums">
              {absoluteBottom.price.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/80 border border-slate-800/80 rounded-lg p-2">
            <div>
              <span className="text-[10px] text-slate-500 block">شاخص کندل</span>
              <span className="text-xs font-mono font-bold text-white tabular-nums">
                #{absoluteBottom.candleIndex + 1}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">کندل‌های پیش‌رو</span>
              <span
                className={`text-xs font-mono font-bold tabular-nums ${
                  hasMinCandlesFromBottom ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {remainingCandlesAfterBottom} کندل
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">متناظر در {lowerTF || 'پایین'}</span>
              <span className="text-xs font-mono font-bold text-cyan-400 tabular-nums">
                {lowerTfCorrespondingCount} کندل
              </span>
            </div>
          </div>

          {!hasMinCandlesFromBottom && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>تعداد کندل پس از کف مطلق کمتر از حد مجاز (۸ کندل) است؛ نقطه شروع را به چپ منتقل کنید.</span>
            </div>
          )}

          {brokenLowerLow && (
            <div className="text-[11px] text-amber-300 flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>هشدار (C14): پس از این نقطه کف پایین‌تری ثبت شده است؛ مگر آنکه موج ۲ نامنظم یا آنتی‌سیکل مدنظر باشد.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onTogglePickBottom}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                isPickingBottom
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-amber-500/60'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isPickingBottom ? 'در حال انتخاب روی نمودار...' : 'اصلاح کف مطلق روی نمودار'}</span>
            </button>

            <button
              onClick={onResetAutoBottom}
              className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg text-xs bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
              title="بازگردانی به کف مطلق خودکار"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {lowerTF && (
            <button
              onClick={onInspectLowerTfWindow}
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                isInspectingLowerWindow
                  ? 'bg-cyan-600/25 border-cyan-500 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-cyan-500/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {isInspectingLowerWindow
                  ? `بازگشت به نمای تایم بالاتر (${confirmedHighestTF})`
                  : `مشاهده کندل‌های دقیق این بازه در تایم ${lowerTF}`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Primary Action */}
      <div className="p-4 border-t border-slate-800 bg-[#0b1120] shrink-0">
        <button
          onClick={onProceedToStep2}
          disabled={!canProceed}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <span>تأیید تایم‌فریم و کف مطلق — کشف سناریوهای کلان</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
