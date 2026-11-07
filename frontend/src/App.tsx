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
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { StatusBanner } from './components/StatusBanner';
import { OverviewSection } from './components/OverviewSection';
import { InvestigateAirQuality } from './components/InvestigateAirQuality';
import { EvidenceSection } from './components/EvidenceSection';
import { ReportsSection } from './components/ReportsSection';
import { AnomalySection } from './components/AnomalySection';
import { SpatialSection } from './components/SpatialSection';
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
    label: 'Station Telemetry',
    shortDescription: 'Indian monitoring stations & measurements',
    statusBadge: 'Active',
    statusType: 'active',
  },
  {
    id: 'anomalies',
    label: 'Pollution Intelligence',
    shortDescription: 'Statistical anomaly detection & baseline screening',
    statusBadge: 'Milestone 6',
    statusType: 'active',
  },
  {
    id: 'spatial',
    label: 'Spatial Comparison',
    shortDescription: 'Multi-station comparison & network sync',
    statusBadge: 'Milestone 7',
    statusType: 'active',
  },
  {
    id: 'evidence',
    label: 'Evidence & Data Quality',
    shortDescription: 'Coverage, freshness & integrity bounds',
    statusBadge: 'Verified',
    statusType: 'active',
  },
  {
    id: 'reports',
    label: 'Environmental Action Plan',
    shortDescription: 'Facility mitigation dossier & emission abatement',
    statusBadge: 'Dossier',
    statusType: 'active',
  },
];

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

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
    <div className="app-shell">
      {/* Collapsible Desktop Sidebar & Mobile Drawer */}
      <Sidebar
        sections={SECTIONS}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        selectedLocation={selectedLocation}
        selectedParameter={measurementsData?.parameter || assessmentData?.parameter}
      />

      {/* Main Layout Area */}
      <div className="app-main-layout">
        {/* Redesigned Sticky Telemetry Header */}
        <Header
          sections={SECTIONS}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          selectedLocation={selectedLocation}
          measurementsData={measurementsData}
          assessmentData={assessmentData}
          selectedParameter={measurementsData?.parameter || assessmentData?.parameter}
          onToggleMobileMenu={() => setIsMobileOpen((prev) => !prev)}
        />

        {/* Content Area with Full-Width Support */}
        <main className="app-main-content" id="main-content">
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

          {activeSection === 'anomalies' && (
            <AnomalySection
              selectedLocation={selectedLocation}
              onSelectLocation={setSelectedLocation}
              activeParameter={measurementsData?.parameter || assessmentData?.parameter}
            />
          )}

          {activeSection === 'spatial' && (
            <SpatialSection
              selectedLocation={selectedLocation}
              onSelectLocation={setSelectedLocation}
              activeParameter={measurementsData?.parameter || assessmentData?.parameter}
            />
          )}

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
    </div>
  );
};

export default App;
