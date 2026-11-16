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
  Activity
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
  showTMW?: boolean;
  onToggleShowTMW?: () => void;
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
  showTMW: controlledShowTMW,
  onToggleShowTMW,
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
  const [internalShowPRZ, setInternalShowPRZ] = useState<boolean>(true);
  const [internalShowTMW, setInternalShowTMW] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showTrendStrength, setShowTrendStrength] = useState<boolean>(true);
  const [snapToCandleExtreme, setSnapToCandleExtreme] = useState<boolean>(true);
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
  const effectiveShowTMW = !hideZoneControls && (controlledShowTMW ?? internalShowTMW);
  const effectiveShowFibLayers = !hideZoneControls && showFibLayers;
  const togglePRZ = () => {
    if (onToggleShowPRZ) onToggleShowPRZ();
    else setInternalShowPRZ(p => !p);
  };
  const toggleTMW = () => {
    if (onToggleShowTMW) onToggleShowTMW();
    else setInternalShowTMW(p => !p);
  };

  const diagnosticOpen = Boolean(diagnosticOpenById[activeScenario.id]);
  const diagnosticSummary = diagnosticSummaryById[activeScenario.id] || null;
  const validatorOpen = Boolean(validatorOpenById[activeScenario.id]);

  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({
            width: Math.max(480, clientWidth),
            height: Math.max(400, clientHeight)
          });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Reset selected vertex popover & hovered leg when active scenario, timeframe, or mode changes
  useEffect(() => {
    setSelectedVertexIndex(null);
    setHoveredLeg(null);
    setHoveredExtLayerId(null);
    setDrillNotice(null);
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

  // Dynamic completed-structure Fibonacci extensions, PRZ, TMW & Targets via TargetProjectionEngine
  const projectionReport = useMemo(() => {
    if (hideZoneControls || activeScenario.vertices.length < 2) return null;
    return TargetProjectionEngine.projectScenario(activeScenario, candles, parentRole, parentWaveLabel);
  }, [hideZoneControls, activeScenario, candles, parentRole, parentWaveLabel]);

  // RSI Divergence & Volume-Weighted Momentum per segment and vertex via TrendStrengthIndicator
  const trendStrengthReport = useMemo(() => {
    return TrendStrengthIndicator.analyzeScenario(activeScenario, candles);
  }, [activeScenario, candles]);

  // Extra future candle slots on the right edge when TMW time-window extends beyond last candle
  const maxPlotIndex = useMemo(() => {
    const baseMax = Math.max(1, candles.length - 1);
    if (!effectiveShowTMW || !projectionReport || projectionReport.tmwZones.length === 0) {
      return baseMax;
    }
    const maxTmwEnd = Math.max(...projectionReport.tmwZones.map(z => z.endCandleIndex));
    const tail = Math.min(28, Math.max(0, maxTmwEnd - (candles.length - 1) + 2));
    return baseMax + tail;
  }, [candles.length, effectiveShowTMW, projectionReport]);

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
    const guardLow = candleMin - candleSpan * 0.45;
    const guardHigh = candleMax + candleSpan * 0.45;

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
        if (z.lowPrice >= guardLow && z.highPrice <= guardHigh) {
          if (z.lowPrice < min) min = z.lowPrice;
          if (z.highPrice > max) max = z.highPrice;
        }
      });
    }
    if (absoluteBottom) {
      if (absoluteBottom.price < min) min = absoluteBottom.price;
      if (absoluteBottom.price > max) max = absoluteBottom.price;
    }

    const range = max - min || 1;
    return {
      minPrice: min - range * 0.06,
      maxPrice: max + range * 0.09,
      priceRange: range * 1.15,
      maxVolume: maxVol || 1
    };
  }, [candles, activeScenario, showTargets, hideZoneControls, effectiveShowPRZ, effectiveShowFibLayers, projectionReport, absoluteBottom]);

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
    const updated = activeScenario.vertices.map((v, i) =>
      i === draggingVertexIndex
        ? {
            ...v,
            candleIndex,
            price,
            timestamp
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
    dragStartPosRef.current = null;
    frozenBoundsRef.current = null;
  };

  const mouseMoveRef = useRef(handleMouseMove);
  const mouseUpRef = useRef(handleMouseUp);
  mouseMoveRef.current = handleMouseMove;
  mouseUpRef.current = handleMouseUp;

  useEffect(() => {
    if (draggingVertexIndex === null && !draggingBottom) return;
    const onWinMove = (ev: MouseEvent) => mouseMoveRef.current(ev);
    const onWinUp = () => mouseUpRef.current();
    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
    return () => {
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('mouseup', onWinUp);
    };
  }, [draggingVertexIndex, draggingBottom]);

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

      const newVertex: WaveVertex = {
        label: nextLabel,
        candleIndex,
        price,
        timestamp,
        isConfirmed: true
      };

      const nextList =
        interactionMode === 'DRAW_SCRATCH'
          ? [...current, newVertex].sort((a, b) => a.candleIndex - b.candleIndex)
          : [...current, newVertex].sort((a, b) => a.candleIndex - b.candleIndex);

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

          {!hideZoneControls && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={togglePRZ}
                title="نمایش یا مخفی کردن ناحیه پتانسیل بازگشت قیمتی (PRZ)"
                className={`px-2 py-1 text-[11px] font-mono font-bold rounded-md transition-colors ${
                  effectiveShowPRZ
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                PRZ
              </button>
              <button
                onClick={toggleTMW}
                title="نمایش یا مخفی کردن پنجره زمانی بازگشت (TMW)"
                className={`px-2 py-1 text-[11px] font-mono font-bold rounded-md transition-colors ${
                  effectiveShowTMW
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                TMW
              </button>
              <button
                onClick={() => setShowFibLayers(prev => !prev)}
                title="نمایش یا مخفی کردن لایه‌های افقی اکستنشن فیبوناچی بر اساس آخرین ساختار تکمیل‌شده"
                className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
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
                className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                  showTargets
                    ? 'bg-indigo-500/25 text-indigo-200 font-semibold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                اهداف
              </button>
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
          draggingVertexIndex !== null || draggingBottom
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
            <linearGradient id="tmwCorridorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.16" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.14" />
            </linearGradient>
            <linearGradient id="przBullGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.20" />
            </linearGradient>
            <linearGradient id="przBearGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
              <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.22" />
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

          {/* TMW Vertical Time Window Corridors & Future Projection Divider */}
          {maxPlotIndex > candles.length - 1 && candles.length > 0 && (
            <g pointerEvents="none">
              <rect
                x={getX(candles.length - 1)}
                y={padding.top}
                width={Math.max(0, width - padding.right - getX(candles.length - 1))}
                height={Math.max(0, height - padding.top - padding.bottom - volumeHeight)}
                fill="#020617"
                fillOpacity="0.28"
              />
              <line
                x1={getX(candles.length - 1)}
                y1={padding.top}
                x2={getX(candles.length - 1)}
                y2={height - padding.bottom - volumeHeight}
                stroke="#475569"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            </g>
          )}

          {effectiveShowTMW &&
            projectionReport?.tmwZones.map(tmw => {
              const xStart = Math.max(padding.left, getX(tmw.startCandleIndex));
              const xEnd = Math.min(width - padding.right, getX(tmw.endCandleIndex));
              const zoneW = Math.max(12, xEnd - xStart);
              const plotHeight = Math.max(0, height - padding.top - padding.bottom - volumeHeight);
              const cx = xStart + zoneW / 2;

              return (
                <g key={tmw.id} pointerEvents="none">
                  <rect
                    x={xStart}
                    y={padding.top}
                    width={zoneW}
                    height={plotHeight}
                    fill="url(#tmwCorridorGrad)"
                  />
                  <line
                    x1={xStart}
                    y1={padding.top}
                    x2={xStart}
                    y2={padding.top + plotHeight}
                    stroke="#22d3ee"
                    strokeOpacity="0.55"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={xStart + zoneW}
                    y1={padding.top}
                    x2={xStart + zoneW}
                    y2={padding.top + plotHeight}
                    stroke="#22d3ee"
                    strokeOpacity="0.55"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  {/* Crisp unboxed top time label */}
                  <rect
                    x={Math.max(padding.left + 2, Math.min(width - padding.right - 132, cx - 65))}
                    y={padding.top + 6}
                    width="130"
                    height="20"
                    rx="4"
                    fill="#082f49"
                    fillOpacity="0.92"
                    stroke="#22d3ee"
                    strokeOpacity="0.6"
                    strokeWidth="0.9"
                  />
                  <text
                    x={Math.max(padding.left + 67, Math.min(width - padding.right - 67, cx))}
                    y={padding.top + 19}
                    textAnchor="middle"
                    fill="#cffafe"
                    fontSize="9.5"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    TMW #{tmw.startCandleIndex + 1}–#{tmw.endCandleIndex + 1}
                  </text>
                </g>
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

          {/* PRZ (Potential Reversal Zones) & Time-Price Confluence Box */}
          {effectiveShowPRZ &&
            projectionReport?.przZones.map(prz => {
              const plotTop = padding.top;
              const plotBottom = height - padding.bottom - volumeHeight;
              const rawYTop = getY(prz.highPrice);
              const rawYBot = getY(prz.lowPrice);
              if (rawYBot < plotTop || rawYTop > plotBottom) return null;
              const yTop = Math.max(plotTop, rawYTop);
              const yBot = Math.min(plotBottom, rawYBot);
              const bandH = Math.max(10, yBot - yTop);
              const isBullZone = prz.direction === 'BULLISH';
              const strokeCol = isBullZone ? '#10b981' : '#f59e0b';
              const fillUrl = isBullZone ? 'url(#przBullGrad)' : 'url(#przBearGrad)';
              const primaryTmw = effectiveShowTMW ? projectionReport.tmwZones[0] : null;
              const tmwX1 = primaryTmw ? Math.max(padding.left, getX(primaryTmw.startCandleIndex)) : 0;
              const tmwX2 = primaryTmw ? Math.min(width - padding.right, getX(primaryTmw.endCandleIndex)) : 0;

              return (
                <g key={prz.id} pointerEvents="none">
                  <rect
                    x={padding.left}
                    y={yTop}
                    width={Math.max(0, width - padding.right - padding.left)}
                    height={bandH}
                    fill={fillUrl}
                  />
                  <line
                    x1={padding.left}
                    y1={yTop}
                    x2={width - padding.right}
                    y2={yTop}
                    stroke={strokeCol}
                    strokeWidth="1.15"
                    strokeDasharray="5 3"
                    strokeOpacity="0.85"
                  />
                  <line
                    x1={padding.left}
                    y1={yTop + bandH}
                    x2={width - padding.right}
                    y2={yTop + bandH}
                    stroke={strokeCol}
                    strokeWidth="1.15"
                    strokeDasharray="5 3"
                    strokeOpacity="0.85"
                  />

                  {/* PRZ Label inside Left edge */}
                  <rect
                    x={padding.left + 8}
                    y={yTop + 4}
                    width="240"
                    height="18"
                    rx="4"
                    fill="#020617"
                    fillOpacity="0.82"
                    stroke={strokeCol}
                    strokeOpacity="0.55"
                    strokeWidth="0.8"
                  />
                  <text
                    x={padding.left + 14}
                    y={yTop + 16}
                    fill={isBullZone ? '#a7f3d0' : '#fde68a'}
                    fontSize="9.5"
                    fontWeight="700"
                  >
                    {prz.labelFa} · {prz.contributingRatios.join(' + ')}
                  </text>

                  {/* Right Axis PRZ Range Marker */}
                  <rect
                    x={width - padding.right + 2}
                    y={yTop + bandH / 2 - 10}
                    width="82"
                    height="20"
                    rx="4"
                    fill={isBullZone ? '#064e3b' : '#451a03'}
                    stroke={strokeCol}
                    strokeWidth="0.9"
                  />
                  <text
                    x={width - padding.right + 6}
                    y={yTop + bandH / 2 + 3.5}
                    fill={isBullZone ? '#6ee7b7' : '#fcd34d'}
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    PRZ {prz.midPrice.toLocaleString()}
                  </text>

                  {/* Golden Time-Price Confluence Intersection Box (PRZ x TMW) */}
                  {prz.isPrimary && primaryTmw && tmwX2 > tmwX1 && (
                    <g>
                      <rect
                        x={tmwX1}
                        y={yTop}
                        width={tmwX2 - tmwX1}
                        height={bandH}
                        fill={strokeCol}
                        fillOpacity="0.16"
                        stroke="#f8fafc"
                        strokeOpacity="0.75"
                        strokeWidth="1.4"
                        strokeDasharray="4 2"
                      />
                      <circle
                        cx={(tmwX1 + tmwX2) / 2}
                        cy={yTop + bandH / 2}
                        r="4.5"
                        fill={strokeCol}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}
                </g>
              );
            })}

          {/* Dynamic Horizontal Fibonacci Extension Layers (TargetProjectionEngine) */}
          {effectiveShowFibLayers &&
            projectionReport?.extensionLayers &&
            projectionReport.extensionLayers.length > 0 &&
            (() => {
              const plotTop = padding.top;
              const plotBottom = height - padding.bottom - volumeHeight;
              const endX = width - padding.right;
              const usedAxisYs: number[] = [];
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

                    const canPlaceAxisLabel =
                      isHovered || usedAxisYs.every(prevY => Math.abs(prevY - centerY) >= 18);
                    if (canPlaceAxisLabel && !isHovered) usedAxisYs.push(centerY);

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
                        {/* Invisible wide hit strip for effortless hover */}
                        <rect
                          x={startX}
                          y={centerY - 7}
                          width={layerW}
                          height={14}
                          fill="transparent"
                        />

                        {/* Shaded Dynamic Horizontal Extension Band */}
                        <rect
                          x={startX}
                          y={yTop}
                          width={layerW}
                          height={bandH}
                          fill={style.fill}
                          fillOpacity={isHovered ? 0.95 : layer.tier === 'PRIMARY' || layer.tier === 'TMV' ? 0.8 : 0.55}
                          stroke={isHovered ? style.stroke : 'none'}
                          strokeWidth={isHovered ? 0.9 : 0}
                          strokeOpacity={0.65}
                        />

                        {/* Extension Centerline */}
                        <line
                          x1={startX}
                          y1={centerY}
                          x2={endX}
                          y2={centerY}
                          stroke={style.stroke}
                          strokeWidth={isHovered ? 2 : layer.tier === 'PRIMARY' || layer.tier === 'TMV' ? 1.35 : 1}
                          strokeDasharray={isHovered ? undefined : style.dash}
                          strokeOpacity={isHovered ? 1 : layer.tier === 'EXTREME' ? 0.65 : 0.85}
                        />

                        {/* Anchor Launch Node on Left Edge */}
                        <circle
                          cx={startX}
                          cy={centerY}
                          r={isHovered ? 4 : 2.8}
                          fill={style.stroke}
                          stroke="#080d1a"
                          strokeWidth="1"
                        />

                        {/* Left Ratio & Confidence Tag on Layer Origin */}
                        {(canPlaceAxisLabel || isHovered) && (
                          <g pointerEvents="none">
                            <rect
                              x={startX + 6}
                              y={centerY - 9}
                              width={isHovered ? 148 : 112}
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
                              y={centerY + 3}
                              fill={style.badgeText}
                              fontSize="9.2"
                              fontWeight="700"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              {layer.ratioLabel}
                              {isHovered ? ` · ${signedPct}` : ` · ${layer.confidence}%`}
                            </text>
                          </g>
                        )}

                        {/* Right Price-Axis Layer Pill */}
                        {canPlaceAxisLabel && (
                          <g pointerEvents="none">
                            <rect
                              x={endX + 2}
                              y={centerY - 9}
                              width="82"
                              height="18"
                              rx="4"
                              fill={style.badgeBg}
                              stroke={style.stroke}
                              strokeWidth={isHovered ? '1.3' : '0.85'}
                            />
                            <text
                              x={endX + 6}
                              y={centerY + 3.5}
                              fill={style.badgeText}
                              fontSize="9.2"
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

                  {/* Hovered Extension Layer Anchor-to-Target Bracket & Detail Pill */}
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

          {/* Targets & Invalidation */}
          {showTargets &&
            (projectionReport?.targets.length ? projectionReport.targets : activeScenario.targets).map(target => {
              const targetY = getY(target.price);
              if (targetY < padding.top || targetY > height - padding.bottom - volumeHeight) return null;
              const isInv = target.isInvalidation;
              const color = isInv ? '#f43f5e' : target.type === 'TMV' ? '#f59e0b' : '#38bdf8';

              return (
                <g key={target.id}>
                  <line
                    x1={padding.left}
                    y1={targetY}
                    x2={width - padding.right}
                    y2={targetY}
                    stroke={color}
                    strokeWidth="1.2"
                    strokeDasharray={isInv ? '5 4' : '3 3'}
                    opacity="0.7"
                  />
                  <rect
                    x={width - padding.right + 2}
                    y={targetY - 9}
                    width="82"
                    height="18"
                    rx="4"
                    fill={isInv ? '#4c0519' : '#082f49'}
                    stroke={color}
                    strokeWidth="0.8"
                  />
                  <text
                    x={width - padding.right + 6}
                    y={targetY + 3.5}
                    fill={color}
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {isInv ? 'INV ' : target.type === 'TMV' ? 'TMV ' : 'TGT '}
                    {target.price.toLocaleString()}
                  </text>
                </g>
              );
            })}

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

        {/* Completed Structure Fibonacci Basis Chip */}
        {effectiveShowFibLayers && projectionReport?.completedStructure && (
          <div className="hidden lg:flex absolute bottom-3 left-3 items-center gap-2 bg-slate-950/90 border border-emerald-500/35 px-2.5 py-1.5 rounded-lg text-[10.5px] text-slate-200 shadow-lg pointer-events-none">
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
