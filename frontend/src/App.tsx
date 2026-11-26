import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useInRouterContext,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import type { HealthState, SectionId, TimeRangePreset } from './types';
import {
  checkBackendHealth,
  fetchLocationDetail,
  fetchLocations,
  fetchMeasurements,
  fetchRiskAssessment,
  getApiBaseUrl,
} from './services/api';
import { ThemeProvider } from './context/ThemeContext';
import { StationProvider, useStationContext } from './context/StationContext';
import { SECTIONS, SECTION_PATH_MAP, getSectionByPath } from './config/navigation';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileNav } from './components/layout/MobileNav';
import { StatusBanner } from './components/StatusBanner';
import { Footer } from './components/Footer';
import { SkeletonChart, SkeletonKpiRow } from './components/ui/Skeleton';
import { CommandPalette } from './components/ui/CommandPalette';
import { OverviewSection } from './components/OverviewSection';
import styles from './App.module.css';

// Lazy-loaded secondary workspaces per route for minimal initial JS bundle
const InvestigateAirQuality = lazy(() =>
  import('./components/InvestigateAirQuality').then((m) => ({ default: m.InvestigateAirQuality }))
);
const AnomalySection = lazy(() =>
  import('./components/AnomalySection').then((m) => ({ default: m.AnomalySection }))
);
const SpatialSection = lazy(() =>
  import('./components/SpatialSection').then((m) => ({ default: m.SpatialSection }))
);
const EvidenceSection = lazy(() =>
  import('./components/EvidenceSection').then((m) => ({ default: m.EvidenceSection }))
);
const ReportsSection = lazy(() =>
  import('./components/ReportsSection').then((m) => ({ default: m.ReportsSection }))
);

const MAX_WAKE_RETRIES = 3;
const BACKOFF_MS = [1500, 3000, 6000];

const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const ctx = useStationContext()!;
  const {
    locationsCatalog,
    setLocationsCatalog,
    setHasLoadedCatalog,
    selectedLocation,
    setSelectedLocation,
    selectedParameter,
    setSelectedParameter,
    timeRange,
    setTimeRange,
    measurementsData,
    setMeasurementsData,
    assessmentData,
    setAssessmentData,
    isMeasurementsLoading,
    setIsMeasurementsLoading,
    setLoadedKey,
    setLoadedAssessKey,
    selectStationByDetail,
  } = ctx;

  const activeRoute = getSectionByPath(location.pathname);
  const activeSection = activeRoute.id;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Health & Render cold-start wake-up tracking
  const [health, setHealth] = useState<HealthState>({
    isLoading: true,
    data: null,
    error: null,
    latencyMs: null,
    lastChecked: null,
  });
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const retryTimerRef = useRef<number | null>(null);
  const slowTimerRef = useRef<number | null>(null);
  const healthRunIdRef = useRef(0);
  const runHealthCheckRef = useRef<(attempt?: number) => void>(() => {});

  const runHealthCheck = useCallback((attempt: number = 0, markLoading: boolean = true) => {
    const runId = ++healthRunIdRef.current;
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (slowTimerRef.current !== null) {
      window.clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }

    if (markLoading) {
      setHealth((prev) => ({ ...prev, isLoading: true }));
    }
    if (attempt > 0) {
      setIsWakingUp(true);
      setRetryAttempt(attempt);
    }

    // If health ping exceeds 1.4 s, surface friendly server wake-up indicator
    slowTimerRef.current = window.setTimeout(() => {
      if (runId === healthRunIdRef.current) {
        setIsWakingUp(true);
      }
    }, 1400);

    checkBackendHealth().then((result) => {
      if (slowTimerRef.current !== null) {
        window.clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      if (runId !== healthRunIdRef.current) return;

      if (result.data) {
        setIsWakingUp(false);
        setRetryAttempt(0);
        setHealth({
          isLoading: false,
          data: result.data,
          error: null,
          latencyMs: result.latencyMs,
          lastChecked: new Date().toISOString(),
        });
        return;
      }

      const apiUrl = getApiBaseUrl();
      const isRemoteHost = !apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1');
      const shouldAutoRetry = Boolean(result.timedOut || isRemoteHost) && attempt < MAX_WAKE_RETRIES;

      if (shouldAutoRetry) {
        const nextAttempt = attempt + 1;
        setIsWakingUp(true);
        setRetryAttempt(nextAttempt);
        setHealth({
          isLoading: true,
          data: null,
          error: result.error,
          latencyMs: result.latencyMs,
          lastChecked: new Date().toISOString(),
        });
        const delayMs = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        retryTimerRef.current = window.setTimeout(() => {
          runHealthCheckRef.current(nextAttempt);
        }, delayMs);
      } else {
        setIsWakingUp(false);
        setRetryAttempt(0);
        setHealth({
          isLoading: false,
          data: null,
          error: result.error,
          latencyMs: result.latencyMs,
          lastChecked: new Date().toISOString(),
        });
      }
    });
  }, []);

  useEffect(() => {
    runHealthCheckRef.current = runHealthCheck;
  }, [runHealthCheck]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      runHealthCheckRef.current(0);
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
      if (slowTimerRef.current !== null) window.clearTimeout(slowTimerRef.current);
    };
  }, []);

  // Hydrate shared station state on boot: use `?station=` if present, else auto-select freshest Delhi PM2.5 station
  const initialHydratedRef = useRef(false);
  useEffect(() => {
    if (initialHydratedRef.current) return;
    initialHydratedRef.current = true;

    const urlStation = searchParams.get('station');
    const urlParam = searchParams.get('param');
    const urlWindow = searchParams.get('window');

    const resolvedWindow: TimeRangePreset =
      urlWindow === '24h' || urlWindow === '7d' || urlWindow === '30d' ? urlWindow : '24h';
    if (urlWindow === '24h' || urlWindow === '7d' || urlWindow === '30d') {
      setTimeRange(resolvedWindow);
    }
    const resolvedParam = urlParam || 'pm25';
    if (urlParam) {
      setSelectedParameter(urlParam);
    }

    const loadStationAndTelemetry = async (stationId: number, paramHint: string) => {
      setIsMeasurementsLoading(true);
      try {
        const detailRes = await fetchLocationDetail(stationId);
        if (!detailRes.data) {
          setIsMeasurementsLoading(false);
          return;
        }
        const detail = detailRes.data;
        selectStationByDetail(detail, paramHint);

        const avail = detail.available_parameters || [];
        const effectiveParam =
          avail.find((p) => p.toLowerCase() === paramHint.toLowerCase()) ||
          avail.find((p) => p.toLowerCase() === 'pm25' || p.toLowerCase() === 'pm2.5') ||
          avail[0] ||
          paramHint;
        const effectiveWindow: TimeRangePreset =
          detail.is_stale && resolvedWindow === '24h' ? '7d' : resolvedWindow;
        const queryKey = `${detail.id}::${effectiveParam}::${effectiveWindow}`;

        const [measRes, assessRes] = await Promise.all([
          fetchMeasurements(detail.id, effectiveParam),
          fetchRiskAssessment(detail.id, effectiveParam),
        ]);

        if (measRes.data) {
          setMeasurementsData(measRes.data);
          setLoadedKey(queryKey);
        }
        if (assessRes.data) {
          setAssessmentData(assessRes.data);
          setLoadedAssessKey(queryKey);
        }
      } catch {
        // Calm fallback handled in HomeHeroReading & StatusBanner
      } finally {
        setIsMeasurementsLoading(false);
      }
    };

    if (urlStation && !selectedLocation) {
      const parsedId = Number(urlStation);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        loadStationAndTelemetry(parsedId, resolvedParam);
        return;
      }
    }

    // Data-first landing: auto-select the most recent fresh Delhi PM2.5 station
    if (!selectedLocation) {
      fetchLocations()
        .then((res) => {
          const list = res?.data;
          if (!list || list.length === 0) return;
          setLocationsCatalog(list);
          setHasLoadedCatalog(true);

          const hasPm25 = (params?: string[]) =>
            (params || []).some((p) => p.toLowerCase() === 'pm25' || p.toLowerCase() === 'pm2.5');

          const delhiFreshPm25 = list.find(
            (s) =>
              !s.is_stale &&
              (s.locality?.toLowerCase().includes('delhi') || s.name.toLowerCase().includes('delhi')) &&
              hasPm25(s.available_parameters)
          );
          const anyFreshPm25 = list.find((s) => !s.is_stale && hasPm25(s.available_parameters));
          const target = delhiFreshPm25 || anyFreshPm25 || list[0];
          if (target) {
            loadStationAndTelemetry(target.id, 'pm25');
          }
        })
        .catch(() => {
          // Non-blocking: StatusBanner shows calm waking state
        });
    }
  }, [
    searchParams,
    selectedLocation,
    selectStationByDetail,
    setAssessmentData,
    setHasLoadedCatalog,
    setIsMeasurementsLoading,
    setLoadedAssessKey,
    setLoadedKey,
    setLocationsCatalog,
    setMeasurementsData,
    setSelectedParameter,
    setTimeRange,
  ]);

  // Keep URL search parameters synchronized cleanly via History API without interrupting Router transitions
  useEffect(() => {
    if (!selectedLocation?.id) return;
    const next = new URLSearchParams(window.location.search);
    let changed = false;

    const idStr = String(selectedLocation.id);
    if (next.get('station') !== idStr) {
      next.set('station', idStr);
      changed = true;
    }
    if (selectedParameter && next.get('param') !== selectedParameter) {
      next.set('param', selectedParameter);
      changed = true;
    }
    if (timeRange && next.get('window') !== timeRange) {
      next.set('window', timeRange);
      changed = true;
    }

    if (changed) {
      const qs = next.toString();
      const targetUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', targetUrl);
    }
  }, [selectedLocation?.id, selectedParameter, timeRange, location.pathname]);

  const navigateToSection = useCallback(
    (sectionId: SectionId) => {
      const targetPath = SECTION_PATH_MAP[sectionId] || '/';
      const next = new URLSearchParams(window.location.search);
      if (selectedLocation?.id) {
        next.set('station', String(selectedLocation.id));
        if (selectedParameter) next.set('param', selectedParameter);
        if (timeRange) next.set('window', timeRange);
      }
      const qs = next.toString();
      navigate({ pathname: targetPath, search: qs ? `?${qs}` : '' });
    },
    [navigate, selectedLocation, selectedParameter, timeRange]
  );

  const handlePaletteSelectStation = useCallback(
    (stationId: number) => {
      fetchLocationDetail(stationId).then((res) => {
        if (res.data) {
          selectStationByDetail(res.data);
          const next = new URLSearchParams(window.location.search);
          next.set('station', String(res.data.id));
          navigate({ pathname: '/stations', search: `?${next.toString()}` });
        }
      });
    },
    [navigate, selectStationByDetail]
  );

  const activeParam = measurementsData?.parameter || assessmentData?.parameter || selectedParameter;

  return (
    <div className={styles.shell}>
      <Sidebar
        sections={SECTIONS}
        activeSection={activeSection}
        onSelectSection={navigateToSection}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        selectedLocation={selectedLocation}
        selectedParameter={activeParam}
        health={health}
      />

      <div className={styles.mainLayout}>
        <Header
          sections={SECTIONS}
          activeSection={activeSection}
          onSelectSection={navigateToSection}
          selectedLocation={selectedLocation}
          measurementsData={measurementsData}
          assessmentData={assessmentData}
          selectedParameter={activeParam}
          onToggleMobileMenu={() => setIsMobileOpen((prev) => !prev)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
        />

        <main className={styles.mainContent} id="main-content">
          <StatusBanner
            health={health}
            onRefresh={() => runHealthCheck(0)}
            isWakingUp={isWakingUp}
            retryAttempt={retryAttempt}
            maxRetries={MAX_WAKE_RETRIES}
          />

          <Suspense
            fallback={
              <div className={styles.routeLoader}>
                <SkeletonKpiRow count={4} />
                <SkeletonChart label="Loading workspace view..." />
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <OverviewSection
                    onNavigate={navigateToSection}
                    selectedLocation={selectedLocation}
                    measurementsData={measurementsData}
                    assessmentData={assessmentData}
                    isLoadingMeasurements={isMeasurementsLoading}
                    health={health}
                  />
                }
              />
              <Route
                path="/stations"
                element={
                  <InvestigateAirQuality
                    selectedLocation={selectedLocation}
                    onMeasurementsLoaded={setMeasurementsData}
                    onLocationSelected={setSelectedLocation}
                    onAssessmentLoaded={setAssessmentData}
                    onMeasurementsLoadingChange={setIsMeasurementsLoading}
                  />
                }
              />
              <Route
                path="/anomalies"
                element={
                  <AnomalySection
                    selectedLocation={selectedLocation}
                    onSelectLocation={setSelectedLocation}
                    activeParameter={activeParam}
                  />
                }
              />
              <Route
                path="/compare"
                element={
                  <SpatialSection
                    selectedLocation={selectedLocation}
                    onSelectLocation={setSelectedLocation}
                    activeParameter={activeParam}
                  />
                }
              />
              <Route
                path="/quality"
                element={
                  <EvidenceSection
                    locationDetail={selectedLocation}
                    measurementsData={measurementsData}
                    assessmentData={assessmentData}
                    onNavigate={navigateToSection}
                  />
                }
              />
              <Route
                path="/action-plan"
                element={
                  <ReportsSection
                    locationDetail={selectedLocation}
                    measurementsData={measurementsData}
                    assessmentData={assessmentData}
                    onNavigate={navigateToSection}
                  />
                }
              />

              {/* Legacy URL redirects for backward compatibility */}
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route path="/investigate" element={<Navigate to="/stations" replace />} />
              <Route path="/spatial" element={<Navigate to="/compare" replace />} />
              <Route path="/evidence" element={<Navigate to="/quality" replace />} />
              <Route path="/reports" element={<Navigate to="/action-plan" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        <Footer />
      </div>

      <MobileNav
        sections={SECTIONS}
        activeSection={activeSection}
        onOpenDrawer={() => setIsMobileOpen(true)}
      />

      <CommandPalette
        open={isPaletteOpen}
        onOpenChange={setIsPaletteOpen}
        cachedStations={locationsCatalog}
        onStationsLoaded={(list) => setLocationsCatalog(list)}
        onNavigateSection={navigateToSection}
        onSelectStation={handlePaletteSelectStation}
      />
    </div>
  );
};

const RouterWrapper: React.FC = () => {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <AppShell />;
  }
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <StationProvider>
          <RouterWrapper />
        </StationProvider>
      </MotionConfig>
    </ThemeProvider>
  );
};

export default App;
