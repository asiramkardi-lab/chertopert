import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { RulesEngine, isExcludedFlat } from '../src/engine/rulesEngine';
import { Candle, FlatAnalysisOptions, PatternFamily, WaveScenario, WaveVertex } from '../src/types/elliott';

function makeCandles(count = 24): Candle[] {
  return Array.from({ length: count }, (_, idx) => {
    const close = 100 + idx * 2;
    return {
      time: `2025-02-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      timestamp: 1738368000 + idx * 86400,
      open: close - 1,
      high: close + 1,
      low: close - 2,
      close,
      volume: 1200
    };
  });
}

function makeFlatScenario(
  prices: [number, number, number, number],
  options?: { patternType?: PatternFamily; validityScore?: number; candleIndices?: [number, number, number, number] }
): WaveScenario {
  const idxs = options?.candleIndices ?? [0, 5, 10, 15];
  const baseTs = 1738368000;
  return {
    id: 'flat_s13_test',
    name: 'Session 13 Flat Scenario',
    color: '#f59e0b',
    isPrimary: true,
    isLocked: false,
    isSelectedForTree: true,
    patternType: options?.patternType ?? 'FLAT_REGULAR',
    degree: 'PRIMARY',
    direction: 'BULLISH',
    vertices: [
      { label: '0', price: prices[0], candleIndex: idxs[0], timestamp: baseTs + idxs[0] * 86400, isConfirmed: true },
      { label: 'A', price: prices[1], candleIndex: idxs[1], timestamp: baseTs + idxs[1] * 86400, isConfirmed: true },
      { label: 'B', price: prices[2], candleIndex: idxs[2], timestamp: baseTs + idxs[2] * 86400, isConfirmed: true },
      { label: 'C', price: prices[3], candleIndex: idxs[3], timestamp: baseTs + idxs[3] * 86400, isConfirmed: true }
    ],
    currentWave: 'C',
    completionPercentage: 100,
    validityScore: options?.validityScore ?? 85,
    idealnessScore: 85,
    confidenceScore: 85,
    invalidationPrice: prices[0],
    targets: [],
    rulesResults: [],
    source: 'AI',
    timeframe: '1D'
  };
}

function analyzeRatios(bPct: number, cPct: number, opts?: FlatAnalysisOptions) {
  const p0 = 200;
  const p1 = 100;
  const p2 = p1 + bPct;
  const p3 = p2 - cPct * (bPct / 100);
  return PatternEngines.analyzeFlat(makeFlatScenario([p0, p1, p2, p3]), makeCandles(24), {
    internalSubwaves: [3, 3, 5],
    isMarketEnd: false,
    ...opts
  });
}

describe('Session 13 Flat Advanced Naming, Rules & Knot-Untangler Engine (T-13.1..T-13.53)', () => {
  it('۱۳-۱ (T-13.1..3): Enforces Flat market-end prohibition vs past-market knot-untangling', () => {
    // T-13.1: Past market -> allowed
    const t1 = analyzeRatios(90, 90, { isMarketEnd: false });
    expect(t1.usableAtCurrentContext).toBe(true);
    expect(t1.tradingPolicyAction).toBe('ALLOW_PAST_KNOT_UNTANGLING');

    // T-13.2: Market end WITH confirmation -> allowed with caution
    const t2 = analyzeRatios(90, 90, { isMarketEnd: true, hasConfirmation: true });
    expect(t2.usableAtCurrentContext).toBe(true);
    expect(t2.contextCredibilityTier).toBe('MEDIUM');
    expect(t2.tradingPolicyAction).toBe('ALLOW_WITH_CAUTION');

    // T-13.3: Market end WITHOUT confirmation -> forbidden
    const t3 = analyzeRatios(90, 90, { isMarketEnd: true, hasConfirmation: false });
    expect(t3.usableAtCurrentContext).toBe(false);
    expect(t3.contextCredibilityTier).toBe('LOW');
    expect(t3.tradingPolicyAction).toBe('FORBID_AT_MARKET_END');
  });

  it('۱۳-۲ (T-13.4..6): Enforces past-market counting priority (Ideal -> Terminal/Diag -> Zigzag -> Flat -> Combination)', () => {
    // T-13.4: Zigzag countable -> prefer Zigzag, do not use Flat
    const t4 = PatternEngines.evaluateFlatCountingPriority({
      zigzagCountable: true,
      flatCountable: true,
      combinationCountable: true
    });
    expect(t4.recommendedChoice).toBe('ZIGZAG');
    expect(t4.useFlat).toBe(false);
    expect(t4.priorityOrder).toEqual(['IDEAL_CYCLE', 'TERMINAL_OR_DIAGONAL', 'ZIGZAG', 'FLAT', 'COMPLEX_COMBINATION']);

    // T-13.5: Zigzag not countable + Flat countable -> prefer Flat
    const t5 = PatternEngines.evaluateFlatCountingPriority({
      zigzagCountable: false,
      flatCountable: true,
      combinationCountable: true
    });
    expect(t5.recommendedChoice).toBe('FLAT');
    expect(t5.useFlat).toBe(true);

    // T-13.6: Neither Zigzag nor Flat countable + Combination countable -> Combination
    const t6 = PatternEngines.evaluateFlatCountingPriority({
      zigzagCountable: false,
      flatCountable: false,
      combinationCountable: true
    });
    expect(t6.recommendedChoice).toBe('COMPLEX_COMBINATION');
    expect(t6.useFlat).toBe(false);
  });

  it('۱۳-۳ (T-13.7..14): Precisely names all 8 Flat subtypes by B/A and C/B ratios', () => {
    expect(analyzeRatios(90, 90).subtype).toBe('REGULAR');           // T-13.7
    expect(analyzeRatios(70, 90).subtype).toBe('B_DEFICIENT');       // T-13.8
    expect(analyzeRatios(90, 70).subtype).toBe('C_DEFICIENT');       // T-13.9
    expect(analyzeRatios(70, 70).subtype).toBe('DOUBLE_DEFICIENT');  // T-13.10
    expect(analyzeRatios(110, 100).subtype).toBe('IRREGULAR');       // T-13.11
    expect(analyzeRatios(110, 70).subtype).toBe('IRREGULAR_DEFICIENT'); // T-13.12
    expect(analyzeRatios(150, 120).subtype).toBe('IRREGULAR_EXTENDED'); // T-13.13
    const t14 = analyzeRatios(110, 50);                              // T-13.14
    expect(t14.subtype).toBe('RUNNING_DEPRECATED');
    expect(t14.isRunningDeprecatedCourse).toBe(true);
    expect(t14.tradingPolicyAction).toBe('DEPRECATE_REMOVE');
  });

  it('۱۳-۴ & ۱۳-۵ (T-13.15..20): Enforces 3-3-5 structure & B > 61.8% across all Flats', () => {
    // T-13.15..17: Structure check
    expect(analyzeRatios(90, 90, { internalSubwaves: [3, 3, 5] }).disambiguationKind).toBe('FLAT');
    expect(analyzeRatios(50, 100, { internalSubwaves: [5, 3, 5] }).disambiguationKind).toBe('IDEAL_ZIGZAG');
    expect(analyzeRatios(50, 100, { internalSubwaves: [3, 3, 3] }).disambiguationKind).toBe('SIMPLE_ZIGZAG');

    // T-13.18..20: B > 61.8% law
    const t18 = analyzeRatios(62, 90);
    expect(t18.bOver618Valid).toBe(true);
    expect(t18.detected).toBe(true);

    const t19 = analyzeRatios(61, 90);
    expect(t19.bOver618Valid).toBe(false);
    expect(t19.disambiguationKind).toBe('SIMPLE_ZIGZAG');
    expect(t19.detected).toBe(false);

    const t20 = analyzeRatios(61.8, 90);
    expect(t20.isBorderlineB618).toBe(true);
  });

  it('۱۳-۶..۱۳-۹ (T-13.21..32): Verifies Regular, B-Deficient, C-Deficient, Double-Deficient & 81%/100% boundaries', () => {
    // Regular (T-13.21..23)
    expect(analyzeRatios(90, 90).subtype).toBe('REGULAR');
    const t22 = analyzeRatios(81, 81);
    expect(t22.subtype).toBe('REGULAR');
    expect(t22.isBorderline81).toBe(true);
    const t23 = analyzeRatios(100, 100);
    expect(t23.subtype).toBe('REGULAR');
    expect(t23.isBorderline100).toBe(true);

    // B-Deficient (T-13.24..26)
    expect(analyzeRatios(70, 90).subtype).toBe('B_DEFICIENT');
    const t25 = analyzeRatios(61.8, 81);
    expect(t25.subtype).toBe('B_DEFICIENT');
    expect(t25.isBorderlineB618).toBe(true);
    expect(t25.isBorderline81).toBe(true);
    const t26 = analyzeRatios(81, 100);
    expect(t26.isBorderline81).toBe(true);
    expect(t26.isBorderline100).toBe(true);

    // C-Deficient (T-13.27..29)
    expect(analyzeRatios(90, 70).subtype).toBe('C_DEFICIENT');
    const t28 = analyzeRatios(81, 61.8);
    expect(t28.subtype).toBe('C_DEFICIENT');
    expect(t28.isBorderline81).toBe(true);
    expect(t28.isBorderlineC618).toBe(true);
    const t29 = analyzeRatios(100, 81);
    expect(t29.isBorderline81).toBe(true);
    expect(t29.isBorderline100).toBe(true);

    // Double-Deficient (T-13.30..32)
    expect(analyzeRatios(70, 70).subtype).toBe('DOUBLE_DEFICIENT');
    const t31 = analyzeRatios(61.8, 61.8);
    expect(t31.subtype).toBe('DOUBLE_DEFICIENT');
    expect(t31.isBorderlineB618).toBe(true);
    expect(t31.isBorderlineC618).toBe(true);
    expect(analyzeRatios(81, 81).isBorderline81).toBe(true);
  });

  it('۱۳-۱۰..۱۳-۱۳ (T-13.33..44): Verifies Irregular, Irregular-Deficient, Irregular-Extended & Running deprecation', () => {
    // Irregular (T-13.33..35)
    expect(analyzeRatios(110, 105).subtype).toBe('IRREGULAR');
    expect(analyzeRatios(100, 100).isBorderline100).toBe(true);
    const t35 = analyzeRatios(138.2, 110);
    expect(t35.subtype).toBe('IRREGULAR');
    expect(t35.isBorderline1382).toBe(true);

    // Irregular-Deficient (T-13.36..38)
    expect(analyzeRatios(110, 70).subtype).toBe('IRREGULAR_DEFICIENT');
    const t37 = analyzeRatios(100, 61.8);
    expect(t37.isBorderline100).toBe(true);
    expect(t37.isBorderlineC618).toBe(true);
    const t38 = analyzeRatios(138.2, 81);
    expect(t38.isBorderline1382).toBe(true);
    expect(t38.isBorderline81).toBe(true);

    // Irregular-Extended (T-13.39..41)
    expect(analyzeRatios(150, 120).subtype).toBe('IRREGULAR_EXTENDED');
    expect(analyzeRatios(138.2, 100).isBorderline1382).toBe(true);
    const t41 = analyzeRatios(200, 150);
    expect(t41.subtype).toBe('IRREGULAR_EXTENDED');
    expect(t41.isSevereIrregularExtended).toBe(true);

    // Running (T-13.42..44 + non-Running B=95, C=50)
    const t42 = analyzeRatios(110, 50);
    expect(t42.subtype).toBe('RUNNING_DEPRECATED');
    expect(t42.isSevereRunning).toBe(false);

    const t43 = analyzeRatios(120, 40);
    expect(t43.subtype).toBe('RUNNING_DEPRECATED');
    expect(t43.isSevereRunning).toBe(true);

    const t44 = analyzeRatios(105, 60);
    expect(t44.subtype).toBe('RUNNING_DEPRECATED');
    expect(t44.isBorderlineC618).toBe(true);

    expect(analyzeRatios(95, 50).subtype).toBe('C_DEFICIENT');
  });

  it('۱۳-۱۴..۱۳-۱۶ (T-13.45..53): Wave 4 Knot-Untangler, Simple Counting & Practical Irregular W4 Example', () => {
    // T-13.45..47: Wave 4 knot-untangler (PatternEngines + RulesEngine)
    expect(
      PatternEngines.evaluateWave4FlatKnotUntangler({ wave4SubwaveCount: 3, hasCountingDeadEnd: false }).action
    ).toBe('NO_FLAT_NEEDED');
    expect(
      PatternEngines.evaluateWave4FlatKnotUntangler({ wave4SubwaveCount: 5, hasCountingDeadEnd: true }).action
    ).toBe('USE_FLAT_KNOT_UNTANGLER');
    expect(
      PatternEngines.evaluateWave4FlatKnotUntangler({ wave4SubwaveCount: 5, hasCountingDeadEnd: false }).action
    ).toBe('WAIT_COUNT_MAY_BE_WRONG');

    const reT45 = RulesEngine.evaluateWave4FlatKnotUntangler({ wave4SubwaveCount: 3, hasCountingDeadEnd: false });
    expect(reT45.action).toBe('NO_FLAT_NEEDED');
    expect(reT45.useFlat).toBe(false);

    const reT46 = RulesEngine.evaluateWave4FlatKnotUntangler({ wave4SubwaveCount: 7, hasCountingDeadEnd: true });
    expect(reT46.action).toBe('USE_FLAT_KNOT_UNTANGLER');
    expect(reT46.useFlat).toBe(true);
    expect(reT46.rule.ruleId).toBe('WAVE4_FLAT_KNOT_UNTANGLER');

    const reT47 = RulesEngine.evaluateWave4FlatKnotUntangler({ wave4SubwaveCount: 5, hasCountingDeadEnd: false });
    expect(reT47.action).toBe('WAIT_COUNT_MAY_BE_WRONG');
    expect(reT47.useFlat).toBe(false);
    expect(reT47.rule.passed).toBe(false);

    // T-13.48..50: Simple counting (PatternEngines + RulesEngine)
    expect(
      PatternEngines.evaluateSimpleCountingClassification({ subwaves: [3, 3, 3] }).classification
    ).toBe('SIMPLE_ZIGZAG');
    expect(
      PatternEngines.evaluateSimpleCountingClassification({ subwaves: [3, 3, 5] }).classification
    ).toBe('FLAT');
    expect(
      PatternEngines.evaluateSimpleCountingClassification({ subwaves: [3, 3, 5], isComplexWaveC: true }).classification
    ).toBe('COMPLEX_COMBINATION');
    expect(
      PatternEngines.evaluateSimpleCountingClassification({ subwaves: [3, 3, 7] }).classification
    ).toBe('COMPLEX_COMBINATION');

    const sc48 = RulesEngine.evaluateSimpleCountingClassification({ subwaves: [3, 3, 3] });
    expect(sc48.classification).toBe('SIMPLE_ZIGZAG');
    expect(sc48.priorityStep).toBe(1);

    const sc49 = RulesEngine.evaluateSimpleCountingClassification({ subwaves: [3, 3, 5] });
    expect(sc49.classification).toBe('FLAT');
    expect(sc49.priorityStep).toBe(2);

    const sc50 = RulesEngine.evaluateSimpleCountingClassification({ subwaves: [3, 3, 5], isComplexWaveC: true });
    expect(sc50.classification).toBe('COMPLEX_COMBINATION');
    expect(sc50.priorityStep).toBe(3);

    const sc50b = RulesEngine.evaluateSimpleCountingClassification({ subwaves: [3, 3, 7] });
    expect(sc50b.classification).toBe('COMPLEX_COMBINATION');
    expect(sc50b.priorityStep).toBe(3);

    // T-13.51..53: Practical W4 Irregular Flat example (PatternEngines + RulesEngine)
    expect(
      PatternEngines.evaluatePracticalWave4Flat({ w4Pattern: 'STANDARD_ZIGZAG' }).decision
    ).toBe('DIRECT_ZIGZAG');
    expect(
      PatternEngines.evaluatePracticalWave4Flat({ w4Pattern: 'IRREGULAR_FLAT' }).decision
    ).toBe('COUNT_WITH_IRREGULAR_FLAT');
    expect(
      PatternEngines.evaluatePracticalWave4Flat({ w4Pattern: 'DOUBLE_DEFICIENT_FLAT' }).decision
    ).toBe('COUNT_WITH_COMBINATION');

    const w51 = RulesEngine.evaluatePracticalWave4Flat({ w4Pattern: 'STANDARD_ZIGZAG' });
    expect(w51.decision).toBe('DIRECT_ZIGZAG');
    expect(w51.rule.canBeSolvedByAlternate).toBe('ZIGZAG');

    const w52 = RulesEngine.evaluatePracticalWave4Flat({
      w4Pattern: 'IRREGULAR_FLAT',
      bPctOfA: 112,
      cPctOfB: 92,
      subwaves: [3, 3, 5]
    });
    expect(w52.decision).toBe('COUNT_WITH_IRREGULAR_FLAT');
    expect(w52.practicalStepsOk).toBe(true);
    expect(w52.rule.canBeSolvedByAlternate).toBe('FLAT_EXPANDED');

    const w53 = RulesEngine.evaluatePracticalWave4Flat({ w4Pattern: 'DOUBLE_DEFICIENT_FLAT' });
    expect(w53.decision).toBe('COUNT_WITH_COMBINATION');
    expect(w53.rule.canBeSolvedByAlternate).toBe('COMPLEX_COMBINATION');
  });

  it('RulesEngine.FlatPatternValidator detects & labels all 8 Session 13 Flat sub-types and Running exclusion', () => {
    const makeVerts = (bPct: number, cPct?: number): WaveVertex[] => {
      const p0 = 200;
      const p1 = 100; // lenA = 100
      const p2 = p1 + bPct;
      const base: WaveVertex[] = [
        { label: '0', candleIndex: 0, price: p0, timestamp: '2026-01-01', isConfirmed: true },
        { label: 'A', candleIndex: 4, price: p1, timestamp: '2026-01-05', isConfirmed: true },
        { label: 'B', candleIndex: 8, price: p2, timestamp: '2026-01-09', isConfirmed: true }
      ];
      if (cPct !== undefined) {
        const p3 = p2 - (bPct * cPct) / 100;
        base.push({ label: 'C', candleIndex: 13, price: p3, timestamp: '2026-01-14', isConfirmed: true });
      }
      return base;
    };

    const cases: Array<{ b: number; c: number; expectedSubtype: string; expectedEn: string; excluded: boolean }> = [
      { b: 90, c: 90, expectedSubtype: 'REGULAR', expectedEn: 'Regular', excluded: false },              // T-13.7
      { b: 70, c: 90, expectedSubtype: 'B_DEFICIENT', expectedEn: 'B-Deficient', excluded: false },      // T-13.8
      { b: 90, c: 70, expectedSubtype: 'C_DEFICIENT', expectedEn: 'C-Deficient', excluded: false },      // T-13.9
      { b: 70, c: 70, expectedSubtype: 'DOUBLE_DEFICIENT', expectedEn: 'Double-Deficient', excluded: false }, // T-13.10
      { b: 110, c: 100, expectedSubtype: 'IRREGULAR', expectedEn: 'Irregular', excluded: false },        // T-13.11
      { b: 110, c: 70, expectedSubtype: 'IRREGULAR_DEFICIENT', expectedEn: 'Irregular-Deficient', excluded: false }, // T-13.12
      { b: 150, c: 120, expectedSubtype: 'IRREGULAR_EXTENDED', expectedEn: 'Irregular-Extended', excluded: false },  // T-13.13
      { b: 110, c: 50, expectedSubtype: 'RUNNING_DEPRECATED', expectedEn: 'Running', excluded: true }    // T-13.14
    ];

    for (const tc of cases) {
      const res = RulesEngine.FlatPatternValidator('ZIGZAG', makeVerts(tc.b, tc.c), 'BULLISH', undefined, [3, 3, 5]);
      expect(res.isPotentialFlat).toBe(true);
      expect(res.subtype).toBe(tc.expectedSubtype);
      expect(res.subtypeLabelEn).toBe(tc.expectedEn);
      expect(res.flag?.subtype).toBe(tc.expectedSubtype);
      expect(res.flag?.subtypeLabelEn).toBe(tc.expectedEn);
      expect(res.isRunningExcluded).toBe(tc.excluded);
      expect(res.flag?.isRunningExcluded).toBe(tc.excluded);
      expect(res.rule?.ruleId).toBe('FlatPatternValidator');
    }

    // §2.3 boundary notes check on B=138.2% and B=81% / C=81%
    const b1382 = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(138.2, 100), 'BULLISH', undefined, [3, 3, 5]);
    expect(b1382.subtype).toBe('IRREGULAR');
    expect(b1382.flag?.borderlineNotesFa?.some(n => n.includes('۱۳۸.۲٪'))).toBe(true);

    const b81c81 = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(81, 81), 'BULLISH', undefined, [3, 3, 5]);
    expect(b81c81.subtype).toBe('REGULAR');
    expect(b81c81.flag?.borderlineNotesFa?.some(n => n.includes('B=۸۱٪'))).toBe(true);
    expect(b81c81.flag?.borderlineNotesFa?.some(n => n.includes('C=۸۱٪'))).toBe(true);

    // 3-vertex Irregular vs Irregular-Extended B/A > 138.2% distinction
    const irreg3 = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(125), 'BULLISH', undefined, [3, 3, 5]);
    expect(irreg3.subtype).toBe('IRREGULAR');
    expect(irreg3.subtypeLabelEn).toBe('Irregular');

    const irregExt3 = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(145), 'BULLISH', undefined, [3, 3, 5]);
    expect(irregExt3.subtype).toBe('IRREGULAR_EXTENDED');
    expect(irregExt3.subtypeLabelEn).toBe('Irregular-Extended');

    // Dedicated Running Flat exclusion helper (single + batch)
    const runHelper = RulesEngine.identifyRunningFlatForExclusion({ bRetracePct: 115, cPctOfB: 50, hasCVertex: true });
    expect(runHelper.isRunningFlat).toBe(true);
    expect(runHelper.shouldExclude).toBe(true);
    expect(runHelper.isSevereRunning).toBe(false);

    const severeRunHelper = RulesEngine.identifyRunningFlatForExclusion({ bRetracePct: 120, cPctOfB: 35, hasCVertex: true });
    expect(severeRunHelper.shouldExclude).toBe(true);
    expect(severeRunHelper.isSevereRunning).toBe(true);

    const nonRunIrreg = RulesEngine.identifyRunningFlatForExclusion({ bRetracePct: 115, cPctOfB: 90, hasCVertex: true });
    expect(nonRunIrreg.isRunningFlat).toBe(false);
    expect(nonRunIrreg.shouldExclude).toBe(false);

    const nonRunCDef = RulesEngine.identifyRunningFlatForExclusion({ bRetracePct: 90, cPctOfB: 50, hasCVertex: true });
    expect(nonRunCDef.isRunningFlat).toBe(false);
    expect(nonRunCDef.shouldExclude).toBe(false);

    const regScenario = makeFlatScenario([200, 100, 190, 109], { patternType: 'FLAT_REGULAR' });
    const runScenario = makeFlatScenario([200, 100, 215, 160], { patternType: 'FLAT_RUNNING' });
    const irregScenario = makeFlatScenario([200, 100, 210, 105], { patternType: 'FLAT_EXPANDED' });
    const cDefScenario = makeFlatScenario([200, 100, 195, 147], { patternType: 'FLAT_REGULAR' });
    expect(isExcludedFlat(runScenario)).toBe(true);
    expect(RulesEngine.isExcludedFlat(runScenario)).toBe(true);
    expect(isExcludedFlat(regScenario)).toBe(false);
    expect(isExcludedFlat(irregScenario)).toBe(false);
    expect(isExcludedFlat(cDefScenario)).toBe(false);
    const batchFiltered = RulesEngine.excludeRunningFlats([regScenario, runScenario]);
    expect(batchFiltered.retained).toHaveLength(1);
    expect(batchFiltered.retained[0].patternType).toBe('FLAT_REGULAR');
    expect(batchFiltered.excluded).toHaveLength(1);
    expect(batchFiltered.excluded[0].scenario.patternType).toBe('FLAT_RUNNING');

    // §2.4 (T-13.15..17 + 3-5-5): All 8 Flat types strictly require 3-3-5; 5-3-5 / 3-3-3 / 3-5-5 are rejected on FlatPatternValidator
    const v535 = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(90, 90), 'BULLISH', undefined, [5, 3, 5]);
    expect(v535.isPotentialFlat).toBe(false);
    expect(v535.flag?.nonFlatStructureKind).toBe('IDEAL_ZIGZAG');
    expect(v535.rule?.passed).toBe(false);
    expect(v535.rule?.canBeSolvedByAlternate).toBe('ZIGZAG');

    const v333 = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(90, 90), 'BULLISH', undefined, [3, 3, 3]);
    expect(v333.isPotentialFlat).toBe(false);
    expect(v333.flag?.nonFlatStructureKind).toBe('SIMPLE_ZIGZAG');
    expect(v333.rule?.passed).toBe(false);
    expect(v333.rule?.canBeSolvedByAlternate).toBe('ZIGZAG');

    const v355 = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(90, 90), 'BULLISH', undefined, [3, 5, 5]);
    expect(v355.isPotentialFlat).toBe(false);
    expect(v355.flag?.nonFlatStructureKind).toBe('ANTI_ZIGZAG');
    expect(v355.rule?.passed).toBe(false);

    // §2.5 (T-13.18..20): B > 61.8% mandatory across all 8 Flats in FlatPatternValidator
    const vB62 = RulesEngine.FlatPatternValidator('ZIGZAG', makeVerts(62, 90), 'BULLISH', undefined, [3, 3, 5]);
    expect(vB62.isPotentialFlat).toBe(true);
    expect(vB62.subtype).toBe('B_DEFICIENT');

    const vB61 = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(61, 90), 'BULLISH', undefined, [3, 3, 5]);
    expect(vB61.isPotentialFlat).toBe(false);
    expect(vB61.rule?.canBeSolvedByAlternate).toBe('ZIGZAG');

    const vB618 = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(61.8, 90), 'BULLISH', undefined, [3, 3, 5]);
    expect(vB618.isPotentialFlat).toBe(false);
    expect(vB618.flag?.borderlineNotesFa?.some(n => n.includes('۶۱.۸٪'))).toBe(true);

    // §2.6 (T-13.21..23): Regular Flat 81-100% boundaries on FlatPatternValidator
    const regStd = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(90, 90), 'BULLISH', undefined, [3, 3, 5]);
    expect(regStd.subtype).toBe('REGULAR');
    expect(regStd.flag?.borderlineNotesFa).toBeUndefined();

    const regLower = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(81, 81), 'BULLISH', undefined, [3, 3, 5]);
    expect(regLower.subtype).toBe('REGULAR');
    expect(regLower.flag?.borderlineNotesFa?.some(n => n.includes('B=۸۱٪'))).toBe(true);
    expect(regLower.flag?.borderlineNotesFa?.some(n => n.includes('C=۸۱٪'))).toBe(true);

    const regUpper = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(100, 100), 'BULLISH', undefined, [3, 3, 5]);
    expect(regUpper.subtype).toBe('REGULAR');
    expect(regUpper.flag?.borderlineNotesFa?.some(n => n.includes('B=۱۰۰٪'))).toBe(true);
    expect(regUpper.flag?.borderlineNotesFa?.some(n => n.includes('C=۱۰۰٪'))).toBe(true);

    // §2.7 (T-13.24..26): B-Deficient 61.8-81% boundaries on FlatPatternValidator
    const bDefStd = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(70, 90), 'BULLISH', undefined, [3, 3, 5]);
    expect(bDefStd.subtype).toBe('B_DEFICIENT');
    expect(bDefStd.isPotentialFlat).toBe(true);

    const bDefLower = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(61.8, 81), 'BULLISH', undefined, [3, 3, 5]);
    expect(bDefLower.subtype).toBe('B_DEFICIENT');
    expect(bDefLower.flag?.borderlineNotesFa?.some(n => n.includes('۶۱.۸٪'))).toBe(true);
    expect(bDefLower.flag?.borderlineNotesFa?.some(n => n.includes('C=۸۱٪'))).toBe(true);

    const bDefUpper = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(81, 100), 'BULLISH', undefined, [3, 3, 5]);
    expect(bDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('B=۸۱٪'))).toBe(true);
    expect(bDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('C=۱۰۰٪'))).toBe(true);

    // §2.8 (T-13.27..29): C-Deficient 61.8-81% boundaries on FlatPatternValidator
    const cDefStd = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(90, 70), 'BULLISH', undefined, [3, 3, 5]);
    expect(cDefStd.subtype).toBe('C_DEFICIENT');
    expect(cDefStd.isPotentialFlat).toBe(true);

    const cDefLower = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(81, 61.8), 'BULLISH', undefined, [3, 3, 5]);
    expect(cDefLower.subtype).toBe('C_DEFICIENT');
    expect(cDefLower.flag?.borderlineNotesFa?.some(n => n.includes('B=۸۱٪'))).toBe(true);
    expect(cDefLower.flag?.borderlineNotesFa?.some(n => n.includes('C=۶۱.۸٪'))).toBe(true);

    const cDefUpper = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(100, 81), 'BULLISH', undefined, [3, 3, 5]);
    expect(cDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('B=۱۰۰٪'))).toBe(true);
    expect(cDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('C=۸۱٪'))).toBe(true);

    // §2.9 (T-13.30..32): Double-Deficient 61.8-81% boundaries on FlatPatternValidator + market-end prohibition
    const dblDefStd = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(70, 70), 'BULLISH', undefined, [3, 3, 5]);
    expect(dblDefStd.subtype).toBe('DOUBLE_DEFICIENT');
    expect(dblDefStd.isPotentialFlat).toBe(true);

    const dblDefLower = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(61.8, 61.8), 'BULLISH', undefined, [3, 3, 5]);
    expect(dblDefLower.subtype).toBe('DOUBLE_DEFICIENT');
    expect(dblDefLower.flag?.borderlineNotesFa?.some(n => n.includes('B=۶۱.۸٪'))).toBe(true);
    expect(dblDefLower.flag?.borderlineNotesFa?.some(n => n.includes('C=۶۱.۸٪'))).toBe(true);

    const dblDefUpper = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(81, 81), 'BULLISH', undefined, [3, 3, 5]);
    expect(dblDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('B=۸۱٪'))).toBe(true);
    expect(dblDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('C=۸۱٪'))).toBe(true);

    const dblAtEnd = analyzeRatios(70, 70, { isMarketEnd: true, hasConfirmation: true });
    expect(dblAtEnd.usableAtCurrentContext).toBe(false);
    expect(dblAtEnd.tradingPolicyAction).toBe('FORBID_AT_MARKET_END');

    // §2.10 (T-13.33..35): Irregular Flat (100 < B <= 138.2%, C > 100%) on FlatPatternValidator
    const irregStd = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(110, 105), 'BULLISH', undefined, [3, 3, 5]);
    expect(irregStd.subtype).toBe('IRREGULAR');
    expect(irregStd.flag?.macroCategory).toBe('IRREGULAR');
    expect(irregStd.isPotentialFlat).toBe(true);

    const irregLower = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(100, 100), 'BULLISH', undefined, [3, 3, 5]);
    expect(irregLower.flag?.borderlineNotesFa?.some(n => n.includes('B=۱۰۰٪'))).toBe(true);
    expect(irregLower.flag?.borderlineNotesFa?.some(n => n.includes('C=۱۰۰٪'))).toBe(true);

    const irregUpper = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(138.2, 110), 'BULLISH', undefined, [3, 3, 5]);
    expect(irregUpper.subtype).toBe('IRREGULAR');
    expect(irregUpper.flag?.borderlineNotesFa?.some(n => n.includes('۱۳۸.۲٪'))).toBe(true);

    // §2.11 (T-13.36..38): Irregular-Deficient Flat (100 < B <= 138.2%, 61.8 <= C < 81%) on FlatPatternValidator
    const irregDefStd = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(110, 70), 'BULLISH', undefined, [3, 3, 5]);
    expect(irregDefStd.subtype).toBe('IRREGULAR_DEFICIENT');
    expect(irregDefStd.subtypeLabelEn).toBe('Irregular-Deficient');
    expect(irregDefStd.flag?.macroCategory).toBe('IRREGULAR');
    expect(irregDefStd.isPotentialFlat).toBe(true);
    expect(irregDefStd.isRunningExcluded).toBe(false);

    const irregDefLower = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(100, 61.8), 'BULLISH', undefined, [3, 3, 5]);
    expect(irregDefLower.isPotentialFlat).toBe(true);
    expect(irregDefLower.flag?.borderlineNotesFa?.some(n => n.includes('B=۱۰۰٪'))).toBe(true);
    expect(irregDefLower.flag?.borderlineNotesFa?.some(n => n.includes('C=۶۱.۸٪'))).toBe(true);

    const irregDefUpper = RulesEngine.FlatPatternValidator('FLAT_EXPANDED', makeVerts(138.2, 81), 'BULLISH', undefined, [3, 3, 5]);
    expect(irregDefUpper.isPotentialFlat).toBe(true);
    expect(irregDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('B=۱۳۸.۲٪'))).toBe(true);
    expect(irregDefUpper.flag?.borderlineNotesFa?.some(n => n.includes('C=۸۱٪'))).toBe(true);

    // §2.13 (T-13.42..44 + non-Running B=95, C=50): Running Flat exclusion on FlatPatternValidator
    const runStd = RulesEngine.FlatPatternValidator('FLAT_RUNNING', makeVerts(110, 50), 'BULLISH', undefined, [3, 3, 5]);
    expect(runStd.subtype).toBe('RUNNING_DEPRECATED');
    expect(runStd.isRunningExcluded).toBe(true);
    expect(runStd.isSevereRunning).toBe(false);
    expect(runStd.rule?.passed).toBe(false);

    const runSevere = RulesEngine.FlatPatternValidator('FLAT_RUNNING', makeVerts(120, 40), 'BULLISH', undefined, [3, 3, 5]);
    expect(runSevere.subtype).toBe('RUNNING_DEPRECATED');
    expect(runSevere.isRunningExcluded).toBe(true);
    expect(runSevere.isSevereRunning).toBe(true);
    expect(runSevere.rule?.passed).toBe(false);

    const runBorder = RulesEngine.FlatPatternValidator('FLAT_RUNNING', makeVerts(105, 60), 'BULLISH', undefined, [3, 3, 5]);
    expect(runBorder.subtype).toBe('RUNNING_DEPRECATED');
    expect(runBorder.isRunningExcluded).toBe(true);
    expect(runBorder.flag?.borderlineNotesFa?.some(n => n.includes('C=۶۱.۸٪'))).toBe(true);

    const nonRunningCDef = RulesEngine.FlatPatternValidator('FLAT_REGULAR', makeVerts(95, 50), 'BULLISH', undefined, [3, 3, 5]);
    expect(nonRunningCDef.subtype).toBe('C_DEFICIENT');
    expect(nonRunningCDef.isRunningExcluded).toBe(false);
  });

  it('RulesEngine.MarketTerminalValidator flags Flat scenarios near current market end and allows past-market knot untangling', () => {
    const candles40 = makeCandles(40);
    const makeVertsAt = (indices: [number, number, number, number]): WaveVertex[] => [
      { label: '0', candleIndex: indices[0], price: 200, timestamp: candles40[indices[0]].timestamp, isConfirmed: true },
      { label: 'A', candleIndex: indices[1], price: 100, timestamp: candles40[indices[1]].timestamp, isConfirmed: true },
      { label: 'B', candleIndex: indices[2], price: 190, timestamp: candles40[indices[2]].timestamp, isConfirmed: true },
      { label: 'C', candleIndex: indices[3], price: 105, timestamp: candles40[indices[3]].timestamp, isConfirmed: true }
    ];

    // 1) Flat ending at candle 38 of 40 (distance 1 <= 5) -> flagged as market end warning
    const terminalSummary = RulesEngine.validateStructure(
      'FLAT_REGULAR',
      makeVertsAt([18, 24, 31, 38]),
      'BULLISH',
      'ROOT',
      '',
      candles40,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(terminalSummary.marketTerminalFlag?.isFlatAtMarketEnd).toBe(true);
    expect(terminalSummary.marketTerminalFlag?.distanceFromEndCandles).toBe(1);
    expect(terminalSummary.marketTerminalFlag?.warningLabelFa).toContain('نباید در فاز پایانی');
    const termRule = terminalSummary.rules.find(r => r.ruleId === 'MarketTerminalValidator');
    expect(termRule).toBeDefined();
    expect(termRule?.passed).toBe(false);

    // 2) Zigzag with 3-3-5 & B=90% flagged as Flat near market end -> also flagged by MarketTerminalValidator
    const flaggedZigzagTerminal = RulesEngine.validateStructure(
      'ZIGZAG',
      makeVertsAt([18, 24, 31, 37]),
      'BULLISH',
      'ROOT',
      '',
      candles40,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(flaggedZigzagTerminal.flatPatternFlag?.isFlaggedFlat).toBe(true);
    expect(flaggedZigzagTerminal.marketTerminalFlag?.isFlatAtMarketEnd).toBe(true);

    // 3) Flat in past market (terminal vertex at index 16 of 40) -> NOT at market end, allowed for past knot untangling
    const pastMarketSummary = RulesEngine.validateStructure(
      'FLAT_REGULAR',
      makeVertsAt([2, 6, 11, 16]),
      'BULLISH',
      'ROOT',
      '',
      candles40,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(pastMarketSummary.marketTerminalFlag?.isFlatAtMarketEnd).toBe(false);
    expect(pastMarketSummary.marketTerminalFlag?.countingPriorityNoteFa).toContain('زیگزاگ');
    expect(pastMarketSummary.rules.find(r => r.ruleId === 'MarketTerminalValidator')?.passed).toBe(true);

    // 4) Non-Flat Zigzag (5-3-5) near chart end -> MarketTerminalValidator does NOT trigger
    const normalZigzagEnd = RulesEngine.validateStructure(
      'ZIGZAG',
      makeVertsAt([18, 24, 31, 39]),
      'BULLISH',
      'ROOT',
      '',
      candles40,
      { internalSubwaves: [5, 3, 5] }
    );
    expect(normalZigzagEnd.marketTerminalFlag).toBeUndefined();
    expect(normalZigzagEnd.rules.some(r => r.ruleId === 'MarketTerminalValidator')).toBe(false);

    // 5) Direct scenario overload injects & clears scenario.marketPhaseWarning + scenario.marketTerminalWarning metadata (within last 10 candles)
    const endScenario = makeFlatScenario([200, 100, 190, 105], {
      patternType: 'FLAT_REGULAR',
      candleIndices: [18, 24, 31, 38]
    });
    const injectedRes = RulesEngine.MarketTerminalValidator(endScenario, candles40);
    expect(injectedRes.isFlatAtMarketEnd).toBe(true);
    expect(endScenario.marketPhaseWarning).toBe(true);
    expect(endScenario.metadata?.marketPhaseWarning).toBe(true);
    expect(endScenario.marketTerminalWarning?.isFlatAtMarketEnd).toBe(true);
    expect(endScenario.marketTerminalWarning?.code).toBe('FLAT_AT_MARKET_END');
    expect(endScenario.marketTerminalWarning?.distanceFromEndCandles).toBe(1);
    expect(endScenario.marketTerminalWarning?.warningLabelFa).toContain('فاز پایانی');

    // Exact 10-candle boundary: 40 candles -> last 10 candles start at index 30 (distance 9 <= 9)
    const boundaryInside10 = makeFlatScenario([200, 100, 190, 105], {
      patternType: 'FLAT_REGULAR',
      candleIndices: [12, 18, 24, 30]
    });
    expect(RulesEngine.MarketTerminalValidator(boundaryInside10, candles40).isFlatAtMarketEnd).toBe(true);
    expect(boundaryInside10.marketPhaseWarning).toBe(true);

    const boundaryOutside10 = makeFlatScenario([200, 100, 190, 105], {
      patternType: 'FLAT_REGULAR',
      candleIndices: [11, 17, 23, 29]
    });
    expect(RulesEngine.MarketTerminalValidator(boundaryOutside10, candles40).isFlatAtMarketEnd).toBe(false);
    expect(boundaryOutside10.marketPhaseWarning).toBeUndefined();

    const pastScenario = makeFlatScenario([200, 100, 190, 105], {
      patternType: 'FLAT_REGULAR',
      candleIndices: [2, 6, 11, 16]
    });
    pastScenario.marketPhaseWarning = true;
    pastScenario.marketTerminalWarning = endScenario.marketTerminalWarning;
    pastScenario.metadata = { marketPhaseWarning: true, marketTerminalWarning: endScenario.marketTerminalWarning };
    const clearedRes = RulesEngine.MarketTerminalValidator(pastScenario, candles40);
    expect(clearedRes.isFlatAtMarketEnd).toBe(false);
    expect(pastScenario.marketPhaseWarning).toBeUndefined();
    expect(pastScenario.metadata?.marketPhaseWarning).toBeUndefined();
    expect(pastScenario.marketTerminalWarning).toBeUndefined();
  });
});
