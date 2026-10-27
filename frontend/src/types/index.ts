/**
 * Type definitions for EcoSentinel Frontend.
 */

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  timestamp: string;
  environment: string;
  milestone: string;
}

export interface HealthState {
  isLoading: boolean;
  data: HealthResponse | null;
  error: string | null;
  latencyMs: number | null;
  lastChecked: string | null;
}

export type SectionId = 'overview' | 'investigate' | 'evidence' | 'reports';

export interface NavSection {
  id: SectionId;
  label: string;
  shortDescription: string;
  statusBadge: string;
  statusType: 'active' | 'pending';
}

export interface ProviderStatusResponse {
  provider: string;
  is_configured: boolean;
  is_reachable: boolean;
  base_url: string;
  message: string;
  key_instructions: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationSummary {
  id: number;
  name: string;
  locality?: string | null;
  country_code: string;
  country_name: string;
  provider_name: string;
  owner_name?: string | null;
  is_monitor: boolean;
  is_mobile: boolean;
  coordinates?: Coordinates | null;
  available_parameters: string[];
  datetime_last_utc?: string | null;
  datetime_last_local?: string | null;
  is_stale: boolean;
}

export interface SensorDetail {
  id: number;
  name: string;
  parameter_id: number;
  parameter_name: string;
  parameter_display_name: string;
  units: string;
  datetime_first_utc?: string | null;
  datetime_first_local?: string | null;
  datetime_last_utc?: string | null;
  datetime_last_local?: string | null;
}

export interface LocationDetail extends LocationSummary {
  timezone?: string | null;
  instruments: string[];
  licenses: Array<{ id?: number; name?: string; attribution?: { name?: string; url?: string | null } }>;
  datetime_first_utc?: string | null;
  sensors: SensorDetail[];
}

export interface MeasurementPoint {
  value: number;
  parameter: string;
  units: string;
  period_label: string;
  interval?: string | null;
  datetime_from_utc: string;
  datetime_to_utc: string;
  datetime_from_local?: string | null;
  datetime_to_local?: string | null;
  is_missing: boolean;
  percent_complete?: number | null;
}

export interface LocationMeasurementsResponse {
  location_id: number;
  station_name: string;
  locality?: string | null;
  provider_name: string;
  parameter: string;
  parameter_display_name: string;
  units: string;
  sensor_id: number;
  sensor_datetime_last_utc?: string | null;
  sensor_datetime_last_local?: string | null;
  requested_from_utc: string;
  requested_to_utc: string;
  retrieved_at_utc: string;
  total_observations: number;
  expected_observations?: number | null;
  missing_percentage?: number | null;
  is_stale: boolean;
  stale_message?: string | null;
  data_integrity_notice: string;
  measurements: MeasurementPoint[];
}

export interface AirQualityApiError {
  error: string;
  message: string;
  error_code: string;
  instructions?: string | null;
}

export type TimeRangePreset = '24h' | '7d' | '30d';
