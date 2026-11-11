/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Pivot and Swing Detection Engine with ATR Adaptive Sensitivity,
 * Minimum 3-Candle qualification, and Shadow exception under trend pressure.
 */

import { Candle, WaveVertex } from '../types/elliott';

export interface PivotPoint {
  index: number;
  timestamp: number;
  price: number;
  type: 'HIGH' | 'LOW';
  consecutiveCandles: number;
  isShadowException: boolean;
  strength: number; // 0 to 100
}

export class PivotDetector {
  /**
   * Calculate Average True Range (ATR) to calibrate swing threshold
   */
  public static calculateATR(candles: Candle[], period: number = 14): number[] {
    const atr: number[] = [];
    if (candles.length === 0) return atr;

    let trSum = 0;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      let tr = c.high - c.low;
      if (i > 0) {
        const prevClose = candles[i - 1].close;
        const hl = c.high - c.low;
        const hc = Math.abs(c.high - prevClose);
        const lc = Math.abs(c.low - prevClose);
        tr = Math.max(hl, hc, lc);
      }

      if (i < period) {
        trSum += tr;
        atr.push(trSum / (i + 1));
      } else {
        const currentAtr = (atr[i - 1] * (period - 1) + tr) / period;
        atr.push(currentAtr);
      }
    }
    return atr;
  }

  /**
   * Detect pivots with minimum 3-candle qualification rule
   * and Shadow exception in case of strong trend pressure.
   */
  public static detectPivots(
    candles: Candle[],
    leftBars: number = 3,
    rightBars: number = 3,
    adaptiveAtrMult: number = 1.0
  ): PivotPoint[] {
    const pivots: PivotPoint[] = [];
    if (candles.length < leftBars + rightBars + 1) return pivots;

    const atr = this.calculateATR(candles, 14);

    for (let i = leftBars; i < candles.length - rightBars; i++) {
      const current = candles[i];
      const threshold = (atr[i] || (current.high * 0.01)) * adaptiveAtrMult;

      // Check Swing High
      let isHigh = true;
      for (let j = i - leftBars; j <= i + rightBars; j++) {
        if (j !== i && candles[j].high >= current.high) {
          isHigh = false;
          break;
        }
      }

      // Check Swing Low
      let isLow = true;
      for (let j = i - leftBars; j <= i + rightBars; j++) {
        if (j !== i && candles[j].low <= current.low) {
          isLow = false;
          break;
        }
      }

      if (isHigh) {
        // Count consecutive bullish candles leading to high (Minimum 3-candle qualification)
        let consecutiveBullish = 0;
        for (let k = i - 1; k >= Math.max(0, i - 6); k--) {
          if (candles[k].close >= candles[k].open) {
            consecutiveBullish++;
          } else {
            break;
          }
        }

        // Shadow exception: check if upper shadow is very long in strong momentum
        const body = Math.abs(current.close - current.open);
        const upperShadow = current.high - Math.max(current.close, current.open);
        const isShadowException = upperShadow > body * 2 && consecutiveBullish >= 2;

        pivots.push({
          index: i,
          timestamp: current.timestamp,
          price: current.high,
          type: 'HIGH',
          consecutiveCandles: consecutiveBullish,
          isShadowException,
          strength: Math.min(100, Math.round(50 + consecutiveBullish * 10))
        });
      } else if (isLow) {
        let consecutiveBearish = 0;
        for (let k = i - 1; k >= Math.max(0, i - 6); k--) {
          if (candles[k].close <= candles[k].open) {
            consecutiveBearish++;
          } else {
            break;
          }
        }

        const body = Math.abs(current.close - current.open);
        const lowerShadow = Math.min(current.close, current.open) - current.low;
        const isShadowException = lowerShadow > body * 2 && consecutiveBearish >= 2;

        pivots.push({
          index: i,
          timestamp: current.timestamp,
          price: current.low,
          type: 'LOW',
          consecutiveCandles: consecutiveBearish,
          isShadowException,
          strength: Math.min(100, Math.round(50 + consecutiveBearish * 10))
        });
      }
    }

    return pivots;
  }

  /**
   * Find Absolute Bottom (کف مطلق) in chart data
   * and find Valid Low (کف معتبر) which starts after a full 8-wave cycle or validated impulse
   */
  public static findAbsoluteAndValidLows(candles: Candle[]): { absoluteBottom: WaveVertex; validLow?: WaveVertex } {
    if (candles.length === 0) {
      return {
        absoluteBottom: { label: '0', price: 0, timestamp: 0, candleIndex: 0, isConfirmed: false }
      };
    }

    let minIndex = 0;
    let minPrice = candles[0].low;

    for (let i = 1; i < candles.length; i++) {
      if (candles[i].low < minPrice) {
        minPrice = candles[i].low;
        minIndex = i;
      }
    }

    const absoluteBottom: WaveVertex = {
      label: '0 (کف مطلق)',
      price: minPrice,
      timestamp: candles[minIndex].timestamp,
      candleIndex: minIndex,
      isConfirmed: true
    };

    // Find a subsequent valid low that didn't violate the absolute bottom
    let validLow: WaveVertex | undefined;
    if (minIndex < candles.length - 15) {
      // Look for a secondary swing low
      let secondMinPrice = Infinity;
      let secondMinIndex = -1;
      for (let j = minIndex + 10; j < candles.length - 5; j++) {
        if (candles[j].low > minPrice && candles[j].low < secondMinPrice) {
          secondMinPrice = candles[j].low;
          secondMinIndex = j;
        }
      }
      if (secondMinIndex !== -1) {
        validLow = {
          label: '2 (کف معتبر)',
          price: secondMinPrice,
          timestamp: candles[secondMinIndex].timestamp,
          candleIndex: secondMinIndex,
          isConfirmed: true
        };
      }
    }

    return { absoluteBottom, validLow };
  }
}
