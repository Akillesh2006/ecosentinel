import React from 'react';
import { CalendarClock, MapPin, Radio, RefreshCw } from 'lucide-react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
  TimeRangePreset,
} from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { VerdictBanner } from '../ui/VerdictBanner';
import { GlossaryTerm } from '../ui/Tooltip';
import { deriveAssessmentVerdict, type PlainVerdict } from '../../utils/verdict';
import styles from './Stations.module.css';

export interface StationHeroCardProps {
  locationDetail: LocationDetail;
  activeParameter: string;
  onSelectParameter: (param: string) => void;
  timeRange: TimeRangePreset;
  onSelectTimeRange: (preset: TimeRangePreset) => void;
  customRangeLabel?: string | null;
  onClearCustomRange?: () => void;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  isLoadingMeasurements?: boolean;
  onRefresh?: () => void;
}

function formatParamLabel(param: string): string {
  const lower = param.toLowerCase();
  if (lower === 'pm25' || lower === 'pm2.5') return 'PM2.5';
  if (lower === 'pm10') return 'PM10';
  if (lower === 'no2') return 'NO₂';
  if (lower === 'so2') return 'SO₂';
  if (lower === 'o3') return 'O₃';
  if (lower === 'co') return 'CO';
  return param.toUpperCase();
}

const TIME_WINDOWS: { id: TimeRangePreset; label: string }[] = [
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
];

/**
 * Unified station summary header showing plain-language air quality verdict,
 * monitor metadata, pollutant switcher pills, and time window controls.
 */
export const StationHeroCard: React.FC<StationHeroCardProps> = ({
  locationDetail,
  activeParameter,
  onSelectParameter,
  timeRange,
  onSelectTimeRange,
  customRangeLabel,
  onClearCustomRange,
  measurementsData,
  assessmentData,
  isLoadingMeasurements = false,
  onRefresh,
}) => {
  const availParams = locationDetail.available_parameters || [];
  const matchingAssessment =
    assessmentData && assessmentData.parameter?.toLowerCase() === activeParameter.toLowerCase()
      ? assessmentData
      : null;

  const selectedSensor = locationDetail.sensors?.find(
    (s) => s.parameter_name?.toLowerCase() === activeParameter.toLowerCase()
  );
  const lastReportedUtc =
    measurementsData?.sensor_datetime_last_utc ||
    selectedSensor?.datetime_last_utc ||
    locationDetail.datetime_last_utc;
  const refNowMs = measurementsData?.retrieved_at_utc
    ? new Date(measurementsData.retrieved_at_utc).getTime()
    : undefined;
  const lastReportedMs = lastReportedUtc ? new Date(lastReportedUtc).getTime() : NaN;
  const isSensorStale = Boolean(
    locationDetail.is_stale ||
      measurementsData?.is_stale ||
      (refNowMs !== undefined && Number.isFinite(lastReportedMs) && refNowMs - lastReportedMs > 24 * 3600 * 1000)
  );

  const fallbackVerdict: PlainVerdict = isLoadingMeasurements
    ? {
        tone: 'muted',
        chipLabel: 'Loading Telemetry',
        headline: `Checking ${formatParamLabel(activeParameter)} readings at ${locationDetail.name}...`,
      }
    : {
        tone: measurementsData?.is_stale ? 'elevated' : 'muted',
        chipLabel: measurementsData?.is_stale ? 'Stale Sensor (>24h)' : 'Telemetry Loaded',
        headline: measurementsData
          ? `Showing ${measurementsData.total_observations} of ${measurementsData.expected_observations} verified ${formatParamLabel(activeParameter)} hours.`
          : 'Select a pollutant and time window to inspect telemetry.',
      };

  const verdict = deriveAssessmentVerdict(matchingAssessment) ?? fallbackVerdict;

  const governedMean = matchingAssessment?.calculated_average;
  const hasGovernedMean = governedMean !== null && governedMean !== undefined;

  const validCount = measurementsData?.total_observations ?? 0;
  const expectedCount = measurementsData?.expected_observations ?? 0;
  const missingPct = measurementsData?.missing_percentage ?? 100;
  const completenessPct =
    expectedCount > 0 && measurementsData
      ? Math.max(0, Math.min(100, 100 - missingPct))
      : null;

  const latStr = locationDetail.coordinates
    ? `${locationDetail.coordinates.latitude.toFixed(4)}°N, ${locationDetail.coordinates.longitude.toFixed(4)}°E`
    : 'Coordinates unavailable';

  return (
    <Card padding="lg" variant="elevated">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--eco-space-4)' }}>
        <div className={styles.stationHeroHeader}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--eco-space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--eco-space-2)', flexWrap: 'wrap' }}>
              <Badge tone={locationDetail.is_monitor ? 'info' : 'elevated'}>
                {locationDetail.is_monitor ? 'Reference Monitor' : 'Low-Cost Sensor'}
              </Badge>
              <Badge tone="muted">Station #{locationDetail.id}</Badge>
              {isSensorStale && (
                <Badge tone="elevated" dot>
                  Stale Observations (&gt;24h)
                </Badge>
              )}
            </div>

            <h3 className={styles.stationHeroTitle}>{locationDetail.name}</h3>

            <div className={styles.stationMetaStrip}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} aria-hidden="true" />
                {locationDetail.locality || 'Unknown City'}, {locationDetail.country_name || 'India'} · Provider:{' '}
                {locationDetail.provider_name}
              </span>
              <span className="eco-mono">{latStr}</span>
            </div>
          </div>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={onRefresh}
              isLoading={isLoadingMeasurements}
            >
              Refresh Data
            </Button>
          )}
        </div>

        <VerdictBanner verdict={verdict} />

        {/* Summary KPI Strip */}
        <div className={styles.heroStatsRow}>
          <div className={styles.miniKpi}>
            <span className={styles.miniKpiLabel}>
              {matchingAssessment?.averaging_period_label || 'Governed Mean'}
            </span>
            <span className={styles.miniKpiValue}>
              {measurementsData
                ? hasGovernedMean
                  ? `${governedMean.toFixed(1)} ${matchingAssessment?.units || measurementsData.units}`
                  : 'Unavailable'
                : '—'}
            </span>
            <span className={styles.miniKpiSub}>
              {matchingAssessment?.status_label || 'Subject to 75% completeness gate'}
            </span>
          </div>

          <div className={styles.miniKpi}>
            <span className={styles.miniKpiLabel}>
              <GlossaryTerm termKey="completenessGate">Data Completeness</GlossaryTerm>
            </span>
            <span className={styles.miniKpiValue}>
              {completenessPct !== null ? `${completenessPct.toFixed(1)}%` : '—'}
            </span>
            <span className={styles.miniKpiSub}>
              {measurementsData
                ? `${validCount} of ${expectedCount} expected hours`
                : 'Awaiting measurements'}
            </span>
          </div>

          <div className={styles.miniKpi}>
            <span className={styles.miniKpiLabel}>Query Timestamp (Retrieved)</span>
            <span className={styles.miniKpiValue} style={{ fontSize: 'var(--eco-text-sm)' }}>
              {measurementsData?.retrieved_at_utc
                ? measurementsData.retrieved_at_utc.replace('T', ' ').replace(/(\.\d+)?Z$/, ' UTC')
                : '—'}
            </span>
            <span className={styles.miniKpiSub}>OpenAQ v3 query timestamp</span>
          </div>

          <div className={styles.miniKpi}>
            <span className={styles.miniKpiLabel}>
              <GlossaryTerm termKey="freshness">Latest Measurement Time</GlossaryTerm>
            </span>
            <span className={styles.miniKpiValue} style={{ fontSize: 'var(--eco-text-sm)' }}>
              {measurementsData?.sensor_datetime_last_local || locationDetail.datetime_last_local || '—'}
            </span>
            <span className={styles.miniKpiSub}>Physical channel clock (IST)</span>
          </div>
        </div>

        {/* Pollutant Switcher & Window Controls */}
        <div className={styles.controlsToolbar}>
          <div className={styles.pollutantPills} role="group" aria-label="Select pollutant sensor">
            <span
              className={styles.fieldLabel}
              style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Radio size={12} aria-hidden="true" />
              Pollutant:
            </span>
            {availParams.map((param) => {
              const isSelected = param.toLowerCase() === activeParameter.toLowerCase();
              return (
                <button
                  key={param}
                  type="button"
                  aria-pressed={isSelected}
                  className={`${styles.pollutantBtn} ${isSelected ? styles.pollutantBtnActive : ''}`.trim()}
                  onClick={() => onSelectParameter(param)}
                >
                  {formatParamLabel(param)}
                </button>
              );
            })}
          </div>

          <div className={styles.windowRow} role="group" aria-label="Observation time window">
            <CalendarClock size={14} style={{ color: 'var(--eco-text-muted)' }} aria-hidden="true" />
            {TIME_WINDOWS.map((win) => {
              const isSelected = !customRangeLabel && timeRange === win.id;
              return (
                <Button
                  key={win.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? 'primary' : 'outline'}
                  aria-pressed={isSelected}
                  onClick={() => onSelectTimeRange(win.id)}
                >
                  {win.label}
                </Button>
              );
            })}
            {customRangeLabel && (
              <Badge tone="historical">
                {customRangeLabel}
                {onClearCustomRange && (
                  <button
                    type="button"
                    onClick={onClearCustomRange}
                    style={{
                      marginLeft: '6px',
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    aria-label="Return to live time window"
                  >
                    ×
                  </button>
                )}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
