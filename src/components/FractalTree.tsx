/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Interactive Fractal Tree Component
 * Displays multi-degree hierarchy (Super Cycle, Cycle, Primary, Intermediate)
 * with downward subwave expansion and scenario branching.
 */

import React, { useState } from 'react';
import { WaveDegree, WaveScenario } from '../types/elliott';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import { 
  GitBranch, 
  ChevronRight, 
  ChevronDown, 
  Layers, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  PlusCircle,
  ExternalLink
} from 'lucide-react';

interface FractalTreeProps {
  currentDegree: WaveDegree;
  onSelectDegree: (degree: WaveDegree) => void;
  activeScenario: WaveScenario;
  onBranchScenario: (branchName: string, degree: WaveDegree) => void;
}

export const FractalTree: React.FC<FractalTreeProps> = ({
  currentDegree,
  onSelectDegree,
  activeScenario,
  onBranchScenario
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'node_v': true,
    'node_w': true,
    'node_primary': true
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">درخت فرکتالی امواج (Multi-Degree Tree)</h3>
        </div>
        <span className="text-xs text-slate-400">۴ درجه ساختاری معتبر</span>
      </div>

      {/* Tree Visualization */}
      <div className="flex flex-col gap-2 font-mono text-xs">
        {/* Level 1: Super Cycle V */}
        <div className="flex flex-col gap-1.5">
          <div 
            onClick={() => toggleNode('node_v')}
            className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
              currentDegree === 'SUPER_CYCLE' 
                ? 'bg-purple-950/30 border-purple-500/50 text-purple-200' 
                : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {expandedNodes['node_v'] ? <ChevronDown className="w-4 h-4 text-purple-400" /> : <ChevronRight className="w-4 h-4 text-purple-400" />}
              <span className="font-bold text-purple-400">V (Super Cycle)</span>
              <span className="text-slate-400 text-[11px] font-sans">موج کلان ۵ تایی ماهانه</span>
            </div>
            <div className="flex items-center gap-2 font-sans">
              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300">درجه ۱</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDegree('SUPER_CYCLE');
                }}
                className="text-[10px] text-purple-400 hover:underline"
              >
                مشاهده چارت
              </button>
            </div>
          </div>

          {/* Level 2: Cycle W (Subwave of V) */}
          {expandedNodes['node_v'] && (
            <div className="mr-5 pr-3 border-r-2 border-purple-500/30 flex flex-col gap-1.5 mt-1">
              <div 
                onClick={() => toggleNode('node_w')}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  currentDegree === 'CYCLE' 
                    ? 'bg-blue-950/30 border-blue-500/50 text-blue-200' 
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  {expandedNodes['node_w'] ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-blue-400" />}
                  <span className="font-bold text-blue-400">W (Cycle)</span>
                  <span className="text-slate-400 text-[11px] font-sans">سیکل کامل W1..W5 هفتگی</span>
                </div>
                <div className="flex items-center gap-2 font-sans">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300">درجه ۲</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDegree('CYCLE');
                    }}
                    className="text-[10px] text-blue-400 hover:underline"
                  >
                    مشاهده چارت
                  </button>
                </div>
              </div>

              {/* Level 3: Primary (Subwave of W3) */}
              {expandedNodes['node_w'] && (
                <div className="mr-5 pr-3 border-r-2 border-blue-500/30 flex flex-col gap-1.5 mt-1">
                  <div 
                    onClick={() => toggleNode('node_primary')}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      currentDegree === 'PRIMARY' 
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200' 
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {expandedNodes['node_primary'] ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-emerald-400" />}
                      <span className="font-bold text-emerald-400">1..5 (Primary - Bold)</span>
                      <span className="text-slate-400 text-[11px] font-sans">امواج اصلی روزانه (فعلی)</span>
                    </div>
                    <div className="flex items-center gap-2 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">درجه ۳ (فعال)</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDegree('PRIMARY');
                        }}
                        className="text-[10px] text-emerald-400 hover:underline"
                      >
                        مشاهده چارت
                      </button>
                    </div>
                  </div>

                  {/* Level 4: Intermediate Subwaves */}
                  {expandedNodes['node_primary'] && (
                    <div className="mr-5 pr-3 border-r-2 border-emerald-500/30 flex flex-col gap-1 mt-1">
                      <div 
                        className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                          currentDegree === 'INTERMEDIATE' 
                            ? 'bg-amber-950/30 border-amber-500/50 text-amber-200' 
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                        }`}
                        onClick={() => onSelectDegree('INTERMEDIATE')}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="font-bold text-amber-400">(1)..(5) Intermediate</span>
                          <span className="text-slate-400 text-[11px] font-sans">زیرموج‌های ۴ ساعته</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-sans">
                          درجه ۴ (کف بورس)
                        </span>
                      </div>

                      {/* Branch Scenario Button */}
                      <button
                        onClick={() => onBranchScenario('سناریوی جایگزین ۴ ساعته', 'INTERMEDIATE')}
                        className="mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-sans border border-indigo-500/20 transition-all"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>ایجاد انشعاب سناریو برای این گره فرکتالی</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
