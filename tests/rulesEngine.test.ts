import { describe, it, expect } from 'vitest';
import { RulesEngine } from '../src/engine/rulesEngine';
import { SmartRuleAlertEngine } from '../src/engine/smartRuleAlertEngine';
import { TargetProjectionEngine } from '../src/engine/targetProjectionEngine';
import { PatternEngines } from '../src/engine/patternEngines';
import { FractalEngine, DEGREE_CONFIGS, calculateProjection } from '../src/engine/fractalEngine';
import {
  WAVE_NUMERIC_TOLERANCE,
  cleanFloat,
  evaluateWave2Retracement,
  evaluateWave3NotShortest,
  evaluateWave4Overlap,
  evaluateZigzagWaveB,
  evaluateFlatWaveB,
  guardManualVertexEdit
} from '../src/engine/waveToleranceLayer';
import { Candle, PatternFamily, WaveDirection, WaveScenario, WaveVertex } from '../src/types/elliott';

function buildCandles(count: number = 60, startPrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  const startTs = Date.UTC(2025, 0, 1);
  for (let i = 0; i < count; i++) {
    const close = startPrice + i * 0.6 + Math.sin(i * 0.35) * 4;
    const open = close - 0.9;
    const high = Math.max(open, close) + 2.1;
    const low = Math.min(open, close) - 2.1;
    candles.push({
      timestamp: startTs + i * 86400_000,
      open: cleanFloat(open, 2),
      high: cleanFloat(high, 2),
      low: cleanFloat(low, 2),
      close: cleanFloat(close, 2),
      volume: 1200 + i * 20
    });
  }
  return candles;
}

function buildVertices(prices: number[], labels?: string[]): WaveVertex[] {
  const defaultLabels = ['0', '1', '2', '3', '4', '5'];
  const startTs = Date.UTC(2025, 0, 1);
  return prices.map((price, idx) => ({
    label: labels?.[idx] ?? defaultLabels[idx] ?? `W${idx}`,
    candleIndex: idx * 6,
    price,
    timestamp: startTs + idx * 6 * 86400_000,
    isConfirmed: true
  }));
}

function buildScenario(
  patternType: PatternFamily,
  prices: number[],
  direction: WaveDirection = 'BULLISH',
  labels?: string[]
): WaveScenario {
  return {
    id: `vitest_${patternType}_${direction}`,
    name: `Scenario ${patternType}`,
    degree: 'PRIMARY',
    timeframe: '1D',
    patternType,
    direction,
    vertices: buildVertices(prices, labels),
    isPrimary: true,
    isLocked: false,
    validityScore: 100,
    probability: 82,
    rulesResults: [],
    targets: [],
    invalidationPrice: prices[0],
    color: '#10b981',
    source: 'USER_EDITED'
  };
}

describe('Category 3 Cardinal Rules & 0.1% Tolerance Layer (RulesEngine)', () => {
  const candles = buildCandles(60);

  describe('Category 3.1 — Cardinal Rule 1: Corrective Wave < 100% of Motive Wave', () => {
    it('3.1.1: flags exact 100% Wave 2 retracement as Rule 1 violation and suggests ANTI_CYCLE', () => {
      const evalR1 = evaluateWave2Retracement(100, 100);
      expect(evalR1.passed).toBe(false);
      expect(evalR1.isExact100Violation).toBe(true);

      const summary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 100, 340, 240, 420]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const r1 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1');
      expect(r1).toBeDefined();
      expect(r1?.passed).toBe(false);
      expect(r1?.canBeSolvedByAlternate).toBe('ANTI_CYCLE');
      expect(summary.suggestedAlternative).toBe('ANTI_CYCLE');
    });

    it('3.1.2: accepts 99.9% Wave 2 retracement as valid borderline even with IEEE-754 float jitter', () => {
      expect(WAVE_NUMERIC_TOLERANCE).toBe(0.001);
      const len1 = 100.3 - 0.3;
      const retrace2 = 200.3 - 100.4 + 1e-12;
      const eval999 = evaluateWave2Retracement(len1, retrace2);
      expect(eval999.passed).toBe(true);
      expect(eval999.isBorderline999).toBe(true);

      const summary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 100.1, 340, 240, 420]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const r1 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1');
      expect(r1?.passed).toBe(true);
      expect(r1?.score).toBe(88);
    });

    it('3.1.3: rejects 100.1% Wave 2 retracement symmetrically in both Bullish and Bearish scenarios', () => {
      expect(evaluateWave2Retracement(100, 100.1).passed).toBe(false);

      const bullSummary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 99.9, 340, 240, 420]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(bullSummary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1')?.passed).toBe(false);

      const bearSummary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([200, 100, 200.1, 40, 95, 10]),
        'BEARISH',
        'ROOT',
        '',
        candles
      );
      expect(bearSummary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1')?.passed).toBe(false);
    });

    it('3.1.4: classifies Wave 4 > 100% Wave 3 as a Rule 3 violation rather than Rule 1', () => {
      const summary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 150, 260, 140, 320]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1')?.passed).toBe(true);
      expect(summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')?.passed).toBe(false);
    });

    it('3.1.5 & 3.1.6: rejects Zigzag Wave B >= 100% A while permitting Flat Irregular Wave B > 100% A', () => {
      expect(evaluateZigzagWaveB(100, 115).passed).toBe(false);
      expect(evaluateZigzagWaveB(100, 100).isBoundary100).toBe(true);
      expect(evaluateZigzagWaveB(100, 100).passed).toBe(false);
      expect(evaluateZigzagWaveB(100, 99.9).passed).toBe(true);

      const zzSummary = RulesEngine.validateStructure(
        'ZIGZAG',
        buildVertices([100, 200, 88, 255], ['0', 'A', 'B', 'C']),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const zzRule = zzSummary.rules.find(r => r.ruleId === 'ZIGZAG_B_RETRACE');
      expect(zzRule?.passed).toBe(false);
      expect(zzRule?.canBeSolvedByAlternate).toBe('FLAT_EXPANDED');

      expect(evaluateFlatWaveB(100, 115).passed).toBe(true);
    });

    it('3.1.7 & 3.1.8: validates Anti-Cycle (3-5) when W2 > 100% W1 in corrective/macro slot and flags shallow Flat B', () => {
      const acSummary = RulesEngine.validateStructure(
        'ANTI_CYCLE',
        buildVertices([100, 200, 88, 290], ['0', '1', '2', '3']),
        'BULLISH',
        'CORRECTIVE',
        'B',
        candles
      );
      expect(acSummary.rules.find(r => r.ruleId === 'ANTI_CYCLE_COVERAGE')?.passed).toBe(true);

      const flatReport = SmartRuleAlertEngine.evaluateScenario(
        buildScenario('FLAT_REGULAR', [100, 200, 152, 240], 'BULLISH', ['0', 'A', 'B', 'C']),
        candles
      );
      expect(flatReport.deviations.find(d => d.id === 'bahari-flat')?.status).toBe('VIOLATED');
    });
  });

  describe('Category 3.2 — Cardinal Rule 2: Wave 3 Cannot Be the Shortest Wave', () => {
    it('3.2.1: accepts Wave 3 = Wave 1 = Wave 5 including <0.1% IEEE-754 float drift', () => {
      const exactEq = evaluateWave3NotShortest(100, 100, 100);
      expect(exactEq.passed).toBe(true);
      expect(exactEq.isEqualBoundary).toBe(true);

      const floatDriftEq = evaluateWave3NotShortest(100, 99.95, 100);
      expect(floatDriftEq.passed).toBe(true);
      expect(floatDriftEq.isWave3Shortest).toBe(false);
    });

    it('3.2.2: recognizes Wave 3 = Wave 5 < Wave 1 as a borderline equality case', () => {
      const borderEval = evaluateWave3NotShortest(120, 80, 80);
      expect(borderEval.passed).toBe(true);
      expect(borderEval.isEqualBoundary).toBe(true);
    });

    it('3.2.3: fails Rule 2 when Wave 3 = 99% of Wave 1 (1% shortfall exceeds 0.1% tolerance)', () => {
      const w3Fail = evaluateWave3NotShortest(100, 99, 105);
      expect(w3Fail.passed).toBe(false);
      expect(w3Fail.isWave3Shortest).toBe(true);
      expect(w3Fail.shortfallPct).toBeGreaterThanOrEqual(0.99);

      const summary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 160, 259, 220, 330]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const r2 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_2');
      expect(r2?.passed).toBe(false);
      expect(summary.mislabelingStatus).toBe('MISLABELING');
    });

    it('3.2.4: passes Anti-Terminal with W5 < W3 < W1 since Wave 5 (not Wave 3) is shortest', () => {
      expect(evaluateWave3NotShortest(140, 100, 60).passed).toBe(true);

      const summary = RulesEngine.validateStructure(
        'ANTI_TERMINAL',
        buildVertices([100, 240, 180, 280, 220, 280]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(true);
    });

    it('3.2.5 & 3.2.6: fails Rule 2 when Wave 3 is shortest even in ANTI_TERMINAL and ENDING_DIAGONAL', () => {
      for (const pattern of ['ANTI_TERMINAL', 'ENDING_DIAGONAL'] as PatternFamily[]) {
        const summary = RulesEngine.validateStructure(
          pattern,
          buildVertices([100, 220, 150, 220, 180, 310]),
          'BULLISH',
          'ROOT',
          '',
          candles
        );
        expect(summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(false);
      }
    });
  });

  describe('Category 3.3 — Cardinal Rule 3: Wave 4 Price Overlap with Wave 1', () => {
    it('3.3.1: passes exact Wave 4 touch of Wave 1 peak and <0.1% float drift in IDEAL_CYCLE', () => {
      const exactTouch = evaluateWave4Overlap(200, 200, 100, true);
      expect(exactTouch.passedIdealCycle).toBe(true);
      expect(exactTouch.hasExactTouch).toBe(true);
      expect(exactTouch.hasOverlap).toBe(false);

      const tinyDrift = evaluateWave4Overlap(200, 199.95, 100, true);
      expect(tinyDrift.passedIdealCycle).toBe(true);
      expect(tinyDrift.hasOverlap).toBe(false);

      const summary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 140, 320, 200, 380]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const r3 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3');
      expect(r3?.passed).toBe(true);
      expect(r3?.score).toBe(88);
    });

    it('3.3.2: fails IDEAL_CYCLE Rule 3 when Wave 4 penetrates >= 0.1% into Wave 1 territory', () => {
      const overlap = evaluateWave4Overlap(200, 199.8, 100, true);
      expect(overlap.hasOverlap).toBe(true);
      expect(overlap.passedIdealCycle).toBe(false);

      const summary = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 140, 320, 184, 360]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const r3 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3');
      expect(r3?.passed).toBe(false);
      expect(['TERMINAL', 'ANTI_TERMINAL']).toContain(r3?.canBeSolvedByAlternate);
    });

    it('3.3.3–3.3.5: allows Wave 4 overlap in TERMINAL, ANTI_TERMINAL, and LEADING_DIAGONAL', () => {
      for (const pattern of ['TERMINAL', 'ANTI_TERMINAL', 'LEADING_DIAGONAL'] as PatternFamily[]) {
        const summary = RulesEngine.validateStructure(
          pattern,
          buildVertices([100, 200, 140, 320, 180, 360]),
          'BULLISH',
          'ROOT',
          '',
          candles
        );
        expect(summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')).toBeUndefined();
        expect(summary.rules.find(r => r.ruleId === 'OVERLAP_FEATURE')?.passed).toBe(true);
      }
    });
  });

  describe('Manual Vertex Manipulation Guard & Alert Engine Integration', () => {
    it('prevents manual Rule 1, Rule 2, Rule 3, and chronological violations in ChartStudio', () => {
      const verts = buildVertices([100, 200, 150, 320, 230, 350]);

      // Rule 1 drag guard (W2 below W0)
      const guardR1 = guardManualVertexEdit('IDEAL_CYCLE', verts, 2, 12, 85, 'BULLISH', candles);
      expect(guardR1.price).toBeGreaterThan(100);
      expect(guardR1.clampedByRules).toContain('CARDINAL_RULE_1');

      // Rule 2 drag guard (W3 shortened below min(W1, W5))
      const guardR2 = guardManualVertexEdit('IDEAL_CYCLE', verts, 3, 18, 210, 'BULLISH', candles);
      expect(guardR2.price).toBeGreaterThanOrEqual(250);
      expect(guardR2.clampedByRules).toContain('CARDINAL_RULE_2');

      // Rule 3 drag guard (W4 into W1 in IDEAL_CYCLE)
      const guardR3 = guardManualVertexEdit('IDEAL_CYCLE', verts, 4, 24, 175, 'BULLISH', candles);
      expect(guardR3.price).toBe(200);
      expect(guardR3.clampedByRules).toContain('CARDINAL_RULE_3');

      // Chronology guard
      const guardTime = guardManualVertexEdit('IDEAL_CYCLE', verts, 2, 4, 150, 'BULLISH', candles);
      expect(guardTime.candleIndex).toBe(7);
      expect(guardTime.clampedByRules).toContain('CHRONOLOGY_PREV');
    });

    it('detects extended waves (> 161.8%) and emits CRITICAL alert on breached cardinal structure', () => {
      const extVerts = buildVertices([100, 180, 140, 360, 310, 385]); // W1=80, W3=220 (>1.618*80), W5=75
      expect(RulesEngine.detectWaveExtension(extVerts, 'BULLISH')).toBe('WAVE_3');

      const invalidScenario = buildScenario('IDEAL_CYCLE', [100, 200, 95, 320, 180, 390], 'BULLISH');
      const alert = SmartRuleAlertEngine.evaluateScenario(invalidScenario, candles);
      expect(alert.isStructurallyInvalid).toBe(true);
      expect(alert.alertSeverity).toBe('CRITICAL');
      expect(alert.deviations.find(d => d.id === 'bahari-r1')?.status).toBe('VIOLATED');
      expect(alert.deviations.find(d => d.id === 'bahari-r3')?.status).toBe('VIOLATED');
    });
  });

  describe('Category 9, 10, 11, 12, 13 & 14 — Complex Rules, Diagonals, Fibonacci Tool, Entry & Trailing', () => {
    it('12.12–12.16: enforces Cardinal Rules 1/2/3 inside COMPLEX_COMBINATION', () => {
      const rule1Fail = RulesEngine.validateStructure(
        'COMPLEX_COMBINATION',
        buildVertices([100, 200, 90, 320, 220, 410], ['0', 'W', 'X', 'Y', 'XX', 'Z']),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(rule1Fail.rules.find(r => r.ruleId === 'CARDINAL_RULE_1')?.passed).toBe(false);

      const rule2Fail = RulesEngine.validateStructure(
        'COMPLEX_COMBINATION',
        buildVertices([100, 240, 160, 220, 180, 340], ['0', 'W', 'X', 'Y', 'XX', 'Z']),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(rule2Fail.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(false);

      const rule3Fail = RulesEngine.validateStructure(
        'COMPLEX_COMBINATION',
        buildVertices([100, 200, 150, 320, 185, 400], ['0', 'W', 'X', 'Y', 'XX', 'Z']),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(rule3Fail.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')?.passed).toBe(false);
    });

    it('Table 9: detects 5-subwave anomaly on Wave 3 / Wave 5 of Diagonals and keeps OVERLAP_FEATURE', () => {
      // Build candles with clear multi-pivot zigzags inside Wave 3 and Wave 5 spans
      const zigzagCandles: Candle[] = Array.from({ length: 70 }, (_, i) => {
        const wave = Math.sin(i * 1.45) * 14 + i * 2.2 + 100;
        return {
          timestamp: Date.UTC(2025, 0, 1) + i * 86400_000,
          open: cleanFloat(wave - 1, 2),
          high: cleanFloat(wave + 3, 2),
          low: cleanFloat(wave - 3, 2),
          close: cleanFloat(wave, 2),
          volume: 1500
        };
      });

      const verts: WaveVertex[] = [
        { label: '0', candleIndex: 0, price: 100, timestamp: zigzagCandles[0].timestamp, isConfirmed: true },
        { label: '1', candleIndex: 10, price: 180, timestamp: zigzagCandles[10].timestamp, isConfirmed: true },
        { label: '2', candleIndex: 16, price: 140, timestamp: zigzagCandles[16].timestamp, isConfirmed: true },
        { label: '3', candleIndex: 40, price: 240, timestamp: zigzagCandles[40].timestamp, isConfirmed: true },
        { label: '4', candleIndex: 48, price: 170, timestamp: zigzagCandles[48].timestamp, isConfirmed: true },
        { label: '5', candleIndex: 68, price: 270, timestamp: zigzagCandles[68].timestamp, isConfirmed: true }
      ];

      const summary = RulesEngine.validateStructure(
        'ENDING_DIAGONAL',
        verts,
        'BULLISH',
        'ROOT',
        '',
        zigzagCandles
      );
      expect(summary.rules.find(r => r.ruleId === 'OVERLAP_FEATURE')?.passed).toBe(true);
      const diagSubRule = summary.rules.find(r => r.ruleId === 'DIAGONAL_SUBWAVES');
      expect(diagSubRule).toBeDefined();
      expect(diagSubRule?.type).toBe('STRUCTURE');
      expect(diagSubRule?.passed).toBe(false);

      const diagScenario: WaveScenario = {
        ...buildScenario('ENDING_DIAGONAL', [100, 180, 140, 240, 170, 270], 'BULLISH'),
        vertices: verts
      };
      const diagRep = PatternEngines.analyzeDiagonal(diagScenario, zigzagCandles);
      expect(diagRep.diagonalSubwaveErrors.length).toBeGreaterThan(0);
      expect(diagRep.hasRule3Overlap).toBe(true);
    });

    it('Table 10: TargetProjectionEngine.validateFibonacciToolUsage enforces orientation, pairs, 0%/100% ret, missing Z & forbids Wave 5 ret', () => {
      // Orientation error (bullish drawn downward)
      const badOrient = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 200 }, { price: 100 }],
        direction: 'BULLISH',
        targetWave: '2'
      });
      expect(badOrient.isValid).toBe(false);
      expect(badOrient.errors.length).toBeGreaterThan(0);

      // Wave 5 retracement strictly forbidden
      const w5Ret = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH',
        targetWave: '5'
      });
      expect(w5Ret.isValid).toBe(false);
      expect(w5Ret.isWave5RetracementInvalid).toBe(true);

      // 0% retracement warning
      const ret0 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }, { price: 200 }],
        direction: 'BULLISH',
        targetWave: '2'
      });
      expect(ret0.isValid).toBe(true);
      expect(ret0.warnings.length).toBeGreaterThan(0);

      // >= 100% retracement error
      const ret100 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }, { price: 95 }],
        direction: 'BULLISH',
        targetWave: '2'
      });
      expect(ret100.isValid).toBe(false);

      // Missing Z on PROJECTION
      const missingZ = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH',
        targetWave: '3',
        pairLabel: '1-2'
      });
      expect(missingZ.isValid).toBe(false);

      // Pair rule violations: 1-2 for Wave 5, 3-4 for Wave 3
      const badPairW5 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 100 }, { price: 200 }, { price: 150 }],
        direction: 'BULLISH',
        targetWave: '5',
        pairLabel: '1-2'
      });
      expect(badPairW5.isValid).toBe(false);

      const badPairW3 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 100 }, { price: 200 }, { price: 150 }],
        direction: 'BULLISH',
        targetWave: '3',
        pairLabel: '3-4'
      });
      expect(badPairW3.isValid).toBe(false);

      // Valid Wave 3 projection with 1-2 pair
      const validProj = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 100 }, { price: 200 }, { price: 138.2 }],
        direction: 'BULLISH',
        targetWave: '3',
        pairLabel: '1-2'
      });
      expect(validProj.isValid).toBe(true);
    });

    it('Tables 6–8: validates Zigzag C≈161.8%, Flat borderlines, and Triangle box timing / 3-leg warning', () => {
      const zzBorder = PatternEngines.analyzeZigzag(
        buildScenario('ZIGZAG', [100, 200, 150, 311.8], 'BULLISH', ['0', 'A', 'B', 'C']),
        candles
      );
      expect(zzBorder.isBorderlineC1618).toBe(true);

      const flatBorder = PatternEngines.analyzeFlat(
        buildScenario('FLAT_REGULAR', [100, 200, 100, 200], 'BULLISH', ['0', 'A', 'B', 'C']),
        candles
      );
      expect((flatBorder.borderlineNotesFa?.length ?? 0)).toBeGreaterThan(0);

      const triShort = PatternEngines.analyzeTriangle(
        buildScenario('TRIANGLE_CONVERGING', [100, 200, 140, 185], 'BULLISH', ['0', 'A', 'B', 'C']),
        candles
      );
      expect(triShort.warnings.some(w => w.includes('زیگزاگ'))).toBe(true);

      const triFull = PatternEngines.analyzeTriangle(
        buildScenario('TRIANGLE_CONVERGING', [100, 200, 140, 190, 155, 175], 'BULLISH', ['0', 'A', 'B', 'C', 'D', 'E']),
        candles,
        'CORRECTIVE',
        '4'
      );
      expect(['BEFORE_BOX_3', 'INSIDE_BOX_3', 'AFTER_BOX_3']).toContain(triFull.timingZone);
      expect(typeof triFull.timingSpanRatio).toBe('number');
    });

    it('Tables 11, 13 & 14: enforces FOMO block (<50% & 61.8%->78.6% crossing), 5-3-5@50%, strict <38.2% extension, and numeric TMV trailing stop', () => {
      // 40% retracement -> FOMO blocked
      const shallowCandles = [...candles];
      shallowCandles[shallowCandles.length - 1] = { ...shallowCandles[shallowCandles.length - 1], close: 160, open: 162, high: 163, low: 159 };
      const shallowEntry = PatternEngines.analyzeEntryStrategy(
        buildScenario('IDEAL_CYCLE', [100, 200, 160], 'BULLISH', ['0', '1', '2']),
        shallowCandles
      );
      expect(shallowEntry.meetsMin50).toBe(false);
      expect(shallowEntry.isFomoBlocked).toBe(true);

      // Crossing 61.8% toward 78.6% (around 70%) -> blocked & waits for 78.6%
      const crossCandles = [...candles];
      crossCandles[crossCandles.length - 1] = { ...crossCandles[crossCandles.length - 1], close: 130, open: 135, high: 136, low: 129 };
      const crossEntry = PatternEngines.analyzeEntryStrategy(
        buildScenario('IDEAL_CYCLE', [100, 200, 130], 'BULLISH', ['0', '1', '2']),
        crossCandles
      );
      expect(crossEntry.entryZone).toBe('78.6%');
      expect(crossEntry.isFomoBlocked).toBe(true);

      // 5-3-5 at 50% allowed
      const zig50Candles = [...candles];
      zig50Candles[zig50Candles.length - 1] = { ...zig50Candles[zig50Candles.length - 1], close: 150, open: 147, high: 151, low: 146 };
      const zig50Entry = PatternEngines.analyzeEntryStrategy(
        buildScenario('ZIGZAG', [100, 200, 150], 'BULLISH', ['0', 'A', 'B']),
        zig50Candles
      );
      expect(zig50Entry.entryZone).toBe('50%_PULLBACK');

      // Strict < 38.2% Wave 4 confirmation: 40% should NOT confirm WAVE_3 extension
      const unconfirmedW3 = PatternEngines.analyzeExtensionAndTrailing(
        buildScenario('IDEAL_CYCLE', [100, 180, 140, 300, 236, 340], 'BULLISH'),
        candles,
        180,
        280,
        380
      );
      expect(unconfirmedW3.extendedWave).toBeNull();
      expect(unconfirmedW3.extensionUnconfirmedReasonFa).toBeDefined();
      expect(unconfirmedW3.trailingStopPrice).not.toBeNull();
      expect(unconfirmedW3.trailingStopStatus).toBe('ACTIVE');

      // Insufficient pivots (<2) -> INACTIVE_WARNING
      const noStop = PatternEngines.analyzeExtensionAndTrailing(
        buildScenario('IDEAL_CYCLE', [100], 'BULLISH', ['0']),
        candles
      );
      expect(noStop.trailingStopStatus).toBe('INACTIVE_WARNING');
      expect(noStop.trailingStopPrice).toBeNull();
    });

    it('Sessions 6, 13, 14–15, 18 & 19: enforces CB-Wave 5>=W4, Ascending/Descending/Unlimited Triangles, Irregular Flat C bands, chart-bottom extension guard, and Wave 5/C coverage', () => {
      // Session 6.4 (CB_WAVE5_COVERS_W4): Wave 5 terminating below Wave 3 fails HARD rule in IDEAL_CYCLE
      const failedCb5 = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 160, 130, 260, 220, 248]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const cbRuleFail = failedCb5.rules.find(r => r.ruleId === 'CB_WAVE5_COVERS_W4');
      expect(cbRuleFail).toBeDefined();
      expect(cbRuleFail?.passed).toBe(false);
      expect(cbRuleFail?.type).toBe('HARD');

      const passedCb5 = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 160, 130, 260, 220, 275]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(passedCb5.rules.find(r => r.ruleId === 'CB_WAVE5_COVERS_W4')?.passed).toBe(true);

      // Session 13 (analyzeFlat): B > 138.2% classifies C<100 as IRREGULAR, C>=100 as IRREGULAR_EXTENDED, and B>100 & C<61.8 as RUNNING_DEPRECATED
      const flatIrregular = PatternEngines.analyzeFlat(
        buildScenario('FLAT_EXPANDED', [100, 200, 50, 190], 'BULLISH', ['0', 'A', 'B', 'C']),
        candles
      );
      expect(flatIrregular.subtype).toBe('IRREGULAR');

      const flatIrregularExt = PatternEngines.analyzeFlat(
        buildScenario('FLAT_EXPANDED', [100, 200, 50, 215], 'BULLISH', ['0', 'A', 'B', 'C']),
        candles
      );
      expect(flatIrregularExt.subtype).toBe('IRREGULAR_EXTENDED');

      const flatRunningDep = PatternEngines.analyzeFlat(
        buildScenario('FLAT_RUNNING', [100, 200, 80, 140], 'BULLISH', ['0', 'A', 'B', 'C']),
        candles
      );
      expect(flatRunningDep.subtype).toBe('RUNNING_DEPRECATED');

      // Sessions 14–15 (analyzeTriangle): Ascending, Descending & Wave-A Unlimited variants without false mixed-trendline flag
      const ascTri = PatternEngines.analyzeTriangle(
        buildScenario('TRIANGLE_CONVERGING', [100, 200, 140, 201, 168, 196], 'BULLISH', ['0', 'A', 'B', 'C', 'D', 'E']),
        candles,
        'CORRECTIVE',
        '4'
      );
      expect(ascTri.detected).toBe(true);
      expect(ascTri.triangleType).toBe('CONTRACTING');
      expect(ascTri.directionalVariant).toBe('ASCENDING');
      expect(ascTri.isMixedTrendlines).toBe(false);

      const descTri = PatternEngines.analyzeTriangle(
        buildScenario('TRIANGLE_CONVERGING', [200, 100, 160, 99, 132, 103], 'BEARISH', ['0', 'A', 'B', 'C', 'D', 'E']),
        candles,
        'CORRECTIVE',
        '4'
      );
      expect(descTri.detected).toBe(true);
      expect(descTri.triangleType).toBe('CONTRACTING');
      expect(descTri.directionalVariant).toBe('DESCENDING');
      expect(descTri.isMixedTrendlines).toBe(false);

      const rareWaveATri = PatternEngines.analyzeTriangle(
        buildScenario('TRIANGLE_CONVERGING', [100, 200, 140, 190, 155, 175], 'BULLISH', ['0', 'A', 'B', 'C', 'D', 'E']),
        candles,
        'CORRECTIVE',
        'A'
      );
      expect(rareWaveATri.scopeVariant).toBe('UNLIMITED');

      // Session 18: chart-bottom early vertices (<5, start at candleIndex 0) cannot confirm Wave 1 extension
      const chartBottomScen = buildScenario('IDEAL_CYCLE', [100, 180, 140], 'BULLISH', ['0', '1', '2']);
      chartBottomScen.vertices[0].candleIndex = 0;
      const chartBottomExt = PatternEngines.analyzeExtensionAndTrailing(chartBottomScen, candles);
      expect(chartBottomExt.extendedWave).toBeNull();
      expect(chartBottomExt.extensionUnconfirmedReasonFa).toBeDefined();

      // Session 19 (analyzeWaveCharacteristics): Wave 5 failing Wave 4 coverage & Wave C failing 100% Wave B coverage
      const charReport = PatternEngines.analyzeWaveCharacteristics(
        buildScenario(
          'IDEAL_CYCLE',
          [100, 160, 130, 260, 220, 248, 190, 235, 195],
          'BULLISH',
          ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C']
        ),
        candles
      );
      const w5Item = charReport.items.find(it => it.label === '5');
      const wCItem = charReport.items.find(it => it.label === 'C');
      expect(w5Item?.valid).toBe(false);
      expect(wCItem?.valid).toBe(false);
    });

    it('All-Pattern Evaluator: evaluates all 15 PatternFamily states simultaneously (Ideal, Terminal, Anti-Terminal, Diagonals, Anti-Diagonal, Anti-Cycle, Zigzag, Flats, Triangles, Complex)', () => {
      // 1) Clean Ideal Cycle ranks IDEAL_CYCLE as best fit
      const idealEval = RulesEngine.evaluateAllPatterns(
        buildVertices([100, 160, 130, 250, 205, 290]),
        'BULLISH',
        'ROOT',
        '',
        candles,
        'IDEAL_CYCLE'
      );
      expect(idealEval.length).toBe(15);
      expect(idealEval.find(e => e.isBestFit)?.patternType).toBe('IDEAL_CYCLE');
      expect(idealEval.find(e => e.patternType === 'IDEAL_CYCLE')?.status).toBe('VALID');

      // 2) Overlapping short-W5 wedge fails IDEAL_CYCLE while passing TERMINAL and ENDING_DIAGONAL
      const termEval = RulesEngine.evaluateAllPatterns(
        buildVertices([100, 220, 150, 255, 195, 270]),
        'BULLISH',
        'ROOT',
        '',
        candles,
        'IDEAL_CYCLE'
      );
      expect(termEval.find(e => e.patternType === 'IDEAL_CYCLE')?.status).toBe('INVALID');
      expect(termEval.find(e => e.patternType === 'TERMINAL')?.status).not.toBe('INVALID');
      expect(
        termEval
          .find(e => e.patternType === 'ENDING_DIAGONAL')
          ?.rules.find(r => r.ruleId === 'DIAGONAL_VARIANT_PROFILE')?.passed
      ).toBe(true);

      // 3) Broadening overlapping funnel passes ANTI_TERMINAL and ANTI_DIAGONAL while failing TERMINAL truncation
      const antiEval = RulesEngine.evaluateAllPatterns(
        buildVertices([100, 160, 130, 220, 145, 320]),
        'BULLISH',
        'ROOT',
        '',
        candles,
        'ANTI_TERMINAL'
      );
      expect(
        antiEval
          .find(e => e.patternType === 'ANTI_TERMINAL')
          ?.rules.find(r => r.ruleId === 'ANTI_TERMINAL_W5_EXT')?.passed
      ).toBe(true);
      expect(
        antiEval
          .find(e => e.patternType === 'ANTI_DIAGONAL')
          ?.rules.find(r => r.ruleId === 'DIAGONAL_VARIANT_PROFILE')?.passed
      ).toBe(true);
      expect(
        antiEval
          .find(e => e.patternType === 'TERMINAL')
          ?.rules.find(r => r.ruleId === 'TERMINAL_W5_TRUNCATION')?.passed
      ).toBe(false);
    });
  });

  describe('Category 3 Comprehensive Cross-Pattern Matrix & 0.1% Tolerance Verification', () => {
    const ALL_IMPULSE_AND_DIAG: PatternFamily[] = [
      'IDEAL_CYCLE',
      'TERMINAL',
      'ANTI_TERMINAL',
      'LEADING_DIAGONAL',
      'ANTI_LEADING_DIAGONAL',
      'ENDING_DIAGONAL',
      'ANTI_DIAGONAL'
    ];

    it('Rule 1 + 0.1% Tolerance across Ideal, Diagonals & Terminals (Bullish & Bearish): passes 99.9%, fails 100.0% & 100.1%', () => {
      for (const pattern of ALL_IMPULSE_AND_DIAG) {
        // 99.9% retracement (Bullish: 100->200->100.1) passes CARDINAL_RULE_1 cleanly
        const bull999 = RulesEngine.validateStructure(
          pattern,
          buildVertices([100, 200, 100.1, 290, 210, 340]),
          'BULLISH',
          'ROOT',
          '',
          candles
        );
        expect(bull999.rules.find(r => r.ruleId === 'CARDINAL_RULE_1')?.passed).toBe(true);

        // Exact 100.0% retracement (100->200->100) violates CARDINAL_RULE_1 & suggests ANTI_CYCLE
        const bull100 = RulesEngine.validateStructure(
          pattern,
          buildVertices([100, 200, 100, 290, 210, 340]),
          'BULLISH',
          'ROOT',
          '',
          candles
        );
        const r1Bull100 = bull100.rules.find(r => r.ruleId === 'CARDINAL_RULE_1');
        expect(r1Bull100?.passed).toBe(false);
        expect(r1Bull100?.canBeSolvedByAlternate).toBe('ANTI_CYCLE');
        expect(bull100.isValid).toBe(false);

        // 100.1% retracement in Bearish symmetry (200->100->200.1) violates CARDINAL_RULE_1
        const bear1001 = RulesEngine.validateStructure(
          pattern,
          buildVertices([200, 100, 200.1, 30, 90, 5]),
          'BEARISH',
          'ROOT',
          '',
          candles
        );
        expect(bear1001.rules.find(r => r.ruleId === 'CARDINAL_RULE_1')?.passed).toBe(false);
        expect(bear1001.isValid).toBe(false);
      }
    });

    it('Rule 2 + 0.1% Tolerance across Ideal, Diagonals & Terminals: passes within 0.1% float cushion (99.95%), fails when shortest >0.1%', () => {
      for (const pattern of ALL_IMPULSE_AND_DIAG) {
        // W1=100, W3=99.95 (within 0.1% tolerance of W1 & W5=100) -> PASSES Rule 2
        const floatCushion = RulesEngine.validateStructure(
          pattern,
          buildVertices([100, 200, 150, 249.95, 205, 305]),
          'BULLISH',
          'ROOT',
          '',
          candles
        );
        expect(floatCushion.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(true);

        // W1=100, W3=60, W5=90 (Bullish) -> Wave 3 is shortest -> FAILS Rule 2 & isValid=false
        const shortestBull = RulesEngine.validateStructure(
          pattern,
          buildVertices([100, 200, 150, 210, 180, 270]),
          'BULLISH',
          'ROOT',
          '',
          candles
        );
        expect(shortestBull.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(false);
        expect(shortestBull.isValid).toBe(false);

        // Bearish symmetry: W1=100, W3=70, W5=95 -> FAILS Rule 2
        const shortestBear = RulesEngine.validateStructure(
          pattern,
          buildVertices([300, 200, 250, 180, 210, 115]),
          'BEARISH',
          'ROOT',
          '',
          candles
        );
        expect(shortestBear.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(false);
        expect(shortestBear.isValid).toBe(false);
      }
    });

    it('Rule 3 + 0.1% Tolerance across Ideal, Diagonals & Terminals: IDEAL_CYCLE enforces <0.1% overlap while Diagonals & Terminals accept overlap', () => {
      // 1) IDEAL_CYCLE accepts 0.05% tiny IEEE-754 drift below Wave 1 peak (Bullish: W1=100, p1=200, p4=199.95 -> 0.05% < 0.1%)
      const idealDrift = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 140, 320, 199.95, 380]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(idealDrift.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')?.passed).toBe(true);
      expect(idealDrift.isValid).toBe(true);

      // 2) IDEAL_CYCLE rejects >=0.1% penetration in both Bullish (p4=199.85 -> 0.15%) and Bearish (p4=100.15 -> 0.15%)
      const idealBullPen = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 140, 320, 199.85, 380]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(idealBullPen.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')?.passed).toBe(false);
      expect(idealBullPen.isValid).toBe(false);

      const idealBearPen = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([200, 100, 150, 20, 100.15, -20]),
        'BEARISH',
        'ROOT',
        '',
        candles
      );
      expect(idealBearPen.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')?.passed).toBe(false);
      expect(idealBearPen.isValid).toBe(false);

      // 3) Diagonals & Terminals permit deep Wave 4-1 overlap (p4=175 < p1=200 in Bullish; p4=125 > p1=100 in Bearish)
      const overlapPermittedPatterns: PatternFamily[] = [
        'TERMINAL',
        'ANTI_TERMINAL',
        'LEADING_DIAGONAL',
        'ANTI_LEADING_DIAGONAL',
        'ENDING_DIAGONAL',
        'ANTI_DIAGONAL'
      ];
      for (const pattern of overlapPermittedPatterns) {
        const bullOverlap = RulesEngine.validateStructure(
          pattern,
          buildVertices([100, 200, 140, 300, 175, 350]),
          'BULLISH',
          'ROOT',
          '',
          candles
        );
        expect(bullOverlap.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')).toBeUndefined();
        expect(bullOverlap.rules.find(r => r.ruleId === 'OVERLAP_FEATURE')?.passed).toBe(true);
        expect(bullOverlap.isValid).toBe(true);

        const bearOverlap = RulesEngine.validateStructure(
          pattern,
          buildVertices([200, 100, 150, 20, 125, -25]),
          'BEARISH',
          'ROOT',
          '',
          candles
        );
        expect(bearOverlap.rules.find(r => r.ruleId === 'OVERLAP_FEATURE')?.passed).toBe(true);
        expect(bearOverlap.isValid).toBe(true);
      }
    });
  });

  describe('Bahari Heuristics, Conditional Consequences, Shadow Exception & Corrective Boundaries', () => {
    it('flags Wave 2 < 23.6% -> probable Wave 1 extension, Wave 4 > 50% -> complex correction, Wave 5 < Wave 3 -> truncation/terminal', () => {
      // W2 = 23.5% of W1 (100->200->176.5), W4 = 55% of W3 without W1 overlap (W3: 176.5->276.5=100, W4: 276.5->221.5=55% > 200), W5 = 60 < W3=100
      const verts = buildVertices([100, 200, 176.5, 276.5, 221.5, 281.5]);
      const val = RulesEngine.validateStructure('IDEAL_CYCLE', verts, 'BULLISH', 'ROOT', '', candles);

      expect(val.wave1ExtensionProbable).toBe(true);
      expect(val.wave4ComplexCorrectionProbable).toBe(true);
      expect(val.wave5TruncationOrTerminalHint).toBe(true);

      const fib2 = val.rules.find(r => r.ruleId === 'FIB_WAVE_2');
      const fib4 = val.rules.find(r => r.ruleId === 'FIB_WAVE_4');
      const w5Hint = val.rules.find(r => r.ruleId === 'WAVE_5_TRUNCATION_OR_TERMINAL');
      expect(fib2?.messageFa).toContain('کشیدگی موج ۱');
      expect(fib4?.messageFa).toContain('فلت / مثلث');
      expect(w5Hint?.passed).toBe(true);

      const alerts = SmartRuleAlertEngine.evaluateScenario(
        buildScenario('IDEAL_CYCLE', [100, 200, 176.5, 276.5, 221.5, 281.5]),
        candles
      );
      expect(alerts.deviations.some(d => d.id === 'bahari-w4-complex')).toBe(true);
      expect(alerts.deviations.some(d => d.id === 'bahari-w5-trunc-term')).toBe(true);
    });

    it('Rule 3 conditional consequence: suggests Terminal/Anti-Terminal ONLY when overall structure is ideal; flags wrong count otherwise', () => {
      // 1) Overall ideal structure + W4 overlaps W1 (p4=185 < p1=200) -> suggests TERMINAL (since len5 < len3)
      const idealWithOverlap = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 140, 320, 185, 340]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(idealWithOverlap.suggestedAlternative).toBe('TERMINAL');
      expect(idealWithOverlap.mislabelingStatus).toBe('VALID_ALTERNATIVE');

      // 2) Broken overall structure (W5 fails 100% coverage of W4 AND W4 overlaps W1) -> MISLABELING, no Terminal suggestion
      const brokenWithOverlap = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 140, 320, 185, 300]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(brokenWithOverlap.isValid).toBe(false);
      expect(brokenWithOverlap.suggestedAlternative).toBeUndefined();
      expect(brokenWithOverlap.mislabelingStatus).toBe('MISLABELING');
    });

    it('Rule 2 violation explicitly notes Wave 3 may be Wave 1; Triangle enforces corrective slot placement', () => {
      const r2Fail = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 200, 150, 210, 180, 270]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      const r2Rule = r2Fail.rules.find(r => r.ruleId === 'CARDINAL_RULE_2');
      expect(r2Rule?.passed).toBe(false);
      expect(r2Rule?.messageFa).toContain('موج ۳ در واقع موج ۱');
      expect(r2Fail.mislabelingStatus).toBe('MISLABELING');

      // Triangle rejected inside Motive Wave 3, permitted inside Corrective Wave 4
      const triVerts = buildVertices([100, 200, 130, 185, 145, 170], ['0', 'A', 'B', 'C', 'D', 'E']);
      const triInW3 = RulesEngine.validateStructure('TRIANGLE_CONVERGING', triVerts, 'BULLISH', 'MOTIVE', 'موج 3', candles);
      expect(triInW3.rules.find(r => r.ruleId === 'TRIANGLE_POSITION')?.passed).toBe(false);
      expect(triInW3.isValid).toBe(false);

      const triInW4 = RulesEngine.validateStructure('TRIANGLE_CONVERGING', triVerts, 'BULLISH', 'CORRECTIVE', 'موج 4', candles);
      expect(triInW4.rules.find(r => r.ruleId === 'TRIANGLE_POSITION')?.passed).toBe(true);
    });

    it('Shadow Exception requires visible trend strength BOTH before and after shadow; Degree Consistency rejects 1 vs 100 candle disparity', () => {
      // Build custom 120 candles with strong trend before & after a single-candle extreme-wick leg at idx 30..31
      const tsBase = Date.UTC(2024, 0, 1);
      const trendBars: Candle[] = Array.from({ length: 120 }, (_, i) => {
        const flat = i >= 25 && i <= 29;
        const base = 100 + i * 2;
        if (i === 30) {
          return { time: `d${i}`, timestamp: tsBase + i * 86400_000, open: 160, high: 210, low: 158, close: 164, volume: 1200 };
        }
        return {
          time: `d${i}`,
          timestamp: tsBase + i * 86400_000,
          open: flat ? 150 : base - 4,
          high: flat ? 150.2 : base + 4,
          low: flat ? 149.8 : base - 4.5,
          close: flat ? 150.1 : base + 3.8,
          volume: 1200
        };
      });

      const shadowVerts: WaveVertex[] = [
        { label: '0', price: 110, candleIndex: 5, timestamp: trendBars[5].timestamp, isConfirmed: true },
        { label: '1', price: 145, candleIndex: 20, timestamp: trendBars[20].timestamp, isConfirmed: true },
        { label: '2', price: 130, candleIndex: 25, timestamp: trendBars[25].timestamp, isConfirmed: true },
        { label: '3', price: 210, candleIndex: 30, timestamp: trendBars[30].timestamp, isConfirmed: true },
        { label: '4', price: 195, candleIndex: 42, timestamp: trendBars[42].timestamp, isConfirmed: true },
        { label: '5', price: 290, candleIndex: 55, timestamp: trendBars[55].timestamp, isConfirmed: true }
      ];
      // Make leg 2->3 only 1 candle wide (span=1 from idx 29 to 30) so MIN_3_CANDLES checks shadow exception!
      shadowVerts[2].candleIndex = 29;
      shadowVerts[2].price = 150;
      const withBeforeFlat = RulesEngine.validateStructure('IDEAL_CYCLE', shadowVerts, 'BULLISH', 'ROOT', '', trendBars);
      // Before segment 25..28 was flat/weak -> Shadow exception rejected -> MIN_3_CANDLES is SOFT fail
      const min3Weak = withBeforeFlat.rules.find(r => r.ruleId === 'MIN_3_CANDLES');
      expect(min3Weak?.type).toBe('SOFT');
      expect(min3Weak?.passed).toBe(false);

      // Now make before bars strongly directional (restore indices 25..29 to strong trend)
      const strongBothSides = trendBars.map((c, i) =>
        i >= 25 && i <= 29
          ? { ...c, open: 140 + (i - 25) * 4, close: 146 + (i - 25) * 4, high: 147 + (i - 25) * 4, low: 139 + (i - 25) * 4 }
          : c
      );
      const withStrongBoth = RulesEngine.validateStructure('IDEAL_CYCLE', shadowVerts, 'BULLISH', 'ROOT', '', strongBothSides);
      expect(withStrongBoth.rules.find(r => r.ruleId === 'MIN_3_CANDLES')?.passed).toBe(true);

      // Anti-Cycle + Rule 3 simultaneous overlap remains valid
      const antiWithR3 = RulesEngine.validateStructure(
        'ANTI_CYCLE',
        buildVertices([100, 160, 95, 220, 140, 260]),
        'BULLISH',
        'CORRECTIVE',
        'موج B',
        candles
      );
      expect(antiWithR3.isValid).toBe(true);
      expect(antiWithR3.rules.find(r => r.ruleId === 'ANTI_CYCLE_R3_PERMITTED')?.passed).toBe(true);

      // Degree consistency: Wave 2 = 1 candle vs Wave 4 = 100 candles -> FAILS DEGREE_CONSISTENCY
      const disparityVerts: WaveVertex[] = [
        { label: '0', price: 100, candleIndex: 0, timestamp: trendBars[0].timestamp, isConfirmed: true },
        { label: '1', price: 150, candleIndex: 6, timestamp: trendBars[6].timestamp, isConfirmed: true },
        { label: '2', price: 125, candleIndex: 7, timestamp: trendBars[7].timestamp, isConfirmed: true },
        { label: '3', price: 240, candleIndex: 16, timestamp: trendBars[16].timestamp, isConfirmed: true },
        { label: '4', price: 190, candleIndex: 116, timestamp: trendBars[116].timestamp, isConfirmed: true },
        { label: '5', price: 290, candleIndex: 119, timestamp: trendBars[119].timestamp, isConfirmed: true }
      ];
      const dispVal = RulesEngine.validateStructure('IDEAL_CYCLE', disparityVerts, 'BULLISH', 'ROOT', '', strongBothSides);
      expect(dispVal.rules.find(r => r.ruleId === 'DEGREE_CONSISTENCY')?.passed).toBe(false);
    });

    it('validates Complex Combinations (Z-X-T, I-X-T, D-X-Z), Diagonal Location & 8-Wave Valid Low boundaries', () => {
      const complexScen = buildScenario('COMPLEX_COMBINATION', [100, 160, 130, 190, 150, 210, 175], 'BULLISH', ['0', 'W', 'X', 'Y', 'X2', 'Z', 'E']);
      const compRep = PatternEngines.analyzeComplexPattern(complexScen, candles);
      expect(compRep.detected).toBe(true);
      expect(compRep.standard).toBe(true);

      const endingInW1 = RulesEngine.validateStructure(
        'ENDING_DIAGONAL',
        buildVertices([100, 200, 140, 260, 180, 290]),
        'BULLISH',
        'MOTIVE',
        'موج 1',
        candles
      );
      expect(endingInW1.rules.find(r => r.ruleId === 'DIAGONAL_LOCATION')?.passed).toBe(false);
      expect(endingInW1.rules.find(r => r.ruleId === 'DIAGONAL_LOCATION')?.canBeSolvedByAlternate).toBe('LEADING_DIAGONAL');

      // 8-wave cycle (9 vertices 0..5..C) where Valid Low is formed at Wave C
      const eightWaveVerts = buildVertices(
        [100, 160, 130, 240, 190, 280, 220, 250, 185],
        ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C']
      );
      const bottomCheck = RulesEngine.evaluateAbsoluteBottomAndValidLows(candles, eightWaveVerts, 'BULLISH');
      expect(bottomCheck.validLowIdx).toBe(eightWaveVerts[8].candleIndex);
    });

    it('enforces Wave 1 extension consequences, double-extension warning, and T-4.31 / T-4.32 Wave 3 extension rules (2.6 & 2.12)', () => {
      // 1) Wave 1 extension (len1 = 200, len3 = 90, len5 = 70) -> notes Wave 3 shorter, Wave 4 may overlap Wave 1, Wave 5 shorter
      const w1Ext = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 300, 210, 300, 270, 340]), 'BULLISH', 'ROOT', '', candles);
      const extRule1 = w1Ext.rules.find(r => r.ruleId === 'WAVE_EXTENSION_CHECK');
      expect(extRule1?.passed).toBe(true);
      expect(extRule1?.messageFa).toContain('کشیدگی موج ۱');
      expect(extRule1?.messageFa).toContain('موج ۳ کوتاه‌تر');

      // 2) Simultaneous double extension (len1=40, len3=140, len5=140) -> warns max 1 extended wave
      const doubleExt = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 140, 120, 260, 210, 350]), 'BULLISH', 'ROOT', '', candles);
      const extDouble = doubleExt.rules.find(r => r.ruleId === 'WAVE_EXTENSION_CHECK');
      expect(extDouble?.passed).toBe(false);
      expect(extDouble?.messageFa).toContain('کشیدگی هم‌زمان دو موج');

      // 3) T-4.32: Extended Wave 3 (200% of W1) + Wave 4 = 50% of W3 -> VALID and above Wave 1 peak
      const t432 = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 200, 150, 350, 250, 370]), 'BULLISH', 'ROOT', '', candles);
      expect(t432.isValid).toBe(true);
      expect(t432.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(true);
      expect(t432.rules.find(r => r.ruleId === 'CARDINAL_RULE_3')?.passed).toBe(true);
      expect(t432.rules.find(r => r.ruleId === 'WAVE_EXTENSION_CHECK')?.messageFa).toContain('موج ۴ بالاتر از حریم ۱');

      // 4) T-4.31: Rule 3 violation proposes upgrading Wave 3 to Extended Wave 3 (with updatedVertices when candles have higher peak)
      const extCandles: Candle[] = Array.from({ length: 100 }, (_, i) => {
        let p = 100 + i * 2;
        if (i >= 28 && i <= 38) p = 320 + (i - 28) * 6; // tall peak at i=38 (~380)
        if (i >= 44 && i <= 52) p = 270; // W4 higher than v1=200!
        return { time: `t${i}`, timestamp: 1700000000000 + i * 86400000, open: p - 2, high: p + 4, low: p - 4, close: p, volume: 1000 };
      });
      const shortW3Verts: WaveVertex[] = [
        { label: '0', price: 100, candleIndex: 5, timestamp: extCandles[5].timestamp, isConfirmed: true },
        { label: '1', price: 200, candleIndex: 14, timestamp: extCandles[14].timestamp, isConfirmed: true },
        { label: '2', price: 150, candleIndex: 20, timestamp: extCandles[20].timestamp, isConfirmed: true },
        { label: '3', price: 260, candleIndex: 26, timestamp: extCandles[26].timestamp, isConfirmed: true },
        { label: '4', price: 185, candleIndex: 48, timestamp: extCandles[48].timestamp, isConfirmed: true }, // overlaps v1=200!
        { label: '5', price: 420, candleIndex: 65, timestamp: extCandles[65].timestamp, isConfirmed: true }
      ];
      const fixes = RulesEngine.generateFixSuggestions('IDEAL_CYCLE', shortW3Verts, 'BULLISH', extCandles);
      const extendW3Fix = fixes.find(f => f.id === 'fix_r3_extend_w3');
      expect(extendW3Fix).toBeDefined();
      expect(extendW3Fix?.updatedVertices).toBeDefined();
      if (extendW3Fix?.updatedVertices) {
        const reval = RulesEngine.validateStructure('IDEAL_CYCLE', extendW3Fix.updatedVertices, 'BULLISH', 'ROOT', '', extCandles);
        expect(reval.isValid).toBe(true);
      }
    });

    it('distinguishes Ideal Coverage & W4 Complexity features from Hard Rules, preserves W/V during Relabeling, and validates Wave Behavior & <10 bar Bottom (2.9–2.11)', () => {
      // 1) Section 2.9: Deficient Flat (Wave C does NOT cover 100% of Wave B) -> Non-ideal (SOFT fail) yet structurally VALID
      const deficientFlat = RulesEngine.validateStructure(
        'FLAT_REGULAR',
        buildVertices([100, 200, 110, 190], ['0', 'A', 'B', 'C']),
        'BULLISH',
        'CORRECTIVE',
        'موج 4',
        candles
      );
      expect(deficientFlat.isValid).toBe(true);
      const covRule = deficientFlat.rules.find(r => r.ruleId === 'IDEAL_CORRECTIVE_COVERAGE');
      expect(covRule?.type).toBe('SOFT');
      expect(covRule?.passed).toBe(false);
      expect(covRule?.messageFa).toContain('فلت ناقص C');

      // 2) Section 2.10: W2=10 candles vs W4=30 candles -> accepted in DEGREE_CONSISTENCY and passes WAVE_4_COMPLEXITY_ALT
      const candles90 = buildCandles(90, 100);
      const w4LongerVerts = [
        { label: '0', price: 100, candleIndex: 0, timestamp: candles90[0].timestamp, isConfirmed: true },
        { label: '1', price: 180, candleIndex: 10, timestamp: candles90[10].timestamp, isConfirmed: true },
        { label: '2', price: 135, candleIndex: 20, timestamp: candles90[20].timestamp, isConfirmed: true },
        { label: '3', price: 290, candleIndex: 35, timestamp: candles90[35].timestamp, isConfirmed: true },
        { label: '4', price: 240, candleIndex: 65, timestamp: candles90[65].timestamp, isConfirmed: true },
        { label: '5', price: 360, candleIndex: 80, timestamp: candles90[80].timestamp, isConfirmed: true }
      ];
      const compVal = RulesEngine.validateStructure('IDEAL_CYCLE', w4LongerVerts, 'BULLISH', 'ROOT', '', candles90);
      expect(compVal.rules.find(r => r.ruleId === 'WAVE_4_COMPLEXITY_ALT')?.passed).toBe(true);
      expect(compVal.rules.find(r => r.ruleId === 'DEGREE_CONSISTENCY')?.passed).toBe(true);

      // 3) Section 2.11: Relabeling after Rule 1 violation preserves parent W/V degrees and proposes A/B relabel
      const r1Violation = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 180, 95, 250, 210, 310]), 'BULLISH', 'MOTIVE', 'W3', candles);
      expect(r1Violation.relabelingScopeFa).toContain('درجات بالاتر (W و V) بدون تغییر');
      const r1Fixes = RulesEngine.generateFixSuggestions('IDEAL_CYCLE', buildVertices([100, 180, 95, 250, 210, 310]), 'BULLISH', candles, 'MOTIVE', 'W3');
      expect(r1Fixes.some(f => f.id === 'fix_r1_relabel_ab')).toBe(true);

      // 4) Wave Behavior Recognition: 20-candle leg with 5 counter candles is 1 unified move; < 10 candles has no formed Absolute Bottom
      const mixed20Candles: Candle[] = Array.from({ length: 60 }, (_, i) => {
        const isCounter = i >= 12 && i <= 16; // 5 counter candles inside leg 1 (idx 5..25)
        const base = 100 + i * 2;
        return {
          time: `m${i}`,
          timestamp: 1700000000000 + i * 86400000,
          open: isCounter ? base + 2 : base - 2,
          close: isCounter ? base - 1 : base + 3,
          high: base + 4,
          low: base - 3,
          volume: 1000
        };
      });
      const unifiedMoveVal = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        [
          { label: '0', price: 110, candleIndex: 5, timestamp: mixed20Candles[5].timestamp, isConfirmed: true },
          { label: '1', price: 155, candleIndex: 25, timestamp: mixed20Candles[25].timestamp, isConfirmed: true },
          { label: '2', price: 135, candleIndex: 31, timestamp: mixed20Candles[31].timestamp, isConfirmed: true },
          { label: '3', price: 210, candleIndex: 44, timestamp: mixed20Candles[44].timestamp, isConfirmed: true },
          { label: '4', price: 185, candleIndex: 51, timestamp: mixed20Candles[51].timestamp, isConfirmed: true },
          { label: '5', price: 245, candleIndex: 58, timestamp: mixed20Candles[58].timestamp, isConfirmed: true }
        ],
        'BULLISH',
        'ROOT',
        '',
        mixed20Candles
      );
      expect(unifiedMoveVal.rules.find(r => r.ruleId === 'WAVE_BEHAVIOR_SINGLE_MOVE')?.passed).toBe(true);
      expect(RulesEngine.evaluateAbsoluteBottomAndValidLows(mixed20Candles.slice(0, 7), [], 'BULLISH').formed).toBe(false);
    });

    it('Session 6 (2.7–2.12): Terminal CB-Wave 100% W4 coverage, Anti-Cycle 3-3 & placement/market-end 100%, Anti-Terminal W3 truncation, PRZ vs TMV, Wave 5 Terminal sell signal, and Wedge Terminal boundaries', () => {
      // 1) CB_WAVE5_COVERS_W4 in TERMINAL: Wave 5 < Wave 3 without 100% Wave 4 coverage MUST fail HARD rule
      const termIncompleteW5 = RulesEngine.validateStructure(
        'TERMINAL',
        buildVertices([100, 220, 150, 255, 195, 240]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(termIncompleteW5.isValid).toBe(false);
      expect(termIncompleteW5.rules.find(r => r.ruleId === 'CB_WAVE5_COVERS_W4')?.passed).toBe(false);
      expect(termIncompleteW5.mislabelingStatus).toBe('MISLABELING');

      // 2) T-6.18 & T-6.19 (2.7 Anti-Terminal W3 truncation): valid when W3 < W1 && W3 > W5; invalid when W3 is shortest
      const t618 = RulesEngine.validateStructure(
        'ANTI_TERMINAL',
        buildVertices([100, 240, 180, 280, 220, 280]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(t618.isValid).toBe(true);
      expect(t618.rules.find(r => r.ruleId === 'ANTI_TERMINAL_W5_EXT')?.passed).toBe(true);

      const t619 = RulesEngine.validateStructure(
        'ANTI_TERMINAL',
        buildVertices([100, 220, 150, 220, 180, 310]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(t619.isValid).toBe(false);
      expect(t619.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed).toBe(false);

      // 3) T-6.20 & T-6.21 (2.8 PRZ vs TMV): Ideal Cycle reaches TMV; Terminal stops in PRZ short of TMV
      const t620 = RulesEngine.validateStructure(
        'IDEAL_CYCLE',
        buildVertices([100, 160, 130, 250, 205, 290]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(t620.isValid).toBe(true);
      expect(t620.rules.find(r => r.ruleId === 'IDEAL_WAVE5_TMV_REACHED')?.passed).toBe(true);

      const t621 = RulesEngine.validateStructure(
        'TERMINAL',
        buildVertices([100, 220, 150, 255, 195, 270]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(t621.isValid).toBe(true);
      expect(t621.rules.find(r => r.ruleId === 'TERMINAL_W5_TRUNCATION')?.passed).toBe(true);

      // 4) T-6.22 & T-6.23 (2.9 Terminal in Wave 5 + Wave A 100% retrace = strong sell signal)
      const w5TermCandles: Candle[] = Array.from({ length: 70 }, (_, i) => {
        let p = 100 + i * 2;
        if (i >= 32 && i <= 50) {
          const t = i - 32;
          // Crisp 19-bar 5-subwave Terminal wedge inside Wave 5 (no flat duplicate neighbors):
          // sub1 peak=240 (t=4), sub2 trough=222 (t=7), sub3 peak=258 (t=11), sub4 trough=236 (t=15, overlaps sub1!), sub5=262 (t=18)
          const curve = [
            210, 218, 226, 233, 240,
            232, 226, 222,
            231, 241, 250, 258,
            251, 245, 240, 236,
            245, 254, 262
          ];
          p = curve[Math.min(curve.length - 1, t)];
        }
        return {
          time: `w5_${i}`,
          timestamp: 1700000000000 + i * 86400000,
          open: p - 1,
          close: p,
          high: p + 1.5,
          low: p - 1.5,
          volume: 1000
        };
      });
      const w5TermVerts: WaveVertex[] = [
        { label: '0', price: 100, candleIndex: 0, timestamp: w5TermCandles[0].timestamp, isConfirmed: true },
        { label: '1', price: 150, candleIndex: 8, timestamp: w5TermCandles[8].timestamp, isConfirmed: true },
        { label: '2', price: 125, candleIndex: 14, timestamp: w5TermCandles[14].timestamp, isConfirmed: true },
        { label: '3', price: 230, candleIndex: 26, timestamp: w5TermCandles[26].timestamp, isConfirmed: true },
        { label: '4', price: 210, candleIndex: 32, timestamp: w5TermCandles[32].timestamp, isConfirmed: true },
        { label: '5', price: 262, candleIndex: 50, timestamp: w5TermCandles[50].timestamp, isConfirmed: true },
        { label: 'A', price: 205, candleIndex: 62, timestamp: w5TermCandles[62].timestamp, isConfirmed: true }
      ];
      const t622 = RulesEngine.validateStructure('IDEAL_CYCLE', w5TermVerts.slice(0, 6), 'BULLISH', 'ROOT', '', w5TermCandles);
      expect(t622.wave5TerminalDetected).toBe(true);
      expect(t622.rules.some(r => r.ruleId === 'IDEAL_WAVE5_TERMINAL_DETECTED')).toBe(true);

      const t623 = RulesEngine.evaluateWave5TerminalSignal(w5TermVerts, 'BULLISH', w5TermCandles, 'موج 5');
      expect(t623.terminalInWave5).toBe(true);
      expect(t623.waveACovers100Pct).toBe(true);
      expect(t623.signalStrength).toBe('STRONG_SELL');

      // 5) T-6.24, T-6.25, T-6.26 (2.10 Anti-Cycle 100% market-end law) + T-6.30..T-6.32 (2.12 placement) + 3-3 mismatch
      const acMarketEndCandles = buildCandles(15, 100);
      const t624 = RulesEngine.validateStructure(
        'ANTI_CYCLE',
        buildVertices([100, 200, 110]),
        'BULLISH',
        'ROOT',
        '',
        acMarketEndCandles
      );
      expect(t624.isValid).toBe(false);

      const t625 = RulesEngine.validateStructure(
        'ANTI_CYCLE',
        buildVertices([100, 200, 100]),
        'BULLISH',
        'ROOT',
        '',
        acMarketEndCandles
      );
      expect(t625.isValid).toBe(true);

      const t626 = RulesEngine.validateStructure(
        'ANTI_CYCLE',
        buildVertices([100, 200, 110]),
        'BULLISH',
        'ROOT',
        '',
        candles
      );
      expect(t626.isValid).toBe(true);

      // T-6.30..T-6.32: Extended in B (valid), Wave 2 (invalid even with parentRole='CORRECTIVE'), subwave 4 of Wave 3 (valid)
      const t630 = RulesEngine.validateStructure('ANTI_CYCLE', buildVertices([100, 200, 90, 280]), 'BULLISH', 'CORRECTIVE', 'موج B', candles);
      expect(t630.isValid).toBe(true);

      const t631 = RulesEngine.validateStructure('ANTI_CYCLE', buildVertices([100, 200, 90, 280]), 'BULLISH', 'CORRECTIVE', 'موج 2', candles);
      expect(t631.isValid).toBe(false);

      const t632 = RulesEngine.validateStructure('ANTI_CYCLE', buildVertices([100, 200, 90, 280]), 'BULLISH', 'CORRECTIVE', 'ریزموج 4 از موج 3', candles);
      expect(t632.isValid).toBe(true);

      // Anti-Cycle 3-3 internal subwave structure rejects as FLAT_REGULAR
      const threeThreeCandles: Candle[] = Array.from({ length: 40 }, (_, i) => {
        // Genuine 3-wave (2 internal pivots: A peak, B trough) per phase
        const seg1 = [100, 125, 145, 165, 150, 138, 125, 145, 165, 182, 196, 205];
        const seg2 = [205, 180, 155, 130, 145, 160, 175, 155, 135, 118, 102, 90];
        const p = i < 12 ? seg1[i] : i < 24 ? seg2[i - 12] : 100 + i;
        return {
          time: `tt_${i}`,
          timestamp: 1700000000000 + i * 86400000,
          open: p - 1,
          close: p,
          high: p + 2,
          low: p - 2,
          volume: 1000
        };
      });
      const threeThreeVerts: WaveVertex[] = [
        { label: '0', price: 100, candleIndex: 0, timestamp: threeThreeCandles[0].timestamp, isConfirmed: true },
        { label: '1', price: 205, candleIndex: 11, timestamp: threeThreeCandles[11].timestamp, isConfirmed: true },
        { label: '2', price: 90, candleIndex: 23, timestamp: threeThreeCandles[23].timestamp, isConfirmed: true }
      ];
      const threeThreeVal = RulesEngine.validateStructure('ANTI_CYCLE', threeThreeVerts, 'BULLISH', 'CORRECTIVE', 'موج B', threeThreeCandles);
      expect(threeThreeVal.isValid).toBe(false);
      expect(threeThreeVal.rules.find(r => r.ruleId === 'ANTI_CYCLE_COVERAGE')?.canBeSolvedByAlternate).toBe('FLAT_REGULAR');

      // 6) T-6.27, T-6.28, T-6.29 (2.11 Wedge Terminal vs Anti-Terminal vs Ideal Cycle w/ decreasing amplitude)
      const t627 = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 220, 150, 255, 195, 270]), 'BULLISH', 'ROOT', '', candles);
      expect(t627.suggestedAlternative).toBe('TERMINAL');

      const t628 = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 160, 130, 220, 145, 320]), 'BULLISH', 'ROOT', '', candles);
      expect(t628.suggestedAlternative).toBe('ANTI_TERMINAL');

      const t629Term = RulesEngine.validateStructure('TERMINAL', buildVertices([100, 300, 180, 350, 310, 400]), 'BULLISH', 'ROOT', '', candles);
      expect(t629Term.rules.find(r => r.ruleId === 'OVERLAP_FEATURE')?.canBeSolvedByAlternate).toBe('IDEAL_CYCLE');
      const t629Ideal = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 300, 180, 350, 310, 400]), 'BULLISH', 'ROOT', '', candles);
      expect(t629Ideal.isValid).toBe(true);
    });

    it('Session 7 (2.1–2.5 / T-7.1..T-7.10): Fibonacci S/R & volume confluence, Retracement ratios (61.8%, 38.2%, 100%, 40% non-standard), and 2-point Extension (261.8%, 200%, <200% truncation)', () => {
      // T-7.1: 61.8% retracement at 138.2 with classic swing S/R touch & elevated volume -> STRONG
      const srCandles: Candle[] = Array.from({ length: 25 }, (_, i) => {
        const isSwingAt138 = i === 6 || i === 12;
        const base = isSwingAt138 ? 138.2 : 155 + (i % 3) * 4;
        return {
          time: `sr_${i}`,
          timestamp: 1700000000000 + i * 86400000,
          open: base + 1,
          close: base + 2,
          high: base + 5,
          low: isSwingAt138 ? 138.2 : base - 1,
          volume: isSwingAt138 ? 3000 : 1000
        };
      });
      const t71 = TargetProjectionEngine.evaluateFibonacciLevelConfluence({
        levelPrice: 138.2,
        ratio: 0.618,
        candles: srCandles
      });
      expect(t71.hasClassicSR).toBe(true);
      expect(t71.strength).toBe('STRONG');

      // T-7.2: 61.8% retracement at 138.2 with NO nearby classic S/R -> WEAK
      const noSrCandles: Candle[] = Array.from({ length: 25 }, (_, i) => ({
        time: `nsr_${i}`,
        timestamp: 1700000000000 + i * 86400000,
        open: 180 + i,
        close: 181 + i,
        high: 183 + i,
        low: 178 + i,
        volume: 1000
      }));
      const t72 = TargetProjectionEngine.evaluateFibonacciLevelConfluence({
        levelPrice: 138.2,
        ratio: 0.618,
        candles: noSrCandles
      });
      expect(t72.hasClassicSR).toBe(false);
      expect(t72.strength).toBe('WEAK');

      // T-7.3: Bullish 100 -> 200 -> 138.2 = 61.8%
      const t73 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }, { price: 138.2 }],
        direction: 'BULLISH',
        targetWave: '2'
      });
      expect(t73.isValid).toBe(true);
      expect(t73.retracementPct).toBe(61.8);
      expect(t73.matchedFibLevel).toBe('61.8%');
      expect(t73.isGolden618).toBe(true);

      // T-7.4 & T-7.9: 38.2% standard retracement in Bearish (200 -> 100 -> 138.2) & Bullish (100 -> 200 -> 161.8)
      const t74 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 200 }, { price: 100 }, { price: 138.2 }],
        direction: 'BEARISH',
        targetWave: '4'
      });
      expect(t74.isValid).toBe(true);
      expect(t74.retracementPct).toBe(38.2);
      expect(t74.matchedFibLevel).toBe('38.2%');
      expect(t74.isStandardFibLevel).toBe(true);

      // T-7.5: 100% Wave 2 retracement -> Rule 1 error
      const t75 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }, { price: 100 }],
        direction: 'BULLISH',
        targetWave: '2'
      });
      expect(t75.isValid).toBe(false);
      expect(t75.errors.some(e => e.includes('قانون ۱'))).toBe(true);

      // T-7.10: 40% retracement is NOT a standard Fibonacci ratio
      const t710 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }, { price: 160 }],
        direction: 'BULLISH',
        targetWave: '2'
      });
      expect(t710.retracementPct).toBe(40);
      expect(t710.isStandardFibLevel).toBe(false);
      expect(t710.matchedFibLevel).toBeUndefined();

      // T-7.6, T-7.7, T-7.8: 2-Point Extension X (end) -> Y (start)
      const t76 = TargetProjectionEngine.evaluateTwoPointExtension({
        waveStartY: 100,
        waveEndX: 200,
        targetPriceZ: 361.8,
        direction: 'BULLISH'
      });
      expect(t76.totalExtensionPct).toBe(261.8);
      expect(t76.matchedExtensionLevel).toBe('261.8%');
      expect(t76.isTruncated).toBe(false);

      const t77 = TargetProjectionEngine.evaluateTwoPointExtension({
        waveStartY: 100,
        waveEndX: 200,
        targetPriceZ: 300,
        direction: 'BULLISH'
      });
      expect(t77.totalExtensionPct).toBe(200);
      expect(t77.beyondExtremePct).toBe(100);
      expect(t77.isTruncated).toBe(false);

      const t78 = TargetProjectionEngine.evaluateTwoPointExtension({
        waveStartY: 100,
        waveEndX: 200,
        targetPriceZ: 250,
        direction: 'BULLISH'
      });
      expect(t78.isTruncated).toBe(true);

      // T-7.11, T-7.12, T-7.13 (2.6 Extension Levels): 161.8% common extension, 61.8% terminal truncation, 261.8% strong extension
      const t711 = TargetProjectionEngine.evaluateTwoPointExtension({
        waveStartY: 100,
        waveEndX: 200,
        targetPriceZ: 261.8,
        direction: 'BULLISH'
      });
      expect(t711.extensionTier).toBe('COMMON_EXTENSION');

      const t712 = TargetProjectionEngine.evaluateTwoPointExtension({
        waveStartY: 100,
        waveEndX: 200,
        targetPriceZ: 161.8,
        direction: 'BULLISH'
      });
      expect(t712.extensionTier).toBe('TRUNCATED_OR_TERMINAL');

      const t713 = TargetProjectionEngine.evaluateTwoPointExtension({
        waveStartY: 100,
        waveEndX: 200,
        targetPriceZ: 361.8,
        direction: 'BULLISH'
      });
      expect(t713.extensionTier).toBe('STRONG_EXTENSION');

      // T-7.14, T-7.15, T-7.16 (2.7 Expansion Levels): W2 23.6% -> probable W1 extension, W4 38.2% -> valid W4 turn, W2 78.6% -> acceleration zone
      const t714 = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 200, 176.4, 280, 240, 320]), 'BULLISH', 'ROOT', '', candles);
      expect(t714.wave1ExtensionProbable).toBe(true);

      const t715 = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 200, 150, 350, 273.6, 400]), 'BULLISH', 'ROOT', '', candles);
      expect(t715.rules.find(r => r.ruleId === 'FIB_WAVE_4')?.passed).toBe(true);

      const t716 = RulesEngine.validateStructure('IDEAL_CYCLE', buildVertices([100, 200, 121.4, 320, 250, 380]), 'BULLISH', 'ROOT', '', candles);
      expect(t716.rules.find(r => r.ruleId === 'FIB_WAVE_2')?.messageFa).toContain('شتاب‌گیری');
      const retLevels = TargetProjectionEngine.getRetracementImportanceLevels(100, 200, 'BULLISH');
      expect(retLevels.find(l => l.ratio === 0.786)?.acceleration).toBe(true);

      // T-7.17, T-7.18, T-7.19 (2.8 Retracement X->Y Orientation)
      const t717 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH'
      });
      expect(t717.isValid).toBe(true);

      const t718 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 200 }, { price: 100 }],
        direction: 'BEARISH'
      });
      expect(t718.isValid).toBe(true);

      const t719 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 200 }, { price: 100 }],
        direction: 'BULLISH'
      });
      expect(t719.isValid).toBe(false);

      // T-7.20, T-7.21, T-7.22 (2.9 Extension X=end->Y=start Orientation & 161.8% levels)
      const t720 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'EXTENSION',
        points: [{ price: 200 }, { price: 100 }],
        direction: 'BULLISH'
      });
      expect(t720.isValid).toBe(true);
      expect(t720.extensionLevels?.find(l => l.ratio === 1.618)?.price).toBe(261.8);

      const t721 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'EXTENSION',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BEARISH'
      });
      expect(t721.isValid).toBe(true);
      expect(t721.extensionLevels?.find(l => l.ratio === 1.618)?.price).toBe(38.2);

      const t722 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'EXTENSION',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH'
      });
      expect(t722.isValid).toBe(false);

      // T-7.23, T-7.24, T-7.25 (2.10 S/R & Acceleration importance table)
      expect(retLevels.find(l => l.ratio === 0.618)?.srImportance).toBe('very_strong');
      expect(retLevels.find(l => l.ratio === 0.786)?.srImportance).toBe('strong');
      expect(retLevels.find(l => l.ratio === 0.786)?.acceleration).toBe(true);
      expect(retLevels.find(l => l.ratio === 0.236)?.srImportance).toBe('none');

      // 2.11 Fibonacci Arc, Fan, Time (advanced time/price tools, excluded from basic wave counting) & 2.12 3-point Projection intro
      const catalog = TargetProjectionEngine.getFibonacciToolCatalog();
      const arcEntry = catalog.find(c => c.toolType === 'ARC');
      const fanEntry = catalog.find(c => c.toolType === 'FAN');
      const timeEntry = catalog.find(c => c.toolType === 'TIME');
      const projEntry = catalog.find(c => c.toolType === 'PROJECTION');
      expect(arcEntry?.usedInBasicWaveCounting).toBe(false);
      expect(arcEntry?.domain).toBe('PRICE_AND_TIME');
      expect(fanEntry?.usedInBasicWaveCounting).toBe(false);
      expect(fanEntry?.domain).toBe('PRICE_AND_TIME');
      expect(timeEntry?.usedInBasicWaveCounting).toBe(false);
      expect(timeEntry?.domain).toBe('TIME');
      expect(projEntry?.pointCount).toBe(3);

      const arcVal = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'ARC',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH'
      });
      expect(arcVal.isValid).toBe(true);
      expect(arcVal.usedInBasicWaveCounting).toBe(false);
      expect(arcVal.toolDomain).toBe('PRICE_AND_TIME');
      expect(arcVal.warnings.some(w => w.includes('موج‌شماری پایه استفاده نمی‌شود'))).toBe(true);

      const timeVal = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'TIME',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH'
      });
      expect(timeVal.usedInBasicWaveCounting).toBe(false);
      expect(timeVal.toolDomain).toBe('TIME');
    });

    it('Session 8 (2.1–2.5 / T-8.1..T-8.15): 3-Point Projection X->Y->Z, Z/orientation errors, TMV vs PRZ overlap & priority, and Wave 5 retracement ban', () => {
      // T-8.1, T-8.2, T-8.4: X=100, Y=200, Z=150 -> 100% at 250, 161.8% at 311.8
      const proj = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [
          { price: 100, candleIndex: 0 },
          { price: 200, candleIndex: 5 },
          { price: 150, candleIndex: 9 }
        ],
        direction: 'BULLISH',
        targetWave: '3',
        pairLabel: '1-2'
      });
      expect(proj.isValid).toBe(true);
      expect(proj.projectionLevels?.find(l => l.ratio === 1.0)?.price).toBe(250);
      expect(proj.projectionLevels?.find(l => l.ratio === 1.618)?.price).toBe(311.8);

      // T-8.3: Missing Wave 2 (Z) -> error
      const t83 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH'
      });
      expect(t83.isValid).toBe(false);

      // T-8.5: Reversed (X=200, Y=100, Z=150 for BULLISH) -> error
      const t85 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 200 }, { price: 100 }, { price: 150 }],
        direction: 'BULLISH'
      });
      expect(t85.isValid).toBe(false);

      // T-8.6: Z placed on Wave 1 (candleIndex <= Y) -> error
      const t86 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [
          { price: 100, candleIndex: 0 },
          { price: 200, candleIndex: 5 },
          { price: 150, candleIndex: 3 }
        ],
        direction: 'BULLISH'
      });
      expect(t86.isValid).toBe(false);

      // T-8.7..T-8.12: TMV vs PRZ Overlap & Priority
      const t87 = TargetProjectionEngine.evaluateTmvPrzOverlap({ tmvPrice: 250, przLow: 250, hasHighVolume: true });
      expect(t87.hasOverlap).toBe(true);
      expect(t87.overlapType).toBe('FULL');
      expect(t87.confidenceTier).toBe('VERY_HIGH');

      const t88 = TargetProjectionEngine.evaluateTmvPrzOverlap({ tmvPrice: 250, przLow: 240, przHigh: 260 });
      expect(t88.hasOverlap).toBe(true);
      expect(t88.overlapType).toBe('PARTIAL');

      const t89 = TargetProjectionEngine.evaluateTmvPrzOverlap({ tmvPrice: 250, przLow: 300 });
      expect(t89.hasOverlap).toBe(false);
      expect(t89.overlapType).toBe('NONE');
      expect(t89.priority).toBe('TMV_PRIORITY');

      // T-8.13, T-8.14, T-8.15: Wave 5 retracement forbidden, <100% warns possible Wave 3, >100% Rule 1 error
      const t813 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }],
        direction: 'BULLISH',
        targetWave: '5'
      });
      expect(t813.isValid).toBe(false);
      expect(t813.isWave5RetracementInvalid).toBe(true);

      const t814 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }, { price: 150 }],
        direction: 'BULLISH',
        targetWave: '5'
      });
      expect(t814.isValid).toBe(false);
      expect(t814.warnings.some(w => w.includes('موج ۳'))).toBe(true);

      const t815 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'RETRACEMENT',
        points: [{ price: 100 }, { price: 200 }, { price: 80 }],
        direction: 'BULLISH',
        targetWave: '5'
      });
      expect(t815.isValid).toBe(false);
      expect(t815.errors.some(e => e.includes('قانون ۱'))).toBe(true);

      // T-8.16, T-8.17, T-8.18 (2.6): Projection pair rules (1-2->W3 valid, 1-2->W5 error, 3-4->W5 valid, A-B->C valid)
      const t816 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 100 }, { price: 200 }, { price: 150 }],
        direction: 'BULLISH',
        targetWave: '3',
        pairLabel: '۱-۲'
      });
      expect(t816.isValid).toBe(true);

      const t817 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 100 }, { price: 200 }, { price: 150 }],
        direction: 'BULLISH',
        targetWave: '5',
        pairLabel: '۱-۲'
      });
      expect(t817.isValid).toBe(false);

      const t818 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 150 }, { price: 320 }, { price: 260 }],
        direction: 'BULLISH',
        targetWave: '5',
        pairLabel: '۳-۴'
      });
      expect(t818.isValid).toBe(true);

      // T-8.19, T-8.20, T-8.21 (2.7): Wave 5 projection from W3 (200->400) & W4 (400->350) -> 100%=550, 161.8%=673.6; accelerated W5 -> LOW confidence
      const t819 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 200 }, { price: 400 }, { price: 350 }],
        direction: 'BULLISH',
        targetWave: '5',
        pairLabel: '۳-۴'
      });
      expect(t819.isValid).toBe(true);
      expect(t819.projectionLevels?.find(l => l.ratio === 1.0)?.price).toBe(550);
      expect(t819.projectionLevels?.find(l => l.ratio === 1.618)?.price).toBe(673.6);

      const t821 = TargetProjectionEngine.validateFibonacciToolUsage({
        toolType: 'PROJECTION',
        points: [{ price: 200 }, { price: 400 }, { price: 350 }],
        direction: 'BULLISH',
        targetWave: '5',
        pairLabel: '۳-۴',
        isAcceleratedWave5: true
      });
      expect(t821.projectionConfidence).toBe('LOW');
      expect(t821.warnings.some(w => w.includes('اعتبار کمتری'))).toBe(true);

      // T-8.22, T-8.23, T-8.24 (2.8): Projection & Extension confluence
      const t822 = TargetProjectionEngine.evaluateProjectionExtensionConfluence({
        projectionPrice: 311.8,
        extensionPrice: 311.8
      });
      expect(t822.hasOverlap).toBe(true);
      expect(t822.confidenceTier).toBe('HIGH');

      const t823 = TargetProjectionEngine.evaluateProjectionExtensionConfluence({
        projectionPrice: 311.8,
        extensionPrice: 300
      });
      expect(t823.hasOverlap).toBe(true);
      expect(t823.overlapType).toBe('PARTIAL');
      expect(t823.confidenceTier).toBe('MEDIUM');

      const t824 = TargetProjectionEngine.evaluateProjectionExtensionConfluence({
        extensionPrice: 311.8
      });
      expect(t824.confidenceTier).toBe('LOW');

      // T-8.25, T-8.26, T-8.27 (2.9): TMV Prime=200, TMV Ideal=250, TMV Alternate=311.8
      const mkScenario = (verts: WaveVertex[]): WaveScenario => ({
        id: 's8_test',
        titleFa: 'تست ۸',
        patternType: 'IDEAL_CYCLE',
        direction: 'BULLISH',
        confidence: 90,
        probability: 80,
        vertices: verts,
        validationSummary: {} as any,
        targets: [],
        invalidations: [],
        invalidationPrice: 100,
        descriptionFa: ''
      });
      const t825 = TargetProjectionEngine.computeTmvTiersAndOverlap(
        mkScenario(buildVertices([100, 200, 150])),
        []
      );
      expect(t825.tmvSummary?.prime).toBe(200);
      expect(t825.tmvSummary?.ideal100).toBe(250);
      expect(t825.tmvSummary?.alternate1618).toBe(311.8);

      // T-8.28, T-8.29, T-8.30 (2.10): W3=250% reduces W5 TMV (0.618), W3=150% keeps standard (null), W5=200% expands TMV (isWave5Extension)
      const t828 = TargetProjectionEngine.computeTmvTiersAndOverlap(
        mkScenario(buildVertices([100, 200, 150, 400, 350])),
        []
      );
      expect(t828.tmvSummary?.wave3ExtendedReductionRatio).toBe(0.618);
      expect(t828.tmvSummary?.ideal100).toBeLessThan(350 + 250);

      const t829 = TargetProjectionEngine.computeTmvTiersAndOverlap(
        mkScenario(buildVertices([100, 200, 150, 300, 250])),
        []
      );
      expect(t829.tmvSummary?.wave3ExtendedReductionRatio).toBeNull();
      expect(t829.tmvSummary?.ideal100).toBe(400);

      const t830 = TargetProjectionEngine.computeTmvTiersAndOverlap(
        mkScenario(buildVertices([100, 200, 150, 300, 250, 550])),
        []
      );
      expect(t830.tmvSummary?.isWave5Extension).toBe(true);
      expect(t830.tmvSummary?.wave5ExtendedExpansionRatio).toBe(1.618);

      // T-8.31, T-8.32, T-8.33 (2.11): Max 4 degrees in Daily, 3 in Weekly, and Degree 4 promotion on breakout
      const t831 = FractalEngine.assignDegrees(5, '1D', 'TSE_IRAN', 120);
      expect(t831.degrees).toHaveLength(4);
      expect(t831.droppedLevels).toBe(1);

      const t832 = FractalEngine.assignDegrees(4, '1W', 'TSE_IRAN', 120);
      expect(t832.degrees).toHaveLength(3);
      expect(t832.droppedLevels).toBe(1);

      const deg4Candles: Candle[] = Array.from({ length: 40 }, (_, i) => {
        const p = i <= 30 ? 100 + i * 3 : 190 + (i - 30) * 5; // breaks past wave 5 (190) -> 235
        return {
          time: `d4_${i}`,
          timestamp: 1700000000000 + i * 86400000,
          open: p - 1,
          close: p,
          high: p + 1,
          low: p - 1,
          volume: 1000
        };
      });
      const deg4Scenario: WaveScenario = {
        ...mkScenario([
          { label: '0', price: 100, candleIndex: 0, timestamp: deg4Candles[0].timestamp, isConfirmed: true },
          { label: '(1)', price: 130, candleIndex: 6, timestamp: deg4Candles[6].timestamp, isConfirmed: true },
          { label: '(2)', price: 115, candleIndex: 11, timestamp: deg4Candles[11].timestamp, isConfirmed: true },
          { label: '(3)', price: 170, candleIndex: 20, timestamp: deg4Candles[20].timestamp, isConfirmed: true },
          { label: '(4)', price: 150, candleIndex: 25, timestamp: deg4Candles[25].timestamp, isConfirmed: true },
          { label: '(5)', price: 190, candleIndex: 30, timestamp: deg4Candles[30].timestamp, isConfirmed: true }
        ]),
        degree: 'INTERMEDIATE',
        timeframe: '1D'
      };
      const promoOpp = FractalEngine.detectDegreePromotionOpportunity(deg4Scenario, deg4Candles);
      expect(promoOpp.shouldPromote).toBe(true);
      const t833 = FractalEngine.promoteScenarioDegrees(deg4Scenario, 'TSE_IRAN', '1D');
      expect(t833.promoted).toBe(true);
      expect(t833.droppedSmallestLevel).toBe(true);
      expect(t833.scenario.degree).toBe('PRIMARY');
      expect(t833.scenario.vertices[5].label).toBe('5');

      // T-8.34 & T-8.35 (2.12): Degree 4 colored red (#ef4444), Degree 5 rejected
      expect(DEGREE_CONFIGS.INTERMEDIATE.color).toBe('#ef4444');
      const t834 = FractalEngine.validateDegreeColorScheme({ degreeCount: 4, timeframe: '1D', marketType: 'TSE_IRAN', useColors: true });
      expect(t834.isValid).toBe(true);
      expect(t834.isDegree4Red).toBe(true);
      expect(t834.degree4Color).toBe('#ef4444');

      const t835 = FractalEngine.validateDegreeColorScheme({ degreeCount: 5, timeframe: '1D', marketType: 'TSE_IRAN', useColors: true });
      expect(t835.isValid).toBe(false);

      // FractalEngine calculateProjection(x, y, z, level) & active wave leg TMV/PRZ overlap engine
      expect(calculateProjection(100, 200, 150, 1.0)).toBe(250);
      expect(calculateProjection(100, 200, 150, 100)).toBe(250);
      expect(calculateProjection(100, 200, 150, 1.618)).toBe(311.8);
      expect(calculateProjection(100, 200, 150, 161.8)).toBe(311.8);
      expect(calculateProjection(200, 100, 150, 100)).toBe(50);

      const threePt = FractalEngine.calculateThreePointTmvProjection({ x: 200, y: 400, z: 350 });
      expect(threePt.isValid).toBe(true);
      expect(threePt.ideal100).toBe(550);
      expect(threePt.alternate1618).toBe(673.6);

      const legOverlay = FractalEngine.calculateActiveWaveLegZones(
        buildVertices([100, 200, 150, 250]),
        2,
        'BULLISH',
        'IDEAL_CYCLE'
      );
      expect(legOverlay.tmv100Price).toBe(250);
      expect(legOverlay.tmv1618Price).toBe(311.8);
      expect(legOverlay.highlightMode).toBe('TMV_PRIMARY_TARGET');
    });
  });
});




