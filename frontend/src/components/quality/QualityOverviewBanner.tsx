import React from 'react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../../types';
import type { PlainVerdict } from '../../utils/verdict';
import { VerdictBanner } from '../ui/VerdictBanner';
import { Badge } from '../ui/Badge';
import { Disclosure } from '../ui/Disclosure';
import { GlossaryTerm } from '../ui/Tooltip';
import styles from './Quality.module.css';

export interface QualityOverviewBannerProps {
  locationDetail?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
}

function buildQualityVerdict(
  measurements: LocationMeasurementsResponse | null | undefined,
  assessment: RiskAssessmentResponse | null | undefined
): PlainVerdict {
  if (!measurements && !assessment) {
    return {
      tone: 'muted',
      chipLabel: 'No Active Dataset',
      headline: 'Select and inspect a station in Stations to audit its telemetry quality',
      subline: 'Data completeness, sensor freshness, and excluded negative values appear here automatically.',
    };
  }

  const expected = assessment?.expected_observations ?? measurements?.expected_observations ?? 0;
  const valid = assessment?.valid_observations ?? measurements?.total_observations ?? 0;
  const pct =
    assessment?.completeness_percentage ??
    (expected > 0 && measurements ? Math.max(0, 100 - (measurements.missing_percentage ?? 100)) : 0);
  const passed = pct >= 75 && assessment?.status !== 'insufficient_data';

  const isHistorical = assessment?.status === 'historical_data' || assessment?.freshness_state === 'historical';
  const isStale = measurements?.is_stale || assessment?.status === 'stale_data' || assessment?.freshness_state === 'stale';

  if (isHistorical) {
    return {
      tone: 'historical',
      chipLabel: 'Historical Archive Quality',
      headline: `Dataset covers archival window (${valid} of ${expected} hours · ${pct.toFixed(1)}%)`,
      subline: 'Observations ceased >30 days ago; historical audit records preserved without live alerts.',
    };
  }

  if (!passed) {
    return {
      tone: 'elevated',
      chipLabel: 'Completeness Gate Gated (<75%)',
      headline: `Below 75% capture requirement (${valid} of ${expected} hours · ${pct.toFixed(1)}%)`,
      subline: 'Regulatory averages remain withheld because missing intervals are never imputed or zero-filled.',
    };
  }

  if (isStale) {
    return {
      tone: 'elevated',
      chipLabel: 'Passed Capture · Stale Clock (>24h)',
      headline: `Window has ${valid} of ${expected} valid hours (${pct.toFixed(1)}%), but sensor is >24h old`,
      subline: 'Completeness criterion passed for the captured window, though real-time telemetry is delayed.',
    };
  }

  return {
    tone: 'normal',
    chipLabel: 'Audit Verified (≥75% Gate Passed)',
    headline: `High-confidence stream with ${valid} of ${expected} valid hours (${pct.toFixed(1)}%)`,
    subline: 'Telemetry meets CPCB minimum data-capture thresholds with transparent sensor provenance.',
  };
}

/**
 * Plain-language Data Quality summary banner, SVG radial completeness gauge,
 * freshness/exclusion cards, and collapsible methodology explanation.
 */
export const QualityOverviewBanner: React.FC<QualityOverviewBannerProps> = ({
  locationDetail,
  measurementsData,
  assessmentData,
}) => {
  const verdict = buildQualityVerdict(measurementsData, assessmentData);

  const param = (measurementsData?.parameter || assessmentData?.parameter || '').toLowerCase();
  const isShortWindow = param === 'co' || param === 'o3';

  const expected = assessmentData?.expected_observations ?? measurementsData?.expected_observations ?? 0;
  const valid = assessmentData?.valid_observations ?? measurementsData?.total_observations ?? 0;
  const pct =
    assessmentData?.completeness_percentage ??
    (expected > 0 && measurementsData
      ? Math.max(0, Math.min(100, 100 - (measurementsData.missing_percentage ?? 100)))
      : 0);

  const passed = (measurementsData || assessmentData) ? pct >= 75 : false;
  const requiredHours = isShortWindow ? 6 : Math.ceil(expected * 0.75);
  const excludedCount =
    measurementsData?.excluded_observations ?? assessmentData?.excluded_observations ?? 0;

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const strokeOffset = circumference * (1 - clampedPct / 100);

  const strokeColor = !measurementsData && !assessmentData
    ? 'var(--eco-status-muted)'
    : passed
      ? 'var(--eco-status-normal)'
      : 'var(--eco-status-elevated)';

  return (
    <div className={styles.wrap}>
      <VerdictBanner verdict={verdict} />

      <div className={styles.gaugeGrid}>
        {/* Radial Gate Gauge */}
        <div className={styles.radialCard}>
          <div className={styles.ringWrap}>
            <svg viewBox="0 0 112 112" className={styles.ringSvg} aria-hidden="true">
              <circle
                cx="56"
                cy="56"
                r={radius}
                fill="none"
                stroke="var(--eco-border-subtle)"
                strokeWidth="9"
              />
              <circle
                cx="56"
                cy="56"
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div className={styles.ringCenter}>
              <span className={styles.ringPct}>
                {measurementsData || assessmentData ? `${clampedPct.toFixed(0)}%` : '—'}
              </span>
              <span className={styles.ringLabel}>Capture</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <Badge tone={!measurementsData && !assessmentData ? 'muted' : passed ? 'normal' : 'elevated'}>
              {!measurementsData && !assessmentData
                ? 'Idle'
                : passed
                  ? '≥75% Gate Satisfied'
                  : '<75% Incomplete'}
            </Badge>
            <span style={{ fontSize: '11px', color: 'var(--eco-text-muted)' }}>
              {expected > 0
                ? `${valid} valid / ${expected} expected (${requiredHours}h required)`
                : '75% valid capture rule (18/24h or 6/8h)'}
            </span>
          </div>
        </div>

        {/* 4 Structured Quality Summary Tiles */}
        <div className={styles.metricsTiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Station &amp; Provider</span>
            <span className={styles.tileValue} style={{ fontSize: 'var(--eco-text-sm)' }}>
              {locationDetail?.name || measurementsData?.station_name || '—'}
            </span>
            <span className={styles.tileSub}>
              {locationDetail?.provider_name || measurementsData?.provider_name || 'No provider loaded'}
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>
              <GlossaryTerm termKey="freshness">Sensor Clock Recency</GlossaryTerm>
            </span>
            <span className={styles.tileValue} style={{ fontSize: 'var(--eco-text-sm)' }}>
              {measurementsData?.sensor_datetime_last_local ||
                assessmentData?.sensor_datetime_last_local ||
                locationDetail?.datetime_last_local ||
                '—'}
            </span>
            <span className={styles.tileSub}>
              {measurementsData?.is_stale
                ? 'Stale (>24h since last reported reading)'
                : measurementsData
                  ? 'Reported within active 24h cycle'
                  : 'Verified per pollutant channel'}
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>Excluded Artifacts</span>
            <span className={styles.tileValue}>
              {measurementsData || assessmentData ? `${excludedCount} pts` : '—'}
            </span>
            <span className={styles.tileSub}>
              Negative or corrupt physical sensor values quarantined prior to scoring.
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>Missing Intervals</span>
            <span className={styles.tileValue}>
              {expected > 0 ? `${Math.max(0, expected - valid)} h` : '—'}
            </span>
            <span className={styles.tileSub}>
              Preserved strictly as blank gaps — never filled with zeros or linear averages.
            </span>
          </div>
        </div>
      </div>

      <Disclosure label="Show audit rules & completeness safeguards">
        <p style={{ margin: 0 }}>
          Every exported CSV and JSON audit package preserves raw UTC and localized IST windows verbatim. When negative concentrations or communication dropouts occur, records are excluded or flagged as missing rather than replaced mathematically.
        </p>
        <div className={styles.glossaryStrip}>
          <GlossaryTerm termKey="completenessGate" />
          <GlossaryTerm termKey="freshness" />
          <GlossaryTerm termKey="cpcbNaaqs" />
        </div>
      </Disclosure>
    </div>
  );
};

