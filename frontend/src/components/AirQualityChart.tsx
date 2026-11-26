import React, { useId, useState } from 'react';
import type { MeasurementPoint } from '../types';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import {
  ChartAxes,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ThresholdLines,
  buildXTicks,
  computeYDomain,
  parseTimestampMs,
  segmentChronologicalSeries,
  type LegendEntry,
  type ThresholdSpec,
} from './charts';
import chartStyles from './charts/Charts.module.css';

export interface AirQualityChartProps {
  measurements: MeasurementPoint[];
  units: string;
  parameterDisplayName: string;
  stationName: string;
  cpcbLimit?: number | null;
  whoGuideline?: number | null;
  parameterCode?: string;
}

const VIEW_W = 760;
const VIEW_H = 260;
const PAD_L = 54;
const PAD_R = 24;
const PAD_T = 24;
const PAD_B = 34;

/**
 * Interactive gap-aware SVG time-series chart for station pollutant telemetry.
 * Sorts valid readings chronologically, leaves missing intervals > 90m broken without
 * interpolation, overlays applicable CPCB/WHO benchmarks, and displays dual IST/UTC tooltips.
 */
export const AirQualityChart: React.FC<AirQualityChartProps> = ({
  measurements,
  units,
  parameterDisplayName,
  stationName,
  cpcbLimit,
  whoGuideline,
  parameterCode,
}) => {
  const gradId = useId().replace(/:/g, '');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const validPoints = measurements
    .filter((m) => !m.is_missing && m.value !== null && Number.isFinite(m.value))
    .map((m) => ({
      raw: m,
      timestampMs: parseTimestampMs(m.datetime_to_utc || m.datetime_from_utc),
      value: m.value as number,
    }))
    .filter((p) => Number.isFinite(p.timestampMs));

  if (validPoints.length === 0) {
    return (
      <Card padding="md" variant="default">
        <EmptyState
          title="No measurement data points available to plot"
          description={`No non-missing ${parameterDisplayName} readings exist in this window for ${stationName}.`}
        />
      </Card>
    );
  }

  const segments = segmentChronologicalSeries(validPoints);
  const gapCount = Math.max(0, segments.length - 1);
  const sortedPoints = segments.flat();

  const minTs = sortedPoints[0].timestampMs;
  const maxTs = sortedPoints[sortedPoints.length - 1].timestampMs;
  const tsSpan = Math.max(1, maxTs - minTs);

  const thresholds: ThresholdSpec[] = [];
  if (cpcbLimit !== null && cpcbLimit !== undefined && Number.isFinite(cpcbLimit)) {
    thresholds.push({
      id: 'cpcb',
      label: `CPCB ${cpcbLimit} ${units}`,
      value: cpcbLimit,
      color: 'var(--eco-status-elevated-text)',
      dashArray: '6 4',
    });
  }
  const paramLower = (parameterCode || '').toLowerCase();
  if (
    paramLower !== 'co' &&
    whoGuideline !== null &&
    whoGuideline !== undefined &&
    Number.isFinite(whoGuideline)
  ) {
    thresholds.push({
      id: 'who',
      label: `WHO ${whoGuideline} ${units}`,
      value: whoGuideline,
      color: 'var(--eco-status-anomaly-text)',
      dashArray: '3 3',
    });
  }

  const { minVal, maxVal, ticks: yTicks } = computeYDomain(
    sortedPoints.map((p) => p.value),
    thresholds.map((t) => t.value)
  );
  const valSpan = Math.max(1e-6, maxVal - minVal);

  const plotW = VIEW_W - PAD_L - PAD_R;
  const plotH = VIEW_H - PAD_T - PAD_B;
  const plotBottom = PAD_T + plotH;

  const xToPx = (ms: number) =>
    sortedPoints.length === 1
      ? PAD_L + plotW / 2
      : PAD_L + ((ms - minTs) / tsSpan) * plotW;
  const yToPx = (val: number) => PAD_T + plotH - ((val - minVal) / valSpan) * plotH;

  const xTicks = buildXTicks(minTs, maxTs, PAD_L, plotW, 5);
  const activePoint = selectedIndex !== null ? sortedPoints[selectedIndex] : null;

  const legendItems: LegendEntry[] = [
    {
      id: 'measured',
      label: `Observed ${parameterDisplayName} (${units})`,
      color: 'var(--eco-teal)',
      kind: 'line',
    },
  ];
  thresholds.forEach((t) => {
    legendItems.push({
      id: t.id,
      label: t.label,
      color: t.color,
      kind: 'dashed',
    });
  });

  const ariaLabel = `Time series chart of ${parameterDisplayName} at ${stationName}`;

  return (
    <Card padding="md" variant="default">
      <CardHeader>
        <div>
          <CardTitle>{parameterDisplayName} Hourly Telemetry Profile</CardTitle>
          <CardDescription>
            Click any observation point to inspect recorded timestamp details.
          </CardDescription>
        </div>
      </CardHeader>

      <ChartContainer
        ariaLabel={ariaLabel}
        viewBoxWidth={VIEW_W}
        viewBoxHeight={VIEW_H}
        tooltip={
          activePoint ? (
            <ChartTooltip
              valueLabel={
                activePoint.value % 1 === 0
                  ? String(activePoint.value)
                  : Number(activePoint.value.toFixed(2)).toString()
              }
              units={units}
              localTime={activePoint.raw.datetime_to_local || activePoint.raw.datetime_from_local}
              utcTime={activePoint.raw.datetime_to_utc || activePoint.raw.datetime_from_utc}
            />
          ) : undefined
        }
        footer={<ChartLegend items={legendItems} gapCount={gapCount} />}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--eco-teal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--eco-teal)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <ChartAxes
          plotLeft={PAD_L}
          plotRight={VIEW_W - PAD_R}
          plotTop={PAD_T}
          plotBottom={plotBottom}
          yTicks={yTicks}
          yToPx={yToPx}
          xTicks={xTicks}
          yAxisUnit={units}
        />

        <ThresholdLines
          thresholds={thresholds}
          plotLeft={PAD_L}
          plotRight={VIEW_W - PAD_R}
          plotTop={PAD_T}
          plotBottom={plotBottom}
          yToPx={yToPx}
        />

        {segments.map((seg, sIdx) => {
          const pts = seg.map((p) => `${xToPx(p.timestampMs).toFixed(1)},${yToPx(p.value).toFixed(1)}`);
          const firstX = xToPx(seg[0].timestampMs).toFixed(1);
          const lastX = xToPx(seg[seg.length - 1].timestampMs).toFixed(1);
          const areaPts = `${pts.join(' ')} ${lastX},${plotBottom} ${firstX},${plotBottom}`;
          return (
            <g key={`seg-${sIdx}`}>
              {seg.length > 1 && <polygon points={areaPts} fill={`url(#${gradId})`} />}
              {seg.length > 1 && (
                <polyline
                  points={pts.join(' ')}
                  fill="none"
                  stroke="var(--eco-teal)"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={chartStyles.animatedStroke}
                />
              )}
            </g>
          );
        })}

        {sortedPoints.map((pt, idx) => {
          const cx = xToPx(pt.timestampMs);
          const cy = yToPx(pt.value);
          const isSelected = selectedIndex === idx;
          return (
            <circle
              key={`pt-${idx}`}
              cx={cx}
              cy={cy}
              r={isSelected ? 5.5 : 3.6}
              fill={isSelected ? 'var(--eco-lime)' : 'var(--eco-teal-text)'}
              stroke="var(--eco-bg-canvas)"
              strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedIndex(isSelected ? null : idx)}
            />
          );
        })}
      </ChartContainer>
    </Card>
  );
};
