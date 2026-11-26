import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { SUPPORTED_ASSETS, generateRealisticCandles } from '../src/data/sampleMarketData';

describe('Session 17 Advanced Complex Patterns & SDD 016 (T-17.1..T-17.43)', () => {
  it('Contract (CLI JSON in/out): processes 016-complex-patterns-advanced-engine requests deterministically', () => {
    const stdReq = JSON.stringify({
      action: 'detect_standard',
      payload: { signature: 'Z-X-F' }
    });
    const stdRes = JSON.parse(PatternEngines.runSession17ComplexCli(stdReq));
    expect(stdRes.status).toBe('ok');
    expect(stdRes.feature).toBe('016-complex-patterns-advanced-engine');
    expect(stdRes.result.isStandard).toBe(true);
    expect(stdRes.result.signature).toBe('Z-X-F');

    const nonStdReq = JSON.stringify({
      action: 'detect_nonstd',
      payload: { signature: 'Z-X-F-X-Z' }
    });
    const nonStdRes = JSON.parse(PatternEngines.runSession17ComplexCli(nonStdReq));
    expect(nonStdRes.status).toBe('ok');
    expect(nonStdRes.result.isStandard).toBe(false);
    expect(nonStdRes.result.combinationTier).toBe('NON_STANDARD_3');

    const xReq = JSON.stringify({
      action: 'evaluate_x_wave',
      payload: { kind: 'SINGLE', candleCount: 3, direction: 'BULLISH' }
    });
    const xRes = JSON.parse(PatternEngines.runSession17ComplexCli(xReq));
    expect(xRes.status).toBe('ok');
    expect(xRes.result.isValid).toBe(true);
    expect(xRes.result.xWaveType).toBe('SINGLE');

    const recReq = JSON.stringify({
      action: 'recommend',
      payload: { simpleZPossible: true, standardZXZPossible: true }
    });
    const recRes = JSON.parse(PatternEngines.runSession17ComplexCli(recReq));
    expect(recRes.status).toBe('ok');
    expect(recRes.result.selectedCount).toBe('Z');
  });

  it('۱۷-۱ (T-17.1..4): Classifies the 9 standard corrective combinations and flags Z-X-Z-X-Z non-standard', () => {
    // T-17.1: Z-X-Z -> Standard & Common
    const t1 = PatternEngines.evaluateComplexCombinationSignature('Z-X-Z');
    expect(t1.isStandard).toBe(true);
    expect(t1.rarityTier17).toBe('COMMON');

    // T-17.2: F-X-F -> Standard & Rarer
    const t2 = PatternEngines.evaluateComplexCombinationSignature('F-X-F');
    expect(t2.isStandard).toBe(true);
    expect(t2.rarityTier17).toBe('RARE');

    // T-17.3: T-X-T -> Standard & Rarest
    const t3 = PatternEngines.evaluateComplexCombinationSignature('T-X-T');
    expect(t3.isStandard).toBe(true);
    expect(t3.rarityTier17).toBe('RAREST');

    // T-17.4: Z-X-Z-X-Z -> Non-Standard (3 patterns)
    const t4 = PatternEngines.evaluateComplexCombinationSignature('Z-X-Z-X-Z');
    expect(t4.isStandard).toBe(false);
    expect(t4.combinationTier).toBe('NON_STANDARD_3');
  });

  it('۱۷-۲ (T-17.5..7): Evaluates main-pattern combinations I-X-Z, G-X-F, and I-X-I', () => {
    // T-17.5: I-X-Z -> Common / Most Common
    const t5 = PatternEngines.evaluateComplexCombinationSignature('I-X-Z');
    expect(t5.isStandard).toBe(true);
    expect(t5.combinationCategory).toBe('MAIN_INCLUDED');
    expect(t5.rarityTier17).toBe('MOST_COMMON');

    // T-17.6: G-X-F -> Less common
    const t6 = PatternEngines.evaluateComplexCombinationSignature('G-X-F');
    expect(t6.isStandard).toBe(true);
    expect(t6.combinationCategory).toBe('MAIN_INCLUDED');
    expect(t6.rarityTier17).toBe('LESS_COMMON');

    // T-17.7: I-X-I -> Very Rare & T_TERM-X-T_TRI -> Rare
    const t7 = PatternEngines.evaluateComplexCombinationSignature('I-X-I');
    expect(t7.isStandard).toBe(true);
    expect(t7.combinationCategory).toBe('MAIN_INCLUDED');
    expect(t7.rarityTier17).toBe('VERY_RARE');

    const termTri = PatternEngines.evaluateComplexCombinationSignature('T_TERM-X-T_TRI');
    expect(termTri.isStandard).toBe(true);
    expect(termTri.combinationCategory).toBe('MAIN_INCLUDED');
    expect(termTri.rarityTier17).toBe('RARE');
  });

  it('۱۷-۳ (T-17.8..10): Validates single-leg X-Wave (>= 3 candles simplest) and rejects 2 candles', () => {
    // T-17.8: 3 candles (Bullish/Bearish) -> Valid SINGLE
    const t8Bull = PatternEngines.evaluateXWave({ kind: 'SINGLE', candleCount: 3, direction: 'BULLISH' });
    expect(t8Bull.isValid).toBe(true);
    expect(t8Bull.xWaveType).toBe('SINGLE');
    expect(t8Bull.xWaveRarity).toBe('SIMPLEST');

    const t8Bear = PatternEngines.evaluateXWave({ kind: 'SINGLE', candleCount: 3, direction: 'BEARISH' });
    expect(t8Bear.isValid).toBe(true);
    expect(t8Bear.xWaveType).toBe('SINGLE');

    // T-17.9: 2 candles -> Invalid
    const t9 = PatternEngines.evaluateXWave({ kind: 'SINGLE', candleCount: 2 });
    expect(t9.isValid).toBe(false);
    expect(t9.xWaveType).toBe('INVALID');

    // T-17.10: 5 candles single wave -> Valid SINGLE
    const t10 = PatternEngines.evaluateXWave({ kind: 'SINGLE', candleCount: 5 });
    expect(t10.isValid).toBe(true);
    expect(t10.xWaveType).toBe('SINGLE');
  });

  it('۱۷-۴ (T-17.11..13): Validates Zigzag X-Wave subtypes (5-3-5 Ideal, 3-3-3 Simple, 3-5-5 Anti-A)', () => {
    // T-17.11: Ideal Zigzag 5-3-5
    const t11 = PatternEngines.evaluateXWave({
      kind: 'ZIGZAG',
      candleCount: 11,
      subwaveSignature: '5-3-5'
    });
    expect(t11.isValid).toBe(true);
    expect(t11.xWaveType).toBe('ZIGZAG_IDEAL');
    expect(t11.xWaveSubType).toBe('ZIGZAG_IDEAL_535');

    // T-17.12: Simple Zigzag 3-3-3
    const t12 = PatternEngines.evaluateXWave({
      kind: 'ZIGZAG',
      candleCount: 7,
      subwaveSignature: '3-3-3'
    });
    expect(t12.isValid).toBe(true);
    expect(t12.xWaveType).toBe('ZIGZAG_SIMPLE');
    expect(t12.xWaveSubType).toBe('ZIGZAG_SIMPLE_333');

    // T-17.13: Anti-A Zigzag 3-5-5
    const t13 = PatternEngines.evaluateXWave({
      kind: 'ZIGZAG',
      candleCount: 9,
      subwaveSignature: '3-5-5'
    });
    expect(t13.isValid).toBe(true);
    expect(t13.xWaveSubType).toBe('ZIGZAG_ANTI_355');
  });

  it('۱۷-۵ (T-17.14..16): Evaluates rare Impulsive X-Wave & reclassifies countable 5-wave subwaves to Zigzag', () => {
    // T-17.14: Impulsive in corrective slot -> Valid RAREST
    const t14 = PatternEngines.evaluateXWave({
      kind: 'IMPULSIVE',
      candleCount: 5,
      slotRole: 'CORRECTIVE'
    });
    expect(t14.isValid).toBe(true);
    expect(t14.xWaveType).toBe('IMPULSIVE');
    expect(t14.xWaveRarity).toBe('RAREST');

    // T-17.15: Impulsive in motive/main slot -> Rare
    const t15 = PatternEngines.evaluateXWave({
      kind: 'IMPULSIVE',
      candleCount: 6,
      slotRole: 'MOTIVE'
    });
    expect(t15.isValid).toBe(true);
    expect(t15.xWaveType).toBe('IMPULSIVE');
    expect(t15.xWaveRarity).toBe('RARE');

    // T-17.16: Impulsive with countable 5-wave / 5-3-5 structure -> reclassified as ZIGZAG
    const t16 = PatternEngines.evaluateXWave({
      kind: 'IMPULSIVE',
      candleCount: 12,
      subwaves: [5, 3, 5],
      hasCountableStructure: true
    });
    expect(t16.isValid).toBe(true);
    expect(t16.xWaveType).toBe('ZIGZAG_IDEAL');
    expect(t16.reclassifiedFromImpulsive).toBe(true);
  });

  it('۱۷-۶ تا ۱۷-۱۱ (T-17.17..34): Classifies Z-X-I, F-X-I, T-X-Z, G-X-G, Terminal-Terminal, and I-X-I rarities', () => {
    // T-17.17..19: Z-X-I, I-X-Z, I-X-I
    expect(PatternEngines.evaluateComplexCombinationSignature('Z-X-I').rarityTier17).toBe('COMMON');
    expect(PatternEngines.evaluateComplexCombinationSignature('I-X-Z').rarityTier17).toBe('MOST_COMMON');
    expect(PatternEngines.evaluateComplexCombinationSignature('I-X-I').rarityTier17).toBe('VERY_RARE');

    // T-17.20..22: F-X-I, F-X-Z, F-X-F
    expect(PatternEngines.evaluateComplexCombinationSignature('F-X-I').rarityTier17).toBe('LESS_COMMON');
    expect(PatternEngines.evaluateComplexCombinationSignature('F-X-Z').rarityTier17).toBe('COMMON');
    expect(PatternEngines.evaluateComplexCombinationSignature('F-X-F').rarityTier17).toBe('RARE');

    // T-17.23..25: T-X-Z, T-X-F, T-X-T
    const t23 = PatternEngines.evaluateComplexCombinationSignature('T-X-Z');
    expect(t23.isStandard).toBe(true);
    const t24 = PatternEngines.evaluateComplexCombinationSignature('T-X-F');
    expect(t24.isStandard).toBe(true);
    const t25 = PatternEngines.evaluateComplexCombinationSignature('T-X-T');
    expect(t25.isStandard).toBe(true);
    expect(t25.rarityTier17).toBe('RAREST');

    // T-17.26..28: G-X-G, G-X-Z, G-X-F
    expect(PatternEngines.evaluateComplexCombinationSignature('G-X-G').rarityTier17).toBe('RARE');
    expect(PatternEngines.evaluateComplexCombinationSignature('G-X-Z').rarityTier17).toBe('LESS_COMMON');
    expect(PatternEngines.evaluateComplexCombinationSignature('G-X-F').rarityTier17).toBe('LESS_COMMON');

    // T-17.29..31: Terminal combinations (TERM-X-TERM, TERM-X-Z, TERM-X-F)
    const t29 = PatternEngines.evaluateComplexCombinationSignature('TERM-X-TERM');
    expect(t29.isStandard).toBe(true);
    expect(t29.rarityTier17).toBe('RARE');

    const t30 = PatternEngines.evaluateComplexCombinationSignature('TERM-X-Z');
    expect(t30.isStandard).toBe(true);
    expect(t30.rarityTier17).toBe('LESS_COMMON');

    const t31 = PatternEngines.evaluateComplexCombinationSignature('TERM-X-F');
    expect(t31.isStandard).toBe(true);
    expect(t31.rarityTier17).toBe('RARE');

    // T-17.32..34: I-X-I, I-X-Z, I-X-F
    expect(PatternEngines.evaluateComplexCombinationSignature('I-X-I').rarityTier17).toBe('VERY_RARE');
    expect(PatternEngines.evaluateComplexCombinationSignature('I-X-Z').rarityTier17).toBe('MOST_COMMON');
    expect(PatternEngines.evaluateComplexCombinationSignature('I-X-F').rarityTier17).toBe('RARE');
  });

  it('۱۷-۱۲ (T-17.35..37): Enforces simplest counting even inside complex analysis', () => {
    // T-17.35: Z possible -> pick Z (never Z-X-Z)
    const t35 = PatternEngines.recommendSimpleCountingInComplex({
      simpleZPossible: true,
      standardZXZPossible: true,
      nonStandardChainPossible: true
    });
    expect(t35.selectedCount).toBe('Z');
    expect(t35.isStandard).toBe(true);

    // T-17.36: Z not possible + Z-X-Z possible -> pick Z-X-Z
    const t36 = PatternEngines.recommendSimpleCountingInComplex({
      simpleZPossible: false,
      standardZXZPossible: true
    });
    expect(t36.selectedCount).toBe('Z-X-Z');
    expect(t36.isStandard).toBe(true);

    // T-17.37: Z-X-Z not possible + Z-X-Z-X-Z possible -> simplify toward Z-X-Z
    const t37 = PatternEngines.recommendSimpleCountingInComplex({
      simpleZPossible: false,
      standardZXZPossible: false,
      nonStandardChainPossible: true
    });
    expect(t37.selectedCount).toBe('Z-X-Z');
    expect(t37.simplificationApplied).toBe(true);
  });

  it('۱۷-۱۳ & ۱۷-۱۴ (T-17.38..43): Evaluates Z-X-F-X-Z & Fars (TSE_FARS) practical integration', () => {
    const farsAsset = SUPPORTED_ASSETS.find(a => a.id === 'TSE_FARS');
    expect(farsAsset).toBeDefined();
    const farsCandles = generateRealisticCandles('TSE_FARS', '1D', 120);
    expect(farsCandles.length).toBe(120);

    // T-17.38 & T-17.41: Fars Z-X-Z -> Standard
    const t38 = PatternEngines.evaluateFarsWaveStructure({
      signature: 'Z-X-Z',
      x1Candles: 5,
      cardinalRulesPassed: true
    });
    expect(t38.isValid).toBe(true);
    expect(t38.classification).toBe('STANDARD');

    // T-17.39: Z-X-Z-X-Z -> Non-standard
    const t39 = PatternEngines.evaluateFarsWaveStructure({
      signature: 'Z-X-Z-X-Z',
      x1Candles: 4,
      x2Candles: 4,
      cardinalRulesPassed: true
    });
    expect(t39.isValid).toBe(true);
    expect(t39.classification).toBe('NON_STANDARD');

    // T-17.40 & T-17.42: Fars Z-X-F-X-Z (A=Zigzag, X1, B=Flat, X2, C=Zigzag) -> Non-standard & complexer
    const t40 = PatternEngines.evaluateFarsWaveStructure({
      signature: 'Z-X-F-X-Z',
      x1Candles: 5,
      x2Candles: 6,
      cardinalRulesPassed: true
    });
    expect(t40.isValid).toBe(true);
    expect(t40.classification).toBe('NON_STANDARD');
    expect(t40.legsBreakdown).toHaveLength(5);
    expect(t40.legsBreakdown.map(l => l.code)).toEqual(['Z', 'X1', 'F', 'X2', 'Z']);

    // T-17.43: Fars I-X-Z -> Possible standard main-included
    const t43 = PatternEngines.evaluateFarsWaveStructure({
      signature: 'I-X-Z',
      x1Candles: 5,
      cardinalRulesPassed: true
    });
    expect(t43.isValid).toBe(true);
    expect(t43.classification).toBe('STANDARD');
    expect(t43.signatureEval.combinationCategory).toBe('MAIN_INCLUDED');
  });
});
