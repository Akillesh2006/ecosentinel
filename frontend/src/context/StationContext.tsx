import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  LocationSummary,
  RiskAssessmentResponse,
  TimeRangePreset,
} from '../types';

export interface CustomRangeState {
  from: string;
  to: string;
  label: string;
}

interface StationContextValue {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  locationsCatalog: LocationSummary[];
  setLocationsCatalog: React.Dispatch<React.SetStateAction<LocationSummary[]>>;
  hasLoadedCatalog: boolean;
  setHasLoadedCatalog: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLocation: LocationDetail | null;
  setSelectedLocation: React.Dispatch<React.SetStateAction<LocationDetail | null>>;
  selectedParameter: string;
  setSelectedParameter: React.Dispatch<React.SetStateAction<string>>;
  timeRange: TimeRangePreset;
  setTimeRange: React.Dispatch<React.SetStateAction<TimeRangePreset>>;
  customRange: CustomRangeState | null;
  setCustomRange: React.Dispatch<React.SetStateAction<CustomRangeState | null>>;
  measurementsData: LocationMeasurementsResponse | null;
  setMeasurementsData: React.Dispatch<React.SetStateAction<LocationMeasurementsResponse | null>>;
  assessmentData: RiskAssessmentResponse | null;
  setAssessmentData: React.Dispatch<React.SetStateAction<RiskAssessmentResponse | null>>;
  isMeasurementsLoading: boolean;
  setIsMeasurementsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  loadedKey: string | null;
  setLoadedKey: React.Dispatch<React.SetStateAction<string | null>>;
  loadedAssessKey: string | null;
  setLoadedAssessKey: React.Dispatch<React.SetStateAction<string | null>>;
  selectStationByDetail: (detail: LocationDetail | null, preferredParam?: string) => void;
}

const StationContext = createContext<StationContextValue | undefined>(undefined);

/**
 * Shared state provider keeping selected station, catalog cache, time window,
 * measurements, and risk assessment synchronized across React Router routes.
 */
export const StationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationsCatalog, setLocationsCatalog] = useState<LocationSummary[]>([]);
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationDetail | null>(null);
  const [selectedParameter, setSelectedParameter] = useState<string>('pm25');
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('24h');
  const [customRange, setCustomRange] = useState<CustomRangeState | null>(null);
  const [measurementsData, setMeasurementsData] = useState<LocationMeasurementsResponse | null>(null);
  const [assessmentData, setAssessmentData] = useState<RiskAssessmentResponse | null>(null);
  const [isMeasurementsLoading, setIsMeasurementsLoading] = useState<boolean>(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadedAssessKey, setLoadedAssessKey] = useState<string | null>(null);

  const selectStationByDetail = useCallback((detail: LocationDetail | null, preferredParam?: string) => {
    setSelectedLocation(detail);
    if (!detail) return;
    const avail = detail.available_parameters || [];
    if (avail.length > 0) {
      const target = preferredParam || 'pm25';
      const exactMatch = avail.find((p) => p.toLowerCase() === target.toLowerCase());
      if (exactMatch) {
        setSelectedParameter(exactMatch);
      } else {
        const pm25 = avail.find((p) => p.toLowerCase() === 'pm25' || p.toLowerCase() === 'pm2.5');
        setSelectedParameter(pm25 || avail[0]);
      }
    }
    if (detail.is_stale) {
      setTimeRange((prev) => (prev === '24h' ? '7d' : prev));
    }
  }, []);

  return (
    <StationContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        locationsCatalog,
        setLocationsCatalog,
        hasLoadedCatalog,
        setHasLoadedCatalog,
        selectedLocation,
        setSelectedLocation,
        selectedParameter,
        setSelectedParameter,
        timeRange,
        setTimeRange,
        customRange,
        setCustomRange,
        measurementsData,
        setMeasurementsData,
        assessmentData,
        setAssessmentData,
        isMeasurementsLoading,
        setIsMeasurementsLoading,
        loadedKey,
        setLoadedKey,
        loadedAssessKey,
        setLoadedAssessKey,
        selectStationByDetail,
      }}
    >
      {children}
    </StationContext.Provider>
  );
};

export function useStationContext(): StationContextValue | undefined {
  return useContext(StationContext);
}
