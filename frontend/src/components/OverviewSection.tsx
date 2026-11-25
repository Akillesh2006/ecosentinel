import React, { useEffect, useState, useMemo } from 'react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  ProviderStatusResponse,
  RiskAssessmentResponse,
  SectionId,
} from '../types';
import { fetchProviderStatus } from '../services/api';

export interface OverviewSectionProps {
  onNavigate: (sectionId: SectionId) => void;
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  isLoadingMeasurements?: boolean;
  hidden?: boolean;
}

// Coordinate polygon for India boundary
const INDIA_COORDS: [number, number][] = [
  [78.92, 33.39], [79.46, 33.25], [79.33, 32.99], [79.62, 32.73], [79.44, 32.53],
  [79.32, 32.59], [78.94, 32.35], [78.77, 32.46], [78.74, 32.63], [78.38, 32.55],
  [78.46, 32.23], [78.74, 31.96], [78.67, 31.77], [78.82, 31.61], [78.7, 31.51],
  [78.75, 31.31], [78.92, 31.27], [79.13, 31.44], [79.4, 31.02], [79.85, 30.95],
  [80.22, 30.73], [80.18, 30.56], [80.6, 30.46], [81.0, 30.21], [80.87, 30.2],
  [80.37, 29.76], [80.39, 29.6], [80.21, 29.42], [80.26, 29.2], [80.04, 28.84],
  [80.33, 28.63], [80.49, 28.56], [80.56, 28.68], [81.17, 28.36], [81.3, 28.13],
  [81.4, 28.16], [81.86, 27.85], [82.03, 27.91], [82.4, 27.68], [82.68, 27.69],
  [82.75, 27.49], [83.13, 27.44], [83.28, 27.33], [83.39, 27.47], [83.85, 27.35],
  [83.83, 27.43], [84.12, 27.51], [84.29, 27.38], [84.61, 27.31], [84.64, 27.03],
  [85.29, 26.74], [85.61, 26.85], [85.83, 26.57], [86.01, 26.65], [86.28, 26.61],
  [86.71, 26.41], [87.04, 26.58], [87.35, 26.4], [87.71, 26.55], [88.08, 26.4],
  [88.13, 26.77], [88.54, 27.08], [88.53, 27.73], [88.69, 28.06], [88.92, 27.84],
  [88.85, 27.32], [89.74, 26.75], [89.87, 26.42], [90.0, 26.1], [89.85, 25.43],
  [89.87, 25.17], [90.54, 25.16], [91.89, 25.19], [92.4, 25.04], [92.36, 24.36],
  [91.95, 24.16], [91.82, 23.82], [91.24, 23.63], [91.26, 23.36], [91.43, 23.11],
  [91.86, 23.14], [92.29, 23.61], [92.43, 23.23], [92.83, 23.75], [93.18, 23.96],
  [93.07, 24.4], [93.63, 24.78], [93.75, 25.32], [94.27, 25.68], [94.75, 26.24],
  [95.12, 26.66], [95.42, 27.24], [96.09, 27.55], [96.53, 27.97], [97.02, 28.25],
  [97.35, 28.14], [96.94, 28.61], [96.44, 28.98], [95.53, 29.13], [94.71, 28.84],
  [93.88, 28.47], [93.13, 28.64], [92.17, 27.79], [91.85, 27.78], [91.73, 27.32],
  [91.27, 26.83], [89.83, 26.75], [88.94, 27.32], [88.88, 27.12], [88.35, 26.48],
  [88.42, 25.44], [88.85, 25.29], [88.75, 24.78], [88.36, 24.84], [88.45, 24.21],
  [88.85, 24.08], [88.94, 23.67], [88.52, 23.13], [88.88, 22.69], [89.06, 22.14],
  [88.88, 21.61], [88.35, 21.57], [87.89, 21.84], [87.41, 21.52], [87.05, 21.46],
  [86.73, 20.81], [86.38, 20.48], [86.07, 19.9], [85.66, 19.7], [85.24, 19.43],
  [85.04, 19.46], [84.77, 19.06], [84.28, 18.77], [83.84, 18.27], [83.3, 17.71],
  [82.72, 17.29], [82.35, 16.98], [82.2, 16.71], [81.82, 16.48], [81.56, 16.33],
  [81.0, 15.8], [80.3, 15.77], [80.05, 15.28], [80.03, 14.28], [80.25, 13.75],
  [80.32, 13.04], [80.1, 12.5], [79.85, 11.96], [79.84, 11.1], [79.86, 10.77],
  [79.35, 10.28], [79.16, 9.92], [79.3, 9.45], [79.15, 9.22], [78.65, 9.15],
  [78.18, 8.83], [77.56, 8.08], [77.34, 8.32], [76.96, 8.68], [76.54, 9.25],
  [76.32, 9.99], [76.12, 10.51], [75.76, 11.23], [75.34, 11.85], [74.96, 12.5],
  [74.72, 13.33], [74.34, 14.25], [74.15, 15.0], [73.75, 15.54], [73.47, 16.14],
  [73.28, 16.89], [72.99, 17.72], [72.82, 18.96], [72.78, 19.86], [72.64, 20.86],
  [72.85, 21.14], [72.63, 21.58], [72.22, 21.73], [72.03, 21.5], [71.55, 20.91],
  [71.0, 20.73], [70.36, 20.87], [69.64, 21.78], [69.04, 22.3], [69.34, 22.65],
  [70.07, 22.84], [70.47, 23.0], [70.0, 23.25], [68.67, 23.7], [68.17, 23.71],
  [68.52, 24.1], [68.83, 24.3], [70.21, 24.45], [71.09, 24.26], [71.07, 24.7],
  [70.48, 25.32], [70.19, 25.99], [70.62, 26.96], [70.35, 27.3], [70.73, 27.87],
  [71.74, 28.27], [72.44, 28.98], [73.22, 29.75], [73.88, 29.98], [74.52, 30.34],
  [74.37, 30.82], [74.76, 31.42], [74.96, 31.95], [74.98, 32.48], [75.64, 32.61],
  [75.98, 33.02], [76.44, 33.45], [76.91, 33.36], [77.34, 33.5], [77.72, 33.25],
  [78.29, 33.42], [78.92, 33.39]
];

// Major Indian monitoring clusters
const NETWORK_CLUSTERS = [
  { name: 'Delhi NCR', lat: 28.61, lon: 77.21, count: 18, q: 'complete' },
  { name: 'Mumbai MMR', lat: 19.07, lon: 72.88, count: 9, q: 'complete' },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59, count: 7, q: 'complete' },
  { name: 'Kolkata', lat: 22.57, lon: 88.36, count: 5, q: 'insufficient' },
  { name: 'Chennai', lat: 13.05, lon: 80.22, count: 5, q: 'complete' },
  { name: 'Hyderabad', lat: 17.39, lon: 78.47, count: 5, q: 'complete' },
  { name: 'Pune', lat: 18.52, lon: 73.85, count: 3, q: 'complete' },
  { name: 'Ahmedabad', lat: 23.03, lon: 72.58, count: 3, q: 'stale' },
  { name: 'Lucknow', lat: 26.85, lon: 80.95, count: 3, q: 'complete' },
  { name: 'Patna', lat: 25.60, lon: 85.10, count: 3, q: 'insufficient' },
  { name: 'Jaipur', lat: 26.91, lon: 75.79, count: 3, q: 'complete' },
  { name: 'Chandigarh', lat: 30.73, lon: 76.78, count: 2, q: 'complete' },
];

// Constellation Map projection constants
const MAP_W = 540;
const MAP_OFFSET_X = 350;
const MAP_H = 620;

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  onNavigate,
  selectedLocation,
  measurementsData,
  assessmentData,
  isLoadingMeasurements = false,
  hidden,
}) => {
  const [providerStatus, setProviderStatus] = useState<ProviderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoverStation, setHoverStation] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchProviderStatus().then((res) => {
      if (!isMounted) return;
      setIsLoading(false);
      if (res.data) {
        setProviderStatus(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute India map path in viewBox 0 0 680 640
  const indiaPath = useMemo(() => {
    return (
      INDIA_COORDS.map((p, k) => {
        const x = (MAP_OFFSET_X + ((p[0] - 66) / 34) * MAP_W).toFixed(1);
        const y = (((38 - p[1]) / 33) * MAP_H).toFixed(1);
        return `${k ? 'L' : 'M'}${x} ${y}`;
      }).join(' ') + ' Z'
    );
  }, []);

  // Project lat/lon to map coordinates
  const projectCoord = (lat: number, lon: number) => {
    const x = MAP_OFFSET_X + ((lon - 66) / 34) * MAP_W;
    const y = ((38 - lat) / 33) * MAP_H;
    return { x, y };
  };

  // Selected station projection
  const selPos = useMemo(() => {
    if (!selectedLocation?.coordinates) return null;
    return projectCoord(selectedLocation.coordinates.latitude, selectedLocation.coordinates.longitude);
  }, [selectedLocation]);

  // Parameter matching guard: prevents pairing old observations with new pollutant assessments
  const isParamMatching = useMemo(() => {
    if (!measurementsData || !assessmentData) return true;
    return measurementsData.parameter.toLowerCase() === assessmentData.parameter.toLowerCase();
  }, [measurementsData, assessmentData]);

  const activeAssessment = isParamMatching ? assessmentData : null;
  const activeParameter = (measurementsData?.parameter || activeAssessment?.parameter || 'pm25').toLowerCase();
  const activeParameterDisplay =
    measurementsData?.parameter_display_name ||
    activeAssessment?.parameter_display_name ||
    (activeParameter === 'pm25'
      ? 'PM2.5'
      : activeParameter === 'pm10'
        ? 'PM10'
        : activeParameter === 'no2'
          ? 'NO₂'
          : activeParameter === 'so2'
            ? 'SO₂'
            : activeParameter === 'o3'
              ? 'O₃'
              : activeParameter === 'co'
                ? 'CO'
                : activeParameter.toUpperCase());
  const activeUnits = measurementsData?.units || activeAssessment?.units || (activeParameter === 'co' ? 'mg/m³' : 'µg/m³');

  // Fingerprint spokes calculation (Zero fabricated ratios: only plot active assessed parameter)
  const fingerprintSpokes = useMemo(() => {
    const paramList = [
      { id: 'pm25', key: 'PM2.5', color: 'var(--eco-teal)' },
      { id: 'pm10', key: 'PM10', color: 'var(--eco-teal)' },
      { id: 'no2', key: 'NO₂', color: 'var(--eco-status-historical)' },
      { id: 'o3', key: 'O₃', color: 'var(--eco-lime)' },
      { id: 'co', key: 'CO', color: 'var(--eco-status-elevated)' },
      { id: 'so2', key: 'SO₂', color: 'var(--eco-status-historical)' },
    ];

    const angleStep = (Math.PI * 2) / paramList.length;
    const R_BENCHMARK = 32;

    return paramList.map((p, i) => {
      const isAssessedParam =
        activeAssessment &&
        activeAssessment.parameter.toLowerCase() === p.id &&
        activeAssessment.ratio_to_standard !== null &&
        activeAssessment.ratio_to_standard !== undefined;

      const ratio = isAssessedParam ? activeAssessment.ratio_to_standard! : null;
      const angle = i * angleStep - Math.PI / 2;
      const r = ratio !== null ? Math.min(Math.max(ratio * R_BENCHMARK, 8), 58) : R_BENCHMARK;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      const ax = Math.cos(angle) * 58;
      const ay = Math.sin(angle) * 58;
      const lx = Math.cos(angle) * 65;
      const ly = Math.sin(angle) * 65;
      return {
        ...p,
        ratio,
        complete: isAssessedParam ? activeAssessment.is_completeness_satisfied : false,
        x,
        y,
        ax,
        ay,
        lx,
        ly,
      };
    });
  }, [activeAssessment]);

  // Extract verified observations for chart
  const observations = measurementsData?.measurements || [];
  const validObservations = observations.filter((m) => !m.is_missing && m.value !== null && m.value >= 0);

  // Priority 2: Governed average MUST come exclusively from backend calculated_average.
  // Never compute an arithmetic fallback mean when completeness gate or freshness is unsatisfied.
  const governedMean = activeAssessment?.calculated_average ?? null;

  // Priority 4: Averaging period & expected observations from backend (8h for O3/CO, 24h for PM2.5/PM10/NO2/SO2)
  const expectedObservations =
    activeAssessment?.expected_observations ??
    measurementsData?.expected_observations ??
    (activeParameter === 'o3' || activeParameter === 'co' ? 8 : 24);
  const averagingPeriodLabel =
    activeAssessment?.averaging_period_label ??
    (expectedObservations === 8 ? '8-hour' : '24-hour');

  const validObsCount =
    activeAssessment?.valid_observations ??
    measurementsData?.total_observations ??
    validObservations.length;
  const missingCount =
    activeAssessment?.missing_observations ??
    Math.max(0, expectedObservations - validObsCount);

  const isGateSatisfied =
    activeAssessment?.is_completeness_satisfied ??
    (expectedObservations > 0 ? validObsCount / expectedObservations >= 0.75 : false);
  const completenessPercentage =
    activeAssessment?.completeness_percentage ??
    (expectedObservations > 0 ? Math.min(100, (validObsCount / expectedObservations) * 100) : 0);

  // Priority 5: Sensor-level / assessment-level freshness
  const isSensorStale =
    activeAssessment?.freshness_state === 'stale' ||
    activeAssessment?.freshness_state === 'historical' ||
    (activeAssessment === null && (measurementsData?.is_stale ?? selectedLocation?.is_stale ?? false));

  const freshnessBadgeLabel = (() => {
    if (!selectedLocation) return 'Awaiting Selection';
    if (activeAssessment) {
      if (activeAssessment.freshness_state === 'fresh') return '✓ Fresh Observation';
      if (activeAssessment.freshness_state === 'stale') return 'Stale Data (>24h)';
      if (activeAssessment.freshness_state === 'historical') return 'Historical (>30d)';
      return 'Freshness Unavailable';
    }
    if (measurementsData) {
      return measurementsData.is_stale ? 'Stale Data (>24h)' : '✓ Live Stream';
    }
    return selectedLocation.is_stale ? 'Stale Data (>24h)' : '✓ Live Stream';
  })();

  // Priority 3: Benchmark handling. Distinguish assessment not loaded vs explicitly null (e.g. CO has no WHO 8h guideline)
  const cpcbThreshold = activeAssessment
    ? (activeAssessment.standard_threshold ?? null)
    : (selectedLocation && measurementsData
        ? (activeParameter === 'pm10'
            ? 100
            : activeParameter === 'no2' || activeParameter === 'so2'
              ? 80
              : activeParameter === 'co'
                ? 2
                : activeParameter === 'o3'
                  ? 100
                  : 60)
        : null);
  const cpcbUnit = activeAssessment?.standard_unit || activeUnits;

  // Strictly respect secondary_benchmark_threshold: if null, do NOT render a WHO line or invent a fallback!
  const whoThreshold = activeAssessment ? (activeAssessment.secondary_benchmark_threshold ?? null) : null;
  const whoUnit = activeAssessment?.secondary_benchmark_unit || activeUnits;

  const isChartLoading = Boolean(isLoadingMeasurements || (selectedLocation && measurementsData && !isParamMatching));

  const chartPadLeft = 52;
  const chartPadRight = 24;
  const chartPadTop = 24;
  const chartPadBottom = 34;
  const innerW = 860 - chartPadLeft - chartPadRight;
  const innerH = 220 - chartPadTop - chartPadBottom;

  const { chartSegments, chartPoints, chartTicks, gridLevels, cpcbY, whoY } = useMemo(() => {
    if (validObservations.length === 0) {
      return { chartSegments: [], chartPoints: [], chartTicks: [], gridLevels: [], cpcbY: null, whoY: null };
    }

    const vals = validObservations.map((o) => o.value);
    const minVal = 0;
    const refThreshold = cpcbThreshold ?? 60;
    const maxVal = Math.max(refThreshold * 1.25, Math.ceil(Math.max(...vals, 10) * 1.15), activeParameter === 'co' ? 4 : 50);

    const times = validObservations.map((o) => new Date(o.datetime_from_utc).getTime());
    // Priority 5: Use the requested observation window for x-axis domain where available
    const domainStart = measurementsData?.requested_from_utc
      ? new Date(measurementsData.requested_from_utc).getTime()
      : activeAssessment?.window_start_utc
        ? new Date(activeAssessment.window_start_utc).getTime()
        : Math.min(...times);
    const domainEnd = measurementsData?.requested_to_utc
      ? new Date(measurementsData.requested_to_utc).getTime()
      : activeAssessment?.window_end_utc
        ? new Date(activeAssessment.window_end_utc).getTime()
        : Math.max(...times);
    const timeSpan = Math.max(1, domainEnd - domainStart);

    const getX = (time: number) => {
      if (timeSpan === 0) return chartPadLeft + innerW / 2;
      const ratio = (time - domainStart) / timeSpan;
      return chartPadLeft + Math.max(0, Math.min(1, ratio)) * innerW;
    };

    const getY = (val: number) => {
      return chartPadTop + innerH - ((val - minVal) / (maxVal - minVal)) * innerH;
    };

    // Partition measurements into contiguous continuous segments
    // Break line across gaps > 90 minutes (1.5x expected hourly interval) to never interpolate missing data
    const segments: { linePath: string; areaPath: string }[] = [];
    let current: typeof validObservations = [];

    for (let i = 0; i < validObservations.length; i++) {
      const pt = validObservations[i];
      if (current.length === 0) {
        current.push(pt);
      } else {
        const prevTime = new Date(current[current.length - 1].datetime_from_utc).getTime();
        const currTime = new Date(pt.datetime_from_utc).getTime();
        if (currTime - prevTime > 90 * 60 * 1000) {
          if (current.length > 0) {
            const lineP = current.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(new Date(p.datetime_from_utc).getTime()).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(' ');
            const areaP = `${lineP} L ${getX(new Date(current[current.length - 1].datetime_from_utc).getTime()).toFixed(1)} ${chartPadTop + innerH} L ${getX(new Date(current[0].datetime_from_utc).getTime()).toFixed(1)} ${chartPadTop + innerH} Z`;
            segments.push({ linePath: lineP, areaPath: areaP });
          }
          current = [pt];
        } else {
          current.push(pt);
        }
      }
    }
    if (current.length > 0) {
      const lineP = current.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(new Date(p.datetime_from_utc).getTime()).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(' ');
      const areaP = `${lineP} L ${getX(new Date(current[current.length - 1].datetime_from_utc).getTime()).toFixed(1)} ${chartPadTop + innerH} L ${getX(new Date(current[0].datetime_from_utc).getTime()).toFixed(1)} ${chartPadTop + innerH} Z`;
      segments.push({ linePath: lineP, areaPath: areaP });
    }

    const points = validObservations.map((pt) => ({
      x: getX(new Date(pt.datetime_from_utc).getTime()),
      y: getY(pt.value),
      value: pt.value,
      units: pt.units || activeUnits,
      timeLabel: pt.datetime_from_local || pt.datetime_from_utc,
    }));

    // Generate 5 evenly spaced time axis ticks across the full requested domain
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }).map((_, idx) => {
      const tMs = domainStart + (idx / (tickCount - 1)) * timeSpan;
      const xPos = chartPadLeft + (idx / (tickCount - 1)) * innerW;
      const d = new Date(tMs);
      const label = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      });
      return { label, xPos };
    });

    const grids = [0.25, 0.5, 0.75, 1.0].map((pct) => {
      const v = activeParameter === 'co' ? Number((minVal + pct * (maxVal - minVal)).toFixed(1)) : Math.round(minVal + pct * (maxVal - minVal));
      return { val: v, y: getY(v) };
    });

    const cY = cpcbThreshold !== null && cpcbThreshold > 0 && cpcbThreshold <= maxVal ? getY(cpcbThreshold) : null;
    const wY = whoThreshold !== null && whoThreshold > 0 && whoThreshold <= maxVal ? getY(whoThreshold) : null;

    return {
      chartSegments: segments,
      chartPoints: points,
      chartTicks: ticks,
      gridLevels: grids,
      cpcbY: cY,
      whoY: wY,
    };
  }, [validObservations, cpcbThreshold, whoThreshold, activeUnits, activeParameter, measurementsData?.requested_from_utc, measurementsData?.requested_to_utc, activeAssessment?.window_start_utc, activeAssessment?.window_end_utc]);

  return (
    <article
      id="panel-overview"
      role="tabpanel"
      aria-labelledby="tab-overview"
      hidden={hidden}
      className="es fade"
      style={{
        display: hidden ? 'none' : 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '24px 28px 48px',
        maxWidth: '1520px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* =========================================================================
          MISSION CONTROL: Atmospheric Constellation & Selected Station Intelligence
          ========================================================================= */}
      <section
        aria-labelledby="hero-h"
        className="panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexWrap: 'wrap',
          background: 'radial-gradient(120% 90% at 30% 20%, #131C2E 0%, var(--eco-bg-sidebar) 60%)',
          minHeight: '600px',
        }}
      >
        {/* Constellation Map Canvas */}
        <div style={{ flex: '999 1 540px', minWidth: '320px', position: 'relative', minHeight: '560px' }}>
          <svg
            viewBox="0 0 920 640"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            role="img"
            aria-label="Map of India showing certified air quality monitoring network clusters"
          >
            <defs>
              <linearGradient id="mapG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A273A" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0F1824" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* India Boundary Contour */}
            <path d={indiaPath} fill="url(#mapG)" stroke="var(--eco-teal)" strokeWidth="1.2" strokeOpacity="0.45" />

            {/* Monitoring Clusters */}
            {NETWORK_CLUSTERS.map((c, i) => {
              const pos = projectCoord(c.lat, c.lon);
              const isHovered = hoverStation === c.name;
              const isSel = selectedLocation?.locality?.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]);

              return (
                <g
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select monitoring cluster ${c.name} in Telemetry`}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onMouseEnter={() => setHoverStation(c.name)}
                  onMouseLeave={() => setHoverStation(null)}
                  onClick={() => onNavigate('investigate')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate('investigate');
                    }
                  }}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isSel ? 7 : isHovered ? 6 : 4}
                    fill={c.q === 'complete' ? 'var(--eco-teal)' : c.q === 'stale' ? 'var(--eco-status-muted)' : 'var(--eco-status-elevated)'}
                    stroke={isSel ? 'var(--eco-lime)' : 'var(--eco-bg-sidebar)'}
                    strokeWidth={isSel ? 2 : 1}
                  />
                  {isSel && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="12"
                      fill="none"
                      stroke="var(--eco-lime)"
                      strokeWidth="1.5"
                      className="pulse"
                      strokeOpacity="0.8"
                    />
                  )}
                  <text
                    x={pos.x + 8}
                    y={pos.y + 4}
                    fill={isSel ? 'var(--eco-lime)' : 'var(--eco-text-muted)'}
                    fontSize="10"
                    fontFamily="IBM Plex Mono"
                    letterSpacing="0.04em"
                  >
                    {c.name}
                  </text>
                </g>
              );
            })}

            {/* Active Selected Location Marker */}
            {selPos && (
              <g>
                <circle cx={selPos.x} cy={selPos.y} r="6" fill="var(--eco-lime)" />
                <circle cx={selPos.x} cy={selPos.y} r="14" fill="none" stroke="var(--eco-lime)" strokeWidth="1.5" className="pulse" />
              </g>
            )}
          </svg>

          {/* Hero Copy Overlay - Clean left column layout without map collision */}
          <div style={{ position: 'absolute', left: '36px', top: '32px', maxWidth: '300px', pointerEvents: 'none', zIndex: 10 }} className="fade">
            <div className="lbl" style={{ color: 'var(--eco-lime)', letterSpacing: '.18em', marginBottom: '12px' }}>
              Physical observations first. Claims last.
            </div>
            <h2
              id="hero-h"
              className="disp"
              style={{
                margin: 0,
                fontSize: '36px',
                lineHeight: 1.08,
                fontWeight: 600,
                letterSpacing: '-.025em',
                color: 'var(--eco-text-primary)',
              }}
            >
              Understand the air.<br />
              <span style={{ color: 'var(--eco-text-muted)' }}>Investigate the evidence.</span>
            </h2>
            <p style={{ margin: '14px 0 0', color: 'var(--eco-text-secondary)', fontSize: '13.5px', maxWidth: '290px', lineHeight: 1.5 }}>
              Environmental intelligence built from physical observations, verified CPCB standards, and spatial evidence.
            </p>
          </div>

          {/* Map Legend */}
          <div
            style={{
              position: 'absolute',
              left: '36px',
              bottom: '24px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 16px',
              alignItems: 'center',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'rgba(9, 13, 12, 0.85)',
              border: '1px solid var(--eco-border-subtle)',
              maxWidth: '300px',
            }}
          >
            <span className="lbl" style={{ fontSize: '10px' }}>Station network</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--eco-text-primary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--eco-teal)' }} />
              Complete
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--eco-text-primary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--eco-status-elevated)' }} />
              Insufficient coverage
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--eco-text-primary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--eco-status-muted)' }} />
              Stale (&gt;24h)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--eco-text-muted)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #5C6C64' }} />
              Unavailable
            </span>
          </div>
        </div>

        {/* Selected Station Intelligence Sidebar Panel */}
        <aside
          aria-label="Selected station intelligence"
          style={{
            flex: '1 1 340px',
            minWidth: '300px',
            borderLeft: '1px solid var(--eco-border-subtle)',
            background: 'rgba(11, 17, 15, 0.92)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="lbl">Station intelligence</span>
            <span
              className="chip"
              style={{
                color: !selectedLocation
                  ? 'var(--eco-text-muted)'
                  : isSensorStale
                    ? 'var(--eco-status-elevated)'
                    : 'var(--eco-teal)',
                borderColor: !selectedLocation
                  ? 'var(--eco-border-subtle)'
                  : isSensorStale
                    ? 'rgba(255, 180, 84, 0.4)'
                    : 'rgba(58, 214, 176, 0.4)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: !selectedLocation
                    ? 'var(--eco-text-muted)'
                    : isSensorStale
                      ? 'var(--eco-status-elevated)'
                      : 'var(--eco-teal)',
                }}
              />
              {freshnessBadgeLabel}
            </span>
          </div>

          <div>
            <div className="disp" style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-.015em', lineHeight: 1.2, color: 'var(--eco-text-primary)' }}>
              {selectedLocation ? selectedLocation.name : 'No Station Selected'}
            </div>
            <div style={{ color: 'var(--eco-text-secondary)', marginTop: '4px', fontSize: '13px' }}>
              {selectedLocation
                ? `${selectedLocation.locality || 'India'} · ${selectedLocation.country_name || 'India'}`
                : 'Select a monitoring station in Telemetry to inspect verified metadata'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 14px' }}>
            <div>
              <div className="lbl" style={{ fontSize: '9.5px' }}>Coordinates</div>
              <div className="mono" style={{ fontSize: '12px', color: 'var(--eco-text-primary)' }}>
                {selectedLocation?.coordinates
                  ? `${selectedLocation.coordinates.latitude.toFixed(2)}° Lat, ${selectedLocation.coordinates.longitude.toFixed(2)}° Lon`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '9.5px' }}>OpenAQ ID</div>
              <div className="mono" style={{ fontSize: '12px', color: 'var(--eco-text-primary)' }}>
                {selectedLocation ? `#${selectedLocation.id}` : '—'}
              </div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '9.5px' }}>Provider</div>
              <div style={{ fontSize: '12.5px', color: 'var(--eco-text-primary)' }}>
                {selectedLocation?.provider_name || '—'}
              </div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '9.5px' }}>Sensor Type</div>
              <div style={{ fontSize: '12.5px', color: 'var(--eco-text-primary)' }}>
                {selectedLocation ? (selectedLocation.is_monitor ? 'Reference Monitor' : 'CAAQMS Node') : '—'}
              </div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '9.5px' }}>Freshness</div>
              <div className="mono" style={{ fontSize: '12px', color: !selectedLocation ? 'var(--eco-text-muted)' : isSensorStale ? 'var(--eco-status-elevated)' : 'var(--eco-teal)' }}>
                {selectedLocation
                  ? (activeAssessment?.freshness_state
                      ? activeAssessment.freshness_state.charAt(0).toUpperCase() + activeAssessment.freshness_state.slice(1)
                      : isSensorStale
                        ? 'Lagging >24h'
                        : 'Fresh Observation')
                  : '—'}
              </div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '9.5px' }}>Completeness</div>
              <div className="mono" style={{ fontSize: '12px', color: activeAssessment?.is_completeness_satisfied ? 'var(--eco-teal)' : !selectedLocation ? 'var(--eco-text-muted)' : 'var(--eco-status-elevated)' }}>
                {activeAssessment
                  ? `${activeAssessment.completeness_percentage.toFixed(1)}% (${activeAssessment.valid_observations}/${activeAssessment.expected_observations}h)`
                  : selectedLocation && measurementsData
                    ? `${completenessPercentage.toFixed(1)}% (${validObsCount}/${expectedObservations}h)`
                    : '—'}
              </div>
            </div>
          </div>

          {/* Pollutant Fingerprint Spoke/Radar SVG */}
          <div
            style={{
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--eco-bg-card-subtle)',
              border: '1px solid var(--eco-border-subtle)',
            }}
          >
            <svg width="150" height="150" viewBox="-80 -80 160 160" role="img" aria-label="Pollutant fingerprint spoke diagram">
              <circle r="56" fill="none" stroke="var(--eco-border-subtle)" />
              <circle r="32" fill="none" stroke="var(--eco-border-subtle)" strokeDasharray="2 3" />
              {fingerprintSpokes.map((s, idx) => (
                <g key={idx}>
                  <line x1="0" y1="0" x2={s.ax} y2={s.ay} stroke="var(--eco-border-subtle)" />
                  {s.ratio !== null ? (
                    <>
                      <line x1="0" y1="0" x2={s.x} y2={s.y} stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx={s.x} cy={s.y} r="3" fill={s.complete ? s.color : 'var(--eco-bg-card-subtle)'} stroke={s.color} strokeWidth="1.5" />
                    </>
                  ) : (
                    <circle cx={s.x} cy={s.y} r="2.5" fill="var(--eco-bg-card-subtle)" stroke="var(--eco-border-strong)" strokeWidth="1" strokeDasharray="2 2" />
                  )}
                  <text
                    x={s.lx}
                    y={s.ly}
                    fill={s.ratio !== null ? 'var(--eco-text-primary)' : 'var(--eco-text-muted)'}
                    fontSize="8"
                    fontFamily="IBM Plex Mono"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {s.key}
                  </text>
                </g>
              ))}
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="lbl" style={{ fontSize: '9.5px', color: 'var(--eco-lime)' }}>
                Pollutant fingerprint
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--eco-text-secondary)', lineHeight: 1.4 }}>
                {activeAssessment && activeAssessment.ratio_to_standard !== null && activeAssessment.ratio_to_standard !== undefined
                  ? `Active ${activeParameterDisplay}: ${activeAssessment.ratio_to_standard.toFixed(2)}× CPCB benchmark. Dashed ring = 1.0×.`
                  : 'Spoke = governed mean ÷ CPCB benchmark. Dashed ring = 1.0×. Hollow node = unassessed.'}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('investigate')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Inspect Telemetry →
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('spatial')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Spatial Comparison →
            </button>
          </div>
        </aside>
      </section>

      {/* =========================================================================
          NETWORK FIGURES: 4 High-Impact KPI Cards
          ========================================================================= */}
      <section aria-label="Network figures" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        <div className="panel hov" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="lbl">Selected station context</span>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--eco-text-subtle)' }}>
              {selectedLocation?.provider_name || 'OpenAQ v3'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="disp" style={{ fontSize: '38px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--eco-text-primary)' }}>
              {selectedLocation ? '1' : '—'}
            </span>
            <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-muted)' }}>
              {selectedLocation ? 'selected station' : 'No station selected'}
            </span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', background: 'var(--eco-border-subtle)', overflow: 'hidden' }}>
            <div style={{ width: selectedLocation ? '100%' : '0%', height: '100%', background: 'var(--eco-teal)', borderRadius: '2px' }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--eco-text-muted)' }}>
            {selectedLocation
              ? `Monitoring ${selectedLocation.available_parameters.length} parameter${selectedLocation.available_parameters.length === 1 ? '' : 's'} at station #${selectedLocation.id}.`
              : 'Select a Continuous Ambient Air Quality Monitoring Station in Telemetry.'}
          </div>
        </div>

        <div className="panel hov" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="lbl">{`${averagingPeriodLabel} ${activeParameterDisplay} mean observation`}</span>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--eco-text-subtle)' }}>
              {cpcbThreshold !== null ? `CPCB Ref ${cpcbThreshold} ${cpcbUnit}` : 'CPCB Ref'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="disp" style={{ fontSize: '38px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: governedMean !== null ? 'var(--eco-status-elevated)' : 'var(--eco-text-muted)' }}>
              {governedMean !== null ? governedMean.toFixed(1) : '—'}
            </span>
            <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-muted)' }}>
              {governedMean !== null ? activeUnits : 'Unavailable'}
            </span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', background: 'var(--eco-border-subtle)', overflow: 'hidden' }}>
            <div
              style={{
                width: governedMean !== null && cpcbThreshold ? `${Math.min(100, Math.round((governedMean / cpcbThreshold) * 50))}%` : '0%',
                height: '100%',
                background: 'var(--eco-status-elevated)',
                borderRadius: '2px',
              }}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--eco-text-muted)' }}>
            {activeAssessment?.ratio_to_standard !== null && activeAssessment?.ratio_to_standard !== undefined && cpcbThreshold !== null
              ? `${activeAssessment.ratio_to_standard.toFixed(2)}× CPCB ${averagingPeriodLabel} standard (${cpcbThreshold} ${cpcbUnit})`
              : selectedLocation
                ? 'Governed mean unavailable (pending, incomplete, or stale window)'
                : 'Select a station to compute governed CPCB comparison'}
          </div>
        </div>

        <div className="panel hov" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="lbl">Data completeness gate</span>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--eco-text-subtle)' }}>
              {`${Math.ceil(expectedObservations * 0.75)}/${expectedObservations}h required`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="disp" style={{ fontSize: '38px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: selectedLocation && (measurementsData || activeAssessment) ? (isGateSatisfied ? 'var(--eco-teal)' : 'var(--eco-status-elevated)') : 'var(--eco-text-muted)' }}>
              {selectedLocation && (measurementsData || activeAssessment) ? `${completenessPercentage.toFixed(0)}%` : '—'}
            </span>
            <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-muted)' }}>
              {selectedLocation && (measurementsData || activeAssessment)
                ? (isGateSatisfied ? '✓ Satisfied' : '✗ Incomplete')
                : 'Pending'}
            </span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', background: 'var(--eco-border-subtle)', overflow: 'hidden' }}>
            <div
              style={{
                width: selectedLocation && (measurementsData || activeAssessment) ? `${Math.min(100, completenessPercentage)}%` : '0%',
                height: '100%',
                background: isGateSatisfied ? 'var(--eco-teal)' : 'var(--eco-status-elevated)',
                borderRadius: '2px',
              }}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--eco-text-muted)' }}>
            Zero synthetic zero-filling. Incomplete observation windows are marked indeterminate.
          </div>
        </div>

        <div className="panel hov" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="lbl">Statistical anomalies screened</span>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--eco-text-subtle)' }}>LOO M ≥ +3.5</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="disp" style={{ fontSize: '38px', fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--eco-text-muted)' }}>
              —
            </span>
            <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-muted)' }}>
              Not yet screened
            </span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', background: 'var(--eco-border-subtle)', overflow: 'hidden' }}>
            <div style={{ width: '0%', height: '100%', background: 'var(--eco-status-anomaly)', borderRadius: '2px' }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--eco-text-muted)' }}>
            Run Leave-one-out Jackknife MAD screening in Pollution Intelligence.
          </div>
        </div>
      </section>

      {/* =========================================================================
          POLLUTANT INTELLIGENCE STRIP: Timeline Chart & Quality Audit
          ========================================================================= */}
      <section aria-labelledby="pol-h" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <h2 id="pol-h" className="disp" style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--eco-text-primary)' }}>
            {`Pollutant Intelligence Strip · ${averagingPeriodLabel} Telemetry`}
          </h2>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--eco-text-muted)' }}>
            Observed hourly averages as published by providers
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'stretch' }}>
          {/* Main Chart Pane */}
          <div
            className="panel"
            style={{
              flex: '999 1 640px',
              minWidth: '320px',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div>
                <span className="lbl" style={{ fontSize: '10px' }}>
                  {selectedLocation
                    ? `Selected station · ${activeParameterDisplay}`
                    : 'Timeline Telemetry · Station Overview'}
                </span>
                <div className="disp" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--eco-text-primary)' }}>
                  {selectedLocation ? selectedLocation.name : 'No Station Selected'}
                </div>
              </div>
              {!isChartLoading && validObservations.length > 0 && (
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--eco-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '16px', height: '2px', background: 'var(--eco-teal)' }} />
                    Measured
                  </span>
                  {cpcbY !== null && cpcbThreshold !== null && (
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--eco-status-elevated)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '16px', borderTop: '1.5px dashed var(--eco-status-elevated)' }} />
                      {`CPCB ${averagingPeriodLabel} (${cpcbThreshold} ${cpcbUnit})`}
                    </span>
                  )}
                  {whoY !== null && whoThreshold !== null && (
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--eco-status-historical)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '16px', borderTop: '1.5px dashed var(--eco-status-historical)' }} />
                      {`WHO ${averagingPeriodLabel} (${whoThreshold} ${whoUnit})`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isChartLoading ? (
              /* Distinct Loading State */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '200px',
                  padding: '28px 16px',
                  background: 'var(--eco-bg-card-subtle)',
                  borderRadius: '8px',
                  border: '1px dashed var(--eco-border-subtle)',
                  textAlign: 'center',
                  gap: '10px',
                }}
                role="status"
                aria-live="polite"
              >
                <div className="pulse" style={{ fontSize: '28px', opacity: 0.85 }} aria-hidden="true">⏳</div>
                <div style={{ color: 'var(--eco-text-primary)', fontSize: '14.5px', fontWeight: 600 }}>
                  Loading verified observations…
                </div>
                <p style={{ color: 'var(--eco-text-secondary)', fontSize: '12px', maxWidth: '420px', margin: 0, lineHeight: 1.5 }}>
                  Querying OpenAQ v3 hourly telemetry for {selectedLocation?.name || 'selected station'}.
                </p>
              </div>
            ) : validObservations.length > 0 ? (
              /* Verified Real Observation SVG Area & Line Chart */
              <div style={{ position: 'relative' }}>
                <svg
                  viewBox="0 0 860 220"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  role="img"
                  aria-label={`${averagingPeriodLabel} observation time-series chart for ${selectedLocation?.name || 'selected station'}`}
                >
                  <defs>
                    <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--eco-teal)" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="var(--eco-teal)" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines & Value Labels */}
                  {gridLevels.map((g, idx) => (
                    <g key={idx}>
                      <line x1={chartPadLeft} x2={860 - chartPadRight} y1={g.y} y2={g.y} stroke="var(--eco-border-subtle)" />
                      <text
                        x={chartPadLeft - 8}
                        y={g.y}
                        fill="var(--eco-text-subtle)"
                        fontSize="10"
                        fontFamily="IBM Plex Mono"
                        textAnchor="end"
                        dominantBaseline="middle"
                      >
                        {g.val}
                      </text>
                    </g>
                  ))}

                  {/* CPCB Regulatory Threshold Line */}
                  {cpcbY !== null && cpcbThreshold !== null && (
                    <g>
                      <line
                        x1={chartPadLeft}
                        x2={860 - chartPadRight}
                        y1={cpcbY}
                        y2={cpcbY}
                        stroke="var(--eco-status-elevated)"
                        strokeDasharray="5 5"
                        strokeOpacity="0.8"
                      />
                      <text
                        x={chartPadLeft - 8}
                        y={cpcbY}
                        fill="var(--eco-status-elevated)"
                        fontSize="10"
                        fontFamily="IBM Plex Mono"
                        textAnchor="end"
                        dominantBaseline="middle"
                      >
                        {cpcbThreshold}
                      </text>
                    </g>
                  )}

                  {/* WHO Guideline Threshold Line */}
                  {whoY !== null && whoThreshold !== null && (
                    <g>
                      <line
                        x1={chartPadLeft}
                        x2={860 - chartPadRight}
                        y1={whoY}
                        y2={whoY}
                        stroke="var(--eco-status-historical)"
                        strokeDasharray="5 5"
                        strokeOpacity="0.7"
                      />
                      <text
                        x={chartPadLeft - 8}
                        y={whoY}
                        fill="var(--eco-status-historical)"
                        fontSize="10"
                        fontFamily="IBM Plex Mono"
                        textAnchor="end"
                        dominantBaseline="middle"
                      >
                        {whoThreshold}
                      </text>
                    </g>
                  )}

                  {/* Real Continuous Observation Segments (Gaps Uninterpolated) */}
                  {chartSegments.map((seg, sIdx) => (
                    <g key={sIdx}>
                      <path d={seg.areaPath} fill="url(#areaG)" />
                      <path
                        className="draw"
                        d={seg.linePath}
                        fill="none"
                        stroke="var(--eco-teal)"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </g>
                  ))}

                  {/* Observation Points */}
                  {chartPoints.map((pt, pIdx) => (
                    <circle
                      key={pIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill="var(--eco-bg-card-subtle)"
                      stroke="var(--eco-teal)"
                      strokeWidth="1.5"
                    >
                      <title>{`${pt.value} ${pt.units} (${pt.timeLabel})`}</title>
                    </circle>
                  ))}

                  {/* Time Axis Ticks */}
                  {chartTicks.map((tick, tIdx) => (
                    <text
                      key={tIdx}
                      x={tick.xPos}
                      y={220 - 12}
                      fill="var(--eco-text-subtle)"
                      fontSize="10"
                      fontFamily="IBM Plex Mono"
                      textAnchor="middle"
                    >
                      {tick.label}
                    </text>
                  ))}
                </svg>
              </div>
            ) : (
              /* Explicit Scientific Empty State (No Fabricated Data) */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '200px',
                  padding: '28px 16px',
                  background: 'var(--eco-bg-card-subtle)',
                  borderRadius: '8px',
                  border: '1px dashed var(--eco-border-subtle)',
                  textAlign: 'center',
                  gap: '10px',
                }}
                role="status"
              >
                <div style={{ fontSize: '28px', opacity: 0.75 }} aria-hidden="true">📊</div>
                <div style={{ color: 'var(--eco-text-primary)', fontSize: '14.5px', fontWeight: 600 }}>
                  No verified observations available
                </div>
                <p style={{ color: 'var(--eco-text-secondary)', fontSize: '12px', maxWidth: '420px', margin: 0, lineHeight: 1.5 }}>
                  {selectedLocation
                    ? `No observation records were reported for "${selectedLocation.name}" in this measurement window.`
                    : 'Select an active monitoring station in Station Telemetry to load verified atmospheric observations.'}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onNavigate('investigate')}
                  style={{
                    marginTop: '4px',
                    fontSize: '12px',
                    padding: '6px 14px',
                    color: 'var(--eco-teal)',
                    borderColor: 'var(--eco-teal-border)',
                  }}
                >
                  {selectedLocation ? 'Inspect Station in Telemetry →' : 'Select Station in Telemetry →'}
                </button>
              </div>
            )}

            {/* Bottom Metadata & Completeness Status */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '12px', color: 'var(--eco-text-muted)' }} className="mono">
              {selectedLocation && (measurementsData || activeAssessment) ? (
                <>
                  <span>valid <span style={{ color: 'var(--eco-text-primary)' }}>{validObsCount}</span>/{expectedObservations} h</span>
                  <span>missing <span style={{ color: 'var(--eco-text-primary)' }}>{missingCount}</span></span>
                  <span>{`${averagingPeriodLabel} mean`} <span style={{ color: governedMean !== null ? 'var(--eco-status-historical)' : 'var(--eco-text-subtle)' }}>{governedMean !== null ? `${governedMean.toFixed(1)} ${activeUnits}` : 'Unavailable'}</span></span>
                  <span>gate {validObsCount}/{expectedObservations} → <span style={{ color: isGateSatisfied ? 'var(--eco-teal)' : 'var(--eco-status-elevated)' }}>{isGateSatisfied ? 'Passed (≥75%)' : 'Incomplete (<75%)'}</span></span>
                </>
              ) : (
                <>
                  <span>valid <span style={{ color: 'var(--eco-text-primary)' }}>0</span>/— h</span>
                  <span>missing <span style={{ color: 'var(--eco-text-primary)' }}>—</span></span>
                  <span>{`${averagingPeriodLabel} mean`} <span style={{ color: 'var(--eco-text-subtle)' }}>—</span></span>
                  <span>gate <span style={{ color: 'var(--eco-text-subtle)' }}>Pending station selection</span></span>
                </>
              )}
            </div>
          </div>

          {/* Evidence Quality Audit Panel */}
          <div
            className="panel"
            style={{
              flex: '1 1 320px',
              minWidth: '280px',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <div className="lbl" style={{ fontSize: '10.5px' }}>Evidence quality · Station audit bounds</div>
              <h3 className="disp" style={{ margin: '2px 0 0', fontSize: '19px', fontWeight: 600, color: 'var(--eco-text-primary)' }}>
                {selectedLocation ? 'Active Station Quality Audit' : 'Quality Governance Criteria'}
              </h3>
            </div>

            <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', gap: '2px', background: 'var(--eco-bg-card-subtle)' }}>
              {selectedLocation && (measurementsData || activeAssessment) ? (
                <div
                  title={`Completeness ${completenessPercentage.toFixed(1)}%`}
                  style={{
                    width: `${Math.min(100, completenessPercentage)}%`,
                    background: isGateSatisfied ? 'var(--eco-teal)' : 'var(--eco-status-elevated)',
                    transition: 'width 0.3s ease',
                  }}
                />
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto', gap: '10px', alignItems: 'start' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedLocation && isGateSatisfied ? 'var(--eco-teal)' : 'var(--eco-border-strong)', marginTop: '4px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--eco-text-primary)' }}>Completeness coverage</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--eco-text-muted)' }}>
                    {`≥${Math.ceil(expectedObservations * 0.75)} of ${expectedObservations} hourly readings required (75% gate)`}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-primary)' }}>
                  {selectedLocation && (measurementsData || activeAssessment) ? `${validObsCount}/${expectedObservations}` : '—'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto', gap: '10px', alignItems: 'start' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedLocation && missingCount > 0 ? 'var(--eco-status-elevated)' : 'var(--eco-border-strong)', marginTop: '4px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--eco-text-primary)' }}>Missing intervals</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--eco-text-muted)' }}>Never interpolated or zero-filled</div>
                </div>
                <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-primary)' }}>
                  {selectedLocation && (measurementsData || activeAssessment) ? `${missingCount}` : '—'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto', gap: '10px', alignItems: 'start' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedLocation && isSensorStale ? 'var(--eco-status-muted)' : 'var(--eco-teal)', marginTop: '4px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--eco-text-primary)' }}>Sensor freshness</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--eco-text-muted)' }}>Evaluated at target pollutant sensor level</div>
                </div>
                <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-primary)' }}>
                  {selectedLocation ? (isSensorStale ? 'Stale' : 'Fresh') : '—'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto', gap: '10px', alignItems: 'start' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #5C6C64', marginTop: '4px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--eco-text-primary)' }}>Excluded artifacts</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--eco-text-muted)' }}>Negative or invalid readings quarantined</div>
                </div>
                <span className="mono" style={{ fontSize: '13px', color: 'var(--eco-text-primary)' }}>
                  {selectedLocation && (measurementsData || activeAssessment)
                    ? `${activeAssessment?.excluded_observations ?? measurementsData?.excluded_observations ?? 0}`
                    : '—'}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 'auto',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--eco-bg-card-subtle)',
                border: '1px solid var(--eco-border-subtle)',
                fontSize: '11.5px',
                color: 'var(--eco-text-secondary)',
              }}
            >
              Status is derived per sensor from <span className="mono" style={{ color: 'var(--eco-text-primary)' }}>freshness_state</span> and the 75% completeness gate on the active {averagingPeriodLabel} window.
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          WHAT THE NETWORK IS TELLING US: Qualified Evidence Findings
          ========================================================================= */}
      <section
        aria-labelledby="net-h"
        className="panel"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          background: 'linear-gradient(180deg, var(--eco-bg-card), var(--eco-bg-card-subtle))',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <div className="lbl" style={{ color: 'var(--eco-lime)', letterSpacing: '.16em' }}>
              Qualified findings
            </div>
            <h2 id="net-h" className="disp" style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 600, letterSpacing: '-.02em', color: 'var(--eco-text-primary)' }}>
              {activeAssessment ? `ACTIVE STATION ASSESSMENT · ${selectedLocation?.name?.toUpperCase()}` : 'EVIDENCE QUALIFICATION FRAMEWORK'}
            </h2>
          </div>
          <div className="mono" style={{ fontSize: '11.5px', color: 'var(--eco-text-muted)', maxWidth: '420px', textAlign: 'right' }}>
            Evidence from physical observations across certified stations. Each finding links directly to its audit trail.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <article className="panel hov" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ color: 'var(--eco-status-elevated)', fontSize: '11px', fontWeight: 600 }}>◇ STATISTICAL ANOMALY</span>
              <span className="mono" style={{ fontSize: '10.5px', color: 'var(--eco-text-subtle)' }}>
                {selectedLocation ? `${selectedLocation.name} · Screening` : 'LOO Jackknife MAD'}
              </span>
            </div>
            <div className="disp" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--eco-text-primary)', lineHeight: 1.3 }}>
              Outlier &amp; Flatline Screening
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--eco-text-secondary)', lineHeight: 1.5, flex: 1 }}>
              {selectedLocation
                ? `Run Leave-one-out Jackknife MAD screening on ${selectedLocation.name} (${activeParameterDisplay}) in Pollution Intelligence to identify statistical spikes or sensor flatlines.`
                : 'Leave-one-out Jackknife Median Absolute Deviation (MAD) screens hourly series for isolated departures (M_i ≥ +3.5) and constant sensor flatlines.'}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('anomalies')}
              style={{ alignSelf: 'flex-start', marginTop: '6px' }}
            >
              Screen Anomalies →
            </button>
          </article>

          <article className="panel hov" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ color: 'var(--eco-teal)', fontSize: '11px', fontWeight: 600 }}>● MEASURED OBSERVATION</span>
              <span className="mono" style={{ fontSize: '10.5px', color: 'var(--eco-text-subtle)' }}>
                {activeAssessment ? `${activeAssessment.status_label}` : 'Awaiting Assessment'}
              </span>
            </div>
            <div className="disp" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--eco-text-primary)', lineHeight: 1.3 }}>
              {activeAssessment ? `${activeParameterDisplay} ${averagingPeriodLabel} Screening` : 'Spatial & Baseline Coincidence'}
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--eco-text-secondary)', lineHeight: 1.5, flex: 1 }}>
              {activeAssessment
                ? (governedMean !== null
                    ? `Verified ${averagingPeriodLabel} mean is ${governedMean.toFixed(1)} ${activeUnits} (${activeAssessment.ratio_to_standard !== null && activeAssessment.ratio_to_standard !== undefined ? `${activeAssessment.ratio_to_standard.toFixed(2)}× CPCB standard` : 'CPCB benchmark'}). ${activeAssessment.freshness_message}`
                    : `${activeAssessment.status_label}: ${activeAssessment.freshness_message} (${activeAssessment.valid_observations}/${activeAssessment.expected_observations} valid readings).`)
                : 'Spatial neighbor screening compares coincident monitors within configurable Haversine radii to distinguish regional stagnation from localized station departures.'}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('spatial')}
              style={{ alignSelf: 'flex-start', marginTop: '6px' }}
            >
              Compare Neighbors →
            </button>
          </article>

          <article className="panel hov" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ color: 'var(--eco-lime)', fontSize: '11px', fontWeight: 600 }}>▨ MODELED ABATEMENT</span>
              <span className="mono" style={{ fontSize: '10.5px', color: 'var(--eco-text-subtle)' }}>CSIR-CRRI · EPA AP-42</span>
            </div>
            <div className="disp" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--eco-text-primary)', lineHeight: 1.3 }}>
              Engineering Mitigation Protocol
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--eco-text-secondary)', lineHeight: 1.5, flex: 1 }}>
              {activeAssessment && activeAssessment.advisories.length > 0
                ? `${activeAssessment.advisories[0].category}: ${activeAssessment.advisories[0].action}`
                : 'Generate site-specific five-part mitigation dossiers and engineering abatement estimates in Environmental Action Plan using verified station inputs.'}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('reports')}
              style={{ alignSelf: 'flex-start', marginTop: '6px' }}
            >
              Open Action Dossier →
            </button>
          </article>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', paddingTop: '12px', borderTop: '1px solid var(--eco-border-subtle)', fontSize: '11.5px', color: 'var(--eco-text-muted)' }}>
          <span className="mono" style={{ color: 'var(--eco-teal)' }}>● Measured — physical observation</span>
          <span className="mono" style={{ color: 'var(--eco-status-historical)' }}>◇ Statistical — computed from observations</span>
          <span className="mono" style={{ color: 'var(--eco-lime)' }}>▨ Modeled — engineering estimate, never an ambient reading</span>
          <span style={{ marginLeft: 'auto' }}>Screening support only — a benchmark exceedance is not a statutory violation.</span>
        </div>
      </section>

      {/* =========================================================================
          ACTIVE STATION CONTEXT / DISCOVERY CARD (Required by Tests)
          ========================================================================= */}
      {selectedLocation ? (
        <div
          className="panel"
          style={{
            padding: '20px',
            borderColor: isSensorStale ? 'rgba(255, 180, 84, 0.4)' : 'rgba(58, 214, 176, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
            <div>
              <div className="station-badges" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span className="chip" style={{ color: 'var(--eco-teal)', borderColor: 'rgba(58, 214, 176, 0.4)' }}>
                  {selectedLocation.is_monitor ? 'Reference Monitor' : 'Sensor Node'}
                </span>
                <span className="chip">Station #{selectedLocation.id}</span>
                {isSensorStale ? (
                  <span className="chip" style={{ color: 'var(--eco-status-elevated)', borderColor: 'rgba(255, 180, 84, 0.4)' }}>
                    ⚠ Stale Data (&gt;24h)
                  </span>
                ) : (
                  <span className="chip" style={{ color: 'var(--eco-teal)', borderColor: 'rgba(58, 214, 176, 0.4)' }}>
                    {freshnessBadgeLabel}
                  </span>
                )}
              </div>
              <h3 className="card-title disp" style={{ marginTop: '0.5rem', fontSize: '1.25rem', color: 'var(--eco-text-primary)', fontWeight: 600 }}>
                Active Station: {selectedLocation.name}
              </h3>
              <p style={{ margin: '0.25rem 0', color: 'var(--eco-text-secondary)', fontSize: '0.9rem' }}>
                Locality: <strong>{selectedLocation.locality || 'India'}</strong> · Provider:{' '}
                <strong>{selectedLocation.provider_name}</strong>
                {selectedLocation.coordinates && (
                  <span className="mono" style={{ marginLeft: '0.5rem', color: 'var(--eco-text-primary)' }}>
                    ({selectedLocation.coordinates.latitude.toFixed(4)}°N,{' '}
                    {selectedLocation.coordinates.longitude.toFixed(4)}°E)
                  </span>
                )}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => onNavigate('investigate')}>
                Inspect Telemetry →
              </button>
              <button type="button" className="btn" onClick={() => onNavigate('spatial')}>
                Spatial Comparison →
              </button>
            </div>
          </div>

          <div
            className="empty-state-meta-box"
            style={{
              width: '100%',
              marginTop: '0.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--eco-bg-card-subtle)',
              border: '1px solid var(--eco-border-subtle)',
            }}
          >
            <div className="meta-item">
              <span className="meta-label lbl" style={{ fontSize: '9.5px' }}>Monitored Pollutant</span>
              <span className="meta-val mono" style={{ fontSize: '13px', color: 'var(--eco-text-primary)' }}>
                {activeParameterDisplay}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label lbl" style={{ fontSize: '9.5px' }}>Returned Observations</span>
              <span className="meta-val mono" style={{ fontSize: '13px', color: 'var(--eco-text-primary)' }}>
                {measurementsData ? `${measurementsData.total_observations} points` : '—'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label lbl" style={{ fontSize: '9.5px' }}>Completeness Gate</span>
              <span className="meta-val mono" style={{ fontSize: '13px', color: activeAssessment?.is_completeness_satisfied ? 'var(--eco-teal)' : 'var(--eco-text-muted)' }}>
                {activeAssessment
                  ? `${activeAssessment.is_completeness_satisfied ? '✓ Satisfied' : '✗ Incomplete'} (${activeAssessment.completeness_percentage.toFixed(1)}%)`
                  : measurementsData
                    ? `${isGateSatisfied ? '✓ Satisfied' : '✗ Incomplete'} (${completenessPercentage.toFixed(1)}%)`
                    : '—'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label lbl" style={{ fontSize: '9.5px' }}>Screening Finding</span>
              <span className="meta-val mono" style={{ fontSize: '13px', color: governedMean !== null ? 'var(--eco-status-elevated)' : 'var(--eco-text-muted)' }}>
                {activeAssessment
                  ? `${activeAssessment.status_label}${governedMean !== null ? ` (${governedMean.toFixed(1)} ${activeAssessment.units})` : ' (Unavailable)'}`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: '20px', borderColor: 'rgba(58, 214, 176, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 className="card-title disp" style={{ fontSize: '1.15rem', color: 'var(--eco-text-primary)', fontWeight: 600 }}>
                Verified Indian Monitoring Network
              </h3>
              <p style={{ margin: '0.25rem 0', color: 'var(--eco-text-secondary)', fontSize: '0.9rem' }}>
                Connect to certified CAAQMS stations across Delhi NCR, Mumbai MMR, Bengaluru, Kolkata, Chennai, and Hyderabad.
                Select a station to launch time-series investigation, spatial neighbor discovery, and anomaly screening.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('investigate')}
              style={{ background: 'var(--eco-teal)', color: 'var(--eco-bg-canvas)', fontWeight: 600, borderColor: 'var(--eco-teal)' }}
            >
              Discover &amp; Select Stations →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          UPSTREAM PROVIDER CONNECTIVITY: OpenAQ v3 Status
          ========================================================================= */}
      <div className="panel" style={{ padding: '20px' }}>
        <h3 className="card-title disp" style={{ color: 'var(--eco-text-primary)', fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>
          Upstream Data Provider: OpenAQ API v3 (India)
        </h3>
        <p style={{ color: 'var(--eco-text-secondary)', fontSize: '13.5px', marginBottom: '14px' }}>
          EcoSentinel interfaces directly with the OpenAQ v3 programmatic platform to ingest real-time and
          historical observations from certified monitoring bodies across India (including CPCB, DPCC, and MPCB).
        </p>

        <div
          className="empty-state-meta-box"
          style={{
            width: '100%',
            marginBottom: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'var(--eco-bg-card-subtle)',
            border: '1px solid var(--eco-border-subtle)',
          }}
        >
          <div className="meta-item">
            <span className="meta-label lbl" style={{ fontSize: '9.5px' }}>Provider Name</span>
            <span className="meta-val mono" style={{ fontSize: '13px', color: 'var(--eco-text-primary)' }}>
              {providerStatus?.provider || 'OpenAQ v3'}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label lbl" style={{ fontSize: '9.5px' }}>API Key Configured</span>
            <span className="meta-val mono" style={{ fontSize: '13px', color: providerStatus?.is_configured ? 'var(--eco-teal)' : 'var(--eco-status-elevated)' }}>
              {isLoading
                ? 'Checking...'
                : providerStatus?.is_configured
                  ? '✓ Active'
                  : '⚠ Unconfigured (Missing Key)'}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label lbl" style={{ fontSize: '9.5px' }}>Provider Reachability</span>
            <span className="meta-val mono" style={{ fontSize: '13px', color: providerStatus?.is_reachable ? 'var(--eco-teal)' : 'var(--eco-status-anomaly)' }}>
              {isLoading
                ? 'Testing connection...'
                : providerStatus?.is_reachable
                  ? '✓ Reachable (HTTPS 200/401)'
                  : '✕ Unreachable'}
            </span>
          </div>
        </div>

        {!isLoading && !providerStatus?.is_configured && (
          <div
            className="notice-banner"
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(255, 180, 84, 0.1)',
              border: '1px solid rgba(255, 180, 84, 0.3)',
              color: 'var(--eco-text-primary)',
              fontSize: '13px',
            }}
          >
            <strong>Configuration Guidance:</strong> To query live Indian stations, sign up for a free OpenAQ
            key at{' '}
            <a
              href="https://explore.openaq.org/register"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
              style={{ color: 'var(--eco-lime)', textDecoration: 'underline' }}
            >
              explore.openaq.org/register ↗
            </a>{' '}
            and place it in your <code>.env</code> file under <code>OPENAQ_API_KEY</code>.
          </div>
        )}
      </div>

      {/* =========================================================================
          PLATFORM CAPABILITIES & ACTION NAVIGATION GRID (Required by Tests)
          ========================================================================= */}
      <section aria-label="Platform capabilities" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="disp" style={{ margin: 0, fontSize: '22px', fontWeight: 600, color: 'var(--eco-text-primary)' }}>
            Environmental Intelligence Overview
          </h2>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--eco-text-muted)' }}>
            5 Core Platform Capabilities
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {/* Capability 1: Station Telemetry */}
          <div className="panel hov" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title disp" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--eco-text-primary)', marginBottom: '8px' }}>
              Station Telemetry &amp; Time-Series
            </h3>
            <p style={{ flex: 1, color: 'var(--eco-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Query certified Indian monitoring stations, choose target pollutants (PM2.5, PM10, NO₂, O₃, CO, SO₂),
              and inspect actual hourly observations in interactive SVG time-series charts and paginated data tables.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('investigate')}
              style={{ marginTop: '1rem', alignSelf: 'flex-start', background: 'var(--eco-teal)', color: 'var(--eco-bg-canvas)', fontWeight: 600, borderColor: 'var(--eco-teal)' }}
            >
              Launch Investigation →
            </button>
          </div>

          {/* Capability 2: Pollution Intelligence & Anomaly Screening */}
          <div className="panel hov" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title disp" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--eco-text-primary)', marginBottom: '8px' }}>
              Pollution Intelligence &amp; Anomalies
            </h3>
            <p style={{ flex: 1, color: 'var(--eco-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Detect statistical spikes and sensor flatlines using robust Median Absolute Deviation (MAD) and Modified
              Z-scores ($M_i \ge +3.5$), calibrated against sensor precision limits without fragile mean-based distortion.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('anomalies')}
              style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
            >
              Screen Anomalies →
            </button>
          </div>

          {/* Capability 3: Spatial Analysis & Neighborhood Screening */}
          <div className="panel hov" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title disp" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--eco-text-primary)', marginBottom: '8px' }}>
              Spatial Comparison &amp; Neighbors
            </h3>
            <p style={{ flex: 1, color: 'var(--eco-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Compare up to 5 coincident stations within configurable Haversine radii (5–50 km). Inspect spatial dispersion
              on an interactive SVG map and classify concurrent regional events vs. localized station anomalies.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('spatial')}
              style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
            >
              Compare Neighbors →
            </button>
          </div>

          {/* Capability 4: Evidence & Data Quality */}
          <div className="panel hov" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title disp" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--eco-text-primary)', marginBottom: '8px' }}>
              Evidence &amp; Provenance Audit
            </h3>
            <p style={{ flex: 1, color: 'var(--eco-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Verify the 75% data completeness gate (18/24h), audit excluded negative measurement artifacts, inspect
              sensor freshness state, and export verified datasets with full source attribution.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('evidence')}
              style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
            >
              Audit Evidence →
            </button>
          </div>

          {/* Capability 5: Environmental Action Plan & Reports */}
          <div className="panel hov" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title disp" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--eco-text-primary)', marginBottom: '8px' }}>
              Facility Action Plan &amp; Reports
            </h3>
            <p style={{ flex: 1, color: 'var(--eco-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Generate structured Five-Part Action Dossiers for EHS supervisors with verified anti-idling protocols,
              dust mitigation benchmarks, and canonical engineering abatement calculations (CSIR-CRRI &amp; US EPA).
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('reports')}
              style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
            >
              Generate Action Dossier →
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SCIENTIFIC INTEGRITY PRINCIPLE BANNER
          ========================================================================= */}
      <div
        className="panel"
        style={{
          padding: '16px 20px',
          background: 'rgba(16, 25, 22, 0.6)',
          borderColor: 'var(--eco-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--eco-teal)', fontWeight: 600, fontSize: '13.5px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Scientific Integrity &amp; Zero-Fabrication Principle
        </div>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--eco-text-secondary)', lineHeight: 1.5 }}>
          EcoSentinel displays only genuine environmental observations retrieved from verified station sensors.
          No synthetic metrics are substituted on errors or empty query windows. High concentration values or
          statistical deviations do not constitute proof of pollution causes or legal violations.
        </p>
      </div>
    </article>
  );
};
