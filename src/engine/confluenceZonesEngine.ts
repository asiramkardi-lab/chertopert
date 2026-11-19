/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Multi-Wave Elliott Fibonacci Confluence Zones Engine
 * Computes overlapping retracement, extension, and equality zones across waves
 * following Bahari Elliott Wave rules.
 */

import { Candle, WaveScenario, WaveDirection, WaveVertex } from '../types/elliott';

export type ConfluenceTier = 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'SPECULATIVE';

export interface ConfluenceContributor {
  id: string;
  waveLabel: string;
  fibType: 'RETRACEMENT' | 'EXTENSION' | 'EQUALITY';
  ratio: number;
  ratioLabel: string;
  price: number;
  weight: number;
}

export interface ConfluenceZoneItem {
  id: string;
  lowPrice: number;
  highPrice: number;
  centerPrice: number;
  clusterWidthPct: number;
  confluenceStrengthPct: number;
  tier: ConfluenceTier;
  tierLabelFa: string;
  directionBias: 'SUPPORT_LONG' | 'RESISTANCE_SHORT';
  colorHex: string;
  glowHex: string;
  waveCount: number;
  levelCount: number;
  distanceFromPricePct: number;
  bahariAligned: boolean;
  bahariNoteFa: string;
  contributors: ConfluenceContributor[];
}

export interface ConfluenceZonesReport {
  scenarioId: string;
  currentPrice: number;
  invalidationPrice: number;
  tolerancePct: number;
  zones: ConfluenceZoneItem[];
  allProjectedLevelsCount: number;
  highConfidenceCount: number;
  lastWaveLabel: string;
  hasWave5OrCEndRule: boolean;
  summaryNoteFa: string;
}

interface RawFibLevel extends ConfluenceContributor {
  waveKey: string;
}

const RETRACEMENT_SPECS: Array<{ ratio: number; label: string; weight: number }> = [
  { ratio: 0.236, label: '23.6%', weight: 0.62 },
  { ratio: 0.382, label: '38.2%', weight: 0.92 },
  { ratio: 0.5, label: '50.0%', weight: 0.96 },
  { ratio: 0.618, label: '61.8%', weight: 1.15 },
  { ratio: 0.786, label: '78.6%', weight: 0.95 },
  { ratio: 0.886, label: '88.6%', weight: 0.72 }
];

const EXTENSION_SPECS: Array<{ ratio: number; label: string; weight: number }> = [
  { ratio: 0.618, label: '0.618', weight: 0.88 },
  { ratio: 1.0, label: '1.000', weight: 1.05 },
  { ratio: 1.272, label: '1.272', weight: 0.92 },
  { ratio: 1.618, label: '1.618', weight: 1.18 },
  { ratio: 2.0, label: '2.000', weight: 0.84 },
  { ratio: 2.618, label: '2.618', weight: 0.8 }
];

function roundPrice(p: number): number {
  if (!Number.isFinite(p)) return 0;
  if (p >= 1000) return Math.round(p);
  if (p >= 10) return Math.round(p * 100) / 100;
  return Math.round(p * 10000) / 10000;
}

export class ConfluenceZonesEngine {
  public static analyze(
    scenario: WaveScenario,
    candles: Candle[],
    tolerancePct: number = 1.8
  ): ConfluenceZonesReport {
    const verts = scenario.vertices;
    const currentPrice =
      candles.length > 0
        ? candles[candles.length - 1].close
        : verts.length > 0
        ? verts[verts.length - 1].price
        : 0;

    if (verts.length < 2 || currentPrice <= 0) {
      return {
        scenarioId: scenario.id,
        currentPrice,
        invalidationPrice: scenario.invalidationPrice || 0,
        tolerancePct,
        zones: [],
        allProjectedLevelsCount: 0,
        highConfidenceCount: 0,
        lastWaveLabel: '-',
        hasWave5OrCEndRule: false,
        summaryNoteFa: 'برای محاسبه مناطق تلاقی فیبوناچی، حداقل ۲ رأس موج لازم است.'
      };
    }

    const isBull = scenario.direction === 'BULLISH';
    const lastV = verts[verts.length - 1];
    const prevV = verts[verts.length - 2];
    const lastWaveLabel = `${prevV.label}→${lastV.label}`;
    const cleanLastLabel = lastV.label.replace(/[()VW\s]/g, '').toUpperCase();
    const hasWave5OrCEndRule = cleanLastLabel === '5' || cleanLastLabel === 'C';

    const rawLevels: RawFibLevel[] = [];

    // 1. Collect multi-wave segments (individual legs + macro spans)
    interface WaveSpanSpec {
      key: string;
      label: string;
      start: WaveVertex;
      end: WaveVertex;
      weightBoost: number;
      isCorrectiveLeg: boolean;
    }

    const waveSpans: WaveSpanSpec[] = [];
    for (let i = 1; i < verts.length; i++) {
      const a = verts[i - 1];
      const b = verts[i];
      const cleanEnd = b.label.replace(/[()VW\s]/g, '').toUpperCase();
      const isCorr = ['2', '4', 'B', 'X', 'D'].includes(cleanEnd);
      waveSpans.push({
        key: `leg_${i - 1}_${i}`,
        label: `موج ${a.label}→${b.label}`,
        start: a,
        end: b,
        weightBoost: i === verts.length - 1 ? 1.15 : 1.0,
        isCorrectiveLeg: isCorr
      });
    }

    // Add composite structural spans (e.g., 0->3, 0->5, 1->3) for macro Fibonacci alignment
    if (verts.length >= 4) {
      waveSpans.push({
        key: 'macro_0_3',
        label: `موج کلان ${verts[0].label}→${verts[3].label}`,
        start: verts[0],
        end: verts[3],
        weightBoost: 1.1,
        isCorrectiveLeg: false
      });
    }
    if (verts.length >= 6) {
      waveSpans.push({
        key: 'macro_0_5',
        label: `کل سیکل ${verts[0].label}→${verts[5].label}`,
        start: verts[0],
        end: verts[5],
        weightBoost: 1.18,
        isCorrectiveLeg: false
      });
    }

    // Determine projection direction:
    // If at end of 5 or C (Bahari rule: no same-degree retracement after W5/C -> next cycle/correction reverses)
    const lastLegUp = lastV.price >= prevV.price;
    const expectedNextDir: WaveDirection = hasWave5OrCEndRule
      ? lastLegUp
        ? 'BEARISH'
        : 'BULLISH'
      : lastLegUp
      ? 'BULLISH'
      : 'BEARISH';

    // 2. Project Retracements from each wave span (especially measuring corrective pulls & post-cycle ABC)
    waveSpans.forEach((span, spanIdx) => {
      const spanAmp = Math.abs(span.end.price - span.start.price);
      if (spanAmp <= 0) return;
      const spanUp = span.end.price >= span.start.price;

      RETRACEMENT_SPECS.forEach(spec => {
        // Retrace against the wave's end
        const price = spanUp
          ? span.end.price - spanAmp * spec.ratio
          : span.end.price + spanAmp * spec.ratio;
        if (price <= 0) return;

        // Bahari weighting: 38.2% higher for W4, 50/61.8% higher for W2
        let bahariBonus = 1.0;
        if (span.label.includes('1→2') && (spec.ratio === 0.5 || spec.ratio === 0.618)) {
          bahariBonus = 1.18;
        } else if (span.label.includes('2→3') && spec.ratio === 0.382) {
          bahariBonus = 1.16;
        }

        rawLevels.push({
          id: `ret-${span.key}-${spec.ratio}-${spanIdx}`,
          waveKey: span.key,
          waveLabel: span.label,
          fibType: 'RETRACEMENT',
          ratio: spec.ratio,
          ratioLabel: `اصلاح ${spec.label}`,
          price: roundPrice(price),
          weight: spec.weight * span.weightBoost * bahariBonus
        });
      });
    });

    // 3. Project Wave Extensions & Equalities anchored from subsequent pivot points (and last pivot)
    for (let i = 0; i < waveSpans.length; i++) {
      const base = waveSpans[i];
      const baseAmp = Math.abs(base.end.price - base.start.price);
      if (baseAmp <= 0) continue;

      // Anchor candidates: the pivot after base (standard Fib ext) and lastV (live projection)
      const anchors: Array<{ vertex: WaveVertex; tag: string; boost: number }> = [];
      if (i + 1 < verts.length - 1) {
        const nextPivot = verts[i + 2];
        if (nextPivot && nextPivot.candleIndex > base.end.candleIndex) {
          anchors.push({ vertex: nextPivot, tag: `مبدأ ${nextPivot.label}`, boost: 1.05 });
        }
      }
      if (lastV.candleIndex >= base.end.candleIndex) {
        anchors.push({ vertex: lastV, tag: `مبدأ ${lastV.label}`, boost: 1.0 });
      }

      anchors.forEach((anch, aIdx) => {
        const baseUp = base.end.price >= base.start.price;
        const projDirUp = hasWave5OrCEndRule ? (expectedNextDir === 'BULLISH') : baseUp;

        EXTENSION_SPECS.forEach(spec => {
          const price = projDirUp
            ? anch.vertex.price + baseAmp * spec.ratio
            : anch.vertex.price - baseAmp * spec.ratio;
          if (price <= 0) return;

          const isEquality = spec.ratio === 1.0;
          rawLevels.push({
            id: `ext-${base.key}-${anch.vertex.label}-${spec.ratio}-${aIdx}`,
            waveKey: `${base.key}_from_${anch.vertex.label}`,
            waveLabel: `${base.label} (${anch.tag})`,
            fibType: isEquality ? 'EQUALITY' : 'EXTENSION',
            ratio: spec.ratio,
            ratioLabel: isEquality ? 'برابری ۱۰۰٪' : `گسترش ${spec.label}`,
            price: roundPrice(price),
            weight: spec.weight * base.weightBoost * anch.boost
          });
        });
      });
    }

    // Filter extreme outliers far outside practical range (e.g. > 2.4x or < 0.35x current price)
    const minPractical = currentPrice * 0.35;
    const maxPractical = currentPrice * 2.45;
    const boundedLevels = rawLevels
      .filter(l => l.price >= minPractical && l.price <= maxPractical)
      .sort((a, b) => a.price - b.price);

    // 4. Cluster nearby levels from >= 2 distinct waves within tolerancePct
    const clusters: RawFibLevel[][] = [];
    for (const lvl of boundedLevels) {
      const lastCluster = clusters[clusters.length - 1];
      if (!lastCluster) {
        clusters.push([lvl]);
        continue;
      }
      const anchorPrice = lastCluster[0].price;
      const diffPct = ((lvl.price - anchorPrice) / Math.max(1e-6, anchorPrice)) * 100;
      if (diffPct <= tolerancePct) {
        lastCluster.push(lvl);
      } else {
        clusters.push([lvl]);
      }
    }

    const p1Price = verts[1]?.price;
    const allowW4Overlap = scenario.patternType !== 'IDEAL_CYCLE';
    const invPrice = scenario.invalidationPrice || 0;

    const zones: ConfluenceZoneItem[] = [];
    clusters.forEach((group, idx) => {
      const distinctWaves = new Set(group.map(g => g.waveLabel.split(' (')[0]));
      if (distinctWaves.size < 2 || group.length < 2) return;

      const lowPrice = roundPrice(group[0].price);
      const highPrice = roundPrice(group[group.length - 1].price);
      const centerPrice = roundPrice(
        group.reduce((s, item) => s + item.price * item.weight, 0) /
          Math.max(0.01, group.reduce((s, item) => s + item.weight, 0))
      );
      const clusterWidthPct = Math.round(((highPrice - lowPrice) / Math.max(1e-6, centerPrice)) * 1000) / 10;
      const distanceFromPricePct = Math.round(((centerPrice - currentPrice) / currentPrice) * 1000) / 10;

      // Bahari Alignment Check
      let bahariAligned = true;
      let bahariNoteFa = `هم‌گرایی ${distinctWaves.size} موج مستقل در ناحیه بازگشتی/هدفی.`;

      if (invPrice > 0) {
        const violatesInv = isBull ? centerPrice <= invPrice : centerPrice >= invPrice;
        if (violatesInv) {
          bahariAligned = false;
          bahariNoteFa = `هشدار: این ناحیه از سطح ابطال (${invPrice.toLocaleString()}) عبور کرده و سناریوی فعلی را باطل می‌کند.`;
        }
      }

      if (bahariAligned && !allowW4Overlap && p1Price !== undefined && verts.length >= 4 && verts.length <= 5) {
        const entersW1 = isBull ? centerPrice < p1Price : centerPrice > p1Price;
        if (entersW1 && centerPrice < currentPrice) {
          bahariAligned = false;
          bahariNoteFa = `توجه قانون ۳ بهاری: تلاقی در حریم موج ۱ قرار دارد (فقط در ترمینال/قطر مجاز است).`;
        }
      }

      if (bahariAligned && hasWave5OrCEndRule) {
        bahariNoteFa = `پایان موج ${lastV.label}: طبق اصول بهاری، پس از اتمام موج ${lastV.label} اصلاح هم‌درجه نداریم و این تلاقی هدف حرکت چرخه بعدی است.`;
      }

      // Compute luminous confidence score
      const waveScore = Math.min(44, distinctWaves.size * 14);
      const weightSum = group.reduce((s, g) => s + g.weight, 0);
      const densityScore = Math.min(34, Math.round(weightSum * 8.5));
      const tightnessBonus = clusterWidthPct <= 0.7 ? 14 : clusterWidthPct <= 1.3 ? 9 : 4;
      const alignmentAdjust = bahariAligned ? 7 : -18;
      const rawScore = waveScore + densityScore + tightnessBonus + alignmentAdjust;
      const confluenceStrengthPct = Math.max(22, Math.min(98, Math.round(rawScore)));

      let tier: ConfluenceTier = 'SPECULATIVE';
      let tierLabelFa = 'تلاقی مقدماتی';
      let colorHex = '#818cf8';
      let glowHex = '#a855f7';

      if (confluenceStrengthPct >= 74 && bahariAligned) {
        tier = 'HIGH_CONFIDENCE';
        tierLabelFa = 'نقطه ورود اطمینان بالا';
        colorHex = '#10b981';
        glowHex = '#22d3ee';
      } else if (confluenceStrengthPct >= 52) {
        tier = 'MEDIUM_CONFIDENCE';
        tierLabelFa = 'تلاقی معتبر میانی';
        colorHex = '#f59e0b';
        glowHex = '#fbbf24';
      }

      // Deduplicate contributor labels inside a zone keeping strongest weights first
      const sortedContrib = [...group].sort((a, b) => b.weight - a.weight).slice(0, 6);

      zones.push({
        id: `cf-${idx}-${Math.round(centerPrice)}`,
        lowPrice,
        highPrice,
        centerPrice,
        clusterWidthPct,
        confluenceStrengthPct,
        tier,
        tierLabelFa,
        directionBias: centerPrice <= currentPrice ? 'SUPPORT_LONG' : 'RESISTANCE_SHORT',
        colorHex,
        glowHex,
        waveCount: distinctWaves.size,
        levelCount: group.length,
        distanceFromPricePct,
        bahariAligned,
        bahariNoteFa,
        contributors: sortedContrib.map(({ waveKey: _wk, ...rest }) => rest)
      });
    });

    // Sort strongest & closest zones first (prioritize strength, then proximity)
    zones.sort((a, b) => {
      if (b.confluenceStrengthPct !== a.confluenceStrengthPct) {
        return b.confluenceStrengthPct - a.confluenceStrengthPct;
      }
      return Math.abs(a.distanceFromPricePct) - Math.abs(b.distanceFromPricePct);
    });

    const topZones = zones.slice(0, 10);
    const highConfidenceCount = topZones.filter(z => z.tier === 'HIGH_CONFIDENCE').length;

    return {
      scenarioId: scenario.id,
      currentPrice,
      invalidationPrice: invPrice,
      tolerancePct,
      zones: topZones,
      allProjectedLevelsCount: boundedLevels.length,
      highConfidenceCount,
      lastWaveLabel,
      hasWave5OrCEndRule,
      summaryNoteFa:
        highConfidenceCount > 0
          ? `${highConfidenceCount} ناحیه تلاقی با اطمینان بالا میان امواج مختلف شناسایی شد.`
          : topZones.length > 0
          ? `${topZones.length} ناحیه تلاقی فعال شناسایی شد (برای دقت بیشتر تلورانس را تنظیم کنید).`
          : 'با تلورانس فعلی ناحیه تلاقی متراکمی یافت نشد؛ تلورانس را افزایش دهید.'
    };
  }
}
