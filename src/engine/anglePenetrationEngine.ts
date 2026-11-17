/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AnglePenetrationEngine:
 * Deterministic Elliott Wave Impact-Angle & Penetration Depth Analyzer.
 * Computes scale-invariant wave impact angles (degrees), momentum divergence between consecutive
 * waves, structural penetration depths into prior wave territories & Fibonacci thresholds,
 * and calibrated Short-Term / Medium-Term graphical price targets with confidence percentages.
 */

import {
  Candle,
  WaveDirection,
  WaveRole,
  WaveScenario
} from '../types/elliott';
import { TargetProjectionEngine } from './targetProjectionEngine';

export type AngleRegime = 'STEEP_IMPULSIVE' | 'IDEAL_BAHARI' | 'MODERATE_CORRECTION' | 'SHALLOW_EXHAUSTION';

export interface WaveLegAngleMetric {
  legIndex: number;
  label: string;
  startLabel: string;
  endLabel: string;
  role: WaveRole;
  candleSpan: number;
  pctMove: number;
  signedAngleDeg: number;
  absAngleDeg: number;
  velocityRatio: number;
  regime: AngleRegime;
  regimeLabelFa: string;
  isDivergentWeakness: boolean;
}

export interface PenetrationLevelItem {
  id: string;
  titleFa: string;
  ratioLabel: string;
  price: number;
  penetrationPct: number;
  status: 'PENETRATED' | 'TESTING' | 'UNTOUCHED' | 'VIOLATED';
  statusLabelFa: string;
  significanceFa: string;
}

export interface StructuralPenetrationSummary {
  currentRetraceOrBreakPct: number;
  wave2IntoWave1Pct: number | null;
  wave4IntoWave1Pct: number | null;
  wave3BreakoutPct: number | null;
  goldenZoneActive: boolean;
  structuralRiskFa: string;
  levels: PenetrationLevelItem[];
}

export interface CalibratedAngleTarget {
  id: string;
  horizon: 'SHORT' | 'MEDIUM';
  horizonLabelFa: string;
  titleFa: string;
  ratioLabel: string;
  price: number;
  distancePct: number;
  confidencePct: number;
  riskReward: number;
  angleAlignmentFa: string;
  penetrationBasisFa: string;
}

export interface AnglePenetrationReport {
  scenarioId: string;
  currentPrice: number;
  invalidationPrice: number;
  nextDirection: WaveDirection;
  activeLegAngle: WaveLegAngleMetric | null;
  previousComparableAngle: WaveLegAngleMetric | null;
  momentumDeltaDeg: number;
  convergenceAngleDeg: number;
  impactVerdictFa: string;
  legAngles: WaveLegAngleMetric[];
  penetration: StructuralPenetrationSummary;
  shortTermTargets: CalibratedAngleTarget[];
  mediumTermTargets: CalibratedAngleTarget[];
  overallConfidencePct: number;
}

const roundPrice = (val: number): number => {
  if (!Number.isFinite(val)) return 0;
  return Math.abs(val) >= 500 ? Math.round(val) : Math.round(val * 10) / 10;
};

function classifyAngleRegime(absAngle: number): { regime: AngleRegime; labelFa: string } {
  if (absAngle >= 60) {
    return { regime: 'STEEP_IMPULSIVE', labelFa: 'حمله پرشتاب (≥ ۶۰°)' };
  }
  if (absAngle >= 42) {
    return { regime: 'IDEAL_BAHARI', labelFa: 'زاویه متوازن بهاری (۴۲°–۵۹°)' };
  }
  if (absAngle >= 24) {
    return { regime: 'MODERATE_CORRECTION', labelFa: 'مومنتوم ملایم (۲۴°–۴۱°)' };
  }
  return { regime: 'SHALLOW_EXHAUSTION', labelFa: 'شیب فرسایشی / واگرایی (< ۲۴°)' };
}

export class AnglePenetrationEngine {
  public static analyze(
    scenario: WaveScenario,
    candles: Candle[],
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = ''
  ): AnglePenetrationReport {
    const verts = scenario.vertices || [];
    const lastCandle = candles[candles.length - 1];
    const currentPrice = lastCandle?.close ?? verts[verts.length - 1]?.price ?? 0;

    // Average per-bar range % for scale-invariant slope normalization
    let avgBarRangePct = 1.6;
    if (candles.length > 0) {
      const sample = candles.slice(-Math.min(40, candles.length));
      const sumPct = sample.reduce((acc, c) => {
        const base = Math.max(1e-6, c.open);
        return acc + (Math.abs(c.high - c.low) / base) * 100;
      }, 0);
      avgBarRangePct = Math.max(0.25, sumPct / sample.length);
    }

    const legAngles: WaveLegAngleMetric[] = [];
    for (let i = 1; i < verts.length; i++) {
      const v0 = verts[i - 1];
      const v1 = verts[i];
      const cleanEnd = v1.label.replace(/[()VW\s]/g, '').toUpperCase();
      const role: WaveRole = ['2', '4', 'B', 'X', 'D'].includes(cleanEnd) ? 'CORRECTIVE' : 'MOTIVE';
      const candleSpan = Math.max(1, Math.abs(v1.candleIndex - v0.candleIndex));
      const pctMove = v0.price > 0 ? ((v1.price - v0.price) / v0.price) * 100 : 0;
      const velocityRatio = Math.round(((Math.abs(pctMove) / candleSpan) / avgBarRangePct) * 100) / 100;

      const rawDeg = (Math.atan(velocityRatio * 0.92) * 180) / Math.PI;
      const absAngleDeg = Math.round(Math.min(84, Math.max(6, rawDeg)) * 10) / 10;
      const signedAngleDeg = v1.price >= v0.price ? absAngleDeg : -absAngleDeg;
      const { regime, labelFa } = classifyAngleRegime(absAngleDeg);

      // Compare against previous same-role wave if exists
      const prevSameRole = [...legAngles].reverse().find(l => l.role === role);
      const isDivergentWeakness = Boolean(
        prevSameRole && role === 'MOTIVE' && absAngleDeg < prevSameRole.absAngleDeg - 10
      );

      legAngles.push({
        legIndex: i - 1,
        label: `${v0.label}→${v1.label}`,
        startLabel: v0.label,
        endLabel: v1.label,
        role,
        candleSpan,
        pctMove: Math.round(pctMove * 10) / 10,
        signedAngleDeg,
        absAngleDeg,
        velocityRatio,
        regime,
        regimeLabelFa: labelFa,
        isDivergentWeakness
      });
    }

    const activeLegAngle = legAngles[legAngles.length - 1] || null;
    const previousComparableAngle = activeLegAngle
      ? [...legAngles].slice(0, -1).reverse().find(l => l.role === activeLegAngle.role) ||
        legAngles[legAngles.length - 2] ||
        null
      : null;

    const momentumDeltaDeg =
      activeLegAngle && previousComparableAngle
        ? Math.round((activeLegAngle.absAngleDeg - previousComparableAngle.absAngleDeg) * 10) / 10
        : 0;

    // Impact / convergence angle against horizontal Fibonacci S/R or counter-trend line
    const convergenceAngleDeg = activeLegAngle
      ? Math.round(
          (previousComparableAngle
            ? (activeLegAngle.absAngleDeg * 0.65 + previousComparableAngle.absAngleDeg * 0.35)
            : activeLegAngle.absAngleDeg) * 10
        ) / 10
      : 45;

    let impactVerdictFa = 'زاویه برخورد متعادل و هم‌سو با پیشروی ساختاری.';
    if (activeLegAngle) {
      if (activeLegAngle.absAngleDeg >= 60) {
        impactVerdictFa =
          activeLegAngle.role === 'MOTIVE'
            ? `برخورد پرشتاب (${activeLegAngle.absAngleDeg}°) — انرژی حرکتی بالا و شانس بالای لمس اهداف کوتاه‌مدت و اکستنشن.`
            : `زاویه اصلاح تند (${activeLegAngle.absAngleDeg}°) — فشار عرضه/تقاضای ناگهانی؛ مراقب شکست سطوح نفوذ باشید.`;
      } else if (activeLegAngle.absAngleDeg >= 42) {
        impactVerdictFa = `زاویه ایده‌آل بهاری (${activeLegAngle.absAngleDeg}°) — بهترین تعادل زمان و قیمت برای دستیابی به اهداف پروجکشن.`;
      } else if (activeLegAngle.isDivergentWeakness) {
        impactVerdictFa = `کاهش شیب برخورد (${momentumDeltaDeg}°) نسبت به موج هم‌نقش قبلی — نشانه تخلیه مومنتوم و احتمال برگشت در PRZ.`;
      } else {
        impactVerdictFa = `شیب ملایم (${activeLegAngle.absAngleDeg}°) — حرکت پله‌ای با نیاز به تأیید سطوح نفوذ ۵۰٪ تا ۶۱.۸٪.`;
      }
    }

    // Penetration Metrics
    const isBull = scenario.direction === 'BULLISH';
    let wave2IntoWave1Pct: number | null = null;
    let wave4IntoWave1Pct: number | null = null;
    let wave3BreakoutPct: number | null = null;

    if (verts.length >= 3) {
      const w1Len = Math.max(1e-6, Math.abs(verts[1].price - verts[0].price));
      const w2Len = Math.abs(verts[2].price - verts[1].price);
      wave2IntoWave1Pct = Math.round((w2Len / w1Len) * 1000) / 10;
    }
    if (verts.length >= 4) {
      const w1End = verts[1].price;
      const w3End = verts[3].price;
      const w1Len = Math.max(1e-6, Math.abs(verts[1].price - verts[0].price));
      const beyond = isBull ? w3End - w1End : w1End - w3End;
      wave3BreakoutPct = Math.round((beyond / w1Len) * 1000) / 10;
    }
    if (verts.length >= 5) {
      const w1End = verts[1].price;
      const w4End = verts[4].price;
      const w1Len = Math.max(1e-6, Math.abs(verts[1].price - verts[0].price));
      const overlapAmt = isBull ? w1End - w4End : w4End - w1End;
      wave4IntoWave1Pct = overlapAmt > 0 ? Math.round((overlapAmt / w1Len) * 1000) / 10 : 0;
    }

    // Anchor latest swing leg for Fibonacci penetration ladder
    const swingStart = verts.length >= 2 ? verts[verts.length - 2].price : currentPrice * 0.94;
    const swingEnd = verts.length >= 2 ? verts[verts.length - 1].price : currentPrice;
    const swingSpan = Math.max(1e-6, Math.abs(swingEnd - swingStart));
    const lastLegUp = swingEnd >= swingStart;

    const currentRetraceOrBreakPct =
      verts.length >= 2
        ? Math.round(
            (Math.abs(lastLegUp ? swingEnd - currentPrice : currentPrice - swingEnd) / swingSpan) * 1000
          ) / 10
        : 38.2;

    const fibThresholds = [
      { ratio: 0.236, label: '۲۳.۶٪', title: 'نفوذ سطحی (۲۳.۶٪)', sig: 'حمایت/مقاومت ضعیف — نشانه شتاب‌گیری روند' },
      { ratio: 0.382, label: '۳۸.۲٪', title: 'مرز موج ۴ (۳۸.۲٪)', sig: 'آستانه استاندارد استراحت روند قوی و کشیدگی موج ۳' },
      { ratio: 0.5, label: '۵۰.۰٪', title: 'حداقل نفوذ ورود (۵۰٪)', sig: 'کف شرط ورود بهاری و تعادل قیمتی' },
      { ratio: 0.618, label: '۶۱.۸٪', title: 'تراز طلایی بهاری (۶۱.۸٪)', sig: 'قوی‌ترین تراز چرخش PRZ و شناسایی ساختار' },
      { ratio: 0.786, label: '۷۸.۶٪', title: 'نفوذ عمیق شتابدار (۷۸.۶٪)', sig: 'واکنش تند بازگشتی — آخرین سنگر پیش از ابطال' },
      { ratio: 1.0, label: '۱۰۰٪', title: 'مرز ابطال مبدأ (۱۰۰٪)', sig: 'پوشش کامل موج مرجع (نقض R1 یا شروع آنتی‌سیکل)' }
    ];

    const levels: PenetrationLevelItem[] = fibThresholds.map((ft, idx) => {
      const price = roundPrice(lastLegUp ? swingEnd - swingSpan * ft.ratio : swingEnd + swingSpan * ft.ratio);
      const diffPct = Math.abs(currentRetraceOrBreakPct - ft.ratio * 100);
      let status: PenetrationLevelItem['status'] = 'UNTOUCHED';
      let statusLabelFa = 'پیشِ رو';
      if (ft.ratio === 1.0 && currentRetraceOrBreakPct >= 100) {
        status = 'VIOLATED';
        statusLabelFa = 'نقض / پوشش کامل';
      } else if (diffPct <= 4.5) {
        status = 'TESTING';
        statusLabelFa = 'در حال برخورد';
      } else if (currentRetraceOrBreakPct > ft.ratio * 100) {
        status = 'PENETRATED';
        statusLabelFa = 'نفوذ شده';
      }

      return {
        id: `pen_${idx}`,
        titleFa: ft.title,
        ratioLabel: ft.label,
        price,
        penetrationPct: Math.round(ft.ratio * 1000) / 10,
        status,
        statusLabelFa,
        significanceFa: ft.sig
      };
    });

    const goldenZoneActive = currentRetraceOrBreakPct >= 48 && currentRetraceOrBreakPct <= 66;
    const structuralRiskFa =
      wave4IntoWave1Pct && wave4IntoWave1Pct > 0 && scenario.patternType === 'IDEAL_CYCLE'
        ? `هشدار نفوذ: موج ۴ به میزان ${wave4IntoWave1Pct}٪ وارد حریم موج ۱ شده است (بررسی ترمینال یا قطر).`
        : wave2IntoWave1Pct && wave2IntoWave1Pct >= 100
        ? 'نقض نفوذ R1: موج ۲ مبدأ موج ۱ را شکسته است.'
        : goldenZoneActive
        ? 'قیمت در محدوده نفوذ طلایی (۵۰٪–۶۱.۸٪) قرار دارد؛ چرخش با کیفیت بالا.'
        : 'سطوح نفوذ ساختاری در محدوده امن قوانین بهاری قرار دارند.';

    // Pull unified projection report and calibrate Short-Term & Medium-Term Targets
    const projection = TargetProjectionEngine.projectScenario(scenario, candles, parentRole, parentWaveLabel);
    const invPrice = projection.invalidationPrice || scenario.invalidationPrice;
    const riskSpan = Math.max(1e-6, Math.abs(currentPrice - invPrice));

    const angleQualityBoost =
      activeLegAngle?.regime === 'IDEAL_BAHARI'
        ? 5
        : activeLegAngle?.regime === 'STEEP_IMPULSIVE'
        ? 3
        : activeLegAngle?.isDivergentWeakness
        ? -7
        : -2;

    const validityBase = Math.max(45, Math.min(96, scenario.validityScore * 0.52 + scenario.confidenceScore * 0.48));

    const shortTermTargets: CalibratedAngleTarget[] = [];
    const mediumTermTargets: CalibratedAngleTarget[] = [];

    const addCalibratedTarget = (
      horizon: 'SHORT' | 'MEDIUM',
      id: string,
      titleFa: string,
      ratioLabel: string,
      price: number,
      rawProb: number,
      penetrationBasisFa: string
    ) => {
      if (!Number.isFinite(price) || price <= 0) return;
      const distPct = currentPrice > 0 ? Math.round(((price - currentPrice) / currentPrice) * 1000) / 10 : 0;
      const rr = Math.round((Math.abs(price - currentPrice) / riskSpan) * 10) / 10;
      const horizonPenalty = horizon === 'MEDIUM' && activeLegAngle?.isDivergentWeakness ? -8 : 0;
      const conf = Math.round(
        Math.max(28, Math.min(95, rawProb * 0.55 + validityBase * 0.45 + angleQualityBoost + horizonPenalty))
      );

      const angleAlignmentFa = activeLegAngle
        ? `هم‌راستا با زاویه ${activeLegAngle.absAngleDeg}° (${activeLegAngle.regimeLabelFa})`
        : 'مبنای متعادل ۴۵°';

      const targetItem: CalibratedAngleTarget = {
        id,
        horizon,
        horizonLabelFa: horizon === 'SHORT' ? 'کوتاه‌مدت' : 'میانمدت',
        titleFa,
        ratioLabel,
        price: roundPrice(price),
        distancePct: distPct,
        confidencePct: conf,
        riskReward: Math.max(0.2, rr),
        angleAlignmentFa,
        penetrationBasisFa
      };

      if (horizon === 'SHORT') shortTermTargets.push(targetItem);
      else mediumTermTargets.push(targetItem);
    };

    // Short-term from TMV Prime, Short 0.618, nearest PRZ / target[0]
    if (projection.tmvSummary) {
      addCalibratedTarget(
        'SHORT',
        'st_tmv_prime',
        'هدف کوتاه‌مدت نخست (TMV Prime)',
        'Prime',
        projection.tmvSummary.prime,
        84,
        'شکست و تثبیت بالای سقف/کف موج مرجع قبلی'
      );
      addCalibratedTarget(
        'SHORT',
        'st_tmv_short',
        'هدف کوتاه‌مدت ۶۱.۸٪ (TMV Short)',
        '0.618 TMV',
        projection.tmvSummary.short0618,
        79,
        'تلاقی با نفوذ ۶۱.۸٪ موج مرجع'
      );
    }

    const firstPrz = projection.przZones.find(z => z.isPrimary) || projection.przZones[0];
    if (firstPrz && shortTermTargets.length < 3) {
      addCalibratedTarget(
        'SHORT',
        'st_prz_primary',
        'ناحیه چرخش کوتاه‌مدت (PRZ میانی)',
        firstPrz.contributingRatios[0] || 'PRZ',
        firstPrz.midPrice,
        firstPrz.confidence,
        'تراکم نفوذ فیبوناچی چندلایه PRZ'
      );
    }

    // Medium-term from TMV Ideal 1.000, Alternate 1.618 & extension layers
    if (projection.tmvSummary) {
      addCalibratedTarget(
        'MEDIUM',
        'mt_tmv_ideal',
        'هدف میانمدت ایده‌آل (TMV Ideal 100%)',
        '1.000 TMV',
        projection.tmvSummary.ideal100,
        74,
        'تکمیل ۱۰۰٪ پروجکشن سه‌نقطه‌ای پس از نفوذ معتبر اصلاحی'
      );
      addCalibratedTarget(
        'MEDIUM',
        'mt_tmv_alt',
        'هدف میانمدت کشیده (TMV Alternate 161.8%)',
        '1.618 TMV',
        projection.tmvSummary.alternate1618,
        61,
        'فعال‌سازی با زاویه > ۴۵° و عدم نفوذ عمیق موج ۴ (> ۳۸.۲٪)'
      );
    }

    // Fallback or extra projected targets if tmvSummary missing or sparse
    projection.targets.slice(0, 4).forEach((t, idx) => {
      const exists =
        shortTermTargets.some(x => Math.abs(x.price - t.price) / Math.max(1, x.price) < 0.008) ||
        mediumTermTargets.some(x => Math.abs(x.price - t.price) / Math.max(1, x.price) < 0.008);
      if (exists) return;
      if (idx === 0 && shortTermTargets.length < 2) {
        addCalibratedTarget('SHORT', `st_proj_${t.id}`, t.label, t.ratioLabel, t.price, t.probabilityScore, t.basisFa);
      } else if (mediumTermTargets.length < 3) {
        addCalibratedTarget('MEDIUM', `mt_proj_${t.id}`, t.label, t.ratioLabel, t.price, t.probabilityScore, t.basisFa);
      }
    });

    // Sort by absolute distance from current price so UI shows nearest -> farthest cleanly
    shortTermTargets.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));
    mediumTermTargets.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));

    const allConf = [...shortTermTargets, ...mediumTermTargets].map(t => t.confidencePct);
    const overallConfidencePct =
      allConf.length > 0 ? Math.round(allConf.reduce((a, b) => a + b, 0) / allConf.length) : scenario.confidenceScore;

    return {
      scenarioId: scenario.id,
      currentPrice: roundPrice(currentPrice),
      invalidationPrice: roundPrice(invPrice),
      nextDirection: projection.nextDirection,
      activeLegAngle,
      previousComparableAngle,
      momentumDeltaDeg,
      convergenceAngleDeg,
      impactVerdictFa,
      legAngles,
      penetration: {
        currentRetraceOrBreakPct,
        wave2IntoWave1Pct,
        wave4IntoWave1Pct,
        wave3BreakoutPct,
        goldenZoneActive,
        structuralRiskFa,
        levels
      },
      shortTermTargets,
      mediumTermTargets,
      overallConfidencePct
    };
  }
}
