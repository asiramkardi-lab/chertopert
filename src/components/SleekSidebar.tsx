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
import { RulesEngine, ValidationSummary, isExcludedFlat, isInvalidTriangle } from '../engine/rulesEngine';
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
import { TrianglePatternInspector } from './TrianglePatternInspector';
import { 
  Cpu, 
  GitBranch, 
  FolderGit2, 
  Compass, 
  FileCode2, 
  ShieldCheck,
  CornerDownLeft,
  Layers,
  Triangle,
  Crosshair,
  ArrowUpLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2
} from 'lucide-react';

const FLAT_MARKET_PHASE_TOOLTIP =
  "Flat patterns are primarily intended for historical knot-untying and should not be used in the current market's end-phase.";

export type SidebarTab = 'COPILOT' | 'FLAT_ANALYSIS' | 'TRIANGLE_ANALYSIS' | 'ANGLE_TARGETS' | 'FRACTAL_TREE' | 'SCENARIOS' | 'TF_BOUNDARY' | 'SDD_CODE';

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
  const [showInlineTriangleToggle, setShowInlineTriangleToggle] = useState<boolean>(false);

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

  const liveTriangleValidation = useMemo(
    () =>
      RulesEngine.TrianglePatternValidator(
        activeScenario,
        candles,
        undefined,
        drillContext?.role || 'ROOT',
        drillContext?.waveLabel || activeScenario.parentLegLabel || ''
      ),
    [
      activeScenario,
      drillContext?.role,
      drillContext?.waveLabel,
      candles
    ]
  );

  const activeInvalidTriangle = useMemo(
    () =>
      isInvalidTriangle(activeScenario, candles, {
        parentRole: drillContext?.role,
        parentWaveLabel: drillContext?.waveLabel || activeScenario.parentLegLabel
      }),
    [activeScenario, candles, drillContext?.role, drillContext?.waveLabel]
  );

  useEffect(() => {
    if (drillContext?.key) {
      setActiveTab('SCENARIOS');
    }
  }, [drillContext?.key]);

  const is335Identified = Boolean(liveFlatFlag?.isStructure335) || activeScenario.patternType.startsWith('FLAT_');
  const isTriangleIdentified = Boolean(liveTriangleValidation.isTriangleScenario);

  useEffect(() => {
    setShowInlineFlatToggle(is335Identified);
  }, [is335Identified, activeScenario.id]);

  useEffect(() => {
    setShowInlineTriangleToggle(isTriangleIdentified);
  }, [isTriangleIdentified, activeScenario.id]);

  const scenarioPhaseWarningsById = useMemo(() => {
    const map: Record<string, boolean> = {};
    scenarios.forEach(sc => {
      const flaggedByValidator = RulesEngine.MarketTerminalValidator(sc, candles).isFlatAtMarketEnd;
      map[sc.id] = Boolean(
        sc.marketPhaseWarning ||
          sc.metadata?.marketPhaseWarning ||
          sc.marketTerminalWarning?.isFlatAtMarketEnd ||
          flaggedByValidator
      );
    });
    return map;
  }, [scenarios, candles]);

  const anyMarketPhaseWarning = useMemo(
    () => Object.values(scenarioPhaseWarningsById).some(Boolean),
    [scenarioPhaseWarningsById]
  );

  const anyInvalidTriangle = useMemo(
    () =>
      scenarios.some(sc =>
        isInvalidTriangle(sc, candles, {
          parentRole: drillContext?.role,
          parentWaveLabel: drillContext?.waveLabel || sc.parentLegLabel
        })
      ),
    [scenarios, candles, drillContext?.role, drillContext?.waveLabel]
  );

  const tabs = [
    { id: 'COPILOT' as SidebarTab, label: 'دستیار هوشمند و قوانین', icon: Cpu, badge: `${activeScenario.validityScore}%` },
    {
      id: 'FLAT_ANALYSIS' as SidebarTab,
      label: 'بازرس فلت ۳-۳-۵',
      icon: Layers,
      badge: liveFlatFlag ? `${liveFlatFlag.bRetracePct}%` : '۳-۳-۵'
    },
    {
      id: 'TRIANGLE_ANALYSIS' as SidebarTab,
      label: 'بازرس مثلث A-B-C-D-E',
      icon: Triangle,
      badge: liveTriangleValidation.report.frequencyPct || 'A-E',
      hasWarning: activeInvalidTriangle
    },
    { id: 'ANGLE_TARGETS' as SidebarTab, label: 'زوایا و اهداف', icon: Crosshair, badge: `${activeScenario.confidenceScore}%` },
    { id: 'FRACTAL_TREE' as SidebarTab, label: 'درخت فرکتالی', icon: GitBranch, badge: '۴ درجه' },
    {
      id: 'SCENARIOS' as SidebarTab,
      label: 'سناریوهای موازی',
      icon: FolderGit2,
      badge: `${scenarios.length}`,
      hasWarning: anyMarketPhaseWarning || anyInvalidTriangle
    },
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
          const isTriangleTabAlert = tab.id === 'TRIANGLE_ANALYSIS' && isTriangleIdentified && !isActive;
          return (
            <button
              key={tab.id}
              data-testid={
                tab.id === 'FLAT_ANALYSIS'
                  ? 'flat-pattern-inspector-tab'
                  : tab.id === 'TRIANGLE_ANALYSIS'
                  ? 'triangle-pattern-inspector-tab'
                  : undefined
              }
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'SCENARIOS') onHoverScenario?.(null);
              }}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  : isFlatTabAlert
                  ? 'bg-amber-950/40 border border-amber-500/45 text-amber-200 hover:bg-amber-950/60'
                  : isTriangleTabAlert
                  ? 'bg-emerald-950/40 border border-emerald-500/45 text-emerald-200 hover:bg-emerald-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : isFlatTabAlert ? 'text-amber-300' : isTriangleTabAlert ? 'text-emerald-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {'hasWarning' in tab && tab.hasWarning && (
                <span
                  data-testid={
                    tab.id === 'TRIANGLE_ANALYSIS'
                      ? 'sidebar-triangle-tab-warning'
                      : 'sidebar-scenarios-tab-warning'
                  }
                  title={
                    tab.id === 'TRIANGLE_ANALYSIS'
                      ? liveTriangleValidation.invalidTriangleReasonFa ||
                        'هشدار مثلث نامعتبر (موج ۱/۳/۵ یا ساختار غیر ۳-۳-۳-۳-۳)'
                      : anyInvalidTriangle && !anyMarketPhaseWarning
                      ? 'سناریوی مثلث نامعتبر در لیست وجود دارد (موج ۱، ۳ یا ۵ یا نقض ساختار ۳-۳-۳-۳-۳)'
                      : anyInvalidTriangle && anyMarketPhaseWarning
                      ? `${FLAT_MARKET_PHASE_TOOLTIP} | هشدار مثلث نامعتبر در لیست`
                      : FLAT_MARKET_PHASE_TOOLTIP
                  }
                  className="inline-flex items-center text-rose-300"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                </span>
              )}
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

        {/* Session 14 isInvalidTriangle Notification Banner */}
        {activeInvalidTriangle && (
          <div
            data-testid="sidebar-invalid-triangle-alert"
            role="alert"
            className="rounded-xl bg-rose-950/35 border border-rose-500/50 px-3.5 py-2.5 flex items-start justify-between gap-2.5 text-xs"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <div className="font-bold text-rose-200">
                  هشدار مثلث نامعتبر (isInvalidTriangle)
                </div>
                <p className="text-[11px] text-rose-100/90 leading-relaxed">
                  {liveTriangleValidation.invalidTriangleReasonFa ||
                    'مثلث در امواج اصلی (۱، ۳ یا ۵) مجاز نیست یا ساختار درونی آن ۳-۳-۳-۳-۳ نیست؛ حذف یا اصلاح این سناریو توصیه می‌شود.'}
                </p>
              </div>
            </div>
            {scenarios.length > 1 && (
              <button
                type="button"
                data-testid="sidebar-alert-remove-invalid-triangle"
                onClick={() => onDeleteScenario(activeScenario.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 border border-rose-500/50 text-rose-100 text-[10.5px] font-bold shrink-0 whitespace-nowrap transition-colors"
              >
                <Trash2 className="w-3 h-3 shrink-0" />
                <span>حذف سناریو</span>
              </button>
            )}
          </div>
        )}

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

            {/* Studio Sidebar Flat Pattern Inspector (Activates ONLY when a 3-3-5 scenario is selected) */}
            {is335Identified && (
              <div className="rounded-xl bg-[#0b1324] border border-amber-500/40 overflow-hidden">
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInlineFlatToggle(prev => !prev)}
                    aria-expanded={showInlineFlatToggle}
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
                          : 'ساختار ۳-۳-۵ فعال'}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowInlineFlatToggle(prev => !prev)}
                      className="px-2.5 py-1 rounded-lg border text-[10.5px] font-bold transition-colors whitespace-nowrap shrink-0 bg-amber-600/30 border-amber-500/60 text-amber-100"
                    >
                      {showInlineFlatToggle ? 'بستن' : 'نمایش'}
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
            )}

            {/* Studio Sidebar Triangle Pattern Inspector (Activates when a Triangle A-B-C-D-E scenario is selected) */}
            {isTriangleIdentified && (
              <div
                className={`rounded-xl bg-[#0b1324] overflow-hidden border ${
                  activeInvalidTriangle ? 'border-rose-500/50' : 'border-emerald-500/40'
                }`}
              >
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInlineTriangleToggle(prev => !prev)}
                    aria-expanded={showInlineTriangleToggle}
                    className="flex items-center gap-2 min-w-0 text-right flex-1"
                  >
                    <Triangle
                      className={`w-4 h-4 shrink-0 ${
                        activeInvalidTriangle ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-1.5 flex-wrap">
                        <span>بازرس الگوی مثلث (A-B-C-D-E)</span>
                        {activeInvalidTriangle ? (
                          <span
                            data-testid="sidebar-copilot-invalid-triangle-badge"
                            title={
                              liveTriangleValidation.invalidTriangleReasonFa ||
                              'Invalid Triangle: Triangle pattern placed in wave 1, 3, or 5 or violates 3-3-3-3-3 internal structure.'
                            }
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/50 text-rose-300 text-[9.5px] font-bold shrink-0 whitespace-nowrap"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>مثلث نامعتبر</span>
                          </span>
                        ) : liveTriangleValidation.isValidTriangle ? (
                          <span
                            title={
                              liveTriangleValidation.isContracting
                                ? 'Contracting Triangle (خطوط روند همگرا — ۳-۳-۳-۳-۳)'
                                : 'Expanding Triangle (خطوط روند واگرا — ۳-۳-۳-۳-۳)'
                            }
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/55 border border-emerald-500/45 text-emerald-300 text-[9.5px] font-bold shrink-0 whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{liveTriangleValidation.isContracting ? 'مثلث مانع' : 'مثلث گستشی'}</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10.5px] text-slate-400 truncate font-mono tabular-nums">
                        {liveTriangleValidation.isContracting
                          ? 'مانع (همگرا)'
                          : liveTriangleValidation.isExpanding
                          ? 'گستشی (واگرا)'
                          : 'نامعتبر'}{' '}
                        · {liveTriangleValidation.report.subwaveSignature || '3-3-3-3-3'} ·{' '}
                        {liveTriangleValidation.report.positionSlotLabelFa}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowInlineTriangleToggle(prev => !prev)}
                      className="px-2.5 py-1 rounded-lg border text-[10.5px] font-bold transition-colors whitespace-nowrap shrink-0 bg-emerald-600/30 border-emerald-500/60 text-emerald-100"
                    >
                      {showInlineTriangleToggle ? 'بستن' : 'نمایش'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('TRIANGLE_ANALYSIS')}
                      className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300"
                      title="باز کردن تب کامل بازرس الگوی مثلث A-B-C-D-E"
                    >
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {showInlineTriangleToggle && (
                  <div className="p-2.5 pt-0 border-t border-slate-800/80">
                    <TrianglePatternInspector
                      scenario={activeScenario}
                      candles={candles}
                      parentRole={drillContext?.role || 'ROOT'}
                      parentWaveLabel={drillContext?.waveLabel || ''}
                      onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
                    />
                  </div>
                )}
              </div>
            )}

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
            {is335Identified ? (
              <FlatPatternInspector
                scenario={activeScenario}
                candles={candles}
                parentRole={drillContext?.role || 'ROOT'}
                parentWaveLabel={drillContext?.waveLabel || ''}
                onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
              />
            ) : (
              <div
                data-testid="flat-inspector-inactive-notice"
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2 leading-relaxed"
              >
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>بازرس الگوی فلت (۳-۳-۵) در انتظار انتخاب سناریوی ۳-۳-۵</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  این ابزار تنها زمانی فعال می‌شود که یک سناریوی دارای ساختار ۳-۳-۵ (یا الگوی فلت) انتخاب شده باشد.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'TRIANGLE_ANALYSIS' && (
          <div className="space-y-4">
            {!isTriangleIdentified && (
              <div
                data-testid="triangle-inspector-inactive-notice"
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2 flex-wrap"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-emerald-300">سناریوی فعلی مثلث نیست (شبیه‌سازی جلسه ۱۴ فعال است)</div>
                  <p className="text-[10.5px] text-slate-400">
                    می‌توانید قوانین جلسه ۱۴ (موقعیت ۴/B/۲، ساختار ۳-۳-۳-۳-۳، برخورد خطوط و مثال ذوب) را در شبیه‌ساز زیر آزمون کنید.
                  </p>
                </div>
                {!activeScenario.isLocked && (
                  <button
                    type="button"
                    onClick={() => onPatternChange('TRIANGLE_CONVERGING', activeScenario.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/45 text-emerald-100 text-[10.5px] font-bold whitespace-nowrap shrink-0"
                  >
                    تبدیل به مثلث مانع
                  </button>
                )}
              </div>
            )}
            <TrianglePatternInspector
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

            {/* Quick SleekSidebar Scenario List with End-Phase Flat Warning Badges */}
            {scenarios.length > 0 && (
              <div
                data-testid="sleek-sidebar-scenario-list"
                className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 px-1">
                  <span>لیست سریع سناریوها</span>
                  <span className="font-mono tabular-nums">{scenarios.length}</span>
                </div>
                <div className="space-y-1">
                  {scenarios.map(sc => {
                    const isSelected = sc.id === activeScenarioId;
                    const hasPhaseWarn = scenarioPhaseWarningsById[sc.id];
                    const runningExcluded = isExcludedFlat(sc, candles);
                    const invalidTriangle = isInvalidTriangle(sc, candles, {
                      parentRole: drillContext?.role,
                      parentWaveLabel: drillContext?.waveLabel || sc.parentLegLabel
                    });
                    const triCheck =
                      sc.patternType === 'TRIANGLE_CONVERGING' ||
                      sc.patternType === 'TRIANGLE_EXPANDING' ||
                      invalidTriangle
                        ? RulesEngine.TrianglePatternValidator(
                            sc,
                            candles,
                            undefined,
                            drillContext?.role || 'ROOT',
                            drillContext?.waveLabel || sc.parentLegLabel || ''
                          )
                        : null;
                    const flaggedForRemoval = runningExcluded || invalidTriangle;
                    return (
                      <div
                        key={sc.id}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
                          isSelected
                            ? 'bg-indigo-950/45 border-indigo-500/60 text-white'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectScenario(sc.id)}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-right"
                        >
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: sc.color || '#38bdf8' }}
                          />
                          <span className="truncate font-semibold">{sc.name}</span>
                          {hasPhaseWarn && (
                            <span
                              data-testid="sidebar-scenario-market-phase-warning"
                              title={FLAT_MARKET_PHASE_TOOLTIP}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-200 text-[9.5px] font-bold shrink-0"
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>فلت انتهای بازار</span>
                            </span>
                          )}
                          {runningExcluded && (
                            <span
                              title="Running Flat excluded per Session 13 — flagged for removal"
                              className="px-1.5 py-0.5 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[9px] font-bold shrink-0 whitespace-nowrap"
                            >
                              حذف جاری
                            </span>
                          )}
                          {triCheck && !invalidTriangle && triCheck.triangleLabel !== 'Invalid' && (
                            <span
                              data-testid="sidebar-triangle-type-badge"
                              title={
                                triCheck.isContracting
                                  ? 'Contracting Triangle (خطوط روند همگرا — ۳-۳-۳-۳-۳)'
                                  : 'Expanding Triangle (خطوط روند واگرا — ۳-۳-۳-۳-۳)'
                              }
                              className={`px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 whitespace-nowrap ${
                                triCheck.isContracting
                                  ? 'bg-emerald-950/45 border-emerald-500/40 text-emerald-300'
                                  : 'bg-amber-950/45 border-amber-500/40 text-amber-300'
                              }`}
                            >
                              {triCheck.isContracting ? 'مثلث مانع' : 'مثلث گستشی'}
                            </span>
                          )}
                          {invalidTriangle && (
                            <span
                              data-testid="sidebar-invalid-triangle-badge"
                              title={
                                triCheck?.invalidTriangleReasonFa ||
                                'Invalid Triangle: Triangle pattern placed in wave 1, 3, or 5 or violates 3-3-3-3-3 internal structure.'
                              }
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[9px] font-bold shrink-0 whitespace-nowrap"
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>مثلث نامعتبر</span>
                            </span>
                          )}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {flaggedForRemoval && scenarios.length > 1 && (
                            <button
                              type="button"
                              data-testid={
                                runningExcluded
                                  ? 'sidebar-remove-running-flat'
                                  : 'sidebar-remove-invalid-triangle'
                              }
                              onClick={() => onDeleteScenario(sc.id)}
                              title={
                                runningExcluded
                                  ? 'Remove excluded Running Flat scenario to keep tree clean'
                                  : 'Remove invalid Triangle scenario (wave 1/3/5 or non-3-3-3-3-3) to keep tree clean'
                              }
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/45 text-rose-200 text-[9.5px] font-bold transition-colors whitespace-nowrap"
                            >
                              <Trash2 className="w-3 h-3 shrink-0" />
                              <span>حذف</span>
                            </button>
                          )}
                          <span className="font-mono tabular-nums text-[10px] text-slate-400 shrink-0">
                            {sc.validityScore}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
