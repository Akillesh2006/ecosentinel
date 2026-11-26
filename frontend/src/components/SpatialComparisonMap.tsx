import React, { useState } from 'react';
import type { StationComparisonMetadata } from '../types';
import {
  isValidCoordinate,
  NEIGHBOR_COLORS,
  projectSpatialMap,
  REF_COLOR,
} from './spatial/mapProjection';
import styles from './spatial/SpatialMap.module.css';

export { isValidCoordinate };

export interface SpatialComparisonMapProps {
  stations: StationComparisonMetadata[];
  radiusKm?: number;
  parameterDisplayName: string;
  units: string;
}

const SWATCH_CLASSES = [
  styles.tooltipSwatchN0,
  styles.tooltipSwatchN1,
  styles.tooltipSwatchN2,
  styles.tooltipSwatchN3,
];

export const SpatialComparisonMap: React.FC<SpatialComparisonMapProps> = ({
  stations,
  radiusKm = 25.0,
  parameterDisplayName,
  units,
}) => {
  const [hoveredStationId, setHoveredStationId] = useState<number | null>(null);

  const validStations: StationComparisonMetadata[] = [];
  const missingCoordStations: StationComparisonMetadata[] = [];

  stations.forEach((st) => {
    if (isValidCoordinate(st.coordinates)) {
      validStations.push(st);
    } else {
      missingCoordStations.push(st);
    }
  });

  if (validStations.length === 0) {
    return (
      <div className="card spatial-map-card" role="region" aria-label="Geographic Point Network Map">
        <div className={`card-header ${styles.headerSimple}`}>
          <div>
            <span className="card-badge">Geographic Point Network</span>
            <h3 className={styles.title}>
              Station Siting &amp; Spatial Distribution ({parameterDisplayName})
            </h3>
          </div>
        </div>
        <div
          className={`spatial-map-empty-state ${styles.emptyState}`}
          role="status"
          aria-label="No geographical coordinates available"
        >
          <div className={styles.emptyTitle}>No Geographical Coordinates Available</div>
          <p className={styles.emptyBody}>
            None of the participating stations report valid geographical coordinates on the WGS-84 datum.
            Station observation telemetry remains evaluated in the comparison chart and evidence table.
          </p>
          {missingCoordStations.length > 0 && (
            <ul className={styles.missingList}>
              {missingCoordStations.map((st) => (
                <li key={st.location_id}>
                  Station {st.location_id} ({st.station_name}) — omitted from geographic map (coordinates unavailable).
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`spatial-disclaimer-box ${styles.disclaimer}`}>
          Point Observation Notice: Station markers represent discrete physical monitor coordinates on the WGS-84 datum. Ambient monitors reflect local micro-environments and do not depict continuous spatial airsheds, regional dispersion gradients, or industrial emission source attribution.
        </div>
      </div>
    );
  }

  const proj = projectSpatialMap(validStations, radiusKm);
  const refStationProjected = proj.projectedStations.find((p) => p.station.is_reference);
  const scaleBarX = proj.paddingLeft + 15;
  const scaleBarY = proj.height - 20;
  const hoveredProjected = proj.projectedStations.find((p) => p.station.location_id === hoveredStationId);

  return (
    <div className="card spatial-map-card" role="region" aria-label="Geographic Point Network Map">
      <div className={`card-header ${styles.header}`}>
        <div>
          <span className="card-badge">Geographic Point Network</span>
          <h3 className={styles.title}>
            Station Siting &amp; Spatial Distribution ({parameterDisplayName})
          </h3>
          <p className={styles.subtitle}>
            Showing {validStations.length} of {stations.length} participating stations projected via cosine-adjusted equirectangular geometry (WGS-84).
          </p>
        </div>

        <div className={styles.badgesRow}>
          <span className={`badge badge-normal ${styles.badgeSmall}`}>Search Radius: {radiusKm} km</span>
          {proj.hasCoLocatedStations && (
            <span
              className={`badge badge-warning ${styles.badgeSmall}`}
              title="Stations with identical or near-coincident coordinates have been visually offset to prevent marker overlap. Actual coordinates and distances remain unmodified."
            >
              Co-Located Stations Offset
            </span>
          )}
        </div>
      </div>

      <div className={`spatial-map-container ${styles.mapContainer}`}>
        <svg
          viewBox={`0 0 ${proj.width} ${proj.height}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          className={`spatial-map-svg ${styles.mapSvg}`}
          role="img"
          aria-label={`Geographic station location map for ${parameterDisplayName} comparison ensemble`}
        >
          <defs>
            <filter id="teal-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <g className="spatial-map-grid" stroke="var(--eco-border-subtle)" strokeWidth="0.8" strokeDasharray="3 4">
            <line
              x1={proj.paddingLeft}
              y1={proj.offsetY + proj.usedH / 2}
              x2={proj.width - proj.paddingRight}
              y2={proj.offsetY + proj.usedH / 2}
            />
            <line
              x1={proj.offsetX + proj.usedW / 2}
              y1={proj.paddingTop}
              x2={proj.offsetX + proj.usedW / 2}
              y2={proj.height - proj.paddingBottom}
            />
          </g>

          <text
            x={proj.paddingLeft + 8}
            y={proj.offsetY + proj.usedH / 2 - 4}
            fill="var(--eco-text-muted)"
            fontSize="9"
            fontFamily="var(--eco-font-mono)"
          >
            Lat: {proj.midLat.toFixed(2)}°N
          </text>
          <text
            x={proj.offsetX + proj.usedW / 2 + 4}
            y={proj.height - proj.paddingBottom - 6}
            fill="var(--eco-text-muted)"
            fontSize="9"
            fontFamily="var(--eco-font-mono)"
          >
            Lon: {((proj.boxLonMin + proj.boxLonMax) / 2).toFixed(2)}°E
          </text>

          {refStationProjected && (
            <g className="spatial-map-distance-rings" aria-label="Approximate distance rings">
              {proj.ringDistances.map((distKm) => {
                const rPx = proj.kmToPixels(distKm);
                if (rPx <= 0) return null;
                return (
                  <g key={`dist-ring-${distKm}`}>
                    <circle
                      cx={refStationProjected.x}
                      cy={refStationProjected.y}
                      r={rPx}
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.2)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={refStationProjected.x}
                      y={Math.max(proj.paddingTop + 10, refStationProjected.y - rPx - 4)}
                      textAnchor="middle"
                      fill="var(--eco-text-muted)"
                      fontSize="9"
                      fontFamily="var(--eco-font-sans)"
                    >
                      Approx. {distKm} km
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {proj.projectedStations.map((p) => {
            if (!p.isCoLocated) return null;
            return (
              <line
                key={`coloc-line-${p.station.location_id}`}
                x1={p.x}
                y1={p.y}
                x2={p.displayX}
                y2={p.displayY}
                stroke="var(--eco-border-strong)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            );
          })}

          {proj.projectedStations.map((p) => {
            const isHovered = hoveredStationId === p.station.location_id;
            const isRef = p.station.is_reference;

            if (isRef) {
              const dSize = isHovered ? 14 : 11;
              const diamondPath = `M ${p.displayX} ${p.displayY - dSize} L ${p.displayX + dSize} ${p.displayY} L ${p.displayX} ${p.displayY + dSize} L ${p.displayX - dSize} ${p.displayY} Z`;

              return (
                <g
                  key={`marker-${p.station.location_id}`}
                  className={`spatial-marker spatial-marker-reference ${styles.markerInteractive}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Reference Station: ${p.station.station_name}, Coordinates: ${p.rawLat.toFixed(4)}°, ${p.rawLon.toFixed(4)}°`}
                  onMouseEnter={() => setHoveredStationId(p.station.location_id)}
                  onMouseLeave={() => setHoveredStationId(null)}
                  onFocus={() => setHoveredStationId(p.station.location_id)}
                  onBlur={() => setHoveredStationId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setHoveredStationId((prev) =>
                        prev === p.station.location_id ? null : p.station.location_id
                      );
                    }
                  }}
                >
                  <circle
                    cx={p.displayX}
                    cy={p.displayY}
                    r={isHovered ? 20 : 16}
                    fill="none"
                    stroke="rgba(20, 184, 166, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <path
                    d={diamondPath}
                    fill={REF_COLOR}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    filter="url(#teal-glow)"
                  />
                  <circle cx={p.displayX} cy={p.displayY} r="3" fill="#ffffff" />
                  <text
                    x={p.displayX}
                    y={p.displayY + dSize + 13}
                    textAnchor="middle"
                    fill="var(--eco-text-primary)"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="var(--eco-font-sans)"
                  >
                    Ref:{' '}
                    {p.station.station_name.length > 20
                      ? `${p.station.station_name.substring(0, 18)}...`
                      : p.station.station_name}
                  </text>
                </g>
              );
            }

            const radius = isHovered ? 13 : 10;
            const labelText =
              p.station.distance_from_reference_km !== null &&
              p.station.distance_from_reference_km !== undefined
                ? `${p.station.distance_from_reference_km.toFixed(1)} km`
                : 'Dist. N/A';

            return (
              <g
                key={`marker-${p.station.location_id}`}
                className={`spatial-marker spatial-marker-neighbor ${styles.markerInteractive}`}
                tabIndex={0}
                role="button"
                aria-label={`Neighbor Station ${p.neighborIndex}: ${p.station.station_name}, Distance from reference: ${labelText}, Coordinates: ${p.rawLat.toFixed(4)}°, ${p.rawLon.toFixed(4)}°`}
                onMouseEnter={() => setHoveredStationId(p.station.location_id)}
                onMouseLeave={() => setHoveredStationId(null)}
                onFocus={() => setHoveredStationId(p.station.location_id)}
                onBlur={() => setHoveredStationId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setHoveredStationId((prev) =>
                      prev === p.station.location_id ? null : p.station.location_id
                    );
                  }
                }}
              >
                {isHovered && (
                  <circle
                    cx={p.displayX}
                    cy={p.displayY}
                    r={radius + 5}
                    fill="none"
                    stroke={p.color}
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}
                <circle
                  cx={p.displayX}
                  cy={p.displayY}
                  r={radius}
                  fill={p.color}
                  stroke="var(--eco-bg-surface)"
                  strokeWidth="2"
                />
                <text
                  x={p.displayX}
                  y={p.displayY + 3.5}
                  textAnchor="middle"
                  fill="#090d14"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="var(--eco-font-sans)"
                  pointerEvents="none"
                >
                  {p.neighborIndex}
                </text>
                <text
                  x={p.displayX}
                  y={p.displayY + radius + 12}
                  textAnchor="middle"
                  fill="var(--eco-text-secondary)"
                  fontSize="9.5"
                  fontFamily="var(--eco-font-sans)"
                >
                  #{p.neighborIndex}{' '}
                  {p.station.station_name.length > 16
                    ? `${p.station.station_name.substring(0, 14)}...`
                    : p.station.station_name}
                </text>
                <text
                  x={p.displayX}
                  y={p.displayY + radius + 22}
                  textAnchor="middle"
                  fill="var(--eco-teal)"
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="var(--eco-font-mono)"
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          <g className="spatial-map-scale-bar" transform={`translate(${scaleBarX}, ${scaleBarY})`}>
            <line x1="0" y1="0" x2={proj.scaleBarPx} y2="0" stroke="var(--eco-text-primary)" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--eco-text-primary)" strokeWidth="2" />
            <line
              x1={proj.scaleBarPx}
              y1="-4"
              x2={proj.scaleBarPx}
              y2="4"
              stroke="var(--eco-text-primary)"
              strokeWidth="2"
            />
            <text
              x={proj.scaleBarPx / 2}
              y="-6"
              textAnchor="middle"
              fill="var(--eco-text-primary)"
              fontSize="9"
              fontWeight="600"
              fontFamily="var(--eco-font-sans)"
            >
              Approx. {proj.scaleBarKm} km
            </text>
          </g>
        </svg>

        {hoveredProjected && (
          <div className={`spatial-map-tooltip ${styles.tooltipCard}`} role="status" aria-live="polite">
            <div className={styles.tooltipHeader}>
              <span
                className={
                  hoveredProjected.station.is_reference
                    ? styles.tooltipSwatchRef
                    : SWATCH_CLASSES[((hoveredProjected.neighborIndex || 1) - 1) % SWATCH_CLASSES.length]
                }
              />
              <strong className={styles.tooltipName}>{hoveredProjected.station.station_name}</strong>
            </div>

            <div className={styles.tooltipRole}>{hoveredProjected.roleLabel}</div>

            <div className={styles.tooltipList}>
              <div>
                <strong>Location ID:</strong> {hoveredProjected.station.location_id}
              </div>
              <div>
                <strong>Provider:</strong> {hoveredProjected.station.provider_name}
              </div>
              <div>
                <strong>Coordinates:</strong> {hoveredProjected.rawLat.toFixed(4)}°N,{' '}
                {hoveredProjected.rawLon.toFixed(4)}°E
              </div>
              <div>
                <strong>Authoritative Haversine Distance:</strong>{' '}
                <span className={styles.tooltipDistVal}>
                  {hoveredProjected.station.is_reference
                    ? '0.0 km (Reference Anchor)'
                    : hoveredProjected.station.distance_from_reference_km !== null &&
                      hoveredProjected.station.distance_from_reference_km !== undefined
                    ? `${hoveredProjected.station.distance_from_reference_km.toFixed(1)} km`
                    : '— (Distance unavailable)'}
                </span>
              </div>
              <div>
                <strong>Sensor ID:</strong> #{hoveredProjected.station.sensor_id} ({units})
              </div>
              {hoveredProjected.isCoLocated && (
                <div className={styles.tooltipColocNote}>
                  Notice: Co-located site visually offset for map legibility.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {missingCoordStations.length > 0 && (
        <div className={`card ${styles.nonGeocodedBox}`} role="status">
          <div className={styles.nonGeocodedTitle}>Non-Geocoded Station Notice</div>
          {missingCoordStations.map((st) => (
            <div key={st.location_id} className={styles.nonGeocodedItem}>
              • Station {st.location_id} ({st.station_name}) — omitted from geographic map (coordinates unavailable).
            </div>
          ))}
        </div>
      )}

      <div className={`spatial-map-legend ${styles.legend}`}>
        <div className={styles.legendItem}>
          <span className={styles.legendDiamond} />
          <span className={styles.legendRefText}>Reference Anchor</span>
        </div>
        {NEIGHBOR_COLORS.slice(0, Math.max(1, validStations.length - 1)).map((col, idx) => (
          <div key={col} className={styles.legendItem}>
            <span className={SWATCH_CLASSES[idx % SWATCH_CLASSES.length]} />
            <span className={styles.legendNeighborText}>Neighbor #{idx + 1}</span>
          </div>
        ))}
        <div className={styles.legendItem}>
          <span className={styles.legendRingLine} />
          <span className={styles.legendRingText}>Approx. Distance Rings (WGS-84)</span>
        </div>
      </div>

      <div className={`spatial-disclaimer-box ${styles.disclaimer}`}>
        <strong>Point Observation Notice:</strong> Station markers represent discrete physical monitor coordinates on the WGS-84 datum. Ambient monitors reflect local micro-environments and do not depict continuous spatial airsheds, regional dispersion gradients, or industrial emission source attribution.
      </div>
    </div>
  );
};
