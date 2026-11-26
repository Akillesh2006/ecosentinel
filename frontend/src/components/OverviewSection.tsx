import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  HealthState,
  LocationDetail,
  LocationMeasurementsResponse,
  ProviderStatusResponse,
  RiskAssessmentResponse,
  SectionId,
} from '../types';
import { fetchProviderStatus } from '../services/api';
import { useStationContext } from '../context/StationContext';
import { Card } from './ui/Card';
import { HomeHeroReading } from './home/HomeHeroReading';
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
  health?: HealthState;
}

/**
 * Data-first Home workspace: 72px hero reading, compact KPI bento tiles,
 * full-width interactive India network map, gap-aware chart preview, and next steps.
 */
export const OverviewSection: React.FC<OverviewSectionProps> = ({
  onNavigate,
  selectedLocation,
  measurementsData,
  assessmentData,
  isLoadingMeasurements = false,
  health,
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
      className={`${styles.page} eco-stagger`}
      aria-label="Environmental Intelligence Overview"
    >
      <h2 className="sr-only">Environmental Intelligence Overview</h2>
      {/* 1. Data-First Hero Reading + Search */}
      <HomeHeroReading
        selectedLocation={selectedLocation}
        measurementsData={measurementsData}
        assessmentData={assessmentData}
        isLoadingMeasurements={isLoadingMeasurements}
        health={health}
        onExploreStations={() => onNavigate('investigate')}
      />

      {/* API Key Configuration Notice when unconfigured */}
      {providerStatus && !providerStatus.is_configured && (
        <Card padding="md" variant="default">
          <div role="status" className={styles.providerNotice}>
            <AlertTriangle size={18} className={styles.providerIcon} />
            <div className={styles.providerCopy}>
              <strong>OpenAQ API Configuration Required — {providerStatus.message}</strong>
              <span className={styles.providerSub}>
                <strong>Configuration Guidance:</strong> {providerStatus.key_instructions} Register a key at{' '}
                <a
                  href="https://explore.openaq.org/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.providerLink}
                >
                  explore.openaq.org/register
                </a>
                .
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* 2. Compact 4-Tile KPI Bento Row */}
      <NetworkSnapshotTiles
        selectedLocation={selectedLocation}
        measurementsData={measurementsData}
        assessmentData={assessmentData}
      />

      {/* 3. Full-Width India Network Map Centrepiece */}
      <IndiaNetworkMap
        selectedLocation={selectedLocation}
        assessmentData={assessmentData}
        onExploreStations={handleOpenHub}
      />

      {/* 4. Verified Observation Chart Preview */}
      <OverviewPreviewChart
        selectedLocation={selectedLocation}
        measurementsData={measurementsData}
        assessmentData={assessmentData}
        isLoadingMeasurements={isLoadingMeasurements}
        onExploreStations={() => onNavigate('investigate')}
      />

      {/* 5. Guided Next Steps */}
      <NextStepsGrid onNavigate={onNavigate} />
    </section>
  );
};
