import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  LocationDetail,
  LocationSummary,
  SpatialNeighborsResponse,
  SpatialComparisonResponse,
  AirQualityApiError,
  NeighborStationSummary,
} from '../types';
import {
  fetchLocations,
  fetchLocationDetail,
  fetchSpatialNeighbors,
  fetchSpatialComparison,
} from '../services/api';
import { SpatialComparisonChart } from './SpatialComparisonChart';
import { SpatialComparisonMap } from './SpatialComparisonMap';
import { SpatialEvidenceTable } from './SpatialEvidenceTable';
import { SpatialStatisticsPanel } from './SpatialStatisticsPanel';

export interface SpatialSectionProps {
  selectedLocation?: LocationDetail | null;
  onSelectLocation?: (location: LocationDetail) => void;
  activeParameter?: string;
}

const SUPPORTED_PARAMETERS = [
  { id: 'pm25', label: 'PM2.5', name: 'Fine Particulate Matter' },
  { id: 'pm10', label: 'PM10', name: 'Respirable Particulate Matter' },
  { id: 'no2', label: 'NO₂', name: 'Nitrogen Dioxide' },
  { id: 'so2', label: 'SO₂', name: 'Sulfur Dioxide' },
  { id: 'o3', label: 'O₃', name: 'Ozone' },
  { id: 'co', label: 'CO', name: 'Carbon Monoxide' },
];

type WindowPreset = '24h' | '48h' | '7d';

export const SpatialSection: React.FC<SpatialSectionProps> = ({
  selectedLocation,
  onSelectLocation,
  activeParameter,
}) => {
  // Reference station state
  const [referenceStationId, setReferenceStationId] = useState<number>(selectedLocation?.id || 3060);
  const [referenceStationName, setReferenceStationName] = useState<string>(
    selectedLocation?.name || 'Punjabi Bagh, Delhi - DPCC'
  );
  const [availableStations, setAvailableStations] = useState<LocationSummary[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState<boolean>(false);

  // Search Controls
  const [parameter, setParameter] = useState<string>(activeParameter || 'pm25');
  const [radiusKm, setRadiusKm] = useState<number>(25.0);
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('24h');

  // Neighbor Discovery state
  const [neighborsData, setNeighborsData] = useState<SpatialNeighborsResponse | null>(null);
  const [selectedNeighborIds, setSelectedNeighborIds] = useState<number[]>([]);
  const [isLoadingNeighbors, setIsLoadingNeighbors] = useState<boolean>(false);
  const [neighborError, setNeighborError] = useState<AirQualityApiError | null>(null);

  // Comparison Execution state
  const [comparisonData, setComparisonData] = useState<SpatialComparisonResponse | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState<boolean>(false);
  const [comparisonError, setComparisonError] = useState<AirQualityApiError | null>(null);

  // Race condition protection
  const neighborReqIdRef = useRef<number>(0);
  const compareReqIdRef = useRef<number>(0);

  // Sync when selectedLocation prop changes
  useEffect(() => {
    if (selectedLocation && selectedLocation.id !== referenceStationId) {
      setReferenceStationId(selectedLocation.id);
      setReferenceStationName(selectedLocation.name);
      setSelectedNeighborIds((prev) => prev.filter((id) => id !== selectedLocation.id));
      setComparisonData(null);
    }
  }, [selectedLocation, referenceStationId]);

  // Sync when activeParameter prop changes
  useEffect(() => {
    if (activeParameter && activeParameter !== parameter) {
      setParameter(activeParameter);
      setSelectedNeighborIds([]);
      setComparisonData(null);
    }
  }, [activeParameter, parameter]);

  // Load list of stations for reference dropdown
  useEffect(() => {
    let isMounted = true;
    setIsLoadingStations(true);
    fetchLocations()
      .then((res) => {
        if (isMounted && res.data) {
          setAvailableStations(res.data);
          const found = res.data.find((s) => s.id === referenceStationId);
          if (found) {
            setReferenceStationName(found.name);
          }
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingStations(false);
      });

    return () => {
      isMounted = false;
    };
  }, [referenceStationId]);

  // Discover neighbors when referenceStationId, parameter, or radiusKm changes
  const discoverNeighbors = useCallback(() => {
    const reqId = ++neighborReqIdRef.current;
    const controller = new AbortController();

    setIsLoadingNeighbors(true);
    setNeighborError(null);

    fetchSpatialNeighbors(referenceStationId, parameter, radiusKm, 20, controller.signal)
      .then((res) => {
        if (reqId !== neighborReqIdRef.current) return;
        if (res.error) {
          setNeighborError(res.error);
          setNeighborsData(null);
          setSelectedNeighborIds([]);
        } else if (res.data) {
          setNeighborsData(res.data);
          if (res.data.reference_station_name) {
            setReferenceStationName(res.data.reference_station_name);
          }
          // Default selection: select up to 3 closest eligible neighbors
          const defaultSelected = res.data.neighbors.slice(0, 3).map((n) => n.id);
          setSelectedNeighborIds(defaultSelected);
        }
      })
      .catch((err: unknown) => {
        if (reqId !== neighborReqIdRef.current) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setNeighborError({
          error: 'NETWORK_ERROR',
          error_code: 'NETWORK_ERROR',
          message: 'Unable to connect to the spatial neighbor discovery service.',
        });
      })
      .finally(() => {
        if (reqId === neighborReqIdRef.current) {
          setIsLoadingNeighbors(false);
        }
      });

    return () => controller.abort();
  }, [referenceStationId, parameter, radiusKm]);

  useEffect(() => {
    return discoverNeighbors();
  }, [discoverNeighbors]);

  // Run Multi-Station Comparison
  const executeComparison = useCallback(() => {
    const validNeighborIds = selectedNeighborIds.filter((id) => id !== referenceStationId);
    if (validNeighborIds.length === 0) {
      setComparisonData(null);
      return;
    }

    const reqId = ++compareReqIdRef.current;
    const controller = new AbortController();

    setIsLoadingComparison(true);
    setComparisonError(null);

    // Calculate dates based on windowPreset
    const now = new Date();
    let hoursBack = 24;
    if (windowPreset === '48h') hoursBack = 48;
    if (windowPreset === '7d') hoursBack = 168;

    const fromDate = new Date(now.getTime() - hoursBack * 3600 * 1000);

    fetchSpatialComparison(
      {
        reference_location_id: referenceStationId,
        neighbor_location_ids: validNeighborIds,
        parameter,
        date_from: fromDate.toISOString(),
        date_to: now.toISOString(),
      },
      controller.signal
    )
      .then((res) => {
        if (reqId !== compareReqIdRef.current) return;
        if (res.error) {
          setComparisonError(res.error);
          setComparisonData(null);
        } else if (res.data) {
          setComparisonData(res.data);
        }
      })
      .catch((err: unknown) => {
        if (reqId !== compareReqIdRef.current) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setComparisonError({
          error: 'NETWORK_ERROR',
          error_code: 'NETWORK_ERROR',
          message: 'Failed to retrieve multi-station comparison time series.',
        });
      })
      .finally(() => {
        if (reqId === compareReqIdRef.current) {
          setIsLoadingComparison(false);
        }
      });

    return () => controller.abort();
  }, [referenceStationId, selectedNeighborIds, parameter, windowPreset]);

  // Automatically execute comparison when selectedNeighborIds changes
  useEffect(() => {
    if (selectedNeighborIds.length > 0) {
      return executeComparison();
    } else {
      setComparisonData(null);
    }
  }, [executeComparison, selectedNeighborIds.length]);

  // Handle station dropdown switch
  const handleReferenceChange = (newId: number) => {
    setReferenceStationId(newId);
    setSelectedNeighborIds((prev) => prev.filter((id) => id !== newId));
    setComparisonData(null);
    const found = availableStations.find((s) => s.id === newId);
    if (found) {
      setReferenceStationName(found.name);
    }
    if (onSelectLocation) {
      fetchLocationDetail(newId).then((res) => {
        if (res.data) onSelectLocation(res.data);
      });
    }
  };

  // Handle pollutant switch
  const handleParameterChange = (newParam: string) => {
    setParameter(newParam);
    setSelectedNeighborIds([]);
    setComparisonData(null);
  };

  // Handle window preset change
  const handleWindowPresetChange = (preset: WindowPreset) => {
    setWindowPreset(preset);
    setComparisonData(null);
  };

  // Handle neighbor checkbox toggle (enforcing max 4 neighbors = 5 total stations)
  const handleToggleNeighbor = (neighborId: number) => {
    setSelectedNeighborIds((prev) => {
      if (prev.includes(neighborId)) {
        return prev.filter((id) => id !== neighborId);
      }
      if (prev.length >= 4) {
        // Limit reached: cannot select more than 4 neighbors (5 stations total)
        return prev;
      }
      return [...prev, neighborId];
    });
  };

  const isMaxNeighborsReached = selectedNeighborIds.length >= 4;
  const paramDisplayName =
    SUPPORTED_PARAMETERS.find((p) => p.id === parameter)?.label || parameter.toUpperCase();

  return (
    <section className="section-container spatial-section" aria-label="Multi-Station Spatial Analysis">
      {/* Section Header */}
      <div className="section-header-banner" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title-wrap">
          <div className="section-kicker">
            <span className="badge badge-normal" style={{ fontSize: '0.75rem' }}>
              Milestone 7 • Spatial Analysis
            </span>
          </div>
          <h2 className="section-title" style={{ marginTop: '0.25rem' }}>
            Multi-Station Spatial Comparison &amp; Network Synchronization
          </h2>
          <p className="section-subtitle" style={{ color: 'var(--eco-text-secondary)', maxWidth: '850px' }}>
            Evaluate co-located and neighboring ambient air quality monitoring stations within a geographic radius.
            Compare synchronized hourly observation series, identify network gaps, evaluate pairwise correlation,
            and inspect neighborhood distribution metrics against rigorous empirical baselines.
          </p>
        </div>
      </div>

      {/* Control Panel Card */}
      <div className="card spatial-controls-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          {/* Reference Station Selector */}
          <div className="form-group">
            <label htmlFor="ref-station-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--eco-text-secondary)', marginBottom: '0.4rem' }}>
              Reference Station (Anchor)
            </label>
            <select
              id="ref-station-select"
              className="form-control"
              value={referenceStationId}
              onChange={(e) => handleReferenceChange(Number(e.target.value))}
              disabled={isLoadingStations}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--eco-bg-input)', color: 'var(--eco-text-primary)', border: '1px solid var(--eco-border-subtle)', borderRadius: 'var(--eco-radius-md)' }}
            >
              {availableStations.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.locality || 'India'})
                </option>
              ))}
              {availableStations.length === 0 && (
                <option value={referenceStationId}>{referenceStationName}</option>
              )}
            </select>
          </div>

          {/* Pollutant Selector */}
          <div className="form-group">
            <label htmlFor="spatial-param-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--eco-text-secondary)', marginBottom: '0.4rem' }}>
              Target Pollutant
            </label>
            <select
              id="spatial-param-select"
              className="form-control"
              value={parameter}
              onChange={(e) => handleParameterChange(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--eco-bg-input)', color: 'var(--eco-text-primary)', border: '1px solid var(--eco-border-subtle)', borderRadius: 'var(--eco-radius-md)' }}
            >
              {SUPPORTED_PARAMETERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Radius */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label htmlFor="spatial-radius-input" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--eco-text-secondary)' }}>
                Search Radius: <strong style={{ color: 'var(--eco-teal)' }}>{radiusKm} km</strong>
              </label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[15, 25, 50].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    className={`btn-preset ${radiusKm === r ? 'active' : ''}`}
                    style={{
                      padding: '0.15rem 0.4rem',
                      fontSize: '0.7rem',
                      borderRadius: '4px',
                      background: radiusKm === r ? 'var(--eco-teal)' : 'var(--eco-bg-card-subtle)',
                      color: radiusKm === r ? '#000' : 'var(--eco-text-secondary)',
                      border: '1px solid var(--eco-border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {r}k
                  </button>
                ))}
              </div>
            </div>
            <input
              id="spatial-radius-input"
              type="range"
              min="1"
              max="100"
              step="1"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--eco-teal)' }}
              aria-label="Search Radius in Kilometers"
            />
          </div>

          {/* Evaluation Window Presets */}
          <div className="form-group">
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--eco-text-secondary)', marginBottom: '0.4rem' }}>
              Comparison Window
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['24h', '48h', '7d'] as WindowPreset[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handleWindowPresetChange(w)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: 'var(--eco-radius-md)',
                    background: windowPreset === w ? 'var(--eco-teal)' : 'var(--eco-bg-input)',
                    color: windowPreset === w ? '#000' : 'var(--eco-text-secondary)',
                    border: '1px solid var(--eco-border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  {w.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Neighbor Discovery Drawer & Selection */}
      <div className="card neighbor-discovery-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="card-badge">Spatial Discovery</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--eco-text-primary)', margin: 0 }}>
                Eligible Neighbor Stations within {radiusKm} km
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--eco-text-muted)', margin: '0.25rem 0 0' }}>
              Select up to 4 neighboring stations to construct a multi-station comparison ensemble (maximum 5 stations total).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              className={`badge ${selectedNeighborIds.length === 4 ? 'badge-warning' : 'badge-normal'}`}
              style={{ fontSize: '0.8rem' }}
            >
              {selectedNeighborIds.length} of 4 Neighbors Selected ({selectedNeighborIds.length + 1}/5 Total)
            </span>
            <button
              type="button"
              onClick={discoverNeighbors}
              disabled={isLoadingNeighbors}
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                padding: '0.4rem 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'var(--eco-bg-card-subtle)',
                color: 'var(--eco-text-primary)',
                border: '1px solid var(--eco-border-subtle)',
                borderRadius: 'var(--eco-radius-md)',
                cursor: 'pointer',
              }}
            >
              {isLoadingNeighbors ? 'Scanning...' : 'Refresh Neighbors'}
            </button>
          </div>
        </div>

        {/* Diagnostic Counts */}
        {neighborsData && (
          <div
            className="spatial-diagnostics-bar"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '0.6rem 0.85rem',
              background: 'var(--eco-bg-card-subtle)',
              borderRadius: 'var(--eco-radius-md)',
              fontSize: '0.75rem',
              color: 'var(--eco-text-secondary)',
              marginBottom: '1rem',
              border: '1px solid var(--eco-border-subtle)',
            }}
          >
            <div>
              Candidates Evaluated:{' '}
              <strong style={{ color: 'var(--eco-text-primary)' }}>
                {neighborsData.candidates_examined_count}
              </strong>
            </div>
            <div>
              Eligible ({paramDisplayName}):{' '}
              <strong style={{ color: 'var(--eco-teal)' }}>
                {neighborsData.eligible_neighbors_count}
              </strong>
            </div>
            <div>
              Excluded (Lacks {paramDisplayName}):{' '}
              <strong style={{ color: 'var(--eco-status-elevated)' }}>
                {neighborsData.pollutant_incompatible_count}
              </strong>
            </div>
            <div>
              Excluded (Missing Coords):{' '}
              <strong style={{ color: 'var(--eco-text-muted)' }}>
                {neighborsData.missing_coordinates_count}
              </strong>
            </div>
            <div>
              Excluded (&gt;{radiusKm} km):{' '}
              <strong style={{ color: 'var(--eco-text-muted)' }}>
                {neighborsData.outside_radius_count}
              </strong>
            </div>
          </div>
        )}

        {/* Loading Neighbors State */}
        {isLoadingNeighbors && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--eco-text-muted)', fontSize: '0.85rem' }}>
            Scanning regional coordinates and querying OpenAQ station catalog...
          </div>
        )}

        {/* Neighbor Error State */}
        {neighborError && (
          <div
            className="card card-error"
            style={{
              padding: '1rem',
              borderLeft: '4px solid var(--eco-status-anomaly)',
              background: 'var(--eco-status-anomaly-bg)',
              color: 'var(--eco-text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <strong>Neighbor Discovery Failed:</strong> {neighborError.message}
          </div>
        )}

        {/* Empty Neighbors State */}
        {!isLoadingNeighbors && neighborsData && neighborsData.neighbors.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--eco-text-muted)', fontSize: '0.85rem' }}>
            No neighboring stations monitoring <strong>{paramDisplayName}</strong> were found within {radiusKm} km.
            Try increasing the search radius above.
          </div>
        )}

        {/* Eligible Neighbors Grid */}
        {!isLoadingNeighbors && neighborsData && neighborsData.neighbors.length > 0 && (
          <div
            className="neighbors-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {neighborsData.neighbors.map((neighbor: NeighborStationSummary) => {
              const isSelected = selectedNeighborIds.includes(neighbor.id);
              const isDisabled = !isSelected && isMaxNeighborsReached;

              return (
                <label
                  key={neighbor.id}
                  className={`neighbor-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--eco-radius-md)',
                    background: isSelected ? 'rgba(20, 184, 166, 0.08)' : 'var(--eco-bg-card-subtle)',
                    border: isSelected ? '1px solid var(--eco-teal-border)' : '1px solid var(--eco-border-subtle)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.5 : 1,
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => handleToggleNeighbor(neighbor.id)}
                    style={{ marginTop: '0.2rem', accentColor: 'var(--eco-teal)', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                    aria-label={`Select ${neighbor.name} for comparison`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--eco-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {neighbor.name}
                      </strong>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--eco-teal)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                        {neighbor.distance_km.toFixed(1)} km
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)', marginTop: '0.15rem' }}>
                      {neighbor.provider_name} {neighbor.locality ? `• ${neighbor.locality}` : ''}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', marginTop: '0.2rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span>Sensor #{neighbor.sensor_id ?? 'N/A'}</span>
                      {neighbor.is_stale && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>
                          Stale
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {isMaxNeighborsReached && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--eco-status-elevated)', fontStyle: 'italic' }}>
            Maximum selection reached: 4 neighbors + 1 reference station = 5 stations total. Deselect a neighbor to choose another.
          </div>
        )}
      </div>

      {/* Comparison Loading State */}
      {isLoadingComparison && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--eco-teal)', fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
            Synchronizing Multi-Station Observation Series...
          </div>
          <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.85rem' }}>
            Aligning hourly timestamps, validating sensor units, calculating pairwise Pearson correlation, and computing neighborhood medians.
          </div>
        </div>
      )}

      {/* Comparison Error State */}
      {comparisonError && !isLoadingComparison && (
        <div
          className="card card-error"
          style={{
            padding: '1.25rem',
            borderLeft: '4px solid var(--eco-status-anomaly)',
            background: 'var(--eco-status-anomaly-bg)',
            color: 'var(--eco-text-primary)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
          }}
          role="alert"
        >
          <div style={{ fontWeight: 600, color: 'var(--eco-status-anomaly)', marginBottom: '0.25rem' }}>
            Spatial Comparison Error
          </div>
          <div>{comparisonError.message}</div>
          <button
            type="button"
            onClick={executeComparison}
            style={{
              marginTop: '0.75rem',
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              background: 'var(--eco-bg-card)',
              color: 'var(--eco-text-primary)',
              border: '1px solid var(--eco-border-strong)',
              borderRadius: 'var(--eco-radius-md)',
              cursor: 'pointer',
            }}
          >
            Retry Comparison
          </button>
        </div>
      )}

      {/* Empty State when no neighbors are selected */}
      {selectedNeighborIds.length === 0 && !isLoadingNeighbors && (
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--eco-text-primary)', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Select Neighbors to Begin Comparison
          </div>
          <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.85rem', maxWidth: '500px', margin: '0 auto' }}>
            Choose 1 to 4 neighboring stations from the discovery panel above to compare synchronized observation streams against the reference anchor.
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparisonData && !isLoadingComparison && (
        <>
          {/* Summary KPIs & Neighborhood Stats */}
          <SpatialStatisticsPanel
            referenceStationId={comparisonData.reference_station_id}
            stations={comparisonData.stations}
            timeSlices={comparisonData.time_slices}
            parameterDisplayName={comparisonData.parameter_display_name}
            units={comparisonData.units}
            totalStationsRequested={comparisonData.total_stations_requested}
            totalValidStations={comparisonData.total_valid_stations}
            allStationsCoincidentHours={comparisonData.all_stations_coincident_hours}
            allStationsCoincidentCoveragePercentage={comparisonData.all_stations_coincident_coverage_percentage}
            mixedProviders={comparisonData.mixed_providers}
            partialFailures={comparisonData.partial_failures}
            dataQualityWarnings={comparisonData.data_quality_warnings}
          />

          {/* Geographic Point Network Map */}
          <div style={{ marginBottom: '1.5rem' }}>
            <SpatialComparisonMap
              stations={comparisonData.stations}
              radiusKm={radiusKm}
              parameterDisplayName={comparisonData.parameter_display_name}
              units={comparisonData.units}
            />
          </div>

          {/* Hourly Multi-Station SVG Comparison Chart */}
          <div className="card spatial-chart-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div>
                <span className="card-badge">Synchronized Observation Series</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--eco-text-primary)', marginTop: '0.25rem' }}>
                  Hourly Multi-Station Concentration Comparison ({comparisonData.parameter_display_name})
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--eco-text-muted)', marginTop: '0.25rem' }}>
                  Showing {comparisonData.stations.length} series plotted by exact timestamp. Missing observation intervals are preserved as visible gaps without interpolation or zero substitution.
                </p>
              </div>
            </div>

            <SpatialComparisonChart
              timeSlices={comparisonData.time_slices}
              stations={comparisonData.stations}
              parameterDisplayName={comparisonData.parameter_display_name}
              units={comparisonData.units}
            />
          </div>

          {/* Evidence & Alignment Table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <SpatialEvidenceTable
              stations={comparisonData.stations}
              parameterDisplayName={comparisonData.parameter_display_name}
              units={comparisonData.units}
              allStationsCoincidentHours={comparisonData.all_stations_coincident_hours}
              allStationsCoincidentCoveragePercentage={comparisonData.all_stations_coincident_coverage_percentage}
              expectedObservations={comparisonData.stations[0]?.expected_observations}
            />
          </div>

          {/* Spatial Disclaimer & Safeguard Card */}
          <div
            className="card spatial-disclaimer-card"
            style={{
              padding: '1rem 1.25rem',
              borderLeft: '4px solid var(--eco-teal)',
              background: 'var(--eco-bg-card-subtle)',
              fontSize: '0.8rem',
              color: 'var(--eco-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--eco-teal)', marginBottom: '0.25rem' }}>
              Scientific Interpretation Safeguard
            </div>
            <div>{comparisonData.spatial_disclaimer}</div>
          </div>
        </>
      )}
    </section>
  );
};
