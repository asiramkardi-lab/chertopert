/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TradingView Pro Style Candlestick Chart with Multi-Scenario Color Overlays,
 * Drag & Drop Vertices, Inline Rename/Delete, Add/Draw-From-Scratch Modes,
 * Absolute Bottom Anchor Picker, Parent Window Highlight, and Double-Click Drill-Down.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Candle, WaveScenario, WaveVertex, PatternFamily } from '../types/elliott';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import { PATTERN_LABELS_FA } from '../engine/rulesEngine';
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
  X
} from 'lucide-react';

export type ChartInteractionMode = 'EDIT' | 'ADD_VERTEX' | 'DRAW_SCRATCH' | 'PICK_BOTTOM';

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
  hideToolbarLockAndReset = false
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
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [snapToCandleExtreme, setSnapToCandleExtreme] = useState<boolean>(true);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

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

  // Reset selected vertex popover when active scenario or interaction mode changes
  useEffect(() => {
    setSelectedVertexIndex(null);
    dragMovedRef.current = false;
    setDragMoved(false);
  }, [activeScenario.id, interactionMode]);

  const { width, height } = dimensions;
  const padding = { top: 48, right: 86, bottom: showVolume ? 74 : 40, left: 22 };
  const volumeHeight = showVolume ? 58 : 0;

  // Price bounds including overlays, targets, and absolute bottom
  const { minPrice, maxPrice, priceRange, maxVolume } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100, maxVolume: 1000 };
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    candles.forEach(c => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    activeScenario.vertices.forEach(v => {
      if (v.price < min) min = v.price;
      if (v.price > max) max = v.price;
    });
    if (showTargets) {
      activeScenario.targets.forEach(t => {
        if (t.price < min) min = t.price;
        if (t.price > max) max = t.price;
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
  }, [candles, activeScenario, showTargets, absoluteBottom]);

  const getX = (index: number) => {
    const usableWidth = width - padding.left - padding.right;
    const step = usableWidth / Math.max(1, candles.length - 1);
    return padding.left + index * step;
  };

  const getY = (price: number) => {
    const usableHeight = height - padding.top - padding.bottom - volumeHeight;
    const normalized = (price - minPrice) / priceRange;
    return height - padding.bottom - volumeHeight - normalized * usableHeight;
  };

  const getIndexAndPriceFromCoords = (mouseX: number, mouseY: number, forceLowSnap = false) => {
    const usableWidth = width - padding.left - padding.right;
    const step = usableWidth / Math.max(1, candles.length - 1);
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
        const distHigh = Math.abs(rawPrice - candle.high);
        const distLow = Math.abs(rawPrice - candle.low);
        const snapThreshold = bounds.priceRange * 0.08;
        if (Math.min(distHigh, distLow) < snapThreshold) {
          finalPrice = distHigh < distLow ? candle.high : candle.low;
        }
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
            onClick={() => setShowTargets(!showTargets)}
            className={`px-2 py-1 text-[11px] rounded-lg border transition-colors ${
              showTargets
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            اهداف
          </button>

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

          {!hideToolbarLockAndReset && (
            <>
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

      {/* Main Chart Canvas */}
      <div
        ref={containerRef}
        onClick={handleSvgClick}
        className={`flex-1 w-full h-full min-h-[380px] relative overflow-hidden ${
          interactionMode === 'ADD_VERTEX' || interactionMode === 'DRAW_SCRATCH' || interactionMode === 'PICK_BOTTOM'
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

          {/* Absolute Bottom Post-Anchor Zone Shading */}
          {absoluteBottom && (
            <g>
              <rect
                x={padding.left}
                y={padding.top}
                width={Math.max(0, getX(absoluteBottom.candleIndex) - padding.left)}
                height={height - padding.top - padding.bottom - volumeHeight}
                fill="#020617"
                fillOpacity="0.48"
              />
              <line
                x1={getX(absoluteBottom.candleIndex)}
                y1={padding.top}
                x2={getX(absoluteBottom.candleIndex)}
                y2={height - padding.bottom}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <line
                x1={getX(absoluteBottom.candleIndex)}
                y1={getY(absoluteBottom.price)}
                x2={width - padding.right}
                y2={getY(absoluteBottom.price)}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.6"
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
              const barWidth = Math.max(2, ((width - padding.left - padding.right) / candles.length) * 0.65);
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
            const barWidth = Math.max(2.5, ((width - padding.left - padding.right) / candles.length) * 0.65);

            return (
              <g key={`candle-${i}`}>
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={bodyColor} strokeWidth="1.15" />
                <rect x={x - barWidth / 2} y={bodyTop} width={barWidth} height={bodyHeight} fill={bodyColor} rx="0.8" />
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

          {/* Targets & Invalidation */}
          {showTargets &&
            activeScenario.targets.map(target => {
              const targetY = getY(target.price);
              if (targetY < padding.top || targetY > height - padding.bottom - volumeHeight) return null;
              const isInv = target.isInvalidation;
              const color = isInv ? '#f43f5e' : '#38bdf8';

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
                    width="80"
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
                    {isInv ? 'INV ' : 'TGT '}
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
              return (
                <g key={`overlay-${sc.id}`} opacity="0.72">
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

          {/* Active Scenario Wave Leg Segments (individually interactive for double-click drill-down) */}
          {activeScenario.vertices.length >= 2 &&
            activeScenario.vertices.slice(0, -1).map((vStart, legIdx) => {
              const vEnd = activeScenario.vertices[legIdx + 1];
              const x1 = getX(vStart.candleIndex);
              const y1 = getY(vStart.price);
              const x2 = getX(vEnd.candleIndex);
              const y2 = getY(vEnd.price);
              const isLegHovered = hoveredLeg === legIdx;

              return (
                <g
                  key={`leg-${legIdx}`}
                  onMouseEnter={() => setHoveredLeg(legIdx)}
                  onMouseLeave={() => setHoveredLeg(null)}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    if (onDoubleClickWaveLeg) onDoubleClickWaveLeg(legIdx);
                  }}
                  className={onDoubleClickWaveLeg ? 'cursor-pointer' : ''}
                >
                  {/* Visible Wave Segment */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={scenarioColor}
                    strokeWidth={isLegHovered ? '4' : '2.8'}
                    strokeLinecap="round"
                  />
                  {/* Invisible thick hit target for easy hover & double-click */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  {onDoubleClickWaveLeg && isLegHovered && (
                    <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2 - 14})`}>
                      <rect x="-56" y="-11" width="112" height="20" rx="5" fill="#0f172a" stroke={scenarioColor} strokeWidth="1" />
                      <text x="0" y="3" textAnchor="middle" fill="#f8fafc" fontSize="9.5" fontWeight="600">
                        دابل‌کلیک: تایم پایین‌تر ({vStart.label}→{vEnd.label})
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* Active Scenario Vertices */}
          {activeScenario.vertices.map((vertex, idx) => {
            const vx = getX(vertex.candleIndex);
            const vy = getY(vertex.price);
            const isHovered = hoveredVertex === idx;
            const isDragging = draggingVertexIndex === idx;
            const isSelected = selectedVertexIndex === idx;

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
                    onDoubleClickWaveLeg(idx - 1);
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
                <g transform={`translate(${vx}, ${vy - 24})`}>
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

                {(isHovered || isDragging) && (
                  <g transform={`translate(${vx}, ${vy + 24})`}>
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
                  </g>
                )}
              </g>
            );
          })}

          {/* Absolute Bottom Draggable Anchor Handle */}
          {absoluteBottom && (
            <g
              onMouseDown={handleBottomMouseDown}
              className="cursor-ew-resize"
            >
              <circle
                cx={getX(absoluteBottom.candleIndex)}
                cy={getY(absoluteBottom.price)}
                r="7"
                fill="#f59e0b"
                stroke="#020617"
                strokeWidth="2"
              />
              <g transform={`translate(${getX(absoluteBottom.candleIndex)}, ${getY(absoluteBottom.price) + 22})`}>
                <rect x="-48" y="-11" width="96" height="20" rx="4" fill="#451a03" stroke="#f59e0b" strokeWidth="1.2" />
                <text x="0" y="3" textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="700">
                  کف مطلق: {absoluteBottom.price.toLocaleString()}
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
                        onDoubleClickWaveLeg(selectedVertexIndex - 1);
                        setSelectedVertexIndex(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-300 rounded-lg text-[11px] font-medium"
                    >
                      <Layers className="w-3 h-3" />
                      <span>زیرموج تایم پایین‌تر</span>
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

        {/* Floating Wave Metrics HUD */}
        {hudInfo && (
          <div className="absolute top-3 left-3 bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] flex items-center gap-3 pointer-events-none">
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
          </div>
        )}

        {/* Active Mode Instruction Strip */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-slate-300">
          {interactionMode === 'PICK_BOTTOM' ? (
            <>
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>حالت انتخاب کف مطلق: روی کندل کف در نمودار کلیک کنید یا نشانگر را بکشید.</span>
            </>
          ) : interactionMode === 'ADD_VERTEX' ? (
            <>
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>حالت افزودن نقطه: روی هر نقطه از نمودار کلیک کنید تا پیوت جدید درج شود.</span>
              {onChangeInteractionMode && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onChangeInteractionMode('EDIT');
                  }}
                  className="mr-2 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px]"
                >
                  اتمام
                </button>
              )}
            </>
          ) : interactionMode === 'DRAW_SCRATCH' ? (
            <>
              <PenTool className="w-3.5 h-3.5 text-emerald-400" />
              <span>حالت ترسیم از صفر: به ترتیب روی نقاط پیوت کلیک کنید ({activeScenario.vertices.length} نقطه ثبت شده).</span>
              {onChangeInteractionMode && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onChangeInteractionMode('EDIT');
                  }}
                  className="mr-2 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-medium"
                >
                  پایان ترسیم
                </button>
              )}
            </>
          ) : (
            <>
              <Move className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {activeScenario.isLocked
                  ? 'سناریو قفل است؛ برای تغییر نقاط قفل را باز کنید.'
                  : onDoubleClickWaveLeg
                  ? 'نقاط را بکشید، برای تغییر نام کلیک کنید، یا برای زیرموج‌ها روی هر موج دابل‌کلیک کنید.'
                  : 'نقاط پیوت را بکشید یا برای تغییر لیبل و حذف روی هر نقطه کلیک کنید.'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
