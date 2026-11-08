import React, { useState } from 'react';
import type { Coordinates, StationComparisonMetadata } from '../types';

export interface SpatialComparisonMapProps {
  stations: StationComparisonMetadata[];
  radiusKm?: number;
  parameterDisplayName: string;
  units: string;
}

const NEIGHBOR_COLORS = [
  '#f59e0b', // Amber (Neighbor 1)
  '#38bdf8', // Sky (Neighbor 2)
  '#f43f5e', // Rose (Neighbor 3)
  '#818cf8', // Indigo (Neighbor 4)
];

const REF_COLOR = '#14b8a6'; // Teal (Reference Station)

interface ProjectedStation {
  station: StationComparisonMetadata;
  rawLat: number;
  rawLon: number;
  x: number;
  y: number;
  displayX: number;
  displayY: number;
  isCoLocated: boolean;
  color: string;
  roleLabel: string;
  neighborIndex?: number;
}

export function isValidCoordinate(c?: Coordinates | null): c is Coordinates {
  return (
    c !== null &&
    c !== undefined &&
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    isFinite(c.latitude) &&
    isFinite(c.longitude) &&
    c.latitude >= -90 &&
    c.latitude <= 90 &&
    c.longitude >= -180 &&
    c.longitude <= 180
  );
}

export const SpatialComparisonMap: React.FC<SpatialComparisonMapProps> = ({
  stations,
  radiusKm = 25.0,
  parameterDisplayName,
  units,
}) => {
  const [hoveredStationId, setHoveredStationId] = useState<number | null>(null);

  // 1. Separate valid-coordinate stations from non-geocoded stations
  const validStations: StationComparisonMetadata[] = [];
  const missingCoordStations: StationComparisonMetadata[] = [];

  stations.forEach((st) => {
    if (isValidCoordinate(st.coordinates)) {
      validStations.push(st);
    } else {
      missingCoordStations.push(st);
    }
  });

  // Empty state: No valid coordinates across any station
  if (validStations.length === 0) {
    return (
      <div className="card spatial-map-card" role="region" aria-label="Geographic Point Network Map">
        <div className="card-header" style={{ marginBottom: '1rem' }}>
          <div>
            <span className="card-badge">Geographic Point Network</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--eco-text-primary)', marginTop: '0.25rem' }}>
              Station Siting &amp; Spatial Distribution ({parameterDisplayName})
            </h3>
          </div>
        </div>
        <div
          className="spatial-map-empty-state"
          style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            background: 'var(--eco-bg-card-subtle)',
            borderRadius: 'var(--eco-radius-md)',
            border: '1px dashed var(--eco-border-strong)',
          }}
          role="status"
          aria-label="No geographical coordinates available"
        >
          <div style={{ color: 'var(--eco-text-primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
            No Geographical Coordinates Available
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--eco-text-muted)', maxWidth: '520px', margin: '0 auto' }}>
            None of the participating stations report valid geographical coordinates on the WGS-84 datum.
            Station observation telemetry remains evaluated in the comparison chart and evidence table.
          </p>
          {missingCoordStations.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', fontSize: '0.8rem', color: 'var(--eco-status-elevated)' }}>
              {missingCoordStations.map((st) => (
                <li key={st.location_id}>
                  Station {st.location_id} ({st.station_name}) — omitted from geographic map (coordinates unavailable).
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="spatial-disclaimer-box" style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--eco-text-muted)', borderTop: '1px solid var(--eco-border-subtle)', paddingTop: '0.5rem' }}>
          Point Observation Notice: Station markers represent discrete physical monitor coordinates on the WGS-84 datum. Ambient monitors reflect local micro-environments and do not depict continuous spatial airsheds, regional dispersion gradients, or industrial emission source attribution.
        </div>
      </div>
    );
  }

  // 2. SVG Canvas Dimensions & Margins
  const width = 800;
  const height = 440;
  const paddingLeft = 60;
  const paddingRight = 60;
  const paddingTop = 45;
  const paddingBottom = 55;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // 3. Compute Bounding Box & Centroid
  const lats = validStations.map((st) => st.coordinates!.latitude);
  const lons = validStations.map((st) => st.coordinates!.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const midLat = (minLat + maxLat) / 2;
  const radMidLat = (midLat * Math.PI) / 180;
  const cosFactor = Math.max(0.1, Math.cos(radMidLat));

  // Determine span: if all stations share identical coordinates or only 1 station exists, fall back to radius window
  const latSpanRaw = maxLat - minLat;
  const lonSpanRaw = maxLon - minLon;

  let padLat: number;
  let padLon: number;
  let boxLatMin: number;
  let boxLatMax: number;
  let boxLonMin: number;
  let boxLonMax: number;

  const KM_PER_DEG_LAT = 111.139;

  if (latSpanRaw < 0.0001 && lonSpanRaw < 0.0001) {
    // Single coordinate or exact co-located stations
    const targetRadiusKm = Math.max(radiusKm, 10);
    const deltaDeg = (targetRadiusKm / KM_PER_DEG_LAT) * 1.25;
    boxLatMin = midLat - deltaDeg;
    boxLatMax = midLat + deltaDeg;
    boxLonMin = minLon - deltaDeg / cosFactor;
    boxLonMax = minLon + deltaDeg / cosFactor;
  } else {
    // Dynamic bounding box with 25% padding (minimum 0.03 deg ~ 3.3 km)
    padLat = Math.max(latSpanRaw * 0.25, 0.03);
    padLon = Math.max(lonSpanRaw * 0.25, 0.03 / cosFactor);
    boxLatMin = minLat - padLat;
    boxLatMax = maxLat + padLat;
    boxLonMin = minLon - padLon;
    boxLonMax = maxLon + padLon;
  }

  // Uniform local isotropic projection scale
  const totalGeoW = (boxLonMax - boxLonMin) * cosFactor;
  const totalGeoH = boxLatMax - boxLatMin;

  const scale = Math.min(innerWidth / totalGeoW, innerHeight / totalGeoH);
  const usedW = totalGeoW * scale;
  const usedH = totalGeoH * scale;

  const offsetX = paddingLeft + (innerWidth - usedW) / 2;
  const offsetY = paddingTop + (innerHeight - usedH) / 2;

  const projectPoint = (lat: number, lon: number): { x: number; y: number } => {
    const x = offsetX + (lon - boxLonMin) * cosFactor * scale;
    const y = offsetY + (boxLatMax - lat) * scale;
    return { x, y };
  };

  // Convert distance in km to SVG pixel radius (approximate local conversion)
  const kmToPixels = (km: number): number => {
    return (km / KM_PER_DEG_LAT) * scale;
  };

  // 4. Project stations and detect co-location collision groups
  let neighborCounter = 0;
  const projectedStations: ProjectedStation[] = validStations.map((st) => {
    const rawLat = st.coordinates!.latitude;
    const rawLon = st.coordinates!.longitude;
    const { x, y } = projectPoint(rawLat, rawLon);

    let color = REF_COLOR;
    let roleLabel = 'Reference Anchor';
    let nIdx: number | undefined;

    if (!st.is_reference) {
      nIdx = neighborCounter + 1;
      color = NEIGHBOR_COLORS[neighborCounter % NEIGHBOR_COLORS.length];
      neighborCounter++;
      roleLabel = `Neighbor #${nIdx}`;
    }

    return {
      station: st,
      rawLat,
      rawLon,
      x,
      y,
      displayX: x,
      displayY: y,
      isCoLocated: false,
      color,
      roleLabel,
      neighborIndex: nIdx,
    };
  });

  // Collision detection: Check if any markers are within 24px of each other
  let hasCoLocatedStations = false;
  for (let i = 0; i < projectedStations.length; i++) {
    for (let j = i + 1; j < projectedStations.length; j++) {
      const dx = projectedStations[i].x - projectedStations[j].x;
      const dy = projectedStations[i].y - projectedStations[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 24) {
        hasCoLocatedStations = true;
        projectedStations[i].isCoLocated = true;
        projectedStations[j].isCoLocated = true;
        // Apply deterministic radial offset
        const angle = Math.atan2(dy, dx);
        const offsetDist = (24 - dist) / 2 + 6;
        projectedStations[i].displayX = projectedStations[i].x + Math.cos(angle) * offsetDist;
        projectedStations[i].displayY = projectedStations[i].y + Math.sin(angle) * offsetDist;
        projectedStations[j].displayX = projectedStations[j].x - Math.cos(angle) * offsetDist;
        projectedStations[j].displayY = projectedStations[j].y - Math.sin(angle) * offsetDist;
      }
    }
  }

  // Reference station coordinates for distance rings
  const refStationProjected = projectedStations.find((p) => p.station.is_reference);

  // Subtle concentric distance rings (approximate physical guides from reference station)
  const ringDistances: number[] = [];
  if (radiusKm <= 20) {
    ringDistances.push(5, Math.round(radiusKm));
  } else if (radiusKm <= 40) {
    ringDistances.push(10, Math.round(radiusKm));
  } else {
    ringDistances.push(20, Math.round(radiusKm));
  }

  // Distance scale bar calculation (approximate 5 km, 10 km, or 25 km bar)
  let scaleBarKm = 10;
  if (radiusKm <= 15) scaleBarKm = 5;
  else if (radiusKm > 50) scaleBarKm = 25;
  const scaleBarPx = kmToPixels(scaleBarKm);

  // Scale bar placement
  const scaleBarX = paddingLeft + 15;
  const scaleBarY = height - 20;

  // Active hover info
  const hoveredProjected = projectedStations.find((p) => p.station.location_id === hoveredStationId);

  return (
    <div className="card spatial-map-card" role="region" aria-label="Geographic Point Network Map">
      {/* Map Header */}
      <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <span className="card-badge">Geographic Point Network</span>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--eco-text-primary)', marginTop: '0.25rem' }}>
            Station Siting &amp; Spatial Distribution ({parameterDisplayName})
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--eco-text-muted)', marginTop: '0.25rem' }}>
            Showing {validStations.length} of {stations.length} participating stations projected via cosine-adjusted equirectangular geometry (WGS-84).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge-normal" style={{ fontSize: '0.75rem' }}>
            Search Radius: {radiusKm} km
          </span>
          {hasCoLocatedStations && (
            <span className="badge badge-warning" style={{ fontSize: '0.75rem' }} title="Stations with identical or near-coincident coordinates have been visually offset to prevent marker overlap. Actual coordinates and distances remain unmodified.">
              Co-Located Stations Offset
            </span>
          )}
        </div>
      </div>

      {/* SVG Map Container */}
      <div className="spatial-map-container" style={{ position: 'relative', width: '100%', overflow: 'visible' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="spatial-map-svg"
          role="img"
          aria-label={`Geographic station location map for ${parameterDisplayName} comparison ensemble`}
          style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--eco-bg-input)', borderRadius: 'var(--eco-radius-md)', border: '1px solid var(--eco-border-subtle)' }}
        >
          <defs>
            {/* Luminous glow filter for reference anchor */}
            <filter id="teal-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Grid Lines (Latitude & Longitude Guides) */}
          <g className="spatial-map-grid" stroke="var(--eco-border-subtle)" strokeWidth="0.8" strokeDasharray="3 4">
            <line x1={paddingLeft} y1={offsetY + usedH / 2} x2={width - paddingRight} y2={offsetY + usedH / 2} />
            <line x1={offsetX + usedW / 2} y1={paddingTop} x2={offsetX + usedW / 2} y2={height - paddingBottom} />
          </g>

          {/* Coordinate Guide Labels */}
          <text x={paddingLeft + 8} y={offsetY + usedH / 2 - 4} fill="var(--eco-text-muted)" fontSize="9" fontFamily="var(--eco-font-mono)">
            Lat: {midLat.toFixed(2)}°N
          </text>
          <text x={offsetX + usedW / 2 + 4} y={height - paddingBottom - 6} fill="var(--eco-text-muted)" fontSize="9" fontFamily="var(--eco-font-mono)">
            Lon: {((boxLonMin + boxLonMax) / 2).toFixed(2)}°E
          </text>

          {/* Reference Distance Rings (Approximate geographic range guides) */}
          {refStationProjected && (
            <g className="spatial-map-distance-rings" aria-label="Approximate distance rings">
              {ringDistances.map((distKm) => {
                const rPx = kmToPixels(distKm);
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
                      y={Math.max(paddingTop + 10, refStationProjected.y - rPx - 4)}
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

          {/* Visual offset connecting lines for co-located stations */}
          {projectedStations.map((p) => {
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

          {/* Station Markers */}
          {projectedStations.map((p) => {
            const isHovered = hoveredStationId === p.station.location_id;
            const isRef = p.station.is_reference;

            if (isRef) {
              // Reference Station: Teal Diamond
              const dSize = isHovered ? 14 : 11;
              const diamondPath = `M ${p.displayX} ${p.displayY - dSize} L ${p.displayX + dSize} ${p.displayY} L ${p.displayX} ${p.displayY + dSize} L ${p.displayX - dSize} ${p.displayY} Z`;

              return (
                <g
                  key={`marker-${p.station.location_id}`}
                  className="spatial-marker spatial-marker-reference"
                  tabIndex={0}
                  role="button"
                  aria-label={`Reference Station: ${p.station.station_name}, Coordinates: ${p.rawLat.toFixed(4)}°, ${p.rawLon.toFixed(4)}°`}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onMouseEnter={() => setHoveredStationId(p.station.location_id)}
                  onMouseLeave={() => setHoveredStationId(null)}
                  onFocus={() => setHoveredStationId(p.station.location_id)}
                  onBlur={() => setHoveredStationId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setHoveredStationId((prev) => (prev === p.station.location_id ? null : p.station.location_id));
                    }
                  }}
                >
                  {/* Outer glow ring */}
                  <circle
                    cx={p.displayX}
                    cy={p.displayY}
                    r={isHovered ? 20 : 16}
                    fill="none"
                    stroke="rgba(20, 184, 166, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  {/* Diamond Anchor */}
                  <path
                    d={diamondPath}
                    fill={REF_COLOR}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    filter="url(#teal-glow)"
                  />
                  {/* Center Dot */}
                  <circle cx={p.displayX} cy={p.displayY} r="3" fill="#ffffff" />

                  {/* Accessible Station Name Label */}
                  <text
                    x={p.displayX}
                    y={p.displayY + dSize + 13}
                    textAnchor="middle"
                    fill="var(--eco-text-primary)"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="var(--eco-font-sans)"
                  >
                    Ref: {p.station.station_name.length > 20 ? `${p.station.station_name.substring(0, 18)}...` : p.station.station_name}
                  </text>
                </g>
              );
            }

            // Neighbor Station: Numbered Circle
            const radius = isHovered ? 13 : 10;
            const labelText = p.station.distance_from_reference_km !== null && p.station.distance_from_reference_km !== undefined
              ? `${p.station.distance_from_reference_km.toFixed(1)} km`
              : 'Dist. N/A';

            return (
              <g
                key={`marker-${p.station.location_id}`}
                className="spatial-marker spatial-marker-neighbor"
                tabIndex={0}
                role="button"
                aria-label={`Neighbor Station ${p.neighborIndex}: ${p.station.station_name}, Distance from reference: ${labelText}, Coordinates: ${p.rawLat.toFixed(4)}°, ${p.rawLon.toFixed(4)}°`}
                style={{ cursor: 'pointer', outline: 'none' }}
                onMouseEnter={() => setHoveredStationId(p.station.location_id)}
                onMouseLeave={() => setHoveredStationId(null)}
                onFocus={() => setHoveredStationId(p.station.location_id)}
                onBlur={() => setHoveredStationId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setHoveredStationId((prev) => (prev === p.station.location_id ? null : p.station.location_id));
                  }
                }}
              >
                {/* Focus indicator circle */}
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
                {/* Marker Body */}
                <circle
                  cx={p.displayX}
                  cy={p.displayY}
                  r={radius}
                  fill={p.color}
                  stroke="var(--eco-bg-surface)"
                  strokeWidth="2"
                />
                {/* Non-color identifier: Index number */}
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

                {/* Neighbor Station Label */}
                <text
                  x={p.displayX}
                  y={p.displayY + radius + 12}
                  textAnchor="middle"
                  fill="var(--eco-text-secondary)"
                  fontSize="9.5"
                  fontFamily="var(--eco-font-sans)"
                >
                  #{p.neighborIndex} {p.station.station_name.length > 16 ? `${p.station.station_name.substring(0, 14)}...` : p.station.station_name}
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

          {/* Distance Scale Bar (Bottom Left) */}
          <g className="spatial-map-scale-bar" transform={`translate(${scaleBarX}, ${scaleBarY})`}>
            <line x1="0" y1="0" x2={scaleBarPx} y2="0" stroke="var(--eco-text-primary)" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--eco-text-primary)" strokeWidth="2" />
            <line x1={scaleBarPx} y1="-4" x2={scaleBarPx} y2="4" stroke="var(--eco-text-primary)" strokeWidth="2" />
            <text x={scaleBarPx / 2} y="-6" textAnchor="middle" fill="var(--eco-text-primary)" fontSize="9" fontWeight="600" fontFamily="var(--eco-font-sans)">
              Approx. {scaleBarKm} km
            </text>
          </g>
        </svg>

        {/* Hover / Focus Tooltip Card */}
        {hoveredProjected && (
          <div
            className="spatial-map-tooltip"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'var(--eco-bg-card)',
              border: '1px solid var(--eco-border-strong)',
              borderRadius: 'var(--eco-radius-md)',
              padding: '0.75rem 1rem',
              boxShadow: 'var(--eco-shadow-md)',
              maxWidth: '280px',
              zIndex: 10,
              fontSize: '0.8rem',
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)',
            }}
            role="status"
            aria-live="polite"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: hoveredProjected.station.is_reference ? '2px' : '50%',
                  backgroundColor: hoveredProjected.color,
                  display: 'inline-block',
                }}
              />
              <strong style={{ color: 'var(--eco-text-primary)', fontSize: '0.85rem' }}>
                {hoveredProjected.station.station_name}
              </strong>
            </div>

            <div style={{ color: 'var(--eco-teal)', fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.4rem' }}>
              {hoveredProjected.roleLabel}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', color: 'var(--eco-text-secondary)', fontSize: '0.75rem' }}>
              <div>
                <strong>Location ID:</strong> {hoveredProjected.station.location_id}
              </div>
              <div>
                <strong>Provider:</strong> {hoveredProjected.station.provider_name}
              </div>
              <div>
                <strong>Coordinates:</strong> {hoveredProjected.rawLat.toFixed(4)}°N, {hoveredProjected.rawLon.toFixed(4)}°E
              </div>
              <div>
                <strong>Authoritative Haversine Distance:</strong>{' '}
                <span style={{ color: 'var(--eco-text-primary)', fontWeight: 600 }}>
                  {hoveredProjected.station.is_reference
                    ? '0.0 km (Reference Anchor)'
                    : hoveredProjected.station.distance_from_reference_km !== null && hoveredProjected.station.distance_from_reference_km !== undefined
                    ? `${hoveredProjected.station.distance_from_reference_km.toFixed(1)} km`
                    : '— (Distance unavailable)'}
                </span>
              </div>
              <div>
                <strong>Sensor ID:</strong> #{hoveredProjected.station.sensor_id} ({units})
              </div>
              {hoveredProjected.isCoLocated && (
                <div style={{ color: 'var(--eco-status-elevated)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                  Notice: Co-located site visually offset for map legibility.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Non-Geocoded Stations Advisory Banner */}
      {missingCoordStations.length > 0 && (
        <div
          className="card"
          style={{
            marginTop: '0.75rem',
            padding: '0.6rem 0.85rem',
            borderLeft: '4px solid var(--eco-status-elevated)',
            background: 'var(--eco-status-elevated-bg)',
            fontSize: '0.8rem',
            color: 'var(--eco-text-primary)',
          }}
          role="status"
        >
          <div style={{ fontWeight: 600, color: 'var(--eco-status-elevated)', marginBottom: '0.2rem' }}>
            Non-Geocoded Station Notice
          </div>
          {missingCoordStations.map((st) => (
            <div key={st.location_id} style={{ fontSize: '0.75rem' }}>
              • Station {st.location_id} ({st.station_name}) — omitted from geographic map (coordinates unavailable).
            </div>
          ))}
        </div>
      )}

      {/* Map Legend */}
      <div
        className="spatial-map-legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          marginTop: '0.75rem',
          padding: '0.5rem 0.75rem',
          background: 'var(--eco-bg-card-subtle)',
          borderRadius: 'var(--eco-radius-md)',
          border: '1px solid var(--eco-border-subtle)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '10px', height: '10px', transform: 'rotate(45deg)', backgroundColor: REF_COLOR, display: 'inline-block' }} />
          <span style={{ color: 'var(--eco-text-primary)', fontWeight: 600 }}>Reference Anchor</span>
        </div>
        {NEIGHBOR_COLORS.slice(0, Math.max(1, validStations.length - 1)).map((col, idx) => (
          <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: col, display: 'inline-block' }} />
            <span style={{ color: 'var(--eco-text-secondary)' }}>Neighbor #{idx + 1}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '0', borderTop: '1px dashed rgba(148, 163, 184, 0.4)', display: 'inline-block' }} />
          <span style={{ color: 'var(--eco-text-muted)' }}>Approx. Distance Rings (WGS-84)</span>
        </div>
      </div>

      {/* Mandatory Scientific Interpretation Safeguard */}
      <div
        className="spatial-disclaimer-box"
        style={{
          marginTop: '0.75rem',
          fontSize: '0.75rem',
          color: 'var(--eco-text-muted)',
          borderTop: '1px solid var(--eco-border-subtle)',
          paddingTop: '0.6rem',
          lineHeight: 1.45,
        }}
      >
        <strong>Point Observation Notice:</strong> Station markers represent discrete physical monitor coordinates on the WGS-84 datum. Ambient monitors reflect local micro-environments and do not depict continuous spatial airsheds, regional dispersion gradients, or industrial emission source attribution.
      </div>
    </div>
  );
};

