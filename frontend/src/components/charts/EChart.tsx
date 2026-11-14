import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "@/hooks/useTheme";

export function useChartPalette() {
  const { theme } = useTheme();
  const palette = {
    text: theme === "dark" ? "#f0eee7" : "#182a3a",
    muted: theme === "dark" ? "#97a3ad" : "#68727c",
    border: theme === "dark" ? "#29333c" : "#e5e3dc",
    surface: theme === "dark" ? "#161e25" : "#ffffff",
    navy: theme === "dark" ? "#a8c4de" : "#173b64",
    accent: theme === "dark" ? "#7fa7c9" : "#477ca8",
    positive: theme === "dark" ? "#8aac97" : "#6f927d",
    warning: theme === "dark" ? "#d3ac72" : "#c49a5b",
    negative: theme === "dark" ? "#d79289" : "#c87970",
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
