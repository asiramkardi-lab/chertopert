/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Market Data generation and presets for BTC/USDT, ETH, Gold, and Tehran Stock Exchange (TSE)
 */

import { Candle } from '../types/elliott';

export interface MarketAssetConfig {
  id: string;
  name: string;
  symbol: string;
  marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  maxAllowedDegree: number; // 4 for TSE Iran, 8-15 for crypto/forex
  descriptionFa: string;
  timeframes: string[];
}

export const SUPPORTED_ASSETS: MarketAssetConfig[] = [
  {
    id: 'BTCUSDT',
    name: 'Bitcoin / Tether',
    symbol: 'BTC/USDT',
    marketType: 'CRYPTO',
    maxAllowedDegree: 8,
    descriptionFa: 'بیت‌کوین - کیفیت دیتای بالا، مناسب برای درجات متعدد تا ۱۵ دقیقه',
    timeframes: ['1M', '1W', '1D', '4H', '1H', '15M']
  },
  {
    id: 'TSE_SHAPNA',
    name: 'پالایش نفت اصفهان (شپنا)',
    symbol: 'شپنا (TSE)',
    marketType: 'TSE_IRAN',
    maxAllowedDegree: 4,
    descriptionFa: 'بورس تهران - طبق مستند، حداکثر ۴ درجه موج‌شماری (V, W, اعداد بولد، اعداد ساده)',
    timeframes: ['1M', '1W', '1D', '4H']
  },
  {
    id: 'XAUUSD',
    name: 'طلا جهانی (Gold)',
    symbol: 'XAU/USD',
    marketType: 'COMMODITY',
    maxAllowedDegree: 6,
    descriptionFa: 'انس جهانی طلا - روند منظم با رفتارهای ایده‌آل و زیگزاگ‌های کلاسیک',
    timeframes: ['1W', '1D', '4H', '1H']
  }
];

export function generateRealisticCandles(
  assetId: string,
  timeframe: string,
  count: number = 80
): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const tfMinutes = timeframe === '1M' ? 43200 : timeframe === '1W' ? 10080 : timeframe === '1D' ? 1440 : timeframe === '4H' ? 240 : timeframe === '1H' ? 60 : 15;
  const intervalMs = tfMinutes * 60 * 1000;

  let basePrice = assetId === 'BTCUSDT' ? 52000 : assetId === 'TSE_SHAPNA' ? 4200 : 2150;
  let price = basePrice;

  // We synthesize a structured Elliott Wave 5-wave impulse + ABC correction sequence with realistic noise
  // Wave 0 to 1 (bars 0..14), Wave 1 to 2 (bars 15..24), Wave 2 to 3 (bars 25..46), Wave 3 to 4 (bars 47..58), Wave 4 to 5 (bars 59..75)
  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * intervalMs;
    const dateStr = new Date(timestamp).toLocaleDateString('fa-IR');

    // Deterministic trend component that models 5-wave impulse
    let drift = 0;
    if (i < 15) {
      // Wave 1 up (strong, minimum 3 candles, impulse)
      drift = (basePrice * 0.008);
    } else if (i < 25) {
      // Wave 2 down (retrace ~50%)
      drift = -(basePrice * 0.005);
    } else if (i < 48) {
      // Wave 3 up (extended, sharp, very high momentum)
      drift = (basePrice * 0.013);
    } else if (i < 60) {
      // Wave 4 down (complex flat/triangle, does not break wave 1 in ideal)
      drift = -(basePrice * 0.004);
    } else if (i < 74) {
      // Wave 5 up (moderate, developing)
      drift = (basePrice * 0.007);
    } else {
      // developing / current bars
      drift = (basePrice * 0.002);
    }

    const noise = (Math.sin(i * 1.5) + Math.cos(i * 0.7)) * (basePrice * 0.003);
    const open = Math.round(price);
    price = Math.max(10, price + drift + noise);
    const close = Math.round(price);
    const high = Math.round(Math.max(open, close) + (Math.abs(drift) * 0.4) + Math.random() * (basePrice * 0.002));
    const low = Math.round(Math.min(open, close) - (Math.abs(drift) * 0.3) - Math.random() * (basePrice * 0.002));
    const volume = Math.round(1000 + Math.abs(drift) * 50 + Math.random() * 800);

    candles.push({
      time: dateStr,
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
  }

  return candles;
}
