import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "@/hooks/useTheme";

export function useChartPalette() {
  const { theme } = useTheme();
  const palette = {
    text: theme === "dark" ? "#ecf7f1" : "#0b1f18",
    muted: theme === "dark" ? "#93ab9f" : "#65786f",
    border: theme === "dark" ? "#1e352b" : "#e3ebe6",
    surface: theme === "dark" ? "#0f1e18" : "#ffffff",
    navy: theme === "dark" ? "#d8f26b" : "#0b1f18",
    accent: theme === "dark" ? "#4ade9f" : "#0f9d6e",
    positive: theme === "dark" ? "#4ade9f" : "#0a8a60",
    warning: theme === "dark" ? "#e0bb72" : "#a9761a",
    negative: theme === "dark" ? "#f0918a" : "#c0392b",
  };
  return palette;
}

export function EChart({
  option,
  height = 320,
  ariaLabel,
  className,
  onEvents,
}: {
  option: echarts.EChartsOption;
  height?: number;
  ariaLabel: string;
  className?: string;
  onEvents?: Record<string, (params: unknown) => void>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, true);
    if (onEvents) {
      Object.entries(onEvents).forEach(([event, handler]) => {
        chart.off(event);
        chart.on(event, handler);
      });
    }
  }, [option, onEvents]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ width: "100%", height }}
    />
  );
}
