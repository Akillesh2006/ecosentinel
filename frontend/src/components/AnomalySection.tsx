import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  AirQualityAnomalyResponse,
  AirQualityApiError,
  AnomalyObservationPoint,
  AnomalyWindowPreset,
  LocationDetail,
  LocationSummary,
} from '../types';
import { fetchAirQualityAnomalies, fetchLocations, fetchLocationDetail } from '../services/api';
import { AnomalyChart } from './AnomalyChart';
import { AnomalyEvidencePanel } from './AnomalyEvidencePanel';

export interface AnomalySectionProps {
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

export const AnomalySection: React.FC<AnomalySectionProps> = ({
  selectedLocation,
  onSelectLocation,
  activeParameter,
}) => {
  // Station state
  const [stationId, setStationId] = useState<number>(selectedLocation?.id || 3060);
  const [stationName, setStationName] = useState<string>(selectedLocation?.name || 'Monitoring Station');
  const [availableStations, setAvailableStations] = useState<LocationSummary[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState<boolean>(false);

  // Parameter & Window filters
  const [parameter, setParameter] = useState<string>(activeParameter || 'pm25');
  const [windowPreset, setWindowPreset] = useState<AnomalyWindowPreset>('24h');
  const [referenceTime, setReferenceTime] = useState<string>('');
  const [sensorPrecisionInput, setSensorPrecisionInput] = useState<string>('');

  // Response data & UI state
  const [anomalyData, setAnomalyData] = useState<AirQualityAnomalyResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<AirQualityApiError | null>(null);
  const [selectedObservation, setSelectedObservation] = useState<AnomalyObservationPoint | null>(null);

  // Race condition protection ref
  const requestIdRef = useRef<number>(0);

  // Sync if selectedLocation prop changes
  useEffect(() => {
    if (selectedLocation) {
      setStationId(selectedLocation.id);
      setStationName(selectedLocation.name);
    }
  }, [selectedLocation]);

  // Sync if activeParameter prop changes
  useEffect(() => {
    if (activeParameter) {
      setParameter(activeParameter);
    }
  }, [activeParameter]);

  // Load list of Indian stations for station switcher
  useEffect(() => {
    let isMounted = true;
    setIsLoadingStations(true);
    fetchLocations()
      .then((res) => {
        if (isMounted && res.data) {
          setAvailableStations(res.data);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingStations(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch anomalies from backend with race-condition protection and abort cancellation
  const loadAnomalies = useCallback(() => {
    const reqId = ++requestIdRef.current;
    const controller = new AbortController();

    setIsLoading(true);
    setApiError(null);

    const precisionNum =
      sensorPrecisionInput.trim().length > 0 && !isNaN(Number(sensorPrecisionInput))
        ? Number(sensorPrecisionInput)
        : undefined;

    fetchAirQualityAnomalies(
      stationId,
      parameter,
      windowPreset,
      referenceTime.trim() || undefined,
      precisionNum,
      controller.signal
    ).then((res) => {
      if (reqId !== requestIdRef.current) return;
      setIsLoading(false);

      if (res.error) {
        setApiError(res.error);
        setAnomalyData(null);
        setSelectedObservation(null);
      } else if (res.data) {
        setAnomalyData(res.data);
        setStationName(res.data.station_name);

        // Default selection to the first statistical anomaly or latest observation
        const firstAnomaly = res.data.observations.find((o) => o.is_anomaly);
        if (firstAnomaly) {
          setSelectedObservation(firstAnomaly);
        } else if (res.data.observations.length > 0) {
          setSelectedObservation(res.data.observations[res.data.observations.length - 1]);
        } else {
          setSelectedObservation(null);
        }
      }
    });

    return () => {
      controller.abort();
    };
  }, [stationId, parameter, windowPreset, referenceTime, sensorPrecisionInput]);

  useEffect(() => {
    const cleanup = loadAnomalies();
    return () => {
      cleanup?.();
    };
  }, [loadAnomalies]);

  // Handle station change from dropdown and notify parent application state
  const handleStationSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = Number(e.target.value);
    setStationId(newId);
    const found = availableStations.find((s) => s.id === newId);
    if (found) {
      setStationName(found.name);
    }
    if (onSelectLocation) {
      const detailRes = await fetchLocationDetail(newId);
      if (detailRes.data) {
        onSelectLocation(detailRes.data);
      }
    }
  };

  // Filter detected anomalies for the event log
  const notableEvents = useMemo(() => {
    if (!anomalyData?.observations) return [];
    return anomalyData.observations.filter(
      (o) =>
        o.is_anomaly ||
        o.is_heuristic_step_surge ||
        o.consecutive_elevated_hours >= 3 ||
        o.anomaly_type === 'MODERATE_ELEVATION'
    );
  }, [anomalyData?.observations]);

  return (
    <section className="section-container" aria-label="Pollution Intelligence Anomaly Detection">
      {/* Section Header */}
      <div className="section-header" style={{ marginBottom: '1.25rem' }}>
        <h2>Pollution Intelligence &amp; Anomaly Detection</h2>
        <p className="section-subtitle">
          Non-parametric Jackknife leave-one-out statistical screening, rate-of-change surges, and sensor diagnostics.
        </p>
      </div>

      {/* Control Panel: Station, Parameter, Window, Diagnostics */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="card-icon" aria-hidden="true" style={{ fontSize: '1.2rem' }}>⚡</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--eco-text-primary)', margin: 0 }}>
              Evaluation Controls &amp; Context
            </h3>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadAnomalies}
            disabled={isLoading}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
          >
            {isLoading ? 'Screening Telemetry...' : 'Refresh Screening'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Station Selection */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="station-selector" style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--eco-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              Monitoring Station
            </label>
            <select
              id="station-selector"
              className="form-control"
              value={stationId}
              onChange={handleStationSelect}
              disabled={isLoading || isLoadingStations}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              {availableStations.length > 0 ? (
                availableStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.locality || s.country_code})
                  </option>
                ))
              ) : (
                <option value={stationId}>{stationName}</option>
              )}
            </select>
          </div>

          {/* Pollutant Parameter Selection */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="parameter-selector" style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--eco-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              Target Pollutant
            </label>
            <select
              id="parameter-selector"
              className="form-control"
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
              disabled={isLoading}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              {SUPPORTED_PARAMETERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Window Preset Selector */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--eco-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              Evaluation Window
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${windowPreset === '24h' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setWindowPreset('24h')}
                style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
              >
                24-Hour (18/24 min)
              </button>
              <button
                type="button"
                className={`btn ${windowPreset === '7d' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setWindowPreset('7d')}
                style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
              >
                7-Day (126/168 min)
              </button>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', display: 'block', marginTop: '0.25rem' }}>
              {windowPreset === '24h'
                ? 'Primary screening: 24h rolling window (requires ≥18 hourly observations / 75%)'
                : 'Complete historical evaluation: 168h interval (requires ≥126 hourly observations / 75%)'}
            </span>
          </div>

          {/* Optional Reference Time (Deterministic Backtest) */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label htmlFor="ref-time-input" style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--eco-text-secondary)' }}>
                Reference Time (Optional)
              </label>
              {referenceTime && (
                <button
                  type="button"
                  onClick={() => setReferenceTime('')}
                  style={{ background: 'none', border: 'none', color: 'var(--eco-teal)', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}
                >
                  Clear (Live)
                </button>
              )}
            </div>
            <input
              id="ref-time-input"
              type="text"
              className="form-control"
              placeholder="e.g. 2026-11-01T12:00:00Z"
              value={referenceTime}
              onChange={(e) => setReferenceTime(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          {/* Optional Caller-Supplied Precision Threshold */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="precision-input" style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--eco-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              Caller Precision Test (Optional)
            </label>
            <input
              id="precision-input"
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              placeholder="e.g. 0.1 (Caller-supplied)"
              value={sensorPrecisionInput}
              onChange={(e) => setSensorPrecisionInput(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', display: 'block', marginTop: '0.25rem' }}>
              Explicitly labeled as caller-supplied test input; not verified metadata.
            </span>
          </div>
        </div>
      </div>

      {/* API Error State */}
      {apiError && (
        <div className="card" style={{ borderLeft: '4px solid var(--eco-status-anomaly)', marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--eco-status-anomaly)', fontWeight: 600 }}>
            <span>⚠️</span>
            <h4>{apiError.error || 'Anomaly Detection Error'}</h4>
          </div>
          <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--eco-text-secondary)' }}>
            {apiError.message}
          </p>
          {apiError.instructions && (
            <p style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--eco-text-muted)' }}>
              {apiError.instructions}
            </p>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !anomalyData && (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--eco-teal)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Screening Telemetry Observations...
          </div>
          <p style={{ color: 'var(--eco-text-muted)', fontSize: '0.85rem' }}>
            Executing Jackknife leave-one-out non-parametric baseline calculations and difference dispersion tests.
          </p>
        </div>
      )}

      {/* Main Analysis Display */}
      {anomalyData && (
        <>
          {/* Data Quality & Diagnostics Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {/* Freshness & Metadata Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                background: 'var(--eco-bg-card)',
                border: '1px solid var(--eco-border-subtle)',
                borderRadius: 'var(--eco-radius-md)',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--eco-text-secondary)' }}>Freshness Status:</span>
                <span
                  className={`badge badge-${
                    anomalyData.freshness_state === 'FRESH'
                      ? 'normal'
                      : anomalyData.freshness_state === 'DELAYED'
                      ? 'warning'
                      : 'muted'
                  }`}
                >
                  {anomalyData.freshness_state}
                </span>
                {anomalyData.freshness_message && (
                  <span style={{ color: 'var(--eco-text-muted)', fontSize: '0.75rem' }}>
                    ({anomalyData.freshness_message})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ color: 'var(--eco-text-secondary)' }}>Precision Provenance:</span>
                  <span
                    className={`badge badge-${
                      anomalyData.precision_provenance === 'AUTHORITATIVE_METADATA'
                        ? 'normal'
                        : anomalyData.precision_provenance === 'CALLER_SUPPLIED'
                        ? 'warning'
                        : 'muted'
                    }`}
                  >
                    {anomalyData.precision_provenance}
                  </span>
                </div>
                {anomalyData.sensor_precision !== null && anomalyData.sensor_precision !== undefined && (
                  <span style={{ color: 'var(--eco-text-muted)', fontFamily: 'var(--eco-font-mono)' }}>
                    [{anomalyData.sensor_precision} {anomalyData.units}]
                  </span>
                )}
              </div>
            </div>

            {/* Insufficient Coverage Warning Banner */}
            {(!anomalyData.is_coverage_satisfied || anomalyData.coverage_state === 'INSUFFICIENT_COVERAGE') && (
              <div
                className="warning-item"
                style={{
                  background: 'var(--eco-status-anomaly-bg)',
                  borderColor: 'var(--eco-status-anomaly-border)',
                  color: 'var(--eco-status-anomaly)',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--eco-radius-md)',
                  margin: 0,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>🛑</span>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>Statistical Evaluation Suppressed: Insufficient Coverage</strong>
                  <p style={{ marginTop: '0.3rem', fontSize: '0.825rem', color: 'var(--eco-text-primary)', lineHeight: 1.5 }}>
                    Retrieved {anomalyData.valid_observations} of {anomalyData.expected_observations} expected hourly observations ({anomalyData.completeness_percentage}%).
                    A minimum of 75% coverage ({anomalyData.expected_observations === 24 ? 18 : 126} observations) is required to construct a valid baseline.
                    Statistical anomaly screening, modified Z-scores, and step evaluations are suppressed to prevent inaccurate baselines.
                  </p>
                </div>
              </div>
            )}

            {/* Zero-MAD / Scale Indeterminate Diagnostic Banner */}
            {(anomalyData.summary.scale_indeterminate ||
              anomalyData.baseline_metrics?.scale_state === 'INDETERMINATE_ZERO_MAD') && (
              <div
                className="warning-item"
                style={{
                  background: 'var(--eco-status-elevated-bg)',
                  borderColor: 'var(--eco-status-elevated-border)',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--eco-radius-md)',
                  margin: 0,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#fbbf24' }}>
                    Scale Indeterminate (Zero-MAD Baseline)
                  </strong>
                  <p style={{ marginTop: '0.3rem', fontSize: '0.825rem', color: 'var(--eco-text-primary)', lineHeight: 1.5 }}>
                    At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0).
                    Under zero baseline dispersion, modified Z-scores produce a zero division artifact.
                    Statistical score evaluations are appropriately suppressed.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Overview KPI Cards */}
          <div
            className="grid-kpi"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* KPI 1: Evaluated Observations & Coverage */}
            <div className="card" style={{ padding: '1rem' }}>
              <span className="metric-label">Data Completeness &amp; Gate</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span className="metric-value" style={{ color: 'var(--eco-text-primary)' }}>
                  {anomalyData.valid_observations}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--eco-text-muted)' }}>
                  / {anomalyData.expected_observations} ({anomalyData.completeness_percentage}%)
                </span>
              </div>
              <div style={{ marginTop: '0.4rem' }}>
                <span
                  className={`badge badge-${anomalyData.is_coverage_satisfied ? 'normal' : 'anomaly'}`}
                  style={{ fontSize: '0.675rem' }}
                >
                  {anomalyData.coverage_state}
                </span>
              </div>
            </div>

            {/* KPI 2: Statistical Anomalies */}
            <div className="card" style={{ padding: '1rem' }}>
              <span className="metric-label">Statistical Anomalies (|M| ≥ 3.5)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span
                  className="metric-value"
                  style={{
                    color:
                      anomalyData.summary.total_anomalies_detected > 0
                        ? 'var(--eco-status-anomaly)'
                        : 'var(--eco-status-normal)',
                  }}
                >
                  {anomalyData.summary.total_anomalies_detected}
                </span>
              </div>
              <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)', display: 'block', marginTop: '0.35rem' }}>
                {anomalyData.summary.total_spikes} Spikes • {anomalyData.summary.total_anomalies_detected - anomalyData.summary.total_spikes} Drops
              </span>
            </div>

            {/* KPI 3: Moderate Deviations */}
            <div className="card" style={{ padding: '1rem' }}>
              <span className="metric-label">Moderate Deviations (2.5 ≤ |M| &lt; 3.5)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span className="metric-value" style={{ color: 'var(--eco-status-elevated)' }}>
                  {anomalyData.summary.total_moderate_elevations}
                </span>
              </div>
              <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)', display: 'block', marginTop: '0.35rem' }}>
                Sub-critical elevated variance
              </span>
            </div>

            {/* KPI 4: Rate-of-Change Step Surges */}
            <div className="card" style={{ padding: '1rem' }}>
              <span className="metric-label">Rate-of-Change Surges</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span className="metric-value" style={{ color: 'var(--eco-teal)' }}>
                  {anomalyData.summary.total_step_surges}
                </span>
              </div>
              <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)', display: 'block', marginTop: '0.35rem' }}>
                Rapid 1h step variations (Δt ≤ 90m)
              </span>
            </div>

            {/* KPI 5: Sustained Episodes */}
            <div className="card" style={{ padding: '1rem' }}>
              <span className="metric-label">Sustained Episodes (≥ 3h)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span className="metric-value" style={{ color: 'var(--eco-status-elevated)' }}>
                  {anomalyData.summary.total_sustained_episodes}
                </span>
              </div>
              <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)', display: 'block', marginTop: '0.35rem' }}>
                Persistent elevated runs
              </span>
            </div>

            {/* KPI 6: Sensor Diagnostics */}
            <div className="card" style={{ padding: '1rem' }}>
              <span className="metric-label">Sensor Invariance Status</span>
              <div style={{ marginTop: '0.35rem' }}>
                <span
                  className={`badge badge-${
                    anomalyData.summary.flatline_indicator === 'NORMAL_DISPERSION'
                      ? 'normal'
                      : anomalyData.summary.flatline_indicator === 'SUSPECTED_FLATLINE'
                      ? 'warning'
                      : 'muted'
                  }`}
                  style={{ fontSize: '0.725rem' }}
                >
                  {anomalyData.summary.flatline_indicator}
                </span>
              </div>
              <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)', display: 'block', marginTop: '0.35rem' }}>
                {anomalyData.summary.flatline_message || 'Normal sensor dispersion verified'}
              </span>
            </div>
          </div>

          {/* Time Series Chart Card */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <AnomalyChart
              observations={anomalyData.observations}
              baselineMetrics={anomalyData.baseline_metrics}
              parameterDisplayName={anomalyData.parameter_display_name}
              units={anomalyData.units}
              stationName={anomalyData.station_name}
              selectedObservation={selectedObservation}
              onSelectObservation={setSelectedObservation}
            />
          </div>

          {/* Evidence Panel & Notable Events Table Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Detail Evidence Panel */}
            <AnomalyEvidencePanel
              observation={selectedObservation}
              parameterDisplayName={anomalyData.parameter_display_name}
              units={anomalyData.units}
              precisionProvenance={anomalyData.precision_provenance}
              sensorPrecision={anomalyData.sensor_precision}
            />

            {/* Notable Anomaly Events Quick-Select List */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--eco-text-primary)', margin: 0 }}>
                  Detected Events &amp; Anomalies Log
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)' }}>
                  {notableEvents.length} events logged
                </span>
              </div>

              {notableEvents.length === 0 ? (
                <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.825rem', textAlign: 'center', padding: '2rem 1rem' }}>
                  No statistical anomalies or rapid step surges detected within this evaluation window.
                </div>
              ) : (
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: '0.775rem' }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Value</th>
                        <th>Classification</th>
                        <th>Mod. Z</th>
                        <th>CPCB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notableEvents.map((evt, idx) => {
                        const isSelected = selectedObservation?.datetime_utc === evt.datetime_utc;
                        return (
                          <tr
                            key={`event-${idx}-${evt.datetime_utc}`}
                            onClick={() => setSelectedObservation(evt)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'var(--eco-bg-card-hover)' : undefined,
                            }}
                          >
                            <td style={{ color: 'var(--eco-text-muted)', fontFamily: 'var(--eco-font-mono)' }}>
                              {evt.datetime_local || evt.datetime_utc.slice(11, 16)}
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--eco-text-primary)' }}>
                              {evt.observed_value} {anomalyData.units}
                            </td>
                            <td>
                              <span
                                className={`badge badge-${
                                  evt.anomaly_type === 'STATISTICAL_SPIKE'
                                    ? 'anomaly'
                                    : evt.anomaly_type === 'STATISTICAL_DROP'
                                    ? 'info'
                                    : evt.anomaly_type === 'MODERATE_ELEVATION'
                                    ? 'warning'
                                    : 'normal'
                                }`}
                                style={{ fontSize: '0.675rem' }}
                              >
                                {evt.anomaly_type || 'NORMAL'}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'var(--eco-font-mono)' }}>
                              {evt.modified_z_score !== null && evt.modified_z_score !== undefined
                                ? `${evt.modified_z_score > 0 ? '+' : ''}${evt.modified_z_score.toFixed(2)}`
                                : '—'}
                            </td>
                            <td>
                              <span style={{ color: evt.is_cpcb_exceedance ? 'var(--eco-status-anomaly)' : 'var(--eco-status-normal)' }}>
                                {evt.is_cpcb_exceedance ? 'Exceeds' : 'OK'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Permanent Attribution & Limitations Notice */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--eco-teal)',
          background: 'var(--eco-bg-card-subtle)',
          padding: '1rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '1rem', color: 'var(--eco-teal)' }}>ℹ️</span>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--eco-text-primary)', margin: 0 }}>
            Attribution &amp; Limitations Notice
          </h4>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--eco-text-secondary)', lineHeight: 1.5, margin: 0 }}>
          Statistical anomaly detection identifies abnormal concentration variance relative to baseline observations.
          It does not establish emission sources, industrial culpability, atmospheric transport mechanisms, or direct health outcomes.
        </p>
      </div>
    </section>
  );
};
