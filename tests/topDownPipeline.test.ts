import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { FractalEngine } from '../src/engine/fractalEngine';
import { TopDownPipelineEngine } from '../src/engine/topDownPipeline';
import { Candle, WaveScenario, WaveVertex } from '../src/types/elliott';

function makeSeries(
  count: number,
  stepMs: number = 86400_000,
  startTs: number = Date.UTC(2024, 0, 1),
  basePrice: number = 100
): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const close = basePrice + i * 0.8 + Math.sin(i * 0.4) * 3;
    const open = close - 0.5;
    out.push({
      timestamp: startTs + i * stepMs,
      open: Number(open.toFixed(2)),
      high: Number((Math.max(open, close) + 1.8).toFixed(2)),
      low: Number((Math.min(open, close) - 1.8).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 1000 + i * 10
    });
  }
  return out;
}

function makeScenario(
  candles: Candle[],
  overrides: Partial<WaveScenario> = {}
): WaveScenario {
  const step = Math.max(1, Math.floor((candles.length - 1) / 5));
  const idxs = [0, step, step * 2, step * 3, step * 4, Math.min(candles.length - 1, step * 5)];
  const prices = [100, 160, 125, 235, 195, 275];
  const labels = ['0', '1', '2', '3', '4', '5'];
  const vertices: WaveVertex[] = idxs.map((cIdx, i) => ({
    label: labels[i],
    candleIndex: cIdx,
    price: prices[i],
    timestamp: candles[cIdx]?.timestamp ?? Date.UTC(2024, 0, 1) + cIdx * 86400_000,
    isConfirmed: true
  }));

  return {
    id: 'pipeline_test_sc',
    name: 'Test Primary Cycle',
    color: '#06b6d4',
    isPrimary: true,
    isLocked: false,
    isSelectedForTree: true,
    patternType: 'IDEAL_CYCLE',
    degree: 'PRIMARY',
    direction: 'BULLISH',
    vertices,
    currentWave: '5',
    completionPercentage: 100,
    validityScore: 95,
    idealnessScore: 90,
    confidenceScore: 88,
    invalidationPrice: 100,
    targets: [],
    rulesResults: [],
    source: 'AI',
    timeframe: '1D',
    ...overrides
  };
}

describe('TopDownPipelineEngine & Edge-Case Boundary Tables (Steps 0-11, Tables 1-15)', () => {
  describe('Table 1 — Input Data Sanitization & Error Boundaries', () => {
    it('1.1 & 1.2: rejects empty and <10 candle datasets', () => {
      const empty = PatternEngines.validateInputData([], '1D');
      expect(empty.valid).toBe(false);

      const short = PatternEngines.validateInputData(makeSeries(9), '1D');
      expect(short.valid).toBe(false);
    });

    it('1.8: errors on duplicate timestamps', () => {
      const candles = makeSeries(20);
      candles[8] = { ...candles[8], timestamp: candles[7].timestamp };

      const inputRep = PatternEngines.validateInputData(candles, '1D');
      expect(inputRep.valid).toBe(false);
      expect(inputRep.hasDuplicateTimestamps).toBe(true);

      const report = TopDownPipelineEngine.run({
        candles,
        scenario: makeScenario(candles),
        timeframe: '1D'
      });
      expect(report.steps[0].status).toBe('BLOCKED');
      expect(report.edgeCasesTriggered.some(e => e.id === 'T1_0_5')).toBe(true);
    });

    it('1.9: auto-sorts out-of-order candles chronologically into sanitizedCandles and emits warning', () => {
      const candles = makeSeries(24);
      const swapped = [...candles];
      const tmp = swapped[4];
      swapped[4] = swapped[9];
      swapped[9] = tmp;

      const inputRep = PatternEngines.validateInputData(swapped, '1D');
      expect(inputRep.valid).toBe(true);
      expect(inputRep.sortedOutOfOrder).toBe(true);
      expect(inputRep.sanitizedCandles?.length).toBe(24);
      for (let i = 1; i < (inputRep.sanitizedCandles?.length ?? 0); i++) {
        expect(inputRep.sanitizedCandles![i].timestamp).toBeGreaterThan(inputRep.sanitizedCandles![i - 1].timestamp);
      }

      const report = TopDownPipelineEngine.run({
        candles: swapped,
        scenario: makeScenario(candles),
        timeframe: '1D'
      });
      expect(report.edgeCasesTriggered.some(e => e.id === 'T1_0_6')).toBe(true);
    });

    it('1.5: forward-fills <=10% NaN into sanitizedCandles cleanly and rejects first-candle NaN', () => {
      const candles = makeSeries(30);
      candles[5] = { ...candles[5], close: Number.NaN, high: Number.NaN };
      const ffRep = PatternEngines.validateInputData(candles, '1D');
      expect(ffRep.valid).toBe(true);
      expect(ffRep.forwardFilledCount).toBe(1);
      expect(Number.isFinite(ffRep.sanitizedCandles?.[5].close)).toBe(true);

      const firstNan = makeSeries(20);
      firstNan[0] = { ...firstNan[0], close: Number.NaN };
      const firstNanRep = PatternEngines.validateInputData(firstNan, '1D');
      expect(firstNanRep.valid).toBe(false);
    });

    it('1.7: keeps zero-volume candles valid and records count', () => {
      const candles = makeSeries(20);
      candles[3] = { ...candles[3], volume: 0 };
      const inputRep = PatternEngines.validateInputData(candles, '1D');
      expect(inputRep.valid).toBe(true);
      expect(inputRep.hasZeroVolumeCandles).toBe(true);
      expect(inputRep.zeroVolumeCount).toBe(1);
    });

    it('1.11 & 1.12: selects 1W start TF when history > 10 years or < 1 year', () => {
      const over10Yr = makeSeries(40, 120 * 86400_000, Date.UTC(2012, 0, 1));
      const rep10 = PatternEngines.validateInputData(over10Yr, '1M');
      expect(rep10.recommendedStartTf).toBe('1W');

      const under1Yr = makeSeries(35, 7 * 86400_000, Date.UTC(2025, 0, 1));
      const repUnder1 = PatternEngines.validateInputData(under1Yr, '1D');
      expect(repUnder1.recommendedStartTf).toBe('1W');
    });
  });

  describe('Step 1 & 4-6 — TSE_IRAN Constraints, Multi-TF Refinement & Degree Promotion', () => {
    it('blocks 1H/15M and enforces degree <= 4 cap on TSE_IRAN', () => {
      const candles = makeSeries(40);
      const tse1H = TopDownPipelineEngine.run({
        candles,
        scenario: makeScenario(candles, { timeframe: '1H', degree: 'PRIMARY' }),
        marketType: 'TSE_IRAN',
        timeframe: '1H'
      });
      expect(tse1H.steps[1].status).toBe('BLOCKED');
      expect(tse1H.edgeCasesTriggered.some(e => e.id === 'T2_2_4')).toBe(true);

      const tse15M = TopDownPipelineEngine.run({
        candles,
        scenario: makeScenario(candles, { timeframe: '15M', degree: 'PRIMARY' }),
        marketType: 'TSE_IRAN',
        timeframe: '15M'
      });
      expect(tse15M.steps[1].status).toBe('BLOCKED');

      const tseMonthlyExceedsCap = TopDownPipelineEngine.run({
        candles,
        scenario: makeScenario(candles, { timeframe: '1M', degree: 'INTERMEDIATE' }),
        marketType: 'TSE_IRAN',
        timeframe: '1M'
      });
      expect(tseMonthlyExceedsCap.maxAllowedDegree).toBeLessThanOrEqual(4);
      expect(tseMonthlyExceedsCap.steps.find(s => s.stepNumber === 6)?.status).toBe('WARNING');
    });

    it('walks 1M -> 1W -> 1D -> 4H across multi-TF candles, respects TSE_IRAN 1H/15M stop, and falls back to higher TF when cycles fail', () => {
      const baseTs = Date.UTC(2020, 0, 1);
      const candles1M = makeSeries(60, 30 * 86400_000, baseTs);
      const candles1W = makeSeries(120, 7 * 86400_000, baseTs);
      const candles1D = makeSeries(240, 86400_000, baseTs);
      const candles4H = makeSeries(240, 4 * 3600_000, baseTs);
      const candles1H = makeSeries(240, 3600_000, baseTs);

      const scenario = makeScenario(candles1D, { degree: 'CYCLE' });

      const cryptoRef = FractalEngine.refineCyclesAcrossTimeframes(
        { '1M': candles1M, '1W': candles1W, '1D': candles1D, '4H': candles4H, '1H': candles1H },
        [scenario],
        '1M',
        'CRYPTO'
      );
      expect(cryptoRef.summary.traversedTimeframes.length).toBeGreaterThanOrEqual(2);
      expect(cryptoRef.summary.fallbackToHigherTf).toBe(false);

      const tseRef = FractalEngine.refineCyclesAcrossTimeframes(
        { '1D': candles1D, '1H': candles1H, '15M': candles1H },
        [scenario],
        '1D',
        'TSE_IRAN'
      );
      expect(tseRef.summary.traversedTimeframes).not.toContain('1H');
      expect(tseRef.summary.traversedTimeframes).not.toContain('15M');

      const invalidList = [makeScenario(candles1D, { validityScore: 45 })];
      const fallbackRef = FractalEngine.refineCyclesAcrossTimeframes(
        { '1W': candles1W, '1D': candles1D },
        invalidList,
        '1W',
        'CRYPTO'
      );
      expect(fallbackRef.summary.fallbackToHigherTf).toBe(true);
    });

    it('promotes scenario degree, relabels vertices, and flags excess micro level beyond TF cap', () => {
      const candles = makeSeries(40);
      const scenario = makeScenario(candles, { degree: 'INTERMEDIATE' });
      const res = FractalEngine.promoteScenarioDegrees(scenario, 'TSE_IRAN', '1D');
      expect(res.promoted).toBe(true);
      expect(res.scenario.degree).toBe('PRIMARY');
      expect(res.scenario.vertices[1].label).toBe('1');
      expect(typeof res.droppedSmallestLevel).toBe('boolean');

      const superRes = FractalEngine.promoteScenarioDegrees(
        makeScenario(candles, { degree: 'SUPER_CYCLE' }),
        'CRYPTO',
        '1M'
      );
      expect(superRes.promoted).toBe(false);
    });
  });

  describe('Steps 0-11 End-to-End Pipeline Execution, Numeric Trailing Stop & Performance Budget (< 500ms)', () => {
    it('completes all 12 steps (0..11) for 1000 candles within 500ms budget with numeric trailingStopPrice', () => {
      const candles1000 = makeSeries(1000, 86400_000, Date.UTC(2022, 0, 1));
      const scenario = makeScenario(candles1000, { degree: 'PRIMARY', timeframe: '1D' });

      const report = TopDownPipelineEngine.run({
        candles: candles1000,
        candlesByTf: {
          '1W': candles1000.slice(0, 140),
          '1D': candles1000,
          '4H': candles1000.slice(0, 200)
        },
        scenario,
        scenarios: [scenario],
        marketType: 'CRYPTO',
        timeframe: '1D',
        availableTimeframes: ['1M', '1W', '1D', '4H', '1H', '15M']
      });

      expect(report.steps.map(s => s.stepNumber)).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11]);
      expect(report.budgetOk).toBe(true);
      expect(report.executionMs).toBeLessThan(500);
      expect(typeof report.trailingStopPrice).toBe('number');
      expect(['ACTIVE', 'INACTIVE_WARNING', 'IMMEDIATE_EXIT']).toContain(report.trailingStopStatus);
      expect(report.multiTfRefinementSummary?.traversedTimeframes.length).toBeGreaterThan(0);
      expect(report.dailyNeedsLowerTf).toBe(false);
    });

    it('detects missing 5-wave count on Daily (1D) -> recommends 4H/1H (4H only for TSE_IRAN) and verifies Impulsive higher-TF legs in lower TF', () => {
      const baseTs = Date.UTC(2024, 0, 1);
      // Smooth monotonic 1D series (no internal pivots on Daily!) -> 1D lacks 5-wave structure and leg appears IMPULSIVE
      const dailySmooth: Candle[] = Array.from({ length: 30 }, (_, i) => {
        const p = 100 + i * 4;
        return {
          time: `d${i}`,
          timestamp: baseTs + i * 86400_000,
          open: p - 1,
          high: p + 1,
          low: p - 1.5,
          close: p,
          volume: 1000
        };
      });

      // Lower-TF 4H candles inside the W0->W1 daily window (days 0..10) showing 5 alternating subwaves!
      const fourHourCandles: Candle[] = [];
      const zigzagPath = [100, 114, 107, 128, 120, 140, 130, 138, 134, 145];
      for (let i = 0; i < 60; i++) {
        const seg = Math.min(zigzagPath.length - 2, Math.floor((i / 60) * (zigzagPath.length - 1)));
        const localT = ((i / 60) * (zigzagPath.length - 1)) - seg;
        const p = zigzagPath[seg] + (zigzagPath[seg + 1] - zigzagPath[seg]) * localT;
        fourHourCandles.push({
          time: `h4_${i}`,
          timestamp: baseTs + i * 4 * 3600_000,
          open: p - 0.4,
          high: p + 0.8,
          low: p - 0.8,
          close: p,
          volume: 600
        });
      }

      const partialScenario = makeScenario(dailySmooth, {
        isPartial: true,
        timeframe: '1D',
        vertices: [
          { label: '0', candleIndex: 0, price: 100, timestamp: dailySmooth[0].timestamp, isConfirmed: true },
          { label: '1', candleIndex: 10, price: 140, timestamp: dailySmooth[10].timestamp, isConfirmed: true },
          { label: '2', candleIndex: 14, price: 122, timestamp: dailySmooth[14].timestamp, isConfirmed: false }
        ]
      });

      const cryptoPipe = TopDownPipelineEngine.run({
        candles: dailySmooth,
        candlesByTf: { '1D': dailySmooth, '4H': fourHourCandles },
        scenario: partialScenario,
        marketType: 'CRYPTO',
        timeframe: '1D'
      });
      expect(cryptoPipe.dailyNeedsLowerTf).toBe(true);
      expect(cryptoPipe.recommendedLowerTimeframes).toEqual(['4H', '1H']);
      expect(cryptoPipe.edgeCasesTriggered.some(e => e.id === 'T5_DAILY_TO_LOWER_TF')).toBe(true);
      expect(cryptoPipe.impulsiveLegsMayBe5Wave?.length).toBeGreaterThan(0);
      expect(cryptoPipe.impulsiveLegsMayBe5Wave?.[0].verifiedLowerTf).toBe('4H');
      expect(cryptoPipe.impulsiveLegsMayBe5Wave?.[0].detectedSubwaves).toBe(5);

      const tsePipe = TopDownPipelineEngine.run({
        candles: dailySmooth,
        candlesByTf: { '1D': dailySmooth, '4H': fourHourCandles },
        scenario: partialScenario,
        marketType: 'TSE_IRAN',
        timeframe: '1D'
      });
      expect(tsePipe.dailyNeedsLowerTf).toBe(true);
      expect(tsePipe.recommendedLowerTimeframes).toEqual(['4H']);

      // Section 2.6: Insufficient candles prevent 4-degree counting
      const degLow = FractalEngine.assignDegrees(4, '1D', 'TSE_IRAN', 20);
      expect(degLow.maxAllowed).toBeLessThan(4);
      const degUnder10 = FractalEngine.assignDegrees(4, '1D', 'CRYPTO', 8);
      expect(degUnder10.maxAllowed).toBe(0);
    });

    it('differentiates Impulsive vs Fractal practically (slope, volume, rests, hidden gradual structure) and TF degree caps', () => {
      const tsBase = Date.UTC(2025, 0, 1);
      // 1) Sharp move with 1 tiny counter bar (insufficient rest) -> IMPULSIVE_MOMENTUM
      // 2) Gradual slow move over 14 bars without clear swings (slope < 0.35*ATR/bar) -> FRACTAL_EXTENDED (hidden subwaves)
      const bars: Candle[] = Array.from({ length: 40 }, (_, i) => {
        if (i <= 8) {
          const p = 100 + i * 12;
          const isTinyRest = i === 4;
          return {
            time: `b${i}`,
            timestamp: tsBase + i * 86400_000,
            open: isTinyRest ? p + 1 : p - 8,
            close: isTinyRest ? p - 1 : p + 8,
            high: p + 10,
            low: p - 9,
            volume: 3200
          };
        }
        // Gradual low-slope climb across i=10..26 (netMove=14 over 16 bars, avgAtr ~ 6 -> slope < 0.2)
        const gp = 195 + (i - 10) * 0.9;
        return {
          time: `b${i}`,
          timestamp: tsBase + i * 86400_000,
          open: gp - 0.5,
          close: gp + 0.6,
          high: gp + 3.2,
          low: gp - 3.2,
          volume: 900
        };
      });

      const testScen: WaveScenario = {
        id: 'nature-test',
        name: 'Nature Practical Check',
        color: '#38bdf8',
        isPrimary: true,
        isLocked: false,
        isSelectedForTree: true,
        patternType: 'IDEAL_CYCLE',
        degree: 'PRIMARY',
        direction: 'BULLISH',
        vertices: [
          { label: '0', price: 100, candleIndex: 0, timestamp: bars[0].timestamp, isConfirmed: true },
          { label: '1', price: 204, candleIndex: 8, timestamp: bars[8].timestamp, isConfirmed: true },
          { label: '2', price: 195, candleIndex: 10, timestamp: bars[10].timestamp, isConfirmed: true },
          { label: '3', price: 209, candleIndex: 26, timestamp: bars[26].timestamp, isConfirmed: true }
        ],
        currentWave: '3',
        completionPercentage: 65,
        validityScore: 88,
        idealnessScore: 85,
        confidenceScore: 87,
        invalidationPrice: 100,
        targets: [],
        rulesResults: [],
        source: 'AI',
        timeframe: '1D'
      };

      const natures = FractalEngine.classifyScenarioWaveNatures(testScen, bars);
      expect(natures[0].nature).toBe('IMPULSIVE_MOMENTUM'); // sharp + high vol + 1 tiny rest
      expect(natures[2].nature).toBe('FRACTAL_EXTENDED'); // gradual hidden internal structure

      // Degree limits: 1D=4, 1W=3, 1M=2 (TSE_IRAN) and 4H>=5 (Forex/Crypto)
      expect(FractalEngine.getMaxDegreesForTimeframe('1D', 'TSE_IRAN', true)).toBe(4);
      expect(FractalEngine.getMaxDegreesForTimeframe('1W', 'TSE_IRAN', true)).toBe(3);
      expect(FractalEngine.getMaxDegreesForTimeframe('1M', 'TSE_IRAN', true)).toBe(2);
      expect(FractalEngine.getMaxDegreesForTimeframe('4H', 'CRYPTO', true)).toBeGreaterThanOrEqual(5);
    });
  });
});


