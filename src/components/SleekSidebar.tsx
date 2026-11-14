/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Sleek Tabbed Sidebar for FEI Copilot
 * Features: AI Copilot & Rules, Fractal Tree, Scenario Universe, TF Boundary, and SDD/Code Viewer.
 */

import React, { useState, useEffect } from 'react';
import { 
  WaveScenario, 
  PatternFamily, 
  WaveDegree, 
  WaveRole,
  WaveVertex,
  TimeframeBoundaryReport 
} from '../types/elliott';
import { ValidationSummary } from '../engine/rulesEngine';
import { ChartInteractionMode } from './ChartStudio';
import { ExplainabilityPanel } from './ExplainabilityPanel';
import { FractalTree } from './FractalTree';
import { ScenarioManager } from './ScenarioManager';
import { TfBoundaryReport } from './TfBoundaryReport';
import { SddAndCodeViewer } from './SddAndCodeViewer';
import { 
  Cpu, 
  GitBranch, 
  FolderGit2, 
  Compass, 
  FileCode2, 
  ShieldCheck,
  CornerDownLeft,
  Layers
} from 'lucide-react';

export type SidebarTab = 'COPILOT' | 'FRACTAL_TREE' | 'SCENARIOS' | 'TF_BOUNDARY' | 'SDD_CODE';

interface SleekSidebarProps {
  activeScenario: WaveScenario;
  scenarios: WaveScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onDuplicateScenario: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onNewScenario: () => void;
  onPatternChange: (newPattern: PatternFamily) => void;
  currentDegree: WaveDegree;
  onSelectDegree: (degree: WaveDegree) => void;
  onBranchScenario: (branchName: string, degree: WaveDegree) => void;
  boundaryReport: TimeframeBoundaryReport;
  activeTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  onValidateScenario?: (id: string, summary: ValidationSummary) => void;
  onHoverScenario?: (id: string | null) => void;
  onUpdateVertices?: (vertices: WaveVertex[]) => void;
  interactionMode?: ChartInteractionMode;
  onChangeInteractionMode?: (mode: ChartInteractionMode) => void;
  drillContext?: {
    key: string;
    waveLabel: string;
    parentTimeframe: string;
    targetTimeframe: string;
    role: WaveRole;
    candleCount: number;
  } | null;
  onExitDrill?: () => void;
}

export const SleekSidebar: React.FC<SleekSidebarProps> = ({
  activeScenario,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onDuplicateScenario,
  onToggleLock,
  onDeleteScenario,
  onNewScenario,
  onPatternChange,
  currentDegree,
  onSelectDegree,
  onBranchScenario,
  boundaryReport,
  activeTimeframe,
  onSelectTimeframe,
  onValidateScenario,
  onHoverScenario,
  onUpdateVertices,
  interactionMode,
  onChangeInteractionMode,
  drillContext,
  onExitDrill
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('COPILOT');

  useEffect(() => {
    if (drillContext?.key) {
      setActiveTab('SCENARIOS');
    }
  }, [drillContext?.key]);

  const tabs = [
    { id: 'COPILOT' as SidebarTab, label: 'دستیار هوشمند و قوانین', icon: Cpu, badge: `${activeScenario.validityScore}%` },
    { id: 'FRACTAL_TREE' as SidebarTab, label: 'درخت فرکتالی', icon: GitBranch, badge: '۴ درجه' },
    { id: 'SCENARIOS' as SidebarTab, label: 'سناریوهای موازی', icon: FolderGit2, badge: `${scenarios.length}` },
    { id: 'TF_BOUNDARY' as SidebarTab, label: 'محدوده تایم‌فریم', icon: Compass },
    { id: 'SDD_CODE' as SidebarTab, label: 'سند SDD و کدها', icon: FileCode2 }
  ];

  return (
    <aside className="w-full lg:w-[440px] xl:w-[480px] h-full flex flex-col bg-[#0b1120] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl shrink-0">
      {/* Sleek Tab Navigation Header */}
      <div className="bg-[#0f172a]/95 border-b border-slate-800 p-2.5 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'SCENARIOS') onHoverScenario?.(null);
              }}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isActive ? 'bg-indigo-900/60 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Body Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {activeTab === 'COPILOT' && (
          <div className="space-y-4">
            {/* Real-time Status Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">موتور دستیار تحلیل زنده (FEI Engine)</h4>
                  <p className="text-[11px] text-slate-400">بررسی بی‌درنگ حرکت آخر و قوانین سه‌گانه</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                فعال
              </span>
            </div>

            {/* Explainability Component */}
            <ExplainabilityPanel
              scenario={activeScenario}
              onApplyAlternative={(newPattern) => onPatternChange(newPattern)}
              onApplyExtendedAdjustment={() => {}}
            />
          </div>
        )}

        {activeTab === 'FRACTAL_TREE' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              💡 <strong>راهنما:</strong> روی هر گره کلیک کنید تا وارد ساختار زیرموج‌های همان تایم‌فریم شوید یا یک شاخه سناریوی جدید بسازید.
            </div>

            <FractalTree
              currentDegree={activeScenario.degree}
              onSelectDegree={onSelectDegree}
              activeScenario={activeScenario}
              onBranchScenario={onBranchScenario}
            />
          </div>
        )}

        {activeTab === 'SCENARIOS' && (
          <div className="space-y-4">
            {drillContext ? (
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>حالت دریل‌دان: {drillContext.waveLabel}</span>
                  </div>
                  <span className="font-mono text-[11px] text-cyan-300">
                    {drillContext.parentTimeframe} ← {drillContext.targetTimeframe}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                  <span>
                    ساختار مورد انتظار:{' '}
                    <strong className={drillContext.role === 'MOTIVE' ? 'text-emerald-300' : 'text-amber-300'}>
                      {drillContext.role === 'MOTIVE' ? 'اصلی (۵ موجی)' : 'اصلاحی (۳ موجی)'}
                    </strong>
                    {' · '}
                    <span className="font-mono tabular-nums text-slate-400">{drillContext.candleCount} کندل متناطر</span>
                  </span>
                  {onExitDrill && (
                    <button
                      onClick={onExitDrill}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium shrink-0"
                    >
                      <CornerDownLeft className="w-3 h-3" />
                      <span>بازگشت</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <strong>جهان سناریوها:</strong> برای بررسی ساختار درونی هر موج، روی خط آن موج در نمودار کلیک کنید تا داده‌های تایم‌فریم پایین‌تر و سناریوهای آن بارگذاری شوند.
              </div>
            )}

            <ScenarioManager
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              onSelectScenario={onSelectScenario}
              onDuplicateScenario={onDuplicateScenario}
              onToggleLock={onToggleLock}
              onDeleteScenario={onDeleteScenario}
              onNewScenario={onNewScenario}
              onValidateScenario={onValidateScenario}
              onApplyPattern={onPatternChange}
              onHoverScenario={onHoverScenario}
              onUpdateVertices={onUpdateVertices}
              interactionMode={interactionMode}
              onChangeInteractionMode={onChangeInteractionMode}
            />
          </div>
        )}

        {activeTab === 'TF_BOUNDARY' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              🧭 <strong>موتور تشخیص تایم‌فریم معتبر:</strong> ارزیابی خودکار نویز، کفایت داده و تعداد کندل‌ها جهت تشخیص بالاترین و پایین‌ترین تایم‌فریم قابل موج‌شماری.
            </div>

            <TfBoundaryReport
              report={boundaryReport}
              activeTimeframe={activeTimeframe}
              onSelectTimeframe={onSelectTimeframe}
            />
          </div>
        )}

        {activeTab === 'SDD_CODE' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              📜 <strong>مستندات و سورس‌کد:</strong> مشخصات مهندسی SDD منطبق بر GitHub Spec-Kit، کدهای آماده اجرای FastAPI برای بک‌اند و Nuxt 4 برای فرانت‌اند.
            </div>

            <SddAndCodeViewer />
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="bg-[#0c1322] border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          قوانین بنیادین الیوت بهاری
        </span>
        <span className="font-mono text-slate-500">v1.0.0-PROD</span>
      </div>
    </aside>
  );
};
