import React, { useState, useEffect, useCallback } from 'react';
import type {
  NavSection,
  SectionId,
  HealthState,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from './types';
import { checkBackendHealth } from './services/api';
import { Header } from './components/Header';
import { StatusBanner } from './components/StatusBanner';
import { OverviewSection } from './components/OverviewSection';
import { InvestigateAirQuality } from './components/InvestigateAirQuality';
import { EvidenceSection } from './components/EvidenceSection';
import { ReportsSection } from './components/ReportsSection';
import { Footer } from './components/Footer';

const SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortDescription: 'Project scope & architecture',
    statusBadge: 'Active',
    statusType: 'active',
  },
  {
    id: 'investigate',
    label: 'Investigate',
    shortDescription: 'Indian monitoring stations & measurements',
    statusBadge: 'Active',
    statusType: 'active',
  },
  {
    id: 'evidence',
    label: 'Evidence & Data Quality',
    shortDescription: 'Coverage, freshness & integrity bounds',
    statusBadge: 'Active',
    statusType: 'active',
  },
  {
    id: 'reports',
    label: 'Investigation Reports',
    shortDescription: 'Explainable statistical summaries',
    statusBadge: 'Active',
    statusType: 'active',
  },
];

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [selectedLocation, setSelectedLocation] = useState<LocationDetail | null>(null);
  const [measurementsData, setMeasurementsData] = useState<LocationMeasurementsResponse | null>(null);
  const [assessmentData, setAssessmentData] = useState<RiskAssessmentResponse | null>(null);

  const [health, setHealth] = useState<HealthState>({
    isLoading: true,
    data: null,
    error: null,
    latencyMs: null,
    lastChecked: null,
  });

  const refreshHealth = useCallback(async () => {
    setHealth((prev) => ({ ...prev, isLoading: true }));
    const result = await checkBackendHealth();
    setHealth({
      isLoading: false,
      data: result.data,
      error: result.error,
      latencyMs: result.latencyMs,
      lastChecked: new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  return (
    <div className="app-container">
      <Header
        sections={SECTIONS}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
      />

      <main className="main-content" id="main-content">
        <StatusBanner health={health} onRefresh={refreshHealth} />

        {activeSection === 'overview' && (
          <OverviewSection onNavigate={setActiveSection} />
        )}
        <InvestigateAirQuality
          onMeasurementsLoaded={setMeasurementsData}
          onLocationSelected={setSelectedLocation}
          onAssessmentLoaded={setAssessmentData}
          hidden={activeSection !== 'investigate'}
        />
        {activeSection === 'evidence' && (
          <EvidenceSection
            locationDetail={selectedLocation}
            measurementsData={measurementsData}
            assessmentData={assessmentData}
            onNavigate={setActiveSection}
          />
        )}
        {activeSection === 'reports' && (
          <ReportsSection
            locationDetail={selectedLocation}
            measurementsData={measurementsData}
            assessmentData={assessmentData}
            onNavigate={setActiveSection}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;
