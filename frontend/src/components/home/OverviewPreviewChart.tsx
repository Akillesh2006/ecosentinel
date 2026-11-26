import React, { useId, useState } from 'react';
import { Radio, ArrowRight } from 'lucide-react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../../types';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonChart } from '../ui/Skeleton';
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
} from '../charts';
import styles from './Home.module.css';
import chartStyles from '../charts/Charts.module.css';

export interface OverviewPreviewChartProps {
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  isLoadingMeasurements?: boolean;
  onExploreStations: () => void;
}

const VIEW_W = 760;
const VIEW_H = 236;
const PAD_L = 52;
const PAD_R = 24;
const PAD_T = 24;
const PAD_B = 34;

/**
 * Verified OpenAQ observation preview chart on the Home workspace.
 * Displays an explicit empty or loading state when telemetry is unavailable,
 * never renders hardcoded sample points, and breaks polylines cleanly at >90m gaps.
 */
export const OverviewPreviewChart: React.FC<OverviewPreviewChartProps> = ({
  selectedLocation,
  measurementsData,
  assessmentData,
  isLoadingMeasurements = false,
  onExploreStations,
}) => {
  const gradId = useId().replace(/:/g, '');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (isLoadingMeasurements) {
    return (
      <Card padding="md" variant="default">
        <CardHeader>
          <div>
            <CardTitle>Loading verified observations...</CardTitle>
            <CardDescription>
              Retrieving timestamped telemetry from OpenAQ v3 for {selectedLocation?.name || 'selected station'}.
            </CardDescription>
          </div>
          <Badge tone="info" dot>
            Fetching
          </Badge>
        </CardHeader>
        <SkeletonChart label="Fetching OpenAQ telemetry" />
      </Card>
    );
  }

  const validPoints = (measurementsData?.measurements || [])
    .filter((m) => !m.is_missing && m.value !== null && Number.isFinite(m.value))
    .map((m) => {
      const ts = parseTimestampMs(m.datetime_to_utc || m.datetime_from_utc);
      return {
        raw: m,
        timestampMs: ts,
        value: m.value as number,
      };
    })
    .filter((p) => Number.isFinite(p.timestampMs));

  if (!measurementsData || validPoints.length === 0) {
    return (
      <Card padding="md" variant="default">
        <CardHeader>
          <div>
            <CardTitle>Verified Observation Preview</CardTitle>
            <CardDescription>
              Hourly physical sensor measurements render here once a station is loaded.
            </CardDescription>
          </div>
          <Badge tone="muted">No Active Stream</Badge>
        </CardHeader>
        <EmptyState
          icon={<Radio size={24} />}
          title="No verified observations available"
          description="Select an Indian monitoring station in the Stations workspace to retrieve live or historical OpenAQ v3 telemetry."
          actions={
            <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />} onClick={onExploreStations}>
              Open Stations Workspace
            </Button>
          }
        />
      </Card>
    );
  }

  const segments = segmentChronologicalSeries(validPoints);
  const gapCount = Math.max(0, segments.length - 1);
  const sortedPoints = segments.flat();

  // Preserve full requested window X-domain when provided so missing gaps stay visually true
  const reqFromMs = parseTimestampMs(measurementsData.requested_from_utc);
  const reqToMs = parseTimestampMs(measurementsData.requested_to_utc);
  const minObsMs = sortedPoints[0].timestampMs;
  const maxObsMs = sortedPoints[sortedPoints.length - 1].timestampMs;

  const domainMinTs = Number.isFinite(reqFromMs) ? Math.min(reqFromMs, minObsMs) : minObsMs;
  const domainMaxTs = Number.isFinite(reqToMs) ? Math.max(reqToMs, maxObsMs) : maxObsMs;
  const tsSpan = Math.max(1, domainMaxTs - domainMinTs);

  const paramLower = measurementsData.parameter.toLowerCase();
  const matchedAssessment =
    assessmentData && assessmentData.parameter?.toLowerCase() === paramLower
      ? assessmentData
      : null;

  const thresholds: ThresholdSpec[] = [];
  if (
    matchedAssessment?.standard_threshold !== null &&
    matchedAssessment?.standard_threshold !== undefined &&
    (matchedAssessment.standard_unit || matchedAssessment.units) === measurementsData.units
  ) {
    thresholds.push({
      id: 'cpcb',
      label: `CPCB ${matchedAssessment.standard_threshold}`,
      value: matchedAssessment.standard_threshold,
      color: 'var(--eco-status-elevated-text)',
      dashArray: '6 4',
    });
  }
  if (
    paramLower !== 'co' &&
    matchedAssessment?.secondary_benchmark_threshold !== null &&
    matchedAssessment?.secondary_benchmark_threshold !== undefined &&
    (matchedAssessment.secondary_benchmark_unit || matchedAssessment.units) === measurementsData.units
  ) {
    thresholds.push({
      id: 'who',
      label: `WHO ${matchedAssessment.secondary_benchmark_threshold}`,
      value: matchedAssessment.secondary_benchmark_threshold,
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

  const xToPx = (ms: number) => PAD_L + ((ms - domainMinTs) / tsSpan) * plotW;
  const yToPx = (v: number) => PAD_T + plotH - ((v - minVal) / valSpan) * plotH;

  const xTicks = buildXTicks(domainMinTs, domainMaxTs, PAD_L, plotW, 5);
  const activePoint = selectedIndex !== null ? sortedPoints[selectedIndex] : null;

  const legendItems: LegendEntry[] = [
    {
      id: 'series',
      label: `${measurementsData.parameter_display_name} (${measurementsData.units})`,
      color: 'var(--eco-teal)',
      kind: 'line',
    },
  ];
  thresholds.forEach((t) => {
    legendItems.push({ id: t.id, label: t.label, color: t.color, kind: 'dashed' });
  });

  const ariaLabel = `${measurementsData.parameter_display_name} verified observation time-series chart for ${measurementsData.station_name}`;

  return (
    <Card padding="md" variant="default">
      <CardHeader>
        <div>
          <CardTitle>
            {measurementsData.station_name} — {measurementsData.parameter_display_name} Verified Trend
          </CardTitle>
          <CardDescription>
            Showing {validPoints.length} physical observations ({measurementsData.units}). Missing hours remain broken without interpolation.
          </CardDescription>
        </div>
        <div className={styles.previewHeaderMeta}>
          <Badge tone={measurementsData.is_stale ? 'elevated' : 'normal'}>
            {measurementsData.is_stale ? 'Stale Window' : 'Verified Stream'}
          </Badge>
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />} onClick={onExploreStations}>
            Full Telemetry
          </Button>
        </div>
      </CardHeader>

      <ChartContainer
        ariaLabel={ariaLabel}
        viewBoxWidth={VIEW_W}
        viewBoxHeight={VIEW_H}
        tooltip={
          activePoint ? (
            <ChartTooltip
              valueLabel={activePoint.value.toFixed(2)}
              units={measurementsData.units}
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
          yAxisUnit={measurementsData.units}
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
          const coordPairs = seg.map((p) => `${xToPx(p.timestampMs).toFixed(1)},${yToPx(p.value).toFixed(1)}`);
          const firstX = xToPx(seg[0].timestampMs).toFixed(1);
          const lastX = xToPx(seg[seg.length - 1].timestampMs).toFixed(1);
          const areaPoints = `${coordPairs.join(' ')} ${lastX},${plotBottom} ${firstX},${plotBottom}`;
          return (
            <g key={`seg-${sIdx}`}>
              {seg.length > 1 && <polygon points={areaPoints} fill={`url(#${gradId})`} />}
              {seg.length > 1 && (
                <polyline
                  points={coordPairs.join(' ')}
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
              r={isSelected ? 5.2 : 3.4}
              fill={isSelected ? 'var(--eco-lime)' : 'var(--eco-teal-text)'}
              stroke="var(--eco-bg-canvas)"
              strokeWidth={1.4}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedIndex(isSelected ? null : idx)}
            />
          );
        })}
      </ChartContainer>
    </Card>
  );
};

