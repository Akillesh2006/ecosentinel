import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, History, Search } from 'lucide-react';
import type {
  AirQualityApiError,
  LocationDetail,
  LocationMeasurementsResponse,
  LocationSummary,
  RiskAssessmentResponse,
  TimeRangePreset,
} from '../types';
import {
  fetchLocationDetail,
  fetchLocations,
  fetchMeasurements,
  fetchRiskAssessment,
} from '../services/api';
import { useStationContext, type CustomRangeState } from '../context/StationContext';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { SkeletonChart } from './ui/Skeleton';
import { ApiKeyMissingBanner } from './ApiKeyMissingBanner';
import { AirQualityChart } from './AirQualityChart';
import { MeasurementTable } from './MeasurementTable';
import { RiskAssessmentCard } from './RiskAssessmentCard';
import { StationCombobox } from './stations/StationCombobox';
import { StationHeroCard } from './stations/StationHeroCard';
import styles from './stations/Stations.module.css';

export interface InvestigateAirQualityProps {
  selectedLocation?: LocationDetail | null;
  onMeasurementsLoaded?: (data: LocationMeasurementsResponse | null) => void;
  onLocationSelected?: (location: LocationDetail | null) => void;
  onAssessmentLoaded?: (data: RiskAssessmentResponse | null) => void;
  onMeasurementsLoadingChange?: (loading: boolean) => void;
}

const QUICK_CITIES = ['All India', 'Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Jaipur'];

function pickBestParameter(available: string[], current: string): string {
  if (!available || available.length === 0) return current;
  const exact = available.find((p) => p.toLowerCase() === current.toLowerCase());
  if (exact) return exact;
  const pm25 = available.find((p) => p.toLowerCase() === 'pm25' || p.toLowerCase() === 'pm2.5');
  return pm25 || available[0];
}

function buildRangeIso(preset: TimeRangePreset, nowMs: number): { from?: string; to?: string } {
  if (preset === '24h') return {};
  const hours = preset === '7d' ? 24 * 7 : 24 * 30;
  const to = new Date(nowMs);
  const from = new Date(nowMs - hours * 3600 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Stations investigation workspace: station catalog search, city-grouped combobox,
 * plain-language verdict banner, gap-aware time-series chart, CPCB/WHO evaluation,
 * and paginated UTC/IST evidence log.
 */
export const InvestigateAirQuality: React.FC<InvestigateAirQualityProps> = ({
  selectedLocation: propSelectedLocation,
  onMeasurementsLoaded,
  onLocationSelected,
  onAssessmentLoaded,
  onMeasurementsLoadingChange,
}) => {
  const ctx = useStationContext();
  const [mountNowMs] = useState<number>(() => Date.now());

  // Local fallbacks when rendered standalone without StationProvider
  const [localSearch, setLocalSearch] = useState('');
  const [localCatalog, setLocalCatalog] = useState<LocationSummary[]>([]);
  const [localHasLoaded, setLocalHasLoaded] = useState(false);
  const [localLocation, setLocalLocation] = useState<LocationDetail | null>(
    propSelectedLocation || null
  );
  const [localParam, setLocalParam] = useState('pm25');
  const [localTimeRange, setLocalTimeRange] = useState<TimeRangePreset>('24h');
  const [localCustomRange, setLocalCustomRange] = useState<CustomRangeState | null>(null);
  const [localMeasurements, setLocalMeasurements] = useState<LocationMeasurementsResponse | null>(null);
  const [localAssessment, setLocalAssessment] = useState<RiskAssessmentResponse | null>(null);
  const [localLoadingMeas, setLocalLoadingMeas] = useState(false);
  const [localLoadedKey, setLocalLoadedKey] = useState<string | null>(null);
  const [localLoadedAssessKey, setLocalLoadedAssessKey] = useState<string | null>(null);

  const searchQuery = ctx ? ctx.searchQuery : localSearch;
  const setSearchQuery = ctx ? ctx.setSearchQuery : setLocalSearch;
  const locations = ctx ? ctx.locationsCatalog : localCatalog;
  const setLocations = ctx ? ctx.setLocationsCatalog : setLocalCatalog;
  const hasLoadedCatalog = ctx ? ctx.hasLoadedCatalog : localHasLoaded;
  const setHasLoadedCatalog = ctx ? ctx.setHasLoadedCatalog : setLocalHasLoaded;

  const locationDetail = ctx ? ctx.selectedLocation : localLocation;
  const setLocationDetail = ctx ? ctx.setSelectedLocation : setLocalLocation;
  const activeParameter = ctx ? ctx.selectedParameter : localParam;
  const setActiveParameter = ctx ? ctx.setSelectedParameter : setLocalParam;
  const timeRange = ctx ? ctx.timeRange : localTimeRange;
  const setTimeRange = ctx ? ctx.setTimeRange : setLocalTimeRange;
  const customRange = ctx ? ctx.customRange : localCustomRange;
  const setCustomRange = ctx ? ctx.setCustomRange : setLocalCustomRange;
  const measurementsData = ctx ? ctx.measurementsData : localMeasurements;
  const setMeasurementsData = ctx ? ctx.setMeasurementsData : setLocalMeasurements;
  const assessmentData = ctx ? ctx.assessmentData : localAssessment;
  const setAssessmentData = ctx ? ctx.setAssessmentData : setLocalAssessment;
  const isLoadingMeasurements = ctx ? ctx.isMeasurementsLoading : localLoadingMeas;
  const setIsLoadingMeasurements = ctx ? ctx.setIsMeasurementsLoading : setLocalLoadingMeas;
  const loadedKey = ctx ? ctx.loadedKey : localLoadedKey;
  const setLoadedKey = ctx ? ctx.setLoadedKey : setLocalLoadedKey;
  const loadedAssessKey = ctx ? ctx.loadedAssessKey : localLoadedAssessKey;
  const setLoadedAssessKey = ctx ? ctx.setLoadedAssessKey : setLocalLoadedAssessKey;

  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState<AirQualityApiError | null>(null);
  const [measurementsError, setMeasurementsError] = useState<AirQualityApiError | null>(null);
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<AirQualityApiError | null>(null);

  const detailReqSeq = useRef(0);
  const measReqSeq = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);

  const notifyMeasurements = useCallback(
    (data: LocationMeasurementsResponse | null) => {
      setMeasurementsData(data);
      onMeasurementsLoaded?.(data);
    },
    [setMeasurementsData, onMeasurementsLoaded]
  );

  const notifyAssessment = useCallback(
    (data: RiskAssessmentResponse | null) => {
      setAssessmentData(data);
      onAssessmentLoaded?.(data);
    },
    [setAssessmentData, onAssessmentLoaded]
  );

  const notifyLoading = useCallback(
    (loading: boolean) => {
      setIsLoadingMeasurements(loading);
      onMeasurementsLoadingChange?.(loading);
    },
    [setIsLoadingMeasurements, onMeasurementsLoadingChange]
  );

  // Sync external propSelectedLocation only if no station loaded yet
  useEffect(() => {
    if (propSelectedLocation && propSelectedLocation.id !== locationDetail?.id) {
      setLocationDetail(propSelectedLocation);
      if (propSelectedLocation.available_parameters?.length) {
        setActiveParameter(pickBestParameter(propSelectedLocation.available_parameters, activeParameter));
      }
    }
  }, [propSelectedLocation, locationDetail?.id, setLocationDetail, setActiveParameter, activeParameter]);

  const runTelemetryRequest = useCallback(
    async (
      detail: LocationDetail,
      param: string,
      preset: TimeRangePreset,
      custom: CustomRangeState | null,
      force: boolean = false
    ) => {
      const rangeKey = custom ? `${custom.from}..${custom.to}` : preset;
      const qKey = `${detail.id}::${param}::${rangeKey}`;
      if (
        !force &&
        ((loadedKey === qKey && loadedAssessKey === qKey) || inFlightKeyRef.current === qKey)
      ) {
        return;
      }

      const avail = detail.available_parameters || [];
      const safeParam = pickBestParameter(avail, param);
      if (safeParam !== param) {
        setActiveParameter(safeParam);
        return;
      }

      inFlightKeyRef.current = qKey;
      const reqId = ++measReqSeq.current;
      notifyLoading(true);
      setIsLoadingAssessment(true);
      setMeasurementsError(null);
      setAssessmentError(null);

      const { from, to } = custom
        ? { from: custom.from, to: custom.to }
        : buildRangeIso(preset, Date.now());
      const refTime = custom ? custom.to : undefined;

      const [measRes, assessRes] = await Promise.all([
        fetchMeasurements(detail.id, safeParam, from, to),
        fetchRiskAssessment(detail.id, safeParam, undefined, refTime),
      ]);

      if (inFlightKeyRef.current === qKey) {
        inFlightKeyRef.current = null;
      }
      if (reqId !== measReqSeq.current) return;

      notifyLoading(false);
      setIsLoadingAssessment(false);

      if (measRes.error) {
        setMeasurementsError(measRes.error);
        notifyMeasurements(null);
        setLoadedKey(qKey);
      } else if (measRes.data) {
        notifyMeasurements(measRes.data);
        setLoadedKey(qKey);
      }

      if (assessRes.error) {
        setAssessmentError(assessRes.error);
        notifyAssessment(null);
        setLoadedAssessKey(qKey);
      } else {
        notifyAssessment(assessRes.data);
        setLoadedAssessKey(qKey);
      }
    },
    [
      loadedKey,
      loadedAssessKey,
      setActiveParameter,
      notifyLoading,
      notifyMeasurements,
      notifyAssessment,
      setLoadedKey,
      setLoadedAssessKey,
    ]
  );

  const selectAndLoadDetail = useCallback(
    async (stationId: number) => {
      const reqId = ++detailReqSeq.current;
      measReqSeq.current += 1;
      setMeasurementsError(null);
      setAssessmentError(null);
      notifyMeasurements(null);
      notifyAssessment(null);
      setLoadedKey(null);
      setLoadedAssessKey(null);
      setCustomRange(null);

      const res = await fetchLocationDetail(stationId);
      if (reqId !== detailReqSeq.current) return;

      if (res.data) {
        const detail = res.data;
        const nextParam = pickBestParameter(detail.available_parameters || [], activeParameter);
        setActiveParameter(nextParam);
        setLocationDetail(detail);
        onLocationSelected?.(detail);
        runTelemetryRequest(detail, nextParam, timeRange, null, true);
      } else if (res.error) {
        setLocationsError(res.error);
      }
    },
    [
      activeParameter,
      timeRange,
      notifyMeasurements,
      notifyAssessment,
      setLoadedKey,
      setLoadedAssessKey,
      setCustomRange,
      setActiveParameter,
      setLocationDetail,
      onLocationSelected,
      runTelemetryRequest,
    ]
  );

  const executeLocationSearch = useCallback(
    async (queryText: string) => {
      setIsLoadingLocations(true);
      setLocationsError(null);
      const res = await fetchLocations(queryText.trim() || undefined);
      setIsLoadingLocations(false);
      setHasLoadedCatalog(true);

      if (res.error) {
        setLocationsError(res.error);
        return;
      }

      const list = res.data || [];
      setLocations(list);

      if (list.length > 0 && (!locationDetail || !list.some((l) => l.id === locationDetail.id))) {
        selectAndLoadDetail(list[0].id);
      }
    },
    [locationDetail, selectAndLoadDetail, setHasLoadedCatalog, setLocations]
  );

  // Load initial catalog via immediate microtask once across route transitions
  useEffect(() => {
    if (hasLoadedCatalog && locations.length > 0) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        executeLocationSearch(searchQuery);
      }
    });
    return () => {
      active = false;
    };
  }, [hasLoadedCatalog, locations.length, executeLocationSearch, searchQuery]);

  const activeQueryKey = useMemo(() => {
    if (!locationDetail?.id || !activeParameter) return null;
    const rangeKey = customRange ? `${customRange.from}..${customRange.to}` : timeRange;
    return `${locationDetail.id}::${activeParameter}::${rangeKey}`;
  }, [locationDetail?.id, activeParameter, timeRange, customRange]);

  const fetchStationTelemetry = useCallback(
    async (force: boolean = false) => {
      if (!locationDetail?.id || !activeParameter) return;
      await runTelemetryRequest(locationDetail, activeParameter, timeRange, customRange, force);
    },
    [locationDetail, activeParameter, timeRange, customRange, runTelemetryRequest]
  );

  // Synchronize if user returns to route or initial prop location exists without measurements loaded
  useEffect(() => {
    if (!locationDetail || !activeQueryKey) return;
    if (loadedKey === activeQueryKey && loadedAssessKey === activeQueryKey) return;
    runTelemetryRequest(locationDetail, activeParameter, timeRange, customRange, false);
  }, [
    locationDetail,
    activeParameter,
    timeRange,
    customRange,
    activeQueryKey,
    loadedKey,
    loadedAssessKey,
    runTelemetryRequest,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLocationSearch(searchQuery);
  };

  const handleQuickCity = (city: string) => {
    const q = city === 'All India' ? '' : city;
    setSearchQuery(q);
    executeLocationSearch(q);
  };

  const handleParameterChange = (param: string) => {
    if (param === activeParameter) return;
    setActiveParameter(param);
    notifyMeasurements(null);
    notifyAssessment(null);
    setLoadedKey(null);
    setLoadedAssessKey(null);
  };

  const handleTimeRangeChange = (preset: TimeRangePreset) => {
    setCustomRange(null);
    setTimeRange(preset);
    setLoadedKey(null);
    setLoadedAssessKey(null);
  };

  const handleLoadHistorical = (endDateIso: string) => {
    const to = new Date(endDateIso);
    const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000);
    setCustomRange({
      from: from.toISOString(),
      to: to.toISOString(),
      label: `Historical (ending ${endDateIso.split('T')[0]})`,
    });
    setLoadedKey(null);
    setLoadedAssessKey(null);
  };

  const matchedAssessment =
    assessmentData && assessmentData.parameter?.toLowerCase() === activeParameter.toLowerCase()
      ? assessmentData
      : null;

  const selectedSensor = locationDetail?.sensors?.find(
    (s) => s.parameter_name?.toLowerCase() === activeParameter.toLowerCase()
  );

  const lastReportedUtc =
    measurementsData?.sensor_datetime_last_utc ||
    selectedSensor?.datetime_last_utc ||
    locationDetail?.datetime_last_utc;

  const referenceClockMs = measurementsData?.retrieved_at_utc
    ? new Date(measurementsData.retrieved_at_utc).getTime()
    : mountNowMs;
  const lastReportedMs = lastReportedUtc ? new Date(lastReportedUtc).getTime() : NaN;
  const isHistoricalInactive =
    Number.isFinite(lastReportedMs) &&
    referenceClockMs - lastReportedMs > 30 * 24 * 3600 * 1000;

  const isSensorStale = Boolean(
    measurementsData?.is_stale ||
      locationDetail?.is_stale ||
      (Number.isFinite(lastReportedMs) && referenceClockMs - lastReportedMs > 24 * 3600 * 1000)
  );

  const missingKeyErr =
    locationsError?.error_code === 'MISSING_API_KEY'
      ? locationsError
      : measurementsError?.error_code === 'MISSING_API_KEY'
        ? measurementsError
        : null;

  return (
    <section
      id="panel-investigate"
      className={styles.page}
      aria-label="Station Telemetry Workspace"
    >
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Investigate Air Quality in India</h2>
        <p className={styles.sectionSubtitle}>
          Retrieve verifiable criteria pollutant observations from registered monitoring stations across India and compare against statutory CPCB and WHO thresholds.
        </p>
      </div>

      {missingKeyErr && (
        <ApiKeyMissingBanner
          contextMessage={missingKeyErr.instructions || missingKeyErr.message}
          onRetry={() => executeLocationSearch(searchQuery)}
        />
      )}

      {/* Station Search & City-Grouped Selector Card */}
      <Card padding="md" variant="default">
        <div className={styles.controlsGrid}>
          <div className={styles.fieldGroup}>
            <label htmlFor="station-search-input" className={styles.fieldLabel}>
              Search monitoring stations in India
            </label>
            <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
              <div className={styles.searchInputWrap}>
                <Search size={15} className={styles.searchIcon} aria-hidden="true" />
                <input
                  id="station-search-input"
                  type="search"
                  className={styles.searchInput}
                  placeholder="City, station name, or state..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" size="md" isLoading={isLoadingLocations}>
                Search
              </Button>
            </form>

            <div className={styles.cityPills}>
              {QUICK_CITIES.map((city) => {
                const isActive =
                  (city === 'All India' && !searchQuery) ||
                  searchQuery.toLowerCase() === city.toLowerCase();
                return (
                  <button
                    key={city}
                    type="button"
                    className={`${styles.cityPill} ${isActive ? styles.cityPillActive : ''}`.trim()}
                    onClick={() => handleQuickCity(city)}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span id="station-combobox-label" className={styles.fieldLabel}>
              Selected Station
            </span>
            <StationCombobox
              locations={locations}
              selectedId={locationDetail?.id || null}
              onSelect={selectAndLoadDetail}
              disabled={isLoadingLocations}
              labelId="station-combobox-label"
            />
            <span style={{ fontSize: 'var(--eco-text-xs)', color: 'var(--eco-text-muted)' }}>
              {locations.length} {locations.length === 1 ? 'station' : 'stations'} matched in India
            </span>
          </div>
        </div>
      </Card>

      {/* Non-API-Key Upstream Location Error */}
      {locationsError && locationsError.error_code !== 'MISSING_API_KEY' && (
        <div
          role="alert"
          style={{
            padding: 'var(--eco-space-4)',
            borderRadius: 'var(--eco-radius-card)',
            border: '1px solid var(--eco-status-anomaly-border)',
            background: 'var(--eco-status-anomaly-bg)',
            color: 'var(--eco-text-primary)',
          }}
        >
          <strong>
            Upstream Error ({locationsError.error_code}) — {locationsError.message}
          </strong>
          {locationsError.instructions && (
            <p style={{ marginTop: '4px', fontSize: 'var(--eco-text-xs)', color: 'var(--eco-text-secondary)' }}>
              {locationsError.instructions}
            </p>
          )}
        </div>
      )}

      {/* Empty Station Search Result */}
      {hasLoadedCatalog && !isLoadingLocations && locations.length === 0 && !locationsError && (
        <Card padding="lg" variant="default">
          <EmptyState
            title="No Matching Indian Monitoring Stations"
            description="No matching Indian locations found. Try a broader city name or reset to All India stations."
            actions={
              <Button variant="secondary" size="sm" onClick={() => handleQuickCity('All India')}>
                Reset to All India
              </Button>
            }
          />
        </Card>
      )}

      {/* Selected Station Overview Hero */}
      {locationDetail && (
        <StationHeroCard
          locationDetail={locationDetail}
          activeParameter={activeParameter}
          onSelectParameter={handleParameterChange}
          timeRange={timeRange}
          onSelectTimeRange={handleTimeRangeChange}
          customRangeLabel={customRange?.label}
          onClearCustomRange={() => handleTimeRangeChange('24h')}
          measurementsData={measurementsData}
          assessmentData={matchedAssessment}
          isLoadingMeasurements={isLoadingMeasurements}
          onRefresh={() => fetchStationTelemetry(true)}
        />
      )}

      {/* Upstream Measurements Error Alert */}
      {measurementsError && measurementsError.error_code !== 'MISSING_API_KEY' && (
        <div
          role="alert"
          style={{
            padding: 'var(--eco-space-4)',
            borderRadius: 'var(--eco-radius-card)',
            border: '1px solid var(--eco-status-anomaly-border)',
            background: 'var(--eco-status-anomaly-bg)',
            color: 'var(--eco-text-primary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--eco-space-3)',
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--eco-status-anomaly-text)', flexShrink: 0 }} />
          <div>
            <strong>
              Upstream Error ({measurementsError.error_code}) — {measurementsError.message}
            </strong>
            {measurementsError.instructions && (
              <p style={{ marginTop: '4px', fontSize: 'var(--eco-text-xs)', color: 'var(--eco-text-secondary)' }}>
                {measurementsError.instructions}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stale Sensor Warning */}
      {isSensorStale && measurementsData && !measurementsError && (
        <div
          role="status"
          style={{
            padding: 'var(--eco-space-3) var(--eco-space-4)',
            borderRadius: 'var(--eco-radius-card)',
            border: '1px solid var(--eco-status-elevated-border)',
            background: 'var(--eco-status-elevated-bg)',
            color: 'var(--eco-text-primary)',
            fontSize: 'var(--eco-text-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--eco-space-2)',
          }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--eco-status-elevated-text)', flexShrink: 0 }} />
          <span>
            <strong>Data Freshness Notice:</strong>{' '}
            {measurementsData.stale_message ||
              'Sensor observations are older than 24 hours. Telemetry reflects archival conditions rather than active real-time status.'}
          </span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoadingMeasurements && !measurementsError && (
        <SkeletonChart label={`Retrieving verified ${activeParameter.toUpperCase()} observations...`} />
      )}

      {/* Empty Period State + Historical Fallback */}
      {!isLoadingMeasurements &&
        !measurementsError &&
        measurementsData &&
        measurementsData.measurements.length === 0 && (
          <Card padding="lg" variant="default">
            <EmptyState
              icon={<History size={24} />}
              title={`No verified ${measurementsData.parameter_display_name} observations in selected window`}
              description={
                isHistoricalInactive && lastReportedUtc
                  ? 'No observations recorded for this station and parameter in the selected period. Sensor transmission ceased over 30 days ago; historical archive observations remain available without interpolation.'
                  : 'No observations recorded for this station and parameter in the selected period. EcoSentinel never generates or interpolates missing telemetry.'
              }
              actions={
                isHistoricalInactive && lastReportedUtc ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<History size={14} />}
                    onClick={() => handleLoadHistorical(lastReportedUtc)}
                  >
                    {`View Historical Observations (7-Day Period Ending ${lastReportedUtc.split('T')[0]})`}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleTimeRangeChange('7d')}>
                    Expand Window to 7 Days
                  </Button>
                )
              }
            />
          </Card>
        )}

      {/* Time-Series Chart */}
      {!isLoadingMeasurements &&
        !measurementsError &&
        measurementsData &&
        measurementsData.measurements.length > 0 && (
          <AirQualityChart
            measurements={measurementsData.measurements}
            units={measurementsData.units}
            parameterDisplayName={measurementsData.parameter_display_name}
            stationName={measurementsData.station_name}
            cpcbLimit={matchedAssessment?.standard_threshold}
            whoGuideline={matchedAssessment?.secondary_benchmark_threshold}
            parameterCode={measurementsData.parameter}
          />
        )}

      {/* Governed Statutory CPCB & WHO Evaluation */}
      {!measurementsError && locationDetail && (
        <RiskAssessmentCard
          assessment={matchedAssessment}
          isLoading={isLoadingAssessment}
          error={assessmentError}
        />
      )}

      {/* Paginated Observation Evidence Table */}
      {!isLoadingMeasurements && !measurementsError && measurementsData && (
        <Card padding="md" variant="default">
          <div style={{ marginBottom: 'var(--eco-space-3)' }}>
            <h3 style={{ fontFamily: 'var(--eco-font-display)', fontSize: 'var(--eco-text-base)' }}>
              Verified Hourly Observation Log
            </h3>
            <p style={{ fontSize: 'var(--eco-text-xs)', color: 'var(--eco-text-muted)', marginTop: '2px' }}>
              {measurementsData.data_integrity_notice}
            </p>
          </div>
          <MeasurementTable
            measurements={measurementsData.measurements}
            parameterDisplayName={measurementsData.parameter_display_name}
            units={measurementsData.units}
          />
        </Card>
      )}
    </section>
  );
};
