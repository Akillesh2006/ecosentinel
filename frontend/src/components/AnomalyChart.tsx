import React, { useState } from 'react';
import type { AnomalyObservationPoint, BaselineMetrics } from '../types';

export interface AnomalyChartProps {
  observations: AnomalyObservationPoint[];
  baselineMetrics?: BaselineMetrics | null;
  parameterDisplayName: string;
  units: string;
  stationName: string;
  selectedObservation: AnomalyObservationPoint | null;
  onSelectObservation: (obs: AnomalyObservationPoint) => void;
}

export const AnomalyChart: React.FC<AnomalyChartProps> = ({
  observations,
  baselineMetrics,
  parameterDisplayName,
  units,
  stationName,
  selectedObservation,
  onSelectObservation,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<AnomalyObservationPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  if (!observations || observations.length === 0) {
    return (
      <div className="chart-empty-state" role="status">
        <p>No observation data points available for statistical anomaly evaluation.</p>
      </div>
    );
  }

  // Ensure strict chronological ordering
  const sortedObs = [...observations].sort(
    (a, b) => new Date(a.datetime_utc).getTime() - new Date(b.datetime_utc).getTime()
  );

  // SVG Chart Dimensions
  const width = 840;
  const height = 320;
  const paddingLeft = 65;
  const paddingRight = 35;
  const paddingTop = 30;
  const paddingBottom = 45;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // Extract values and include baseline median if valid
  const observedValues = sortedObs.map((o) => o.observed_value);
  const allScaleValues = [...observedValues];
  if (baselineMetrics?.median !== undefined && baselineMetrics?.median !== null) {
    allScaleValues.push(baselineMetrics.median);
  }

  const rawMin = Math.min(...allScaleValues);
  const rawMax = Math.max(...allScaleValues);
  const minVal = Math.max(0, Math.floor(rawMin * 0.9));
  const maxVal = Math.max(minVal + 10, Math.ceil(rawMax * 1.15));

  // Time range calculation
  const times = sortedObs.map((o) => new Date(o.datetime_utc).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = Math.max(1, maxTime - minTime);

  const getX = (timeMs: number) => {
    if (timeSpan === 0 || sortedObs.length === 1) return paddingLeft + innerWidth / 2;
    return paddingLeft + ((timeMs - minTime) / timeSpan) * innerWidth;
  };

  const getY = (val: number) => {
    if (maxVal === minVal) return paddingTop + innerHeight / 2;
    return paddingTop + innerHeight - ((val - minVal) / (maxVal - minVal)) * innerHeight;
  };

  // Partition observations into contiguous segments
  // Break across any gap exceeding 90 minutes (5,400,000 ms) - no synthetic padding
  const maxGapMs = 90 * 60 * 1000;
  const segments: AnomalyObservationPoint[][] = [];
  let currentSegment: AnomalyObservationPoint[] = [];

  for (let i = 0; i < sortedObs.length; i++) {
    const pt = sortedObs[i];
    if (currentSegment.length === 0) {
      currentSegment.push(pt);
    } else {
      const prevPt = currentSegment[currentSegment.length - 1];
      const gap = new Date(pt.datetime_utc).getTime() - new Date(prevPt.datetime_utc).getTime();
      if (gap > maxGapMs) {
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

  // Y-axis ticks
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    return Math.round(minVal + (i / (yTickCount - 1)) * (maxVal - minVal));
  });

  // X-axis time ticks
  const xTickCount = Math.min(6, sortedObs.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const timeMs = minTime + (i / Math.max(1, xTickCount - 1)) * timeSpan;
    return {
      timeMs,
      x: getX(timeMs),
      label: new Date(timeMs).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  });

  // Format local display
  const formatTime = (isoUtc: string, isoLocal?: string | null) => {
    if (isoLocal) return isoLocal;
    try {
      return new Date(isoUtc).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return isoUtc;
    }
  };

  return (
    <div className="anomaly-chart-container" style={{ position: 'relative' }}>
      <div className="chart-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--eco-text-primary)', margin: 0 }}>
            {parameterDisplayName} Concentration Timeline & Anomaly Markers
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)' }}>
            Station: {stationName} • Leave-one-out non-parametric screening • Gaps &gt;90m broken
          </span>
        </div>

        {/* Legend */}
        <div className="anomaly-chart-legend" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--eco-text-secondary)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', transform: 'rotate(45deg)', background: 'var(--eco-status-anomaly)', display: 'inline-block' }} />
            Spike (M ≥ +3.5)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', transform: 'rotate(45deg)', background: 'var(--eco-status-info)', display: 'inline-block' }} />
            Drop (M ≤ -3.5)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', transform: 'rotate(45deg)', background: 'var(--eco-status-elevated)', display: 'inline-block' }} />
            Moderate (2.5 ≤ |M| &lt; 3.5)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1.5px dashed var(--eco-status-anomaly)', display: 'inline-block' }} />
            CPCB Exceedance
          </span>
          {baselineMetrics?.median !== undefined && baselineMetrics?.median !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '14px', height: '0', borderTop: '2px dashed var(--eco-teal)', display: 'inline-block' }} />
              Median Baseline
            </span>
          )}
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', minWidth: '600px', display: 'block' }}
          role="img"
          aria-label={`Time series chart of ${parameterDisplayName} with anomaly markers and baseline`}
        >
          {/* Background gridlines */}
          {yTicks.map((tickVal) => {
            const y = getY(tickVal);
            return (
              <g key={`y-grid-${tickVal}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--eco-border-subtle)"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="var(--eco-text-muted)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="var(--eco-font-mono)"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Units label on Y-axis */}
          <text
            x={paddingLeft - 8}
            y={paddingTop - 10}
            fill="var(--eco-text-muted)"
            fontSize="10"
            textAnchor="end"
            fontFamily="var(--eco-font-mono)"
          >
            {units}
          </text>

          {/* Median baseline line */}
          {baselineMetrics?.median !== undefined && baselineMetrics?.median !== null && (
            <g>
              <line
                x1={paddingLeft}
                y1={getY(baselineMetrics.median)}
                x2={width - paddingRight}
                y2={getY(baselineMetrics.median)}
                stroke="var(--eco-teal)"
                strokeWidth="1.75"
                strokeDasharray="4,4"
              />
              <text
                x={width - paddingRight - 4}
                y={getY(baselineMetrics.median) - 5}
                fill="var(--eco-teal)"
                fontSize="10"
                textAnchor="end"
                fontWeight="600"
              >
                Median: {baselineMetrics.median.toFixed(1)} {units}
              </text>
            </g>
          )}

          {/* Polyline segments broken across >90m gaps */}
          {segments.map((seg, sIdx) => {
            const pointsStr = seg.map((p) => `${getX(new Date(p.datetime_utc).getTime())},${getY(p.observed_value)}`).join(' ');
            return (
              <g key={`segment-${sIdx}`}>
                <polyline
                  points={pointsStr}
                  fill="none"
                  stroke="var(--eco-teal)"
                  strokeWidth="1.5"
                  strokeOpacity="0.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* X-axis ticks */}
          {xTicks.map((tick, i) => (
            <g key={`x-tick-${i}`}>
              <line
                x1={tick.x}
                y1={paddingTop + innerHeight}
                x2={tick.x}
                y2={paddingTop + innerHeight + 5}
                stroke="var(--eco-border-subtle)"
                strokeWidth="1"
              />
              <text
                x={tick.x}
                y={paddingTop + innerHeight + 18}
                fill="var(--eco-text-muted)"
                fontSize="10"
                textAnchor="middle"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Observation Markers */}
          {sortedObs.map((obs, idx) => {
            const timeMs = new Date(obs.datetime_utc).getTime();
            const cx = getX(timeMs);
            const cy = getY(obs.observed_value);

            const isSelected = selectedObservation?.datetime_utc === obs.datetime_utc;
            const isHovered = hoveredPoint?.datetime_utc === obs.datetime_utc;

            // Classify marker style
            const isSpike = obs.anomaly_type === 'STATISTICAL_SPIKE' || (obs.modified_z_score !== null && (obs.modified_z_score ?? 0) >= 3.5);
            const isDrop = obs.anomaly_type === 'STATISTICAL_DROP' || (obs.modified_z_score !== null && (obs.modified_z_score ?? 0) <= -3.5);
            const isModerate =
              obs.anomaly_type === 'MODERATE_ELEVATION' ||
              (obs.modified_z_score !== null && Math.abs(obs.modified_z_score ?? 0) >= 2.5 && Math.abs(obs.modified_z_score ?? 0) < 3.5);

            let markerFill = 'var(--eco-text-secondary)';
            if (isSpike) markerFill = 'var(--eco-status-anomaly)';
            else if (isDrop) markerFill = 'var(--eco-status-info)';
            else if (isModerate) markerFill = 'var(--eco-status-elevated)';
            else markerFill = '#10b981';

            const diamondPath = (x: number, y: number, r: number) =>
              `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;

            return (
              <g
                key={`obs-${idx}-${obs.datetime_utc}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectObservation(obs)}
                onMouseEnter={() => {
                  setHoveredPoint(obs);
                  setTooltipPos({ x: cx, y: cy });
                }}
                onMouseLeave={() => {
                  setHoveredPoint(null);
                  setTooltipPos(null);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Observation at ${obs.datetime_utc}: ${obs.observed_value} ${units}, ${obs.anomaly_type || 'NORMAL'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectObservation(obs);
                  }
                }}
              >
                {/* Active selection glow ring */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="12"
                    fill="none"
                    stroke="var(--eco-teal)"
                    strokeWidth="2.5"
                    strokeOpacity="0.8"
                  />
                )}

                {/* Hover ring */}
                {isHovered && !isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="10"
                    fill="none"
                    stroke="var(--eco-text-primary)"
                    strokeWidth="1.5"
                    strokeOpacity="0.5"
                  />
                )}

                {/* Statutory CPCB Exceedance Decoupled Ring */}
                {obs.is_cpcb_exceedance && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8.5"
                    fill="none"
                    stroke="var(--eco-status-anomaly)"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                  >
                    <title>CPCB Statutory Exceedance</title>
                  </circle>
                )}

                {/* Shape rendering: Diamond for statistical spikes/drops/moderates; Circle for normal */}
                {isSpike || isDrop || isModerate ? (
                  <path
                    d={diamondPath(cx, cy, isSpike ? 6 : 5)}
                    fill={markerFill}
                    stroke="var(--eco-bg-canvas)"
                    strokeWidth="1"
                  />
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="3.5"
                    fill={markerFill}
                    stroke="var(--eco-bg-canvas)"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Overlay */}
      {hoveredPoint && tooltipPos && (
        <div
          className="anomaly-chart-tooltip"
          style={{
            position: 'absolute',
            left: `${Math.min(Math.max(10, tooltipPos.x - 120), width - 260)}px`,
            top: `${Math.max(10, tooltipPos.y - 110)}px`,
            background: 'var(--eco-bg-card)',
            border: '1px solid var(--eco-border-strong)',
            borderRadius: 'var(--eco-radius-md)',
            padding: '0.65rem 0.85rem',
            boxShadow: 'var(--eco-shadow-md)',
            pointerEvents: 'none',
            zIndex: 30,
            maxWidth: '260px',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--eco-text-primary)', fontSize: '0.85rem' }}>
              {hoveredPoint.observed_value} {units}
            </span>
            <span
              className={`badge badge-${
                hoveredPoint.anomaly_type === 'STATISTICAL_SPIKE'
                  ? 'anomaly'
                  : hoveredPoint.anomaly_type === 'STATISTICAL_DROP'
                  ? 'info'
                  : hoveredPoint.anomaly_type === 'MODERATE_ELEVATION'
                  ? 'warning'
                  : 'normal'
              }`}
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}
            >
              {hoveredPoint.anomaly_type || 'NORMAL'}
            </span>
          </div>

          <div style={{ color: 'var(--eco-text-muted)', marginBottom: '0.25rem' }}>
            {formatTime(hoveredPoint.datetime_utc, hoveredPoint.datetime_local)}
          </div>

          <div style={{ borderTop: '1px solid var(--eco-border-subtle)', paddingTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--eco-text-secondary)' }}>Mod. Z-Score:</span>
              <span style={{ fontFamily: 'var(--eco-font-mono)', color: 'var(--eco-text-primary)' }}>
                {hoveredPoint.scale_state === 'INDETERMINATE_ZERO_MAD'
                  ? 'Indeterminate (Zero-MAD)'
                  : hoveredPoint.modified_z_score !== null && hoveredPoint.modified_z_score !== undefined
                  ? `${hoveredPoint.modified_z_score > 0 ? '+' : ''}${hoveredPoint.modified_z_score.toFixed(2)} M`
                  : 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--eco-text-secondary)' }}>CPCB Standard:</span>
              <span style={{ color: hoveredPoint.is_cpcb_exceedance ? 'var(--eco-status-anomaly)' : 'var(--eco-status-normal)' }}>
                {hoveredPoint.is_cpcb_exceedance ? 'Exceeds Standard' : 'Within Standard'}
              </span>
            </div>

            {hoveredPoint.step_change_from_prior !== null && hoveredPoint.step_change_from_prior !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--eco-text-secondary)' }}>Step Change (Δ):</span>
                <span style={{ fontFamily: 'var(--eco-font-mono)', color: 'var(--eco-text-primary)' }}>
                  {hoveredPoint.step_change_from_prior > 0 ? '+' : ''}
                  {hoveredPoint.step_change_from_prior.toFixed(1)} {units}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
