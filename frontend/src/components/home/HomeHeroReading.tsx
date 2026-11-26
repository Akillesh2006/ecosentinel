import React, { useMemo } from 'react';
import { ArrowRight, Radio } from 'lucide-react';
import type {
  HealthState,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../../types';
import { deriveAssessmentVerdict } from '../../utils/verdict';
import { segmentChronologicalSeries } from '../charts/chartUtils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CountUpValue } from '../ui/CountUpValue';
import { Skeleton } from '../ui/Skeleton';
import { HeroStationFinder } from './HeroStationFinder';
import styles from './Home.module.css';

export interface HomeHeroReadingProps {
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  isLoadingMeasurements?: boolean;
  health?: HealthState;
  onExploreStations: () => void;
}

/**
 * Data-first Home hero card featuring a 72px Space Grotesk count-up reading,
 * status-tinted ambient gradient, verdict pill, CPCB multiplier, and 24h area sparkline.
 */
export const HomeHeroReading: React.FC<HomeHeroReadingProps> = ({
  selectedLocation,
  measurementsData,
  assessmentData,
  isLoadingMeasurements = false,
  health,
  onExploreStations,
}) => {
  const safeAssessment = useMemo(() => {
    if (!assessmentData) return null;
    if (
      measurementsData &&
      assessmentData.parameter.toLowerCase() !== measurementsData.parameter.toLowerCase()
    ) {
      return null;
    }
    return assessmentData;
  }, [assessmentData, measurementsData]);

  const verdict = useMemo(() => {
    const derived = deriveAssessmentVerdict(safeAssessment);
    return (
      derived ?? {
        tone: 'muted' as const,
        chipLabel: 'Awaiting Data',
        headline: 'Select a monitoring station to view live compliance.',
      }
    );
  }, [safeAssessment]);

  const avg = safeAssessment?.calculated_average;
  const hasAvg = typeof avg === 'number' && Number.isFinite(avg);
  const ratio = safeAssessment?.ratio_to_standard;
  const units = safeAssessment?.units || measurementsData?.units || 'µg/m³';
  const paramLabel =
    safeAssessment?.parameter_display_name || measurementsData?.parameter_display_name || 'PM2.5';

  // Derive sparkline path from chronological non-negative points
  const sparkline = useMemo(() => {
    const rawPts = (measurementsData?.measurements || [])
      .map((m) => ({
        value: m.value,
        timestampMs: Date.parse(m.datetime_to_utc || m.datetime_from_utc || ''),
      }))
      .filter((p) => Number.isFinite(p.timestampMs) && typeof p.value === 'number' && p.value >= 0);

    const segments = segmentChronologicalSeries(rawPts);
    const allPts = segments.flat();
    if (allPts.length < 2) return null;

    const width = 320;
    const height = 96;
    const padY = 10;
    const values = allPts.map((p) => p.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values, assessmentData?.standard_threshold ?? 0);
    const range = Math.max(1, maxV - minV);

    const coords = allPts.map((p, idx: number) => {
      const x = (idx / Math.max(1, allPts.length - 1)) * width;
      const y = height - padY - ((p.value - minV) / range) * (height - padY * 2);
      return { x, y };
    });

    const linePath = coords
      .map((c: { x: number; y: number }, idx: number) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    const cpcbLimit = assessmentData?.standard_threshold;
    const cpcbY =
      typeof cpcbLimit === 'number'
        ? height - padY - ((cpcbLimit - minV) / range) * (height - padY * 2)
        : null;

    return { width, height, linePath, areaPath, cpcbY };
  }, [measurementsData?.measurements, assessmentData?.standard_threshold]);

  const statusToneClass =
    verdict.tone === 'anomaly'
      ? styles.heroAnomaly
      : verdict.tone === 'elevated'
      ? styles.heroElevated
      : verdict.tone === 'normal'
      ? styles.heroNormal
      : styles.heroNeutral;

  const isBackendWaking = Boolean(health && !health.data);

  return (
    <div className={`${styles.hero} ${statusToneClass}`}>
      <div className={styles.heroGrid}>
        <div className={styles.heroReadingLayout}>
          <div className={styles.heroReadingLeft}>
            <div className={styles.eyebrowRow}>
              <Badge tone={verdict.tone} dot>
                {verdict.chipLabel}
              </Badge>
              <span className={styles.heroLocationMeta}>
                {selectedLocation
                  ? `${selectedLocation.locality || 'India'} · ${selectedLocation.name}`
                  : 'India Ambient Monitoring Network'}
              </span>
            </div>

            {isLoadingMeasurements && !hasAvg ? (
              <div className={styles.heroSkeletonStack}>
                <Skeleton width="180px" height="64px" />
                <Skeleton width="280px" height="20px" />
              </div>
            ) : hasAvg ? (
              <>
                <div className={styles.heroValueRow}>
                  <CountUpValue
                    value={avg}
                    decimals={1}
                    className={`${styles.heroDisplayValue} eco-tabular`}
                  />
                  <div className={styles.heroUnitCol}>
                    <span className={styles.heroParamTag}>{paramLabel}</span>
                    <span className={styles.heroUnitLabel}>{units} (24h avg)</span>
                  </div>
                </div>

                <div className={styles.heroMetaPills}>
                  {typeof ratio === 'number' && Number.isFinite(ratio) && (
                    <span className={`${styles.multiplierPill} eco-tabular`}>
                      {ratio.toFixed(2)}× CPCB limit ({assessmentData?.standard_threshold} {units})
                    </span>
                  )}
                  <span className={styles.heroOneLiner}>{verdict.headline}</span>
                </div>
              </>
            ) : isBackendWaking ? (
              <div className={styles.calmEmptyBox}>
                <p className={styles.heroTitle}>Waking the data service…</p>
                <p className={styles.heroSubtitle}>
                  Live station readings appear automatically as soon as the API responds.
                </p>
              </div>
            ) : (
              <div className={styles.calmEmptyBox}>
                <h2 className={styles.heroTitle}>Select a monitoring station</h2>
                <p className={styles.heroSubtitle}>
                  Search any Indian city below to inspect verified hourly air-quality telemetry.
                </p>
              </div>
            )}
          </div>

          <div className={styles.heroReadingRight}>
            {sparkline ? (
              <div className={styles.sparklineCard}>
                <div className={styles.sparklineHeader}>
                  <span>24h trend</span>
                  <span className="eco-mono">{measurementsData?.total_observations ?? 0} pts</span>
                </div>
                <svg
                  viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                  className={styles.sparklineSvg}
                  aria-label="24-hour concentration sparkline"
                >
                  <defs>
                    <linearGradient id="heroSparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--eco-teal)" stopOpacity="0.34" />
                      <stop offset="100%" stopColor="var(--eco-teal)" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="heroSparkStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--eco-teal)" />
                      <stop offset="100%" stopColor="var(--eco-lime)" />
                    </linearGradient>
                  </defs>
                  {sparkline.cpcbY !== null &&
                    sparkline.cpcbY >= 4 &&
                    sparkline.cpcbY <= sparkline.height - 4 && (
                      <line
                        x1="0"
                        y1={sparkline.cpcbY}
                        x2={sparkline.width}
                        y2={sparkline.cpcbY}
                        stroke="var(--eco-status-elevated)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        opacity="0.7"
                      />
                    )}
                  <path d={sparkline.areaPath} fill="url(#heroSparkFill)" />
                  <path
                    d={sparkline.linePath}
                    fill="none"
                    stroke="url(#heroSparkStroke)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.sparklineDraw}
                  />
                </svg>
              </div>
            ) : (
              <div className={styles.heroActions}>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Radio size={15} />}
                  rightIcon={<ArrowRight size={14} />}
                  onClick={onExploreStations}
                >
                  Explore Stations
                </Button>
              </div>
            )}
          </div>
        </div>

        <HeroStationFinder onGoToStations={onExploreStations} />
      </div>
    </div>
  );
};
