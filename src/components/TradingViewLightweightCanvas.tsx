/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TradingView Lightweight Charts v5.3.0 HTML5 Canvas Engine
 * Provides authentic TradingView Candlestick / Hollow / Heikin-Ashi / Bar / Line / Area / Baseline
 * rendering, multi-pane Volume / RSI / MACD / EMA / SMA / Bollinger / VWAP indicators,
 * native Log / Percent / Inverted price scaling, Magnet crosshair, PNG screenshot export,
 * and a pixel-accurate coordinate bridge for interactive Elliott Wave & PRZ/TMV overlays.
 */

import React, { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  PriceScaleMode as TvPriceScaleMode,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  SeriesType,
  UTCTimestamp,
  Logical,
  LineStyle
} from 'lightweight-charts';
import { Candle } from '../types/elliott';
import {
  ChartStyleType,
  PriceScaleMode,
  toHeikinAshi,
  computeEMA,
  computeSMA,
  computeBollingerBands,
  computeRSI,
  computeMACD,
  computeVWAP
} from '../engine/chartToolsEngine';

export interface TradingViewCanvasBridge {
  isReady: () => boolean;
  getX: (candleIndex: number) => number | null;
  getY: (price: number) => number | null;
  getIndexAndPrice: (x: number, y: number) => { candleIndex: number; price: number } | null;
  getPlotGeometry: () => {
    plotWidth: number;
    plotHeight: number;
    priceScaleWidth: number;
    paneCount: number;
  };
  fitContent: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetAutoScale: () => void;
  takeScreenshot: () => HTMLCanvasElement | null;
}

export interface TradingViewLightweightCanvasProps {
  candles: Candle[];
  timeframe: string;
  assetSymbol: string;
  chartStyle: ChartStyleType;
  scaleMode: PriceScaleMode;
  invertScale: boolean;
  magnetMode: boolean;
  autoScale: boolean;
  showVolume: boolean;
  showEMA20: boolean;
  showEMA50: boolean;
  showEMA200: boolean;
  showSMA20: boolean;
  showBB: boolean;
  showVWAP: boolean;
  showRSI: boolean;
  showMACD: boolean;
  lockNavigation?: boolean;
  onViewportChange: () => void;
  onCrosshairChange?: (info: { candleIndex: number | null; price: number | null; x: number | null; y: number | null }) => void;
  onEngineAvailabilityChange?: (available: boolean) => void;
}

function normalizeUniqueUtcTimestamps(candles: Candle[]): UTCTimestamp[] {
  const out: UTCTimestamp[] = [];
  let prev = 0;
  for (let i = 0; i < candles.length; i++) {
    const raw = candles[i].timestamp;
    let sec = Number.isFinite(raw) ? Math.floor(raw > 1e12 ? raw / 1000 : raw) : 1700000000 + i * 3600;
    if (sec <= prev) {
      sec = prev + 60;
    }
    prev = sec;
    out.push(sec as UTCTimestamp);
  }
  return out;
}

export const TradingViewLightweightCanvas = forwardRef<TradingViewCanvasBridge, TradingViewLightweightCanvasProps>(
  (
    {
      candles,
      timeframe,
      chartStyle,
      scaleMode,
      invertScale,
      magnetMode,
      autoScale,
      showVolume,
      showEMA20,
      showEMA50,
      showEMA200,
      showSMA20,
      showBB,
      showVWAP,
      showRSI,
      showMACD,
      lockNavigation = false,
      onViewportChange,
      onCrosshairChange,
      onEngineAvailabilityChange
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const mainSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
    const indicatorSeriesRefs = useRef<ISeriesApi<SeriesType>[]>([]);
    const isReadyRef = useRef<boolean>(false);
    const candlesLenRef = useRef<number>(candles.length);
    const lastPriceCheckRef = useRef<number | null>(null);
    const samplePriceRef = useRef<number>(candles[candles.length - 1]?.close ?? 100);
    const rafSyncRef = useRef<number>(0);

    candlesLenRef.current = candles.length;
    samplePriceRef.current = candles[candles.length - 1]?.close ?? 100;

    const scheduleViewportSync = () => {
      cancelAnimationFrame(rafSyncRef.current);
      rafSyncRef.current = requestAnimationFrame(() => {
        onViewportChange();
      });
    };

    const onViewportChangeRef = useRef(onViewportChange);
    onViewportChangeRef.current = onViewportChange;
    const onCrosshairChangeRef = useRef(onCrosshairChange);
    onCrosshairChangeRef.current = onCrosshairChange;
    const onAvailabilityRef = useRef(onEngineAvailabilityChange);
    onAvailabilityRef.current = onEngineAvailabilityChange;

    const displayCandles = useMemo(
      () => (chartStyle === 'HEIKIN_ASHI' ? toHeikinAshi(candles) : candles),
      [candles, chartStyle]
    );
    const utcTimes = useMemo(() => normalizeUniqueUtcTimestamps(displayCandles), [displayCandles]);

    // Mount TradingView Lightweight Charts instance once
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      // Guard for headless/JSDOM environments without HTMLCanvasElement 2D context
      try {
        const probe = document.createElement('canvas');
        if (!probe.getContext || !probe.getContext('2d')) {
          isReadyRef.current = false;
          onAvailabilityRef.current?.(false);
          return;
        }
      } catch {
        isReadyRef.current = false;
        onAvailabilityRef.current?.(false);
        return;
      }

      let chart: IChartApi;
      try {
        chart = createChart(el, {
          autoSize: true,
          layout: {
            background: { type: ColorType.Solid, color: '#080d1a' },
            textColor: '#94a3b8',
            fontFamily: "'JetBrains Mono', 'Vazirmatn', sans-serif",
            fontSize: 11,
            panes: {
              separatorColor: '#1e293b',
              separatorHoverColor: '#38bdf8',
              enableResize: true
            }
          },
          grid: {
            vertLines: { color: 'rgba(30, 41, 59, 0.42)', style: LineStyle.Dotted },
            horzLines: { color: 'rgba(30, 41, 59, 0.42)', style: LineStyle.Dotted }
          },
          crosshair: {
            mode: CrosshairMode.Magnet,
            vertLine: {
              color: 'rgba(148, 163, 184, 0.55)',
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: '#1e293b'
            },
            horzLine: {
              color: 'rgba(148, 163, 184, 0.55)',
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: '#1e293b'
            }
          },
          rightPriceScale: {
            borderColor: '#1e293b',
            autoScale: true,
            scaleMargins: {
              top: 0.1,
              bottom: 0.14
            }
          },
          timeScale: {
            borderColor: '#1e293b',
            rightOffset: 8,
            barSpacing: 9,
            minBarSpacing: 2,
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: false,
            fixRightEdge: false
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true
          },
          handleScale: {
            axisPressedMouseMove: {
              time: true,
              price: true
            },
            axisDoubleClickReset: {
              time: true,
              price: true
            },
            mouseWheel: true,
            pinch: true
          }
        });
      } catch {
        isReadyRef.current = false;
        onAvailabilityRef.current?.(false);
        return;
      }

      chartRef.current = chart;
      isReadyRef.current = true;
      onAvailabilityRef.current?.(true);

      const handleLogicalRange = () => {
        onViewportChangeRef.current();
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRange);

      const handleCrosshair = (param: {
        point?: { x: number; y: number };
        logical?: number;
      }) => {
        if (!param.point || !mainSeriesRef.current) {
          onCrosshairChangeRef.current?.({ candleIndex: null, price: null, x: null, y: null });
          return;
        }
        const idx =
          typeof param.logical === 'number' && Number.isFinite(param.logical)
            ? Math.max(0, Math.min(Math.max(0, candlesLenRef.current - 1), Math.round(param.logical)))
            : null;
        const p = mainSeriesRef.current.coordinateToPrice(param.point.y);
        onCrosshairChangeRef.current?.({
          candleIndex: idx,
          price: p !== null && Number.isFinite(p) ? Number(p) : null,
          x: param.point.x,
          y: param.point.y
        });
      };
      chart.subscribeCrosshairMove(handleCrosshair);

      const ro = new ResizeObserver(() => {
        onViewportChangeRef.current();
      });
      ro.observe(el);

      // Watch right price-scale dragging / wheel vertical scaling so SVG overlays never drift
      const checkVerticalScaleDrift = () => {
        if (!mainSeriesRef.current) return;
        const coord = mainSeriesRef.current.priceToCoordinate(samplePriceRef.current);
        const num = coord === null ? null : Number(coord);
        if (num !== lastPriceCheckRef.current) {
          lastPriceCheckRef.current = num;
          onViewportChangeRef.current();
        }
      };

      const onPointerOrWheel = () => {
        requestAnimationFrame(checkVerticalScaleDrift);
      };
      el.addEventListener('pointermove', onPointerOrWheel);
      el.addEventListener('pointerup', onPointerOrWheel);
      el.addEventListener('wheel', onPointerOrWheel, { passive: true });

      return () => {
        cancelAnimationFrame(rafSyncRef.current);
        el.removeEventListener('pointermove', onPointerOrWheel);
        el.removeEventListener('pointerup', onPointerOrWheel);
        el.removeEventListener('wheel', onPointerOrWheel);
        ro.disconnect();
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRange);
        chart.unsubscribeCrosshairMove(handleCrosshair);
        chart.remove();
        chartRef.current = null;
        mainSeriesRef.current = null;
        indicatorSeriesRefs.current = [];
        isReadyRef.current = false;
      };
    }, []);

    // Update interactive options (scaleMode, invertScale, magnetMode, timeframe axis, navigation lock)
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const tvScaleMode =
        scaleMode === 'LOG'
          ? TvPriceScaleMode.Logarithmic
          : scaleMode === 'PERCENT'
          ? TvPriceScaleMode.Percentage
          : TvPriceScaleMode.Normal;

      chart.applyOptions({
        crosshair: {
          mode: magnetMode ? CrosshairMode.Magnet : CrosshairMode.Normal
        },
        timeScale: {
          timeVisible: timeframe === '15M' || timeframe === '1H' || timeframe === '4H',
          secondsVisible: false
        },
        handleScroll: lockNavigation
          ? false
          : {
              mouseWheel: true,
              pressedMouseMove: true,
              horzTouchDrag: true,
              vertTouchDrag: true
            },
        handleScale: lockNavigation
          ? false
          : {
              axisPressedMouseMove: { time: true, price: true },
              axisDoubleClickReset: { time: true, price: true },
              mouseWheel: true,
              pinch: true
            }
      });

      chart.priceScale('right').applyOptions({
        mode: tvScaleMode,
        invertScale,
        autoScale
      });

      scheduleViewportSync();
    }, [scaleMode, invertScale, magnetMode, autoScale, timeframe, lockNavigation]);

    // Sync main price series & all technical indicators + sub-panes
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      // Clean old series safely
      if (mainSeriesRef.current) {
        try {
          chart.removeSeries(mainSeriesRef.current);
        } catch {
          // ignore
        }
        mainSeriesRef.current = null;
      }
      for (const s of indicatorSeriesRefs.current) {
        try {
          chart.removeSeries(s);
        } catch {
          // ignore
        }
      }
      indicatorSeriesRefs.current = [];

      if (displayCandles.length === 0) {
        scheduleViewportSync();
        return;
      }

      // 1. Main Price Series (Pane 0)
      let mainSeries: ISeriesApi<SeriesType>;
      if (chartStyle === 'BARS') {
        const s = chart.addSeries(
          BarSeries,
          {
            upColor: '#10b981',
            downColor: '#f43f5e',
            thinBars: false
          },
          0
        );
        s.setData(
          displayCandles.map((c, idx) => ({
            time: utcTimes[idx],
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
          }))
        );
        mainSeries = s as ISeriesApi<SeriesType>;
      } else if (chartStyle === 'LINE') {
        const s = chart.addSeries(
          LineSeries,
          {
            color: '#22d3ee',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4
          },
          0
        );
        s.setData(
          displayCandles.map((c, idx) => ({
            time: utcTimes[idx],
            value: c.close
          }))
        );
        mainSeries = s as ISeriesApi<SeriesType>;
      } else if (chartStyle === 'AREA') {
        const s = chart.addSeries(
          AreaSeries,
          {
            lineColor: '#22d3ee',
            topColor: 'rgba(34, 211, 238, 0.32)',
            bottomColor: 'rgba(34, 211, 238, 0.02)',
            lineWidth: 2
          },
          0
        );
        s.setData(
          displayCandles.map((c, idx) => ({
            time: utcTimes[idx],
            value: c.close
          }))
        );
        mainSeries = s as ISeriesApi<SeriesType>;
      } else if (chartStyle === 'BASELINE') {
        const basePrice = displayCandles[0]?.close ?? 0;
        const s = chart.addSeries(
          BaselineSeries,
          {
            baseValue: { type: 'price', price: basePrice },
            topLineColor: '#10b981',
            topFillColor1: 'rgba(16, 185, 129, 0.28)',
            topFillColor2: 'rgba(16, 185, 129, 0.03)',
            bottomLineColor: '#f43f5e',
            bottomFillColor1: 'rgba(244, 63, 94, 0.03)',
            bottomFillColor2: 'rgba(244, 63, 94, 0.28)',
            lineWidth: 2
          },
          0
        );
        s.setData(
          displayCandles.map((c, idx) => ({
            time: utcTimes[idx],
            value: c.close
          }))
        );
        mainSeries = s as ISeriesApi<SeriesType>;
      } else {
        const isHollow = chartStyle === 'HOLLOW';
        const s = chart.addSeries(
          CandlestickSeries,
          {
            upColor: isHollow ? 'transparent' : '#10b981',
            downColor: '#f43f5e',
            borderUpColor: '#10b981',
            borderDownColor: '#f43f5e',
            wickUpColor: '#10b981',
            wickDownColor: '#f43f5e',
            borderVisible: true,
            wickVisible: true
          },
          0
        );
        s.setData(
          displayCandles.map((c, idx) => ({
            time: utcTimes[idx],
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
          }))
        );
        mainSeries = s as ISeriesApi<SeriesType>;
      }

      mainSeriesRef.current = mainSeries;

      // 2. Volume Histogram Overlay (Pane 0 bottom band)
      if (showVolume) {
        const volSeries = chart.addSeries(
          HistogramSeries,
          {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume-overlay',
            lastValueVisible: false,
            priceLineVisible: false
          },
          0
        );
        chart.priceScale('volume-overlay', 0).applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 }
        });
        volSeries.setData(
          displayCandles.map((c, idx) => ({
            time: utcTimes[idx],
            value: Math.max(0, c.volume || 0),
            color: c.close >= c.open ? 'rgba(16, 185, 129, 0.34)' : 'rgba(244, 63, 94, 0.34)'
          }))
        );
        indicatorSeriesRefs.current.push(volSeries as ISeriesApi<SeriesType>);
      }

      // 3. Overlay Technical Indicators (Pane 0)
      const addOverlayLine = (vals: Array<number | null>, color: string, title: string, lineWidth: 1 | 2 | 3 | 4 = 1, lineStyle = LineStyle.Solid) => {
        const pts = vals
          .map((v, idx) => (v !== null && Number.isFinite(v) ? { time: utcTimes[idx], value: v } : null))
          .filter((pt): pt is { time: UTCTimestamp; value: number } => pt !== null);
        if (pts.length < 2) return;
        const ls = chart.addSeries(
          LineSeries,
          {
            color,
            lineWidth,
            lineStyle,
            title,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false
          },
          0
        );
        ls.setData(pts);
        indicatorSeriesRefs.current.push(ls as ISeriesApi<SeriesType>);
      };

      if (showEMA20) addOverlayLine(computeEMA(displayCandles, 20), '#fbbf24', 'EMA 20', 2);
      if (showEMA50) addOverlayLine(computeEMA(displayCandles, 50), '#38bdf8', 'EMA 50', 2);
      if (showEMA200) addOverlayLine(computeEMA(displayCandles, 200), '#f472b6', 'EMA 200', 2);
      if (showSMA20) addOverlayLine(computeSMA(displayCandles, 20), '#a3e635', 'SMA 20', 1);
      if (showVWAP) addOverlayLine(computeVWAP(candles), '#fb923c', 'VWAP', 2, LineStyle.Dashed);

      if (showBB) {
        const bb = computeBollingerBands(displayCandles, 20, 2);
        addOverlayLine(bb.map(b => b?.upper ?? null), '#818cf8', 'BB Upper', 1);
        addOverlayLine(bb.map(b => b?.mid ?? null), '#6366f1', 'BB Mid', 1, LineStyle.Dashed);
        addOverlayLine(bb.map(b => b?.lower ?? null), '#818cf8', 'BB Lower', 1);
      }

      // 4. RSI (14) Sub-Pane
      let nextPaneIdx = 1;
      if (showRSI) {
        const rsiPane = nextPaneIdx;
        nextPaneIdx += 1;
        const rsiVals = computeRSI(candles, 14);
        const rsiSeries = chart.addSeries(
          LineSeries,
          {
            color: '#a78bfa',
            lineWidth: 2,
            title: 'RSI (14)',
            priceLineVisible: false,
            lastValueVisible: true
          },
          rsiPane
        );
        const rsiPts = rsiVals
          .map((v, idx) => (v !== null && Number.isFinite(v) ? { time: utcTimes[idx], value: v } : null))
          .filter((pt): pt is { time: UTCTimestamp; value: number } => pt !== null);
        if (rsiPts.length > 0) {
          rsiSeries.setData(rsiPts);
        }
        rsiSeries.createPriceLine({
          price: 70,
          color: 'rgba(244, 63, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '70'
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: 'rgba(16, 185, 129, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '30'
        });
        indicatorSeriesRefs.current.push(rsiSeries as ISeriesApi<SeriesType>);
      }

      // 5. MACD (12, 26, 9) Sub-Pane
      if (showMACD) {
        const macdPane = nextPaneIdx;
        const macdVals = computeMACD(candles, 12, 26, 9);
        const histSeries = chart.addSeries(
          HistogramSeries,
          {
            title: 'MACD Hist',
            priceLineVisible: false,
            lastValueVisible: false
          },
          macdPane
        );
        const histPts = macdVals
          .map((m, idx) =>
            m && m.histogram !== null
              ? {
                  time: utcTimes[idx],
                  value: m.histogram,
                  color: m.histogram >= 0 ? 'rgba(16, 185, 129, 0.68)' : 'rgba(244, 63, 94, 0.68)'
                }
              : null
          )
          .filter((pt): pt is { time: UTCTimestamp; value: number; color: string } => pt !== null);
        if (histPts.length > 0) histSeries.setData(histPts);

        const macdLine = chart.addSeries(
          LineSeries,
          {
            color: '#38bdf8',
            lineWidth: 2,
            title: 'MACD',
            priceLineVisible: false,
            lastValueVisible: true
          },
          macdPane
        );
        const macdLinePts = macdVals
          .map((m, idx) => (m ? { time: utcTimes[idx], value: m.macd } : null))
          .filter((pt): pt is { time: UTCTimestamp; value: number } => pt !== null);
        if (macdLinePts.length > 0) macdLine.setData(macdLinePts);

        const sigLine = chart.addSeries(
          LineSeries,
          {
            color: '#f59e0b',
            lineWidth: 1,
            title: 'Signal',
            priceLineVisible: false,
            lastValueVisible: false
          },
          macdPane
        );
        const sigPts = macdVals
          .map((m, idx) => (m && m.signal !== null ? { time: utcTimes[idx], value: m.signal } : null))
          .filter((pt): pt is { time: UTCTimestamp; value: number } => pt !== null);
        if (sigPts.length > 0) sigLine.setData(sigPts);

        indicatorSeriesRefs.current.push(
          histSeries as ISeriesApi<SeriesType>,
          macdLine as ISeriesApi<SeriesType>,
          sigLine as ISeriesApi<SeriesType>
        );
      }

      // Calibrate pane heights proportionally
      const panes = chart.panes();
      if (panes.length === 2) {
        panes[0].setStretchFactor(0.76);
        panes[1].setStretchFactor(0.24);
      } else if (panes.length >= 3) {
        panes[0].setStretchFactor(0.62);
        panes[1].setStretchFactor(0.19);
        panes[2].setStretchFactor(0.19);
      }

      chart.timeScale().fitContent();
      requestAnimationFrame(() => {
        onViewportChangeRef.current();
      });
    }, [
      candles,
      displayCandles,
      utcTimes,
      chartStyle,
      showVolume,
      showEMA20,
      showEMA50,
      showEMA200,
      showSMA20,
      showBB,
      showVWAP,
      showRSI,
      showMACD
    ]);

    useImperativeHandle(
      ref,
      () => ({
        isReady: () => Boolean(isReadyRef.current && chartRef.current && mainSeriesRef.current),
        getX: (candleIndex: number) => {
          const chart = chartRef.current;
          if (!chart) return null;
          const coord = chart.timeScale().logicalToCoordinate(candleIndex as Logical);
          return coord === null ? null : Number(coord);
        },
        getY: (price: number) => {
          const series = mainSeriesRef.current;
          if (!series) return null;
          const coord = series.priceToCoordinate(price);
          return coord === null ? null : Number(coord);
        },
        getIndexAndPrice: (x: number, y: number) => {
          const chart = chartRef.current;
          const series = mainSeriesRef.current;
          if (!chart || !series) return null;
          const logical = chart.timeScale().coordinateToLogical(x);
          const price = series.coordinateToPrice(y);
          if (logical === null || price === null) return null;
          const maxIdx = Math.max(0, candlesLenRef.current - 1);
          return {
            candleIndex: Math.max(0, Math.min(maxIdx, Math.round(Number(logical)))),
            price: Math.round(Number(price) * 100) / 100
          };
        },
        getPlotGeometry: () => {
          const chart = chartRef.current;
          if (!chart) {
            return { plotWidth: 800, plotHeight: 460, priceScaleWidth: 68, paneCount: 1 };
          }
          const paneSize = chart.paneSize(0);
          const rightScaleWidth = chart.priceScale('right', 0).width();
          return {
            plotWidth: Math.max(100, Math.round(paneSize.width)),
            plotHeight: Math.max(100, Math.round(paneSize.height)),
            priceScaleWidth: Math.max(48, Math.round(rightScaleWidth)),
            paneCount: chart.panes().length
          };
        },
        fitContent: () => {
          const chart = chartRef.current;
          if (!chart) return;
          chart.priceScale('right').applyOptions({ autoScale: true });
          chart.timeScale().fitContent();
          scheduleViewportSync();
        },
        zoomIn: () => {
          const chart = chartRef.current;
          if (!chart) return;
          const lr = chart.timeScale().getVisibleLogicalRange();
          if (!lr) return;
          const span = lr.to - lr.from;
          const center = (lr.from + lr.to) / 2;
          const nextSpan = Math.max(10, span * 0.78);
          chart.timeScale().setVisibleLogicalRange({
            from: center - nextSpan / 2,
            to: center + nextSpan / 2
          });
          scheduleViewportSync();
        },
        zoomOut: () => {
          const chart = chartRef.current;
          if (!chart) return;
          const lr = chart.timeScale().getVisibleLogicalRange();
          if (!lr) return;
          const span = lr.to - lr.from;
          const center = (lr.from + lr.to) / 2;
          const maxSpan = Math.max(20, candlesLenRef.current + 12);
          const nextSpan = Math.min(maxSpan, span * 1.28);
          chart.timeScale().setVisibleLogicalRange({
            from: center - nextSpan / 2,
            to: center + nextSpan / 2
          });
          scheduleViewportSync();
        },
        resetAutoScale: () => {
          const chart = chartRef.current;
          if (!chart) return;
          chart.priceScale('right').applyOptions({ autoScale: true });
          scheduleViewportSync();
        },
        takeScreenshot: () => {
          const chart = chartRef.current;
          if (!chart) return null;
          return chart.takeScreenshot(true, false);
        }
      }),
      []
    );

    return (
      <div
        ref={containerRef}
        data-testid="tradingview-lightweight-canvas"
        dir="ltr"
        className="w-full h-full relative"
      />
    );
  }
);

TradingViewLightweightCanvas.displayName = 'TradingViewLightweightCanvas';
