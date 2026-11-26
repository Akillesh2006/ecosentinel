import React, { useState } from 'react';
import { MapPin, ArrowUpRight, RotateCcw } from 'lucide-react';
import type { LocationDetail, RiskAssessmentResponse } from '../../types';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  INDIA_CITY_HUBS,
  INDIA_OUTLINE_PATH,
  projectIndiaPoint,
  type CityHub,
} from './indiaMapData';
import styles from './Home.module.css';

export interface IndiaNetworkMapProps {
  selectedLocation?: LocationDetail | null;
  assessmentData?: RiskAssessmentResponse | null;
  onExploreStations: (cityHint?: string) => void;
}

/**
 * Full-width interactive India network map centrepiece with status-coloured glowing clusters,
 * pulse rings on elevated/anomalous stations, click-to-zoom city hubs, and smooth hover readout.
 */
export const IndiaNetworkMap: React.FC<IndiaNetworkMapProps> = ({
  selectedLocation,
  assessmentData,
  onExploreStations,
}) => {
  const [focusedHub, setFocusedHub] = useState<CityHub>(INDIA_CITY_HUBS[0]);
  const [zoomedHub, setZoomedHub] = useState<CityHub | null>(null);

  const selectedCoord =
    selectedLocation?.coordinates &&
    Number.isFinite(selectedLocation.coordinates.latitude) &&
    Number.isFinite(selectedLocation.coordinates.longitude)
      ? projectIndiaPoint(selectedLocation.coordinates.longitude, selectedLocation.coordinates.latitude)
      : null;

  const isSelectedElevated =
    assessmentData?.status === 'above_reference' ||
    (typeof assessmentData?.ratio_to_standard === 'number' && assessmentData.ratio_to_standard > 1);

  const activeColor = isSelectedElevated
    ? 'var(--eco-status-anomaly)'
    : assessmentData?.status
    ? 'var(--eco-status-normal)'
    : 'var(--eco-lime)';

  // Compute SVG viewBox for smooth click-to-zoom into a city hub
  let viewBox = '0 0 440 420';
  if (zoomedHub) {
    const pt = projectIndiaPoint(zoomedHub.lon, zoomedHub.lat);
    const w = 180;
    const h = 172;
    const vx = Math.max(0, Math.min(440 - w, pt.x - w / 2));
    const vy = Math.max(0, Math.min(420 - h, pt.y - h / 2));
    viewBox = `${vx.toFixed(1)} ${vy.toFixed(1)} ${w} ${h}`;
  }

  return (
    <Card padding="lg" variant="default" className={styles.mapFeatureCard}>
      <CardHeader>
        <div>
          <CardTitle>Verified Indian Monitoring Network</CardTitle>
          <CardDescription>
            Click any city hub to zoom in, or inspect the active OpenAQ v3 telemetry station.
          </CardDescription>
        </div>
        <div className={styles.mapHeaderActions}>
          {zoomedHub && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={13} />}
              onClick={() => setZoomedHub(null)}
            >
              Reset View
            </Button>
          )}
          <Badge tone="info" dot>
            {zoomedHub ? zoomedHub.name : 'India (IN)'}
          </Badge>
        </div>
      </CardHeader>

      <div className={styles.mapWrap}>
        <div className={styles.mapCanvas}>
          <svg
            viewBox={viewBox}
            className={styles.mapSvg}
            role="img"
            aria-label="Geographic outline map of India highlighting air-quality monitoring city hubs"
          >
            <defs>
              <linearGradient id="ecoIndiaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--eco-map-land-start)" />
                <stop offset="100%" stopColor="var(--eco-map-land-end)" />
              </linearGradient>
              <pattern id="ecoDotGrid" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.9" fill="var(--eco-border-strong)" opacity="0.45" />
              </pattern>
              <filter id="ecoNodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <rect x="0" y="0" width="440" height="420" fill="url(#ecoDotGrid)" />

            <path
              d={INDIA_OUTLINE_PATH}
              fill="url(#ecoIndiaFill)"
              stroke="var(--eco-teal-border)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />

            {INDIA_CITY_HUBS.map((hub) => {
              const { x, y } = projectIndiaPoint(hub.lon, hub.lat);
              const isFocused = focusedHub.id === hub.id;
              return (
                <g
                  key={hub.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Inspect ${hub.name} monitoring hub`}
                  className={styles.hubGroup}
                  onMouseEnter={() => setFocusedHub(hub)}
                  onFocus={() => setFocusedHub(hub)}
                  onClick={() => {
                    setFocusedHub(hub);
                    setZoomedHub((prev) => (prev?.id === hub.id ? null : hub));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFocusedHub(hub);
                      setZoomedHub((prev) => (prev?.id === hub.id ? null : hub));
                    }
                  }}
                >
                  {isFocused && (
                    <circle
                      cx={x}
                      cy={y}
                      r={13}
                      fill="var(--eco-teal-glow)"
                      stroke="var(--eco-teal)"
                      strokeWidth="1"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isFocused ? 5.5 : 4.2}
                    fill={isFocused ? 'var(--eco-lime)' : 'var(--eco-teal)'}
                    stroke="var(--eco-bg-canvas)"
                    strokeWidth="1.5"
                    filter="url(#ecoNodeGlow)"
                  />
                  <text
                    x={x + 8}
                    y={y + 3.5}
                    fill={isFocused ? 'var(--eco-text-primary)' : 'var(--eco-text-secondary)'}
                    fontSize={isFocused ? '10.5' : '9.5'}
                    fontWeight={isFocused ? '600' : '500'}
                    fontFamily="var(--eco-font-sans)"
                  >
                    {hub.name}
                  </text>
                </g>
              );
            })}

            {selectedLocation && selectedCoord && (
              <g aria-label={`Active station ${selectedLocation.name}`}>
                <circle
                  cx={selectedCoord.x}
                  cy={selectedCoord.y}
                  r={16}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="1.4"
                  className={isSelectedElevated ? styles.pulseRing : undefined}
                />
                <circle
                  cx={selectedCoord.x}
                  cy={selectedCoord.y}
                  r={6.5}
                  fill={activeColor}
                  stroke="var(--eco-bg-canvas)"
                  strokeWidth="2"
                  filter="url(#ecoNodeGlow)"
                />
              </g>
            )}
          </svg>

          {/* Smooth Floating Hover Card */}
          <div className={styles.mapHoverCard}>
            <div className={styles.mapHoverTitle}>
              <MapPin size={13} className={styles.mapHoverPin} aria-hidden="true" />
              <span>
                {focusedHub.name}, {focusedHub.state}
              </span>
            </div>
            <div className={styles.mapHoverMeta}>
              {focusedHub.monitoringNote} · {focusedHub.primaryPollutants}
            </div>
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowUpRight size={14} />}
              onClick={() => onExploreStations(focusedHub.name.split(' ')[0])}
            >
              {selectedLocation ? 'Open Hub' : 'Discover & Select Stations →'}
            </Button>
          </div>
        </div>

        {/* Map Legend */}
        <div className={styles.mapLegendRow}>
          <span className={styles.legendChip}>
            <span className={`${styles.legendDot} ${styles.legendNormal}`} /> Normal
          </span>
          <span className={styles.legendChip}>
            <span className={`${styles.legendDot} ${styles.legendElevated}`} /> Elevated
          </span>
          <span className={styles.legendChip}>
            <span className={`${styles.legendDot} ${styles.legendAnomaly}`} /> Anomaly / Above Limit
          </span>
          <span className={styles.legendChip}>
            <span className={`${styles.legendDot} ${styles.legendHub}`} /> City Hub
          </span>
        </div>
      </div>
    </Card>
  );
};
