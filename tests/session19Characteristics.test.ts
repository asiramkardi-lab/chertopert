import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';

describe('Session 19 Eight Waves Characteristics & Trading Roadmap (T-19.1..T-19.36)', () => {
  it('Contract (CLI JSON in/out): executes 018-eight-waves-characteristics actions deterministically', () => {
    const w3Req = JSON.stringify({
      action: 'evaluate_wave3',
      payload: { wave1Len: 100, wave3Len: 200, wave5Len: 110, subwaveCount: 5 }
    });
    const w3Res = JSON.parse(PatternEngines.runSession19CharacteristicsCli(w3Req));
    expect(w3Res.status).toBe('ok');
    expect(w3Res.feature).toBe('018-eight-waves-characteristics');
    expect(w3Res.result.classification).toBe('EXTENDED');

    const fitReq = JSON.stringify({
      action: 'evaluate_final_fit',
      payload: { connectsWithWaveCounting: false }
    });
    const fitRes = JSON.parse(PatternEngines.runSession19CharacteristicsCli(fitReq));
    expect(fitRes.status).toBe('ok');
    expect(fitRes.result.decision).toBe('STOP_DO_NOT_WASTE_TIME');
  });

  it('۱۹-۱ (T-19.1..3): Evaluates Wave 1 characteristics (weak, rare extension, rare ideal 5-wave)', () => {
    // T-19.1: W1 < W3 & W5 -> weak
    const t1 = PatternEngines.evaluateWave1Characteristics({
      wave1Len: 80,
      wave3Len: 180,
      wave5Len: 110
    });
    expect(t1.classification).toBe('WEAK_STANDARD');
    expect(t1.isWeak).toBe(true);

    // T-19.2: W1 > W3 -> Wave 1 extension (rare)
    const t2 = PatternEngines.evaluateWave1Characteristics({
      wave1Len: 200,
      wave3Len: 120,
      wave5Len: 90
    });
    expect(t2.classification).toBe('EXTENDED_RARE');
    expect(t2.isExtended).toBe(true);

    // T-19.3: Ideal 5-wave internal structure -> possible
    const t3 = PatternEngines.evaluateWave1Characteristics({
      wave1Len: 90,
      wave3Len: 170,
      wave5Len: 110,
      internalStructure: 'IDEAL_5_WAVE'
    });
    expect(t3.classification).toBe('IDEAL_5_POSSIBLE_RARE');
    expect(t3.possible).toBe(true);
  });

  it('۱۹-۲ (T-19.4..6): Evaluates Wave 2 characteristics (Zigzag 61.8% ideal, Flat 78.6%, >100% Anti-Cycle)', () => {
    // T-19.4: Zigzag + 61.8% -> IDEAL
    const t4 = PatternEngines.evaluateWave2Characteristics({ retracePct: 61.8, structureType: 'ZIGZAG' });
    expect(t4.classification).toBe('IDEAL');

    // T-19.5: Flat + 78.6% -> POSSIBLE
    const t5 = PatternEngines.evaluateWave2Characteristics({ retracePct: 78.6, structureType: 'FLAT' });
    expect(t5.classification).toBe('POSSIBLE');

    // Boundary: Triangle -> RARE_20_PCT
    const tTri = PatternEngines.evaluateWave2Characteristics({ retracePct: 50, structureType: 'TRIANGLE' });
    expect(tTri.classification).toBe('RARE_20_PCT');

    // T-19.6: > 100% -> ANTI_CYCLE_VIOLATION
    const t6 = PatternEngines.evaluateWave2Characteristics({ retracePct: 105, structureType: 'ZIGZAG' });
    expect(t6.classification).toBe('ANTI_CYCLE_VIOLATION');
    expect(t6.validImpulseWave2).toBe(false);
  });

  it('۱۹-۳ (T-19.7..9): Evaluates Wave 3 characteristics (Ideal strongest, >161.8% extended, 3-wave error)', () => {
    // T-19.7: W3 > W1 & W5 -> IDEAL
    const t7 = PatternEngines.evaluateWave3Characteristics({
      wave1Len: 100,
      wave3Len: 150,
      wave5Len: 110,
      subwaveCount: 5
    });
    expect(t7.classification).toBe('IDEAL');
    expect(t7.valid).toBe(true);

    // T-19.8: W3 > 161.8% W1 -> EXTENDED
    const t8 = PatternEngines.evaluateWave3Characteristics({
      wave1Len: 100,
      wave3Len: 190,
      wave5Len: 110,
      subwaveCount: 5
    });
    expect(t8.classification).toBe('EXTENDED');
    expect(t8.extended).toBe(true);

    // T-19.9: W3 = 3-wave -> Error
    const t9 = PatternEngines.evaluateWave3Characteristics({
      wave1Len: 100,
      wave3Len: 160,
      wave5Len: 110,
      subwaveCount: 3
    });
    expect(t9.classification).toBe('INVALID_3_WAVE');
    expect(t9.valid).toBe(false);
  });

  it('۱۹-۴ (T-19.10..12): Evaluates Wave 4 characteristics (Triangle 38.2% ideal, >50% deep, >100% Terminal)', () => {
    // T-19.10: Triangle + 38.2% -> IDEAL
    const t10 = PatternEngines.evaluateWave4Characteristics({
      retracePctOf3: 38.2,
      structureType: 'TRIANGLE'
    });
    expect(t10.classification).toBe('IDEAL');

    // T-19.11: > 50% -> DEEP_CORRECTION
    const t11 = PatternEngines.evaluateWave4Characteristics({
      retracePctOf3: 55,
      structureType: 'FLAT'
    });
    expect(t11.classification).toBe('DEEP_CORRECTION');

    // T-19.12: > 100% -> TERMINAL_OR_DIAGONAL
    const t12 = PatternEngines.evaluateWave4Characteristics({
      retracePctOf3: 108,
      structureType: 'ZIGZAG'
    });
    expect(t12.classification).toBe('TERMINAL_OR_DIAGONAL');
  });

  it('۱۹-۵ (T-19.13..15): Evaluates Wave 5 characteristics (<W3 standard, Ending Diagonal, >W3 extended)', () => {
    // T-19.13: W5 < W3 -> STANDARD
    const t13 = PatternEngines.evaluateWave5Characteristics({
      wave5Len: 90,
      wave3Len: 160,
      wave4Len: 50
    });
    expect(t13.classification).toBe('STANDARD');

    // T-19.14: Ending Diagonal -> COMMON_ENDING_DIAGONAL
    const t14 = PatternEngines.evaluateWave5Characteristics({
      wave5Len: 95,
      wave3Len: 160,
      structureType: 'ENDING_DIAGONAL'
    });
    expect(t14.classification).toBe('COMMON_ENDING_DIAGONAL');

    // T-19.15: W5 > W3 -> EXTENDED_RARE
    const t15 = PatternEngines.evaluateWave5Characteristics({
      wave5Len: 210,
      wave3Len: 160
    });
    expect(t15.classification).toBe('EXTENDED_RARE');

    // Boundary: W5 < 100% W4 -> INVALID_CB_WAVE
    const tCb = PatternEngines.evaluateWave5Characteristics({
      wave5Len: 40,
      wave3Len: 160,
      wave4Len: 60
    });
    expect(tCb.classification).toBe('INVALID_CB_WAVE');
    expect(tCb.valid).toBe(false);
  });

  it('۱۹-۶ (T-19.16..18): Evaluates Wave A characteristics (3->5 standard, 5->3 possible, >38.2% confirmed)', () => {
    // T-19.16: W5=3-wave + WA=5-wave -> STANDARD
    const t16 = PatternEngines.evaluateWaveACharacteristics({
      wave5Subwaves: 3,
      waveASubwaves: 5,
      waveARetracePctOf5: 35
    });
    expect(t16.classification).toBe('STANDARD');

    // T-19.17: W5=5-wave + WA=3-wave -> POSSIBLE
    const t17 = PatternEngines.evaluateWaveACharacteristics({
      wave5Subwaves: 5,
      waveASubwaves: 3,
      waveARetracePctOf5: 35
    });
    expect(t17.classification).toBe('POSSIBLE');

    // T-19.18: WA > 38.2% -> confirmed (and <= 38.2% -> unconfirmed)
    expect(t16.confirmed).toBe(false);
    const t18 = PatternEngines.evaluateWaveACharacteristics({
      wave5Subwaves: 3,
      waveASubwaves: 5,
      waveARetracePctOf5: 45
    });
    expect(t18.confirmed).toBe(true);
  });

  it('۱۹-۷ & ۱۹-۸ (T-19.19..24): Evaluates Wave B (Flat/Zigzag/Irregular) & Wave C (100% B, >=92% W5, Diagonal)', () => {
    // T-19.19: B 3-wave + 61.8% -> FLAT
    expect(PatternEngines.evaluateWaveBCharacteristics({ subwaves: 3, retracePctOfA: 61.8 }).patternType).toBe('FLAT');
    // T-19.20: B < 61.8% -> SIMPLE_ZIGZAG
    expect(PatternEngines.evaluateWaveBCharacteristics({ subwaves: 3, retracePctOfA: 45 }).patternType).toBe('SIMPLE_ZIGZAG');
    // T-19.21: B > 100% -> IRREGULAR_FLAT
    expect(PatternEngines.evaluateWaveBCharacteristics({ subwaves: 3, retracePctOfA: 115 }).patternType).toBe('IRREGULAR_FLAT');

    // T-19.22 & T-19.23: C covers 100% B & >= 92% W5 -> valid & STANDARD
    const t22_23 = PatternEngines.evaluateWaveCCharacteristics({
      coversWaveB100Pct: true,
      pctOfWave5: 95
    });
    expect(t22_23.valid).toBe(true);
    expect(t22_23.status).toBe('STANDARD');
    expect(t22_23.meets92PctWave5).toBe(true);

    // T-19.24: Wave C = Diagonal -> POSSIBLE_DIAGONAL_TERMINAL
    const t24 = PatternEngines.evaluateWaveCCharacteristics({
      coversWaveB100Pct: true,
      pctOfWave5: 85,
      structureType: 'DIAGONAL'
    });
    expect(t24.status).toBe('POSSIBLE_DIAGONAL_TERMINAL');
    expect(t24.valid).toBe(true);

    // Boundary: Wave C fails 100% B coverage -> INVALID_MISSING_B_COVERAGE
    const tMissingB = PatternEngines.evaluateWaveCCharacteristics({
      coversWaveB100Pct: false,
      pctOfWave5: 95
    });
    expect(tMissingB.valid).toBe(false);
    expect(tMissingB.status).toBe('INVALID_MISSING_B_COVERAGE');
  });

  it('۱۹-۹..۱۹-۱۴ (T-19.25..36): Evaluates Capital, Signals, Risk, Price Action Role, Post-Course Path & Final Advice', () => {
    // T-19.25 & T-19.26
    expect(
      PatternEngines.evaluateCapitalManagementPostChart({
        hasWaveCounting: true,
        hasRiskManagement: true,
        hasPositionSizing: true,
        hasExitPlan: true
      }).status
    ).toBe('COMPLETE');
    expect(
      PatternEngines.evaluateCapitalManagementPostChart({
        hasWaveCounting: true,
        hasRiskManagement: false,
        hasPositionSizing: false,
        hasExitPlan: false
      }).status
    ).toBe('INCOMPLETE');
    expect(
      PatternEngines.evaluateCapitalManagementPostChart({
        hasWaveCounting: false,
        hasRiskManagement: true,
        hasPositionSizing: true,
        hasExitPlan: true
      }).status
    ).toBe('NO_DIRECTION');

    // T-19.27 & T-19.28
    expect(
      PatternEngines.evaluateSignalGenerationMethods({
        hasWaveCounting: true,
        usesIndicators: true,
        usesClassicPatterns: true
      }).status
    ).toBe('COMPLETE');
    expect(
      PatternEngines.evaluateSignalGenerationMethods({
        hasWaveCounting: true
      }).status
    ).toBe('UNCONFIRMED_ENTRY');
    expect(
      PatternEngines.evaluateSignalGenerationMethods({
        hasWaveCounting: false,
        usesIndicators: true,
        usesTabloFlow: true
      }).status
    ).toBe('UNCLEAR_DIRECTION');
    expect(
      PatternEngines.evaluateSignalGenerationMethods({
        hasWaveCounting: true,
        usesTabloFlow: true
      }).status
    ).toBe('COMPLETE');

    // T-19.29 & T-19.30
    expect(
      PatternEngines.evaluateRiskManagementReadiness({ trailingStopActive: true }).status
    ).toBe('COMPLETE_RISK_MANAGEMENT');
    expect(
      PatternEngines.evaluateRiskManagementReadiness({ trailingStopActive: false }).status
    ).toBe('HIGH_RISK');

    // T-19.31 & T-19.32
    expect(
      PatternEngines.evaluatePriceActionRole({ usesPriceAction: true, hasWaveCounting: true }).status
    ).toBe('USEFUL_TOOL');
    expect(
      PatternEngines.evaluatePriceActionRole({ usesPriceAction: true, hasWaveCounting: false }).status
    ).toBe('INCOMPLETE_STANDALONE');
    expect(
      PatternEngines.evaluatePriceActionRole({
        usesPriceAction: true,
        hasWaveCounting: true,
        usesIndicators: true,
        usesTablo: true
      }).status
    ).toBe('COMPLETE');

    // T-19.33 & T-19.34
    expect(
      PatternEngines.evaluatePostCoursePath({
        readsGlennNeelyBook: true,
        studiesPackages: true,
        practicesCharts: true
      }).status
    ).toBe('COMPLETE');
    expect(
      PatternEngines.evaluatePostCoursePath({
        readsGlennNeelyBook: true,
        studiesPackages: false,
        practicesCharts: false
      }).status
    ).toBe('INCOMPLETE');

    // T-19.35 & T-19.36
    expect(PatternEngines.evaluateFinalWaveCountingFit({ connectsWithWaveCounting: true }).decision).toBe('CONTINUE');
    expect(
      PatternEngines.evaluateFinalWaveCountingFit({ connectsWithWaveCounting: false }).decision
    ).toBe('STOP_DO_NOT_WASTE_TIME');
  });
});
