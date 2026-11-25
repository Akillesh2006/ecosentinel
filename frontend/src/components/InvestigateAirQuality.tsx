import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AirQualityApiError,
  LocationDetail,
  LocationMeasurementsResponse,
  LocationSummary,
  RiskAssessmentResponse,
  TimeRangePreset,
} from '../types';
import { fetchLocationDetail, fetchLocations, fetchMeasurements, fetchRiskAssessment } from '../services/api';
import { AirQualityChart } from './AirQualityChart';
import { MeasurementTable } from './MeasurementTable';
import { RiskAssessmentCard } from './RiskAssessmentCard';
import { ApiKeyMissingBanner } from './ApiKeyMissingBanner';

export interface InvestigateAirQualityProps {
  selectedLocation?: LocationDetail | null;
  onMeasurementsLoaded?: (data: LocationMeasurementsResponse | null) => void;
  onLocationSelected?: (location: LocationDetail | null) => void;
  onAssessmentLoaded?: (data: RiskAssessmentResponse | null) => void;
  onMeasurementsLoadingChange?: (loading: boolean) => void;
  hidden?: boolean;
}

const POPULAR_INDIAN_CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Kolkata', 'Chennai', 'Hyderabad'];

export const InvestigateAirQuality: React.FC<InvestigateAirQualityProps> = ({
  selectedLocation,
  onMeasurementsLoaded,
  onLocationSelected,
  onAssessmentLoaded,
  onMeasurementsLoadingChange,
  hidden,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [isLocationsLoading, setIsLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<AirQualityApiError | null>(null);

  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null);
  const [detailStationId, setDetailStationId] = useState<number | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [selectedParameter, setSelectedParameter] = useState<string>('pm25');
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('24h');
  const [customRange, setCustomRange] = useState<{ from: string; to: string; label: string } | null>(null);

  const [measurementsData, setMeasurementsData] = useState<LocationMeasurementsResponse | null>(null);
  const [isMeasurementsLoading, setIsMeasurementsLoading] = useState(false);
  const [measurementsError, setMeasurementsError] = useState<AirQualityApiError | null>(null);

  const [assessmentData, setAssessmentData] = useState<RiskAssessmentResponse | null>(null);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<AirQualityApiError | null>(null);

  // Request race condition protection
  const detailRequestIdRef = useRef<number>(0);
  const measurementRequestIdRef = useRef<number>(0);
  const assessmentRequestIdRef = useRef<number>(0);

  const computeDateRange = useCallback(
    (rangePreset: TimeRangePreset, custom: { from: string; to: string } | null) => {
      if (custom) {
        return {
          fromDate: new Date(custom.from),
          toDate: new Date(custom.to),
        };
      }
      const toDate = new Date();
      let fromDate: Date;
      if (rangePreset === '24h') {
        fromDate = new Date(toDate.getTime() - 24 * 3600 * 1000);
      } else if (rangePreset === '7d') {
        fromDate = new Date(toDate.getTime() - 7 * 24 * 3600 * 1000);
      } else {
        fromDate = new Date(toDate.getTime() - 30 * 24 * 3600 * 1000);
      }
      return { fromDate, toDate };
    },
    []
  );

  // Search locations
  const handleSearchLocations = useCallback(
    async (query?: string) => {
      setIsLocationsLoading(true);
      setLocationsError(null);
      const result = await fetchLocations(query);
      setIsLocationsLoading(false);

      if (result.error) {
        setLocationsError(result.error);
        setLocations([]);
      } else if (result.data) {
        setLocations(result.data);
        if (result.data.length > 0) {
          setSelectedLocationId((currentId) => {
            const exists = result.data!.some((l) => l.id === currentId);
            return exists ? currentId : result.data![0].id;
          });
        } else {
          setSelectedLocationId(null);
          setLocationDetail(null);
          setMeasurementsData(null);
          onLocationSelected?.(null);
          onMeasurementsLoaded?.(null);
        }
      }
    },
    [onLocationSelected, onMeasurementsLoaded]
  );

  // Track whether initial locations discovery has fired
  const hasLoadedLocationsRef = useRef<boolean>(false);

  // Initial load when section is visible, preventing eager telemetry fetch while on Overview
  useEffect(() => {
    if (!hidden && !hasLoadedLocationsRef.current) {
      hasLoadedLocationsRef.current = true;
      handleSearchLocations();
    }
  }, [hidden, handleSearchLocations]);

  // Track the last station ID synchronized from outside or dispatched outward
  const lastSyncedLocationIdRef = useRef<number | null>(null);

  // Synchronize when selectedLocation prop changes from external section
  useEffect(() => {
    if (selectedLocation && selectedLocation.id !== lastSyncedLocationIdRef.current) {
      lastSyncedLocationIdRef.current = selectedLocation.id;
      if (selectedLocation.id !== selectedLocationId) {
        setSelectedLocationId(selectedLocation.id);
        setLocationDetail(selectedLocation);
        setDetailStationId(selectedLocation.id);
      }
    }
  }, [selectedLocation, selectedLocationId]);

  // Load station details and synchronize pollutant selection when selectedLocationId changes
  useEffect(() => {
    if (!selectedLocationId) {
      setDetailStationId(null);
      setLocationDetail(null);
      setMeasurementsData(null);
      onLocationSelected?.(null);
      onMeasurementsLoaded?.(null);
      return;
    }

    const requestId = ++detailRequestIdRef.current;

    // Immediately clear previous station data to prevent showing stale measurements
    setDetailStationId(null);
    setLocationDetail(null);
    setMeasurementsData(null);
    onLocationSelected?.(null);
    onMeasurementsLoaded?.(null);
    setMeasurementsError(null);
    setIsDetailLoading(true);

    fetchLocationDetail(selectedLocationId).then((res) => {
      if (requestId !== detailRequestIdRef.current) return;
      setIsDetailLoading(false);

      if (res.error) {
        setLocationsError(res.error);
        return;
      }

      if (res.data) {
        const detail = res.data;

        // Synchronize pollutant selection:
        // Validate against available parameters before measurements are requested
        let targetParam = selectedParameter;
        const available = detail.available_parameters;
        if (available.length > 0) {
          const hasCurrent = available.some((p) => p.toLowerCase() === selectedParameter.toLowerCase());
          if (hasCurrent) {
            targetParam = available.find((p) => p.toLowerCase() === selectedParameter.toLowerCase())!;
          } else {
            const pm25Param = available.find((p) => p.toLowerCase() === 'pm25' || p.toLowerCase() === 'pm2.5');
            targetParam = pm25Param || available[0];
          }
        }
        setSelectedParameter(targetParam);

        if (detail.is_stale && timeRange === '24h') {
          setTimeRange('7d');
        }

        setDetailStationId(selectedLocationId);
        setLocationDetail(detail);
        lastSyncedLocationIdRef.current = detail.id;
        onLocationSelected?.(detail);
      }
    });
  }, [selectedLocationId, onLocationSelected]);

  // Load measurements whenever locationDetail, selectedParameter, timeRange, or customRange changes
  useEffect(() => {
    if (!selectedLocationId || !locationDetail || detailStationId !== selectedLocationId) {
      return;
    }

    // Ensure selectedParameter is supported by current locationDetail before making request
    const available = locationDetail.available_parameters;
    if (available.length > 0 && !available.some((p) => p.toLowerCase() === selectedParameter.toLowerCase())) {
      return;
    }

    const requestId = ++measurementRequestIdRef.current;
    setIsMeasurementsLoading(true);
    onMeasurementsLoadingChange?.(true);
    setMeasurementsError(null);
    onMeasurementsLoaded?.(null);

    const { fromDate, toDate } = computeDateRange(timeRange, customRange);

    fetchMeasurements(
      selectedLocationId,
      selectedParameter,
      fromDate.toISOString(),
      toDate.toISOString()
    ).then((result) => {
      if (requestId !== measurementRequestIdRef.current) return;
      setIsMeasurementsLoading(false);
      onMeasurementsLoadingChange?.(false);

      if (result.error) {
        setMeasurementsError(result.error);
        setMeasurementsData(null);
        onMeasurementsLoaded?.(null);
      } else if (result.data) {
        setMeasurementsData(result.data);
        onMeasurementsLoaded?.(result.data);
      }
    });
  }, [selectedLocationId, locationDetail, selectedParameter, timeRange, customRange, computeDateRange, onMeasurementsLoaded, onMeasurementsLoadingChange]);

  // Load operational risk assessment whenever selected station or pollutant changes
  useEffect(() => {
    if (!selectedLocationId || !locationDetail || detailStationId !== selectedLocationId) {
      setAssessmentData(null);
      setAssessmentError(null);
      onAssessmentLoaded?.(null);
      return;
    }

    const available = locationDetail.available_parameters;
    if (available.length > 0 && !available.some((p) => p.toLowerCase() === selectedParameter.toLowerCase())) {
      setAssessmentData(null);
      onAssessmentLoaded?.(null);
      return;
    }

    const reqId = ++assessmentRequestIdRef.current;
    setIsAssessmentLoading(true);
    setAssessmentError(null);
    onAssessmentLoaded?.(null);

    const refTime = customRange ? customRange.to : undefined;
    fetchRiskAssessment(selectedLocationId, selectedParameter, undefined, refTime).then((res) => {
      if (reqId !== assessmentRequestIdRef.current) return;
      setIsAssessmentLoading(false);

      if (res.error) {
        setAssessmentError(res.error);
        setAssessmentData(null);
        onAssessmentLoaded?.(null);
      } else if (res.data) {
        setAssessmentData(res.data);
        onAssessmentLoaded?.(res.data);
      }
    });
  }, [selectedLocationId, locationDetail, selectedParameter, detailStationId, customRange, onAssessmentLoaded]);

  const loadHistoricalPeriod = useCallback((endDateIso: string) => {
    const to = new Date(endDateIso);
    const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000);
    setCustomRange({
      from: from.toISOString(),
      to: to.toISOString(),
      label: `Historical (ending ${endDateIso.split('T')[0]})`,
    });
  }, []);

  // Missing API Key Banner
  const isMissingApiKey =
    locationsError?.error_code === 'MISSING_API_KEY' ||
    measurementsError?.error_code === 'MISSING_API_KEY';

  return (
    <article
      id="panel-investigate"
      role="tabpanel"
      aria-labelledby="tab-investigate"
      hidden={hidden}
      style={{ display: hidden ? 'none' : undefined }}
    >
      <header className="section-header">
        <h2>Investigate Air Quality in India</h2>
        <p className="section-subtitle">
          Retrieve verifiable criteria pollutant observations from registered monitoring stations across
          India using OpenAQ v3.
        </p>
      </header>

      {/* Missing API Key Warning State */}
      {isMissingApiKey && (
        <ApiKeyMissingBanner onRetry={() => handleSearchLocations(searchQuery)} />
      )}

      {/* Station Search Controls */}
      <div className="search-control-panel">
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchLocations(searchQuery);
          }}
        >
          <div className="search-input-wrapper">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="search-icon"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search Indian monitoring stations by city or name (e.g. Anand Vihar, Delhi, Mumbai)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search monitoring stations in India"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isLocationsLoading}>
            {isLocationsLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="quick-select-row">
          <span className="quick-select-label">Quick filter:</span>
          {POPULAR_INDIAN_CITIES.map((city) => {
            const isCityActive = searchQuery.trim().toLowerCase() === city.toLowerCase();
            return (
              <button
                key={city}
                type="button"
                className={`pill-btn ${isCityActive ? 'active' : ''}`}
                onClick={() => {
                  setSearchQuery(city);
                  handleSearchLocations(city);
                }}
                aria-pressed={isCityActive}
              >
                {city}
              </button>
            );
          })}
          {searchQuery && (
            <button
              type="button"
              className="pill-btn pill-btn-reset"
              onClick={() => {
                setSearchQuery('');
                handleSearchLocations('');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Station Selector Dropdown / Selection */}
      {locations.length > 0 && (
        <div className="station-selector-bar">
          <label htmlFor="station-select" className="station-select-label">
            {searchQuery
              ? `Selected Station (${locations.length} matching "${searchQuery}"):`
              : `Selected Station (${locations.length} active stations in India · National Default):`}
          </label>
          <div className="styled-select-container" style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}>
            <select
              id="station-select"
              className="styled-select"
              style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
              value={selectedLocationId || ''}
              onChange={(e) => {
                setCustomRange(null);
                setSelectedLocationId(Number(e.target.value));
              }}
            >
              {locations.map((loc) => {
                const staleTag = loc.is_stale ? '· ⚠ Stale (>24h)' : '· ✓ Active';
                const paramsTag =
                  loc.available_parameters && loc.available_parameters.length > 0
                    ? ` [${loc.available_parameters.join(', ')}]`
                    : '';
                return (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.locality ? `(${loc.locality})` : ''} — {loc.provider_name} {staleTag}{paramsTag}
                  </option>
                );
              })}
            </select>
          </div>
          <div
            className="station-selector-meta"
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: '0.25rem',
              fontSize: '0.8rem',
              color: 'var(--eco-text-secondary, #94a3b8)',
              width: '100%',
              minWidth: 0,
            }}
          >
            <span>
              <strong>Catalog Discovery:</strong> {locations.length} station{locations.length === 1 ? '' : 's'} available
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--eco-teal, #14b8a6)' }}>
                {locations.filter((l) => !l.is_stale).length} Active
              </strong>
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--eco-status-warning, #f59e0b)' }}>
                {locations.filter((l) => l.is_stale).length} Stale (&gt;24h)
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* No matching locations state */}
      {!isLocationsLoading && !isMissingApiKey && locations.length === 0 && (
        <div className="empty-state-box" role="status">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3 className="empty-state-title">No Matching Indian Monitoring Stations</h3>
          <p className="empty-state-desc">
            No monitoring stations matched &quot;{searchQuery}&quot;. Try searching for major cities like Delhi,
            Mumbai, Bengaluru, Kolkata, or Hyderabad.
          </p>
        </div>
      )}

      {/* Station Metadata Card */}
      {locationDetail && !isDetailLoading && (() => {
        const selectedSensor = locationDetail.sensors.find(
          (s) => s.parameter_name.toLowerCase() === selectedParameter.toLowerCase()
        );
        const isSensorStale =
          measurementsData?.is_stale ??
          (selectedSensor?.datetime_last_utc
            ? Date.now() - new Date(selectedSensor.datetime_last_utc).getTime() > 24 * 3600 * 1000
            : locationDetail.is_stale);

        return (
          <div className="station-metadata-card">
            <div className="station-card-top">
              <div>
                <div className="station-badges">
                  <span className="pill-tag pill-active">
                    {locationDetail.is_monitor ? 'Reference Monitor' : 'Sensor Node'}
                  </span>
                  <span className="pill-tag">Station #{locationDetail.id}</span>
                  {(isSensorStale || locationDetail.is_stale) && (
                    <span className="pill-tag pill-pending">Stale Observations</span>
                  )}
                </div>
                <h3 className="station-card-title">{locationDetail.name}</h3>
                <p className="station-card-locality">
                  {locationDetail.locality ? `${locationDetail.locality}, ` : ''}India · Provider:{' '}
                  <strong>{locationDetail.provider_name}</strong>
                  {locationDetail.owner_name ? ` · Owner: ${locationDetail.owner_name}` : ''}
                </p>
              </div>

              <div className="station-card-times">
                <div className="timestamp-block">
                  <span className="timestamp-label">Latest Station Observation:</span>
                  <span className="timestamp-value">
                    {locationDetail.datetime_last_local ||
                      locationDetail.datetime_last_utc ||
                      'Pending live update'}
                  </span>
                </div>
                <div className="timestamp-block">
                  <span className="timestamp-label">
                    Pollutant Observation (
                    {selectedSensor?.parameter_display_name || selectedParameter.toUpperCase()}
                    ):
                  </span>
                  <span className="timestamp-value">
                    {measurementsData?.sensor_datetime_last_local ||
                      selectedSensor?.datetime_last_local ||
                      selectedSensor?.datetime_last_utc ||
                      measurementsData?.sensor_datetime_last_utc ||
                      'No observation recorded for this sensor'}
                  </span>
                </div>
                {locationDetail.coordinates && (
                  <div className="coords-block">
                    <span className="coords-label">Coordinates:</span>
                    <span className="coords-value font-mono">
                      {locationDetail.coordinates.latitude.toFixed(4)}°N,{' '}
                      {locationDetail.coordinates.longitude.toFixed(4)}°E
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Stale Data Warning */}
            {(isSensorStale || locationDetail.is_stale) && (
              <div className="stale-alert-banner" role="status">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>
                  <strong>Data Freshness Notice:</strong> Sensor observations for{' '}
                  <strong>{selectedSensor?.parameter_display_name || selectedParameter.toUpperCase()}</strong>{' '}
                  {measurementsData?.stale_message
                    ? `— ${measurementsData.stale_message}`
                    : 'have not updated within the past 24 hours. Readings reflect historical baseline recordings.'}
                </span>
              </div>
            )}

            {/* Investigation Controls: Pollutant & Time Range */}
          <div className="investigation-controls-row">
            <div className="control-group">
              <label className="control-label">Monitored Pollutant:</label>
              <div className="pollutant-pill-group" role="group" aria-label="Select Pollutant">
                {locationDetail.sensors.map((s) => {
                  const isSelected = selectedParameter.toLowerCase() === s.parameter_name.toLowerCase();
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`pollutant-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setCustomRange(null);
                        setSelectedParameter(s.parameter_name);
                      }}
                      aria-pressed={isSelected}
                    >
                      <span>{s.parameter_display_name}</span>
                      <small className="pill-unit">{s.units}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">Investigation Window:</label>
              <div className="time-range-group" role="group" aria-label="Select Time Range">
                {(['24h', '7d', '30d'] as TimeRangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`time-range-btn ${!customRange && timeRange === preset ? 'active' : ''}`}
                    onClick={() => {
                      setCustomRange(null);
                      setTimeRange(preset);
                    }}
                    aria-pressed={!customRange && timeRange === preset}
                  >
                    {preset === '24h' ? 'Last 24 Hours' : preset === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
                {customRange && (
                  <span className="time-range-btn active" style={{ cursor: 'default' }}>
                    {customRange.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    })()}

      {/* Operational Risk Assessment Card */}
      {locationDetail && !isDetailLoading && (
        <RiskAssessmentCard
          assessment={assessmentData}
          isLoading={isAssessmentLoading}
          error={assessmentError}
          onRetry={() => {
            if (selectedLocationId) {
              const reqId = ++assessmentRequestIdRef.current;
              setIsAssessmentLoading(true);
              setAssessmentError(null);
              const refTime = customRange ? customRange.to : undefined;
              fetchRiskAssessment(selectedLocationId, selectedParameter, undefined, refTime).then((res) => {
                if (reqId !== assessmentRequestIdRef.current) return;
                setIsAssessmentLoading(false);
                if (res.error) {
                  setAssessmentError(res.error);
                  setAssessmentData(null);
                  onAssessmentLoaded?.(null);
                } else if (res.data) {
                  setAssessmentData(res.data);
                  onAssessmentLoaded?.(res.data);
                }
              });
            }
          }}
        />
      )}

      {/* Upstream Error Banner */}
      {measurementsError && measurementsError.error_code !== 'MISSING_API_KEY' && (
        <div className="error-alert-box" role="alert">
          <div className="error-alert-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Upstream Error ({measurementsError.error_code})
          </div>
          <p>{measurementsError.message}</p>
          {measurementsError.instructions && <small>{measurementsError.instructions}</small>}
        </div>
      )}

      {/* Measurements Loading State */}
      {isMeasurementsLoading && (
        <div className="loading-state-box" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Retrieving actual observations from station sensors...</p>
        </div>
      )}

      {/* Measurements Results */}
      {measurementsData && !isMeasurementsLoading && (
        <div className="investigation-results-section">
          {measurementsData.total_observations === 0 && (() => {
            const activeSensor = locationDetail?.sensors.find(
              (s) => s.parameter_name.toLowerCase() === selectedParameter.toLowerCase()
            );
            const refDate =
              activeSensor?.datetime_last_utc ||
              measurementsData?.sensor_datetime_last_utc ||
              locationDetail?.datetime_last_utc;
            const isHistoricalStation = Boolean(
              refDate && Date.now() - new Date(refDate).getTime() > 30 * 86400 * 1000
            );

            return (
              <div className="empty-state-box" role="status" style={{ margin: '1rem 0' }}>
                <div className="empty-state-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="empty-state-title">No Observations In Selected Window</h3>
                <p className="empty-state-desc">
                  No observations recorded for this station and parameter in the selected period.
                  {isHistoricalStation && refDate ? (
                    <>
                      {' '}This sensor last recorded observations on <strong>{refDate.split('T')[0]}</strong>.
                      The selected window contains no data because transmission ceased.
                    </>
                  ) : (
                    <>
                      {locationDetail?.datetime_last_local || locationDetail?.datetime_last_utc ? (
                        <> Latest station observation was on <strong>{locationDetail.datetime_last_local || locationDetail.datetime_last_utc}</strong>.</>
                      ) : null}
                      {' '}Try selecting a broader time window or a different pollutant.
                    </>
                  )}
                </p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {isHistoricalStation && refDate && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => loadHistoricalPeriod(refDate)}
                    >
                      View Historical Observations (7-Day Period Ending {refDate.split('T')[0]})
                    </button>
                  )}
                  {timeRange === '24h' && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setCustomRange(null);
                          setTimeRange('7d');
                        }}
                      >
                        Switch to Last 7 Days
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setCustomRange(null);
                          setTimeRange('30d');
                        }}
                      >
                        Switch to Last 30 Days
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Quick Metrics Bar */}
          <div className="metrics-strip">
            <div className="metric-cell">
              <span className="metric-label">Observation Count</span>
              <span className="metric-value">{measurementsData.total_observations}</span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Data Completeness</span>
              <span className="metric-value">
                {measurementsData.total_observations === 0
                  ? '0.0%'
                  : measurementsData.missing_percentage !== null && measurementsData.missing_percentage !== undefined
                  ? `${(100 - measurementsData.missing_percentage).toFixed(1)}%`
                  : '100%'}
              </span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Units</span>
              <span className="metric-value">{measurementsData.units}</span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Latest Measurement Time</span>
              <span className="metric-value font-mono">
                {measurementsData.sensor_datetime_last_local ||
                  (measurementsData.sensor_datetime_last_utc
                    ? new Date(measurementsData.sensor_datetime_last_utc).toUTCString()
                    : 'None recorded')}
              </span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Query Timestamp (Retrieved)</span>
              <span className="metric-value font-mono">
                {new Date(measurementsData.retrieved_at_utc).toISOString().replace('T', ' ').substring(0, 19)} UTC
              </span>
            </div>
          </div>

          {/* Time Series Chart */}
          <AirQualityChart
            measurements={measurementsData.measurements}
            parameterDisplayName={measurementsData.parameter_display_name}
            units={measurementsData.units}
            stationName={measurementsData.station_name}
          />

          {/* Data Integrity Banner */}
          <div className="chart-disclaimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{measurementsData.data_integrity_notice}</span>
          </div>

          {/* Accessible Observation Table */}
          <MeasurementTable
            measurements={measurementsData.measurements}
            parameterDisplayName={measurementsData.parameter_display_name}
            units={measurementsData.units}
            stationName={measurementsData.station_name}
            locationId={measurementsData.location_id}
            sensorId={measurementsData.sensor_id}
          />
        </div>
      )}
    </article>
  );
};
