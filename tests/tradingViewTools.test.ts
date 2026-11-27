import { describe, it, expect } from 'vitest';
import {
  computeSMA,
  computeMACD,
  computeVWAP,
  mapAssetToTradingViewSymbol,
  mapTimeframeToTradingViewInterval
} from '../src/engine/chartToolsEngine';
import { Candle } from '../src/types/elliott';

function makeCandles(count: number, basePrice = 100): Candle[] {
  const start = 1_700_000_000_000;
  return Array.from({ length: count }, (_, i) => {
    const close = basePrice + i * 2 + Math.sin(i * 0.4) * 5;
    return {
      timestamp: start + i * 3_600_000,
      open: close - 1.5,
      high: close + 3,
      low: close - 3,
      close,
      volume: 1000 + i * 50
    };
  });
}

describe('TradingView Tools & Indicator Engine', () => {
  it('computes SMA accurately over a rolling window', () => {
    const candles = makeCandles(10, 10).map((c, idx) => ({
      ...c,
      close: (idx + 1) * 10
    }));
    const sma3 = computeSMA(candles, 3);
    expect(sma3).toHaveLength(10);
    expect(sma3[0]).toBeNull();
    expect(sma3[1]).toBeNull();
    expect(sma3[2]).toBeCloseTo(20, 6);
    expect(sma3[3]).toBeCloseTo(30, 6);
    expect(sma3[9]).toBeCloseTo(90, 6);
  });

  it('computes MACD(12, 26, 9) array matching candle length with macd, signal, and histogram', () => {
    const candles = makeCandles(60, 500);
    const macd = computeMACD(candles, 12, 26, 9);
    expect(macd).toHaveLength(60);
    expect(macd[24]).toBeNull();
    expect(macd[25]).not.toBeNull();
    expect(macd[25]!.signal).toBeNull();
    expect(macd[33]!.signal).not.toBeNull();
    expect(macd[59]!.histogram).toBeCloseTo(
      macd[59]!.macd - (macd[59]!.signal as number),
      6
    );
  });

  it('computes cumulative VWAP bounded between cumulative lows and highs', () => {
    const candles = makeCandles(20, 200);
    const vwap = computeVWAP(candles);
    expect(vwap).toHaveLength(20);
    const firstTypical = (candles[0].high + candles[0].low + candles[0].close) / 3;
    expect(vwap[0]).toBeCloseTo(firstTypical, 6);
    const minLow = Math.min(...candles.map(c => c.low));
    const maxHigh = Math.max(...candles.map(c => c.high));
    expect(vwap[19]).not.toBeNull();
    expect(vwap[19]!).toBeGreaterThanOrEqual(minLow);
    expect(vwap[19]!).toBeLessThanOrEqual(maxHigh);
  });

  it('maps BTCUSDT, XAUUSD, and TSE symbols cleanly to TradingView ticker metadata', () => {
    const btc = mapAssetToTradingViewSymbol('BTCUSDT', 'BTC/USDT');
    expect(btc.tvSymbol).toBe('BINANCE:BTCUSDT');
    expect(btc.isNativeOnTradingView).toBe(true);

    const gold = mapAssetToTradingViewSymbol('XAUUSD', 'طلای جهانی (XAU/USD)');
    expect(gold.tvSymbol).toBe('OANDA:XAUUSD');
    expect(gold.isNativeOnTradingView).toBe(true);

    const shapna = mapAssetToTradingViewSymbol('TSE_SHAPNA', 'شپنا (پالایش نفت اصفهان)');
    expect(shapna.isNativeOnTradingView).toBe(false);
    expect(shapna.tvSymbol).toBe('BINANCE:BTCUSDT');
    expect(shapna.displayNameFa).toBeTruthy();
  });

  it('maps internal timeframes to TradingView intervals', () => {
    expect(mapTimeframeToTradingViewInterval('1M')).toBe('M');
    expect(mapTimeframeToTradingViewInterval('1W')).toBe('W');
    expect(mapTimeframeToTradingViewInterval('1D')).toBe('D');
    expect(mapTimeframeToTradingViewInterval('4H')).toBe('240');
    expect(mapTimeframeToTradingViewInterval('1H')).toBe('60');
    expect(mapTimeframeToTradingViewInterval('15M')).toBe('15');
  });
});
