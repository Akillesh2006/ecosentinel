import React, { useState } from 'react';
import type { ComparisonTimeSlice, StationComparisonMetadata } from '../types';

interface SpatialComparisonChartProps {
  timeSlices: ComparisonTimeSlice[];
  stations: StationComparisonMetadata[];
  parameterDisplayName: string;
  units: string;
}

const STATION_COLORS = [
  '#14b8a6', // Teal (Reference Station)
  '#f59e0b', // Amber (Neighbor 1)
  '#38bdf8', // Sky (Neighbor 2)
  '#f43f5e', // Rose (Neighbor 3)
  '#818cf8', // Indigo (Neighbor 4)
];

const MEDIAN_COLOR = '#94a3b8'; // Slate Neutral

function formatIstTime(isoUtc?: string | null, localIso?: string | null): string {
  // Convert verified UTC timestamp directly to IST to prevent any client-side double conversion
  if (isoUtc) {
    try {
      const d = new Date(isoUtc);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      // Fallback
    }
  }
  if (localIso) return localIso;
  return '—';
}

export const SpatialComparisonChart: React.FC<SpatialComparisonChartProps> = ({
  timeSlices,
  stations,
  parameterDisplayName,
  units,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!timeSlices || timeSlices.length === 0) {
    return (
      <div className="chart-empty-state" role="status" aria-label="No comparison data available">
        <p>No measurement time-series points available for the selected comparison window.</p>
      </div>
    );
  }

  // Collect all valid values across all slices and all stations
  const allValues: number[] = [];
  timeSlices.forEach((slice) => {
    stations.forEach((st) => {
      const val = slice.station_values[st.location_id] ?? slice.station_values[String(st.location_id)];
      if (typeof val === 'number' && !isNaN(val) && val >= 0) {
        allValues.push(val);
      }
    });
  });

  if (allValues.length === 0) {
    return (
      <div className="chart-empty-state" role="status" aria-label="No valid non-negative values">
        <p>No valid non-negative observations recorded across selected stations in this window.</p>
      </div>
    );
  }

  // Dimensions
  const width = 800;
  const height = 320;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 45;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const minY = Math.max(0, Math.floor(rawMin * 0.9));
  const maxY = Math.max(minY + 10, Math.ceil(rawMax * 1.1));

  // Time coordinates mapping
  const times = timeSlices.map((s) => new Date(s.datetime_utc).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = Math.max(1, maxTime - minTime);

  const getX = (timeMs: number) => {
    if (timeSpan === 0 || timeSlices.length === 1) return paddingLeft + innerWidth / 2;
    return paddingLeft + ((timeMs - minTime) / timeSpan) * innerWidth;
  };

  const getY = (val: number) => {
    return paddingTop + innerHeight - ((val - minY) / (maxY - minY)) * innerHeight;
  };

  // Build contiguous line segments for each station (breaking lines across null intervals)
  const stationSegments: Record<number, Array<Array<{ x: number; y: number; val: number }>>> = {};

  stations.forEach((st) => {
    const segments: Array<Array<{ x: number; y: number; val: number }>> = [];
    let currentSegment: Array<{ x: number; y: number; val: number }> = [];

    timeSlices.forEach((slice, idx) => {
      const val = slice.station_values[st.location_id] ?? slice.station_values[String(st.location_id)];
      if (typeof val === 'number' && !isNaN(val) && val >= 0) {
        const x = getX(times[idx]);
        const y = getY(val);

        if (currentSegment.length === 0) {
          currentSegment.push({ x, y, val });
        } else {
          // Check previous slice: if previous slice had no valid value for this station, break segment!
          const prevVal =
            idx > 0
              ? timeSlices[idx - 1].station_values[st.location_id] ??
                timeSlices[idx - 1].station_values[String(st.location_id)]
              : null;
          if (prevVal === null || prevVal === undefined) {
            segments.push(currentSegment);
            currentSegment = [{ x, y, val }];
          } else {
            currentSegment.push({ x, y, val });
          }
        }
      } else {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      }
    });

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    stationSegments[st.location_id] = segments;
  });

  // Neighborhood median line segments
  const medianSegments: Array<Array<{ x: number; y: number; val: number }>> = [];
  let currentMedianSegment: Array<{ x: number; y: number; val: number }> = [];

  timeSlices.forEach((slice, idx) => {
    if (typeof slice.neighborhood_median === 'number' && !isNaN(slice.neighborhood_median)) {
      const x = getX(times[idx]);
      const y = getY(slice.neighborhood_median);
      if (currentMedianSegment.length === 0) {
        currentMedianSegment.push({ x, y, val: slice.neighborhood_median });
      } else {
        const prevMed = idx > 0 ? timeSlices[idx - 1].neighborhood_median : null;
        if (prevMed === null || prevMed === undefined) {
          medianSegments.push(currentMedianSegment);
          currentMedianSegment = [{ x, y, val: slice.neighborhood_median }];
        } else {
          currentMedianSegment.push({ x, y, val: slice.neighborhood_median });
        }
      }
    } else {
      if (currentMedianSegment.length > 0) {
        medianSegments.push(currentMedianSegment);
        currentMedianSegment = [];
      }
    }
  });
  if (currentMedianSegment.length > 0) {
    medianSegments.push(currentMedianSegment);
  }

  // Y-axis ticks (4 ticks)
  const yTicks = [minY, Math.round(minY + (maxY - minY) * 0.33), Math.round(minY + (maxY - minY) * 0.66), maxY];

  // X-axis tick intervals
  const xTickIndices: number[] = [];
  if (timeSlices.length <= 6) {
    for (let i = 0; i < timeSlices.length; i++) xTickIndices.push(i);
  } else {
    const step = Math.floor(timeSlices.length / 5);
    for (let i = 0; i < timeSlices.length; i += step) {
      xTickIndices.push(i);
    }
    if (xTickIndices[xTickIndices.length - 1] !== timeSlices.length - 1) {
      xTickIndices.push(timeSlices.length - 1);
    }
  }

  // Hovered slice info
  const hoveredSlice = hoveredIndex !== null ? timeSlices[hoveredIndex] : null;
  const hoveredX = hoveredIndex !== null ? getX(times[hoveredIndex]) : null;

  return (
    <div className="spatial-chart-wrapper" aria-label="Hourly Multi-Station Comparative Chart">
      {/* Legend */}
      <div className="spatial-chart-legend" role="list" aria-label="Comparison Station Series">
        {stations.map((st, idx) => {
          const color = STATION_COLORS[idx % STATION_COLORS.length];
          return (
            <div key={st.location_id} className="spatial-legend-item" role="listitem">
              <span className="spatial-legend-dot" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="spatial-legend-name">{st.station_name}</span>
              {st.is_reference ? (
                <span className="spatial-legend-tag reference">Ref</span>
              ) : (
                <span className="spatial-legend-tag distance">
                  {st.distance_from_reference_km !== null && st.distance_from_reference_km !== undefined
                    ? `${st.distance_from_reference_km.toFixed(1)} km`
                    : 'Dist. N/A'}
                </span>
              )}
            </div>
          );
        })}
        <div className="spatial-legend-item" role="listitem">
          <span className="spatial-legend-line-dashed" aria-hidden="true" />
          <span className="spatial-legend-name">Neighborhood Median</span>
        </div>
      </div>

      {/* SVG Container */}
      <div className="spatial-svg-container" style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="spatial-comparison-svg"
          onMouseLeave={() => setHoveredIndex(null)}
          role="img"
          aria-label={`Time series comparative chart for ${parameterDisplayName}`}
        >
          {/* Background Grid Lines */}
          {yTicks.map((tickVal) => {
            const y = getY(tickVal);
            return (
              <g key={`y-grid-${tickVal}`}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="var(--eco-border-subtle)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--eco-text-muted)"
                  fontSize="11"
                  fontFamily="var(--eco-font-mono)"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* X Axis & Ticks */}
          <line
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={height - paddingBottom}
            y2={height - paddingBottom}
            stroke="var(--eco-border-subtle)"
            strokeWidth="1"
          />

          {xTickIndices.map((idx) => {
            const x = getX(times[idx]);
            const slice = timeSlices[idx];
            return (
              <g key={`x-tick-${idx}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={height - paddingBottom}
                  y2={height - paddingBottom + 5}
                  stroke="var(--eco-border-subtle)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - paddingBottom + 18}
                  textAnchor="middle"
                  fill="var(--eco-text-muted)"
                  fontSize="10"
                  fontFamily="var(--eco-font-sans)"
                >
                  {formatIstTime(slice.datetime_utc, slice.datetime_local)}
                </text>
              </g>
            );
          })}

          {/* Neighborhood Median Path (Dashed neutral line) */}
          {medianSegments.map((seg, sIdx) => {
            const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
            return (
              <path
                key={`median-seg-${sIdx}`}
                d={d}
                fill="none"
                stroke={MEDIAN_COLOR}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                strokeOpacity="0.75"
              />
            );
          })}

          {/* Station Series Polylines */}
          {stations.map((st, idx) => {
            const color = STATION_COLORS[idx % STATION_COLORS.length];
            const segs = stationSegments[st.location_id] || [];
            return (
              <g key={`st-series-${st.location_id}`}>
                {segs.map((seg, sIdx) => {
                  const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                  return (
                    <path
                      key={`st-path-${st.location_id}-${sIdx}`}
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={st.is_reference ? '2.5' : '1.8'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
                {/* Discrete points */}
                {segs.map((seg, sIdx) =>
                  seg.map((p, pIdx) => (
                    <circle
                      key={`pt-${st.location_id}-${sIdx}-${pIdx}`}
                      cx={p.x}
                      cy={p.y}
                      r={st.is_reference ? 3.5 : 2.5}
                      fill={color}
                      stroke="var(--eco-bg-surface)"
                      strokeWidth="1"
                    />
                  ))
                )}
              </g>
            );
          })}

          {/* Hover Crosshair Line */}
          {hoveredX !== null && (
            <line
              x1={hoveredX}
              x2={hoveredX}
              y1={paddingTop}
              y2={height - paddingBottom}
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth="1"
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}

          {/* Interactive Invisible Overlay Rectangles for Hover Detection */}
          {timeSlices.map((_slice, idx) => {
            const x = getX(times[idx]);
            const colWidth = Math.max(12, innerWidth / timeSlices.length);
            return (
              <rect
                key={`hover-col-${idx}`}
                x={x - colWidth / 2}
                y={paddingTop}
                width={colWidth}
                height={innerHeight}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoveredIndex(idx)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredSlice && hoveredIndex !== null && (
          <div
            className="spatial-tooltip-card"
            style={{
              position: 'absolute',
              top: '12px',
              left: `${Math.min(Math.max(10, ((hoveredX! - paddingLeft) / innerWidth) * 85), 65)}%`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div className="spatial-tooltip-header">
              <span className="spatial-tooltip-time">
                {formatIstTime(hoveredSlice.datetime_utc, hoveredSlice.datetime_local)} IST
              </span>
              <span className="spatial-tooltip-contributors">
                {hoveredSlice.contributing_stations} of {stations.length} stations
              </span>
            </div>

            {/* Neighborhood Median */}
            {hoveredSlice.neighborhood_median !== null && hoveredSlice.neighborhood_median !== undefined && (
              <div className="spatial-tooltip-median">
                <span>Neighborhood Median:</span>
                <strong>
                  {hoveredSlice.neighborhood_median} {units}
                </strong>
                {hoveredSlice.neighborhood_iqr !== null && (
                  <span className="spatial-tooltip-iqr">(IQR: {hoveredSlice.neighborhood_iqr})</span>
                )}
              </div>
            )}

            {/* Station Readings */}
            <div className="spatial-tooltip-list">
              {stations.map((st, idx) => {
                const color = STATION_COLORS[idx % STATION_COLORS.length];
                const val =
                  hoveredSlice.station_values[st.location_id] ??
                  hoveredSlice.station_values[String(st.location_id)];
                return (
                  <div key={st.location_id} className="spatial-tooltip-station-row">
                    <span className="spatial-tooltip-dot" style={{ backgroundColor: color }} />
                    <span className="spatial-tooltip-station-name">
                      {st.station_name} {st.is_reference ? '(Ref)' : ''}:
                    </span>
                    {val !== null && val !== undefined ? (
                      <span className="spatial-tooltip-val">
                        {val} {units}
                      </span>
                    ) : (
                      <span className="spatial-tooltip-missing">Missing</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Axis Unit Label */}
      <div className="spatial-chart-caption">
        <span>
          Concentration: <strong>{parameterDisplayName}</strong> ({units}) across synchronized hourly intervals.
          Gaps represent missing observations.
        </span>
      </div>
    </div>
  );
};
