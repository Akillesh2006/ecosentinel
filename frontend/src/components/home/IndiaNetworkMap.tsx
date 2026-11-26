import React, { useState } from 'react';
import { MapPin, ArrowUpRight } from 'lucide-react';
import type { LocationDetail } from '../../types';
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
  onExploreStations: (cityHint?: string) => void;
}

/**
 * Interactive national geographic context map highlighting regional monitoring hubs
 * and the currently inspected verified monitoring station (if selected).
 */
export const IndiaNetworkMap: React.FC<IndiaNetworkMapProps> = ({
  selectedLocation,
  onExploreStations,
}) => {
  const [focusedHub, setFocusedHub] = useState<CityHub>(INDIA_CITY_HUBS[0]);

  const selectedCoord =
    selectedLocation?.coordinates &&
    Number.isFinite(selectedLocation.coordinates.latitude) &&
    Number.isFinite(selectedLocation.coordinates.longitude)
      ? projectIndiaPoint(selectedLocation.coordinates.longitude, selectedLocation.coordinates.latitude)
      : null;

  return (
    <Card padding="md" variant="default">
      <CardHeader>
        <div>
          <CardTitle>Verified Indian Monitoring Network</CardTitle>
          <CardDescription>
            Regional OpenAQ v3 reference hubs across India. Click a city hub to filter stations.
          </CardDescription>
        </div>
        <Badge tone="info" dot>
          India (IN)
        </Badge>
      </CardHeader>

      <div className={styles.mapWrap}>
        <div className={styles.mapCanvas}>
          <svg
            viewBox="0 0 440 420"
            className={styles.mapSvg}
            role="img"
            aria-label="Geographic outline map of India highlighting air-quality monitoring city hubs"
          >
            <defs>
              <linearGradient id="ecoIndiaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--eco-map-land-start)" />
                <stop offset="100%" stopColor="var(--eco-map-land-end)" />
              </linearGradient>
            </defs>

            {/* Subtle latitude/longitude gridlines */}
            {[80, 160, 240, 320, 400].map((pos) => (
              <g key={pos} opacity="0.25">
                <line
                  x1="12"
                  y1={pos}
                  x2="428"
                  y2={pos}
                  stroke="var(--eco-border-strong)"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
                <line
                  x1={pos}
                  y1="12"
                  x2={pos}
                  y2="408"
                  stroke="var(--eco-border-strong)"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
              </g>
            ))}

            {/* India outline */}
            <path
              d={INDIA_OUTLINE_PATH}
              fill="url(#ecoIndiaFill)"
              stroke="var(--eco-teal-border)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />

            {/* Regional monitoring city hubs */}
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
                  onClick={() => onExploreStations(hub.name.split(' ')[0])}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onExploreStations(hub.name.split(' ')[0]);
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

            {/* Highlight actively loaded station if coordinates are available */}
            {selectedLocation && selectedCoord && (
              <g aria-label={`Active station ${selectedLocation.name}`}>
                <circle
                  cx={selectedCoord.x}
                  cy={selectedCoord.y}
                  r={15}
                  fill="var(--eco-lime-glow)"
                  stroke="var(--eco-lime)"
                  strokeWidth="1.4"
                  strokeDasharray="3 2"
                />
                <circle
                  cx={selectedCoord.x}
                  cy={selectedCoord.y}
                  r={6}
                  fill="var(--eco-lime)"
                  stroke="var(--eco-bg-canvas)"
                  strokeWidth="1.8"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Interactive Hub Readout */}
        <div className={styles.mapDetailBar}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong style={{ color: 'var(--eco-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={13} style={{ color: 'var(--eco-teal-text)' }} aria-hidden="true" />
              {focusedHub.name}, {focusedHub.state}
            </strong>
            <span style={{ color: 'var(--eco-text-secondary)' }}>
              {focusedHub.monitoringNote} · {focusedHub.primaryPollutants}
            </span>
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

        <p className={styles.mapFootnote}>
          Hub locations mark major Indian urban monitoring regions. Live sensor counts and concentrations are loaded only when a verified OpenAQ station is inspected.
        </p>
      </div>
    </Card>
  );
};

