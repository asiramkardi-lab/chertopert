/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Timeframe Boundary & Qualification Report (Lowest & Highest Valid TF)
 */

import React from 'react';
import { TimeframeBoundaryReport } from '../types/elliott';
import { Compass, CheckCircle2, AlertOctagon, HelpCircle, Activity } from 'lucide-react';

interface TfBoundaryReportProps {
  report: TimeframeBoundaryReport;
  activeTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
}

export const TfBoundaryReport: React.FC<TfBoundaryReportProps> = ({
  report,
  activeTimeframe,
  onSelectTimeframe
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">تشخیص خودکار محدوده تایم‌فریم معتبر</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">بالاترین معتبر:</span>
          <span className="font-bold text-emerald-400 font-mono">{report.highestValidTF}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">پایین‌ترین معتبر:</span>
          <span className="font-bold text-cyan-400 font-mono">{report.lowestValidTF}</span>
        </div>
      </div>

      {/* Grid of evaluations */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(report.evaluations).map(([tf, ev]) => {
          const isSelected = activeTimeframe === tf;
          return (
            <div
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 cursor-pointer transition-all ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/40'
                  : ev.isEligibleForCounting
                  ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                  : 'bg-red-950/10 border-red-900/30 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-white">{tf}</span>
                {ev.isEligibleForCounting ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                )}
              </div>

              <div className="flex flex-col gap-0.5 text-[10px]">
                <div className="flex justify-between text-slate-400">
                  <span>کفایت دیتا:</span>
                  <span className="font-mono text-slate-200">{ev.dataSufficiency}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>نویز:</span>
                  <span className={`font-mono ${ev.noiseLevel === 'LOW' ? 'text-emerald-400' : ev.noiseLevel === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'}`}>
                    {ev.noiseLevel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
