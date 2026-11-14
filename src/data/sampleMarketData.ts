/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Multi-scale Fractal Market Data Generator
 * Guarantees temporal and price consistency across timeframes so drilling down
 * from a higher timeframe wave [startTs, endTs] reveals exact nested subwaves.
 */

import { Candle } from '../types/elliott';

export interface MarketAssetConfig {
  id: string;
  name: string;
  symbol: string;
  marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  maxAllowedDegree: number;
  descriptionFa: string;
  timeframes: string[];
}

export const SUPPORTED_ASSETS: MarketAssetConfig[] = [
  {
    id: 'BTCUSDT',
    name: 'Bitcoin / Tether',
    symbol: 'BTC/USDT',
    marketType: 'CRYPTO',
    maxAllowedDegree: 8,
    descriptionFa: 'بیت‌کوین — نقدشوندگی بالا، تاریخچه عمیق از ماهانه تا ۱۵ دقیقه',
    timeframes: ['1M', '1W', '1D', '4H', '1H', '15M']
  },
  {
    id: 'TSE_SHAPNA',
    name: 'پالایش نفت اصفهان (شپنا)',
    symbol: 'شپنا (TSE)',
    marketType: 'TSE_IRAN',
    maxAllowedDegree: 4,
    descriptionFa: 'بورس تهران — حداکثر ۴ درجه موج‌شماری معتبر (V, W, بولد, ساده)، تایم‌های زیر ۴ ساعت نامعتبر',
    timeframes: ['1M', '1W', '1D', '4H', '1H', '15M']
  },
  {
    id: 'XAUUSD',
    name: 'طلا جهانی (Gold)',
    symbol: 'XAU/USD',
    marketType: 'COMMODITY',
    maxAllowedDegree: 6,
    descriptionFa: 'انس جهانی طلا — ساختار منظم، مناسب برای تحلیل از هفتگی تا یک‌ساعته',
    timeframes: ['1M', '1W', '1D', '4H', '1H', '15M']
  }
];

export const TIMEFRAME_MINUTES: Record<string, number> = {
  '1M': 43200,
  '1W': 10080,
  '1D': 1440,
  '4H': 240,
  '1H': 60,
  '15M': 15
};

export const TIMEFRAME_LABELS_FA: Record<string, string> = {
  '1M': 'ماهانه (1M)',
  '1W': 'هفتگی (1W)',
  '1D': 'روزانه (1D)',
  '4H': '۴ ساعته (4H)',
  '1H': '۱ ساعته (1H)',
  '15M': '۱۵ دقیقه (15M)'
};

export function getLowerTimeframe(tf: string): string | null {
  const order = ['1M', '1W', '1D', '4H', '1H', '15M'];
  const idx = order.indexOf(tf);
  if (idx === -1 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

export function getHigherTimeframe(tf: string): string | null {
  const order = ['1M', '1W', '1D', '4H', '1H', '15M'];
  const idx = order.indexOf(tf);
  if (idx <= 0) return null;
  return order[idx - 1];
}

// Piecewise Elliott Wave trajectory over normalized progress u in [0, 1]
// Models: pre-drop into Absolute Bottom at u=0.08, then 5-wave macro structure or partial wave
interface Waypoint {
  u: number;
  p: number; // normalized price level (0 = absolute bottom, 1 = macro peak)
  isMotive: boolean;
}

const ASSET_WAYPOINTS: Record<string, Waypoint[]> = {
  // BTC: Pre-bottom decline -> Absolute Bottom (0.08) -> W1 (0.24) -> W2 (0.16) -> W3 (0.62) -> W4 (0.48) -> W5 (0.86) -> partial A-B
  BTCUSDT: [
    { u: 0.0, p: 0.22, isMotive: false },
    { u: 0.08, p: 0.0, isMotive: false },   // Absolute Bottom
    { u: 0.24, p: 0.34, isMotive: true },   // Wave 1
    { u: 0.35, p: 0.16, isMotive: false },  // Wave 2 (~53% retrace)
    { u: 0.64, p: 0.78, isMotive: true },   // Wave 3 (extended)
    { u: 0.77, p: 0.54, isMotive: false },  // Wave 4 (above W1 peak 0.34 -> Ideal, close to overlap in alternate)
    { u: 0.94, p: 0.96, isMotive: true },   // Wave 5
    { u: 1.0, p: 0.84, isMotive: false }    // Early post-5 pullback
  ],
  // TSE Shapna: Partial higher-TF cycle (Wave 1, Wave 2, Wave 3 developing)
  TSE_SHAPNA: [
    { u: 0.0, p: 0.18, isMotive: false },
    { u: 0.10, p: 0.0, isMotive: false },   // Absolute Bottom
    { u: 0.36, p: 0.42, isMotive: true },   // Wave 1
    { u: 0.56, p: 0.18, isMotive: false },  // Wave 2 (~57% retrace)
    { u: 0.88, p: 0.92, isMotive: true },   // Wave 3 developing / completing
    { u: 1.0, p: 0.78, isMotive: false }    // Wave 4 early start
  ],
  // Gold: Terminal-like overlap or Diagonal structure
  XAUUSD: [
    { u: 0.0, p: 0.15, isMotive: false },
    { u: 0.07, p: 0.0, isMotive: false },   // Absolute Bottom
    { u: 0.26, p: 0.40, isMotive: true },   // Wave 1
    { u: 0.38, p: 0.19, isMotive: false },  // Wave 2
    { u: 0.62, p: 0.72, isMotive: true },   // Wave 3
    { u: 0.78, p: 0.37, isMotive: false },  // Wave 4 overlaps W1 (0.37 < 0.40 -> Terminal / Diagonal candidate!)
    { u: 0.95, p: 0.85, isMotive: true },   // Wave 5 (shorter than W3 -> Terminal!)
    { u: 1.0, p: 0.74, isMotive: false }
  ]
};

// Evaluates a sub-fractal wave shape inside a segment s in [0, 1]
function subFractalShape(s: number, isMotive: boolean, depth: number): number {
  if (depth <= 0) return s;
  // 5-wave internal oscillation for motive legs, 3-wave for corrective legs
  const points = isMotive
    ? [
        [0, 0],
        [0.18, 0.34],
        [0.30, 0.18],
        [0.64, 0.78],
        [0.78, 0.56],
        [1.0, 1.0]
      ]
    : [
        [0, 0],
        [0.38, 0.58],
        [0.65, 0.24],
        [1.0, 1.0]
      ];

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (s >= x0 && s <= x1) {
      const localS = (s - x0) / Math.max(0.0001, x1 - x0);
      const nestedMotive = isMotive ? i % 2 === 0 : i % 2 === 0;
      const shaped = depth > 1 ? subFractalShape(localS, nestedMotive, depth - 1) : localS;
      return y0 + (y1 - y0) * shaped;
    }
  }
  return s;
}

// Unified Anchor Timeline: 2.5 years ending at a deterministic anchor date
const ANCHOR_END_TS = new Date('2026-11-10T00:00:00Z').getTime();
const TOTAL_SPAN_MS = 900 * 24 * 60 * 60 * 1000; // 900 days (~30 months)
const ANCHOR_START_TS = ANCHOR_END_TS - TOTAL_SPAN_MS;

function evaluatePriceAtTimestamp(assetId: string, ts: number, depth: number): number {
  const waypoints = ASSET_WAYPOINTS[assetId] || ASSET_WAYPOINTS.BTCUSDT;
  const base = assetId === 'BTCUSDT' ? 42000 : assetId === 'TSE_SHAPNA' ? 3100 : 1920;
  const scale = assetId === 'BTCUSDT' ? 46000 : assetId === 'TSE_SHAPNA' ? 3900 : 880;

  const u = Math.max(0, Math.min(1, (ts - ANCHOR_START_TS) / TOTAL_SPAN_MS));

  for (let i = 0; i < waypoints.length - 1; i++) {
    const w0 = waypoints[i];
    const w1 = waypoints[i + 1];
    if (u >= w0.u && u <= w1.u) {
      const localS = (u - w0.u) / Math.max(0.00001, w1.u - w0.u);
      const frac = subFractalShape(localS, w1.isMotive, depth);
      const normP = w0.p + (w1.p - w0.p) * frac;
      // Add subtle deterministic micro-jitter
      const jitter = Math.sin(ts / 3.7e7) * 0.004 + Math.cos(ts / 1.9e7) * 0.003;
      return Math.round((base + (normP + jitter) * scale) * 10) / 10;
    }
  }
  return base;
}

/**
 * Generates candles for a timeframe.
 * If startTs and endTs are provided (e.g. drilling down into a parent wave),
 * it strictly slices/generates candles for that exact time window [startTs, endTs]
 * so the chart in the lower timeframe faithfully shows the exact parent wave candles!
 */
export function generateRealisticCandles(
  assetId: string,
  timeframe: string,
  count: number = 80,
  windowRange?: { startTs: number; endTs: number }
): Candle[] {
  const tfMin = TIMEFRAME_MINUTES[timeframe] || 1440;
  const intervalMs = tfMin * 60 * 1000;

  // Determine fractal sampling depth by timeframe
  const depth = timeframe === '1M' ? 0 : timeframe === '1W' ? 1 : timeframe === '1D' ? 2 : 3;

  let startTs: number;
  let actualCount: number;
  let stepMs = intervalMs;

  if (windowRange) {
    // Drill-down mode: cover [startTs, endTs] cleanly with 45..90 candles
    const span = Math.max(intervalMs * 12, windowRange.endTs - windowRange.startTs);
    // Add 8% padding on both sides for context
    const pad = span * 0.06;
    startTs = windowRange.startTs - pad;
    const totalWindow = span + pad * 2;
    const naturalCount = Math.round(totalWindow / intervalMs);
    actualCount = Math.max(28, Math.min(110, naturalCount));
    stepMs = totalWindow / actualCount;
  } else {
    // Full overview mode per timeframe
    // 1M covers full 30 months (~30 bars), 1W covers ~90 weeks (or subset), etc.
    const defaultBars: Record<string, number> = {
      '1M': 30,
      '1W': 68,
      '1D': 90,
      '4H': 90,
      '1H': 85,
      '15M': 80
    };
    actualCount = count || defaultBars[timeframe] || 75;
    // Scale span so 1M shows full 900d, 1W shows full 900d (~128w -> let's span 900d in 68-80 bars or natural window)
    if (timeframe === '1M' || timeframe === '1W') {
      startTs = ANCHOR_START_TS;
      stepMs = TOTAL_SPAN_MS / actualCount;
    } else if (timeframe === '1D') {
      // Last ~360 days or full cycle
      startTs = ANCHOR_START_TS + TOTAL_SPAN_MS * 0.05;
      stepMs = (TOTAL_SPAN_MS * 0.95) / actualCount;
    } else {
      // Lower TFs in overview show the active recent structure
      const fraction = timeframe === '4H' ? 0.35 : timeframe === '1H' ? 0.16 : 0.08;
      startTs = ANCHOR_END_TS - TOTAL_SPAN_MS * fraction;
      stepMs = (TOTAL_SPAN_MS * fraction) / actualCount;
    }
  }

  const candles: Candle[] = [];
  const baseScale = assetId === 'BTCUSDT' ? 46000 : assetId === 'TSE_SHAPNA' ? 3900 : 880;
  const noiseAmp = timeframe === '15M' ? 0.008 : timeframe === '1H' ? 0.005 : 0.003;

  for (let i = 0; i < actualCount; i++) {
    const tOpen = startTs + i * stepMs;
    const tClose = startTs + (i + 1) * stepMs;
    const tMid1 = tOpen + stepMs * 0.33;
    const tMid2 = tOpen + stepMs * 0.66;

    const pOpen = evaluatePriceAtTimestamp(assetId, tOpen, depth);
    const pClose = evaluatePriceAtTimestamp(assetId, tClose, depth);
    const pMid1 = evaluatePriceAtTimestamp(assetId, tMid1, depth);
    const pMid2 = evaluatePriceAtTimestamp(assetId, tMid2, depth);

    const wickUp = Math.abs(Math.sin(i * 2.1 + tOpen * 1e-6)) * baseScale * noiseAmp;
    const wickDown = Math.abs(Math.cos(i * 1.7 + tClose * 1e-6)) * baseScale * noiseAmp;

    const high = Math.round((Math.max(pOpen, pClose, pMid1, pMid2) + wickUp) * 10) / 10;
    const low = Math.round((Math.min(pOpen, pClose, pMid1, pMid2) - wickDown) * 10) / 10;
    const move = Math.abs(pClose - pOpen);
    const volume = Math.round(1200 + (move / baseScale) * 90000 + Math.abs(Math.sin(i * 1.3)) * 1500);

    const dateObj = new Date(tClose);
    const dateStr =
      tfMin >= 1440
        ? dateObj.toLocaleDateString('fa-IR')
        : `${dateObj.toLocaleDateString('fa-IR')} ${dateObj.getHours().toString().padStart(2, '0')}:00`;

    candles.push({
      time: dateStr,
      timestamp: Math.round(tClose),
      open: pOpen,
      high,
      low,
      close: pClose,
      volume
    });
  }

  return candles;
}

/**
 * Generates multi-timeframe overview dataset for Boundary Evaluation
 */
export function generateAllTimeframesForAsset(assetId: string, timeframes: string[]): Record<string, Candle[]> {
  const result: Record<string, Candle[]> = {};
  for (const tf of timeframes) {
    const barCount = tf === '1M' ? 30 : tf === '1W' ? 68 : tf === '1D' ? 88 : tf === '4H' ? 80 : tf === '1H' ? 75 : 70;
    result[tf] = generateRealisticCandles(assetId, tf, barCount);
  }
  return result;
}
