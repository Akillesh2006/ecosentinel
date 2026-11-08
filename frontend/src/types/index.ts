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

export type SectionId = 'overview' | 'investigate' | 'anomalies' | 'spatial' | 'evidence' | 'reports';

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
  excluded_observations?: number;
  data_quality_warnings?: string[];
  measurements: MeasurementPoint[];
}

export interface AirQualityApiError {
  error: string;
  message: string;
  error_code: string;
  instructions?: string | null;
}

export type TimeRangePreset = '24h' | '7d' | '30d';

export type AssessmentStatus =
  | 'below_reference'
  | 'above_reference'
  | 'insufficient_data'
  | 'stale_data'
  | 'historical_data'
  | 'unsupported_parameter'
  | 'unavailable';

export type FreshnessState = 'fresh' | 'stale' | 'historical' | 'unavailable';

export interface MitigationAdvisory {
  category: string;
  action: string;
  rationale: string;
  uncertainty: string;
}

export interface RiskAssessmentResponse {
  location_id: number;
  station_name: string;
  locality?: string | null;
  sensor_id?: number | null;
  parameter: string;
  parameter_display_name: string;
  units: string;

  calculation_timestamp_utc: string;
  calculation_timestamp_local?: string | null;
  window_start_utc: string;
  window_end_utc: string;
  window_start_local?: string | null;
  window_end_local?: string | null;
  averaging_period_hours: number;
  averaging_period_label: string;

  valid_observations: number;
  expected_observations: number;
  missing_observations: number;
  excluded_observations: number;
  completeness_percentage: number;
  is_completeness_satisfied: boolean;
  completeness_rule_label: string;
  data_quality_warnings: string[];

  calculated_average?: number | null;

  sensor_datetime_last_utc?: string | null;
  sensor_datetime_last_local?: string | null;
  freshness_state: FreshnessState;
  freshness_message: string;

  standard_name?: string | null;
  standard_threshold?: number | null;
  standard_unit?: string | null;
  standard_url?: string | null;
  secondary_benchmark_name?: string | null;
  secondary_benchmark_threshold?: number | null;
  secondary_benchmark_unit?: string | null;
  secondary_benchmark_url?: string | null;
  secondary_benchmark_notes?: string | null;

  status: AssessmentStatus;
  status_label: string;
  ratio_to_standard?: number | null;

  screening_limitations: string;
  regulatory_disclaimer: string;
  spatial_disclaimer: string;
  advisories: MitigationAdvisory[];
}

export interface EmissionFactorMetadata {
  metric: string;
  factor_value: number;
  unit: string;
  provenance: string;
  source_title: string;
  source_url?: string | null;
  notes?: string | null;
}

export interface DustControlGuidance {
  control_efficiency_range: string;
  control_efficiency_scope: string;
  mass_avoided_notice: string;
  supportive_controls: string[];
  supportive_controls_note: string;
}

export interface IdlingAbatementResponse {
  vehicles: number;
  hours: number;
  total_vehicle_hours: number;
  avoided_fuel_liters: number;
  avoided_co2_kg: number;
  avoided_nox_kg: number;
  avoided_nox_grams: number;
  avoided_pm25_grams: number;
  factors: EmissionFactorMetadata[];
  dust_guidance: DustControlGuidance;
  assumptions: string[];
  fleet_technology_caveat: string;
  atmospheric_boundary_caveat: string;
  statutory_disclaimer: string;
}

export type AnomalyWindowPreset = '24h' | '7d';

export type CoverageState = 'SATISFIED' | 'INSUFFICIENT_COVERAGE';

export type ScaleState =
  | 'VALID'
  | 'INDETERMINATE_ZERO_MAD'
  | 'INDETERMINATE_INSUFFICIENT_DISPERSION';

export type FlatlineStatus =
  | 'NORMAL_DISPERSION'
  | 'SUSPECTED_FLATLINE'
  | 'INVARIABLE_MINIMUM';

export type PrecisionProvenance =
  | 'AUTHORITATIVE_METADATA'
  | 'CALLER_SUPPLIED'
  | 'UNKNOWN';

export type AnomalyClassification =
  | 'STATISTICAL_SPIKE'
  | 'STATISTICAL_DROP'
  | 'MODERATE_ELEVATION'
  | 'NORMAL';

export interface BaselineMetrics {
  evaluation_method: string;
  median?: number | null;
  mad?: number | null;
  nmad?: number | null;
  q1?: number | null;
  q3?: number | null;
  iqr?: number | null;
  scale_state: ScaleState;
  explanation?: string | null;
}

export interface AnomalyObservationPoint {
  datetime_utc: string;
  datetime_local?: string | null;
  observed_value: number;
  independent_median?: number | null;
  independent_mad?: number | null;
  independent_nmad?: number | null;
  modified_z_score?: number | null;
  is_anomaly: boolean;
  anomaly_type?: AnomalyClassification | string | null;
  scale_state: ScaleState;
  is_cpcb_exceedance: boolean;
  step_change_from_prior?: number | null;
  is_heuristic_step_surge: boolean;
  rate_of_change_status?: 'EVALUATED' | 'NOT_EVALUATED' | string | null;
  rate_of_change_note?: string | null;
  consecutive_elevated_hours: number;
  suspected_flatline: boolean;
  flatline_label?: string | null;
}

export interface AnomalySummary {
  total_anomalies_detected: number;
  total_spikes: number;
  total_moderate_elevations: number;
  total_step_surges: number;
  total_sustained_episodes: number;
  max_modified_z?: number | null;
  flatline_indicator: FlatlineStatus;
  flatline_message?: string | null;
  evaluation_suppressed: boolean;
  scale_indeterminate: boolean;
  reason?: string | null;
}

export interface AirQualityAnomalyResponse {
  location_id: number;
  station_name: string;
  locality?: string | null;
  provider_name?: string | null;
  parameter: string;
  parameter_display_name: string;
  units: string;
  sensor_id?: number | null;
  sensor_precision?: number | null;
  precision_provenance: PrecisionProvenance | string;
  window_preset: AnomalyWindowPreset | string;
  window_start_utc: string;
  window_end_utc: string;
  window_start_local?: string | null;
  window_end_local?: string | null;
  expected_observations: number;
  valid_observations: number;
  completeness_percentage: number;
  is_coverage_satisfied: boolean;
  coverage_state: CoverageState;
  freshness_state: 'FRESH' | 'DELAYED' | 'STALE' | 'HISTORICAL' | string;
  freshness_message?: string | null;
  sensor_datetime_last_utc?: string | null;
  sensor_datetime_last_local?: string | null;
  baseline_metrics?: BaselineMetrics | null;
  summary: AnomalySummary;
  data_quality_warnings: string[];
  attribution_disclaimer: string;
  observations: AnomalyObservationPoint[];
}

export interface NeighborStationSummary {
  id: number;
  name: string;
  locality?: string | null;
  country_code: string;
  provider_name: string;
  owner_name?: string | null;
  coordinates: Coordinates;
  distance_km: number;
  available_parameters: string[];
  sensor_id?: number | null;
  datetime_last_utc?: string | null;
  datetime_last_local?: string | null;
  is_stale: boolean;
}

export interface SpatialNeighborsResponse {
  reference_station_id: number;
  reference_station_name: string;
  reference_coordinates: Coordinates;
  reference_provider_name: string;
  reference_owner_name?: string | null;
  parameter: string;
  parameter_display_name: string;
  radius_km: number;
  candidates_examined_count: number;
  eligible_neighbors_count: number;
  missing_coordinates_count: number;
  pollutant_incompatible_count: number;
  outside_radius_count: number;
  self_excluded_count: number;
  neighbors: NeighborStationSummary[];
  spatial_disclaimer: string;
}

export interface SpatialComparisonRequest {
  reference_location_id: number;
  neighbor_location_ids: number[];
  parameter: string;
  date_from?: string | null;
  date_to?: string | null;
  window_preset?: string | null;
}

export interface StationComparisonMetadata {
  location_id: number;
  station_name: string;
  locality?: string | null;
  provider_name: string;
  owner_name?: string | null;
  is_reference: boolean;
  distance_from_reference_km?: number | null;
  coordinates?: Coordinates | null;
  sensor_id: number;
  units: string;
  total_valid_observations: number;
  expected_observations: number;
  station_coverage_percentage?: number | null;
  coverage_percentage?: number | null;
  coincident_with_reference_hours: number;
  pairwise_overlap_coverage_percentage?: number | null;
  coincident_coverage_percentage?: number | null;
  conditional_reference_coverage_percentage?: number | null;
  min_correlation_samples_threshold: number;
  pearson_correlation_with_reference?: number | null;
  correlation_status: 'CALCULATED' | 'INSUFFICIENT_COINCIDENT_DATA' | 'ZERO_VARIANCE_CONSTANT_SERIES' | 'REFERENCE_STATION' | string;
  is_stale: boolean;
  sensor_datetime_last_utc?: string | null;
  sensor_datetime_last_local?: string | null;
}

export type SpatialScreeningClassification =
  | 'MULTI_STATION_CONCURRENT_ELEVATION'
  | 'STATION_LOCALIZED_ELEVATION'
  | 'NEIGHBOR_ELEVATION_ONLY'
  | 'BASELINE_CONSISTENT'
  | 'INSUFFICIENT_SPATIAL_EVIDENCE';

export type SpatialScreeningStatus =
  | 'EVALUATED'
  | 'EVALUATION_SUPPRESSED_UNSUPPORTED_WINDOW'
  | 'EVALUATION_SUPPRESSED_REFERENCE_INSUFFICIENT_COVERAGE'
  | 'EVALUATION_SUPPRESSED_REFERENCE_ZERO_MAD'
  | 'EVALUATION_SUPPRESSED_NO_ELIGIBLE_NEIGHBORS';

export interface HourlyStationExclusion {
  location_id: number;
  station_name: string;
  reason_code: string;
  message: string;
}

export interface WindowStationExclusion {
  location_id: number;
  station_name: string;
  reason_code: string;
  message: string;
}

export interface HourlyNeighborhoodScreening {
  datetime_utc: string;
  datetime_local?: string | null;
  classification: SpatialScreeningClassification;
  subclassification: string;
  reference_station_id: number;
  reference_modified_z?: number | null;
  is_reference_elevated: boolean;
  is_reference_spike: boolean;
  reference_eligibility: string;
  neighbors_reporting_count: number;
  neighbors_window_eligible_count: number;
  neighbors_comparable_count: number;
  elevated_neighbors_count: number;
  contributing_neighbor_ids: number[];
  elevated_neighbor_ids: number[];
  timestamp_exclusions: HourlyStationExclusion[];
  evidence_statement: string;
}

export interface NeighborhoodScreeningSummary {
  evaluation_status: SpatialScreeningStatus;
  suppression_reason?: string | null;
  window_preset?: string | null;
  total_window_hours: number;
  evaluable_hours_count: number;
  concurrent_elevation_hours_count: number;
  station_localized_elevation_hours_count: number;
  neighbor_only_elevation_hours_count: number;
  baseline_consistent_hours_count: number;
  insufficient_evidence_hours_count: number;
  evaluable_percentage_of_window?: number | null;
  concurrent_elevation_percentage_of_evaluable?: number | null;
  station_localized_percentage_of_evaluable?: number | null;
  neighbor_only_percentage_of_evaluable?: number | null;
  baseline_consistent_percentage_of_evaluable?: number | null;
  window_exclusions: WindowStationExclusion[];
  screening_disclaimer: string;
}

export interface ComparisonTimeSlice {
  datetime_utc: string;
  datetime_local?: string | null;
  station_values: Record<string | number, number | null>;
  contributing_stations: number;
  neighborhood_median?: number | null;
  neighborhood_min?: number | null;
  neighborhood_max?: number | null;
  neighborhood_iqr?: number | null;
  screening?: HourlyNeighborhoodScreening | null;
}

export interface StationPartialFailure {
  location_id: number;
  error_code: string;
  message: string;
}

export interface SpatialComparisonResponse {
  parameter: string;
  parameter_display_name: string;
  units: string;
  requested_from_utc: string;
  requested_to_utc: string;
  reference_station_id: number;
  total_stations_requested: number;
  total_valid_stations: number;
  partial_failures: StationPartialFailure[];
  all_stations_coincident_hours: number;
  all_stations_coincident_coverage_percentage?: number | null;
  mixed_providers: boolean;
  stations: StationComparisonMetadata[];
  time_slices: ComparisonTimeSlice[];
  neighborhood_screening_summary?: NeighborhoodScreeningSummary | null;
  spatial_disclaimer: string;
  data_quality_warnings: string[];
}
