/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TradingView-Grade Chart Tools, Technical Indicators & Price Scale Engine
 */

import { Candle } from '../types/elliott';

export type ChartStyleType =
  | 'CANDLES'
  | 'HOLLOW'
  | 'HEIKIN_ASHI'
  | 'BARS'
  | 'LINE'
  | 'AREA'
  | 'BASELINE';

export type PriceScaleMode = 'LINEAR' | 'LOG' | 'PERCENT';

export type DrawingToolKind =
  | 'SELECT'
  | 'TRENDLINE'
  | 'RAY'
  | 'EXTENDED_LINE'
  | 'HLINE'
  | 'VLINE'
  | 'CHANNEL'
  | 'PITCHFORK'
  | 'FIB_RETRACE'
  | 'FIB_EXTENSION'
  | 'LONG_POSITION'
  | 'SHORT_POSITION'
  | 'MEASURE'
  | 'BRUSH'
  | 'TEXT';

export interface DrawingPoint {
  candleIndex: number;
  price: number;
  timestamp?: number;
}

export interface ChartDrawing {
  id: string;
  kind: Exclude<DrawingToolKind, 'SELECT'>;
  points: DrawingPoint[];
  color: string;
  label?: string;
  lineWidth?: number;
  locked?: boolean;
  visible?: boolean;
}

export interface BollingerPoint {
  mid: number;
  upper: number;
  lower: number;
}

export interface MACDPoint {
  macd: number;
  signal: number | null;
  histogram: number | null;
}

export interface TradingViewSymbolMapping {
  tvSymbol: string;
  isNativeOnTradingView: boolean;
  displayNameFa: string;
  exchangeLabel: string;
}

/**
 * Maps internal asset IDs to official TradingView ticker symbols.
 */
export function mapAssetToTradingViewSymbol(assetId: string, fallbackSymbol?: string): TradingViewSymbolMapping {
  switch (assetId) {
    case 'BTCUSDT':
      return {
        tvSymbol: 'BINANCE:BTCUSDT',
        isNativeOnTradingView: true,
        displayNameFa: 'بیت‌کوین / تتر (Binance)',
        exchangeLabel: 'BINANCE'
      };
    case 'XAUUSD':
      return {
        tvSymbol: 'OANDA:XAUUSD',
        isNativeOnTradingView: true,
        displayNameFa: 'انس جهانی طلا (XAU/USD)',
        exchangeLabel: 'OANDA'
      };
    case 'TSE_SHAPNA':
      return {
        tvSymbol: 'BINANCE:BTCUSDT',
        isNativeOnTradingView: false,
        displayNameFa: 'شپنا (بورس تهران - فید محلی)',
        exchangeLabel: 'TSE'
      };
    case 'TSE_ZOB':
      return {
        tvSymbol: 'BINANCE:BTCUSDT',
        isNativeOnTradingView: false,
        displayNameFa: 'ذوب‌آهن (بورس تهران - فید محلی)',
        exchangeLabel: 'TSE'
      };
    case 'TSE_FARS':
      return {
        tvSymbol: 'BINANCE:BTCUSDT',
        isNativeOnTradingView: false,
        displayNameFa: 'فارس (بورس تهران - فید محلی)',
        exchangeLabel: 'TSE'
      };
    default: {
      const clean = (fallbackSymbol || assetId || 'BINANCE:BTCUSDT').replace(/\s+/g, '').toUpperCase();
      return {
        tvSymbol: clean.includes(':') ? clean : 'BINANCE:BTCUSDT',
        isNativeOnTradingView: clean.includes(':'),
        displayNameFa: fallbackSymbol || assetId,
        exchangeLabel: 'GLOBAL'
      };
    }
  }
}

/**
 * Maps internal timeframe codes to official TradingView chart intervals.
 */
export function mapTimeframeToTradingViewInterval(timeframe: string): string {
  switch (timeframe) {
    case '15M':
      return '15';
    case '1H':
      return '60';
    case '4H':
      return '240';
    case '1D':
      return 'D';
    case '1W':
      return 'W';
    case '1M':
      return 'M';
    default:
      return 'D';
  }
}

/**
 * Converts standard OHLC candles into Heikin-Ashi candles.
 */
export function toHeikinAshi(candles: Candle[]): Candle[] {
  if (candles.length === 0) return [];
  const result: Candle[] = [];
  let prevOpen = (candles[0].open + candles[0].close) / 2;
  let prevClose = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? prevOpen : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    result.push({
      ...c,
      open: Math.round(haOpen * 100) / 100,
      high: Math.round(haHigh * 100) / 100,
      low: Math.round(haLow * 100) / 100,
      close: Math.round(haClose * 100) / 100
    });
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return result;
}

/**
 * Computes Simple Moving Average (SMA) over close prices.
 */
export function computeSMA(candles: Candle[], period: number): Array<number | null> {
  const n = candles.length;
  const out: Array<number | null> = new Array(n).fill(null);
  if (n === 0 || period <= 0 || n < period) return out;

  let rolling = 0;
  for (let i = 0; i < n; i++) {
    rolling += candles[i].close;
    if (i >= period) {
      rolling -= candles[i - period].close;
    }
    if (i >= period - 1) {
      out[i] = rolling / period;
    }
  }
  return out;
}

/**
 * Computes Exponential Moving Average (EMA) over close prices.
 */
export function computeEMA(candles: Candle[], period: number): Array<number | null> {
  const n = candles.length;
  const out: Array<number | null> = new Array(n).fill(null);
  if (n === 0 || period <= 0 || n < period) return out;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let ema = sum / period;
  out[period - 1] = ema;

  for (let i = period; i < n; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/**
 * Computes Bollinger Bands (SMA +/- mult * StdDev).
 */
export function computeBollingerBands(
  candles: Candle[],
  period: number = 20,
  mult: number = 2
): Array<BollingerPoint | null> {
  const n = candles.length;
  const out: Array<BollingerPoint | null> = new Array(n).fill(null);
  if (n < period || period <= 1) return out;

  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - mean;
      sq += diff * diff;
    }
    const std = Math.sqrt(sq / period);
    out[i] = {
      mid: mean,
      upper: mean + mult * std,
      lower: mean - mult * std
    };
  }
  return out;
}

/**
 * Computes Wilder's Relative Strength Index (RSI).
 */
export function computeRSI(candles: Candle[], period: number = 14): Array<number | null> {
  const n = candles.length;
  const out: Array<number | null> = new Array(n).fill(null);
  if (n <= period || period <= 0) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRs);

  for (let i = period + 1; i < n; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) {
      out[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

/**
 * Computes MACD (fast EMA - slow EMA, signal EMA, and histogram).
 */
export function computeMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): Array<MACDPoint | null> {
  const n = candles.length;
  const out: Array<MACDPoint | null> = new Array(n).fill(null);
  if (n === 0 || fastPeriod <= 0 || slowPeriod <= fastPeriod || signalPeriod <= 0) return out;

  const fastEma = computeEMA(candles, fastPeriod);
  const slowEma = computeEMA(candles, slowPeriod);
  const macdLine: Array<number | null> = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== null && s !== null) {
      macdLine[i] = f - s;
    }
  }

  const validMacdIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (macdLine[i] !== null) validMacdIndices.push(i);
  }
  if (validMacdIndices.length === 0) return out;

  const k = 2 / (signalPeriod + 1);
  let signalEma: number | null = null;

  for (let pos = 0; pos < validMacdIndices.length; pos++) {
    const idx = validMacdIndices[pos];
    const mVal = macdLine[idx]!;
    if (pos + 1 < signalPeriod) {
      out[idx] = { macd: mVal, signal: null, histogram: null };
    } else if (pos + 1 === signalPeriod) {
      let sum = 0;
      for (let j = 0; j < signalPeriod; j++) {
        sum += macdLine[validMacdIndices[j]]!;
      }
      signalEma = sum / signalPeriod;
      out[idx] = {
        macd: mVal,
        signal: signalEma,
        histogram: mVal - signalEma
      };
    } else {
      signalEma = mVal * k + signalEma! * (1 - k);
      out[idx] = {
        macd: mVal,
        signal: signalEma,
        histogram: mVal - signalEma
      };
    }
  }

  return out;
}

/**
 * Computes anchored cumulative Volume-Weighted Average Price (VWAP).
 */
export function computeVWAP(candles: Candle[]): Array<number | null> {
  const n = candles.length;
  const out: Array<number | null> = new Array(n).fill(null);
  if (n === 0) return out;

  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const typical = (c.high + c.low + c.close) / 3;
    const vol = Math.max(0, c.volume || 0);
    cumPV += typical * vol;
    cumVol += vol;
    out[i] = cumVol > 0 ? cumPV / cumVol : typical;
  }
  return out;
}

/**
 * Transforms a raw price into scale space ('LINEAR' | 'LOG' | 'PERCENT').
 */
export function transformPrice(
  price: number,
  mode: PriceScaleMode,
  percentBaseline: number = 1
): number {
  if (mode === 'LOG') {
    return Math.log10(Math.max(1e-6, price));
  }
  if (mode === 'PERCENT') {
    const base = Math.max(1e-6, Math.abs(percentBaseline));
    return ((price - base) / base) * 100;
  }
  return price;
}

/**
 * Inverse transform from scale space back into raw price.
 */
export function inverseTransformPrice(
  scaledValue: number,
  mode: PriceScaleMode,
  percentBaseline: number = 1
): number {
  if (mode === 'LOG') {
    return Math.pow(10, scaledValue);
  }
  if (mode === 'PERCENT') {
    const base = Math.max(1e-6, Math.abs(percentBaseline));
    return base * (1 + scaledValue / 100);
  }
  return scaledValue;
}

/**
 * Formats an axis label according to active price scale mode.
 */
export function formatScalePrice(
  price: number,
  mode: PriceScaleMode,
  percentBaseline: number = 1
): string {
  if (mode === 'PERCENT') {
    const base = Math.max(1e-6, Math.abs(percentBaseline));
    const pct = ((price - base) / base) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }
  if (Math.abs(price) >= 1000) return Math.round(price).toLocaleString('en-US');
  if (Math.abs(price) >= 10) return price.toFixed(1);
  return price.toFixed(2);
}

/**
 * Formats a candle timestamp cleanly for X-axis ticks & crosshair time badge.
 */
export function formatCandleAxisTime(timestamp: number, timeframe: string, compact = false): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const d = new Date(timestamp);
  const isIntraday = timeframe === '15M' || timeframe === '1H' || timeframe === '4H';
  if (compact) {
    if (isIntraday) {
      return `${d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })} ${String(
        d.getHours()
      ).padStart(2, '0')}:00`;
    }
    return d.toLocaleDateString('fa-IR', { year: '2-digit', month: 'short', day: 'numeric' });
  }
  if (isIntraday) {
    return `${d.toLocaleDateString('fa-IR')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  }
  return d.toLocaleDateString('fa-IR');
}
