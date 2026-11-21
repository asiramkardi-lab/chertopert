/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Wizard Step 3: Recursive Fractal Tree, Bijective Leg-to-Subbranch Mapping,
 * Multi-Timeframe Drill-Down, Independent Per-Scenario Validation, and Final-Step Target & PRZ/TMV Forecast.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Candle,
  FractalNode,
  DrillDownContext,
  WaveScenario,
  PatternFamily,
  WaveVertex
} from '../types/elliott';
import { RulesEngine, ValidationSummary, PATTERN_LABELS_FA, inferWaveRole } from '../engine/rulesEngine';
import { filterPatternsForRole } from '../engine/fractalSyncEngine';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import { getLowerTimeframe } from '../data/sampleMarketData';
import { ChartInteractionMode } from './ChartStudio';
import { RuleDiagnosticsPanel } from './RuleDiagnosticsPanel';
import { PatternValidator } from './PatternValidator';
import { TargetProjectionPanel, TargetProjectionBranchItem } from './TargetProjectionPanel';
import { AnglePenetrationWidget } from './AnglePenetrationWidget';
import { TopDownPipelineAudit } from './TopDownPipelineAudit';
import {
  GitBranch,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  Layers,
  Eye,
  EyeOff,
  Check,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PenTool,
  Plus,
  Move,
  Trash2,
  Sparkles,
  CornerDownLeft,
  ShieldCheck,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowUpLeft
} from 'lucide-react';

const TF_ORDER = ['1M', '1W', '1D', '4H', '1H', '15M'];

interface WizardStep3DrillDownProps {
  confirmedLowestTF: string;
  maxAllowedDegree: number;
  fractalTreeNodes: FractalNode[];
  activeRootNodeId: string;
  onSelectRootNode: (nodeId: string) => void;
  drillStack: DrillDownContext[];
  onDrillIntoLeg: (
    parentNodeId: string,
    parentScenario: WaveScenario,
    legIndex: number,
    baseDrillStack?: DrillDownContext[]
  ) => void;
  onJumpToBreadcrumb: (stackIndex: number) => void; // -1 returns to Level 1
  onJumpToBranch?: (node: FractalNode, rootNodeId: string) => void;
  activeSubScenarios: WaveScenario[];
  activeSubScenarioId: string;
  overlayScenarioIds: string[];
  onSelectSubScenario: (id: string) => void;
  onToggleOverlay: (id: string) => void;
  onToggleKeepSubScenario: (id: string) => void;
  onToggleDiscardSubScenario: (id: string) => void;
  onPatternChange: (pattern: PatternFamily, targetScenarioId?: string) => void;
  onUpdateVertices: (vertices: WaveVertex[], targetScenarioId?: string) => void;
  interactionMode: ChartInteractionMode;
  onChangeInteractionMode: (mode: ChartInteractionMode) => void;
  onCreateScratchScenario: () => void;
  onBackToStep2: () => void;
  activeLevelScenario: WaveScenario;
  rootScenarios?: WaveScenario[];
  allTreeBranchItems?: TargetProjectionBranchItem[];
  onValidateScenario?: (id: string, summary: ValidationSummary) => void;
  onHoverScenario?: (id: string | null) => void;
  onHoverLeg?: (legIndex: number | null) => void;
  candles?: Candle[];
  candlesByTf?: Record<string, Candle[]>;
  marketType?: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  showPRZ?: boolean;
  onToggleShowPRZ?: () => void;
  showTMV?: boolean;
  onToggleShowTMV?: () => void;
}

export const WizardStep3DrillDown: React.FC<WizardStep3DrillDownProps> = ({
  confirmedLowestTF,
  maxAllowedDegree,
  fractalTreeNodes,
  activeRootNodeId,
  onSelectRootNode,
  drillStack,
  onDrillIntoLeg,
  onJumpToBreadcrumb,
  onJumpToBranch,
  activeSubScenarios,
  activeSubScenarioId,
  overlayScenarioIds,
  onSelectSubScenario,
  onToggleOverlay,
  onToggleKeepSubScenario,
  onToggleDiscardSubScenario,
  onPatternChange,
  onUpdateVertices,
  interactionMode,
  onChangeInteractionMode,
  onCreateScratchScenario,
  onBackToStep2,
  activeLevelScenario,
  rootScenarios = [],
  allTreeBranchItems = [],
  onValidateScenario,
  onHoverScenario,
  onHoverLeg,
  candles = [],
  candlesByTf,
  marketType = 'CRYPTO',
  showPRZ = true,
  onToggleShowPRZ,
  showTMV = true,
  onToggleShowTMV
}) => {
  const [subTab, setSubTab] = useState<'SCENARIOS' | 'LEGS' | 'TARGETS' | 'EDIT' | 'RULES'>('SCENARIOS');
  const [targetsViewMode, setTargetsViewMode] = useState<'ANGLE_RADAR' | 'PRZ_TMV'>('ANGLE_RADAR');
  const [validationReportsById, setValidationReportsById] = useState<Record<string, ValidationSummary>>({});
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});

  const currentDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  useEffect(() => {
    if (currentDrill?.nodeId) {
      setSubTab('SCENARIOS');
    }
  }, [currentDrill?.nodeId]);

  const activeProjection = useMemo(() => {
    if (activeLevelScenario.vertices.length < 2) return null;
    return RulesEngine.predictScenarioProjections(
      activeLevelScenario,
      candles,
      currentDrill?.role || 'ROOT',
      currentDrill?.waveLabel || ''
    );
  }, [activeLevelScenario, candles, currentDrill?.role, currentDrill?.waveLabel]);

  const handleValidateScenario = (sc: WaveScenario) => {
    const summary = RulesEngine.validateStructure(
      sc.patternType,
      sc.vertices,
      sc.direction,
      currentDrill?.role || 'ROOT',
      currentDrill?.waveLabel || ''
    );
    setValidationReportsById(prev => ({ ...prev, [sc.id]: summary }));
    if (onValidateScenario) {
      onValidateScenario(sc.id, summary);
    }
  };

  const handleValidateActiveLevel = () => {
    handleValidateScenario(activeLevelScenario);
  };

  const getNextValidLowerTFFor = (tf: string, deg: WaveScenario['degree']) => {
    const nxt = getLowerTimeframe(tf);
    if (!nxt) return null;
    const lowestIdx = TF_ORDER.indexOf(confirmedLowestTF);
    const nxtIdx = TF_ORDER.indexOf(nxt);
    const degLevel = DEGREE_CONFIGS[deg].level;
    if (nxtIdx > lowestIdx || degLevel >= maxAllowedDegree) return null;
    return nxt;
  };

  const currentTF = activeLevelScenario.timeframe;
  const nextLowerTF = getNextValidLowerTFFor(currentTF, activeLevelScenario.degree);
  const canDrillDeeper = Boolean(nextLowerTF);

  const activeNode = fractalTreeNodes.find(n => n.id === activeRootNodeId) || fractalTreeNodes[0];

  const resolveScenarioForNode = (node: FractalNode): WaveScenario => {
    const branchMatch = allTreeBranchItems.find(b => b.id === node.id)?.scenario;
    if (branchMatch) return branchMatch;
    const foundRoot = rootScenarios.find(s => s.id === node.scenarioId);
    if (foundRoot) return foundRoot;
    return {
      ...activeLevelScenario,
      id: node.scenarioId,
      name: node.scenarioName,
      color: node.color,
      timeframe: node.timeframe,
      degree: node.degree,
      patternType: node.patternType,
      vertices: node.vertices,
      validityScore: node.validityScore
    };
  };

  const toggleNodeExpanded = (nodeId: string) => {
    setExpandedNodeIds(prev => ({ ...prev, [nodeId]: !(prev[nodeId] ?? true) }));
  };

  // Recursive Bijective Fractal Tree Renderer (Every Node + All Its Wave Legs + All Matching Child Sub-Branches)
  const renderTreeNodes = (nodes: FractalNode[], rootNodeId: string, depth = 0) => {
    return nodes.map(node => {
      const nodeScenario = resolveScenarioForNode(node);
      const isRoot = depth === 0;
      const isSelected = isRoot
        ? node.id === activeNode?.id && !currentDrill
        : Boolean(currentDrill && currentDrill.nodeId === node.drillKey && activeSubScenarioId === node.scenarioId);
      const isExpanded = expandedNodeIds[node.id] ?? (isRoot ? node.id === activeNode?.id || nodes.length === 1 : true);
      const nodeNextTF = getNextValidLowerTFFor(node.timeframe, node.degree);
      const nodeLegs = nodeScenario.vertices.slice(0, -1).map((vStart, legIdx) => {
        const vEnd = nodeScenario.vertices[legIdx + 1];
        const legLabel = `موج ${vStart.label}→${vEnd.label}`;
        const role = inferWaveRole(vEnd.label, nodeScenario.patternType);
        const childBranches = node.children.filter(c =>
          c.legIndex !== undefined ? c.legIndex === legIdx : c.waveLabel === legLabel
        );
        const pct = vStart.price > 0 ? Math.round(((vEnd.price - vStart.price) / vStart.price) * 1000) / 10 : 0;
        return { legIdx, vStart, vEnd, legLabel, role, childBranches, pct };
      });

      const scSummary = isRoot ? validationReportsById[node.scenarioId] : undefined;
      const scValidatedValid = scSummary
        ? scSummary.isValid && scSummary.rules.filter(r => r.type === 'HARD' && !r.passed).length === 0
        : null;

      return (
        <div key={node.id} className={depth > 0 ? 'mr-3 pr-2.5 border-r border-indigo-500/30 space-y-1.5' : 'space-y-2'}>
          <div
            onClick={() => {
              if (onJumpToBranch) {
                onJumpToBranch(node, rootNodeId);
              } else if (isRoot) {
                onJumpToBreadcrumb(-1);
                onSelectRootNode(node.id);
              }
            }}
            onMouseEnter={() => {
              if (isRoot) onHoverScenario?.(node.scenarioId);
            }}
            onMouseLeave={() => {
              if (isRoot) onHoverScenario?.(null);
            }}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
              isSelected
                ? 'bg-[#101a32] border-cyan-500/60'
                : 'bg-slate-900/65 border-slate-800 hover:border-indigo-500/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                {nodeLegs.length > 0 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      toggleNodeExpanded(node.id);
                    }}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white shrink-0"
                    title={isExpanded ? 'بستن گام‌های متناظر' : 'باز کردن گام‌های متناظر'}
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                  </button>
                )}
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: node.color }} />
                <span className="text-xs font-bold text-white truncate">{node.scenarioName}</span>
                {scValidatedValid !== null && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                      scValidatedValid
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {scValidatedValid ? 'معتبر ✓' : 'خطا ✕'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                {isRoot && (
                  <button
                    type="button"
                    onClick={() => handleValidateScenario(nodeScenario)}
                    title="تأیید و ارزیابی مجزای این سناریو"
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10.5px] font-semibold transition-colors ${
                      scValidatedValid === true
                        ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-200 hover:bg-emerald-600/40'
                        : scValidatedValid === false
                        ? 'bg-rose-600/20 border-rose-500/50 text-rose-200 hover:bg-rose-600/35'
                        : 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>تأیید</span>
                  </button>
                )}
                <span className="text-[11px] font-mono text-cyan-400 shrink-0">{node.timeframe}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10.5px] text-slate-400 gap-2">
              <span className="truncate">
                {node.waveLabel} · {PATTERN_LABELS_FA[node.patternType].split('(')[0].trim()}
              </span>
              <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                <span className="text-slate-500">{node.children.length} زیرشاخه</span>
                <span className={node.isValid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {node.validityScore}%
                </span>
              </div>
            </div>
          </div>

          {isRoot && scSummary && (
            <RuleDiagnosticsPanel
              scenario={nodeScenario}
              summary={scSummary}
              candles={candles}
              parentRole="ROOT"
              parentWaveLabel=""
              onApplyPattern={pattern => {
                if (node.id !== activeRootNodeId) onSelectRootNode(node.id);
                onPatternChange(pattern, nodeScenario.id);
                const updated = RulesEngine.validateStructure(pattern, nodeScenario.vertices, nodeScenario.direction);
                setValidationReportsById(prev => ({ ...prev, [nodeScenario.id]: updated }));
                onValidateScenario?.(nodeScenario.id, updated);
              }}
              onApplyVertices={verts => {
                if (node.id !== activeRootNodeId) onSelectRootNode(node.id);
                onUpdateVertices(verts, nodeScenario.id);
                const updated = RulesEngine.validateStructure(
                  nodeScenario.patternType,
                  verts,
                  nodeScenario.direction
                );
                setValidationReportsById(prev => ({ ...prev, [nodeScenario.id]: updated }));
                onValidateScenario?.(nodeScenario.id, updated);
              }}
              onRevalidate={() => handleValidateScenario(nodeScenario)}
              onClose={() =>
                setValidationReportsById(prev => {
                  const next = { ...prev };
                  delete next[nodeScenario.id];
                  return next;
                })
              }
              variant="inline"
            />
          )}

          {/* 1-to-1 Wave Legs & Corresponding Sub-Branches inside Tree */}
          {isExpanded && nodeLegs.length > 0 && (
            <div className="mr-3 pr-2.5 border-r border-slate-800 space-y-1.5">
              {nodeLegs.map(leg => {
                const isUp = leg.vEnd.price >= leg.vStart.price;
                const parentScopeId = node.drillKey || node.id;
                const parentStackPath = node.drillStackPath || [];
                const canHighlightOnChart = nodeScenario.id === activeLevelScenario.id;

                return (
                  <div key={`${node.id}-leg-${leg.legIdx}`} className="space-y-1.5">
                    <div
                      onMouseEnter={() => {
                        if (canHighlightOnChart) onHoverLeg?.(leg.legIdx);
                      }}
                      onMouseLeave={() => {
                        if (canHighlightOnChart) onHoverLeg?.(null);
                      }}
                      className="px-2.5 py-2 rounded-lg bg-slate-950/75 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                          {isUp ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                          )}
                          <span className="font-mono font-bold text-slate-200">{leg.legLabel}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-semibold ${
                              leg.role === 'MOTIVE'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {leg.role === 'MOTIVE' ? 'اصلی ۵ موجی' : 'اصلاحی ۳ موجی'}
                          </span>
                          <span
                            className={`font-mono tabular-nums text-[10px] ${
                              leg.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {leg.pct > 0 ? `+${leg.pct}%` : `${leg.pct}%`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                          {leg.vStart.price.toLocaleString()} ← {leg.vEnd.price.toLocaleString()} ·{' '}
                          {Math.abs(leg.vEnd.candleIndex - leg.vStart.candleIndex) + 1} کندل
                        </div>
                      </div>

                      {nodeNextTF ? (
                        <button
                          type="button"
                          onClick={() => onDrillIntoLeg(parentScopeId, nodeScenario, leg.legIdx, parentStackPath)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold shrink-0 transition-colors border ${
                            leg.childBranches.length > 0
                              ? 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/45 text-cyan-200'
                              : 'bg-indigo-600/20 hover:bg-indigo-600/35 border-indigo-500/45 text-indigo-200'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          <span>
                            {leg.childBranches.length > 0
                              ? `مشاهده ${nodeNextTF} (${leg.childBranches.length})`
                              : `متناظر ${nodeNextTF}`}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-600 shrink-0">کف تایم</span>
                      )}
                    </div>

                    {leg.childBranches.length > 0 && (
                      <div className="space-y-1.5">
                        {renderTreeNodes(leg.childBranches, rootNodeId, depth + 1)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  // Wave legs of the currently displayed scenario (either Level 1 root or current sub-scenario)
  const waveLegs = activeLevelScenario.vertices.slice(0, -1).map((vStart, idx) => {
    const vEnd = activeLevelScenario.vertices[idx + 1];
    const role = inferWaveRole(vEnd.label, activeLevelScenario.patternType);
    const pctChange = vStart.price > 0 ? Math.round(((vEnd.price - vStart.price) / vStart.price) * 1000) / 10 : 0;
    const legLabel = `موج ${vStart.label}→${vEnd.label}`;

    // Find matching child nodes in fractalTreeNodes for exact 1-to-1 leg status
    const findChildNodes = (list: FractalNode[]): FractalNode[] => {
      for (const n of list) {
        const matchesActive =
          (!currentDrill && n.scenarioId === activeLevelScenario.id) ||
          (currentDrill && n.drillKey === currentDrill.nodeId && n.scenarioId === activeLevelScenario.id);
        if (matchesActive) {
          return n.children.filter(c => (c.legIndex !== undefined ? c.legIndex === idx : c.waveLabel === legLabel));
        }
        const deep = findChildNodes(n.children);
        if (deep.length > 0) return deep;
      }
      return [];
    };
    const syncedChildren = findChildNodes(fractalTreeNodes);

    return {
      idx,
      vStart,
      vEnd,
      legLabel: `${vStart.label} → ${vEnd.label}`,
      pctChange,
      role,
      candleSpan: Math.abs(vEnd.candleIndex - vStart.candleIndex) + 1,
      syncedChildren
    };
  });

  const failedHardRules = activeLevelScenario.rulesResults.filter(r => r.type === 'HARD' && !r.passed);
  const solvableAlt = failedHardRules.find(r => r.canBeSolvedByAlternate)?.canBeSolvedByAlternate;
  const primaryPrz = activeProjection?.przZones.find(z => z.isPrimary) || activeProjection?.przZones[0];

  const renderValidationBanner = () => {
    const summary = validationReportsById[activeLevelScenario.id];
    if (!summary) return null;
    return (
      <RuleDiagnosticsPanel
        scenario={activeLevelScenario}
        summary={summary}
        candles={candles}
        parentRole={currentDrill?.role || 'ROOT'}
        parentWaveLabel={currentDrill?.waveLabel || ''}
        onApplyPattern={pattern => {
          onPatternChange(pattern);
          const updated = RulesEngine.validateStructure(
            pattern,
            activeLevelScenario.vertices,
            activeLevelScenario.direction,
            currentDrill?.role || 'ROOT',
            currentDrill?.waveLabel || ''
          );
          setValidationReportsById(prev => ({ ...prev, [activeLevelScenario.id]: updated }));
          onValidateScenario?.(activeLevelScenario.id, updated);
        }}
        onApplyVertices={verts => {
          onUpdateVertices(verts);
          const updated = RulesEngine.validateStructure(
            activeLevelScenario.patternType,
            verts,
            activeLevelScenario.direction,
            currentDrill?.role || 'ROOT',
            currentDrill?.waveLabel || ''
          );
          setValidationReportsById(prev => ({ ...prev, [activeLevelScenario.id]: updated }));
          onValidateScenario?.(activeLevelScenario.id, updated);
        }}
        onRevalidate={() => handleValidateScenario(activeLevelScenario)}
        onClose={() =>
          setValidationReportsById(prev => {
            const next = { ...prev };
            delete next[activeLevelScenario.id];
            return next;
          })
        }
        variant="inline"
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb, PRZ/TMV Bar & Navigation */}
      <div className="p-4 pb-3 border-b border-slate-800 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <span>مرحله ۳: درخت متناظر، تارگت و PRZ/TMV</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-400">سقف: {confirmedLowestTF}</span>
        </div>

        {/* Interactive Breadcrumb Trail */}
        <div className="flex items-center gap-1 flex-wrap text-[11px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <button
            onClick={() => onJumpToBreadcrumb(-1)}
            className={`font-medium transition-colors ${
              drillStack.length === 0 ? 'text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            سطح ۱ ({fractalTreeNodes[0]?.timeframe || currentTF})
          </button>

          {drillStack.map((item, idx) => {
            const isLast = idx === drillStack.length - 1;
            return (
              <React.Fragment key={item.nodeId + idx}>
                <ChevronLeft className="w-3 h-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => onJumpToBreadcrumb(idx)}
                  className={`font-medium transition-colors ${
                    isLast ? 'text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.waveLabel} ({item.targetTimeframe})
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Context Banner when Drilled Down */}
        {currentDrill && (
          <div className="p-2 rounded-lg bg-indigo-950/35 border border-indigo-500/30 text-[11px] text-slate-300 flex items-center justify-between gap-2">
            <div className="truncate">
              <span className="text-indigo-300 font-bold">موج مادر: {currentDrill.waveLabel}</span>
              <span className="text-slate-500 mx-1.5">·</span>
              <span>
                تناظر:{' '}
                <strong className={currentDrill.role === 'MOTIVE' ? 'text-emerald-300' : 'text-amber-300'}>
                  {currentDrill.role === 'MOTIVE' ? 'اصلی (۵ موجی / قطر)' : 'اصلاحی (۳ موجی / مثلث)'}
                </strong>
              </span>
            </div>
            <span className="font-mono text-cyan-400 shrink-0">{currentDrill.targetTimeframe}</span>
          </div>
        )}

        {/* Independent Horizontal PRZ & Horizontal TMV Controls */}
        {(onToggleShowPRZ || onToggleShowTMV) && (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onToggleShowPRZ}
              className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg border text-[10.5px] font-semibold transition-colors ${
                showPRZ
                  ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1 min-w-0 truncate">
                {showPRZ ? <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">PRZ افقی</span>
              </span>
              <span className="font-mono text-[9.5px] shrink-0">{showPRZ ? 'نمایش' : 'مخفی'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleShowTMV}
              className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg border text-[10.5px] font-semibold transition-colors ${
                showTMV
                  ? 'bg-sky-500/15 border-sky-500/45 text-sky-200'
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1 min-w-0 truncate">
                {showTMV ? <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">TMV افقی</span>
              </span>
              <span className="font-mono text-[9.5px] shrink-0">{showTMV ? 'نمایش' : 'مخفی'}</span>
            </button>
          </div>
        )}

        {/* 5 Clean Navigation Sub-Tabs */}
        <div className="grid grid-cols-5 gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-[10.5px]">
          <button
            onClick={() => setSubTab('SCENARIOS')}
            className={`py-1.5 rounded-md font-semibold transition-colors ${
              subTab === 'SCENARIOS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {currentDrill ? `زیرها (${activeSubScenarios.length})` : `درخت (${fractalTreeNodes.length})`}
          </button>
          <button
            onClick={() => {
              setSubTab('LEGS');
              onHoverScenario?.(null);
            }}
            className={`py-1.5 rounded-md font-semibold transition-colors ${
              subTab === 'LEGS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            گام‌ها ({waveLegs.length})
          </button>
          <button
            onClick={() => {
              setSubTab('TARGETS');
              onHoverLeg?.(null);
            }}
            className={`py-1.5 rounded-md font-semibold transition-colors ${
              subTab === 'TARGETS' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            تارگت‌ها
          </button>
          <button
            onClick={() => {
              setSubTab('EDIT');
              onHoverScenario?.(null);
              onHoverLeg?.(null);
            }}
            className={`py-1.5 rounded-md font-semibold transition-colors ${
              subTab === 'EDIT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            ویرایش
          </button>
          <button
            onClick={() => {
              setSubTab('RULES');
              onHoverScenario?.(null);
              onHoverLeg?.(null);
            }}
            className={`py-1.5 rounded-md font-semibold transition-colors ${
              subTab === 'RULES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            قوانین ({failedHardRules.length})
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Quick Active Forecast Preview Strip inside Tree / Scenarios view */}
        {subTab === 'SCENARIOS' && activeProjection && (
          <div
            onClick={() => setSubTab('TARGETS')}
            className="p-2.5 rounded-xl bg-[#091326] border border-cyan-500/35 hover:border-cyan-400/70 cursor-pointer transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 font-bold text-cyan-300">
                <Target className="w-3.5 h-3.5" />
                <span>پیش‌بینی گام آخر ({activeProjection.lastLegLabel})</span>
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-300 font-semibold">
                <span>رادار زوایا، تارگت و PRZ</span>
                <ArrowUpLeft className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono tabular-nums text-slate-300">
              <span className="truncate text-amber-300">
                PRZ: {primaryPrz ? `${primaryPrz.lowPrice.toLocaleString()}–${primaryPrz.highPrice.toLocaleString()}` : '—'}
              </span>
              <span className="truncate text-sky-300">
                TMV:{' '}
                {activeProjection.tmvZones?.[0]
                  ? `${activeProjection.tmvZones[0].lowPrice.toLocaleString()}–${activeProjection.tmvZones[0].highPrice.toLocaleString()}`
                  : '—'}
              </span>
              <span className="text-white font-bold">
                {activeProjection.targets[0] ? activeProjection.targets[0].price.toLocaleString() : '—'}
              </span>
            </div>
          </div>
        )}

        {subTab === 'SCENARIOS' && !currentDrill && (
          <div className="space-y-2.5" onMouseLeave={() => onHoverScenario?.(null)}>
            <div className="text-[11px] text-slate-400">
              درخت فرکتالی زنده — هر شاخه و هر گام با چارت و تایم‌فریم متناظر خودش همگام است:
            </div>
            {fractalTreeNodes.map(rootNode => (
              <div key={rootNode.id} className="space-y-2">
                {renderTreeNodes([rootNode], rootNode.id, 0)}
              </div>
            ))}
          </div>
        )}

        {subTab === 'SCENARIOS' && currentDrill && (
          <div className="space-y-2.5" onMouseLeave={() => onHoverScenario?.(null)}>
            <button
              onClick={onCreateScratchScenario}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/40 text-indigo-300 text-xs font-semibold"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>ترسیم زیرموج دلخواه از صفر</span>
            </button>

            {activeSubScenarios.map(sc => {
              const isActive = sc.id === activeSubScenarioId;
              const isOverlay = overlayScenarioIds.includes(sc.id);
              const hardFails = sc.rulesResults.filter(r => r.type === 'HARD' && !r.passed).length;
              const scSummary = validationReportsById[sc.id];
              const scValidatedValid = scSummary
                ? scSummary.isValid && scSummary.rules.filter(r => r.type === 'HARD' && !r.passed).length === 0
                : null;

              return (
                <div key={sc.id} className="space-y-2">
                  <div
                    onClick={() => onSelectSubScenario(sc.id)}
                    onMouseEnter={() => onHoverScenario?.(sc.id)}
                    onMouseLeave={() => onHoverScenario?.(null)}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                      sc.isDiscarded
                        ? 'bg-slate-950/60 border-slate-900 opacity-55'
                        : isActive
                        ? 'bg-slate-900 border-cyan-500/55'
                        : 'bg-slate-900/50 border-slate-800/80 hover:border-indigo-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-sm shrink-0 mt-1" style={{ backgroundColor: sc.color }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-white truncate">{sc.name}</h4>
                            {scValidatedValid !== null && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                  scValidatedValid
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                }`}
                              >
                                {scValidatedValid ? 'معتبر ✓' : 'خطا ✕'}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block">
                            {PATTERN_LABELS_FA[sc.patternType]}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onToggleOverlay(sc.id);
                        }}
                        className={`p-1.5 rounded-lg border shrink-0 ${
                          isOverlay || isActive
                            ? 'bg-slate-800 border-slate-600 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        {isOverlay || isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px] gap-2 flex-wrap">
                      <span
                        className={`font-mono tabular-nums ${
                          hardFails === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                        }`}
                      >
                        اعتبار {sc.validityScore}% · {sc.vertices.length} نقطه
                      </span>

                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleValidateScenario(sc)}
                          title="تأیید و ارزیابی مجزای این زیرسناریو"
                          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                            scValidatedValid === true
                              ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-200 hover:bg-emerald-600/40'
                              : scValidatedValid === false
                              ? 'bg-rose-600/20 border-rose-500/50 text-rose-200 hover:bg-rose-600/35'
                              : 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>تأیید</span>
                        </button>

                        <button
                          onClick={() => onToggleKeepSubScenario(sc.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium ${
                            sc.isSelectedForTree && !sc.isDiscarded
                              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{sc.isSelectedForTree && !sc.isDiscarded ? 'ثبت در درخت' : 'انتخاب'}</span>
                        </button>

                        <button
                          onClick={() => onToggleDiscardSubScenario(sc.id)}
                          className={`p-1 rounded-md border ${
                            sc.isDiscarded
                              ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-rose-400'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {scSummary && (
                    <RuleDiagnosticsPanel
                      scenario={sc}
                      summary={scSummary}
                      candles={candles}
                      parentRole={currentDrill.role}
                      parentWaveLabel={currentDrill.waveLabel}
                      onApplyPattern={pattern => {
                        if (!isActive) onSelectSubScenario(sc.id);
                        onPatternChange(pattern, sc.id);
                        const updated = RulesEngine.validateStructure(
                          pattern,
                          sc.vertices,
                          sc.direction,
                          currentDrill.role,
                          currentDrill.waveLabel
                        );
                        setValidationReportsById(prev => ({ ...prev, [sc.id]: updated }));
                        onValidateScenario?.(sc.id, updated);
                      }}
                      onApplyVertices={verts => {
                        if (!isActive) onSelectSubScenario(sc.id);
                        onUpdateVertices(verts, sc.id);
                        const updated = RulesEngine.validateStructure(
                          sc.patternType,
                          verts,
                          sc.direction,
                          currentDrill.role,
                          currentDrill.waveLabel
                        );
                        setValidationReportsById(prev => ({ ...prev, [sc.id]: updated }));
                        onValidateScenario?.(sc.id, updated);
                      }}
                      onRevalidate={() => handleValidateScenario(sc)}
                      onClose={() =>
                        setValidationReportsById(prev => {
                          const next = { ...prev };
                          delete next[sc.id];
                          return next;
                        })
                      }
                      variant="inline"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {subTab === 'LEGS' && (
          <div className="space-y-2.5" onMouseLeave={() => onHoverLeg?.(null)}>
            {!canDrillDeeper && (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200">
                به پایین‌ترین تایم‌فریم تأییدشده ({confirmedLowestTF}) یا سقف درجه بازار ({maxAllowedDegree} درجه) رسیده‌اید.
              </div>
            )}

            {waveLegs.map(leg => {
              const isUp = leg.vEnd.price >= leg.vStart.price;
              const hasSyncedBranch = leg.syncedChildren.length > 0;
              const allBranchValid = hasSyncedBranch && leg.syncedChildren.every(c => c.isValid);

              return (
                <div
                  key={`legrow-${leg.idx}`}
                  onMouseEnter={() => onHoverLeg?.(leg.idx)}
                  onMouseLeave={() => onHoverLeg?.(null)}
                  className="p-3 rounded-xl bg-slate-900/65 border border-slate-800 hover:border-indigo-500/50 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-bold text-white flex-wrap">
                        {isUp ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="font-mono text-cyan-300">{leg.legLabel}</span>
                        <span className={leg.role === 'MOTIVE' ? 'text-emerald-400' : 'text-amber-300'}>
                          {leg.role === 'MOTIVE' ? 'اصلی (۵ موجی)' : 'اصلاحی (۳ موجی)'}
                        </span>
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            leg.pctChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {leg.pctChange > 0 ? `+${leg.pctChange}%` : `${leg.pctChange}%`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {leg.vStart.price.toLocaleString()} → {leg.vEnd.price.toLocaleString()} · {leg.candleSpan} کندل
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        onDrillIntoLeg(
                          currentDrill ? currentDrill.nodeId : activeNode?.id || activeLevelScenario.id,
                          activeLevelScenario,
                          leg.idx
                        )
                      }
                      disabled={!canDrillDeeper}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-semibold shrink-0 transition-colors ${
                        hasSyncedBranch
                          ? 'bg-cyan-600 hover:bg-cyan-500'
                          : 'bg-indigo-600 hover:bg-indigo-500'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>
                        {hasSyncedBranch
                          ? `زیرشاخه ${nextLowerTF} (${leg.syncedChildren.length})`
                          : `ریزش به ${nextLowerTF || '—'}`}
                      </span>
                    </button>
                  </div>

                  {/* Live 1-to-1 Fractal Correspondence Status for this Leg */}
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10.5px] gap-2">
                    {hasSyncedBranch ? (
                      <>
                        <span className="text-slate-300 truncate">
                          متناظر با: {leg.syncedChildren.map(c => c.scenarioName.split('(')[0].trim()).join('، ')}
                        </span>
                        <span
                          className={`shrink-0 font-bold ${
                            allBranchValid ? 'text-emerald-400' : 'text-amber-300'
                          }`}
                        >
                          {allBranchValid ? 'هم‌تراز ✓' : 'نیازمند بررسی'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500">زیرشاخه تایم پایین‌تر هنوز بارگذاری نشده</span>
                        <span className="font-mono text-indigo-300 shrink-0">
                          {nextLowerTF ? `هدف: ${nextLowerTF}` : 'پایان عمق'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {subTab === 'TARGETS' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setTargetsViewMode('ANGLE_RADAR')}
                className={`py-1.5 px-2.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  targetsViewMode === 'ANGLE_RADAR'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                رادار زوایا و نفوذ
              </button>
              <button
                type="button"
                onClick={() => setTargetsViewMode('PRZ_TMV')}
                className={`py-1.5 px-2.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  targetsViewMode === 'PRZ_TMV'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                پروجکشن PRZ و TMV
              </button>
            </div>

            {targetsViewMode === 'ANGLE_RADAR' ? (
              <AnglePenetrationWidget
                scenario={activeLevelScenario}
                candles={candles}
                parentRole={currentDrill?.role || 'ROOT'}
                parentWaveLabel={currentDrill?.waveLabel || ''}
              />
            ) : (
              <TargetProjectionPanel
                currentLevelScenarios={
                  currentDrill
                    ? activeSubScenarios
                    : rootScenarios.filter(s => s.isSelectedForTree && !s.isDiscarded)
                }
                allBranchItems={allTreeBranchItems}
                activeScenarioId={activeLevelScenario.id}
                candles={candles}
                parentRole={currentDrill?.role || 'ROOT'}
                parentWaveLabel={currentDrill?.waveLabel || ''}
                onSelectScenario={id => {
                  if (currentDrill) {
                    onSelectSubScenario(id);
                  } else {
                    const matchedNode = fractalTreeNodes.find(n => n.scenarioId === id);
                    if (matchedNode) onSelectRootNode(matchedNode.id);
                  }
                }}
                onHoverScenario={onHoverScenario}
                showPRZ={showPRZ}
                onToggleShowPRZ={onToggleShowPRZ}
                showTMV={showTMV}
                onToggleShowTMV={onToggleShowTMV}
              />
            )}
          </div>
        )}

        {subTab === 'EDIT' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onChangeInteractionMode('EDIT')}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs border ${
                  interactionMode === 'EDIT'
                    ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>درگ</span>
              </button>
              <button
                onClick={() => onChangeInteractionMode('ADD_VERTEX')}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs border ${
                  interactionMode === 'ADD_VERTEX'
                    ? 'bg-cyan-600 border-cyan-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن</span>
              </button>
              <button
                onClick={onCreateScratchScenario}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs border ${
                  interactionMode === 'DRAW_SCRATCH'
                    ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>از صفر</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-400 block">نوع الگو:</label>
              <div className="flex items-center gap-2">
                <select
                  value={activeLevelScenario.patternType}
                  onChange={e => onPatternChange(e.target.value as PatternFamily)}
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {filterPatternsForRole(currentDrill?.role || 'ROOT').map(pf => (
                    <option key={pf} value={pf}>
                      {PATTERN_LABELS_FA[pf]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleValidateActiveLevel}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>تأیید (Validate)</span>
                </button>
              </div>
            </div>

            {renderValidationBanner()}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">نقاط موج (لیبل و قیمت قابل ویرایش):</span>
                <button
                  onClick={() => {
                    const verts = activeLevelScenario.vertices;
                    const last = verts[verts.length - 1];
                    const defaultLabels =
                      currentDrill?.role === 'CORRECTIVE'
                        ? ['0', 'A', 'B', 'C', 'D', 'E']
                        : ['0', '1', '2', '3', '4', '5'];
                    const nextLabel = defaultLabels[verts.length] || `W${verts.length}`;
                    onUpdateVertices([
                      ...verts,
                      {
                        label: nextLabel,
                        candleIndex: last ? last.candleIndex + 4 : 5,
                        price: last ? Math.round(last.price * 1.03) : 50000,
                        timestamp: last ? last.timestamp + 86400000 : Date.now(),
                        isConfirmed: true
                      }
                    ]);
                  }}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>افزودن نقطه</span>
                </button>
              </div>
              {activeLevelScenario.vertices.map((v, idx) => (
                <div
                  key={`subv-${idx}`}
                  className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2.5 py-1.5"
                >
                  <input
                    type="text"
                    value={v.label}
                    onChange={e => {
                      const next = activeLevelScenario.vertices.map((item, i) =>
                        i === idx ? { ...item, label: e.target.value } : item
                      );
                      onUpdateVertices(next);
                    }}
                    className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono font-bold text-center text-cyan-300"
                  />
                  <input
                    type="number"
                    value={v.price}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (Number.isNaN(val)) return;
                      const next = activeLevelScenario.vertices.map((item, i) =>
                        i === idx ? { ...item, price: val } : item
                      );
                      onUpdateVertices(next);
                    }}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">#{v.candleIndex + 1}</span>
                  <button
                    onClick={() => {
                      if (activeLevelScenario.vertices.length === 0) return;
                      onUpdateVertices(activeLevelScenario.vertices.filter((_, i) => i !== idx));
                    }}
                    disabled={activeLevelScenario.vertices.length === 0}
                    className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'RULES' && (
          <div className="space-y-3">
            <TopDownPipelineAudit
              candles={candles}
              candlesByTf={candlesByTf}
              scenario={activeLevelScenario}
              scenarios={currentDrill ? activeSubScenarios : rootScenarios}
              marketType={marketType}
              timeframe={activeLevelScenario.timeframe}
              parentRole={currentDrill?.role || 'ROOT'}
              parentWaveLabel={currentDrill?.waveLabel || ''}
              compact
            />

            <PatternValidator
              scenario={activeLevelScenario}
              candles={candles}
              parentRole={currentDrill?.role || 'ROOT'}
              parentWaveLabel={currentDrill?.waveLabel || ''}
              onApplyPattern={pattern => onPatternChange(pattern)}
              onApplyVertices={verts => onUpdateVertices(verts)}
              onValidationComplete={summary => {
                setValidationReportsById(prev => ({ ...prev, [activeLevelScenario.id]: summary }));
                onValidateScenario?.(activeLevelScenario.id, summary);
              }}
              onHighlightLeg={onHoverLeg}
              variant="panel"
            />

            {solvableAlt && (
              <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/35 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>رفع خودکار تعارض</span>
                </div>
                <button
                  onClick={() => onPatternChange(solvableAlt)}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  تغییر به {PATTERN_LABELS_FA[solvableAlt]}
                </button>
              </div>
            )}

            {activeLevelScenario.rulesResults.map(rule => (
              <div
                key={rule.ruleId}
                className={`p-3 rounded-lg border space-y-1 ${
                  rule.passed
                    ? 'bg-slate-900/50 border-slate-800'
                    : rule.type === 'HARD'
                    ? 'bg-rose-950/25 border-rose-500/40'
                    : 'bg-amber-950/20 border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    {rule.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : rule.type === 'HARD' ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{rule.nameFa}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">{rule.score}%</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pr-5">{rule.messageFa}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-slate-800 bg-[#0b1120] flex items-center gap-2 shrink-0">
        {currentDrill ? (
          <button
            onClick={() => onJumpToBreadcrumb(drillStack.length - 2)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>بازگشت به سطح قبلی ({currentDrill.parentTimeframe})</span>
          </button>
        ) : (
          <button
            onClick={onBackToStep2}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به ویرایش سناریوهای کلان (مرحله ۲)</span>
          </button>
        )}
      </div>
    </div>
  );
};
