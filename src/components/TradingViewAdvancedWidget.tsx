/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Official TradingView Advanced Real-Time Chart Embed Widget with Full Tools,
 * Indicators, Watchlist, Economic Calendar, Multi-Timeframe & Symbol Search.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  mapAssetToTradingViewSymbol,
  mapTimeframeToTradingViewInterval
} from '../engine/chartToolsEngine';
import { AlertTriangle, ArrowRight, Globe, RefreshCw, Search } from 'lucide-react';

interface TradingViewAdvancedWidgetProps {
  assetSymbol: string;
  timeframe: string;
  onBackToInteractiveCanvas: () => void;
}

const PRESET_TV_SYMBOLS = [
  { label: 'BTC / USDT', symbol: 'BINANCE:BTCUSDT' },
  { label: 'ETH / USDT', symbol: 'BINANCE:ETHUSDT' },
  { label: 'Gold (XAU/USD)', symbol: 'OANDA:XAUUSD' },
  { label: 'EUR / USD', symbol: 'FX:EURUSD' },
  { label: 'S&P 500', symbol: 'SP:SPX' },
  { label: 'US Dollar Index', symbol: 'TVC:DXY' }
];

function inferAssetIdFromSymbol(assetSymbol: string): string {
  const s = assetSymbol.toUpperCase();
  if (s.includes('BTC')) return 'BTCUSDT';
  if (s.includes('XAU') || s.includes('GOLD') || s.includes('طلا')) return 'XAUUSD';
  if (s.includes('شپنا') || s.includes('SHAPNA')) return 'TSE_SHAPNA';
  if (s.includes('ذوب') || s.includes('ZOB')) return 'TSE_ZOB';
  if (s.includes('فارس') || s.includes('FARS')) return 'TSE_FARS';
  return assetSymbol;
}

export const TradingViewAdvancedWidget: React.FC<TradingViewAdvancedWidgetProps> = ({
  assetSymbol,
  timeframe,
  onBackToInteractiveCanvas
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapping = useMemo(
    () => mapAssetToTradingViewSymbol(inferAssetIdFromSymbol(assetSymbol), assetSymbol),
    [assetSymbol]
  );
  const [selectedSymbol, setSelectedSymbol] = useState<string>(mapping.tvSymbol);
  const [customTickerInput, setCustomTickerInput] = useState<string>(mapping.tvSymbol);
  const [widgetLocale, setWidgetLocale] = useState<'fa_IR' | 'en'>('en');
  const [showSideWatchlist, setShowSideWatchlist] = useState<boolean>(true);
  const [scriptError, setScriptError] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  useEffect(() => {
    setSelectedSymbol(mapping.tvSymbol);
    setCustomTickerInput(mapping.tvSymbol);
  }, [mapping.tvSymbol]);

  const tvInterval = useMemo(() => mapTimeframeToTradingViewInterval(timeframe), [timeframe]);

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    setScriptError(false);
    container.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container';
    widgetWrapper.style.width = '100%';
    widgetWrapper.style.height = '100%';

    const chartDiv = document.createElement('div');
    chartDiv.className = 'tradingview-widget-container__widget';
    chartDiv.style.width = '100%';
    chartDiv.style.height = '100%';
    widgetWrapper.appendChild(chartDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.onerror = () => setScriptError(true);

    const config = {
      autosize: true,
      symbol: selectedSymbol,
      interval: tvInterval,
      timezone: 'Asia/Tehran',
      theme: 'dark',
      style: '1',
      locale: widgetLocale,
      backgroundColor: '#080d1a',
      gridColor: 'rgba(30, 41, 59, 0.35)',
      withdateranges: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      details: showSideWatchlist,
      hotlist: showSideWatchlist,
      calendar: showSideWatchlist,
      studies: ['STD;RSI', 'STD;MACD', 'STD;Volume'],
      support_host: 'https://www.tradingview.com'
    };

    script.innerHTML = JSON.stringify(config);
    widgetWrapper.appendChild(script);
    container.appendChild(widgetWrapper);

    return () => {
      container.innerHTML = '';
    };
  }, [selectedSymbol, tvInterval, widgetLocale, showSideWatchlist, reloadNonce]);

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-[460px] bg-[#080d1a] relative overflow-hidden">
      {/* Official TradingView Live Control Strip */}
      <div className="bg-[#0b1326] border-b border-slate-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onBackToInteractiveCanvas}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors whitespace-nowrap"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>بازگشت به بوم الیوت + TradingView Canvas</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {PRESET_TV_SYMBOLS.map(preset => (
              <button
                key={preset.symbol}
                type="button"
                onClick={() => {
                  setSelectedSymbol(preset.symbol);
                  setCustomTickerInput(preset.symbol);
                }}
                className={`px-2 py-0.5 rounded-md font-mono text-[10px] transition-colors whitespace-nowrap ${
                  selectedSymbol === preset.symbol
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <form
            onSubmit={e => {
              e.preventDefault();
              const clean = customTickerInput.trim().toUpperCase();
              if (clean) setSelectedSymbol(clean);
            }}
            className="flex items-center bg-slate-950 border border-slate-700 rounded-lg overflow-hidden"
          >
            <input
              type="text"
              value={customTickerInput}
              onChange={e => setCustomTickerInput(e.target.value)}
              placeholder="BINANCE:ETHUSDT"
              dir="ltr"
              className="w-36 bg-transparent px-2 py-1 text-[10.5px] font-mono text-slate-200 focus:outline-none"
            />
            <button
              type="submit"
              title="بارگذاری نماد در TradingView"
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors"
            >
              <Search className="w-3 h-3" />
            </button>
          </form>

          <button
            type="button"
            onClick={() => setShowSideWatchlist(v => !v)}
            className={`px-2 py-1 rounded-lg border text-[10.5px] whitespace-nowrap transition-colors ${
              showSideWatchlist
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            واچ‌لیست و جزئیات
          </button>

          <button
            type="button"
            onClick={() => setWidgetLocale(l => (l === 'en' ? 'fa_IR' : 'en'))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 hover:text-white text-[10.5px] whitespace-nowrap"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>{widgetLocale === 'fa_IR' ? 'زبان: فارسی' : 'Lang: EN'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReloadNonce(n => n + 1)}
            title="بارگذاری مجدد ویجت TradingView"
            className="p-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TSE Local Asset Info Banner */}
      {!mapping.isNativeOnTradingView && (
        <div className="bg-amber-950/50 border-b border-amber-500/35 px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              نماد محلی بورس تهران ({assetSymbol}) در سرور عمومی TradingView وجود ندارد؛ ویجت زنده روی بازار جهانی ({selectedSymbol}) باز شده است. برای موج‌شماری الیوت روی کندل‌های واقعی {assetSymbol} از بوم تعاملی TradingView استفاده کنید.
            </span>
          </div>
          <button
            type="button"
            onClick={onBackToInteractiveCanvas}
            className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-100 font-semibold whitespace-nowrap"
          >
            تحلیل الیوت {assetSymbol}
          </button>
        </div>
      )}

      {/* Official TradingView Live Container */}
      <div className="flex-1 relative w-full h-full min-h-[420px]">
        <div ref={hostRef} className="w-full h-full" />

        {scriptError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080d1a]/95 p-6 text-center gap-3 z-20">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <div className="text-sm font-bold text-white">امکان بارگذاری اسکریپت زنده TradingView وجود ندارد</div>
            <p className="text-xs text-slate-400 max-w-md">
              اتصال اینترنت یا دسترسی به دامنه tradingview.com مسدود است. می‌توانید بلافاصله از موتور بومی TradingView Lightweight Canvas با تمام اندیکاتورها و ابزارهای الیوت استفاده کنید.
            </p>
            <button
              type="button"
              onClick={onBackToInteractiveCanvas}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              استفاده از TradingView Canvas تعاملی
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
