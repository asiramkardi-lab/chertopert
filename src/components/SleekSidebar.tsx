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
import { EntryStrategyPanel } from './EntryStrategyPanel';
import { BahariSession1819Panel } from './BahariSession1819Panel';
import { TopDownPipelineAudit } from './TopDownPipelineAudit';
import { RulesEngineComplianceCard } from './RulesEngineComplianceCard';
import { AnalysisConfidenceWidget } from './AnalysisConfidenceWidget';
import { FlatPatternInspector } from './FlatSidebarVisualizer';
import { TrianglePatternInspector } from './TrianglePatternInspector';
import { ComplexPatternInspector } from './ComplexPatternInspector';
import { 
  Cpu, 
  GitBranch, 
  GitMerge,
  FolderGit2, 
  Compass, 
  ShieldCheck,
  CornerDownLeft,
  Layers,
  Triangle,
  Crosshair,
  ArrowUpLeft,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download,
  Copy,
  Check,
  X
} from 'lucide-react';

const FLAT_MARKET_PHASE_TOOLTIP =
  'الگوی فلت عمدتاً برای گره‌گشایی ساختارهای گذشته بازار کاربرد دارد و نباید بدون احتیاط شدید در فاز پایانی فعلی استفاده شود.';

export type SidebarTab =
  | 'COPILOT'
  | 'PATTERN_INSPECTOR'
  | 'FLAT_ANALYSIS'
  | 'TRIANGLE_ANALYSIS'
  | 'COMPLEX_ANALYSIS'
  | 'ANGLE_TARGETS'
  | 'FRACTAL_TREE'
  | 'SCENARIOS'
  | 'TF_BOUNDARY'
  | 'SDD_CODE';

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
  onHoverLeg?: (legIndex: number | null) => void;
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
  onHoverLeg,
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
  const [inspectorKind, setInspectorKind] = useState<'FLAT' | 'TRIANGLE' | 'COMPLEX'>('FLAT');
  const [targetsSubView, setTargetsSubView] = useState<'PRZ' | 'SESSION_18_19' | 'RADAR' | 'CONFLUENCE'>('PRZ');
  const [exportFeedback, setExportFeedback] = useState<{
    json: string;
    approvedCount: number;
    excludedCount: number;
    filename: string;
    copied: boolean;
  } | null>(null);

  const handleExportScenarios = () => {
    const result = RulesEngine.exportApprovedScenariosToJson(scenarios, {
      candles,
      timeframe: activeTimeframe,
      parentRole: drillContext?.role || 'ROOT',
      parentWaveLabel: drillContext?.waveLabel || ''
    });

    const safeTf = (activeTimeframe || '1D').replace(/[^a-zA-Z0-9_-]/g, '');
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `elliott-approved-scenarios-${safeTf}-${stamp}.json`;

    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([result.json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Safe fallback in restricted/headless environments
    }

    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(result.json);
        copied = true;
      }
    } catch {
      copied = false;
    }

    setExportFeedback({
      json: result.json,
      approvedCount: result.approvedCount,
      excludedCount: result.excludedCount,
      filename,
      copied
    });
  };

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

  const liveComplexValidation = useMemo(
    () => RulesEngine.ComplexPatternValidator(activeScenario, candles),
    [activeScenario, candles]
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
  const isComplexIdentified = Boolean(liveComplexValidation.isComplexPattern);

  useEffect(() => {
    if (isTriangleIdentified) setInspectorKind('TRIANGLE');
    else if (isComplexIdentified) setInspectorKind('COMPLEX');
    else if (is335Identified) setInspectorKind('FLAT');
  }, [is335Identified, isTriangleIdentified, isComplexIdentified, activeScenario.id]);

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
    { id: 'COPILOT' as SidebarTab, label: 'دستیار و قوانین', icon: Cpu, badge: `${activeScenario.validityScore}%` },
    {
      id: 'PATTERN_INSPECTOR' as SidebarTab,
      label: 'بازرس الگو',
      icon: isTriangleIdentified ? Triangle : isComplexIdentified ? GitMerge : Layers,
      badge: isTriangleIdentified ? 'A-E' : isComplexIdentified ? 'W-X-Y' : is335Identified ? '۳-۳-۵' : undefined,
      hasWarning: activeInvalidTriangle
    },
    { id: 'ANGLE_TARGETS' as SidebarTab, label: 'تارگت و پلن', icon: Crosshair, badge: `${activeScenario.confidenceScore}%` },
    { id: 'FRACTAL_TREE' as SidebarTab, label: 'درخت فرکتالی', icon: GitBranch },
    {
      id: 'SCENARIOS' as SidebarTab,
      label: 'سناریوها',
      icon: FolderGit2,
      badge: `${scenarios.length}`,
      hasWarning: anyMarketPhaseWarning || anyInvalidTriangle
    },
    { id: 'TF_BOUNDARY' as SidebarTab, label: 'تایم‌فریم‌ها', icon: Compass }
  ];

  const isPatternInspectorTab =
    activeTab === 'PATTERN_INSPECTOR' ||
    activeTab === 'FLAT_ANALYSIS' ||
    activeTab === 'TRIANGLE_ANALYSIS' ||
    activeTab === 'COMPLEX_ANALYSIS';

  return (
    <aside className="w-full lg:w-[440px] xl:w-[480px] lg:h-full flex flex-col bg-[#0b1120] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl shrink-0">
      {/* Sleek 6-Tab Navigation Header */}
      <div className="bg-[#0f172a]/95 border-b border-slate-800 p-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive =
            tab.id === 'PATTERN_INSPECTOR' ? isPatternInspectorTab : activeTab === tab.id;
          const isPatternAlert =
            tab.id === 'PATTERN_INSPECTOR' && (is335Identified || isTriangleIdentified || isComplexIdentified) && !isActive;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'SCENARIOS') onHoverScenario?.(null);
              }}
              className={`flex items-center gap-1.5 py-2 px-2.5 rounded-xl text-[11.5px] font-semibold whitespace-nowrap shrink-0 transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isPatternAlert
                  ? 'bg-amber-950/40 border border-amber-500/40 text-amber-200 hover:bg-amber-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : isPatternAlert ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {'hasWarning' in tab && tab.hasWarning && (
                <span
                  data-testid={
                    tab.id === 'PATTERN_INSPECTOR'
                      ? 'sidebar-triangle-tab-warning'
                      : 'sidebar-scenarios-tab-warning'
                  }
                  title={
                    tab.id === 'PATTERN_INSPECTOR'
                      ? liveTriangleValidation.invalidTriangleReasonFa ||
                        'هشدار مثلث نامعتبر (قرارگیری در موج ۱/۳/۵ یا ساختار غیر ۳-۳-۳-۳-۳)'
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
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {/* Real-Time Bahari Smart Rule & Invalidation Alert Widget */}
        <SmartRuleAlertWidget
          scenario={activeScenario}
          candles={candles}
          parentRole={drillContext?.role || 'ROOT'}
          parentWaveLabel={drillContext?.waveLabel || ''}
          onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
        />

        {/* Session 14 Invalid Triangle Notification Banner */}
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
                  هشدار مثلث نامعتبر (جایگاه یا ساختار)
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

        {exportFeedback && (
          <div
            data-testid="sidebar-export-preview"
            className="rounded-xl bg-emerald-950/25 border border-emerald-500/40 p-3 space-y-2 text-[11px]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-emerald-200 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  خروجی JSON آماده شد ({exportFeedback.approvedCount} تاییدشده
                  {exportFeedback.excludedCount > 0 ? ` · ${exportFeedback.excludedCount} ردشده` : ''})
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      void navigator.clipboard?.writeText(exportFeedback.json);
                      setExportFeedback(prev => (prev ? { ...prev, copied: true } : prev));
                    } catch {
                      // ignore
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-semibold whitespace-nowrap"
                >
                  {exportFeedback.copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{exportFeedback.copied ? 'کپی شد' : 'کپی JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFeedback(null)}
                  aria-label="بستن پیش‌نمایش خروجی"
                  className="p-0.5 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate" dir="ltr">
              {exportFeedback.filename}
            </div>
            <pre
              dir="ltr"
              className="max-h-28 overflow-auto rounded-lg bg-slate-950/90 border border-slate-800 p-2 text-[10px] text-slate-300 font-mono leading-relaxed"
            >
              {exportFeedback.json}
            </pre>
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

            {/* Session 16 Credibility Cost Score (1..100) & Analyst Statistics Tooltip */}
            <AnalysisConfidenceWidget
              activeScenario={activeScenario}
              scenarios={scenarios}
            />

            {/* Contextual Single-Line Jump Card to Pattern Inspector (zero duplication) */}
            {(is335Identified || isTriangleIdentified || isComplexIdentified) && (
              <button
                type="button"
                onClick={() => {
                  if (isTriangleIdentified) setInspectorKind('TRIANGLE');
                  else if (isComplexIdentified) setInspectorKind('COMPLEX');
                  else setInspectorKind('FLAT');
                  setActiveTab('PATTERN_INSPECTOR');
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between gap-2 text-right transition-colors ${
                  activeInvalidTriangle
                    ? 'bg-rose-950/25 hover:bg-rose-950/40 border-rose-500/45'
                    : 'bg-slate-900/80 hover:bg-slate-900 border-indigo-500/35'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isTriangleIdentified ? (
                    <Triangle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isComplexIdentified ? (
                    <GitMerge className="w-4 h-4 text-violet-400 shrink-0" />
                  ) : (
                    <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {isTriangleIdentified
                        ? 'بازرس تخصصی مثلث A-B-C-D-E آماده بررسی است'
                        : isComplexIdentified
                        ? 'بازرس تخصصی الگوی ترکیبی W-X-Y آماده بررسی است'
                        : 'بازرس تخصصی الگوی فلت ۳-۳-۵ آماده بررسی است'}
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate font-mono tabular-nums">
                      {isTriangleIdentified
                        ? `${liveTriangleValidation.isContracting ? 'مثلث انقباضی (مانع)' : liveTriangleValidation.isExpanding ? 'مثلث انبساطی (گستشی)' : 'نامعتبر'} · ${liveTriangleValidation.report.positionSlotLabelFa}`
                        : isComplexIdentified
                        ? `${liveComplexValidation.report.patternSignature} · ${liveComplexValidation.report.xWaveCandleCount} کندل X`
                        : liveFlatFlag
                        ? `B/A: ${liveFlatFlag.bRetracePct}% · C/B: ${liveFlatFlag.cPctOfB}%`
                        : 'ساختار اصلاحی ۳-۳-۵'}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 shrink-0">
                  <span>باز کردن</span>
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                </span>
              </button>
            )}

            {/* Quick Navigation Strip to Targets & Session 18-19 Plan */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetsSubView('SESSION_18_19');
                  setActiveTab('ANGLE_TARGETS');
                }}
                className="p-2.5 rounded-xl bg-emerald-950/25 hover:bg-emerald-950/40 border border-emerald-500/35 flex items-center justify-between gap-2 text-right transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">پلن ورود و جلسات ۱۸–۱۹</div>
                  <div className="text-[9.5px] text-slate-400 truncate">TMV سه‌نقطه‌ای و ریسک</div>
                </div>
                <ArrowUpLeft className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetsSubView('RADAR');
                  setActiveTab('ANGLE_TARGETS');
                }}
                className="p-2.5 rounded-xl bg-cyan-950/25 hover:bg-cyan-950/40 border border-cyan-500/35 flex items-center justify-between gap-2 text-right transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">رادار زوایا و PRZ</div>
                  <div className="text-[9.5px] text-slate-400 truncate">تلاقی فیبو و اهداف</div>
                </div>
                <ArrowUpLeft className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
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
              onHighlightLeg={onHoverLeg}
              variant="panel"
            />

            {/* Explainability Component (Wired cleanly to Session 18 TMV Targets) */}
            <ExplainabilityPanel
              scenario={activeScenario}
              onApplyAlternative={newPattern => onPatternChange(newPattern)}
              onApplyExtendedAdjustment={() => {
                setTargetsSubView('SESSION_18_19');
                setActiveTab('ANGLE_TARGETS');
              }}
            />
          </div>
        )}

        {isPatternInspectorTab && (
          <div className="space-y-3">
            {/* Sub-Inspector Switcher (Flat 3-3-5 / Triangle A-E / Complex W-X-Y) */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px]">
              <button
                type="button"
                data-testid="flat-pattern-inspector-tab"
                onClick={() => {
                  setInspectorKind('FLAT');
                  setActiveTab('PATTERN_INSPECTOR');
                }}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  (activeTab === 'FLAT_ANALYSIS' || (activeTab === 'PATTERN_INSPECTOR' && inspectorKind === 'FLAT'))
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                فلت ۳-۳-۵
              </button>
              <button
                type="button"
                data-testid="triangle-pattern-inspector-tab"
                onClick={() => {
                  setInspectorKind('TRIANGLE');
                  setActiveTab('PATTERN_INSPECTOR');
                }}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  (activeTab === 'TRIANGLE_ANALYSIS' || (activeTab === 'PATTERN_INSPECTOR' && inspectorKind === 'TRIANGLE'))
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                مثلث A-E
              </button>
              <button
                type="button"
                data-testid="complex-pattern-inspector-tab"
                onClick={() => {
                  setInspectorKind('COMPLEX');
                  setActiveTab('PATTERN_INSPECTOR');
                }}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  (activeTab === 'COMPLEX_ANALYSIS' || (activeTab === 'PATTERN_INSPECTOR' && inspectorKind === 'COMPLEX'))
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ترکیبی W-X-Y
              </button>
            </div>

            {(activeTab === 'FLAT_ANALYSIS' || (activeTab === 'PATTERN_INSPECTOR' && inspectorKind === 'FLAT')) && (
              is335Identified ? (
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
                    این ابزار زمانی فعال می‌شود که سناریوی انتخاب‌شده دارای ساختار ۳-۳-۵ یا یکی از الگوهای فلت باشد.
                  </p>
                </div>
              )
            )}

            {(activeTab === 'TRIANGLE_ANALYSIS' || (activeTab === 'PATTERN_INSPECTOR' && inspectorKind === 'TRIANGLE')) && (
              <>
                {!isTriangleIdentified && (
                  <div
                    data-testid="triangle-inspector-inactive-notice"
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2 flex-wrap"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-emerald-300">سناریوی فعلی مثلث نیست (شبیه‌ساز جلسه ۱۴ فعال است)</div>
                      <p className="text-[10.5px] text-slate-400">
                        می‌توانید قوانین جلسه ۱۴ (جایگاه ۴/B/۲، ساختار ۳-۳-۳-۳-۳ و برخورد خطوط) را در شبیه‌ساز زیر بررسی کنید.
                      </p>
                    </div>
                    {!activeScenario.isLocked && (
                      <button
                        type="button"
                        onClick={() => onPatternChange('TRIANGLE_CONVERGING', activeScenario.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/45 text-emerald-100 text-[10.5px] font-bold whitespace-nowrap shrink-0"
                      >
                        تبدیل به مثلث انقباضی (مانع)
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
              </>
            )}

            {(activeTab === 'COMPLEX_ANALYSIS' || (activeTab === 'PATTERN_INSPECTOR' && inspectorKind === 'COMPLEX')) && (
              <ComplexPatternInspector
                scenario={activeScenario}
                scenarios={scenarios}
                candles={candles}
                onApplyPattern={pattern => onPatternChange(pattern, activeScenario.id)}
                onApplyVertices={verts => onUpdateVertices?.(verts, activeScenario.id)}
              />
            )}
          </div>
        )}

        {activeTab === 'ANGLE_TARGETS' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setTargetsSubView('PRZ')}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  targetsSubView === 'PRZ'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PRZ و TMV
              </button>
              <button
                type="button"
                onClick={() => setTargetsSubView('SESSION_18_19')}
                className={`py-1.5 px-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  targetsSubView === 'SESSION_18_19'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                جلسات ۱۸–۱۹ و ورود
              </button>
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
                تلاقی فیبو
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
            ) : targetsSubView === 'SESSION_18_19' ? (
              <div className="space-y-3">
                <BahariSession1819Panel
                  scenario={activeScenario}
                  candles={candles}
                  onHoverLeg={onHoverLeg}
                />
                <EntryStrategyPanel
                  scenario={activeScenario}
                  candles={candles}
                  parentWaveLabel={drillContext?.waveLabel || ''}
                />
              </div>
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
              <strong>راهنما:</strong> روی هر گره کلیک کنید تا وارد ساختار زیرموج‌های همان تایم‌فریم شوید یا یک شاخه سناریوی جدید بسازید.
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
          <div className="space-y-3">
            {drillContext ? (
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>بررسی زیرموج‌ها: {drillContext.waveLabel}</span>
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
                    <span className="font-mono tabular-nums text-slate-400">{drillContext.candleCount} کندل</span>
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
                <strong>جهان سناریوها:</strong> برای بررسی ساختار درونی هر موج، روی خط آن موج در نمودار کلیک کنید تا داده‌ها و سناریوهای تایم‌فریم پایین‌تر بارگذاری شوند.
              </div>
            )}

            {/* Compact Export & Flagged Warning Bar (zero duplicate scenario cards) */}
            {scenarios.length > 0 && (
              <div
                data-testid="sleek-sidebar-scenario-list"
                className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300 gap-2">
                  <span className="font-semibold">
                    خروجی و پایش سلامت سناریوها ({scenarios.length})
                  </span>
                  <button
                    type="button"
                    data-testid="sidebar-scenarios-export-btn"
                    onClick={handleExportScenarios}
                    title="دریافت فایل JSON از سناریوهای تاییدشده"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/45 text-indigo-100 text-[10.5px] font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3 h-3 shrink-0" />
                    <span>خروجی JSON سناریوها</span>
                  </button>
                </div>

                {scenarios.some(sc => {
                  const invTri = isInvalidTriangle(sc, candles, {
                    parentRole: drillContext?.role,
                    parentWaveLabel: drillContext?.waveLabel || sc.parentLegLabel
                  });
                  return scenarioPhaseWarningsById[sc.id] || isExcludedFlat(sc, candles) || invTri;
                }) && (
                  <div className="space-y-1">
                    {scenarios.map(sc => {
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
                      if (!hasPhaseWarn && !flaggedForRemoval) return null;

                      return (
                        <div
                          key={`flag-${sc.id}`}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-rose-500/35 bg-rose-950/20 text-[10.5px]"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectScenario(sc.id)}
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-right text-slate-200"
                          >
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
                                title="فلت فرار (Running) طبق جلسه ۱۳ حذف شده و پیشنهاد می‌شود پاک شود."
                                className="px-1.5 py-0.5 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[9px] font-bold shrink-0 whitespace-nowrap"
                              >
                                فلت فرار حذف‌شده
                              </span>
                            )}
                            {invalidTriangle && (
                              <span
                                data-testid="sidebar-invalid-triangle-badge"
                                title={
                                  triCheck?.invalidTriangleReasonFa ||
                                  'مثلث نامعتبر: الگوی مثلث در موج ۱، ۳ یا ۵ مجاز نیست یا ساختار درونی ۳-۳-۳-۳-۳ ندارد.'
                                }
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[9px] font-bold shrink-0 whitespace-nowrap"
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>مثلث نامعتبر</span>
                              </span>
                            )}
                          </button>

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
                                  ? 'حذف سناریوی فلت فرار حذف‌شده برای تمیز ماندن درخت'
                                  : 'حذف سناریوی مثلث نامعتبر (موج ۱/۳/۵ یا غیر ۳-۳-۳-۳-۳)'
                              }
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/45 text-rose-200 text-[9.5px] font-bold transition-colors whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3 h-3 shrink-0" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
              <strong>موتور تشخیص تایم‌فریم معتبر:</strong> ارزیابی خودکار نویز، کفایت داده و تعداد کندل‌ها جهت تشخیص بالاترین و پایین‌ترین تایم‌فریم قابل موج‌شماری.
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
