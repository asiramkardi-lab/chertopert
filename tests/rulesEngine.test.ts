import { describe, it, expect } from 'vitest';
import { RulesEngine } from '../src/engine/rulesEngine';
import { SmartRuleAlertEngine } from '../src/engine/smartRuleAlertEngine';
import { TargetProjectionEngine } from '../src/engine/targetProjectionEngine';
import { PatternEngines } from '../src/engine/patternEngines';
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
});
