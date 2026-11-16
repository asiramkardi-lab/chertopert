/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TrendStrengthIndicator:
 * Calculates Wilder RSI(14)-based divergence (Regular & Hidden) and
 * Volume-Weighted Momentum for every wave segment in a WaveScenario,
 * mapping each wave vertex to a color-coded internal strength signal (green/yellow/red).
 */

import { Candle, WaveScenario, WaveVertex } from '../types/elliott';
import { PivotDetector } from './pivotDetector';

export type TrendSignalLevel = 'GREEN' | 'YELLOW' | 'RED';

export type RsiDivergenceType =
  | 'NONE'
  | 'REGULAR_BEARISH'
  | 'REGULAR_BULLISH'
  | 'HIDDEN_BULLISH'
  | 'HIDDEN_BEARISH';

export interface SegmentStrengthAnalysis {
  segmentIndex: number; // 0-based: connects vertices[segmentIndex] -> vertices[segmentIndex + 1]
  fromLabel: string;
  toLabel: string;
  direction: 'BULLISH' | 'BEARISH';
  candleSpan: number;
  startRsi: number;
  endRsi: number;
  extremeRsi: number; // Peak RSI for bullish leg, trough RSI for bearish leg
  rsiDelta: number;
  divergenceType: RsiDivergenceType;
  divergenceLabelFa: string;
  hasAdverseDivergence: boolean;
  volumeRatio: number; // segment avg volume / baseline avg volume
  directionalVolumeShare: number; // 0..1 share of volume aligned with segment direction
  volumeWeightedMomentum: number; // 0..100 normalized internal VW momentum score
  vwSignedFlowPct: number; // signed volume-weighted price return %
  strengthScore: number; // 0..100 composite internal strength
  signal: TrendSignalLevel;
  signalLabelFa: string;
  summaryFa: string;
}

export interface VertexStrengthSignal {
  vertexIndex: number;
  label: string;
  rsi: number;
  signal: TrendSignalLevel;
  signalLabelFa: string;
  divergenceType: RsiDivergenceType;
  divergenceLabelFa: string;
  volumeWeightedMomentum: number;
  volumeRatio: number;
  strengthScore: number;
  segmentSummaryFa: string;
  segment?: SegmentStrengthAnalysis;
}

export interface ScenarioTrendStrengthReport {
  rsiSeries: number[];
  segments: SegmentStrengthAnalysis[];
  vertices: VertexStrengthSignal[];
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const round1 = (val: number) => Math.round(val * 10) / 10;

export class TrendStrengthIndicator {
  /**
   * Computes Wilder's RSI series across candles.
   * Adapts gracefully when candles.length <= period.
   */
  public static calculateRSI(candles: Candle[], period: number = 14): number[] {
    const n = candles.length;
    if (n === 0) return [];
    if (n === 1) return [50];

    const effectivePeriod = Math.max(2, Math.min(period, n - 1));
    const rsi: number[] = new Array(n).fill(50);

    let gainSum = 0;
    let lossSum = 0;

    for (let i = 1; i <= effectivePeriod; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change >= 0) gainSum += change;
      else lossSum += Math.abs(change);
      // Warm-up progressive RSI for early indices
      const avgG = gainSum / i;
      const avgL = lossSum / i;
      if (avgL === 0) {
        rsi[i] = avgG > 0 ? 100 : 50;
      } else {
        const rs = avgG / avgL;
        rsi[i] = round1(100 - 100 / (1 + rs));
      }
    }

    let avgGain = gainSum / effectivePeriod;
    let avgLoss = lossSum / effectivePeriod;

    for (let i = effectivePeriod + 1; i < n; i++) {
      const change = candles[i].close - candles[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (effectivePeriod - 1) + gain) / effectivePeriod;
      avgLoss = (avgLoss * (effectivePeriod - 1) + loss) / effectivePeriod;

      if (avgLoss === 0) {
        rsi[i] = avgGain > 0 ? 100 : 50;
      } else {
        const rs = avgGain / avgLoss;
        rsi[i] = round1(100 - 100 / (1 + rs));
      }
    }

    return rsi;
  }

  /**
   * Computes peak/trough RSI within a small window around a pivot candle index
   * to capture true oscillator swing extremes without single-bar lag artifacts.
   */
  private static getLocalExtremeRSI(
    rsiSeries: number[],
    candleIndex: number,
    mode: 'PEAK' | 'TROUGH',
    radius: number = 2
  ): number {
    if (rsiSeries.length === 0) return 50;
    const lo = clamp(candleIndex - radius, 0, rsiSeries.length - 1);
    const hi = clamp(candleIndex + radius, 0, rsiSeries.length - 1);
    let extreme = rsiSeries[clamp(candleIndex, 0, rsiSeries.length - 1)];
    for (let i = lo; i <= hi; i++) {
      if (mode === 'PEAK') {
        if (rsiSeries[i] > extreme) extreme = rsiSeries[i];
      } else {
        if (rsiSeries[i] < extreme) extreme = rsiSeries[i];
      }
    }
    return round1(extreme);
  }

  /**
   * Calculates volume-weighted momentum metrics for a segment [startIdx .. endIdx].
   */
  private static computeSegmentVolumeMomentum(
    candles: Candle[],
    atrSeries: number[],
    vStart: WaveVertex,
    vEnd: WaveVertex,
    baselineAvgVol: number
  ): {
    volumeRatio: number;
    directionalVolumeShare: number;
    volumeWeightedMomentum: number;
    vwSignedFlowPct: number;
  } {
    const maxIdx = candles.length - 1;
    const sIdx = clamp(Math.min(vStart.candleIndex, vEnd.candleIndex), 0, maxIdx);
    const eIdx = clamp(Math.max(vStart.candleIndex, vEnd.candleIndex), 0, maxIdx);
    const isBull = vEnd.price >= vStart.price;
    const candleSpan = Math.max(1, eIdx - sIdx + 1);

    let totalVol = 0;
    let alignedVol = 0;
    let signedVolWeightedPriceChange = 0;
    let atrSum = 0;

    for (let i = sIdx; i <= eIdx; i++) {
      const c = candles[i];
      const vol = Math.max(0, c.volume);
      totalVol += vol;
      atrSum += atrSeries[i] || Math.max(0.01, c.high - c.low);

      const prevClose = i > 0 ? candles[i - 1].close : c.open;
      const barMove = c.close - prevClose;
      const isBarBull = c.close >= c.open || barMove > 0;
      if ((isBull && isBarBull) || (!isBull && !isBarBull)) {
        alignedVol += vol;
      }

      const pctMove = prevClose > 0 ? (barMove / prevClose) * 100 : 0;
      signedVolWeightedPriceChange += pctMove * vol;
    }

    const segAvgVol = totalVol / candleSpan;
    const volumeRatio = baselineAvgVol > 0 ? segAvgVol / baselineAvgVol : 1;
    const directionalVolumeShare = totalVol > 0 ? alignedVol / totalVol : 0.5;
    const vwSignedFlowPct = totalVol > 0 ? round1(signedVolWeightedPriceChange / totalVol) : 0;

    const avgAtr = atrSum / candleSpan;
    const priceChange = Math.abs(vEnd.price - vStart.price);
    const velocityAtr = avgAtr > 0 ? priceChange / (Math.max(1, eIdx - sIdx) * avgAtr) : 0.5;

    // Normalize 3 institutional components into 0..100 Volume-Weighted Momentum
    const volRatioScore = clamp((volumeRatio / 1.35) * 38, 8, 42);
    const dirShareScore = clamp(directionalVolumeShare * 36, 6, 36);
    const velocityScore = clamp((velocityAtr / 0.85) * 24, 4, 24);
    const alignmentBonus =
      (isBull && vwSignedFlowPct > 0) || (!isBull && vwSignedFlowPct < 0) ? 4 : -6;

    const volumeWeightedMomentum = Math.round(
      clamp(volRatioScore + dirShareScore + velocityScore + alignmentBonus, 5, 100)
    );

    return {
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      directionalVolumeShare: Math.round(directionalVolumeShare * 100) / 100,
      volumeWeightedMomentum,
      vwSignedFlowPct
    };
  }

  private static divergenceLabel(div: RsiDivergenceType): string {
    switch (div) {
      case 'REGULAR_BEARISH':
        return 'واگرایی منفی RSI (تضعیف سقف)';
      case 'REGULAR_BULLISH':
        return 'واگرایی مثبت RSI (تضعیف کف)';
      case 'HIDDEN_BULLISH':
        return 'واگرایی مخفی صعودی (ادامه روند)';
      case 'HIDDEN_BEARISH':
        return 'واگرایی مخفی نزولی (ادامه روند)';
      default:
        return 'هم‌گرایی RSI (بدون واگرایی)';
    }
  }

  private static signalLabel(signal: TrendSignalLevel): string {
    switch (signal) {
      case 'GREEN':
        return 'قدرت روند قوی';
      case 'YELLOW':
        return 'قدرت روند میانه / احتیاط';
      case 'RED':
        return 'ضعف مومنتوم / واگرایی';
    }
  }

  /**
   * Analyzes all wave segments and maps every wave vertex to a color-coded
   * strength signal (GREEN / YELLOW / RED) with full RSI & volume-weighted telemetry.
   */
  public static analyzeScenario(
    scenario: WaveScenario,
    candles: Candle[]
  ): ScenarioTrendStrengthReport {
    const verts = scenario.vertices;
    if (candles.length === 0 || verts.length === 0) {
      return { rsiSeries: [], segments: [], vertices: [] };
    }

    const rsiSeries = this.calculateRSI(candles, 14);
    const atrSeries = PivotDetector.calculateATR(candles, 14);
    const totalMarketVol = candles.reduce((acc, c) => acc + Math.max(0, c.volume), 0);
    const baselineAvgVol = candles.length > 0 ? totalMarketVol / candles.length : 1;
    const maxIdx = candles.length - 1;

    const segments: SegmentStrengthAnalysis[] = [];

    for (let i = 0; i < verts.length - 1; i++) {
      const vStart = verts[i];
      const vEnd = verts[i + 1];
      const sIdx = clamp(vStart.candleIndex, 0, maxIdx);
      const eIdx = clamp(vEnd.candleIndex, 0, maxIdx);
      const isBull = vEnd.price >= vStart.price;
      const direction: 'BULLISH' | 'BEARISH' = isBull ? 'BULLISH' : 'BEARISH';
      const candleSpan = Math.max(1, Math.abs(eIdx - sIdx) + 1);

      const startRsi = rsiSeries[sIdx] ?? 50;
      const endRsi = rsiSeries[eIdx] ?? 50;
      const extremeRsi = this.getLocalExtremeRSI(rsiSeries, eIdx, isBull ? 'PEAK' : 'TROUGH', 2);
      const rsiDelta = round1(endRsi - startRsi);

      const vw = this.computeSegmentVolumeMomentum(candles, atrSeries, vStart, vEnd, baselineAvgVol);

      // Compare with the previous same-direction wave segment for Elliott RSI Divergence
      let divergenceType: RsiDivergenceType = 'NONE';
      const prevSameDir = [...segments]
        .reverse()
        .find(seg => seg.direction === direction);

      if (prevSameDir) {
        const prevEndVert = verts[prevSameDir.segmentIndex + 1];
        if (isBull) {
          // Higher High in price with Lower High in RSI -> Regular Bearish Divergence
          if (vEnd.price > prevEndVert.price * 1.001 && extremeRsi < prevSameDir.extremeRsi - 2.5) {
            divergenceType = 'REGULAR_BEARISH';
          } else if (
            vEnd.price < prevEndVert.price * 0.999 &&
            extremeRsi > prevSameDir.extremeRsi + 3.0
          ) {
            // Lower High in price with Higher High in RSI -> Hidden Bearish Divergence
            divergenceType = 'HIDDEN_BEARISH';
          }
        } else {
          // Lower Low in price with Higher Low in RSI -> Regular Bullish Divergence
          if (vEnd.price < prevEndVert.price * 0.999 && extremeRsi > prevSameDir.extremeRsi + 2.5) {
            divergenceType = 'REGULAR_BULLISH';
          } else if (
            vEnd.price > prevEndVert.price * 1.001 &&
            extremeRsi < prevSameDir.extremeRsi - 3.0
          ) {
            // Higher Low in price with Lower Low in RSI (classic Wave 2/4 pullback reset) -> Hidden Bullish
            divergenceType = 'HIDDEN_BULLISH';
          }
        }
      } else {
        // Fallback single-leg exhaustion check when no prior same-direction segment exists yet:
        // If price travels strongly in direction but RSI fails to confirm (or snaps back opposite), flag mild exhaustion
        const priceMovePct = vStart.price > 0 ? Math.abs(vEnd.price - vStart.price) / vStart.price : 0;
        if (isBull && priceMovePct > 0.03 && extremeRsi < 50 && rsiDelta < 1) {
          divergenceType = 'REGULAR_BEARISH';
        } else if (!isBull && priceMovePct > 0.03 && extremeRsi > 50 && rsiDelta > -1) {
          divergenceType = 'REGULAR_BULLISH';
        }
      }

      const hasAdverseDivergence =
        (isBull && divergenceType === 'REGULAR_BEARISH') ||
        (!isBull && divergenceType === 'REGULAR_BULLISH');

      // RSI confirmation score (0..100)
      let rsiMomentumScore = 55;
      if (isBull) {
        rsiMomentumScore = clamp(
          40 + Math.max(0, extremeRsi - 45) * 1.15 + clamp(rsiDelta, -10, 25) * 0.9,
          15,
          98
        );
      } else {
        rsiMomentumScore = clamp(
          40 + Math.max(0, 55 - extremeRsi) * 1.15 + clamp(-rsiDelta, -10, 25) * 0.9,
          15,
          98
        );
      }

      if (hasAdverseDivergence) {
        rsiMomentumScore = Math.min(rsiMomentumScore, 34);
      } else if (
        (isBull && divergenceType === 'HIDDEN_BEARISH') ||
        (!isBull && divergenceType === 'HIDDEN_BULLISH')
      ) {
        rsiMomentumScore = clamp(rsiMomentumScore + 6, 35, 88);
      }

      const strengthScore = Math.round(
        clamp(vw.volumeWeightedMomentum * 0.56 + rsiMomentumScore * 0.44, 5, 100)
      );

      let signal: TrendSignalLevel = 'YELLOW';
      if (hasAdverseDivergence || strengthScore < 44) {
        signal = 'RED';
      } else if (strengthScore >= 66 && !hasAdverseDivergence) {
        signal = 'GREEN';
      } else {
        signal = 'YELLOW';
      }

      const divergenceLabelFa = this.divergenceLabel(divergenceType);
      const signalLabelFa = this.signalLabel(signal);

      const summaryFa = `موج ${vStart.label}←${vEnd.label}: ${signalLabelFa} (${strengthScore}٪) · RSI ${endRsi} · حجم ${vw.volumeRatio}x`;

      segments.push({
        segmentIndex: i,
        fromLabel: vStart.label,
        toLabel: vEnd.label,
        direction,
        candleSpan,
        startRsi,
        endRsi,
        extremeRsi,
        rsiDelta,
        divergenceType,
        divergenceLabelFa,
        hasAdverseDivergence,
        volumeRatio: vw.volumeRatio,
        directionalVolumeShare: vw.directionalVolumeShare,
        volumeWeightedMomentum: vw.volumeWeightedMomentum,
        vwSignedFlowPct: vw.vwSignedFlowPct,
        strengthScore,
        signal,
        signalLabelFa,
        summaryFa
      });
    }

    // Map each vertex to its internal strength signal
    const vertexSignals: VertexStrengthSignal[] = verts.map((v, idx) => {
      const cIdx = clamp(v.candleIndex, 0, maxIdx);
      const vRsi = rsiSeries[cIdx] ?? 50;

      if (idx === 0) {
        // Origin anchor vertex reflects initial launch thrust of leg 0 -> 1 (if present)
        const firstSeg = segments[0];
        if (!firstSeg) {
          return {
            vertexIndex: 0,
            label: v.label,
            rsi: vRsi,
            signal: 'YELLOW',
            signalLabelFa: 'نقطه مبدأ',
            divergenceType: 'NONE',
            divergenceLabelFa: 'نقطه شروع ساختار',
            volumeWeightedMomentum: 50,
            volumeRatio: 1,
            strengthScore: 50,
            segmentSummaryFa: `مبدأ ${v.label} · RSI ${vRsi}`
          };
        }

        const originScore = Math.round(clamp(firstSeg.strengthScore * 0.92 + 5, 10, 98));
        const originSignal: TrendSignalLevel =
          originScore >= 66 ? 'GREEN' : originScore >= 44 ? 'YELLOW' : 'RED';
        return {
          vertexIndex: 0,
          label: v.label,
          rsi: vRsi,
          signal: originSignal,
          signalLabelFa:
            originSignal === 'GREEN'
              ? 'پرتاب اولیه پرقدرت'
              : originSignal === 'YELLOW'
              ? 'پرتاب اولیه متعادل'
              : 'پرتاب اولیه کم‌جان',
          divergenceType: 'NONE',
          divergenceLabelFa: 'نقطه شروع حرکت',
          volumeWeightedMomentum: firstSeg.volumeWeightedMomentum,
          volumeRatio: firstSeg.volumeRatio,
          strengthScore: originScore,
          segmentSummaryFa: `آغاز حرکت از ${v.label} · پرتاب موج اول ${originScore}٪ · RSI ${vRsi}`,
          segment: firstSeg
        };
      }

      const incomingSeg = segments[idx - 1];
      return {
        vertexIndex: idx,
        label: v.label,
        rsi: incomingSeg.endRsi,
        signal: incomingSeg.signal,
        signalLabelFa: incomingSeg.signalLabelFa,
        divergenceType: incomingSeg.divergenceType,
        divergenceLabelFa: incomingSeg.divergenceLabelFa,
        volumeWeightedMomentum: incomingSeg.volumeWeightedMomentum,
        volumeRatio: incomingSeg.volumeRatio,
        strengthScore: incomingSeg.strengthScore,
        segmentSummaryFa: incomingSeg.summaryFa,
        segment: incomingSeg
      };
    });

    return {
      rsiSeries,
      segments,
      vertices: vertexSignals
    };
  }
}
