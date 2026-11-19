/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Multi-Wave Elliott Fibonacci Confluence Zones Sidebar Widget
 * Visualizes overlapping Fibonacci clusters across waves with luminous glow
 * and variable confidence colors for high-probability entry zones.
 */

import React, { useMemo, useState } from 'react';
import { Candle, WaveScenario } from '../types/elliott';
import {
  ConfluenceZonesEngine,
  ConfluenceZoneItem
} from '../engine/confluenceZonesEngine';
import { Sparkles, Layers, Target, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ConfluenceZonesWidgetProps {
  scenario: WaveScenario;
  candles: Candle[];
}

export const ConfluenceZonesWidget: React.FC<ConfluenceZonesWidgetProps> = ({
  scenario,
  candles
}) => {
  const [tolerancePct, setTolerancePct] = useState<number>(1.8);
  const [filterMode, setFilterMode] = useState<'ALL' | 'HIGH' | 'NEAR'>('ALL');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const report = useMemo(
    () => ConfluenceZonesEngine.analyze(scenario, candles, tolerancePct),
    [scenario, candles, tolerancePct]
  );

  const visibleZones = useMemo(() => {
    if (filterMode === 'HIGH') {
      return report.zones.filter(z => z.tier === 'HIGH_CONFIDENCE');
    }
    if (filterMode === 'NEAR') {
      return report.zones.filter(z => Math.abs(z.distanceFromPricePct) <= 12);
    }
    return report.zones;
  }, [report.zones, filterMode]);

  const activeZone: ConfluenceZoneItem | null =
    visibleZones.find(z => z.id === selectedZoneId) || visibleZones[0] || null;

  // Compute SVG spectral map bounds cleanly
  const mapBounds = useMemo(() => {
    const prices = [report.currentPrice];
    if (report.invalidationPrice > 0) prices.push(report.invalidationPrice);
    visibleZones.forEach(z => {
      prices.push(z.lowPrice, z.highPrice);
    });
    const min = Math.min(...prices.filter(p => p > 0));
    const max = Math.max(...prices.filter(p => p > 0));
    const span = Math.max(1, max - min);
    return {
      min: min - span * 0.08,
      max: max + span * 0.08,
      span: span * 1.16
    };
  }, [report.currentPrice, report.invalidationPrice, visibleZones]);

  const yForPrice = (price: number, h: number, padY: number) => {
    const usable = Math.max(10, h - padY * 2);
    const norm = (price - mapBounds.min) / Math.max(1e-6, mapBounds.span);
    return h - padY - norm * usable;
  };

  return (
    <div className="bg-[#091122] border border-slate-800 rounded-xl p-3.5 space-y-3.5">
      {/* Header & Controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>نقشه تلاقی سطوح فیبوناچی امواج</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            هم‌گرایی اصلاح و گسترش فیبوناچی برای تشخیص نقاط ورود با اطمینان بالا
          </p>
        </div>
        <span className="font-mono text-[11px] font-bold text-emerald-300 tabular-nums shrink-0">
          {report.highConfidenceCount} تلاقی قوی
        </span>
      </div>

      {/* Tolerance & Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10.5px]">
          <span className="px-1.5 text-slate-500 whitespace-nowrap">تلورانس:</span>
          {[
            { val: 1.0, label: '۱٪' },
            { val: 1.8, label: '۱.۸٪' },
            { val: 2.8, label: '۲.۸٪' }
          ].map(opt => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setTolerancePct(opt.val)}
              className={`px-2 py-0.5 rounded-md font-mono tabular-nums whitespace-nowrap transition-colors ${
                tolerancePct === opt.val
                  ? 'bg-emerald-600/30 text-emerald-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10.5px]">
          {(
            [
              { id: 'ALL', label: 'همه' },
              { id: 'HIGH', label: 'اطمینان بالا' },
              { id: 'NEAR', label: 'نزدیک قیمت' }
            ] as const
          ).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilterMode(opt.id)}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                filterMode === opt.id
                  ? 'bg-cyan-600/30 text-cyan-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Luminous Spectral Confluence Map (SVG) */}
      {visibleZones.length > 0 ? (
        <div className="bg-[#050a16] border border-slate-800/90 rounded-xl p-2.5">
          <svg viewBox="0 0 380 184" className="w-full h-44 block">
            <defs>
              <filter id="cf-luminous-glow" x="-25%" y="-40%" width="150%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {visibleZones.map(zone => (
                <linearGradient key={`grad-${zone.id}`} id={`cf-grad-${zone.id}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={zone.colorHex} stopOpacity="0.08" />
                  <stop offset="35%" stopColor={zone.glowHex} stopOpacity={zone.tier === 'HIGH_CONFIDENCE' ? '0.42' : '0.26'} />
                  <stop offset="75%" stopColor={zone.colorHex} stopOpacity={zone.tier === 'HIGH_CONFIDENCE' ? '0.32' : '0.18'} />
                  <stop offset="100%" stopColor={zone.colorHex} stopOpacity="0.06" />
                </linearGradient>
              ))}
            </defs>

            {/* Subtle Horizontal Reference Grid */}
            {[0.2, 0.5, 0.8].map((r, i) => (
              <line
                key={`cf-grid-${i}`}
                x1="12"
                y1={16 + r * 152}
                x2="368"
                y2={16 + r * 152}
                stroke="#17223b"
                strokeDasharray="3 4"
                strokeWidth="0.9"
              />
            ))}

            {/* Luminous Confluence Bands */}
            {visibleZones.map(zone => {
              const yTop = yForPrice(zone.highPrice, 184, 16);
              const yBot = yForPrice(zone.lowPrice, 184, 16);
              const yMid = yForPrice(zone.centerPrice, 184, 16);
              const bandH = Math.max(9, yBot - yTop);
              const isSelected = activeZone?.id === zone.id;

              return (
                <g
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className="cursor-pointer"
                >
                  {/* Luminous Band Fill */}
                  <rect
                    x="14"
                    y={yMid - bandH / 2}
                    width="274"
                    height={bandH}
                    rx="3"
                    fill={`url(#cf-grad-${zone.id})`}
                    stroke={zone.colorHex}
                    strokeOpacity={isSelected ? 0.95 : 0.45}
                    strokeWidth={isSelected ? 1.3 : 0.7}
                  />
                  {/* Glowing Central Confluence Core Beam */}
                  <line
                    x1="16"
                    y1={yMid}
                    x2="286"
                    y2={yMid}
                    stroke={zone.glowHex}
                    strokeWidth={zone.tier === 'HIGH_CONFIDENCE' ? 2.1 : 1.35}
                    strokeOpacity={isSelected ? 1 : 0.82}
                    filter={zone.tier === 'HIGH_CONFIDENCE' || isSelected ? 'url(#cf-luminous-glow)' : undefined}
                  />
                  {/* Node Intensity Dot */}
                  <circle
                    cx="20"
                    cy={yMid}
                    r={zone.tier === 'HIGH_CONFIDENCE' ? 3.8 : 2.8}
                    fill={zone.glowHex}
                    stroke="#020617"
                    strokeWidth="1"
                  />
                  {/* Right Price & Confidence Pill */}
                  <text
                    x="294"
                    y={yMid + 3.2}
                    fill={isSelected ? '#ffffff' : zone.glowHex}
                    fontSize="9.2"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {zone.centerPrice.toLocaleString()} ({zone.confluenceStrengthPct}%)
                  </text>
                </g>
              );
            })}

            {/* Invalidation Reference Floor/Ceiling */}
            {report.invalidationPrice > 0 && (() => {
              const invY = yForPrice(report.invalidationPrice, 184, 16);
              return (
                <g pointerEvents="none">
                  <line
                    x1="12"
                    y1={invY}
                    x2="288"
                    y2={invY}
                    stroke="#f43f5e"
                    strokeWidth="1.15"
                    strokeDasharray="4 3"
                    strokeOpacity="0.82"
                  />
                  <text
                    x="294"
                    y={invY + 3}
                    fill="#fb7185"
                    fontSize="8.8"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    INV {report.invalidationPrice.toLocaleString()}
                  </text>
                </g>
              );
            })()}

            {/* Current Price Luminous Line */}
            {report.currentPrice > 0 && (() => {
              const curY = yForPrice(report.currentPrice, 184, 16);
              return (
                <g pointerEvents="none">
                  <line x1="12" y1={curY} x2="288" y2={curY} stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="2 2" />
                  <rect x="292" y={curY - 8} width="82" height="16" rx="3.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.7" />
                  <text
                    x="333"
                    y={curY + 3}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="8.8"
                    fontWeight="bold"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {report.currentPrice.toLocaleString()}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center text-xs text-slate-400">
          {report.summaryNoteFa}
        </div>
      )}

      {/* Selected Zone Breakdown + Entry Zone List */}
      {visibleZones.length > 0 && (
        <div className="space-y-2">
          {visibleZones.map(zone => {
            const isSelected = activeZone?.id === zone.id;
            const isSupport = zone.directionBias === 'SUPPORT_LONG';
            return (
              <div
                key={`card-${zone.id}`}
                onClick={() => setSelectedZoneId(zone.id)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-colors space-y-2 ${
                  isSelected
                    ? 'bg-slate-900 border-slate-600'
                    : 'bg-slate-950/65 border-slate-800/80 hover:border-slate-700'
                }`}
                style={
                  isSelected
                    ? { boxShadow: `0 0 18px -6px ${zone.glowHex}66`, borderColor: `${zone.colorHex}80` }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: zone.glowHex,
                        boxShadow: `0 0 8px ${zone.glowHex}`
                      }}
                    />
                    <span className="font-mono text-xs font-bold text-white tabular-nums">
                      {zone.lowPrice.toLocaleString()} – {zone.highPrice.toLocaleString()}
                    </span>
                    <span className="text-[10.5px] font-semibold" style={{ color: zone.glowHex }}>
                      {zone.tierLabelFa}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums">
                    <span className={zone.distanceFromPricePct >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                      {zone.distanceFromPricePct >= 0 ? `+${zone.distanceFromPricePct}%` : `${zone.distanceFromPricePct}%`}
                    </span>
                    <span className="font-bold text-white">{zone.confluenceStrengthPct}%</span>
                  </div>
                </div>

                {/* Confidence Intensity Meter */}
                <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${zone.confluenceStrengthPct}%`,
                      background: `linear-gradient(90deg, ${zone.colorHex}, ${zone.glowHex})`,
                      boxShadow: `0 0 8px ${zone.glowHex}`
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 shrink-0" style={{ color: zone.glowHex }} />
                    <span>
                      تلاقی {zone.waveCount} موج ({zone.levelCount} تراز فیبوناچی)
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    {isSupport ? (
                      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-amber-400" />
                    )}
                    <span>{isSupport ? 'ناحیه ورود / حمایت' : 'ناحیه هدف / مقاومت'}</span>
                  </span>
                </div>

                {isSelected && (
                  <div className="pt-1.5 border-t border-slate-800/90 space-y-1.5">
                    <div
                      className={`text-[10.5px] flex items-start gap-1.5 ${
                        zone.bahariAligned ? 'text-slate-300' : 'text-rose-300'
                      }`}
                    >
                      {zone.bahariAligned ? (
                        <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span>{zone.bahariNoteFa}</span>
                    </div>
                    <div className="space-y-1">
                      {zone.contributors.map(c => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between text-[10.5px] bg-slate-950/80 border border-slate-800/70 rounded-lg px-2 py-1"
                        >
                          <span className="text-slate-300 truncate">{c.waveLabel}</span>
                          <span className="font-mono text-slate-400 tabular-nums shrink-0">
                            {c.ratioLabel} · <strong className="text-white">{c.price.toLocaleString()}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
