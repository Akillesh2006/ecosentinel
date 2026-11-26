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
import { AnomalyPlainSummary } from './anomalies/AnomalyPlainSummary';
import { AnomalyControlsCard } from './anomalies/AnomalyControlsCard';
import { AnomalyKpiGrid } from './anomalies/AnomalyKpiGrid';
import { AnomalyEventsTable } from './anomalies/AnomalyEventsTable';
import { ApiKeyMissingBanner } from './ApiKeyMissingBanner';
import styles from './anomalies/Anomalies.module.css';

export interface AnomalySectionProps {
  selectedLocation?: LocationDetail | null;
  onSelectLocation?: (location: LocationDetail) => void;
  activeParameter?: string;
}

export const AnomalySection: React.FC<AnomalySectionProps> = ({
  selectedLocation,
  onSelectLocation,
  activeParameter,
}) => {
  const [stationId, setStationId] = useState<number>(selectedLocation?.id || 3060);
  const [stationName, setStationName] = useState<string>(selectedLocation?.name || 'Monitoring Station');
  const [availableStations, setAvailableStations] = useState<LocationSummary[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState<boolean>(false);

  const [parameter, setParameter] = useState<string>(activeParameter || 'pm25');
  const [windowPreset, setWindowPreset] = useState<AnomalyWindowPreset>('24h');
  const [referenceTime, setReferenceTime] = useState<string>('');
  const [sensorPrecisionInput, setSensorPrecisionInput] = useState<string>('');

  const [anomalyData, setAnomalyData] = useState<AirQualityAnomalyResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<AirQualityApiError | null>(null);
  const [selectedObservation, setSelectedObservation] = useState<AnomalyObservationPoint | null>(null);

  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    if (selectedLocation) {
      setStationId(selectedLocation.id);
      setStationName(selectedLocation.name);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (activeParameter) {
      setParameter(activeParameter);
    }
  }, [activeParameter]);

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
    <section className="section-container eco-stagger" aria-label="Pollution Intelligence Anomaly Detection">
      <div className={`section-header ${styles.sectionHeader}`}>
        <h2>Pollution Intelligence &amp; Anomaly Detection</h2>
        <p className="section-subtitle">
          Non-parametric Jackknife leave-one-out statistical screening, rate-of-change surges, and sensor diagnostics.
        </p>
      </div>

      <AnomalyControlsCard
        stationId={stationId}
        stationName={stationName}
        availableStations={availableStations}
        isLoading={isLoading}
        isLoadingStations={isLoadingStations}
        parameter={parameter}
        windowPreset={windowPreset}
        referenceTime={referenceTime}
        sensorPrecisionInput={sensorPrecisionInput}
        onStationSelect={handleStationSelect}
        onParameterChange={setParameter}
        onWindowPresetChange={setWindowPreset}
        onReferenceTimeChange={setReferenceTime}
        onSensorPrecisionChange={setSensorPrecisionInput}
        onRefresh={loadAnomalies}
      />

      {apiError && (apiError.error_code === 'MISSING_API_KEY' || apiError.status === 503) && (
        <ApiKeyMissingBanner onRetry={loadAnomalies} />
      )}

      {apiError && apiError.error_code !== 'MISSING_API_KEY' && apiError.status !== 503 && (
        <div className={`card ${styles.errorCard}`}>
          <div className={styles.errorHeader}>
            <span>⚠️</span>
            <h4>{apiError.error || 'Anomaly Detection Error'}</h4>
          </div>
          <p className={styles.errorMessage}>{apiError.message}</p>
          {apiError.instructions && <p className={styles.errorHint}>{apiError.instructions}</p>}
        </div>
      )}

      {isLoading && !anomalyData && (
        <div className={`card ${styles.loadingCard}`}>
          <div className={styles.loadingTitle}>Screening Telemetry Observations...</div>
          <p className={styles.loadingSubtitle}>
            Executing Jackknife leave-one-out non-parametric baseline calculations and difference dispersion tests.
          </p>
        </div>
      )}

      {anomalyData && (
        <>
          <AnomalyPlainSummary anomalyData={anomalyData} />

          <AnomalyKpiGrid anomalyData={anomalyData} />

          <div className={`card ${styles.chartCard}`}>
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

          <div className={styles.detailGrid}>
            <AnomalyEvidencePanel
              observation={selectedObservation}
              parameterDisplayName={anomalyData.parameter_display_name}
              units={anomalyData.units}
              precisionProvenance={anomalyData.precision_provenance}
              sensorPrecision={anomalyData.sensor_precision}
            />

            <AnomalyEventsTable
              notableEvents={notableEvents}
              units={anomalyData.units}
              selectedObservation={selectedObservation}
              onSelectObservation={setSelectedObservation}
            />
          </div>
        </>
      )}

      <div className={`card ${styles.noticeCard}`}>
        <div className={styles.noticeHeader}>
          <span className={styles.noticeIcon}>ℹ️</span>
          <h4 className={styles.noticeTitle}>Attribution &amp; Limitations Notice</h4>
        </div>
        <p className={styles.noticeBody}>
          Statistical anomaly detection identifies abnormal concentration variance relative to baseline observations.
          It does not establish emission sources, industrial culpability, atmospheric transport mechanisms, or direct health outcomes.
        </p>
      </div>
    </section>
  );
};
