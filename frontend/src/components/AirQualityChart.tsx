import React, { useState } from 'react';
import type { MeasurementPoint } from '../types';

interface AirQualityChartProps {
  measurements: MeasurementPoint[];
  parameterDisplayName: string;
  units: string;
  stationName: string;
}

function parseIntervalMs(intervalStr?: string | null, periodLabel?: string): number {
  if (intervalStr) {
    const parts = intervalStr.trim().split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseInt(parts[2], 10);
      if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        if (totalMs > 0) return totalMs;
      }
    }
  }
  if (periodLabel) {
    const label = periodLabel.toLowerCase();
    if (label.includes('day')) return 24 * 3600 * 1000;
    if (label.includes('min')) return 15 * 60 * 1000;
  }
  return 3600 * 1000; // Default: 1 hour
}

export const AirQualityChart: React.FC<AirQualityChartProps> = ({
  measurements,
  parameterDisplayName,
  units,
  stationName,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!measurements || measurements.length === 0) {
    return (
      <div className="chart-empty-state" role="status">
        <p>No measurement data points available to plot for the selected time range.</p>
      </div>
    );
  }

  // Chart dimensions
  const width = 800;
  const height = 280;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 45;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // Compute min/max values preserving valid non-negative observations
  const validMeasurements = measurements.filter((m) => typeof m.value === 'number' && !isNaN(m.value) && m.value >= 0);
  if (validMeasurements.length === 0) {
    return (
      <div className="chart-empty-state" role="status">
        <p>No valid non-negative measurement points available to plot for the selected time range.</p>
      </div>
    );
  }
  const values = validMeasurements.map((m) => m.value);
  const minVal = Math.max(0, Math.floor(Math.min(...values) * 0.9));
  const maxVal = Math.max(minVal + 10, Math.ceil(Math.max(...values) * 1.1));

  // Compute time bounds preserving actual timestamps
  const times = validMeasurements.map((m) => new Date(m.datetime_from_utc).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = Math.max(1, maxTime - minTime);

  // Coordinate mapping functions
  const getX = (time: number) => {
    if (timeSpan === 0 || measurements.length === 1) return paddingLeft + innerWidth / 2;
    return paddingLeft + ((time - minTime) / timeSpan) * innerWidth;
  };

  const getY = (val: number) => {
    return paddingTop + innerHeight - ((val - minVal) / (maxVal - minVal)) * innerHeight;
  };

  // Partition measurements into contiguous continuous segments
  // Break the line across any missing interval exceeding 1.5x expected interval (or 90 minutes for hourly data)
  const expectedIntervalMs = parseIntervalMs(validMeasurements[0]?.interval, validMeasurements[0]?.period_label);
  const maxGapThresholdMs = Math.max(expectedIntervalMs * 1.5, 90 * 60 * 1000);

  const segments: MeasurementPoint[][] = [];
  let currentSegment: MeasurementPoint[] = [];

  for (let i = 0; i < validMeasurements.length; i++) {
    const pt = validMeasurements[i];
    if (currentSegment.length === 0) {
      currentSegment.push(pt);
    } else {
      const prevPt = currentSegment[currentSegment.length - 1];
      const prevTime = new Date(prevPt.datetime_from_utc).getTime();
      const currTime = new Date(pt.datetime_from_utc).getTime();
      const delta = currTime - prevTime;

      if (delta > maxGapThresholdMs) {
        // Gap detected: break segment to avoid interpolating across missing data
        segments.push(currentSegment);
        currentSegment = [pt];
      } else {
        currentSegment.push(pt);
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  // Generate horizontal Y-axis grid ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = Math.round(minVal + pct * (maxVal - minVal));
    const yPos = getY(val);
    return { val, yPos };
  });

  // Generate X-axis timestamp ticks (up to 4 ticks)
  const xTicksCount = Math.min(4, validMeasurements.length);
  const xTicks = Array.from({ length: xTicksCount }).map((_, idx) => {
    const tIndex = Math.floor((idx / Math.max(1, xTicksCount - 1)) * (validMeasurements.length - 1));
    const m = validMeasurements[tIndex];
    const time = new Date(m.datetime_from_utc).getTime();
    const xPos = getX(time);
    const dateObj = new Date(m.datetime_from_utc);
    const label = dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return { label, xPos };
  });

  const activePoint = hoveredIndex !== null ? validMeasurements[hoveredIndex] : null;

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <div className="chart-legend">
          <span className="legend-indicator" />
          <span className="legend-text">
            <strong>{parameterDisplayName}</strong> ({units}) · {validMeasurements.length} observations
            {segments.length > 1 && (
              <span className="gap-indicator" style={{ marginLeft: '0.5rem', color: '#f59e0b' }}>
                · {segments.length - 1} data gap{segments.length - 1 > 1 ? 's' : ''} (uninterpolated)
              </span>
            )}
          </span>
        </div>
        {activePoint && (
          <div className="chart-tooltip-display" aria-live="polite">
            <strong>{activePoint.value} {units}</strong> at{' '}
            <span>
              {activePoint.datetime_from_local
                ? `${activePoint.datetime_from_local.replace('T', ' ')} (Local) / `
                : `${new Date(activePoint.datetime_from_utc).toLocaleString()} (Local) / `}
              {new Date(activePoint.datetime_from_utc).toISOString().replace('T', ' ').substring(0, 19)} UTC
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="air-quality-svg"
        role="img"
        aria-label={`Time series chart of ${parameterDisplayName} at ${stationName}`}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={tick.yPos}
              x2={width - paddingRight}
              y2={tick.yPos}
              stroke="#1e2c3d"
              strokeDasharray="4 4"
            />
            <text
              x={paddingLeft - 8}
              y={tick.yPos + 4}
              textAnchor="end"
              className="chart-axis-text"
            >
              {tick.val}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={tick.xPos}
            y={height - 12}
            textAnchor="middle"
            className="chart-axis-text"
          >
            {tick.label}
          </text>
        ))}

        {/* Area fill for contiguous segments only (not across missing intervals) */}
        {segments.map((seg, sIdx) => {
          if (seg.length <= 1) return null;
          const segPointsStr = seg
            .map((m) => {
              const t = new Date(m.datetime_from_utc).getTime();
              return `${getX(t).toFixed(1)},${getY(m.value).toFixed(1)}`;
            })
            .join(' ');
          const firstT = new Date(seg[0].datetime_from_utc).getTime();
          const lastT = new Date(seg[seg.length - 1].datetime_from_utc).getTime();
          const bottomY = (paddingTop + innerHeight).toFixed(1);
          const segArea = `${getX(firstT).toFixed(1)},${bottomY} ${segPointsStr} ${getX(lastT).toFixed(1)},${bottomY}`;

          return (
            <polygon
              key={`seg-area-${sIdx}`}
              points={segArea}
              fill="url(#chartGradient)"
            />
          );
        })}

        {/* Trend Polyline segments broken across missing intervals */}
        {segments.map((seg, sIdx) => {
          if (seg.length <= 1) return null;
          const segPointsStr = seg
            .map((m) => {
              const t = new Date(m.datetime_from_utc).getTime();
              return `${getX(t).toFixed(1)},${getY(m.value).toFixed(1)}`;
            })
            .join(' ');

          return (
            <polyline
              key={`seg-line-${sIdx}`}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={segPointsStr}
            />
          );
        })}

        {/* Data points (preserved actual values, tap/click/hover support for mobile and desktop) */}
        {validMeasurements.map((m, idx) => {
          const t = new Date(m.datetime_from_utc).getTime();
          const cx = getX(t);
          const cy = getY(m.value);
          const isHovered = hoveredIndex === idx;

          return (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={isHovered ? 5.5 : 3.5}
              fill={isHovered ? '#14b8a6' : '#10b981'}
              stroke="#090d12"
              strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setHoveredIndex((prev) => (prev === idx ? null : idx))}
              aria-label={`${m.value} ${units} at ${m.datetime_from_utc}`}
            />
          );
        })}
      </svg>
    </div>
  );
};
