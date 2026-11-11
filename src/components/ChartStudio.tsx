/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Interactive Candlestick Chart Studio with Draggable Elliott Wave Vertices,
 * Fibonacci Overlays, Target Lines, and Pattern Morphing.
 */

import React, { useState, useRef, useMemo } from 'react';
import { Candle, WaveScenario, WaveVertex, PatternFamily } from '../types/elliott';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import { 
  Move, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Layers,
  ChevronDown,
  Maximize2
} from 'lucide-react';

interface ChartStudioProps {
  candles: Candle[];
  activeScenario: WaveScenario;
  onUpdateVertices: (newVertices: WaveVertex[]) => void;
  onPatternChange: (newPattern: PatternFamily) => void;
  onToggleLock: () => void;
  onResetToAI: () => void;
  timeframe: string;
  assetSymbol: string;
}

export const ChartStudio: React.FC<ChartStudioProps> = ({
  candles,
  activeScenario,
  onUpdateVertices,
  onPatternChange,
  onToggleLock,
  onResetToAI,
  timeframe,
  assetSymbol
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);
  const [showFibs, setShowFibs] = useState<boolean>(true);
  const [showTargets, setShowTargets] = useState<boolean>(true);

  // Chart dimensions & scaling
  const width = 860;
  const height = 480;
  const padding = { top: 40, right: 90, bottom: 45, left: 20 };

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    let min = Infinity;
    let max = -Infinity;
    candles.forEach(c => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    });
    // Add margin for targets and vertex headroom
    activeScenario.vertices.forEach(v => {
      if (v.price < min) min = v.price;
      if (v.price > max) max = v.price;
    });
    activeScenario.targets.forEach(t => {
      if (t.price < min) min = t.price;
      if (t.price > max) max = t.price;
    });

    const range = (max - min) || 1;
    return {
      minPrice: min - range * 0.05,
      maxPrice: max + range * 0.08,
      priceRange: range * 1.13
    };
  }, [candles, activeScenario]);

  // Coordinate mapping
  const getX = (index: number) => {
    const usableWidth = width - padding.left - padding.right;
    const step = usableWidth / Math.max(1, candles.length - 1);
    return padding.left + index * step;
  };

  const getY = (price: number) => {
    const usableHeight = height - padding.top - padding.bottom;
    const normalized = (price - minPrice) / priceRange;
    return height - padding.bottom - normalized * usableHeight;
  };

  const getPriceFromY = (y: number) => {
    const usableHeight = height - padding.top - padding.bottom;
    const normalized = (height - padding.bottom - y) / usableHeight;
    return minPrice + normalized * priceRange;
  };

  // Drag and drop handlers
  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    if (activeScenario.isLocked) return;
    e.stopPropagation();
    setDraggingVertexIndex(index);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingVertexIndex === null || !containerRef.current || activeScenario.isLocked) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate nearest candle index
    const usableWidth = width - padding.left - padding.right;
    const step = usableWidth / Math.max(1, candles.length - 1);
    const rawIndex = Math.round((mouseX - padding.left) / step);
    const candleIndex = Math.max(0, Math.min(candles.length - 1, rawIndex));

    const newPrice = Math.round(getPriceFromY(mouseY));

    const updated = [...activeScenario.vertices];
    if (updated[draggingVertexIndex]) {
      updated[draggingVertexIndex] = {
        ...updated[draggingVertexIndex],
        candleIndex,
        price: newPrice,
        timestamp: candles[candleIndex]?.timestamp ?? updated[draggingVertexIndex].timestamp
      };
      onUpdateVertices(updated);
    }
  };

  const handleMouseUp = () => {
    setDraggingVertexIndex(null);
  };

  const degreeInfo = DEGREE_CONFIGS[activeScenario.degree];

  // Grid price lines
  const gridSteps = 5;
  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (priceRange / gridSteps) * i;
      const y = getY(p);
      lines.push({ price: Math.round(p), y });
    }
    return lines;
  }, [minPrice, priceRange]);

  return (
    <div 
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-sm select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Chart Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white tracking-wide">{assetSymbol}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {timeframe}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Active Pattern Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">الگو:</span>
            <div className="relative inline-block">
              <select
                value={activeScenario.patternType}
                onChange={(e) => onPatternChange(e.target.value as PatternFamily)}
                disabled={activeScenario.isLocked}
                className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
              >
                <option value="IDEAL_CYCLE">سیکل ایده‌آل (Ideal 5-Wave)</option>
                <option value="TERMINAL">ترمینال (Terminal - موج ۵ کوتاه)</option>
                <option value="ANTI_TERMINAL">آنتی‌ترمینال (Anti-Terminal - موج ۵ کشیده)</option>
                <option value="LEADING_DIAGONAL">قطر پیشرو (Leading Diagonal)</option>
                <option value="ENDING_DIAGONAL">قطر پایانی (Ending Diagonal)</option>
                <option value="ANTI_DIAGONAL">آنتی‌قطر (Anti-Diagonal)</option>
                <option value="ANTI_CYCLE">آنتی‌سیکل (Anti-Cycle 3-5)</option>
                <option value="ZIGZAG">زیگزاگ اصلاحی (Zigzag 5-3-5)</option>
                <option value="FLAT_REGULAR">فلت متعارف (Regular Flat 3-3-5)</option>
                <option value="FLAT_EXPANDED">فلت گسترش‌یافته (Expanded Flat)</option>
                <option value="TRIANGLE_CONVERGING">مثلث همگرا (Triangle 3-3-3-3-3)</option>
                <option value="COMPLEX_COMBINATION">ترکیب پیچیده (W-X-Y)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Controls & Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFibs(!showFibs)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
              showFibs 
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            سطوح فیبوناچی
          </button>

          <button
            onClick={() => setShowTargets(!showTargets)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
              showTargets 
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            اهداف و ابطال
          </button>

          <button
            onClick={onToggleLock}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
              activeScenario.isLocked
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {activeScenario.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{activeScenario.isLocked ? 'قفل شمارش' : 'آزاد برای ویرایش'}</span>
          </button>

          <button
            onClick={onResetToAI}
            title="بازنشانی به شمارش اولیه هوش مصنوعی"
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main SVG Chart Canvas */}
      <div 
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800/80 cursor-crosshair"
      >
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto block"
        >
          {/* Background Grid Lines */}
          {gridLines.map((line, idx) => (
            <g key={`grid-${idx}`}>
              <line 
                x1={padding.left} 
                y1={line.y} 
                x2={width - padding.right} 
                y2={line.y} 
                stroke="#1e293b" 
                strokeDasharray="4 4" 
              />
              <text 
                x={width - padding.right + 8} 
                y={line.y + 4} 
                fill="#64748b" 
                fontSize="10" 
                fontFamily="JetBrains Mono, monospace"
              >
                {line.price.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Candlesticks Layer */}
          {candles.map((candle, i) => {
            const x = getX(i);
            const openY = getY(candle.open);
            const closeY = getY(candle.close);
            const highY = getY(candle.high);
            const lowY = getY(candle.low);
            const isUp = candle.close >= candle.open;
            const bodyColor = isUp ? '#10b981' : '#ef4444';
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));
            const barWidth = Math.max(3, (width - padding.left - padding.right) / candles.length * 0.65);

            return (
              <g key={`candle-${i}`} opacity="0.85">
                {/* Wick */}
                <line 
                  x1={x} 
                  y1={highY} 
                  x2={x} 
                  y2={lowY} 
                  stroke={bodyColor} 
                  strokeWidth="1.2" 
                />
                {/* Body */}
                <rect 
                  x={x - barWidth / 2} 
                  y={bodyTop} 
                  width={barWidth} 
                  height={bodyHeight} 
                  fill={bodyColor} 
                  rx="1"
                />
              </g>
            );
          })}

          {/* Targets & Invalidation Overlays */}
          {showTargets && activeScenario.targets.map(target => {
            const targetY = getY(target.price);
            if (targetY < padding.top || targetY > height - padding.bottom) return null;

            const isInv = target.isInvalidation;
            const color = isInv ? '#ef4444' : '#06b6d4';

            return (
              <g key={target.id}>
                <line 
                  x1={padding.left} 
                  y1={targetY} 
                  x2={width - padding.right} 
                  y2={targetY} 
                  stroke={color} 
                  strokeWidth="1.5" 
                  strokeDasharray={isInv ? "6 4" : "4 2"} 
                  opacity="0.75"
                />
                <rect 
                  x={width - padding.right + 2} 
                  y={targetY - 9} 
                  width="82" 
                  height="18" 
                  rx="4" 
                  fill={isInv ? '#7f1d1d' : '#0e7490'} 
                  opacity="0.9"
                />
                <text 
                  x={width - padding.right + 6} 
                  y={targetY + 4} 
                  fill="#ffffff" 
                  fontSize="9" 
                  fontWeight="bold"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {isInv ? 'INV ' : 'TGT '} {target.price.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Elliott Wave Connecting Polyline */}
          {activeScenario.vertices.length >= 2 && (
            <polyline 
              points={activeScenario.vertices.map(v => `${getX(v.candleIndex)},${getY(v.price)}`).join(' ')}
              fill="none"
              stroke={degreeInfo.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          )}

          {/* Wave Vertices & Labels */}
          {activeScenario.vertices.map((vertex, idx) => {
            const vx = getX(vertex.candleIndex);
            const vy = getY(vertex.price);
            const isHovered = hoveredVertex === idx;
            const isDragging = draggingVertexIndex === idx;

            return (
              <g 
                key={`vertex-${idx}`} 
                className={activeScenario.isLocked ? '' : 'cursor-grab active:cursor-grabbing'}
                onMouseEnter={() => setHoveredVertex(idx)}
                onMouseLeave={() => setHoveredVertex(null)}
                onMouseDown={(e) => handleMouseDown(idx, e)}
              >
                {/* Glow circle for vertex */}
                <circle 
                  cx={vx} 
                  cy={vy} 
                  r={isDragging ? 9 : isHovered ? 7 : 5} 
                  fill={degreeInfo.color} 
                  stroke="#ffffff" 
                  strokeWidth={isDragging ? "2.5" : "1.8"} 
                  className="transition-all duration-150 shadow-lg"
                />

                {/* Floating Wave Label Badge */}
                <g transform={`translate(${vx}, ${vy - 20})`}>
                  <rect 
                    x="-14" 
                    y="-12" 
                    width="28" 
                    height="20" 
                    rx="5" 
                    fill="#0f172a" 
                    stroke={degreeInfo.color} 
                    strokeWidth="1.5" 
                  />
                  <text 
                    x="0" 
                    y="2" 
                    textAnchor="middle" 
                    fill="#ffffff" 
                    fontSize="11" 
                    fontWeight="bold"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {vertex.label}
                  </text>
                </g>

                {/* Interactive Tooltip on hover/drag */}
                {(isHovered || isDragging) && (
                  <g transform={`translate(${vx}, ${vy + 22})`}>
                    <rect 
                      x="-55" 
                      y="-10" 
                      width="110" 
                      height="20" 
                      rx="4" 
                      fill="#020617" 
                      stroke="#475569" 
                      strokeWidth="1" 
                      opacity="0.95"
                    />
                    <text 
                      x="0" 
                      y="4" 
                      textAnchor="middle" 
                      fill="#94a3b8" 
                      fontSize="9" 
                      fontFamily="JetBrains Mono, monospace"
                    >
                      P: {vertex.price.toLocaleString()} ({idx > 0 ? `W${idx}` : 'Start'})
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Live Drag & Drop Hint */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 pointer-events-none">
          <Move className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            {activeScenario.isLocked 
              ? 'شمارش قفل است؛ جهت ویرایش نقاط، قفل را باز کنید.' 
              : 'نقاط پیوت را برای ویرایش و بازاعتبارسنجی لحظه‌ای بکشید (Drag & Drop)'}
          </span>
        </div>

        {/* Degree Badge in Chart */}
        <div className="absolute top-3 right-24 flex items-center gap-1.5 bg-slate-900/85 border border-slate-800 px-2.5 py-1 rounded-md text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: degreeInfo.color }} />
          <span className="text-slate-300 font-medium">{degreeInfo.nameFa}</span>
        </div>
      </div>
    </div>
  );
};
