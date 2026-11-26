import React, { useEffect, useState } from 'react';
import { Radio, ShieldCheck, AlertTriangle } from 'lucide-react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  ProviderStatusResponse,
  RiskAssessmentResponse,
  SectionId,
} from '../types';
import { fetchProviderStatus } from '../services/api';
import { useStationContext } from '../context/StationContext';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { HeroStationFinder } from './home/HeroStationFinder';
import { IndiaNetworkMap } from './home/IndiaNetworkMap';
import { NetworkSnapshotTiles } from './home/NetworkSnapshotTiles';
import { OverviewPreviewChart } from './home/OverviewPreviewChart';
import { NextStepsGrid } from './home/NextStepsGrid';
import styles from './home/Home.module.css';

interface OverviewSectionProps {
  onNavigate: (section: SectionId) => void;
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  isLoadingMeasurements?: boolean;
}

/**
 * Redesigned Home workspace: plain-language overview, station finder,
 * national geographic hub map, verified snapshot tiles, and gap-aware time-series preview.
 */
export const OverviewSection: React.FC<OverviewSectionProps> = ({
  onNavigate,
  selectedLocation,
  measurementsData,
  assessmentData,
  isLoadingMeasurements = false,
}) => {
  const stationCtx = useStationContext();
  const [providerStatus, setProviderStatus] = useState<ProviderStatusResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetchProviderStatus()
      .then((res) => {
        if (active && res.data) {
          setProviderStatus(res.data);
        }
      })
      .catch(() => {
        // Non-blocking provider indicator
      });
    return () => {
      active = false;
    };
  }, []);

  const handleOpenHub = (cityHint?: string) => {
    if (cityHint) {
      stationCtx?.setSearchQuery(cityHint);
    }
    onNavigate('investigate');
  };

  return (
    <section
      id="panel-overview"
      className={styles.page}
      aria-label="Environmental Intelligence Overview"
    >
      {/* Hero Banner & Quick Station Finder */}
      <div className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrowRow}>
                <span className={styles.eyebrow}>National Ambient Telemetry</span>
                <Badge
                  tone={
                    providerStatus
                      ? providerStatus.is_configured && providerStatus.is_reachable
                        ? 'normal'
                        : 'elevated'
                      : 'muted'
                  }
                  dot
                >
                  {providerStatus
                    ? providerStatus.is_configured
                      ? providerStatus.is_reachable
                        ? 'OpenAQ v3 Ready'
                        : 'Provider Offline'
                      : 'API Key Unconfigured'
                    : 'OpenAQ v3'}
                </Badge>
              </div>
              <h2 className={styles.heroTitle}>Environmental Intelligence Overview</h2>
              <p className={styles.heroSubtitle}>
                Check live station telemetry across India against CPCB NAAQS and WHO 2021 limits, spot unusual spikes, and export audit-ready compliance evidence.
              </p>
            </div>

            <div className={styles.heroActions}>
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Radio size={15} />}
                onClick={() => onNavigate('investigate')}
              >
                Explore Stations
              </Button>
              <Button
                variant="outline"
                size="md"
                leftIcon={<ShieldCheck size={15} />}
                onClick={() => onNavigate('evidence')}
              >
                Data Quality Gate
              </Button>
            </div>
          </div>

          <HeroStationFinder onGoToStations={() => onNavigate('investigate')} />
        </div>
      </div>

      {/* API Key Configuration Notice when unconfigured */}
      {providerStatus && !providerStatus.is_configured && (
        <Card padding="md" variant="default">
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--eco-space-3)',
              color: 'var(--eco-text-primary)',
            }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--eco-status-elevated-text)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--eco-text-xs)' }}>
              <strong>OpenAQ API Configuration Required — {providerStatus.message}</strong>
              <span style={{ color: 'var(--eco-text-secondary)' }}>
                <strong>Configuration Guidance:</strong> {providerStatus.key_instructions} Register a key at{' '}
                <a
                  href="https://explore.openaq.org/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--eco-teal-text)', textDecoration: 'underline' }}
                >
                  explore.openaq.org/register
                </a>
                .
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* National Map + Verified Snapshot Tiles */}
      <div className={styles.bentoGrid}>
        <IndiaNetworkMap
          selectedLocation={selectedLocation}
          onExploreStations={handleOpenHub}
        />
        <NetworkSnapshotTiles
          selectedLocation={selectedLocation}
          measurementsData={measurementsData}
          assessmentData={assessmentData}
        />
      </div>

      {/* Verified Observation Chart */}
      <OverviewPreviewChart
        selectedLocation={selectedLocation}
        measurementsData={measurementsData}
        assessmentData={assessmentData}
        isLoadingMeasurements={isLoadingMeasurements}
        onExploreStations={() => onNavigate('investigate')}
      />

      {/* Guided Workflows & Guardrail Notice */}
      <NextStepsGrid onNavigate={onNavigate} />
    </section>
  );
};
