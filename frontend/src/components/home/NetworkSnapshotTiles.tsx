import React from 'react';
import { Clock, Gauge, MapPin, ShieldCheck } from 'lucide-react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../../types';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { GlossaryTerm } from '../ui/Tooltip';
import styles from './Home.module.css';

export interface NetworkSnapshotTilesProps {
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
}

function getCompletenessSummary(
  measurements: LocationMeasurementsResponse | null | undefined,
  assessment: RiskAssessmentResponse | null | undefined
) {
  if (!measurements && !assessment) return null;

  const paramLower = (measurements?.parameter || assessment?.parameter || '').toLowerCase();
  const isCoOrO3 = paramLower === 'co' || paramLower === 'o3';

  if (assessment) {
    const valid = assessment.valid_observations ?? measurements?.total_observations ?? 0;
    const expected = assessment.expected_observations ?? measurements?.expected_observations ?? 0;
    const missing = Math.max(0, expected - valid);
    const pct = assessment.completeness_percentage;
    const passed = assessment.status !== 'insufficient_data' && pct >= 75;
    const reqText = isCoOrO3 ? '6/8h required' : `${Math.ceil(expected * 0.75)}/${expected}h required`;
    return {
      pctText: `${pct.toFixed(1)}%`,
      pctNum: Math.min(100, Math.max(0, pct)),
      passed,
      detailText: `valid ${valid}/${expected} h · missing ${missing} · ${reqText}`,
      gateText: `gate ${valid}/${expected} → ${passed ? 'Passed (≥75%)' : 'Incomplete (<75%)'}`,
    };
  }

  if (!measurements) return null;
  const valid = measurements.total_observations ?? 0;
  const expected = measurements.expected_observations ?? 0;
  const missing = Math.max(0, expected - valid);
  const missingPct = measurements.missing_percentage ?? 100;
  const pct = expected > 0 ? Math.min(100, Math.max(0, 100 - missingPct)) : 0;
  const passed = pct >= 75;
  const reqText = isCoOrO3 ? '6/8h required' : `${Math.ceil(expected * 0.75)}/${expected}h required`;

  return {
    pctText: `${pct.toFixed(1)}%`,
    pctNum: pct,
    passed,
    detailText: `valid ${valid}/${expected} h · missing ${missing} · ${reqText}`,
    gateText: `gate ${valid}/${expected} → ${passed ? 'Passed (≥75%)' : 'Incomplete (<75%)'}`,
  };
}

function formatAveragingHeader(param?: string | null): string {
  const lower = (param || '').toLowerCase();
  if (lower === 'o3' || lower === 'co') {
    return '8-hour Telemetry';
  }
  return '24-hour Telemetry';
}

function buildStandardComparisonLabel(
  assessment: RiskAssessmentResponse | null | undefined,
  param?: string | null
): string {
  const lower = (param || '').toLowerCase();
  if (!assessment) {
    return lower === 'co'
      ? 'CPCB 8-hour (2 mg/m³) · Standard unavailable (WHO)'
      : 'Awaiting governed risk evaluation';
  }

  const period = assessment.averaging_period_label || (lower === 'co' || lower === 'o3' ? '8-hour' : '24-hour');
  const cpcbUnit = assessment.standard_unit || assessment.units;
  const cpcbPart =
    assessment.standard_threshold !== null && assessment.standard_threshold !== undefined
      ? `CPCB ${period} (${assessment.standard_threshold} ${cpcbUnit})`
      : 'CPCB Standard unavailable';

  if (
    lower === 'co' ||
    assessment.secondary_benchmark_threshold === null ||
    assessment.secondary_benchmark_threshold === undefined
  ) {
    return cpcbPart;
  }

  const whoUnit = assessment.secondary_benchmark_unit || assessment.units;
  const whoPeriod = lower === 'o3' ? '8-hour' : '24-hour';
  return `${cpcbPart} · WHO ${whoPeriod} (${assessment.secondary_benchmark_threshold} ${whoUnit})`;
}

/**
 * Snapshot telemetry cards bound strictly to verified backend payloads.
 * Unloaded states show explicit '—' placeholders; incomplete windows show 'Unavailable'
 * and never synthesize client-side averages.
 */
export const NetworkSnapshotTiles: React.FC<NetworkSnapshotTilesProps> = ({
  selectedLocation,
  measurementsData,
  assessmentData,
}) => {
  const activeParam = measurementsData?.parameter || assessmentData?.parameter;
  const assessmentMatches =
    Boolean(assessmentData) &&
    (!activeParam || assessmentData?.parameter?.toLowerCase() === activeParam.toLowerCase());

  const safeAssessment = assessmentMatches ? assessmentData : null;
  const governedMean = safeAssessment?.calculated_average;
  const hasGovernedMean = governedMean !== null && governedMean !== undefined;

  const completeness = getCompletenessSummary(measurementsData, safeAssessment);

  const freshnessState = safeAssessment?.freshness_state;
  const sensorLastLocal =
    measurementsData?.sensor_datetime_last_local ||
    safeAssessment?.sensor_datetime_last_local ||
    selectedLocation?.datetime_last_local;

  const isStale = Boolean(
    measurementsData?.is_stale || freshnessState === 'stale' || safeAssessment?.status === 'stale_data'
  );
  const isHistorical =
    freshnessState === 'historical' || safeAssessment?.status === 'historical_data';

  let freshnessLabel = '—';
  let freshnessTone: 'normal' | 'elevated' | 'historical' | 'muted' = 'muted';
  if (selectedLocation || measurementsData || safeAssessment) {
    if (isHistorical) {
      freshnessLabel = 'Historical Archive';
      freshnessTone = 'historical';
    } else if (isStale) {
      freshnessLabel = 'Stale (>24h)';
      freshnessTone = 'elevated';
    } else {
      freshnessLabel = 'Active / Recent';
      freshnessTone = 'normal';
    }
  }

  return (
    <Card padding="md" variant="default">
      <CardHeader>
        <div>
          <CardTitle>
            {selectedLocation ? `Active Station: ${selectedLocation.name}` : 'Selected Station Snapshot'}
          </CardTitle>
          <CardDescription>
            Verified OpenAQ v3 telemetry &amp; backend-governed compliance summary.
          </CardDescription>
        </div>
        <Badge tone={selectedLocation ? 'normal' : 'muted'}>
          {selectedLocation ? 'Station Loaded' : 'Awaiting Selection'}
        </Badge>
      </CardHeader>

      <div className={styles.snapshotGrid}>
        {/* Tile 1: Active Station */}
        <div className={styles.kpiTile}>
          <div className={styles.kpiLabelRow}>
            <span className={styles.kpiLabel}>
              <MapPin size={13} aria-hidden="true" />
              Inspected Station
            </span>
            {selectedLocation && <Badge tone="info">#{selectedLocation.id}</Badge>}
          </div>
          <div className={styles.kpiTextValue}>
            {selectedLocation ? selectedLocation.name : '—'}
          </div>
          <div className={styles.kpiSub}>
            {selectedLocation ? (
              <>
                <span>
                  {selectedLocation.locality || 'India'} · {selectedLocation.provider_name}
                </span>
                {selectedLocation.coordinates && (
                  <div className="eco-mono" style={{ marginTop: '3px', fontSize: '11px' }}>
                    {selectedLocation.coordinates.latitude.toFixed(4)}°N,{' '}
                    {selectedLocation.coordinates.longitude.toFixed(4)}°E
                  </div>
                )}
              </>
            ) : (
              'Search or open Stations to inspect live physical telemetry'
            )}
          </div>
        </div>

        {/* Tile 2: Backend-Governed Average */}
        <div className={styles.kpiTile}>
          <div className={styles.kpiLabelRow}>
            <span className={styles.kpiLabel}>
              <Gauge size={13} aria-hidden="true" />
              {measurementsData ? formatAveragingHeader(activeParam) : 'Governed Mean'}
            </span>
            {safeAssessment && (
              <Badge
                tone={
                  hasGovernedMean
                    ? safeAssessment.status === 'above_reference'
                      ? 'anomaly'
                      : 'normal'
                    : 'elevated'
                }
              >
                {hasGovernedMean
                  ? safeAssessment.status === 'above_reference'
                    ? safeAssessment.status_label || 'Above Reference'
                    : safeAssessment.status_label || 'Governed'
                  : 'Incomplete (<75%)'}
              </Badge>
            )}
          </div>
          <div className={styles.kpiValue}>
            {measurementsData
              ? hasGovernedMean
                ? `${governedMean.toFixed(1)} ${safeAssessment?.units || measurementsData.units}`
                : 'Unavailable'
              : '—'}
          </div>
          <div className={styles.kpiSub}>
            {measurementsData
              ? buildStandardComparisonLabel(safeAssessment, activeParam)
              : 'Requires ≥75% completeness before publishing regulatory averages'}
          </div>
        </div>

        {/* Tile 3: Completeness Gate */}
        <div className={styles.kpiTile}>
          <div className={styles.kpiLabelRow}>
            <span className={styles.kpiLabel}>
              <ShieldCheck size={13} aria-hidden="true" />
              <GlossaryTerm termKey="completenessGate">Completeness Gate</GlossaryTerm>
            </span>
            {completeness && (
              <Badge tone={completeness.passed ? 'normal' : 'elevated'}>
                {completeness.passed ? `✓ Satisfied (${completeness.pctText})` : 'Gated'}
              </Badge>
            )}
          </div>
          <div className={styles.kpiValue}>
            {completeness ? completeness.pctText : '—'}
          </div>
          {completeness && (
            <div className={styles.gateTrack} aria-hidden="true">
              <div
                className={styles.gateFill}
                style={{
                  width: `${completeness.pctNum}%`,
                  background: completeness.passed
                    ? 'var(--eco-status-normal)'
                    : 'var(--eco-status-elevated)',
                }}
              />
            </div>
          )}
          <div className={styles.kpiSub}>
            {completeness
              ? `${measurementsData ? `${measurementsData.total_observations} points · ` : ''}${completeness.detailText} · ${completeness.gateText}`
              : '75% valid hourly capture rule enforced server-side'}
          </div>
        </div>

        {/* Tile 4: Sensor Freshness */}
        <div className={styles.kpiTile}>
          <div className={styles.kpiLabelRow}>
            <span className={styles.kpiLabel}>
              <Clock size={13} aria-hidden="true" />
              <GlossaryTerm termKey="freshness">Sensor Freshness</GlossaryTerm>
            </span>
            <Badge tone={freshnessTone} dot>
              {freshnessLabel === '—' ? 'Idle' : freshnessLabel}
            </Badge>
          </div>
          <div className={styles.kpiTextValue}>
            {freshnessLabel}
          </div>
          <div className={styles.kpiSub}>
            {sensorLastLocal
              ? `Sensor updated: ${sensorLastLocal}`
              : 'Sensor-level reporting recency checked on station load'}
          </div>
        </div>
      </div>
    </Card>
  );
};
