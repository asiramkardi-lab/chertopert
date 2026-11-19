/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TradingView Pro Style Candlestick Chart with Multi-Scenario Color Overlays,
 * Drag & Drop Vertices, Inline Rename/Delete, Add/Draw-From-Scratch Modes,
 * Absolute Bottom Anchor Picker, Parent Window Highlight, and Double-Click Drill-Down.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Candle, WaveScenario, WaveVertex, PatternFamily, WaveRole, FibonacciExtensionLayer, RuleValidationItem } from '../types/elliott';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import { PATTERN_LABELS_FA, RulesEngine, ValidationSummary } from '../engine/rulesEngine';
import { TargetProjectionEngine } from '../engine/targetProjectionEngine';
import { TrendStrengthIndicator, TrendSignalLevel } from '../engine/trendStrengthIndicator';
import { guardManualVertexEdit } from '../engine/waveToleranceLayer';
import { RuleDiagnosticsPanel } from './RuleDiagnosticsPanel';
import { PatternValidator } from './PatternValidator';
import { RuleViolationToast, ActiveViolationToast, ValidWaveSnapshot } from './RuleViolationToast';
import {
  Lock,
  Unlock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Move,
  Plus,
  PenTool,
  Crosshair,
  Trash2,
  Edit3,
  Layers,
  Anchor,
  X,
  GitBranch,
  ChevronLeft,
  CornerDownLeft,
  ShieldCheck,
  Activity,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export type ChartInteractionMode = 'EDIT' | 'ADD_VERTEX' | 'DRAW_SCRATCH' | 'PICK_BOTTOM';

const TF_HIERARCHY = ['1M', '1W', '1D', '4H', '1H', '15M'];

export interface DrillTrailItem {
  label: string;
  timeframe: string;
}

interface ChartStudioProps {
  candles: Candle[];
  activeScenario: WaveScenario;
  overlayScenarios?: WaveScenario[];
  onUpdateVertices: (newVertices: WaveVertex[]) => void;
  onPatternChange: (newPattern: PatternFamily) => void;
  onToggleLock: () => void;
  onResetToAI: () => void;
  timeframe: string;
  assetSymbol: string;
  interactionMode?: ChartInteractionMode;
  onChangeInteractionMode?: (mode: ChartInteractionMode) => void;
  absoluteBottom?: WaveVertex | null;
  onUpdateAbsoluteBottom?: (v: WaveVertex) => void;
  onDoubleClickWaveLeg?: (legIndex: number) => void;
  parentWindowHighlight?: { startTs: number; endTs: number; label: string } | null;
  onStartScratchDraw?: () => void;
  hideToolbarLockAndReset?: boolean;
  lowestValidTimeframe?: string;
  validTimeframes?: string[];
  drillTrail?: DrillTrailItem[];
  onJumpDrillLevel?: (levelIndex: number) => void;
  onSwitchDrillTimeframe?: (tf: string) => void;
  hoveredScenario?: WaveScenario | null;
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onValidateActiveScenario?: (scenarioId: string, summary: ValidationSummary) => void;
  showPRZ?: boolean;
  onToggleShowPRZ?: () => void;
  showTMV?: boolean;
  onToggleShowTMV?: () => void;
  hideZoneControls?: boolean;
  highlightedLegIndex?: number | null;
}

const QUICK_LABELS = ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C', 'D', 'E', 'W', 'X', 'Y'];

export const ChartStudio: React.FC<ChartStudioProps> = ({
  candles,
  activeScenario,
  overlayScenarios = [],
  onUpdateVertices,
  onPatternChange,
  onToggleLock,
  onResetToAI,
  timeframe,
  assetSymbol,
  interactionMode = 'EDIT',
  onChangeInteractionMode,
  absoluteBottom,
  onUpdateAbsoluteBottom,
  onDoubleClickWaveLeg,
  parentWindowHighlight,
  onStartScratchDraw,
  hideToolbarLockAndReset = false,
  lowestValidTimeframe,
  validTimeframes,
  drillTrail,
  onJumpDrillLevel,
  onSwitchDrillTimeframe,
  hoveredScenario = null,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onValidateActiveScenario,
  showPRZ: controlledShowPRZ,
  onToggleShowPRZ,
  showTMV: controlledShowTMV,
  onToggleShowTMV,
  hideZoneControls = false,
  highlightedLegIndex = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef<boolean>(false);
  const frozenBoundsRef = useRef<{ minPrice: number; priceRange: number } | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [draggingBottom, setDraggingBottom] = useState<boolean>(false);
  const [dragMoved, setDragMoved] = useState<boolean>(false);
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);
  const [hoveredLeg, setHoveredLeg] = useState<number | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState<string>('');
  const [showTargets, setShowTargets] = useState<boolean>(true);
  const [showFibLayers, setShowFibLayers] = useState<boolean>(true);
  const [hoveredExtLayerId, setHoveredExtLayerId] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [internalShowPRZ, setInternalShowPRZ] = useState<boolean>(true);
  const [internalShowTMV, setInternalShowTMV] = useState<boolean>(true);
  const [showExpectedPath, setShowExpectedPath] = useState<boolean>(true);
  const [tmvSpanMode, setTmvSpanMode] = useState<'COMPACT' | 'ANALYSIS' | 'FULL'>('ANALYSIS');
  const [tmvCustomRatio, setTmvCustomRatio] = useState<number | null>(null);
  const [draggingTmvEdge, setDraggingTmvEdge] = useState<boolean>(false);
  const [priceZoom, setPriceZoom] = useState<number>(1);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showTrendStrength, setShowTrendStrength] = useState<boolean>(true);
  const [snapToCandleExtreme, setSnapToCandleExtreme] = useState<boolean>(true);
  const [ruleGuardEnabled, setRuleGuardEnabled] = useState<boolean>(true);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [drillNotice, setDrillNotice] = useState<string | null>(null);
  const [diagnosticOpenById, setDiagnosticOpenById] = useState<Record<string, boolean>>({});
  const [diagnosticSummaryById, setDiagnosticSummaryById] = useState<Record<string, ValidationSummary>>({});
  const [validatorOpenById, setValidatorOpenById] = useState<Record<string, boolean>>({});
  const [validatorHighlightLeg, setValidatorHighlightLeg] = useState<number | null>(null);
  const [violationToast, setViolationToast] = useState<ActiveViolationToast | null>(null);
  const [revertedToastMsg, setRevertedToastMsg] = useState<string | null>(null);
  const validSnapshotByKeyRef = useRef<Record<string, ValidWaveSnapshot>>({});
  const preEditFallbackByKeyRef = useRef<Record<string, ValidWaveSnapshot>>({});
  const prevWaveTrackRef = useRef<{
    key: string;
    geomSig: string;
    hadHardFail: boolean;
    vertices: WaveVertex[];
    patternType: PatternFamily;
    validityScore: number;
  } | null>(null);
  const suppressNextViolationToastRef = useRef<boolean>(false);

  const effectiveShowPRZ = !hideZoneControls && (controlledShowPRZ ?? internalShowPRZ);
  const effectiveShowTMV = !hideZoneControls && (controlledShowTMV ?? internalShowTMV);
  const effectiveShowFibLayers = !hideZoneControls && showFibLayers;
  const togglePRZ = () => {
    if (onToggleShowPRZ) onToggleShowPRZ();
    else setInternalShowPRZ(p => !p);
  };
  const toggleTMV = () => {
    if (onToggleShowTMV) onToggleShowTMV();
    else setInternalShowTMV(p => !p);
  };

  const diagnosticOpen = Boolean(diagnosticOpenById[activeScenario.id]);
  const diagnosticSummary = diagnosticSummaryById[activeScenario.id] || null;
  const validatorOpen = Boolean(validatorOpenById[activeScenario.id]);

  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  useEffect(() => {
    let rafId = 0;
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextW = Math.max(360, Math.round(rect.width || containerRef.current.clientWidth));
      const nextH = Math.max(300, Math.round(rect.height || containerRef.current.clientHeight));
      if (nextW > 0 && nextH > 0) {
        setDimensions(prev => (prev.width === nextW && prev.height === nextH ? prev : { width: nextW, height: nextH }));
      }
    };
    const updateSize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [candles.length > 0, showVolume]);

  // Reset selected vertex popover, hovered leg & custom TMV width when active scenario, timeframe, or mode changes
  useEffect(() => {
    setSelectedVertexIndex(null);
    setHoveredLeg(null);
    setHoveredExtLayerId(null);
    setHoveredZoneId(null);
    setDrillNotice(null);
    setTmvCustomRatio(null);
    dragMovedRef.current = false;
    setDragMoved(false);
  }, [activeScenario.id, interactionMode, timeframe]);

  // Reset open states when timeframe changes
  useEffect(() => {
    setDiagnosticOpenById({});
    setDiagnosticSummaryById({});
    setValidatorOpenById({});
    setValidatorHighlightLeg(null);
  }, [timeframe]);

  // Keep active scenario's open diagnostic summary live whenever vertices or pattern change
  useEffect(() => {
    if (!diagnosticOpen) return;
    const liveSummary = RulesEngine.validateStructure(
      activeScenario.patternType,
      activeScenario.vertices,
      activeScenario.direction,
      parentRole,
      parentWaveLabel,
      candles
    );
    setDiagnosticSummaryById(prev => ({ ...prev, [activeScenario.id]: liveSummary }));
  }, [
    diagnosticOpen,
    activeScenario.id,
    activeScenario.patternType,
    activeScenario.vertices,
    activeScenario.direction,
    parentRole,
    parentWaveLabel,
    candles
  ]);

  // Real-time Elliott Core Rule Violation Toast & Last-Valid Snapshot Tracker
  const scenarioToastKey = `${timeframe}::${parentWaveLabel || 'ROOT'}::${activeScenario.id}`;

  useEffect(() => {
    if (hideZoneControls) {
      setViolationToast(null);
      prevWaveTrackRef.current = null;
      return;
    }

    const verts = activeScenario.vertices;
    const summary = RulesEngine.validateStructure(
      activeScenario.patternType,
      verts,
      activeScenario.direction,
      parentRole,
      parentWaveLabel,
      candles
    );

    const hardFails: RuleValidationItem[] = summary.rules.filter(r => r.type === 'HARD' && !r.passed);
    if (verts.length >= 2) {
      for (let i = 1; i < verts.length; i++) {
        if (verts[i].candleIndex <= verts[i - 1].candleIndex) {
          hardFails.unshift({
            ruleId: 'CHRONOLOGY_ORDER',
            name: 'Chronological Pivot Order',
            nameFa: `ترتیب زمانی پیوت‌ها (${verts[i - 1].label} ← ${verts[i].label})`,
            type: 'HARD',
            passed: false,
            score: 0,
            conceptId: 'C06',
            messageFa: `نقطه ${verts[i].label} (کندل #${verts[i].candleIndex + 1}) باید بعد از نقطه ${verts[i - 1].label} (کندل #${verts[i - 1].candleIndex + 1}) قرار بگیرد.`
          });
          break;
        }
      }
    }

    const curGeomSig = `${activeScenario.patternType}::${verts
      .map(v => `${v.label}@${v.candleIndex}:${v.price}`)
      .join('|')}`;
    const hadHardFail = hardFails.length > 0;
    const cloneVerts = (list: WaveVertex[]) => list.map(v => ({ ...v }));
    const prev = prevWaveTrackRef.current;

    // Initial mount or switched scenario/timeframe: seed snapshots quietly without firing toast
    if (!prev || prev.key !== scenarioToastKey) {
      setViolationToast(null);
      if (!hadHardFail && verts.length >= 2) {
        validSnapshotByKeyRef.current[scenarioToastKey] = {
          vertices: cloneVerts(verts),
          patternType: activeScenario.patternType,
          validityScore: summary.validityScore,
          capturedAt: Date.now()
        };
      }
      preEditFallbackByKeyRef.current[scenarioToastKey] = {
        vertices: cloneVerts(verts),
        patternType: activeScenario.patternType,
        validityScore: summary.validityScore,
        capturedAt: Date.now()
      };
      prevWaveTrackRef.current = {
        key: scenarioToastKey,
        geomSig: curGeomSig,
        hadHardFail,
        vertices: cloneVerts(verts),
        patternType: activeScenario.patternType,
        validityScore: summary.validityScore
      };
      return;
    }

    // Geometry unchanged (e.g. only draggingVertexIndex changed on mouseup): update drag state on toast
    if (prev.geomSig === curGeomSig) {
      setViolationToast(curr =>
        curr && curr.scenarioId === activeScenario.id
          ? { ...curr, isDragging: draggingVertexIndex !== null }
          : curr
      );
      return;
    }

    // Geometry or pattern changed on the active scenario!
    if (suppressNextViolationToastRef.current) {
      suppressNextViolationToastRef.current = false;
      if (!hadHardFail && verts.length >= 2) {
        validSnapshotByKeyRef.current[scenarioToastKey] = {
          vertices: cloneVerts(verts),
          patternType: activeScenario.patternType,
          validityScore: summary.validityScore,
          capturedAt: Date.now()
        };
      }
      prevWaveTrackRef.current = {
        key: scenarioToastKey,
        geomSig: curGeomSig,
        hadHardFail,
        vertices: cloneVerts(verts),
        patternType: activeScenario.patternType,
        validityScore: summary.validityScore
      };
      return;
    }

    if (!hadHardFail) {
      // Valid edit or resolved violation: refresh last valid snapshot & clear violation toast
      if (verts.length >= 2) {
        validSnapshotByKeyRef.current[scenarioToastKey] = {
          vertices: cloneVerts(verts),
          patternType: activeScenario.patternType,
          validityScore: summary.validityScore,
          capturedAt: Date.now()
        };
      }
      preEditFallbackByKeyRef.current[scenarioToastKey] = {
        vertices: cloneVerts(verts),
        patternType: activeScenario.patternType,
        validityScore: summary.validityScore,
        capturedAt: Date.now()
      };
      setViolationToast(null);
    } else {
      // Violation detected! Preserve prior valid snapshot before updating tracker
      if (!prev.hadHardFail && prev.vertices.length >= 2) {
        validSnapshotByKeyRef.current[scenarioToastKey] = {
          vertices: cloneVerts(prev.vertices),
          patternType: prev.patternType,
          validityScore: prev.validityScore,
          capturedAt: Date.now()
        };
      }
      if (!prev.hadHardFail || !preEditFallbackByKeyRef.current[scenarioToastKey]) {
        preEditFallbackByKeyRef.current[scenarioToastKey] = {
          vertices: cloneVerts(prev.vertices),
          patternType: prev.patternType,
          validityScore: prev.validityScore,
          capturedAt: Date.now()
        };
      }

      const skipInitialScratchPoint = interactionMode === 'DRAW_SCRATCH' && verts.length < 2;
      if (!skipInitialScratchPoint) {
        const validSnap = validSnapshotByKeyRef.current[scenarioToastKey];
        const fallbackSnap = preEditFallbackByKeyRef.current[scenarioToastKey];
        const activeSnap = validSnap || fallbackSnap;
        const snapshotSummaryFa = activeSnap
          ? `${activeSnap.vertices.length} نقطه${validSnap ? ` · اعتبار ${activeSnap.validityScore}٪` : ''}`
          : '';

        setRevertedToastMsg(null);
        setViolationToast(curr => ({
          id: curr && curr.scenarioId === activeScenario.id ? curr.id : `viol_${Date.now()}`,
          scenarioId: activeScenario.id,
          scenarioName: activeScenario.name,
          violatedRules: hardFails,
          hasValidSnapshot: Boolean(validSnap),
          snapshotSummaryFa,
          triggeredAt: Date.now(),
          isDragging: draggingVertexIndex !== null
        }));
      }
    }

    prevWaveTrackRef.current = {
      key: scenarioToastKey,
      geomSig: curGeomSig,
      hadHardFail,
      vertices: cloneVerts(verts),
      patternType: activeScenario.patternType,
      validityScore: summary.validityScore
    };
  }, [
    hideZoneControls,
    scenarioToastKey,
    activeScenario.id,
    activeScenario.name,
    activeScenario.patternType,
    activeScenario.vertices,
    activeScenario.direction,
    parentRole,
    parentWaveLabel,
    interactionMode,
    draggingVertexIndex
  ]);

  const handleRevertToLastValidState = () => {
    const targetSnap =
      validSnapshotByKeyRef.current[scenarioToastKey] ||
      preEditFallbackByKeyRef.current[scenarioToastKey];
    if (!targetSnap) return;

    const restoredVerts = targetSnap.vertices.map(v => ({ ...v }));
    suppressNextViolationToastRef.current = true;
    setViolationToast(null);
    onUpdateVertices(restoredVerts);
    if (targetSnap.patternType !== activeScenario.patternType) {
      onPatternChange(targetSnap.patternType);
    }
    setRevertedToastMsg(
      validSnapshotByKeyRef.current[scenarioToastKey]
        ? 'موج‌شماری به آخرین حالت معتبر بازگردانی شد ✓'
        : 'تغییرات به وضعیت قبلی بازگردانی شد ✓'
    );
  };

  useEffect(() => {
    if (!revertedToastMsg) return;
    const t = window.setTimeout(() => setRevertedToastMsg(null), 2400);
    return () => window.clearTimeout(t);
  }, [revertedToastMsg]);

  const evaluateCurrentCount = () => {
    if ((interactionMode === 'DRAW_SCRATCH' || interactionMode === 'ADD_VERTEX') && onChangeInteractionMode) {
      onChangeInteractionMode('EDIT');
    }
    const summary = RulesEngine.validateStructure(
      activeScenario.patternType,
      activeScenario.vertices,
      activeScenario.direction,
      parentRole,
      parentWaveLabel,
      candles
    );
    setDiagnosticSummaryById(prev => ({ ...prev, [activeScenario.id]: summary }));
    setDiagnosticOpenById(prev => ({ ...prev, [activeScenario.id]: true }));
    onValidateActiveScenario?.(activeScenario.id, summary);
  };

  const activeHardFailsCount = activeScenario.rulesResults.filter(r => r.type === 'HARD' && !r.passed).length;
  const isUserModifiedCount = activeScenario.source === 'USER_EDITED' || activeScenario.source === 'MANUAL_DRAW';

  // Compute next valid lower timeframe for Fractal Drill-Down
  const nextLowerValidTF = useMemo(() => {
    const currentIdx = TF_HIERARCHY.indexOf(timeframe);
    const lowestIdx = lowestValidTimeframe ? TF_HIERARCHY.indexOf(lowestValidTimeframe) : TF_HIERARCHY.length - 1;
    if (currentIdx === -1 || currentIdx >= lowestIdx) return null;
    if (validTimeframes && validTimeframes.length > 0) {
      return TF_HIERARCHY.slice(currentIdx + 1, lowestIdx + 1).find(tf => validTimeframes.includes(tf)) || null;
    }
    return TF_HIERARCHY[currentIdx + 1] || null;
  }, [timeframe, lowestValidTimeframe, validTimeframes]);

  const triggerDrillDown = (legIndex: number) => {
    if (!onDoubleClickWaveLeg) return;
    if (!nextLowerValidTF && lowestValidTimeframe) {
      setDrillNotice(`تایم‌فریم ${lowestValidTimeframe} پایین‌ترین تایم‌فریم معتبر این نماد است.`);
      return;
    }
    setDrillNotice(null);
    onDoubleClickWaveLeg(legIndex);
  };

  const { width, height } = dimensions;
  const padding = { top: 48, right: 86, bottom: showVolume ? 74 : 40, left: 22 };
  const volumeHeight = showVolume ? 58 : 0;

  // Dynamic completed-structure Fibonacci extensions, PRZ, TMV & Targets via TargetProjectionEngine
  const projectionReport = useMemo(() => {
    if (hideZoneControls || activeScenario.vertices.length < 2) return null;
    return TargetProjectionEngine.projectScenario(activeScenario, candles, parentRole, parentWaveLabel);
  }, [hideZoneControls, activeScenario, candles, parentRole, parentWaveLabel]);

  // RSI Divergence & Volume-Weighted Momentum per segment and vertex via TrendStrengthIndicator
  const trendStrengthReport = useMemo(() => {
    return TrendStrengthIndicator.analyzeScenario(activeScenario, candles);
  }, [activeScenario, candles]);

  const maxPlotIndex = Math.max(1, candles.length - 1);

  // Price bounds including overlays, bounded PRZ/targets, and absolute bottom
  const { minPrice, maxPrice, priceRange, maxVolume } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100, maxVolume: 1000 };
    let candleMin = Infinity;
    let candleMax = -Infinity;
    let maxVol = 0;

    candles.forEach(c => {
      if (c.low < candleMin) candleMin = c.low;
      if (c.high > candleMax) candleMax = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    let min = candleMin;
    let max = candleMax;
    const candleSpan = Math.max(1, candleMax - candleMin);
    const guardLow = candleMin - candleSpan * 0.55;
    const guardHigh = candleMax + candleSpan * 0.55;
    const przGuardLow = candleMin - candleSpan * 0.75;
    const przGuardHigh = candleMax + candleSpan * 0.75;

    activeScenario.vertices.forEach(v => {
      if (v.price < min) min = v.price;
      if (v.price > max) max = v.price;
    });
    if (showTargets && !hideZoneControls) {
      const targetPool = projectionReport?.targets.length ? projectionReport.targets : activeScenario.targets;
      targetPool.forEach(t => {
        if (t.price >= guardLow && t.price <= guardHigh) {
          if (t.price < min) min = t.price;
          if (t.price > max) max = t.price;
        }
      });
    }
    if (effectiveShowFibLayers && projectionReport?.extensionLayers) {
      projectionReport.extensionLayers.forEach(layer => {
        if (layer.bandLow >= guardLow && layer.bandHigh <= guardHigh) {
          if (layer.bandLow < min) min = layer.bandLow;
          if (layer.bandHigh > max) max = layer.bandHigh;
        }
      });
    }
    if (effectiveShowPRZ && projectionReport) {
      projectionReport.przZones.forEach(z => {
        if (z.highPrice >= przGuardLow && z.lowPrice <= przGuardHigh) {
          const clampedLow = Math.max(przGuardLow, z.lowPrice);
          const clampedHigh = Math.min(przGuardHigh, z.highPrice);
          if (clampedLow < min) min = clampedLow;
          if (clampedHigh > max) max = clampedHigh;
        }
      });
    }
    if (effectiveShowTMV && projectionReport) {
      const tmvGuardLow = candleMin - candleSpan * 0.95;
      const tmvGuardHigh = candleMax + candleSpan * 0.95;
      projectionReport.tmvZones.forEach(z => {
        const prices = [z.lowPrice, z.highPrice, ...(z.targetPrices?.map(tp => tp.price) || [])];
        prices.forEach(p => {
          if (p >= tmvGuardLow && p <= tmvGuardHigh) {
            if (p < min) min = p;
            if (p > max) max = p;
          }
        });
      });
    }
    if (absoluteBottom) {
      if (absoluteBottom.price < min) min = absoluteBottom.price;
      if (absoluteBottom.price > max) max = absoluteBottom.price;
    }

    const baseRange = Math.max(1, max - min);
    const mid = (max + min) / 2;
    const zoomedRange = baseRange / Math.max(0.5, Math.min(2.5, priceZoom));
    const zoomedMin = mid - zoomedRange / 2;
    const zoomedMax = mid + zoomedRange / 2;
    return {
      minPrice: Math.max(0, zoomedMin - zoomedRange * 0.06),
      maxPrice: zoomedMax + zoomedRange * 0.09,
      priceRange: zoomedRange * 1.15,
      maxVolume: maxVol || 1
    };
  }, [candles, activeScenario, showTargets, hideZoneControls, effectiveShowPRZ, effectiveShowTMV, effectiveShowFibLayers, projectionReport, absoluteBottom, priceZoom]);

  const getX = (index: number) => {
    const usableWidth = width - padding.left - padding.right;
    const step = usableWidth / Math.max(1, maxPlotIndex);
    return padding.left + index * step;
  };

  const getY = (price: number) => {
    const usableHeight = height - padding.top - padding.bottom - volumeHeight;
    const normalized = (price - minPrice) / priceRange;
    return height - padding.bottom - volumeHeight - normalized * usableHeight;
  };

  const getIndexAndPriceFromCoords = (mouseX: number, mouseY: number, forceLowSnap = false) => {
    const usableWidth = width - padding.left - padding.right;
    const step = usableWidth / Math.max(1, maxPlotIndex);
    const rawIndex = Math.round((mouseX - padding.left) / step);
    const candleIndex = Math.max(0, Math.min(candles.length - 1, rawIndex));
    const usableHeight = Math.max(1, height - padding.top - padding.bottom - volumeHeight);
    const bounds = frozenBoundsRef.current || { minPrice, priceRange };
    const normalized = (height - padding.bottom - volumeHeight - mouseY) / usableHeight;
    const rawPrice = Math.round((bounds.minPrice + normalized * bounds.priceRange) * 10) / 10;

    const candle = candles[candleIndex];
    let finalPrice = rawPrice;
    if (candle && (snapToCandleExtreme || forceLowSnap)) {
      if (forceLowSnap) {
        finalPrice = candle.low;
      } else {
        // Snap strictly to the candle's high or low so vertices stay anchored to candles rather than empty coordinate space
        const distHigh = Math.abs(rawPrice - candle.high);
        const distLow = Math.abs(rawPrice - candle.low);
        finalPrice = distHigh <= distLow ? candle.high : candle.low;
      }
    }

    return {
      candleIndex,
      price: finalPrice,
      timestamp: candle?.timestamp ?? Date.now()
    };
  };

  const getSvgCoords = (e: React.MouseEvent | MouseEvent) => {
    if (svgRef.current) {
      const ctm = svgRef.current.getScreenCTM();
      if (ctm) {
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPt = pt.matrixTransform(ctm.inverse());
        return { mouseX: svgPt.x, mouseY: svgPt.y };
      }
    }
    if (!containerRef.current) return { mouseX: 0, mouseY: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width > 0 ? width / rect.width : 1;
    const scaleY = rect.height > 0 ? height / rect.height : 1;
    return {
      mouseX: (e.clientX - rect.left) * scaleX,
      mouseY: (e.clientY - rect.top) * scaleY
    };
  };

  const handleVertexMouseDown = (index: number, e: React.MouseEvent) => {
    if (interactionMode !== 'EDIT') return;
    e.preventDefault();
    e.stopPropagation();
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    frozenBoundsRef.current = { minPrice, priceRange };
    dragMovedRef.current = false;
    setDraggingVertexIndex(index);
    setDragMoved(false);
  };

  const handleBottomMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (interactionMode === 'PICK_BOTTOM' || onUpdateAbsoluteBottom) {
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      frozenBoundsRef.current = { minPrice, priceRange };
      dragMovedRef.current = false;
      setDraggingBottom(true);
      setDragMoved(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return;
    const { mouseX, mouseY } = getSvgCoords(e);
    setMousePos({ x: mouseX, y: mouseY });

    if (draggingTmvEdge) {
      const endX = width - padding.right;
      const plotW = Math.max(1, endX - padding.left);
      const clampedX = Math.max(padding.left, Math.min(endX - 72, mouseX));
      const ratio = Math.max(0.12, Math.min(1, (endX - clampedX) / plotW));
      setTmvCustomRatio(ratio);
      return;
    }

    const dist = dragStartPosRef.current
      ? Math.hypot(e.clientX - dragStartPosRef.current.x, e.clientY - dragStartPosRef.current.y)
      : 0;

    if (draggingBottom && onUpdateAbsoluteBottom) {
      if (dist < 4 && !dragMovedRef.current) return;
      dragMovedRef.current = true;
      setDragMoved(true);
      const { candleIndex, price, timestamp } = getIndexAndPriceFromCoords(mouseX, mouseY, true);
      onUpdateAbsoluteBottom({
        label: '0 (کف مطلق)',
        candleIndex,
        price,
        timestamp,
        isConfirmed: true
      });
      return;
    }

    if (draggingVertexIndex === null || activeScenario.isLocked) return;
    if (dist < 4 && !dragMovedRef.current) return;
    dragMovedRef.current = true;
    setDragMoved(true);

    const { candleIndex, price, timestamp } = getIndexAndPriceFromCoords(mouseX, mouseY);
    const guarded = ruleGuardEnabled
      ? guardManualVertexEdit(
          activeScenario.patternType,
          activeScenario.vertices,
          draggingVertexIndex,
          candleIndex,
          price,
          activeScenario.direction,
          candles
        )
      : { candleIndex, price, timestamp, clampedByRules: [] };

    const updated = activeScenario.vertices.map((v, i) =>
      i === draggingVertexIndex
        ? {
            ...v,
            candleIndex: guarded.candleIndex,
            price: guarded.price,
            timestamp: guarded.timestamp
          }
        : v
    );
    onUpdateVertices(updated);
  };

  const handleMouseUp = () => {
    if (draggingVertexIndex !== null && !dragMovedRef.current) {
      setSelectedVertexIndex(prev => (prev === draggingVertexIndex ? null : draggingVertexIndex));
      setCustomLabelInput(activeScenario.vertices[draggingVertexIndex]?.label || '');
    }
    setDraggingVertexIndex(null);
    setDraggingBottom(false);
    setDraggingTmvEdge(false);
    dragStartPosRef.current = null;
    frozenBoundsRef.current = null;
  };

  const mouseMoveRef = useRef(handleMouseMove);
  const mouseUpRef = useRef(handleMouseUp);
  mouseMoveRef.current = handleMouseMove;
  mouseUpRef.current = handleMouseUp;

  useEffect(() => {
    if (draggingVertexIndex === null && !draggingBottom && !draggingTmvEdge) return;
    const onWinMove = (ev: MouseEvent) => mouseMoveRef.current(ev);
    const onWinUp = () => mouseUpRef.current();
    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
    return () => {
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('mouseup', onWinUp);
    };
  }, [draggingVertexIndex, draggingBottom, draggingTmvEdge]);

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    if (dragMovedRef.current || dragMoved) {
      dragMovedRef.current = false;
      setDragMoved(false);
      return;
    }

    const { mouseX, mouseY } = getSvgCoords(e);

    if (
      mouseX < padding.left ||
      mouseX > width - padding.right ||
      mouseY < padding.top ||
      mouseY > height - padding.bottom
    ) {
      setSelectedVertexIndex(null);
      return;
    }

    if (interactionMode === 'PICK_BOTTOM' && onUpdateAbsoluteBottom) {
      const { candleIndex, price, timestamp } = getIndexAndPriceFromCoords(mouseX, mouseY, true);
      onUpdateAbsoluteBottom({
        label: '0 (کف مطلق)',
        candleIndex,
        price,
        timestamp,
        isConfirmed: true
      });
      return;
    }

    if (activeScenario.isLocked) {
      setSelectedVertexIndex(null);
      return;
    }

    if (interactionMode === 'ADD_VERTEX' || interactionMode === 'DRAW_SCRATCH') {
      const { candleIndex, price, timestamp } = getIndexAndPriceFromCoords(mouseX, mouseY);
      const current = [...activeScenario.vertices];
      const nextIdx = current.length;
      const defaultLabels = ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C', 'D', 'E'];
      const nextLabel = defaultLabels[nextIdx] || `W${nextIdx}`;

      const rawVertex: WaveVertex = {
        label: nextLabel,
        candleIndex,
        price,
        timestamp,
        isConfirmed: true
      };

      const tentative = [...current, rawVertex].sort((a, b) => a.candleIndex - b.candleIndex);
      const insertedIdx = tentative.indexOf(rawVertex);
      const guarded =
        ruleGuardEnabled && insertedIdx >= 0
          ? guardManualVertexEdit(
              activeScenario.patternType,
              tentative,
              insertedIdx,
              rawVertex.candleIndex,
              rawVertex.price,
              activeScenario.direction,
              candles
            )
          : null;

      const nextList = tentative.map((v, idx) =>
        guarded && idx === insertedIdx
          ? { ...v, candleIndex: guarded.candleIndex, price: guarded.price, timestamp: guarded.timestamp }
          : v
      );

      onUpdateVertices(nextList);
      return;
    }

    setSelectedVertexIndex(null);
  };

  const handleRenameVertex = (idx: number, newLabel: string) => {
    if (!newLabel.trim() || activeScenario.isLocked) return;
    const updated = activeScenario.vertices.map((v, i) => (i === idx ? { ...v, label: newLabel.trim() } : v));
    onUpdateVertices(updated);
    setCustomLabelInput(newLabel.trim());
  };

  const handleDeleteVertex = (idx: number) => {
    if (activeScenario.isLocked || activeScenario.vertices.length === 0) return;
    const updated = activeScenario.vertices.filter((_, i) => i !== idx);
    onUpdateVertices(updated);
    setSelectedVertexIndex(null);
  };

  const degreeInfo = DEGREE_CONFIGS[activeScenario.degree];
  const scenarioColor = activeScenario.color || degreeInfo.color;

  const activeHoveredScenario = useMemo(() => {
    if (!hoveredScenario || hoveredScenario.timeframe !== timeframe || hoveredScenario.vertices.length < 2) {
      return null;
    }
    return hoveredScenario;
  }, [hoveredScenario, timeframe]);

  const hoveredTraceData = useMemo(() => {
    if (!activeHoveredScenario || candles.length === 0) return null;
    const maxIdx = candles.length - 1;
    const pts = activeHoveredScenario.vertices.map(v => {
      const clampedIdx = Math.max(0, Math.min(maxIdx, v.candleIndex));
      return {
        x: getX(clampedIdx),
        y: getY(v.price),
        label: v.label,
        price: v.price
      };
    });
    if (pts.length < 2) return null;

    let totalLength = 0;
    const segments: { x1: number; y1: number; x2: number; y2: number; length: number; cumStart: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segments.push({
        x1: pts[i].x,
        y1: pts[i].y,
        x2: pts[i + 1].x,
        y2: pts[i + 1].y,
        length: len,
        cumStart: totalLength
      });
      totalLength += len;
    }

    const pathD = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const color = activeHoveredScenario.color || DEGREE_CONFIGS[activeHoveredScenario.degree].color || '#38bdf8';

    return {
      scenario: activeHoveredScenario,
      color,
      pts,
      segments,
      pathD,
      totalLength: Math.max(1, Math.ceil(totalLength))
    };
  }, [activeHoveredScenario, candles.length, width, height, minPrice, priceRange, showVolume]);

  // Scale-adaptive & Timeframe-Synchronized PRZ Horizontal Bounding Box coordinates
  const renderedPrzBoxes = useMemo(() => {
    if (!effectiveShowPRZ || !projectionReport || projectionReport.przZones.length === 0 || candles.length === 0) {
      return [];
    }
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom - volumeHeight;
    const endX = width - padding.right;
    const usableW = Math.max(1, endX - padding.left);
    const usableH = Math.max(1, plotBottom - plotTop);
    const maxIdx = Math.max(1, candles.length - 1);
    const xAt = (idx: number) => padding.left + (idx / maxIdx) * usableW;
    const yAt = (price: number) => plotBottom - ((price - minPrice) / Math.max(1e-6, priceRange)) * usableH;

    // Calibrate minimum horizontal projection horizon by active timeframe
    const tfMinShareMap: Record<string, number> = {
      '1M': 0.24,
      '1W': 0.28,
      '1D': 0.34,
      '4H': 0.4,
      '1H': 0.46,
      '15M': 0.52
    };
    const tfMinShare = tfMinShareMap[timeframe] ?? 0.34;
    const minTfBandW = Math.min(usableW, Math.max(140, usableW * tfMinShare));

    const verts = activeScenario.vertices;
    const prevV = verts.length >= 2 ? verts[verts.length - 2] : verts[0];
    const lastV = verts[verts.length - 1];
    const lastWaveStartIdx = prevV ? Math.min(prevV.candleIndex, lastV?.candleIndex ?? prevV.candleIndex) : 0;
    const lastWaveEndIdx = Math.max(maxIdx, lastV?.candleIndex ?? maxIdx);

    return projectionReport.przZones
      .map(prz => {
        const hi = Math.max(prz.lowPrice, prz.highPrice);
        const lo = Math.min(prz.lowPrice, prz.highPrice);
        const rawYTop = yAt(hi);
        const rawYBot = yAt(lo);
        if (rawYBot < plotTop || rawYTop > plotBottom) return null;

        const yTop = Math.max(plotTop, Math.min(plotBottom - 16, rawYTop));
        const yBot = Math.min(plotBottom, Math.max(yTop + 16, rawYBot));
        const bandH = Math.max(16, yBot - yTop);
        const yMid = Math.max(yTop + 2, Math.min(yBot - 2, yAt(prz.midPrice)));

        const sIdx = prz.isPrimary ? lastWaveStartIdx : (prz.startCandleIndex ?? prz.anchorCandleIndex ?? lastWaveStartIdx);
        const eIdx = prz.isPrimary ? lastWaveEndIdx : (prz.endCandleIndex ?? lastWaveEndIdx);
        const clampedSIdx = Math.max(0, Math.min(maxIdx, sIdx));
        const clampedEIdx = Math.max(clampedSIdx + 1, Math.min(maxIdx, eIdx));

        const rawX1 = xAt(clampedSIdx);
        const rawX2 = xAt(clampedEIdx);
        const xEnd = Math.min(endX, Math.max(padding.left + minTfBandW, Math.max(rawX1, rawX2)));
        const maxAllowedXStart = Math.max(padding.left, xEnd - minTfBandW);
        const xStart = Math.max(padding.left, Math.min(maxAllowedXStart, Math.min(rawX1, rawX2)));
        const bandW = Math.max(120, xEnd - xStart);

        const anchorVertX = lastV ? Math.max(padding.left, Math.min(endX, xAt(lastV.candleIndex))) : xStart;
        const anchorVertY = lastV ? Math.max(plotTop, Math.min(plotBottom, yAt(lastV.price))) : yMid;
        const candleSpan = Math.max(1, Math.round(clampedEIdx - clampedSIdx));
        const currentClose = candles[candles.length - 1]?.close ?? 0;
        const distPct = currentClose > 0 ? (((prz.midPrice - currentClose) / currentClose) * 100).toFixed(1) : '0.0';
        const signedDist = Number(distPct) > 0 ? `+${distPct}%` : `${distPct}%`;

        return {
          prz,
          hiPrice: hi,
          loPrice: lo,
          yTop,
          yBot,
          yMid,
          bandH,
          xStart,
          xEnd,
          bandW,
          anchorVertX,
          anchorVertY,
          candleSpan,
          signedDist
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [
    effectiveShowPRZ,
    projectionReport,
    activeScenario.vertices,
    candles,
    timeframe,
    width,
    height,
    padding.left,
    padding.right,
    padding.top,
    padding.bottom,
    volumeHeight,
    minPrice,
    priceRange,
    priceZoom
  ]);

  // Scale-adaptive TMV Horizontal Bounding Box coordinates (mirrors PRZ horizontal geometry)
  const renderedTmvBoxes = useMemo(() => {
    if (!effectiveShowTMV || !projectionReport || projectionReport.tmvZones.length === 0 || candles.length === 0) {
      return [];
    }
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom - volumeHeight;
    const endX = width - padding.right;
    const usableW = Math.max(80, endX - padding.left);
    const usableH = Math.max(1, plotBottom - plotTop);
    const maxIdx = Math.max(1, candles.length - 1);
    const xAt = (idx: number) => padding.left + (idx / maxIdx) * usableW;
    const yAt = (price: number) => plotBottom - ((price - minPrice) / Math.max(1e-6, priceRange)) * usableH;

    return projectionReport.tmvZones.map(tmv => {
      // Responsive horizontal width synchronized with Analysis Window / Mode / Custom Drag
      const xEnd = endX;
      let xStart = padding.left;
      const minHorizW = Math.min(usableW, Math.max(128, usableW * 0.24));

      if (tmvCustomRatio !== null) {
        const customW = Math.max(minHorizW, Math.min(usableW, usableW * tmvCustomRatio));
        xStart = Math.max(padding.left, xEnd - customW);
      } else if (tmvSpanMode === 'FULL') {
        xStart = padding.left;
      } else if (tmvSpanMode === 'COMPACT') {
        const anchorX = xAt(Math.max(0, Math.min(maxIdx, tmv.anchorCandleIndex ?? tmv.startCandleIndex)));
        const compactW = Math.max(minHorizW, Math.min(usableW * 0.36, Math.max(minHorizW, xEnd - anchorX + 36)));
        xStart = Math.max(padding.left, xEnd - compactW);
      } else {
        const analysisRawX1 = xAt(Math.max(0, Math.min(maxIdx, tmv.startCandleIndex)));
        const minAnalysisW = Math.max(minHorizW, usableW * 0.32);
        const maxAnalysisW = usableW * 0.74;
        const desiredW = Math.max(minAnalysisW, Math.min(maxAnalysisW, xEnd - analysisRawX1));
        xStart = Math.max(padding.left, xEnd - desiredW);
      }
      const bandW = Math.max(minHorizW, xEnd - xStart);

      const hi = Math.max(tmv.lowPrice, tmv.highPrice);
      const lo = Math.min(tmv.lowPrice, tmv.highPrice);
      const rawYTop = yAt(hi);
      const rawYBot = yAt(lo);
      const rawIdealY = yAt(tmv.ideal100Price);
      const showBand = !(rawYBot < plotTop || rawYTop > plotBottom);

      let yTop = Math.max(plotTop, Math.min(plotBottom - 18, rawYTop));
      let yBot = Math.min(plotBottom, Math.max(yTop + 18, rawYBot));

      // Enforce horizontal box proportion (bandW > bandH) centered around Ideal TMV price
      const maxAllowedH = Math.max(26, Math.min(usableH * 0.28, bandW * 0.45));
      if (yBot - yTop > maxAllowedH) {
        const centerY = Math.max(plotTop + maxAllowedH / 2, Math.min(plotBottom - maxAllowedH / 2, rawIdealY));
        yTop = Math.max(plotTop, centerY - maxAllowedH / 2);
        yBot = Math.min(plotBottom, centerY + maxAllowedH / 2);
      }
      const bandH = Math.max(18, yBot - yTop);
      const idealY = Math.max(plotTop + 2, Math.min(plotBottom - 2, rawIdealY));

      return {
        tmv,
        showBand,
        yTop,
        yBot,
        bandH,
        idealY,
        xStart,
        xEnd,
        bandW
      };
    });
  }, [
    effectiveShowTMV,
    projectionReport,
    candles.length,
    width,
    height,
    padding.left,
    padding.right,
    padding.top,
    padding.bottom,
    volumeHeight,
    minPrice,
    priceRange,
    priceZoom,
    tmvSpanMode,
    tmvCustomRatio
  ]);

  // Curved Fractal Expected Path (Flow-Path Bezier curve with confidence-proportional opacity)
  const expectedPathData = useMemo(() => {
    if (!showExpectedPath || hideZoneControls || activeScenario.vertices.length < 2 || candles.length === 0) {
      return null;
    }
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom - volumeHeight;
    const endX = width - padding.right;
    const usableW = Math.max(1, endX - padding.left);
    const usableH = Math.max(1, plotBottom - plotTop);
    const maxIdx = Math.max(1, candles.length - 1);
    const xAt = (idx: number) => padding.left + (idx / maxIdx) * usableW;
    const yAt = (price: number) => Math.max(plotTop + 8, Math.min(plotBottom - 8, plotBottom - ((price - minPrice) / Math.max(1e-6, priceRange)) * usableH));

    const verts = activeScenario.vertices;
    const lastV = verts[verts.length - 1];
    const prevV = verts[verts.length - 2];
    const cleanLast = lastV.label.replace(/[()VW\s]/g, '').toUpperCase();
    const isCycleFinished = cleanLast === '5' || cleanLast === 'C';

    const nextDir: 'BULLISH' | 'BEARISH' =
      projectionReport?.nextDirection ||
      (isCycleFinished
        ? lastV.price >= prevV.price
          ? 'BEARISH'
          : 'BULLISH'
        : lastV.price >= prevV.price
        ? 'BULLISH'
        : 'BEARISH');

    // Determine target price along expected fractal trajectory
    const primaryPrz = projectionReport?.przZones.find(z => z.isPrimary) || projectionReport?.przZones[0];
    const primaryTmv = projectionReport?.tmvZones.find(z => z.isPrimary) || projectionReport?.tmvZones[0];
    const validTargets = (projectionReport?.targets || activeScenario.targets).filter(t => !t.isInvalidation && t.price > 0);
    const dirTargets = validTargets.filter(t =>
      nextDir === 'BULLISH' ? t.price > lastV.price : t.price < lastV.price
    );

    let destPrice = lastV.price * (nextDir === 'BULLISH' ? 1.07 : 0.93);
    if (primaryTmv && ((nextDir === 'BULLISH' && primaryTmv.ideal100Price > lastV.price) || (nextDir === 'BEARISH' && primaryTmv.ideal100Price < lastV.price))) {
      destPrice = primaryTmv.ideal100Price;
    } else if (primaryPrz && ((nextDir === 'BULLISH' && primaryPrz.midPrice > lastV.price) || (nextDir === 'BEARISH' && primaryPrz.midPrice < lastV.price))) {
      destPrice = primaryPrz.midPrice;
    } else if (dirTargets.length > 0) {
      const sorted = [...dirTargets].sort((a, b) => Math.abs(a.price - lastV.price) - Math.abs(b.price - lastV.price));
      destPrice = sorted[Math.min(sorted.length - 1, 1)].price;
    }

    const startX = xAt(Math.max(0, Math.min(maxIdx, lastV.candleIndex)));
    const startY = yAt(lastV.price);
    const destY = yAt(destPrice);

    // Project horizontally toward the right plot boundary (at least 72px span)
    const availRight = Math.max(68, endX - startX - 10);
    const spanX = Math.min(availRight, Math.max(82, usableW * 0.24));
    const endPtX = Math.min(endX - 8, startX + spanX);
    const deltaY = destY - startY;

    // Select fractal subwave cadence:
    // - End of W5 / C (Bahari: no same-degree retracement -> 3-wave A-B-C next cycle start)
    // - Corrective / Triangle / Flat -> 3-wave or breakout cadence
    // - Developing Motive impulse (e.g. from W2/W4 into W3/W5) -> 5-subwave fractal impulse curve
    const isCorrectiveCadence =
      isCycleFinished ||
      parentRole === 'CORRECTIVE' ||
      ['2', '4', 'B', 'D'].includes(cleanLast) === false &&
        ['ZIGZAG', 'FLAT_REGULAR', 'FLAT_EXPANDED', 'FLAT_RUNNING', 'TRIANGLE_CONVERGING', 'TRIANGLE_EXPANDING', 'COMPLEX_COMBINATION'].includes(
          activeScenario.patternType
        );

    const rawPts: Array<{ x: number; y: number }> = isCorrectiveCadence
      ? [
          { x: startX, y: startY },
          { x: startX + spanX * 0.36, y: startY + deltaY * 0.56 },
          { x: startX + spanX * 0.64, y: startY + deltaY * 0.32 },
          { x: endPtX, y: destY }
        ]
      : [
          { x: startX, y: startY },
          { x: startX + spanX * 0.20, y: startY + deltaY * 0.24 },
          { x: startX + spanX * 0.34, y: startY + deltaY * 0.14 },
          { x: startX + spanX * 0.64, y: startY + deltaY * 0.74 },
          { x: startX + spanX * 0.79, y: startY + deltaY * 0.58 },
          { x: endPtX, y: destY }
        ];

    const clampedPts = rawPts.map(pt => ({
      x: Math.max(padding.left + 4, Math.min(endX - 6, pt.x)),
      y: Math.max(plotTop + 10, Math.min(plotBottom - 10, pt.y))
    }));

    // Convert waypoints to smooth Catmull-Rom Cubic Bezier path
    const buildSmoothBezier = (pts: Array<{ x: number; y: number }>) => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return d;
    };

    const pathD = buildSmoothBezier(clampedPts);
    const tip = clampedPts[clampedPts.length - 1];
    const prevTip = clampedPts[clampedPts.length - 2];
    const angleRad = Math.atan2(tip.y - prevTip.y, tip.x - prevTip.x);
    const arrowLen = 8.5;
    const arrowLeftX = tip.x - arrowLen * Math.cos(angleRad - Math.PI / 6);
    const arrowLeftY = tip.y - arrowLen * Math.sin(angleRad - Math.PI / 6);
    const arrowRightX = tip.x - arrowLen * Math.cos(angleRad + Math.PI / 6);
    const arrowRightY = tip.y - arrowLen * Math.sin(angleRad + Math.PI / 6);
    const arrowPath = `M ${arrowLeftX.toFixed(1)} ${arrowLeftY.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${arrowRightX.toFixed(1)} ${arrowRightY.toFixed(1)}`;

    const confidencePct = Math.max(20, Math.min(98, Math.round(activeScenario.confidenceScore || 65)));
    const coreOpacity = Math.round((0.26 + (confidencePct / 100) * 0.70) * 100) / 100;
    const haloOpacity = Math.round((0.08 + (confidencePct / 100) * 0.28) * 100) / 100;
    const strokeColor = nextDir === 'BULLISH' ? '#22d3ee' : '#f472b6';

    return {
      pathD,
      arrowPath,
      tip,
      destPrice: Math.round(destPrice),
      confidencePct,
      coreOpacity,
      haloOpacity,
      strokeColor,
      cadenceLabelFa: isCorrectiveCadence ? 'ساختار فرکتال ۳موجی' : 'ساختار فرکتال ۵موجی',
      nextDir
    };
  }, [
    showExpectedPath,
    hideZoneControls,
    activeScenario,
    projectionReport,
    parentRole,
    candles.length,
    width,
    height,
    padding.left,
    padding.right,
    padding.top,
    padding.bottom,
    volumeHeight,
    minPrice,
    priceRange,
    priceZoom
  ]);

  const gridSteps = 6;
  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (priceRange / gridSteps) * i;
      const y = getY(p);
      lines.push({ price: Math.round(p), y });
    }
    return lines;
  }, [minPrice, priceRange, height]);

  const lastCandle = candles[candles.length - 1];
  const lastPrice = lastCandle?.close || 0;
  const lastPriceY = getY(lastPrice);

  // Parent window highlight indices (for Step 3 lower-TF drill-down)
  const parentWindowBounds = useMemo(() => {
    if (!parentWindowHighlight || candles.length === 0) return null;
    let startIdx = candles.findIndex(c => c.timestamp >= parentWindowHighlight.startTs);
    if (startIdx === -1) startIdx = 0;
    let endIdx = candles.length - 1;
    for (let i = candles.length - 1; i >= 0; i--) {
      if (candles[i].timestamp <= parentWindowHighlight.endTs) {
        endIdx = i;
        break;
      }
    }
    return { startIdx, endIdx: Math.max(startIdx, endIdx) };
  }, [parentWindowHighlight, candles]);

  // Three Market Trends Classifier (Session 2.1: Impulse / Correction / Side)
  const marketTrend = useMemo(() => {
    return RulesEngine.classifyMarketTrend(candles, activeScenario.vertices);
  }, [candles, activeScenario.vertices]);

  // Floating measurement HUD info
  const hudInfo = useMemo(() => {
    const v = activeScenario.vertices;
    if (v.length < 3) return null;
    const p0 = v[0]?.price ?? 0;
    const p1 = v[1]?.price ?? 0;
    const p2 = v[2]?.price ?? 0;
    const p3 = v[3]?.price ?? 0;
    const p4 = v[4]?.price ?? 0;
    const len1 = Math.abs(p1 - p0);
    const retrace2 = Math.abs(p1 - p2);
    const r2Pct = len1 > 0 ? ((retrace2 / len1) * 100).toFixed(1) : '0';
    const len3 = Math.abs(p3 - p2);
    const w3Ratio = len1 > 0 ? (len3 / len1).toFixed(2) : '0';
    const isBull = activeScenario.direction === 'BULLISH';
    const hasOverlap = v.length >= 5 && (isBull ? p4 <= p1 : p4 >= p1);

    return { retrace2Pct: r2Pct, w3Ratio, hasOverlap };
  }, [activeScenario]);

  const selectedVertex = selectedVertexIndex !== null ? activeScenario.vertices[selectedVertexIndex] : null;

  return (
    <div
      className="flex-1 flex flex-col h-full bg-[#080d1a] border border-slate-800 rounded-xl overflow-hidden relative select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setMousePos(null);
      }}
    >
      {/* Top Pro Chart Toolbar */}
      <div className="min-h-12 bg-[#0c1427] border-b border-slate-800 px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Right side in RTL: Symbol, TF, Pattern Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-wide font-mono">{assetSymbol}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-bold text-cyan-400 font-mono">{timeframe}</span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">{candles.length} کندل</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">الگو:</span>
            <select
              value={activeScenario.patternType}
              onChange={e => onPatternChange(e.target.value as PatternFamily)}
              disabled={activeScenario.isLocked}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 font-medium rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
            >
              {(Object.keys(PATTERN_LABELS_FA) as PatternFamily[]).map(pf => (
                <option key={pf} value={pf}>
                  {PATTERN_LABELS_FA[pf]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Left side in RTL: Interaction Modes & Overlays */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onChangeInteractionMode && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => onChangeInteractionMode('EDIT')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
                  interactionMode === 'EDIT'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="جابجایی، تغییر نام و حذف نقاط"
              >
                <Move className="w-3 h-3" />
                <span>ویرایش</span>
              </button>
              <button
                onClick={() => onChangeInteractionMode('ADD_VERTEX')}
                disabled={activeScenario.isLocked}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors disabled:opacity-40 ${
                  interactionMode === 'ADD_VERTEX'
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="کلیک روی نمودار برای افزودن نقطه موج"
              >
                <Plus className="w-3 h-3" />
                <span>افزودن نقطه</span>
              </button>
              {onStartScratchDraw && (
                <button
                  onClick={() => {
                    onStartScratchDraw();
                    onChangeInteractionMode('DRAW_SCRATCH');
                  }}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
                    interactionMode === 'DRAW_SCRATCH'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="شروع سناریوی جدید و ترسیم نقطه به نقطه روی نمودار"
                >
                  <PenTool className="w-3 h-3" />
                  <span>ترسیم از صفر</span>
                </button>
              )}
              {onUpdateAbsoluteBottom && (
                <button
                  onClick={() => onChangeInteractionMode('PICK_BOTTOM')}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
                    interactionMode === 'PICK_BOTTOM'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="انتخاب یا اصلاح کف مطلق روی نمودار"
                >
                  <Anchor className="w-3 h-3" />
                  <span>کف مطلق</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setSnapToCandleExtreme(!snapToCandleExtreme)}
            className={`px-2 py-1 text-[11px] rounded-lg border transition-colors ${
              snapToCandleExtreme
                ? 'bg-slate-800 border-slate-700 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="آهنربای سقف و کف کندل"
          >
            آهنربا
          </button>

          <button
            onClick={() => setRuleGuardEnabled(prev => !prev)}
            className={`px-2 py-1 text-[11px] rounded-lg border whitespace-nowrap transition-colors ${
              ruleGuardEnabled
                ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="جلوگیری خودکار از نقض قوانین سه‌گانه بنیادین هنگام جابه‌جایی دستی نقاط موج در چارت"
          >
            محافظ قوانین
          </button>

          {!hideZoneControls && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0">
                <button
                  onClick={togglePRZ}
                  title="نمایش یا مخفی کردن مستطیل افقی پتانسیل بازگشت قیمتی (PRZ)"
                  className={`px-2 py-1 text-[11px] font-mono font-bold rounded-md whitespace-nowrap transition-colors ${
                    effectiveShowPRZ
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  PRZ
                </button>
                <button
                  onClick={toggleTMV}
                  title="نمایش یا مخفی کردن نوارهای افقی اهداف (TMV)"
                  className={`px-2 py-1 text-[11px] font-mono font-bold rounded-md whitespace-nowrap transition-colors ${
                    effectiveShowTMV
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  TMV
                </button>
                <button
                  onClick={() => setShowFibLayers(prev => !prev)}
                  title="نمایش یا مخفی کردن لایه‌های افقی اکستنشن فیبوناچی بر اساس آخرین ساختار تکمیل‌شده"
                  className={`px-2 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${
                    effectiveShowFibLayers
                      ? 'bg-emerald-500/20 text-emerald-200 font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  لایه‌های فیبو
                </button>
                <button
                  onClick={() => setShowTargets(!showTargets)}
                  title="نمایش یا مخفی کردن خطوط تارگت و سطح ابطال"
                  className={`px-2 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${
                    showTargets
                      ? 'bg-indigo-500/25 text-indigo-200 font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  اهداف
                </button>
                <button
                  onClick={() => setShowExpectedPath(prev => !prev)}
                  title="نمایش یا مخفی کردن مسیر منحنی پیش‌بینی‌شده با انیمیشن جریان مسیر (Flow-Path)"
                  className={`px-2 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${
                    showExpectedPath
                      ? 'bg-cyan-500/25 text-cyan-200 font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  مسیر پیش‌بینی
                </button>
              </div>

              {effectiveShowTMV && (
                <div
                  className="flex items-center bg-slate-950 border border-sky-500/25 rounded-lg p-0.5 shrink-0"
                  title="تنظیم عرض افقی نوار TMV متناسب با بازه زمانی تحلیل (یا با کشیدن لبه چپ نوار روی چارت)"
                >
                  <span className="px-1.5 text-[10px] text-sky-300/80 whitespace-nowrap">عرض TMV:</span>
                  {(
                    [
                      { id: 'COMPACT', label: 'کوتاه' },
                      { id: 'ANALYSIS', label: 'بازه تحلیل' },
                      { id: 'FULL', label: 'کامل' }
                    ] as const
                  ).map(opt => {
                    const isActive = tmvCustomRatio === null && tmvSpanMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setTmvCustomRatio(null);
                          setTmvSpanMode(opt.id);
                        }}
                        className={`px-1.5 py-0.5 text-[10.5px] rounded-md whitespace-nowrap transition-colors ${
                          isActive
                            ? 'bg-sky-500/25 text-sky-200 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0"
                title="تغییر اسکیل قیمتی چارت و بروزرسانی PRZ/TMV"
              >
                <button
                  onClick={() => setPriceZoom(z => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
                  className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
                  title="بزرگ‌تر کردن دامنه قیمت (Zoom Out)"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setPriceZoom(1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-slate-300 hover:text-white whitespace-nowrap"
                  title="بازنشانی اسکیل قیمتی به حالت استاندارد"
                >
                  {Math.round(priceZoom * 100)}%
                </button>
                <button
                  onClick={() => setPriceZoom(z => Math.min(2.4, Math.round((z + 0.15) * 100) / 100))}
                  className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
                  title="تمرکز بیشتر روی اسکیل قیمتی (Zoom In)"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-1 text-[11px] rounded-lg border transition-colors ${
              showVolume
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            حجم
          </button>

          <button
            onClick={() => setShowTrendStrength(prev => !prev)}
            title="نمایش یا مخفی کردن آیکون قدرت روند (واگرایی RSI و مومنتوم وزنی حجم) کنار هر رأس موج"
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border transition-colors ${
              showTrendStrength
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-medium'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>قدرت روند</span>
          </button>

          {!hideToolbarLockAndReset && (
            <>
              <button
                onClick={evaluateCurrentCount}
                title="ارزیابی موج‌شماری فعلی با قوانین بهاری و نمایش پیشنهادهای اصلاح"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                  activeHardFailsCount > 0
                    ? 'bg-rose-600/20 hover:bg-rose-600/35 border-rose-500/50 text-rose-200'
                    : isUserModifiedCount
                    ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 text-white shadow-sm shadow-emerald-950/50'
                    : 'bg-indigo-600/20 hover:bg-indigo-600/35 border-indigo-500/45 text-indigo-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ارزیابی قوانین</span>
                {activeHardFailsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9.5px] font-mono tabular-nums">
                    {activeHardFailsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setDiagnosticOpenById(prev => ({ ...prev, [activeScenario.id]: false }));
                  setValidatorOpenById(prev => ({ ...prev, [activeScenario.id]: !prev[activeScenario.id] }));
                }}
                title="اعتبارسنجی سخت‌گیرانه گام‌به‌گام (PatternValidator)"
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                  validatorOpen
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ممیزی الگو</span>
              </button>

              <button
                onClick={onToggleLock}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                  activeScenario.isLocked
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {activeScenario.isLocked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                <span>{activeScenario.isLocked ? 'قفل' : 'آزاد'}</span>
              </button>

              <button
                onClick={onResetToAI}
                title="بازنشانی به پیشنهاد الگوریتم"
                className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Drill-Down Breadcrumb & Valid Lower-TF Bar */}
      {drillTrail && drillTrail.length > 0 && (
        <div className="bg-[#091224] border-b border-indigo-500/25 px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <GitBranch className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            {onJumpDrillLevel && (
              <button
                onClick={() => onJumpDrillLevel(-1)}
                className="text-slate-300 hover:text-white font-medium transition-colors"
              >
                نمای کلان
              </button>
            )}
            {drillTrail.map((item, idx) => {
              const isLast = idx === drillTrail.length - 1;
              return (
                <React.Fragment key={`${item.label}-${idx}`}>
                  <ChevronLeft className="w-3 h-3 text-slate-600 shrink-0" />
                  <button
                    onClick={() => onJumpDrillLevel && onJumpDrillLevel(idx)}
                    disabled={!onJumpDrillLevel || isLast}
                    className={`font-medium transition-colors ${
                      isLast ? 'text-cyan-300 font-bold cursor-default' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {item.label}{' '}
                    <span className="font-mono text-[10px] text-indigo-300">({item.timeframe})</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {onSwitchDrillTimeframe && lowestValidTimeframe && timeframe !== lowestValidTimeframe && (
              <button
                onClick={() => onSwitchDrillTimeframe(lowestValidTimeframe)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[10.5px] font-medium transition-colors"
                title="نمایش همین محدوده کندل‌ها در پایین‌ترین تایم‌فریم معتبر"
              >
                <Layers className="w-3 h-3" />
                <span>پایین‌ترین معتبر ({lowestValidTimeframe})</span>
              </button>
            )}
            {onJumpDrillLevel && (
              <button
                onClick={() => onJumpDrillLevel(drillTrail.length - 2)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-medium transition-colors"
              >
                <CornerDownLeft className="w-3 h-3" />
                <span>سطح قبلی</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Chart Canvas */}
      <div
        ref={containerRef}
        onClick={handleSvgClick}
        className={`flex-1 w-full h-full min-h-[380px] relative overflow-hidden ${
          draggingTmvEdge
            ? 'cursor-ew-resize'
            : draggingVertexIndex !== null || draggingBottom
            ? 'cursor-grabbing'
            : interactionMode === 'ADD_VERTEX' || interactionMode === 'DRAW_SCRATCH' || interactionMode === 'PICK_BOTTOM'
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
      >
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-full block">
          <defs>
            <linearGradient id="bullVol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bearVol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="tmvBullZoneGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.24" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="tmvBearZoneGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.24" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="fibLayerPrimary" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.26" />
              <stop offset="45%" stopColor="#06b6d4" stopOpacity="0.13" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="fibLayerSecondary" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.18" />
              <stop offset="55%" stopColor="#6366f1" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="fibLayerExtreme" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.16" />
              <stop offset="55%" stopColor="#ec4899" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.14" />
            </linearGradient>
            <linearGradient id="fibLayerTmv" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.24" />
              <stop offset="55%" stopColor="#eab308" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.20" />
            </linearGradient>
            <filter id="elliott-wave-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blurInner" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="7.5" result="blurOuter" />
              <feMerge>
                <feMergeNode in="blurOuter" />
                <feMergeNode in="blurInner" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="zone-hover-glow" x="-10%" y="-25%" width="120%" height="150%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="zoneBlur" />
              <feMerge>
                <feMergeNode in="zoneBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Parent Wave Time-Window Shade (in Step 3 Drill-Down) */}
          {parentWindowBounds && (
            <g>
              <rect
                x={getX(parentWindowBounds.startIdx)}
                y={padding.top}
                width={Math.max(20, getX(parentWindowBounds.endIdx) - getX(parentWindowBounds.startIdx))}
                height={height - padding.top - padding.bottom - volumeHeight}
                fill="#38bdf8"
                fillOpacity="0.06"
                stroke="#38bdf8"
                strokeOpacity="0.35"
                strokeDasharray="4 4"
              />
              <text
                x={(getX(parentWindowBounds.startIdx) + getX(parentWindowBounds.endIdx)) / 2}
                y={padding.top + 14}
                textAnchor="middle"
                fill="#7dd3fc"
                fontSize="10.5"
                fontWeight="600"
              >
                بازه دقیق کندل‌های {parentWindowHighlight?.label}
              </text>
            </g>
          )}

          {/* Absolute Bottom (Horizontal Price Floor) + Starting Candle (Vertical Anchor) */}
          {absoluteBottom && (
            <g>
              {/* Dim pre-start history left of Starting Candle */}
              <rect
                x={padding.left}
                y={padding.top}
                width={Math.max(0, getX(absoluteBottom.candleIndex) - padding.left)}
                height={height - padding.top - padding.bottom - volumeHeight}
                fill="#020617"
                fillOpacity="0.44"
              />
              {/* Primary Horizontal Price Floor Line across entire chart (کف مطلق افقی) */}
              <line
                x1={padding.left}
                y1={getY(absoluteBottom.price)}
                x2={width - padding.right}
                y2={getY(absoluteBottom.price)}
                stroke="#f59e0b"
                strokeWidth="1.75"
                strokeDasharray="6 4"
                opacity="0.92"
              />
              {/* Right Price-Axis Pill for Horizontal Absolute Bottom */}
              <rect
                x={width - padding.right + 2}
                y={getY(absoluteBottom.price) - 9}
                width="80"
                height="18"
                rx="4"
                fill="#451a03"
                stroke="#f59e0b"
                strokeWidth="1"
              />
              <text
                x={width - padding.right + 6}
                y={getY(absoluteBottom.price) + 3.5}
                fill="#fde68a"
                fontSize="9.5"
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
              >
                {absoluteBottom.price.toLocaleString()}
              </text>
              {/* Vertical Marker for Selected Starting Candle (کندل شروع) */}
              <line
                x1={getX(absoluteBottom.candleIndex)}
                y1={padding.top}
                x2={getX(absoluteBottom.candleIndex)}
                y2={height - padding.bottom}
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeDasharray="3 4"
                opacity="0.65"
              />
            </g>
          )}

          {/* Background Grid Lines & Prices */}
          {gridLines.map((line, idx) => (
            <g key={`grid-${idx}`}>
              <line
                x1={padding.left}
                y1={line.y}
                x2={width - padding.right}
                y2={line.y}
                stroke="#17223b"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={width - padding.right + 8}
                y={line.y + 3.5}
                fill="#64748b"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {line.price.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Volume separator */}
          {showVolume && (
            <line
              x1={padding.left}
              y1={height - padding.bottom - volumeHeight}
              x2={width - padding.right}
              y2={height - padding.bottom - volumeHeight}
              stroke="#1e293b"
              strokeWidth="1"
            />
          )}

          {/* Volume Bars */}
          {showVolume &&
            candles.map((candle, i) => {
              const x = getX(i);
              const isUp = candle.close >= candle.open;
              const barWidth = Math.max(2, ((width - padding.left - padding.right) / Math.max(1, maxPlotIndex)) * 0.62);
              const vHeight = (candle.volume / maxVolume) * (volumeHeight - 10);
              const y = height - padding.bottom - vHeight;

              return (
                <rect
                  key={`vol-${i}`}
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={vHeight}
                  fill={isUp ? 'url(#bullVol)' : 'url(#bearVol)'}
                  opacity="0.85"
                />
              );
            })}

          {/* Candlesticks */}
          {candles.map((candle, i) => {
            const x = getX(i);
            const openY = getY(candle.open);
            const closeY = getY(candle.close);
            const highY = getY(candle.high);
            const lowY = getY(candle.low);
            const isUp = candle.close >= candle.open;
            const bodyColor = isUp ? '#10b981' : '#f43f5e';
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));
            const barWidth = Math.max(2.5, ((width - padding.left - padding.right) / Math.max(1, maxPlotIndex)) * 0.62);
            const slotWidth = Math.max(6, (width - padding.left - padding.right) / Math.max(1, maxPlotIndex));
            const isStartCandle = Boolean(absoluteBottom && absoluteBottom.candleIndex === i);

            return (
              <g
                key={`candle-${i}`}
                onClick={
                  onUpdateAbsoluteBottom
                    ? e => {
                        if (dragMovedRef.current) return;
                        e.stopPropagation();
                        onUpdateAbsoluteBottom({
                          label: '0 (کف مطلق)',
                          candleIndex: i,
                          price: candle.low,
                          timestamp: candle.timestamp,
                          isConfirmed: true
                        });
                      }
                    : undefined
                }
                className={onUpdateAbsoluteBottom ? 'cursor-pointer' : undefined}
              >
                {isStartCandle && (
                  <rect
                    x={x - barWidth / 2 - 3}
                    y={highY - 3}
                    width={barWidth + 6}
                    height={Math.max(8, lowY - highY + 6)}
                    rx="3"
                    fill="#f59e0b"
                    fillOpacity="0.16"
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                  />
                )}
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={bodyColor} strokeWidth="1.15" />
                <rect x={x - barWidth / 2} y={bodyTop} width={barWidth} height={bodyHeight} fill={bodyColor} rx="0.8" />
                {onUpdateAbsoluteBottom && (
                  <rect
                    x={x - slotWidth / 2}
                    y={padding.top}
                    width={slotWidth}
                    height={Math.max(20, height - padding.top - padding.bottom - volumeHeight)}
                    fill="transparent"
                  />
                )}
              </g>
            );
          })}

          {/* Current Price Line */}
          {lastPriceY >= padding.top && lastPriceY <= height - padding.bottom && (
            <g>
              <line
                x1={padding.left}
                y1={lastPriceY}
                x2={width - padding.right}
                y2={lastPriceY}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              <rect x={width - padding.right + 2} y={lastPriceY - 9} width="80" height="18" rx="4" fill="#10b981" />
              <text
                x={width - padding.right + 6}
                y={lastPriceY + 3.5}
                fill="#022c22"
                fontSize="10"
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
              >
                {lastPrice.toLocaleString()}
              </text>
            </g>
          )}

          {/* Unified Horizontal Overlays (PRZ Bounding Box, Width-Adjustable TMV Target Ribbons, Fib Extension Layers, Targets) with Shared Zero-Overlap Collision Solver */}
          {(() => {
            const plotTop = padding.top;
            const plotBottom = height - padding.bottom - volumeHeight;
            const endX = width - padding.right;
            const plotW = Math.max(80, endX - padding.left);

            const usedAxisBadgeYs: number[] = [];
            if (lastPriceY >= plotTop && lastPriceY <= plotBottom) {
              usedAxisBadgeYs.push(lastPriceY);
            }
            if (absoluteBottom) {
              const absY = getY(absoluteBottom.price);
              if (absY >= plotTop && absY <= plotBottom) usedAxisBadgeYs.push(absY);
            }

            // Seed inline badge exclusion boxes with wave vertex labels so overlay tags never obscure wave counts
            const usedInlineBadgeRects: Array<{ x: number; y: number; w: number; h: number }> =
              activeScenario.vertices.map(v => {
                const vx = getX(v.candleIndex);
                const vy = getY(v.price);
                const bY = Math.max(plotTop + 14, vy - 24);
                return { x: vx - 22, y: bY - 14, w: 44, h: 26 };
              });

            const resolveTagY = (preferredY: number, x: number, w: number, boxH = 18): number => {
              let y = Math.max(plotTop + 3, Math.min(plotBottom - boxH - 3, preferredY));
              let guard = 0;
              while (
                guard < 12 &&
                usedInlineBadgeRects.some(
                  r =>
                    y < r.y + r.h + 4 &&
                    y + boxH + 4 > r.y &&
                    x < r.x + r.w + 8 &&
                    x + w + 8 > r.x
                )
              ) {
                const step = (guard % 2 === 0 ? 1 : -1) * (Math.floor(guard / 2) + 1) * (boxH + 4);
                const candidate = Math.max(plotTop + 3, Math.min(plotBottom - boxH - 3, preferredY + step));
                y = candidate;
                guard += 1;
              }
              usedInlineBadgeRects.push({ x, y, w, h: boxH });
              return y;
            };

            const resolveAxisY = (preferredY: number, minGap = 20): number | null => {
              const clamped = Math.max(plotTop + 10, Math.min(plotBottom - 10, preferredY));
              if (usedAxisBadgeYs.every(prevY => Math.abs(prevY - clamped) >= minGap)) {
                usedAxisBadgeYs.push(clamped);
                return clamped;
              }
              return null;
            };

            // Compute TMV horizontal coordinates & rendered target prices for Target deduplication
            const tmvTargetPricesForDedup: number[] = [];
            const lastVerts = activeScenario.vertices;
            const fallbackStartIdx =
              lastVerts.length >= 2 ? Math.min(lastVerts[lastVerts.length - 2].candleIndex, lastVerts[lastVerts.length - 1].candleIndex) : 0;
            const fallbackEndIdx = Math.max(1, candles.length - 1);

            const targetPool = !hideZoneControls
              ? projectionReport?.targets.length
                ? projectionReport.targets
                : activeScenario.targets
              : [];

            return (
              <g>
                {/* 1. SVG Interactive Layer & Price-Axis Alignment for Glassmorphic PRZ Container */}
                {effectiveShowPRZ &&
                  renderedPrzBoxes.map(box => {
                    const { prz, hiPrice, loPrice, yTop, yBot, yMid, bandH, xStart, xEnd, bandW, anchorVertX, anchorVertY } = box;
                    const isBullZone = prz.direction === 'BULLISH';
                    const isHovered = hoveredZoneId === prz.id;
                    const strokeCol = prz.isPrimary ? (isBullZone ? '#fbbf24' : '#fb923c') : '#d97706';
                    const axisY = prz.isPrimary ? resolveAxisY(yMid, 20) : null;
                    const przHeaderY = bandH >= 36 ? yTop + 4 : yTop - 26 >= plotTop ? yTop - 24 : yBot + 4;
                    usedInlineBadgeRects.push({
                      x: Math.max(padding.left + 8, xEnd - Math.min(bandW, 240)),
                      y: przHeaderY,
                      w: Math.min(bandW, 240),
                      h: 20
                    });

                    return (
                      <g
                        key={prz.id}
                        onMouseEnter={() => setHoveredZoneId(prz.id)}
                        onMouseLeave={() => setHoveredZoneId(prev => (prev === prz.id ? null : prev))}
                        className="cursor-pointer"
                        opacity={hoveredZoneId && !isHovered ? 0.55 : prz.isPrimary ? 1 : 0.72}
                        style={{ transition: 'opacity 160ms ease' }}
                      >
                        {/* Transparent hit-target aligned to Glassmorphic PRZ Horizontal Container */}
                        <rect
                          x={xStart}
                          y={yTop}
                          width={bandW}
                          height={bandH}
                          fill="transparent"
                        />

                        {/* Last-Wave Vertex Neon Anchor Connector */}
                        {prz.isPrimary && (
                          <line
                            x1={anchorVertX}
                            y1={anchorVertY}
                            x2={anchorVertX}
                            y2={yMid}
                            stroke={strokeCol}
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                            strokeOpacity={isHovered ? '0.92' : '0.68'}
                            filter={isHovered ? 'url(#zone-hover-glow)' : undefined}
                            pointerEvents="none"
                          />
                        )}
                        <circle
                          cx={xStart}
                          cy={yMid}
                          r={isHovered ? 4.4 : prz.isPrimary ? 3.5 : 2.5}
                          fill={strokeCol}
                          stroke="#020617"
                          strokeWidth="1.4"
                          filter="url(#zone-hover-glow)"
                          pointerEvents="none"
                        />

                        {/* Right Price-Axis High/Low Tick Markers & PRZ Mid-Price Pill */}
                        {axisY !== null && (
                          <g pointerEvents="none">
                            <line
                              x1={endX - 2}
                              y1={yTop}
                              x2={endX + 2}
                              y2={yTop}
                              stroke={strokeCol}
                              strokeWidth="1.4"
                              strokeOpacity="0.85"
                            />
                            <line
                              x1={endX - 2}
                              y1={yBot}
                              x2={endX + 2}
                              y2={yBot}
                              stroke={strokeCol}
                              strokeWidth="1.4"
                              strokeOpacity="0.85"
                            />
                            <line
                              x1={endX - 1}
                              y1={yTop}
                              x2={endX - 1}
                              y2={yBot}
                              stroke={strokeCol}
                              strokeWidth="2.6"
                              strokeOpacity="0.92"
                            />
                            <rect
                              x={endX + 2}
                              y={axisY - 9.5}
                              width="82"
                              height="19"
                              rx="4"
                              fill="#291202"
                              stroke={strokeCol}
                              strokeWidth={isHovered ? '1.3' : '0.95'}
                            />
                            <text
                              x={endX + 6}
                              y={axisY + 3.5}
                              fill="#fde68a"
                              fontSize="8.8"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              PRZ {prz.midPrice.toLocaleString()}
                            </text>
                            {isHovered && (
                              <title>{`${loPrice.toLocaleString()} - ${hiPrice.toLocaleString()}`}</title>
                            )}
                          </g>
                        )}
                      </g>
                    );
                  })}

                {/* 2. Luminous Horizontal Width-Adjustable TMV Target Zone (Mirrors PRZ Horizontal Bounding Box UI/UX) */}
                {effectiveShowTMV &&
                  renderedTmvBoxes.map(box => {
                    const { tmv, showBand, yTop, yBot, bandH, idealY, xStart, xEnd, bandW } = box;
                    const isBullZone = tmv.direction === 'BULLISH';
                    const isHovered = hoveredZoneId === tmv.id || draggingTmvEdge;
                    const strokeCol = isBullZone ? '#38bdf8' : '#c084fc';
                    const accentCol = isBullZone ? '#22d3ee' : '#e879f9';
                    const fillUrl = isBullZone ? 'url(#tmvBullZoneGrad)' : 'url(#tmvBearZoneGrad)';
                    const cornerSize = Math.min(10, bandH * 0.34, bandW * 0.12);

                    const tmvLevels =
                      tmv.targetPrices && tmv.targetPrices.length > 0
                        ? tmv.targetPrices
                        : [
                            {
                              id: `${tmv.id}-ideal`,
                              label: 'TMV Ideal',
                              ratioLabel: 'Ideal',
                              price: tmv.ideal100Price
                            }
                          ];
                    tmvLevels.forEach(lvl => tmvTargetPricesForDedup.push(lvl.price));

                    const tmvText = `TMV افقی (${tmv.basisPairLabel}) · هدف ${tmv.ideal100Price.toLocaleString()}`;
                    const tmvBadgeW = Math.min(Math.max(165, bandW - 20), Math.max(195, tmvText.length * 5.0 + 28));
                    const tmvBadgeX = Math.max(padding.left + 8, Math.min(xStart + 14, xEnd - tmvBadgeW - 8));
                    const preferredTmvY = bandH >= 32 ? yTop + 6 : yTop - 22 >= plotTop ? yTop - 22 : yBot + 4;
                    const tmvTagY = showBand ? resolveTagY(preferredTmvY, tmvBadgeX, tmvBadgeW, 19) : 0;
                    const distPct = lastPrice > 0 ? (((tmv.ideal100Price - lastPrice) / lastPrice) * 100).toFixed(1) : '0.0';
                    const signedDist = Number(distPct) > 0 ? `+${distPct}%` : `${distPct}%`;

                    return (
                      <g
                        key={tmv.id}
                        onMouseEnter={() => setHoveredZoneId(tmv.id)}
                        onMouseLeave={() => setHoveredZoneId(prev => (prev === tmv.id ? null : prev))}
                        opacity={hoveredZoneId && !isHovered ? 0.58 : 1}
                        style={{ transition: 'opacity 150ms ease' }}
                      >
                        {showBand && (
                          <g>
                            {/* Luminous Horizontal TMV Corridor Bounding Box */}
                            <rect
                              x={xStart}
                              y={yTop}
                              width={bandW}
                              height={bandH}
                              rx="3"
                              fill={fillUrl}
                              fillOpacity={isHovered ? 1 : 0.85}
                              stroke={strokeCol}
                              strokeWidth={isHovered ? '1.55' : '1.05'}
                              strokeDasharray={isHovered ? undefined : '6 3'}
                              strokeOpacity={isHovered ? '0.95' : '0.68'}
                              filter={isHovered ? 'url(#zone-hover-glow)' : undefined}
                            />

                            {/* Crisp Horizontal Top & Bottom Corridor Rails */}
                            <line x1={xStart} y1={yTop} x2={xEnd} y2={yTop} stroke={strokeCol} strokeWidth={isHovered ? '1.6' : '1.2'} strokeOpacity="0.9" pointerEvents="none" />
                            <line x1={xStart} y1={yBot} x2={xEnd} y2={yBot} stroke={strokeCol} strokeWidth={isHovered ? '1.6' : '1.2'} strokeOpacity="0.9" pointerEvents="none" />

                            {/* 4 Sharp L-Corner Brackets Matching PRZ */}
                            <path
                              d={`M ${xStart} ${yTop + cornerSize} L ${xStart} ${yTop} L ${xStart + cornerSize} ${yTop}
                                  M ${xEnd - cornerSize} ${yTop} L ${xEnd} ${yTop} L ${xEnd} ${yTop + cornerSize}
                                  M ${xStart} ${yBot - cornerSize} L ${xStart} ${yBot} L ${xStart + cornerSize} ${yBot}
                                  M ${xEnd - cornerSize} ${yBot} L ${xEnd} ${yBot} L ${xEnd} ${yBot - cornerSize}`}
                              fill="none"
                              stroke={accentCol}
                              strokeWidth={isHovered ? '2.2' : '1.8'}
                              strokeOpacity="0.98"
                              pointerEvents="none"
                            />

                            {/* Right-Axis Span Bracket */}
                            <line
                              x1={endX - 1}
                              y1={yTop}
                              x2={endX - 1}
                              y2={yBot}
                              stroke={strokeCol}
                              strokeWidth="2.4"
                              strokeOpacity="0.88"
                              pointerEvents="none"
                            />

                            {/* Sleek Horizontal TMV Header Pill */}
                            <g pointerEvents="none">
                              <rect
                                x={tmvBadgeX}
                                y={tmvTagY}
                                width={tmvBadgeW}
                                height="19"
                                rx="5"
                                fill="#020617"
                                fillOpacity={isHovered ? '0.96' : '0.88'}
                                stroke={strokeCol}
                                strokeOpacity={isHovered ? '0.95' : '0.68'}
                                strokeWidth={isHovered ? '1.1' : '0.8'}
                              />
                              <rect x={tmvBadgeX + 6.5} y={tmvTagY + 6.5} width="6" height="6" rx="1.5" fill={accentCol} />
                              <text
                                x={tmvBadgeX + 16}
                                y={tmvTagY + 12.5}
                                fill={isBullZone ? '#bae6fd' : '#f3e8ff'}
                                fontSize="9"
                                fontWeight="700"
                              >
                                {tmvText}
                              </text>
                            </g>

                            {/* Compact Centered Left-Border Pill Grip for Horizontal Width Adjustment (↔) */}
                            <g
                              className="cursor-ew-resize"
                              onMouseDown={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDraggingTmvEdge(true);
                              }}
                            >
                              <title>برای تغییر عرض افقی ناحیه TMV به چپ یا راست بکشید</title>
                              <rect x={xStart - 8} y={yTop} width={16} height={bandH} fill="transparent" />
                              <rect
                                x={xStart - 7}
                                y={idealY - 11}
                                width="14"
                                height="22"
                                rx="4"
                                fill="#090f1e"
                                stroke={accentCol}
                                strokeWidth={draggingTmvEdge ? '1.6' : '1.1'}
                              />
                              <path
                                d={`M ${xStart - 4} ${idealY} L ${xStart - 1.5} ${idealY - 2.5} M ${xStart - 4} ${idealY} L ${xStart - 1.5} ${idealY + 2.5}
                                    M ${xStart + 4} ${idealY} L ${xStart + 1.5} ${idealY - 2.5} M ${xStart + 4} ${idealY} L ${xStart + 1.5} ${idealY + 2.5}
                                    M ${xStart - 3.5} ${idealY} L ${xStart + 3.5} ${idealY}`}
                                fill="none"
                                stroke={accentCol}
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </g>

                            {/* Hover Inspector Card for TMV Horizontal Zone */}
                            {isHovered && !draggingTmvEdge && (
                              <g pointerEvents="none">
                                {(() => {
                                  const topRungs = tmvLevels.slice(0, 3);
                                  const cardW = 264;
                                  const cardH = 38 + topRungs.length * 14;
                                  const cardX = Math.max(padding.left + 8, Math.min(xEnd - cardW - 10, xStart + 16));
                                  const cardY =
                                    yTop - cardH - 8 >= plotTop ? yTop - cardH - 8 : Math.min(plotBottom - cardH - 6, yBot + 8);
                                  return (
                                    <>
                                      <rect
                                        x={cardX}
                                        y={cardY}
                                        width={cardW}
                                        height={cardH}
                                        rx="7"
                                        fill="#090f1e"
                                        fillOpacity="0.96"
                                        stroke={accentCol}
                                        strokeWidth="1.1"
                                      />
                                      <text x={cardX + cardW - 10} y={cardY + 15} textAnchor="end" fill={accentCol} fontSize="9.5" fontWeight="700">
                                        {isBullZone ? '↑ ناحیه افقی اهداف TMV' : '↓ ناحیه افقی اهداف TMV'} · {signedDist}
                                      </text>
                                      <text
                                        x={cardX + 10}
                                        y={cardY + 15}
                                        fill="#cbd5e1"
                                        fontSize="8.8"
                                        fontFamily="JetBrains Mono, monospace"
                                      >
                                        {tmv.lowPrice.toLocaleString()}–{tmv.highPrice.toLocaleString()}
                                      </text>
                                      {topRungs.map((r, rIdx) => (
                                        <g key={`${tmv.id}-tip-${r.id}-${rIdx}`}>
                                          <text
                                            x={cardX + 10}
                                            y={cardY + 32 + rIdx * 14}
                                            fill="#e2e8f0"
                                            fontSize="8.8"
                                            fontWeight="bold"
                                            fontFamily="JetBrains Mono, monospace"
                                          >
                                            {r.price.toLocaleString()}
                                          </text>
                                          <text
                                            x={cardX + cardW - 10}
                                            y={cardY + 32 + rIdx * 14}
                                            textAnchor="end"
                                            fill="#94a3b8"
                                            fontSize="8.5"
                                          >
                                            {r.ratioLabel}
                                          </text>
                                        </g>
                                      ))}
                                    </>
                                  );
                                })()}
                              </g>
                            )}
                          </g>
                        )}

                        {/* Horizontal Target Price Rungs Rendered Strictly Inside/Across [xStart, xEnd] */}
                        {tmvLevels.map((lvl, lvlIdx) => {
                          const lvlY = getY(lvl.price);
                          if (lvlY < plotTop + 4 || lvlY > plotBottom - 4) return null;
                          const isIdeal = Math.abs(lvl.price - tmv.ideal100Price) < Math.max(0.05, tmv.ideal100Price * 0.0005);
                          const lvlAxisY = resolveAxisY(lvlY, 19);

                          return (
                            <g key={`${tmv.id}-${lvl.id}-${lvlIdx}`} pointerEvents="none">
                              <line
                                x1={xStart}
                                y1={lvlY}
                                x2={xEnd}
                                y2={lvlY}
                                stroke={isIdeal ? accentCol : '#818cf8'}
                                strokeWidth={isIdeal ? (isHovered ? '2' : '1.55') : '1.05'}
                                strokeDasharray={isIdeal ? '8 3' : '3 3'}
                                strokeOpacity={isIdeal ? '0.96' : '0.78'}
                              />
                              {isIdeal && (
                                <polygon
                                  points={`${xStart + 10},${lvlY} ${xStart + 14},${lvlY - 3.5} ${xStart + 18},${lvlY} ${xStart + 14},${lvlY + 3.5}`}
                                  fill={accentCol}
                                  stroke="#020617"
                                  strokeWidth="0.9"
                                />
                              )}
                              {lvlAxisY !== null && (
                                <g>
                                  <rect
                                    x={endX + 2}
                                    y={lvlAxisY - 9.5}
                                    width="82"
                                    height="19"
                                    rx="4"
                                    fill={isIdeal ? (isBullZone ? '#0c4a6e' : '#3b0764') : '#1e1b4b'}
                                    stroke={isIdeal ? accentCol : '#818cf8'}
                                    strokeWidth={isIdeal ? '1' : '0.8'}
                                  />
                                  <text
                                    x={endX + 6}
                                    y={lvlAxisY + 3.5}
                                    fill={isIdeal ? (isBullZone ? '#7dd3fc' : '#f3e8ff') : '#c7d2fe'}
                                    fontSize="8.8"
                                    fontWeight="bold"
                                    fontFamily="JetBrains Mono, monospace"
                                  >
                                    {isIdeal ? 'TMV ' : 'TGT '}
                                    {lvl.price.toLocaleString()}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                {/* 3. Dynamic Horizontal Fibonacci Extension Layers (TargetProjectionEngine) */}
                {effectiveShowFibLayers &&
                  projectionReport?.extensionLayers &&
                  projectionReport.extensionLayers.length > 0 &&
                  (() => {
                    const visibleLayers = projectionReport.extensionLayers.filter(layer => {
                      const cy = getY(layer.price);
                      return cy >= plotTop + 4 && cy <= plotBottom - 4;
                    });
                    const hoveredLayer: FibonacciExtensionLayer | null =
                      visibleLayers.find(l => l.id === hoveredExtLayerId) || null;

                    const tierStyle = (tier: FibonacciExtensionLayer['tier']) => {
                      if (tier === 'PRIMARY') {
                        return { stroke: '#10b981', fill: 'url(#fibLayerPrimary)', badgeBg: '#064e3b', badgeText: '#6ee7b7', dash: '8 3' };
                      }
                      if (tier === 'TMV') {
                        return { stroke: '#f59e0b', fill: 'url(#fibLayerTmv)', badgeBg: '#451a03', badgeText: '#fde68a', dash: '6 3' };
                      }
                      if (tier === 'EXTREME') {
                        return { stroke: '#c084fc', fill: 'url(#fibLayerExtreme)', badgeBg: '#3b0764', badgeText: '#e9d5ff', dash: '3 4' };
                      }
                      return { stroke: '#38bdf8', fill: 'url(#fibLayerSecondary)', badgeBg: '#0c4a6e', badgeText: '#bae6fd', dash: '5 4' };
                    };

                    return (
                      <g>
                        {visibleLayers.map(layer => {
                          const style = tierStyle(layer.tier);
                          const centerY = getY(layer.price);
                          const rawYTop = getY(layer.bandHigh);
                          const rawYBot = getY(layer.bandLow);
                          const yTop = Math.max(plotTop, Math.min(rawYTop, centerY - 3.5));
                          const yBot = Math.min(plotBottom, Math.max(rawYBot, centerY + 3.5));
                          const bandH = Math.max(7, yBot - yTop);
                          const startX = Math.max(padding.left, Math.min(endX - 110, getX(layer.anchorCandleIndex)));
                          const layerW = Math.max(40, endX - startX);
                          const isHovered = hoveredExtLayerId === layer.id;

                          const axisY = isHovered ? centerY : resolveAxisY(centerY, 19);
                          const canShowInlineTag = axisY !== null || isHovered;
                          const tagW = isHovered ? 148 : 112;
                          const tagY = canShowInlineTag
                            ? resolveTagY(centerY - 9, startX + 6, tagW, 17)
                            : centerY - 9;
                          const signedPct = layer.distancePct > 0 ? `+${layer.distancePct}%` : `${layer.distancePct}%`;

                          return (
                            <g
                              key={layer.id}
                              onMouseEnter={() => setHoveredExtLayerId(layer.id)}
                              onMouseLeave={() => setHoveredExtLayerId(null)}
                              className="cursor-pointer"
                              opacity={hoveredExtLayerId && !isHovered ? 0.36 : 1}
                              style={{ transition: 'opacity 140ms ease' }}
                            >
                              <rect
                                x={startX}
                                y={centerY - 7}
                                width={layerW}
                                height={14}
                                fill="transparent"
                              />
                              <rect
                                x={startX}
                                y={yTop}
                                width={layerW}
                                height={bandH}
                                fill={style.fill}
                                fillOpacity={isHovered ? 0.9 : layer.tier === 'PRIMARY' || layer.tier === 'TMV' ? 0.65 : 0.45}
                                stroke={isHovered ? style.stroke : 'none'}
                                strokeWidth={isHovered ? 0.9 : 0}
                                strokeOpacity={0.65}
                              />
                              <line
                                x1={startX}
                                y1={centerY}
                                x2={endX}
                                y2={centerY}
                                stroke={style.stroke}
                                strokeWidth={isHovered ? 2 : layer.tier === 'PRIMARY' || layer.tier === 'TMV' ? 1.3 : 0.95}
                                strokeDasharray={isHovered ? undefined : style.dash}
                                strokeOpacity={isHovered ? 1 : layer.tier === 'EXTREME' ? 0.6 : 0.8}
                              />
                              <circle
                                cx={startX}
                                cy={centerY}
                                r={isHovered ? 4 : 2.6}
                                fill={style.stroke}
                                stroke="#080d1a"
                                strokeWidth="1"
                              />

                              {canShowInlineTag && (
                                <g pointerEvents="none">
                                  <rect
                                    x={startX + 6}
                                    y={tagY}
                                    width={tagW}
                                    height={17}
                                    rx="4"
                                    fill="#020617"
                                    fillOpacity={isHovered ? 0.94 : 0.8}
                                    stroke={style.stroke}
                                    strokeOpacity={isHovered ? 0.9 : 0.45}
                                    strokeWidth="0.8"
                                  />
                                  <text
                                    x={startX + 12}
                                    y={tagY + 12}
                                    fill={style.badgeText}
                                    fontSize="9"
                                    fontWeight="700"
                                    fontFamily="JetBrains Mono, monospace"
                                  >
                                    {layer.ratioLabel}
                                    {isHovered ? ` · ${signedPct}` : ` · ${layer.confidence}%`}
                                  </text>
                                </g>
                              )}

                              {axisY !== null && (
                                <g pointerEvents="none">
                                  <rect
                                    x={endX + 2}
                                    y={axisY - 9}
                                    width="82"
                                    height="18"
                                    rx="4"
                                    fill={style.badgeBg}
                                    stroke={style.stroke}
                                    strokeWidth={isHovered ? '1.3' : '0.85'}
                                  />
                                  <text
                                    x={endX + 6}
                                    y={axisY + 3.5}
                                    fill={style.badgeText}
                                    fontSize="9"
                                    fontWeight="bold"
                                    fontFamily="JetBrains Mono, monospace"
                                  >
                                    {layer.ratio}·{layer.price.toLocaleString()}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}

                        {hoveredLayer &&
                          (() => {
                            const style = tierStyle(hoveredLayer.tier);
                            const startX = Math.max(padding.left, Math.min(endX - 110, getX(hoveredLayer.anchorCandleIndex)));
                            const yTarget = getY(hoveredLayer.price);
                            const yAnchor = Math.max(plotTop, Math.min(plotBottom, getY(hoveredLayer.anchorPrice)));
                            const bracketX = startX + 3;
                            const infoX = Math.min(endX - 285, Math.max(padding.left + 8, startX + 162));
                            const infoY = yTarget - 32 >= plotTop ? yTarget - 30 : Math.min(plotBottom - 26, yTarget + 10);
                            return (
                              <g pointerEvents="none">
                                <line
                                  x1={bracketX}
                                  y1={yAnchor}
                                  x2={bracketX}
                                  y2={yTarget}
                                  stroke={style.stroke}
                                  strokeWidth="1.6"
                                  strokeDasharray="3 2"
                                />
                                <circle cx={bracketX} cy={yAnchor} r="3.5" fill="#080d1a" stroke={style.stroke} strokeWidth="1.5" />
                                <circle cx={bracketX} cy={yTarget} r="4" fill={style.stroke} stroke="#ffffff" strokeWidth="1.2" />
                                <rect
                                  x={infoX}
                                  y={infoY}
                                  width="276"
                                  height="22"
                                  rx="5"
                                  fill="#020617"
                                  fillOpacity="0.95"
                                  stroke={style.stroke}
                                  strokeWidth="1"
                                />
                                <text
                                  x={infoX + 268}
                                  y={infoY + 14.5}
                                  textAnchor="end"
                                  fill="#f8fafc"
                                  fontSize="9.5"
                                  fontWeight="700"
                                >
                                  {hoveredLayer.titleFa} ({hoveredLayer.formulaFa})
                                </text>
                              </g>
                            );
                          })()}
                      </g>
                    );
                  })()}

                {/* 4. Targets & Invalidation (Deduplicated against TMV Target Lines + Shared Axis Collision Solver) */}
                {showTargets &&
                  targetPool.map(target => {
                    const isInv = Boolean(target.isInvalidation);
                    if (
                      !isInv &&
                      effectiveShowTMV &&
                      tmvTargetPricesForDedup.some(tp => Math.abs(tp - target.price) / Math.max(1, target.price) < 0.0025)
                    ) {
                      return null;
                    }
                    const targetY = getY(target.price);
                    if (targetY < plotTop || targetY > plotBottom) return null;
                    const color = isInv ? '#f43f5e' : target.type === 'TMV' ? '#f59e0b' : '#38bdf8';
                    const axisY = resolveAxisY(targetY, 19);

                    return (
                      <g key={target.id} pointerEvents="none">
                        <line
                          x1={padding.left}
                          y1={targetY}
                          x2={endX}
                          y2={targetY}
                          stroke={color}
                          strokeWidth="1.15"
                          strokeDasharray={isInv ? '5 4' : '3 3'}
                          opacity="0.65"
                        />
                        {axisY !== null && (
                          <>
                            <rect
                              x={endX + 2}
                              y={axisY - 9}
                              width="82"
                              height="18"
                              rx="4"
                              fill={isInv ? '#4c0519' : '#082f49'}
                              stroke={color}
                              strokeWidth="0.8"
                            />
                            <text
                              x={endX + 6}
                              y={axisY + 3.5}
                              fill={color}
                              fontSize="9.2"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              {isInv ? 'INV ' : target.type === 'TMV' ? 'TMV ' : 'TGT '}
                              {target.price.toLocaleString()}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
              </g>
            );
          })()}

          {/* Multi-Scenario Color Overlays (non-active checked scenarios) */}
          {overlayScenarios
            .filter(sc => sc.id !== activeScenario.id && sc.vertices.length >= 2)
            .map(sc => {
              const pts = sc.vertices.map(v => `${getX(v.candleIndex)},${getY(v.price)}`).join(' ');
              const lastV = sc.vertices[sc.vertices.length - 1];
              const isDimmedByHover = Boolean(hoveredTraceData && hoveredTraceData.scenario.id !== sc.id);
              const isSelfHovered = hoveredTraceData?.scenario.id === sc.id;
              return (
                <g
                  key={`overlay-${sc.id}`}
                  opacity={isSelfHovered ? 0.95 : isDimmedByHover ? 0.22 : 0.72}
                  style={{ transition: 'opacity 180ms ease' }}
                >
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={sc.color}
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {sc.vertices.map((v, vIdx) => (
                    <g key={`ov-${sc.id}-${vIdx}`}>
                      <circle cx={getX(v.candleIndex)} cy={getY(v.price)} r="3.5" fill={sc.color} stroke="#080d1a" strokeWidth="1" />
                      <text
                        x={getX(v.candleIndex)}
                        y={getY(v.price) - 8}
                        textAnchor="middle"
                        fill={sc.color}
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {v.label}
                      </text>
                    </g>
                  ))}
                  {lastV && (
                    <text
                      x={getX(lastV.candleIndex) + 10}
                      y={getY(lastV.price) + 4}
                      fill={sc.color}
                      fontSize="10"
                      fontWeight="600"
                    >
                      {sc.name.split('(')[0].trim()}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Hovered / Externally Highlighted Wave Leg Candle-Window Preview Band */}
          {(() => {
            const activeLegIdx = hoveredLeg ?? highlightedLegIndex ?? validatorHighlightLeg;
            if (activeLegIdx === null || activeLegIdx === undefined) return null;
            const vA = activeScenario.vertices[activeLegIdx];
            const vB = activeScenario.vertices[activeLegIdx + 1];
            if (!vA || !vB) return null;
            const sIdx = Math.min(vA.candleIndex, vB.candleIndex);
            const eIdx = Math.max(vA.candleIndex, vB.candleIndex);
            const rx = getX(sIdx);
            const rw = Math.max(8, getX(eIdx) - rx);
            return (
              <rect
                x={rx}
                y={padding.top}
                width={rw}
                height={Math.max(0, height - padding.top - padding.bottom - volumeHeight)}
                fill={scenarioColor}
                fillOpacity="0.09"
                stroke={scenarioColor}
                strokeOpacity="0.45"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                pointerEvents="none"
              />
            );
          })()}

          {/* Active Scenario Wave Leg Segments (individually interactive for double-click drill-down) */}
          {activeScenario.vertices.length >= 2 &&
            activeScenario.vertices.slice(0, -1).map((vStart, legIdx) => {
              const vEnd = activeScenario.vertices[legIdx + 1];
              const x1 = getX(vStart.candleIndex);
              const y1 = getY(vStart.price);
              const x2 = getX(vEnd.candleIndex);
              const y2 = getY(vEnd.price);
              const isLegHovered =
                hoveredLeg === legIdx ||
                highlightedLegIndex === legIdx ||
                validatorHighlightLeg === legIdx;
              const candleSpan = Math.abs(vEnd.candleIndex - vStart.candleIndex) + 1;

              return (
                <g
                  key={`leg-${legIdx}`}
                  onMouseEnter={() => setHoveredLeg(legIdx)}
                  onMouseLeave={() => setHoveredLeg(null)}
                  onClick={e => {
                    if (
                      interactionMode !== 'EDIT' ||
                      draggingVertexIndex !== null ||
                      draggingBottom ||
                      dragMovedRef.current ||
                      !onDoubleClickWaveLeg
                    ) {
                      return;
                    }
                    e.stopPropagation();
                    triggerDrillDown(legIdx);
                  }}
                  className={onDoubleClickWaveLeg && interactionMode === 'EDIT' ? 'cursor-pointer' : ''}
                >
                  {(highlightedLegIndex === legIdx || validatorHighlightLeg === legIdx) && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={scenarioColor}
                      strokeWidth="8.5"
                      strokeOpacity="0.35"
                      strokeLinecap="round"
                      filter="url(#elliott-wave-glow)"
                      pointerEvents="none"
                    />
                  )}
                  {/* Visible Wave Segment */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={scenarioColor}
                    strokeWidth={isLegHovered ? '4.8' : '2.8'}
                    strokeLinecap="round"
                    opacity={hoveredTraceData && hoveredTraceData.scenario.id !== activeScenario.id ? 0.32 : 1}
                    style={{ transition: 'opacity 180ms ease' }}
                  />
                  {/* Invisible thick hit target for easy hover & click drill-down */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  {onDoubleClickWaveLeg && interactionMode === 'EDIT' && hoveredLeg === legIdx && (
                    <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2 - 14})`} pointerEvents="none">
                      <rect x="-102" y="-11" width="204" height="20" rx="5" fill="#0f172a" stroke={scenarioColor} strokeWidth="1" />
                      <text x="0" y="3" textAnchor="middle" fill="#f8fafc" fontSize="9.5" fontWeight="600">
                        {nextLowerValidTF
                          ? `کلیک: داده‌ها و سناریوهای ${nextLowerValidTF} (${candleSpan} کندل)`
                          : `پایین‌ترین تایم‌فریم معتبر (${lowestValidTimeframe || timeframe})`}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* Curved Fractal Expected Path (Flow-Path Animation + Confidence-Proportional Opacity) */}
          {expectedPathData && (
            <g pointerEvents="none">
              {/* Soft Confidence-Scaled Outer Glow */}
              <path
                d={expectedPathData.pathD}
                fill="none"
                stroke={expectedPathData.strokeColor}
                strokeWidth="7.5"
                strokeOpacity={expectedPathData.haloOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#elliott-wave-glow)"
              />
              {/* Smooth Bezier Base Guide */}
              <path
                d={expectedPathData.pathD}
                fill="none"
                stroke={expectedPathData.strokeColor}
                strokeWidth="2.4"
                strokeOpacity={expectedPathData.coreOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated Flow-Path Stream */}
              <path
                d={expectedPathData.pathD}
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeOpacity={Math.min(0.95, expectedPathData.coreOpacity + 0.14)}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="fei-expected-flow"
              />
              {/* Directional Arrowhead at Projected Terminal */}
              <path
                d={expectedPathData.arrowPath}
                fill="none"
                stroke={expectedPathData.strokeColor}
                strokeWidth="2.4"
                strokeOpacity={Math.min(1, expectedPathData.coreOpacity + 0.1)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Terminal Target Beacon */}
              <circle
                cx={expectedPathData.tip.x}
                cy={expectedPathData.tip.y}
                r="7.5"
                fill={expectedPathData.strokeColor}
                fillOpacity={expectedPathData.haloOpacity}
                className="fei-expected-pulse"
              />
              <circle
                cx={expectedPathData.tip.x}
                cy={expectedPathData.tip.y}
                r="3.5"
                fill="#ffffff"
                fillOpacity={expectedPathData.coreOpacity}
                stroke={expectedPathData.strokeColor}
                strokeWidth="1.6"
              />
              {/* Compact Confidence & Path Badge */}
              {(() => {
                const bx = Math.max(padding.left + 8, Math.min(width - padding.right - 156, expectedPathData.tip.x - 144));
                const by = expectedPathData.tip.y - 26 >= padding.top + 4 ? expectedPathData.tip.y - 24 : expectedPathData.tip.y + 10;
                return (
                  <g opacity={Math.max(0.7, expectedPathData.coreOpacity)}>
                    <rect
                      x={bx}
                      y={by}
                      width="148"
                      height="19"
                      rx="5"
                      fill="#020617"
                      fillOpacity="0.92"
                      stroke={expectedPathData.strokeColor}
                      strokeOpacity="0.68"
                      strokeWidth="0.9"
                    />
                    <text
                      x={bx + 74}
                      y={by + 12.5}
                      textAnchor="middle"
                      fill="#e0f2fe"
                      fontSize="9"
                      fontWeight="700"
                    >
                      مسیر پیش‌بینی · {expectedPathData.confidencePct}%
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Active Scenario Vertices + TrendStrengthIndicator Color-Coded Signal Icons */}
          {activeScenario.vertices.map((vertex, idx) => {
            const vx = getX(vertex.candleIndex);
            const vy = getY(vertex.price);
            const isHovered = hoveredVertex === idx;
            const isDragging = draggingVertexIndex === idx;
            const isSelected = selectedVertexIndex === idx;
            const vStrength = trendStrengthReport.vertices[idx];
            const badgeY = Math.max(padding.top + 14, vy - 24);
            const placeSignalOnLeft = vx + 40 > width - padding.right;
            const signalOffsetX = placeSignalOnLeft ? -28 : 28;

            const signalColors = (level: TrendSignalLevel) => {
              if (level === 'GREEN') {
                return { bg: '#052e16', border: '#10b981', glyph: '#34d399', text: '#a7f3d0' };
              }
              if (level === 'RED') {
                return { bg: '#4c0519', border: '#f43f5e', glyph: '#fb7185', text: '#fecdd3' };
              }
              return { bg: '#451a03', border: '#f59e0b', glyph: '#fbbf24', text: '#fde68a' };
            };

            const sStyle = vStrength ? signalColors(vStrength.signal) : null;

            return (
              <g
                key={`vertex-${idx}`}
                className={activeScenario.isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
                onMouseEnter={() => setHoveredVertex(idx)}
                onMouseLeave={() => setHoveredVertex(null)}
                onMouseDown={e => handleVertexMouseDown(idx, e)}
                onClick={e => {
                  if (interactionMode === 'EDIT') e.stopPropagation();
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  if (onDoubleClickWaveLeg && idx > 0) {
                    triggerDrillDown(idx - 1);
                  }
                }}
              >
                <circle
                  cx={vx}
                  cy={vy}
                  r={isDragging ? 9 : isHovered || isSelected ? 7.5 : 5.5}
                  fill={scenarioColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected || isDragging ? '2.5' : '1.5'}
                />

                {/* Label Badge */}
                <g transform={`translate(${vx}, ${badgeY})`}>
                  <rect
                    x="-17"
                    y="-12"
                    width="34"
                    height="22"
                    rx="5"
                    fill={isSelected ? scenarioColor : '#080e1c'}
                    stroke={scenarioColor}
                    strokeWidth="1.6"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill={isSelected ? '#020617' : '#ffffff'}
                    fontSize="11"
                    fontWeight="800"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {vertex.label}
                  </text>
                </g>

                {/* Color-Coded Trend Strength Signal Icon (Green / Yellow / Red) */}
                {showTrendStrength && vStrength && sStyle && (
                  <g transform={`translate(${vx + signalOffsetX}, ${badgeY})`}>
                    <title>
                      {`${vStrength.signalLabelFa} (${vStrength.strengthScore}٪) · RSI ${vStrength.rsi} · مومنتوم وزنی حجم ${vStrength.volumeWeightedMomentum}٪ · ${vStrength.divergenceLabelFa}`}
                    </title>
                    <line
                      x1={placeSignalOnLeft ? 10 : -10}
                      y1="-1"
                      x2={placeSignalOnLeft ? 11 : -11}
                      y2="-1"
                      stroke={sStyle.border}
                      strokeOpacity="0.65"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="-9.5"
                      y="-10.5"
                      width="19"
                      height="19"
                      rx="5"
                      fill={sStyle.bg}
                      stroke={sStyle.border}
                      strokeWidth={isHovered || isSelected ? '1.8' : '1.25'}
                    />
                    {vStrength.signal === 'GREEN' ? (
                      /* Distinct Upward Strength Arrow Icon */
                      <path
                        d="M -3.8 1.2 L 0 -3.2 L 3.8 1.2 M 0 -2.8 L 0 3.4"
                        transform="translate(0, -1)"
                        fill="none"
                        stroke={sStyle.glyph}
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : vStrength.signal === 'RED' ? (
                      /* Distinct Exhaustion / Divergence Warning Triangle Icon */
                      <g transform="translate(0, -1)">
                        <path
                          d="M 0 -4.2 L 4.3 3.4 L -4.3 3.4 Z"
                          fill="none"
                          stroke={sStyle.glyph}
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                        <line
                          x1="0"
                          y1="-1.2"
                          x2="0"
                          y2="1.3"
                          stroke={sStyle.glyph}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </g>
                    ) : (
                      /* Distinct Moderate / Transitional Momentum Wave-Bar Icon */
                      <g transform="translate(0, -1)">
                        <path
                          d="M -4 -1.4 Q -2 -3.6 0 -1.4 T 4 -1.4"
                          fill="none"
                          stroke={sStyle.glyph}
                          strokeWidth="1.65"
                          strokeLinecap="round"
                        />
                        <line
                          x1="-3.2"
                          y1="2.4"
                          x2="3.2"
                          y2="2.4"
                          stroke={sStyle.glyph}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </g>
                    )}
                  </g>
                )}

                {(isHovered || isDragging) && (
                  <g
                    transform={`translate(${Math.max(
                      padding.left + 118,
                      Math.min(width - padding.right - 118, vx)
                    )}, ${vy + 28})`}
                    pointerEvents="none"
                  >
                    {showTrendStrength && vStrength && sStyle ? (
                      <>
                        <rect
                          x="-116"
                          y="-12"
                          width="232"
                          height="38"
                          rx="6"
                          fill="#020617"
                          fillOpacity="0.96"
                          stroke={sStyle.border}
                          strokeOpacity="0.75"
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="2"
                          textAnchor="middle"
                          fill="#f8fafc"
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {vertex.price.toLocaleString()} ({vertex.label}) · RSI {vStrength.rsi} · VW {vStrength.volumeWeightedMomentum}%
                        </text>
                        <text
                          x="0"
                          y="17.5"
                          textAnchor="middle"
                          fill={sStyle.text}
                          fontSize="9.2"
                          fontWeight="700"
                        >
                          {vStrength.signalLabelFa} ({vStrength.strengthScore}٪) · {vStrength.divergenceLabelFa}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect x="-56" y="-11" width="112" height="20" rx="4" fill="#020617" stroke="#334155" strokeWidth="1" />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {vertex.price.toLocaleString()} ({vertex.label})
                        </text>
                      </>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Smooth Sidebar-Hover Elliott Wave Path Trace & Glow Layer */}
          {hoveredTraceData && (
            <g
              key={`hover-trace-${hoveredTraceData.scenario.id}`}
              pointerEvents="none"
              style={{ ['--wave-path-len' as string]: hoveredTraceData.totalLength }}
            >
              {/* Soft outer bloom halo */}
              <path
                d={hoveredTraceData.pathD}
                fill="none"
                stroke={hoveredTraceData.color}
                strokeWidth="10"
                strokeOpacity="0.34"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#elliott-wave-glow)"
                className="fei-wave-trace"
              />

              {/* Mid luminous neon wave stroke */}
              <path
                d={hoveredTraceData.pathD}
                fill="none"
                stroke={hoveredTraceData.color}
                strokeWidth="5"
                strokeOpacity="0.88"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#elliott-wave-glow)"
                className="fei-wave-trace"
              />

              {/* Crisp bright centerline core */}
              <path
                d={hoveredTraceData.pathD}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.9"
                strokeOpacity="0.92"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="fei-wave-trace"
              />

              {/* Directional flowing shimmer along wave segments */}
              <path
                d={hoveredTraceData.pathD}
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeOpacity="0.55"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="fei-wave-glow-flow"
              />

              {/* Staggered glowing vertex nodes & labels */}
              {hoveredTraceData.pts.map((pt, vIdx) => {
                const progress = hoveredTraceData.pts.length > 1 ? vIdx / (hoveredTraceData.pts.length - 1) : 0;
                const delayMs = Math.round(progress * 360);
                const showHoverBadge = hoveredTraceData.scenario.id !== activeScenario.id;
                return (
                  <g
                    key={`ht-node-${vIdx}`}
                    className="fei-vertex-bloom"
                    style={{ animationDelay: `${delayMs}ms` }}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="9.5"
                      fill={hoveredTraceData.color}
                      fillOpacity="0.24"
                      filter="url(#elliott-wave-glow)"
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="5.5"
                      fill={hoveredTraceData.color}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    {showHoverBadge && (
                      <g transform={`translate(${pt.x}, ${pt.y - 22})`}>
                        <rect
                          x="-15"
                          y="-11"
                          width="30"
                          height="19"
                          rx="4"
                          fill="#080e1c"
                          stroke={hoveredTraceData.color}
                          strokeWidth="1.4"
                        />
                        <text
                          x="0"
                          y="2.5"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10.5"
                          fontWeight="800"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {pt.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Starting Candle & Horizontal Absolute Bottom Draggable Anchor Handle */}
          {absoluteBottom && (
            <g
              onMouseDown={handleBottomMouseDown}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle
                cx={getX(absoluteBottom.candleIndex)}
                cy={getY(absoluteBottom.price)}
                r="11"
                fill="#f59e0b"
                fillOpacity="0.18"
              />
              <circle
                cx={getX(absoluteBottom.candleIndex)}
                cy={getY(absoluteBottom.price)}
                r="6.5"
                fill="#f59e0b"
                stroke="#020617"
                strokeWidth="2"
              />
              <g transform={`translate(${getX(absoluteBottom.candleIndex)}, ${getY(absoluteBottom.price) + 24})`}>
                <rect x="-78" y="-11" width="156" height="20" rx="5" fill="#451a03" stroke="#f59e0b" strokeWidth="1.2" />
                <text x="0" y="3" textAnchor="middle" fill="#fde68a" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                  کندل شروع #{absoluteBottom.candleIndex + 1} · کف {absoluteBottom.price.toLocaleString()}
                </text>
              </g>
            </g>
          )}

          {/* Crosshair */}
          {mousePos && mousePos.x >= padding.left && mousePos.x <= width - padding.right && (
            <g opacity="0.5" pointerEvents="none">
              <line
                x1={mousePos.x}
                y1={padding.top}
                x2={mousePos.x}
                y2={height - padding.bottom}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={padding.left}
                y1={mousePos.y}
                x2={width - padding.right}
                y2={mousePos.y}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>

        {/* Glassmorphic Graphical PRZ Containers (Frosted Glass, Luminous Gradients, Neon Borders, Timeframe & Price-Level Synced) */}
        {effectiveShowPRZ &&
          renderedPrzBoxes.map(box => {
            const { prz, hiPrice, loPrice, yTop, yMid, bandH, xStart, bandW, candleSpan, signedDist } = box;
            const isBullZone = prz.direction === 'BULLISH';
            const isHovered = hoveredZoneId === prz.id;
            const isDimmed = Boolean(hoveredZoneId && !isHovered);
            const midPct = Math.max(8, Math.min(92, ((yMid - yTop) / Math.max(1, bandH)) * 100));
            const labelInside = bandH >= 36;
            const showAbove = !labelInside && yTop - 26 >= padding.top;

            const neonHex = isBullZone ? '#fbbf24' : '#fb923c';
            const accentHex = isBullZone ? '#f59e0b' : '#f97316';
            const gradientBg = isBullZone
              ? 'linear-gradient(105deg, rgba(245, 158, 11, 0.22) 0%, rgba(251, 191, 36, 0.08) 45%, rgba(16, 185, 129, 0.14) 100%)'
              : 'linear-gradient(105deg, rgba(251, 146, 60, 0.22) 0%, rgba(249, 115, 22, 0.08) 45%, rgba(244, 63, 94, 0.15) 100%)';

            return (
              <div
                key={`glass-prz-${prz.id}`}
                aria-label={`ناحیه افقی PRZ در بازه ${loPrice.toLocaleString()} تا ${hiPrice.toLocaleString()}`}
                className="absolute pointer-events-none select-none transition-all duration-200"
                style={{
                  left: `${(xStart / Math.max(1, width)) * 100}%`,
                  top: `${(yTop / Math.max(1, height)) * 100}%`,
                  width: `${(bandW / Math.max(1, width)) * 100}%`,
                  height: `${(bandH / Math.max(1, height)) * 100}%`,
                  opacity: isDimmed ? 0.5 : prz.isPrimary ? 1 : 0.72,
                  zIndex: isHovered ? 6 : 3
                }}
              >
                {/* Frosted Glassmorphism Box with Luminous Inner Glow & Neon Perimeter */}
                <div
                  className="relative w-full h-full rounded-[4px] overflow-hidden backdrop-blur-[5px]"
                  style={{
                    backgroundImage: `${gradientBg}, radial-gradient(ellipse at 50% 50%, ${
                      isBullZone ? 'rgba(251, 191, 36, 0.16)' : 'rgba(251, 146, 60, 0.16)'
                    } 0%, rgba(9, 14, 28, 0.34) 78%)`,
                    border: `1px solid ${isHovered ? neonHex : `${accentHex}88`}`,
                    boxShadow: isHovered
                      ? `0 0 22px ${neonHex}55, inset 0 0 20px ${neonHex}26, inset 0 1px 0 rgba(255,255,255,0.28)`
                      : `0 0 14px ${neonHex}26, inset 0 0 12px ${neonHex}14, inset 0 1px 0 rgba(255,255,255,0.16)`
                  }}
                >
                  {/* Top & Bottom Neon Price-Level Rails */}
                  <div
                    className="absolute inset-x-0 top-0 h-[1.5px]"
                    style={{
                      background: `linear-gradient(90deg, ${neonHex}cc 0%, #fef3c7aa 50%, ${neonHex}cc 100%)`,
                      boxShadow: `0 0 8px ${neonHex}99`
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[1.5px]"
                    style={{
                      background: `linear-gradient(90deg, ${neonHex}cc 0%, #fef3c7aa 50%, ${neonHex}cc 100%)`,
                      boxShadow: `0 0 8px ${neonHex}99`
                    }}
                  />

                  {/* Mid-Price Equilibrium Neon Dashed Rail */}
                  {bandH >= 20 && (
                    <div
                      className="absolute inset-x-2 border-t border-dashed"
                      style={{
                        top: `${midPct}%`,
                        borderColor: isHovered ? `${neonHex}cc` : `${neonHex}66`
                      }}
                    />
                  )}

                  {/* 4 Luminous L-Corner Neon Brackets */}
                  <span
                    className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 rounded-tl-[2px]"
                    style={{ borderColor: neonHex, filter: `drop-shadow(0 0 4px ${neonHex})` }}
                  />
                  <span
                    className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 rounded-tr-[2px]"
                    style={{ borderColor: neonHex, filter: `drop-shadow(0 0 4px ${neonHex})` }}
                  />
                  <span
                    className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 rounded-bl-[2px]"
                    style={{ borderColor: neonHex, filter: `drop-shadow(0 0 4px ${neonHex})` }}
                  />
                  <span
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 rounded-br-[2px]"
                    style={{ borderColor: neonHex, filter: `drop-shadow(0 0 4px ${neonHex})` }}
                  />

                  {/* Clean Unboxed Metadata Header Inside Container (when band height permits) */}
                  {labelInside && (
                    <div className="relative z-10 flex items-center justify-between gap-3 px-3 pt-1.5 text-[10px] leading-none">
                      <div className="flex items-center gap-1.5 min-w-0 truncate font-semibold text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        <span className="text-amber-300 font-mono whitespace-nowrap">PRZ</span>
                        <span aria-hidden="true" className="text-amber-400/60">·</span>
                        <span className="truncate">{prz.labelFa.replace(/^PRZ\s*/i, '')}</span>
                        <span aria-hidden="true" className="text-amber-400/60">·</span>
                        <span className="font-mono text-cyan-200 whitespace-nowrap">{timeframe}</span>
                        <span aria-hidden="true" className="text-amber-400/60">·</span>
                        <span className="font-mono tabular-nums text-amber-200 whitespace-nowrap">{prz.confidence}%</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 font-mono tabular-nums text-[9.5px] text-amber-200/95 whitespace-nowrap shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        <span>{loPrice.toLocaleString()}</span>
                        <span className="text-amber-400/60">–</span>
                        <span>{hiPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compact Floating Header Strip when Band is Thin (< 36px) */}
                {!labelInside && (
                  <div
                    className="absolute right-2 flex items-center gap-2 px-2.5 py-1 rounded-md backdrop-blur-md text-[9.5px] whitespace-nowrap shadow-lg"
                    style={{
                      ...(showAbove ? { bottom: 'calc(100% + 5px)' } : { top: 'calc(100% + 5px)' }),
                      background: 'rgba(8, 13, 26, 0.86)',
                      border: `1px solid ${neonHex}77`,
                      boxShadow: `0 0 12px ${neonHex}30`
                    }}
                  >
                    <span className="font-mono font-bold text-amber-300">PRZ</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-amber-100 font-medium">{prz.labelFa.replace(/^PRZ\s*/i, '')}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="font-mono text-cyan-300">{timeframe}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="font-mono tabular-nums text-amber-200">{prz.confidence}%</span>
                  </div>
                )}

                {/* Glassmorphic Hover Inspector Card */}
                {isHovered && (
                  <div
                    className="absolute left-2 w-[264px] rounded-lg px-3 py-2 backdrop-blur-xl shadow-2xl"
                    style={{
                      ...(yTop - 68 >= padding.top ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
                      background: 'linear-gradient(135deg, rgba(10, 16, 34, 0.92), rgba(28, 18, 8, 0.88))',
                      border: `1px solid ${neonHex}bb`,
                      boxShadow: `0 8px 28px rgba(0, 0, 0, 0.55), 0 0 18px ${neonHex}38`
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                      <span className={isBullZone ? 'text-amber-200' : 'text-orange-200'}>
                        {isBullZone ? '↑ ناحیه حمایت بازگشتی PRZ' : '↓ ناحیه مقاومت بازگشتی PRZ'}
                      </span>
                      <span className="font-mono tabular-nums text-cyan-300">{signedDist}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[9.5px] font-mono tabular-nums text-slate-300">
                      <span>Mid {prz.midPrice.toLocaleString()}</span>
                      <span>
                        {loPrice.toLocaleString()} – {hiPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 pt-1 border-t border-amber-500/20 flex items-center justify-between text-[9px] text-amber-300/90">
                      <span className="truncate">{prz.contributingRatios.slice(0, 2).join(' · ')}</span>
                      <span className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {candleSpan} کندل ({timeframe})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {/* Inline Vertex Editor Popover (Rename / Delete / Drill-down) */}
        {selectedVertex && selectedVertexIndex !== null && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute top-14 right-4 z-20 w-72 bg-[#0b1324] border border-slate-700 rounded-xl p-3 shadow-2xl space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>ویرایش نقطه «{selectedVertex.label}»</span>
              </div>
              <button onClick={() => setSelectedVertexIndex(null)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-mono tabular-nums flex items-center justify-between bg-slate-900/70 px-2.5 py-1.5 rounded-lg">
              <span>قیمت: {selectedVertex.price.toLocaleString()}</span>
              <span>کندل: #{selectedVertex.candleIndex + 1}</span>
            </div>

            {(() => {
              const selStrength = trendStrengthReport.vertices[selectedVertexIndex];
              if (!selStrength) return null;
              const badgeCls =
                selStrength.signal === 'GREEN'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : selStrength.signal === 'RED'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-200';
              return (
                <div className={`rounded-lg border px-2.5 py-2 space-y-1 text-[10.5px] ${badgeCls}`}>
                  <div className="flex items-center justify-between gap-2 font-bold">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3 shrink-0" />
                      <span>{selStrength.signalLabelFa}</span>
                    </span>
                    <span className="font-mono tabular-nums">{selStrength.strengthScore}٪</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] opacity-90 font-mono tabular-nums">
                    <span>RSI: {selStrength.rsi}</span>
                    <span>VW-Mom: {selStrength.volumeWeightedMomentum}%</span>
                    <span>حجم: {selStrength.volumeRatio}x</span>
                  </div>
                  <div className="text-[10px] opacity-90">{selStrength.divergenceLabelFa}</div>
                </div>
              );
            })()}

            {!activeScenario.isLocked && (
              <>
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400 block">تغییر سریع برچسب موج:</span>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_LABELS.map(lbl => (
                      <button
                        key={lbl}
                        onClick={() => handleRenameVertex(selectedVertexIndex, lbl)}
                        className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                          selectedVertex.label === lbl
                            ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={customLabelInput}
                      onChange={e => setCustomLabelInput(e.target.value)}
                      placeholder="لیبل دلخواه..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => handleRenameVertex(selectedVertexIndex, customLabelInput)}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg"
                    >
                      ثبت
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 gap-2">
                  {onDoubleClickWaveLeg && selectedVertexIndex > 0 && (
                    <button
                      onClick={() => {
                        triggerDrillDown(selectedVertexIndex - 1);
                        setSelectedVertexIndex(null);
                      }}
                      disabled={!nextLowerValidTF && Boolean(lowestValidTimeframe)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-300 rounded-lg text-[11px] font-medium disabled:opacity-40"
                    >
                      <Layers className="w-3 h-3" />
                      <span>{nextLowerValidTF ? `ریزش به ${nextLowerValidTF}` : 'پایین‌ترین تایم معتبر'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteVertex(selectedVertexIndex)}
                    disabled={activeScenario.vertices.length === 0}
                    className="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-300 rounded-lg text-[11px] disabled:opacity-35"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>حذف</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Floating Wave Metrics & Market Trend Regime HUD */}
        {(hudInfo || candles.length >= 6) && (
          <div className="absolute top-3 left-3 bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] flex items-center gap-3 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">روند:</span>
              <strong
                className={
                  marketTrend.regime === 'IMPULSE'
                    ? 'text-emerald-400 font-semibold'
                    : marketTrend.regime === 'CORRECTION'
                    ? 'text-amber-300 font-semibold'
                    : 'text-slate-300 font-semibold'
                }
              >
                {marketTrend.shortLabelFa}
              </strong>
            </div>
            {hudInfo && (
              <>
                <div className="h-3.5 w-px bg-slate-800" />
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-500">اصلاح موج ۲:</span>
                  <strong className="text-cyan-400 font-mono tabular-nums">{hudInfo.retrace2Pct}%</strong>
                </div>
                <div className="h-3.5 w-px bg-slate-800" />
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-500">موج ۳ / ۱:</span>
                  <strong className="text-indigo-400 font-mono tabular-nums">{hudInfo.w3Ratio}x</strong>
                </div>
                <div className="h-3.5 w-px bg-slate-800" />
                <div className="flex items-center gap-1">
                  {hudInfo.hasOverlap ? (
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> هم‌پوشانی ۴ و ۱
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> بدون هم‌پوشانی
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Drill-Down Lowest TF Notice Banner */}
        {drillNotice && (
          <div className="absolute top-3 right-4 z-20 flex items-center gap-2 bg-amber-950/95 border border-amber-500/40 text-amber-200 px-3 py-1.5 rounded-lg text-[11px] shadow-xl">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{drillNotice}</span>
            <button onClick={() => setDrillNotice(null)} className="text-amber-300 hover:text-white mr-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Interactive Rule Diagnostic & Auto-Fix Overlay Panel */}
        {diagnosticOpen && diagnosticSummary && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute top-3 left-3 bottom-14 z-30 w-[calc(100%-1.5rem)] sm:w-[430px] max-w-full flex flex-col justify-start pointer-events-auto"
          >
            <RuleDiagnosticsPanel
              scenario={activeScenario}
              summary={diagnosticSummary}
              candles={candles}
              parentRole={parentRole}
              parentWaveLabel={parentWaveLabel}
              onApplyPattern={onPatternChange}
              onApplyVertices={onUpdateVertices}
              onRevalidate={evaluateCurrentCount}
              onClose={() => setDiagnosticOpenById(prev => ({ ...prev, [activeScenario.id]: false }))}
              variant="overlay"
            />
          </div>
        )}

        {/* Strict Step-by-Step PatternValidator Overlay Panel */}
        {validatorOpen && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute top-3 left-3 bottom-14 z-30 w-[calc(100%-1.5rem)] sm:w-[445px] max-w-full flex flex-col justify-start pointer-events-auto"
          >
            <PatternValidator
              scenario={activeScenario}
              candles={candles}
              parentRole={parentRole}
              parentWaveLabel={parentWaveLabel}
              onApplyPattern={onPatternChange}
              onApplyVertices={onUpdateVertices}
              onValidationComplete={summary => onValidateActiveScenario?.(activeScenario.id, summary)}
              onHighlightLeg={setValidatorHighlightLeg}
              onClose={() => {
                setValidatorHighlightLeg(null);
                setValidatorOpenById(prev => ({ ...prev, [activeScenario.id]: false }));
              }}
              variant="overlay"
            />
          </div>
        )}

        {/* Active Mode Instruction Strip */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-950/95 border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-slate-300 shadow-lg">
          {interactionMode === 'PICK_BOTTOM' ? (
            <>
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>انتخاب کندل شروع: روی هر کندل کلیک کنید تا خط افقی کف مطلق و خط عمودی کندل شروع هم‌زمان تنظیم شوند.</span>
            </>
          ) : interactionMode === 'ADD_VERTEX' ? (
            <>
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>حالت افزودن نقطه: روی هر کندل در نمودار کلیک کنید تا پیوت جدید درج شود.</span>
              {!hideToolbarLockAndReset && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    evaluateCurrentCount();
                  }}
                  className="mr-1.5 flex items-center gap-1 px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10.5px] font-bold transition-colors"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>اتمام و ارزیابی قوانین</span>
                </button>
              )}
              {onChangeInteractionMode && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onChangeInteractionMode('EDIT');
                  }}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px]"
                >
                  اتمام
                </button>
              )}
            </>
          ) : interactionMode === 'DRAW_SCRATCH' ? (
            <>
              <PenTool className="w-3.5 h-3.5 text-emerald-400" />
              <span>حالت ترسیم از صفر: به ترتیب روی نقاط پیوت کلیک کنید ({activeScenario.vertices.length} نقطه ثبت شده).</span>
              {!hideToolbarLockAndReset && activeScenario.vertices.length >= 2 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    evaluateCurrentCount();
                  }}
                  className="mr-1.5 flex items-center gap-1 px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10.5px] font-bold transition-colors"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>پایان و ارزیابی قوانین</span>
                </button>
              )}
              {onChangeInteractionMode && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onChangeInteractionMode('EDIT');
                  }}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-medium"
                >
                  انصراف/ویرایش
                </button>
              )}
            </>
          ) : (
            <>
              <Move className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {activeScenario.isLocked
                  ? 'سناریو قفل است؛ برای تغییر نقاط قفل را باز کنید.'
                  : onDoubleClickWaveLeg && nextLowerValidTF
                  ? `برای مشاهده داده‌ها و سناریوهای ${nextLowerValidTF} روی هر موج کلیک کنید، یا نقاط را بکشید.`
                  : onDoubleClickWaveLeg
                  ? `در پایین‌ترین تایم‌فریم معتبر (${lowestValidTimeframe || timeframe}) هستید؛ نقاط را بکشید یا کلیک کنید.`
                  : 'نقاط پیوت را بکشید یا برای تغییر لیبل و حذف روی هر نقطه کلیک کنید.'}
              </span>
              {!hideToolbarLockAndReset && isUserModifiedCount && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    evaluateCurrentCount();
                  }}
                  className={`mr-1.5 flex items-center gap-1 px-2.5 py-0.5 rounded text-[10.5px] font-bold transition-colors ${
                    activeHardFailsCount > 0
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{activeHardFailsCount > 0 ? 'بررسی خطا و اصلاح' : 'ارزیابی تغییرات'}</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Bottom-Left Horizontal Zones & Fibonacci Basis Strip */}
        {!hideZoneControls && (
          <div className="hidden lg:flex flex-col items-start gap-1.5 absolute bottom-3 left-3 z-10 pointer-events-auto">
            {(renderedPrzBoxes.length > 0 || renderedTmvBoxes.length > 0) && (
              <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 px-2 py-1 rounded-lg text-[10px] shadow-lg">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    togglePRZ();
                  }}
                  className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
                    effectiveShowPRZ
                      ? 'bg-amber-500/15 text-amber-200 border border-amber-500/35'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="نمایش / مخفی‌سازی مستطیل افقی بازگشت PRZ"
                >
                  <span className="w-2.5 h-1.5 rounded-[2px] bg-amber-400 inline-block" />
                  <span>PRZ افقی</span>
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    toggleTMV();
                  }}
                  className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
                    effectiveShowTMV
                      ? 'bg-sky-500/15 text-sky-200 border border-sky-500/35'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="نمایش / مخفی‌سازی مستطیل افقی اهداف TMV"
                >
                  <span className="w-2.5 h-1.5 rounded-[2px] bg-sky-400 inline-block" />
                  <span>TMV افقی</span>
                </button>
              </div>
            )}

            {effectiveShowFibLayers && projectionReport?.completedStructure && (
              <div className="flex items-center gap-2 bg-slate-950/90 border border-emerald-500/35 px-2.5 py-1.5 rounded-lg text-[10.5px] text-slate-200 shadow-lg pointer-events-none">
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-400">مبنای اکستنشن:</span>
                <strong className="text-emerald-300 font-semibold">
                  {projectionReport.completedStructure.structureLabelFa}
                </strong>
                <span className="text-slate-600">·</span>
                <span className="font-mono tabular-nums text-cyan-300">
                  {projectionReport.extensionLayers?.length || 0} لایه
                </span>
              </div>
            )}
          </div>
        )}

        {/* Non-Intrusive Real-Time Hard Rule Violation Toast Notification */}
        {(violationToast || revertedToastMsg) && !hideZoneControls && (
          <div className="absolute bottom-14 right-[96px] left-4 sm:left-auto sm:w-[420px] z-40 pointer-events-none">
            <RuleViolationToast
              toast={violationToast}
              revertedMessage={revertedToastMsg}
              onRevertToLastValid={handleRevertToLastValidState}
              onOpenValidator={
                !hideToolbarLockAndReset
                  ? () => {
                      setDiagnosticOpenById(prev => ({ ...prev, [activeScenario.id]: false }));
                      setValidatorOpenById(prev => ({ ...prev, [activeScenario.id]: true }));
                      setViolationToast(null);
                    }
                  : undefined
              }
              onDismiss={() => setViolationToast(null)}
              onClearReverted={() => setRevertedToastMsg(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
