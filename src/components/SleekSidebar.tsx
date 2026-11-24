/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Sleek Tabbed Sidebar for FEI Copilot
 * Features: AI Copilot & Rules, Fractal Tree, Scenario Universe, TF Boundary, and SDD/Code Viewer.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Candle,
  WaveScenario, 
  PatternFamily, 
  WaveDegree, 
  WaveRole,
  WaveVertex,
  TimeframeBoundaryReport 
} from '../types/elliott';
import { RulesEngine, ValidationSummary } from '../engine/rulesEngine';
import { ChartInteractionMode } from './ChartStudio';
import { ExplainabilityPanel } from './ExplainabilityPanel';
import { PatternValidator } from './PatternValidator';
import { FractalTree } from './FractalTree';
import { ScenarioManager } from './ScenarioManager';
import { TfBoundaryReport } from './TfBoundaryReport';
import { SddAndCodeViewer } from './SddAndCodeViewer';
import { AnglePenetrationWidget } from './AnglePenetrationWidget';
import { ConfluenceZonesWidget } from './ConfluenceZonesWidget';
import { SmartRuleAlertWidget } from './SmartRuleAlertWidget';
import { TargetProjectionPanel } from './TargetProjectionPanel';
import { TopDownPipelineAudit } from './TopDownPipelineAudit';
import { RulesEngineComplianceCard } from './RulesEngineComplianceCard';
import { FlatPatternInspector } from './FlatSidebarVisualizer';
import { 
  Cpu, 
  GitBranch, 
  FolderGit2, 
  Compass, 
  FileCode2, 
  ShieldCheck,
  CornerDownLeft,
  Layers,
  Crosshair,
  ArrowUpLeft,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export type SidebarTab = 'COPILOT' | 'FLAT_ANALYSIS' | 'ANGLE_TARGETS' | 'FRACTAL_TREE' | 'SCENARIOS' | 'TF_BOUNDARY' | 'SDD_CODE';

interface SleekSidebarProps {
  activeScenario: WaveScenario;
  scenarios: WaveScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onDuplicateScenario: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onNewScenario: () => void;
  onPatternChange: (newPattern: PatternFamily, targetScenarioId?: string) => void;
  currentDegree: WaveDegree;
  onSelectDegree: (degree: WaveDegree) => void;
  onBranchScenario: (branchName: string, degree: WaveDegree) => void;
  boundaryReport: TimeframeBoundaryReport;
  activeTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  onValidateScenario?: (id: string, summary: ValidationSummary) => void;
  onHoverScenario?: (id: string | null) => void;
  onUpdateVertices?: (vertices: WaveVertex[], targetScenarioId?: string) => void;
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
  candles?: Candle[];
  candlesByTf?: Record<string, Candle[]>;
  marketType?: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  onPromoteDegree?: (scenarioId?: string) => void;
  liveTreeContext?: {
    rootScenarios: WaveScenario[];
    activeRootScenarioId: string;
    subScenariosByKey: Record<string, WaveScenario[]>;
    activeSubIdByKey: Record<string, string>;
    drillStack: Array<{
      key: string;
      waveLabel: string;
      targetTimeframe: string;
      parentScenarioId: string;
      legIndex?: number;
      role: string;
    }>;
    onJumpToLevel?: (levelIdx: number) => void;
  };
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
  onExitDrill,
  candles = [],
  candlesByTf,
  marketType = 'CRYPTO',
  onPromoteDegree,
  liveTreeContext
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('COPILOT');
  const [targetsSubView, setTargetsSubView] = useState<'RADAR' | 'CONFLUENCE' | 'PRZ'>('RADAR');
  const [showInlineFlatToggle, setShowInlineFlatToggle] = useState<boolean>(false);

  const liveFlatFlag = useMemo(
    () =>
      RulesEngine.evaluateFlat335Rule(
        activeScenario.patternType,
        activeScenario.vertices,
        activeScenario.direction,
        candles
      ),
    [activeScenario.patternType, activeScenario.vertices, activeScenario.direction, candles]
  );

  useEffect(() => {
    if (drillContext?.key) {
      setActiveTab('SCENARIOS');
    }
  }, [drillContext?.key]);

  const is335Identified = Boolean(liveFlatFlag?.isStructure335) || activeScenario.patternType.startsWith('FLAT_');

  useEffect(() => {
    setShowInlineFlatToggle(is335Identified);
  }, [is335Identified, activeScenario.id]);

  const tabs = [
    { id: 'COPILOT' as SidebarTab, label: 'دستیار هوشمند و قوانین', icon: Cpu, badge: `${activeScenario.validityScore}%` },
    {
      id: 'FLAT_ANALYSIS' as SidebarTab,
      label: 'بازرس فلت ۳-۳-۵',
      icon: Layers,
      badge: liveFlatFlag ? `${liveFlatFlag.bRetracePct}%` : '۳-۳-۵'
    },
    { id: 'ANGLE_TARGETS' as SidebarTab, label: 'زوایا و اهداف', icon: Crosshair, badge: `${activeScenario.confidenceScore}%` },
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
          const isFlatTabAlert = tab.id === 'FLAT_ANALYSIS' && is335Identified && !isActive;
          return (
            <button
              key={tab.id}
              data-testid={tab.id === 'FLAT_ANALYSIS' ? 'flat-pattern-inspector-tab' : undefined}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'SCENARIOS') onHoverScenario?.(null);
              }}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  : isFlatTabAlert
                  ? 'bg-amber-950/40 border border-amber-500/45 text-amber-200 hover:bg-amber-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : isFlatTabAlert ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                  isActive ? 'bg-indigo-900/60 text-white' : isFlatTabAlert ? 'bg-amber-900/50 text-amber-200' : 'bg-slate-800 text-slate-400'
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
        {/* Real-Time Bahari Smart Rule & Invalidation Alert Widget */}
        <SmartRuleAlertWidget
          scenario={activeScenario}
          candles={candles}
          parentRole={drillContext?.role || 'ROOT'}
          parentWaveLabel={drillContext?.waveLabel || ''}
          onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
        />

        {activeTab === 'COPILOT' && (
          <div className="space-y-4">
            {/* Live Visual RulesEngine Radar & Progress Bar Compliance Card */}
            <RulesEngineComplianceCard
              scenario={activeScenario}
              candles={candles}
              parentRole={drillContext?.role || 'ROOT'}
              parentWaveLabel={drillContext?.waveLabel || ''}
              onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
            />

            {/* Studio Sidebar Flat Pattern Inspector (Auto-activates when 3-3-5 structure is identified) */}
            <div className="rounded-xl bg-[#0b1324] border border-slate-800 overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowInlineFlatToggle(prev => !prev)}
                  aria-expanded={showInlineFlatToggle || is335Identified}
                  className="flex items-center gap-2 min-w-0 text-right flex-1"
                >
                  <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>بازرس الگوی فلت (Flat Pattern Inspector)</span>
                      {liveFlatFlag?.isFlaggedFlat && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate font-mono tabular-nums">
                      {liveFlatFlag
                        ? `B/A: ${liveFlatFlag.bRetracePct}% · C/B: ${liveFlatFlag.cPctOfB}% · ${liveFlatFlag.subtypeLabelEn}${
                            liveFlatFlag.isRunningExcluded ? ' (حذف جاری)' : ''
                          }`
                        : 'با شناسایی ساختار ۳-۳-۵ به‌صورت خودکار فعال می‌شود'}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowInlineFlatToggle(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                      showInlineFlatToggle || is335Identified
                        ? 'bg-amber-600/30 border-amber-500/60 text-amber-100'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {showInlineFlatToggle || is335Identified ? 'فعال (بستن)' : 'باز کردن'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('FLAT_ANALYSIS')}
                    className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300"
                    title="باز کردن تب کامل بازرس الگوی فلت ۳-۳-۵"
                  >
                    <ArrowUpLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {showInlineFlatToggle && (
                <div className="p-2.5 pt-0 border-t border-slate-800/80">
                  <FlatPatternInspector
                    scenario={activeScenario}
                    candles={candles}
                    parentRole={drillContext?.role || 'ROOT'}
                    parentWaveLabel={drillContext?.waveLabel || ''}
                    onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
                  />
                </div>
              )}
            </div>

            {/* Quick Shortcuts to Angle Radar & Fibonacci Confluence Zones */}
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetsSubView('CONFLUENCE');
                  setActiveTab('ANGLE_TARGETS');
                }}
                className="w-full p-3 rounded-xl bg-emerald-950/25 hover:bg-emerald-950/40 border border-emerald-500/35 hover:border-emerald-400/65 flex items-center justify-between gap-2 text-right transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">ابزار بصری مناطق تلاقی فیبوناچی (Confluence)</div>
                    <div className="text-[10.5px] text-slate-400 truncate">
                      هم‌گرایی سطوح موج‌های مختلف با افکت نوری نقاط ورود مطمئن
                    </div>
                  </div>
                </div>
                <ArrowUpLeft className="w-4 h-4 text-emerald-300 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetsSubView('RADAR');
                  setActiveTab('ANGLE_TARGETS');
                }}
                className="w-full p-3 rounded-xl bg-cyan-950/25 hover:bg-cyan-950/40 border border-cyan-500/35 hover:border-cyan-400/65 flex items-center justify-between gap-2 text-right transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Crosshair className="w-4 h-4 text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">رادار زوایای برخورد و سطوح نفوذ</div>
                    <div className="text-[10.5px] text-slate-400 truncate">
                      مشاهده اهداف کوتاه‌مدت و میان‌مدت با درصد اطمینان
                    </div>
                  </div>
                </div>
                <ArrowUpLeft className="w-4 h-4 text-cyan-300 shrink-0" />
              </button>
            </div>

            {/* 11-Step Pipeline & Boundary Tables Audit */}
            <TopDownPipelineAudit
              candles={candles}
              candlesByTf={candlesByTf}
              scenario={activeScenario}
              scenarios={scenarios}
              marketType={marketType}
              timeframe={activeTimeframe}
              parentRole={drillContext?.role || 'ROOT'}
              parentWaveLabel={drillContext?.waveLabel || ''}
              onPromoteDegree={
                onPromoteDegree ? () => onPromoteDegree(activeScenario.id) : undefined
              }
              onSelectTimeframe={onSelectTimeframe}
              compact
            />

            {/* Strict PatternValidator Stepper */}
            <PatternValidator
              scenario={activeScenario}
              candles={candles}
              parentRole={drillContext?.role || 'ROOT'}
              parentWaveLabel={drillContext?.waveLabel || ''}
              onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
              onApplyVertices={verts => onUpdateVertices?.(verts, activeScenario.id)}
              onValidationComplete={summary => onValidateScenario?.(activeScenario.id, summary)}
              variant="panel"
            />

            {/* Explainability Component */}
            <ExplainabilityPanel
              scenario={activeScenario}
              onApplyAlternative={(newPattern) => onPatternChange(newPattern)}
              onApplyExtendedAdjustment={() => {}}
            />
          </div>
        )}

        {activeTab === 'FLAT_ANALYSIS' && (
          <div className="space-y-4">
            <FlatPatternInspector
              scenario={activeScenario}
              candles={candles}
              parentRole={drillContext?.role || 'ROOT'}
              parentWaveLabel={drillContext?.waveLabel || ''}
              onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
            />
          </div>
        )}

        {activeTab === 'ANGLE_TARGETS' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setTargetsSubView('RADAR')}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  targetsSubView === 'RADAR'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                رادار زوایا
              </button>
              <button
                type="button"
                onClick={() => setTargetsSubView('CONFLUENCE')}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  targetsSubView === 'CONFLUENCE'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                تلاقی فیبوناچی
              </button>
              <button
                type="button"
                onClick={() => setTargetsSubView('PRZ')}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  targetsSubView === 'PRZ'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                تارگت‌های PRZ
              </button>
            </div>

            {targetsSubView === 'RADAR' ? (
              <AnglePenetrationWidget
                scenario={activeScenario}
                candles={candles}
                parentRole={drillContext?.role || 'ROOT'}
                parentWaveLabel={drillContext?.waveLabel || ''}
              />
            ) : targetsSubView === 'CONFLUENCE' ? (
              <ConfluenceZonesWidget
                scenario={activeScenario}
                candles={candles}
              />
            ) : (
              <TargetProjectionPanel
                currentLevelScenarios={scenarios}
                activeScenarioId={activeScenarioId}
                candles={candles}
                parentRole={drillContext?.role || 'ROOT'}
                parentWaveLabel={drillContext?.waveLabel || ''}
                onSelectScenario={onSelectScenario}
                onHoverScenario={onHoverScenario}
                showPRZ={true}
                showTMV={true}
              />
            )}
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
              candles={candles}
              marketType={marketType}
              onPromoteDegree={onPromoteDegree}
              liveTreeContext={liveTreeContext}
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
              candles={candles}
              parentRole={drillContext?.role || 'ROOT'}
              parentWaveLabel={drillContext?.waveLabel || ''}
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
        <span className="font-mono text-slate-400">موتور قطعی الیوت</span>
      </div>
    </aside>
  );
};
