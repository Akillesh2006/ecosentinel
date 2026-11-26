import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  LocationDetail,
  LocationSummary,
  SpatialNeighborsResponse,
  SpatialComparisonResponse,
  AirQualityApiError,
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
import { NeighborhoodScreeningRibbon } from './NeighborhoodScreeningRibbon';
import { NeighborhoodScreeningEvidenceCard } from './NeighborhoodScreeningEvidenceCard';
import { SpatialPlainSummary } from './spatial/SpatialPlainSummary';
import { SpatialControlsCard, SPATIAL_PARAMETERS, type WindowPreset } from './spatial/SpatialControlsCard';
import { NeighborDiscoveryCard } from './spatial/NeighborDiscoveryCard';
import { ApiKeyMissingBanner } from './ApiKeyMissingBanner';
import styles from './spatial/Spatial.module.css';

export interface SpatialSectionProps {
  selectedLocation?: LocationDetail | null;
  onSelectLocation?: (location: LocationDetail) => void;
  activeParameter?: string;
}

export const SpatialSection: React.FC<SpatialSectionProps> = ({
  selectedLocation,
  onSelectLocation,
  activeParameter,
}) => {
  const [referenceStationId, setReferenceStationId] = useState<number>(selectedLocation?.id || 3060);
  const [referenceStationName, setReferenceStationName] = useState<string>(
    selectedLocation?.name || 'Punjabi Bagh, Delhi - DPCC'
  );
  const [availableStations, setAvailableStations] = useState<LocationSummary[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState<boolean>(false);

  const [parameter, setParameter] = useState<string>(activeParameter || 'pm25');
  const [radiusKm, setRadiusKm] = useState<number>(25.0);
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('24h');

  const [neighborsData, setNeighborsData] = useState<SpatialNeighborsResponse | null>(null);
  const [selectedNeighborIds, setSelectedNeighborIds] = useState<number[]>([]);
  const [isLoadingNeighbors, setIsLoadingNeighbors] = useState<boolean>(false);
  const [neighborError, setNeighborError] = useState<AirQualityApiError | null>(null);

  const [comparisonData, setComparisonData] = useState<SpatialComparisonResponse | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState<boolean>(false);
  const [comparisonError, setComparisonError] = useState<AirQualityApiError | null>(null);
  const [selectedScreeningHour, setSelectedScreeningHour] = useState<string | null>(null);

  useEffect(() => {
    if (comparisonData?.time_slices && comparisonData.time_slices.length > 0) {
      const reversed = [...comparisonData.time_slices].reverse();
      const latestEvaluable = reversed.find(
        (s) => s.screening && s.screening.classification !== 'INSUFFICIENT_SPATIAL_EVIDENCE'
      );
      const target = latestEvaluable || comparisonData.time_slices[comparisonData.time_slices.length - 1];
      setSelectedScreeningHour(target.datetime_utc);
    } else {
      setSelectedScreeningHour(null);
    }
  }, [comparisonData]);

  const selectedSlice = useMemo(() => {
    if (!comparisonData?.time_slices || !selectedScreeningHour) return null;
    return (
      comparisonData.time_slices.find((s) => s.datetime_utc === selectedScreeningHour) ||
      comparisonData.time_slices[comparisonData.time_slices.length - 1] ||
      null
    );
  }, [comparisonData, selectedScreeningHour]);

  const neighborReqIdRef = useRef<number>(0);
  const compareReqIdRef = useRef<number>(0);

  useEffect(() => {
    if (selectedLocation && selectedLocation.id !== referenceStationId) {
      setReferenceStationId(selectedLocation.id);
      setReferenceStationName(selectedLocation.name);
      setSelectedNeighborIds((prev) => prev.filter((id) => id !== selectedLocation.id));
      setComparisonData(null);
    }
  }, [selectedLocation, referenceStationId]);

  useEffect(() => {
    if (activeParameter && activeParameter !== parameter) {
      setParameter(activeParameter);
      setSelectedNeighborIds([]);
      setComparisonData(null);
    }
  }, [activeParameter, parameter]);

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

  useEffect(() => {
    if (availableStations.length > 0) {
      const found = availableStations.find((s) => s.id === referenceStationId);
      if (found) {
        setReferenceStationName(found.name);
      }
    }
  }, [referenceStationId, availableStations]);

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
        window_preset: windowPreset,
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

  useEffect(() => {
    if (selectedNeighborIds.length > 0) {
      return executeComparison();
    } else {
      setComparisonData(null);
    }
  }, [executeComparison, selectedNeighborIds.length]);

  const handleReferenceChange = (newId: number) => {
    setReferenceStationId(newId);
    setSelectedNeighborIds((prev) => prev.filter((id) => id !== newId));
    setComparisonData(null);
    const found = availableStations.find((s) => s.id === newId);
    if (found) setReferenceStationName(found.name);
    if (onSelectLocation) {
      fetchLocationDetail(newId).then((res) => {
        if (res.data) onSelectLocation(res.data);
      });
    }
  };

  const handleParameterChange = (newParam: string) => {
    setParameter(newParam);
    setSelectedNeighborIds([]);
    setComparisonData(null);
  };

  const handleWindowPresetChange = (preset: WindowPreset) => {
    setWindowPreset(preset);
    setComparisonData(null);
  };

  const handleToggleNeighbor = (neighborId: number) => {
    setSelectedNeighborIds((prev) => {
      if (prev.includes(neighborId)) return prev.filter((id) => id !== neighborId);
      if (prev.length >= 4) return prev;
      return [...prev, neighborId];
    });
  };

  const paramDisplayName =
    SPATIAL_PARAMETERS.find((p) => p.id === parameter)?.label || parameter.toUpperCase();

  return (
    <section className="section-container spatial-section eco-stagger" aria-label="Multi-Station Spatial Analysis">
      <div className={`section-header-banner ${styles.headerBanner}`}>
        <div className="section-title-wrap">
          <div className="section-kicker">
            <span className={`badge badge-normal ${styles.badgeSmall}`}>Spatial Comparison</span>
          </div>
          <h2 className={`section-title ${styles.sectionTitle}`}>
            Multi-Station Spatial Comparison &amp; Network Synchronization
          </h2>
          <p className={`section-subtitle ${styles.sectionSubtitle}`}>
            Evaluate co-located and neighboring ambient air quality monitoring stations within a geographic radius.
            Compare synchronized hourly observation series, identify network gaps, evaluate pairwise correlation,
            and inspect neighborhood distribution metrics against rigorous empirical baselines.
          </p>
        </div>
      </div>

      <SpatialControlsCard
        referenceStationId={referenceStationId}
        referenceStationName={referenceStationName}
        availableStations={availableStations}
        isLoadingStations={isLoadingStations}
        parameter={parameter}
        radiusKm={radiusKm}
        windowPreset={windowPreset}
        onReferenceChange={handleReferenceChange}
        onParameterChange={handleParameterChange}
        onRadiusChange={setRadiusKm}
        onWindowPresetChange={handleWindowPresetChange}
      />

      <NeighborDiscoveryCard
        radiusKm={radiusKm}
        paramDisplayName={paramDisplayName}
        neighborsData={neighborsData}
        selectedNeighborIds={selectedNeighborIds}
        isLoadingNeighbors={isLoadingNeighbors}
        neighborError={neighborError}
        onRefresh={discoverNeighbors}
        onToggleNeighbor={handleToggleNeighbor}
      />

      {isLoadingComparison && (
        <div className={`card ${styles.loadingCard}`}>
          <div className={styles.loadingTitle}>Synchronizing Multi-Station Observation Series...</div>
          <div className={styles.loadingSubtitle}>
            Aligning hourly timestamps, validating sensor units, calculating pairwise Pearson correlation, and computing neighborhood medians.
          </div>
        </div>
      )}

      {comparisonError && !isLoadingComparison && (
        comparisonError.error_code === 'MISSING_API_KEY' || comparisonError.status === 503 ? (
          <ApiKeyMissingBanner onRetry={executeComparison} />
        ) : (
          <div className={`card card-error ${styles.errorBoxLg}`} role="alert">
            <div className={styles.errorTitle}>Spatial Comparison Error</div>
            <div>{comparisonError.message}</div>
            <button type="button" onClick={executeComparison} className={styles.retryBtn}>
              Retry Comparison
            </button>
          </div>
        )
      )}

      {selectedNeighborIds.length === 0 && !isLoadingNeighbors && (
        <div className={`card ${styles.emptyCard}`}>
          <div className={styles.emptyTitle}>Select Neighbors to Begin Comparison</div>
          <div className={styles.emptyBody}>
            Choose 1 to 4 neighboring stations from the discovery panel above to compare synchronized observation streams against the reference anchor.
          </div>
        </div>
      )}

      {comparisonData && !isLoadingComparison && (
        <>
          <SpatialPlainSummary comparisonData={comparisonData} />

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

          <div className={styles.blockSpacing}>
            <SpatialComparisonMap
              stations={comparisonData.stations}
              radiusKm={radiusKm}
              parameterDisplayName={comparisonData.parameter_display_name}
              units={comparisonData.units}
            />
          </div>

          <NeighborhoodScreeningRibbon
            timeSlices={comparisonData.time_slices}
            summary={comparisonData.neighborhood_screening_summary}
            selectedHour={selectedScreeningHour}
            onSelectHour={setSelectedScreeningHour}
            parameterDisplayName={comparisonData.parameter_display_name}
            units={comparisonData.units}
          />

          <NeighborhoodScreeningEvidenceCard
            slice={selectedSlice}
            referenceStationName={referenceStationName}
            referenceStationId={comparisonData.reference_station_id}
            parameterDisplayName={comparisonData.parameter_display_name}
            units={comparisonData.units}
            stations={comparisonData.stations}
            summary={comparisonData.neighborhood_screening_summary}
          />

          <div className={`card spatial-chart-card ${styles.chartCard}`}>
            <div className={`card-header ${styles.chartHeader}`}>
              <div>
                <span className="card-badge">Synchronized Observation Series</span>
                <h3 className={styles.chartTitle}>
                  Hourly Multi-Station Concentration Comparison ({comparisonData.parameter_display_name})
                </h3>
                <p className={styles.chartSubtitle}>
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

          <div className={styles.blockSpacing}>
            <SpatialEvidenceTable
              stations={comparisonData.stations}
              parameterDisplayName={comparisonData.parameter_display_name}
              units={comparisonData.units}
              allStationsCoincidentHours={comparisonData.all_stations_coincident_hours}
              allStationsCoincidentCoveragePercentage={comparisonData.all_stations_coincident_coverage_percentage}
              expectedObservations={comparisonData.stations[0]?.expected_observations}
            />
          </div>

          <div className={`card spatial-disclaimer-card ${styles.disclaimerCard}`}>
            <div className={styles.disclaimerTitle}>Scientific Interpretation Safeguard</div>
            <div>{comparisonData.spatial_disclaimer}</div>
          </div>
        </>
      )}
    </section>
  );
};
