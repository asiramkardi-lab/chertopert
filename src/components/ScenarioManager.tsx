/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Scenario Manager Component
 * Manages parallel counts, branching, locking, and historical replay.
 */

import React from 'react';
import { WaveScenario, PatternFamily } from '../types/elliott';
import { 
  FolderGit2, 
  Lock, 
  Unlock, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  Plus, 
  History,
  Tag
} from 'lucide-react';

interface ScenarioManagerProps {
  scenarios: WaveScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onDuplicateScenario: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onNewScenario: () => void;
}

export const ScenarioManager: React.FC<ScenarioManagerProps> = ({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onDuplicateScenario,
  onToggleLock,
  onDeleteScenario,
  onNewScenario
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">مدیریت سناریوهای موازی (Scenario Universe)</h3>
        </div>
        <button
          onClick={onNewScenario}
          className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>سناریوی جدید</span>
        </button>
      </div>

      {/* Scenario Cards */}
      <div className="flex flex-col gap-2.5">
        {scenarios.map(sc => {
          const isActive = sc.id === activeScenarioId;

          return (
            <div
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: sc.color || (isActive ? '#818cf8' : '#475569') }}
                />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{sc.name}</span>
                    {sc.isPrimary && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                        شمارش اصلی
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">({sc.patternType})</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>موج فعلی: <strong className="text-slate-200">{sc.currentWave}</strong></span>
                    <span>اطمینان: <strong className="text-cyan-400">{sc.confidenceScore}%</strong></span>
                    <span>منبع: <strong className="text-slate-300">{sc.source === 'AI' ? 'هوش مصنوعی' : 'کاربر'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onToggleLock(sc.id)}
                  title={sc.isLocked ? 'باز کردن قفل' : 'قفل کردن سناریو'}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    sc.isLocked 
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {sc.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => onDuplicateScenario(sc.id)}
                  title="ایجاد نسخه کپی (انشعاب)"
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {scenarios.length > 1 && (
                  <button
                    onClick={() => onDeleteScenario(sc.id)}
                    title="حذف سناریو"
                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
