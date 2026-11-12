/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TradingView Pro Style Candlestick Chart with Elliott Wave Overlay,
 * Draggable Handles, Crosshair, Volume Sub-pane, and Floating HUD.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Candle, WaveScenario, WaveVertex, PatternFamily } from '../types/elliott';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import { 
  Lock, 
  Unlock, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Sparkles,
  MousePointer,
  Crosshair,
  TrendingUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Move
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
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Responsive dimensions
  const [dimensions, setDimensions] = useState({ width: 900, height: 620 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: Math.max(600, clientWidth),
          height: Math.max(500, clientHeight || 620)
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const { width, height } = dimensions;
  const padding = { top: 45, right: 85, bottom: showVolume ? 75 : 40, left: 20 };
  const volumeHeight = showVolume ? 60 : 0;

  // Price calculations
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
    activeScenario.targets.forEach(t => {
      if (t.price < min) min = t.price;
      if (t.price > max) max = t.price;
    });

    const range = (max - min) || 1;
    return {
      minPrice: min - range * 0.05,
      maxPrice: max + range * 0.08,
      priceRange: range * 1.13,
      maxVolume: maxVol || 1
    };
  }, [candles, activeScenario]);

  // Coordinate mapping
  const getX = (index: number) => {
    const usableWidth = width - padding.left - padding.right;
    const step = usableWidth / Math.max(1, candles.length - 1);
    return padding.left + index * step;
  };

  const getY = (price: number) => {
    const usableHeight = height - padding.top - padding.bottom - volumeHeight;
    const normalized = (price - minPrice) / priceRange;
    return (height - padding.bottom - volumeHeight) - normalized * usableHeight;
  };

  const getPriceFromY = (y: number) => {
    const usableHeight = height - padding.top - padding.bottom - volumeHeight;
    const normalized = ((height - padding.bottom - volumeHeight) - y) / usableHeight;
    return minPrice + normalized * priceRange;
  };

  // Drag and drop handlers
  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    if (activeScenario.isLocked) return;
    e.stopPropagation();
    setDraggingVertexIndex(index);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setMousePos({ x: mouseX, y: mouseY });

    if (draggingVertexIndex === null || activeScenario.isLocked) return;

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

  // Current price
  const lastCandle = candles[candles.length - 1];
  const lastPrice = lastCandle?.close || 0;
  const lastPriceY = getY(lastPrice);

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
    const r2Pct = len1 > 0 ? (retrace2 / len1 * 100).toFixed(1) : '0';
    const len3 = Math.abs(p3 - p2);
    const w3Ratio = len1 > 0 ? (len3 / len1).toFixed(2) : '0';
    const hasOverlap = v.length >= 5 && (p4 <= p1);

    return {
      retrace2Pct: r2Pct,
      w3Ratio,
      hasOverlap
    };
  }, [activeScenario]);

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-[#080d1a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl relative select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setMousePos(null);
      }}
    >
      {/* Top Pro Toolbar */}
      <div className="h-12 bg-[#0c1427]/90 border-b border-slate-800/80 px-4 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
        {/* Left items (Asset, TF, Degree) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-white tracking-wider font-mono">{assetSymbol}</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-mono">
              {timeframe}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Pattern morph dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">الگوی فعال:</span>
            <select
              value={activeScenario.patternType}
              onChange={(e) => onPatternChange(e.target.value as PatternFamily)}
              disabled={activeScenario.isLocked}
              className="bg-slate-900 border border-slate-700/80 text-xs text-indigo-300 font-medium rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
            >
              <option value="IDEAL_CYCLE">سیکل ایده‌آل (Ideal 5-Wave)</option>
              <option value="TERMINAL">ترمینال (Terminal - موج ۵ کوتاه)</option>
              <option value="ANTI_TERMINAL">آنتی‌ترمینال (Anti-Terminal - موج ۵ ممتد)</option>
              <option value="LEADING_DIAGONAL">قطر پیشرو (Leading Diagonal)</option>
              <option value="ENDING_DIAGONAL">قطر پایانی (Ending Diagonal)</option>
              <option value="ANTI_DIAGONAL">آنتی‌قطر (Anti-Diagonal)</option>
              <option value="ANTI_CYCLE">آنتی‌سیکل (Anti-Cycle 3-5)</option>
              <option value="ZIGZAG">زیگزاگ اصلاحی (Zigzag 5-3-5)</option>
              <option value="FLAT_REGULAR">فلت معمولی (Regular Flat 3-3-5)</option>
              <option value="FLAT_EXPANDED">فلت گسترش‌یافته (Expanded Flat)</option>
              <option value="TRIANGLE_CONVERGING">مثلث همگرا (Triangle 3-3-3-3-3)</option>
              <option value="COMPLEX_COMBINATION">ترکیب اصلاحی (W-X-Y)</option>
            </select>
          </div>
        </div>

        {/* Right tools & Toggles */}
        <div className="flex items-center gap-2">
          {/* Degree badge */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: degreeInfo.color }} />
            <span className="text-slate-300 font-medium">{degreeInfo.nameFa}</span>
          </div>

          <button
            onClick={() => setShowTargets(!showTargets)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
              showTargets 
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-medium' 
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            اهداف و ابطال
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
              showVolume 
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 font-medium' 
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            حجم
          </button>

          <button
            onClick={onToggleLock}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
              activeScenario.isLocked
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {activeScenario.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
            <span>{activeScenario.isLocked ? 'شمارش قفل' : 'آزاد'}</span>
          </button>

          <button
            onClick={onResetToAI}
            title="بازنشانی موج‌شماری به الگوی پیشنهادی هوش مصنوعی"
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden"
      >
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-full block"
          style={{ minHeight: '480px' }}
        >
          <defs>
            {/* Linear gradient for wave polyline glow */}
            <linearGradient id="waveLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            {/* Bullish / Bearish Volume Gradients */}
            <linearGradient id="bullVol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bearVol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
          </defs>

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

          {/* Volume Sub-pane separator */}
          {showVolume && (
            <line 
              x1={padding.left} 
              y1={height - padding.bottom - volumeHeight} 
              x2={width - padding.right} 
              y2={height - padding.bottom - volumeHeight} 
              stroke="#1e293b" 
              strokeWidth="1.2"
            />
          )}

          {/* Volume Bars */}
          {showVolume && candles.map((candle, i) => {
            const x = getX(i);
            const isUp = candle.close >= candle.open;
            const barWidth = Math.max(2.5, (width - padding.left - padding.right) / candles.length * 0.65);
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
                stroke={isUp ? '#10b981' : '#ef4444'}
                strokeWidth="0.5"
                opacity="0.8"
                rx="0.5"
              />
            );
          })}

          {/* Candlesticks Layer */}
          {candles.map((candle, i) => {
            const x = getX(i);
            const openY = getY(candle.open);
            const closeY = getY(candle.close);
            const highY = getY(candle.high);
            const lowY = getY(candle.low);
            const isUp = candle.close >= candle.open;
            const bodyColor = isUp ? '#00f59b' : '#ff4267';
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));
            const barWidth = Math.max(3, (width - padding.left - padding.right) / candles.length * 0.65);

            return (
              <g key={`candle-${i}`}>
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

          {/* Current Real-time Price Line */}
          {lastPriceY >= padding.top && lastPriceY <= height - padding.bottom && (
            <g>
              <line 
                x1={padding.left} 
                y1={lastPriceY} 
                x2={width - padding.right} 
                y2={lastPriceY} 
                stroke="#00f59b" 
                strokeWidth="1" 
                strokeDasharray="2 2" 
                opacity="0.75"
              />
              <rect 
                x={width - padding.right + 2} 
                y={lastPriceY - 9} 
                width="80" 
                height="18" 
                rx="4" 
                fill="#00f59b" 
              />
              <text 
                x={width - padding.right + 6} 
                y={lastPriceY + 3.5} 
                fill="#04120c" 
                fontSize="10" 
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
              >
                ${lastPrice.toLocaleString()}
              </text>
            </g>
          )}

          {/* Targets & Invalidation Overlays */}
          {showTargets && activeScenario.targets.map(target => {
            const targetY = getY(target.price);
            if (targetY < padding.top || targetY > height - padding.bottom - volumeHeight) return null;
            const isInv = target.isInvalidation;
            const color = isInv ? '#ff3b5c' : '#00e5ff';

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
                  opacity="0.8"
                />
                <rect 
                  x={width - padding.right + 2} 
                  y={targetY - 9} 
                  width="80" 
                  height="18" 
                  rx="4" 
                  fill={isInv ? '#4c0519' : '#083344'} 
                  stroke={color}
                  strokeWidth="1"
                />
                <text 
                  x={width - padding.right + 6} 
                  y={targetY + 4} 
                  fill={color} 
                  fontSize="9.5" 
                  fontWeight="bold"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {isInv ? 'INV ' : 'TGT '} ${target.price.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Elliott Wave Connecting Polyline */}
          {activeScenario.vertices.length >= 2 && (
            <polyline 
              points={activeScenario.vertices.map(v => `${getX(v.candleIndex)},${getY(v.price)}`).join(' ')}
              fill="none"
              stroke="url(#waveLineGradient)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 6px rgba(129, 140, 248, 0.4))"
            />
          )}

          {/* Interactive Wave Vertices & Labels */}
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
                {/* Glow ring when active/dragging */}
                <circle 
                  cx={vx} 
                  cy={vy} 
                  r={isDragging ? 10 : isHovered ? 8 : 6} 
                  fill={degreeInfo.color} 
                  stroke="#ffffff" 
                  strokeWidth={isDragging ? "2.5" : "1.8"} 
                  className="transition-all duration-150"
                  filter="drop-shadow(0 0 8px rgba(255,255,255,0.6))"
                />

                {/* TradingView Style Floating Wave Badge Box */}
                <g transform={`translate(${vx}, ${vy - 24})`}>
                  <rect 
                    x="-16" 
                    y="-12" 
                    width="32" 
                    height="22" 
                    rx="6" 
                    fill="#080e1c" 
                    stroke={degreeInfo.color} 
                    strokeWidth="1.8" 
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                  />
                  <text 
                    x="0" 
                    y="3" 
                    textAnchor="middle" 
                    fill="#ffffff" 
                    fontSize="11.5" 
                    fontWeight="800"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {vertex.label}
                  </text>
                </g>

                {/* Coordinate tooltip when hovering or dragging */}
                {(isHovered || isDragging) && (
                  <g transform={`translate(${vx}, ${vy + 26})`}>
                    <rect 
                      x="-60" 
                      y="-11" 
                      width="120" 
                      height="22" 
                      rx="5" 
                      fill="#020617" 
                      stroke="#475569" 
                      strokeWidth="1" 
                      opacity="0.95"
                    />
                    <text 
                      x="0" 
                      y="4" 
                      textAnchor="middle" 
                      fill="#38bdf8" 
                      fontSize="9.5" 
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      P: ${vertex.price.toLocaleString()} ({vertex.label})
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Mouse Crosshair tracker lines */}
          {mousePos && mousePos.x >= padding.left && mousePos.x <= width - padding.right && (
            <g opacity="0.6">
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

        {/* Floating HUD: Real-time Wave Proportions & Overlap Alert */}
        {hudInfo && (
          <div className="absolute top-4 left-4 bg-slate-950/85 border border-slate-800/80 rounded-xl p-2.5 backdrop-blur-md text-[11px] flex items-center gap-3 shadow-xl">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-500">اصلاح موج ۲:</span>
              <strong className="text-cyan-400 font-mono">{hudInfo.retrace2Pct}%</strong>
            </div>

            <div className="h-3.5 w-px bg-slate-800" />

            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-500">موج ۳ / موج ۱:</span>
              <strong className="text-indigo-400 font-mono">{hudInfo.w3Ratio}x</strong>
            </div>

            <div className="h-3.5 w-px bg-slate-800" />

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">تداخل موج ۴ و ۱:</span>
              {hudInfo.hasOverlap ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> هم‌پوشانی دارد (ترمینال)
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> بدون تداخل (ایده‌آل)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Bottom Helper Bar */}
        <div className="absolute bottom-3 right-4 flex items-center gap-2 bg-slate-950/85 border border-slate-800/80 px-3 py-1.5 rounded-lg text-[11px] text-slate-300 backdrop-blur-md pointer-events-none">
          <Move className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            {activeScenario.isLocked 
              ? 'شمارش قفل است؛ برای Drag & Drop، قفل را باز کنید.' 
              : 'نقاط پیوت را بکشید تا قوانین و تارگت‌ها به‌صورت زنده بازمحاسبه شوند.'}
          </span>
        </div>
      </div>
    </div>
  );
};
