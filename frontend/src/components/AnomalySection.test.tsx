import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnomalySection } from './AnomalySection';
import * as api from '../services/api';
import type { AirQualityAnomalyResponse, LocationSummary } from '../types';

const mockLocations: LocationSummary[] = [
  {
    id: 3060,
    name: 'Anand Vihar, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'OpenAQ v3',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25', 'pm10', 'no2'],
    is_stale: false,
  },
  {
    id: 3061,
    name: 'ITO, Delhi - CPCB',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'OpenAQ v3',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25', 'pm10'],
    is_stale: false,
  },
];

const mock24hSuccessResponse: AirQualityAnomalyResponse = {
  location_id: 3060,
  station_name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  provider_name: 'OpenAQ v3',
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  sensor_id: 101,
  sensor_precision: 0.1,
  precision_provenance: 'AUTHORITATIVE_METADATA',
  window_preset: '24h',
  window_start_utc: '2026-10-31T12:00:00Z',
  window_end_utc: '2026-11-01T12:00:00Z',
  window_start_local: '2026-10-31 17:30:00 IST',
  window_end_local: '2026-11-01 17:30:00 IST',
  expected_observations: 24,
  valid_observations: 24,
  completeness_percentage: 100.0,
  is_coverage_satisfied: true,
  coverage_state: 'SATISFIED',
  freshness_state: 'FRESH',
  freshness_message: 'Telemetry active within last 2 hours',
  baseline_metrics: {
    evaluation_method: 'JACKKNIFE_LEAVE_ONE_OUT',
    median: 45.0,
    mad: 6.0,
    nmad: 8.9,
    q1: 40.0,
    q3: 52.0,
    iqr: 12.0,
    scale_state: 'VALID',
    explanation: null,
  },
  summary: {
    total_anomalies_detected: 2,
    total_spikes: 1,
    total_moderate_elevations: 1,
    total_step_surges: 1,
    total_sustained_episodes: 1,
    max_modified_z: 4.8,
    flatline_indicator: 'NORMAL_DISPERSION',
    flatline_message: 'Normal variance verified across baseline window',
    evaluation_suppressed: false,
    scale_indeterminate: false,
    reason: null,
  },
  data_quality_warnings: [],
  attribution_disclaimer:
    'Statistical anomaly detection identifies abnormal concentration variance relative to baseline observations. It does not establish emission sources, industrial culpability, atmospheric transport mechanisms, or direct health outcomes.',
  observations: [
    {
      datetime_utc: '2026-10-31T12:00:00Z',
      datetime_local: '2026-10-31 17:30:00 IST',
      observed_value: 42.0,
      independent_median: 45.2,
      independent_mad: 5.9,
      independent_nmad: 8.75,
      modified_z_score: -0.37,
      is_anomaly: false,
      anomaly_type: 'NORMAL',
      scale_state: 'VALID',
      is_cpcb_exceedance: false,
      step_change_from_prior: null,
      is_heuristic_step_surge: false,
      rate_of_change_status: 'NOT_EVALUATED',
      rate_of_change_note: 'No prior observation available at series boundary.',
      consecutive_elevated_hours: 0,
      suspected_flatline: false,
      flatline_label: null,
    },
    {
      datetime_utc: '2026-10-31T13:00:00Z',
      datetime_local: '2026-10-31 18:30:00 IST',
      observed_value: 44.0,
      independent_median: 45.1,
      independent_mad: 6.0,
      independent_nmad: 8.9,
      modified_z_score: -0.12,
      is_anomaly: false,
      anomaly_type: 'NORMAL',
      scale_state: 'VALID',
      is_cpcb_exceedance: false,
      step_change_from_prior: 2.0,
      is_heuristic_step_surge: false,
      rate_of_change_status: 'EVALUATED',
      rate_of_change_note: null,
      consecutive_elevated_hours: 0,
      suspected_flatline: false,
      flatline_label: null,
    },
    {
      datetime_utc: '2026-10-31T14:00:00Z',
      datetime_local: '2026-10-31 19:30:00 IST',
      observed_value: 72.0,
      independent_median: 44.5,
      independent_mad: 5.8,
      independent_nmad: 8.6,
      modified_z_score: 3.2,
      is_anomaly: false,
      anomaly_type: 'MODERATE_ELEVATION',
      scale_state: 'VALID',
      is_cpcb_exceedance: true,
      step_change_from_prior: 28.0,
      is_heuristic_step_surge: true,
      rate_of_change_status: 'EVALUATED',
      rate_of_change_note: null,
      consecutive_elevated_hours: 1,
      suspected_flatline: false,
      flatline_label: null,
    },
    {
      datetime_utc: '2026-10-31T15:00:00Z',
      datetime_local: '2026-10-31 20:30:00 IST',
      observed_value: 88.0,
      independent_median: 44.0,
      independent_mad: 5.5,
      independent_nmad: 8.15,
      modified_z_score: 5.4,
      is_anomaly: true,
      anomaly_type: 'STATISTICAL_SPIKE',
      scale_state: 'VALID',
      is_cpcb_exceedance: true,
      step_change_from_prior: 16.0,
      is_heuristic_step_surge: false,
      rate_of_change_status: 'EVALUATED',
      rate_of_change_note: null,
      consecutive_elevated_hours: 2,
      suspected_flatline: false,
      flatline_label: null,
    },
    {
      datetime_utc: '2026-10-31T16:00:00Z',
      datetime_local: '2026-10-31 21:30:00 IST',
      observed_value: 12.0,
      independent_median: 45.0,
      independent_mad: 6.0,
      independent_nmad: 8.9,
      modified_z_score: -3.7,
      is_anomaly: true,
      anomaly_type: 'STATISTICAL_DROP',
      scale_state: 'VALID',
      is_cpcb_exceedance: false,
      step_change_from_prior: -76.0,
      is_heuristic_step_surge: true,
      rate_of_change_status: 'EVALUATED',
      rate_of_change_note: null,
      consecutive_elevated_hours: 0,
      suspected_flatline: false,
      flatline_label: null,
    },
  ],
};

const mockInsufficientCoverageResponse: AirQualityAnomalyResponse = {
  ...mock24hSuccessResponse,
  valid_observations: 10,
  expected_observations: 24,
  completeness_percentage: 41.7,
  is_coverage_satisfied: false,
  coverage_state: 'INSUFFICIENT_COVERAGE',
  baseline_metrics: null,
  summary: {
    total_anomalies_detected: 0,
    total_spikes: 0,
    total_moderate_elevations: 0,
    total_step_surges: 0,
    total_sustained_episodes: 0,
    max_modified_z: null,
    flatline_indicator: 'NORMAL_DISPERSION',
    flatline_message: null,
    evaluation_suppressed: true,
    scale_indeterminate: false,
    reason: 'Insufficient coverage: 10 valid hourly observations found (expected 24, min 18 required / 75%).',
  },
  observations: [],
};

const mockZeroMadResponse: AirQualityAnomalyResponse = {
  ...mock24hSuccessResponse,
  baseline_metrics: {
    evaluation_method: 'JACKKNIFE_LEAVE_ONE_OUT',
    median: 25.0,
    mad: 0.0,
    nmad: 0.0,
    q1: 25.0,
    q3: 25.0,
    iqr: 0.0,
    scale_state: 'INDETERMINATE_ZERO_MAD',
    explanation: 'At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0).',
  },
  summary: {
    total_anomalies_detected: 0,
    total_spikes: 0,
    total_moderate_elevations: 0,
    total_step_surges: 0,
    total_sustained_episodes: 0,
    max_modified_z: null,
    flatline_indicator: 'SUSPECTED_FLATLINE',
    flatline_message: 'Repeated invariant concentrations observed across consecutive hours.',
    evaluation_suppressed: false,
    scale_indeterminate: true,
    reason: 'Zero-MAD detected: Modified Z-score indeterminate.',
  },
  observations: [
    {
      datetime_utc: '2026-10-31T12:00:00Z',
      datetime_local: '2026-10-31 17:30:00 IST',
      observed_value: 25.0,
      independent_median: 25.0,
      independent_mad: 0.0,
      independent_nmad: 0.0,
      modified_z_score: null,
      is_anomaly: false,
      anomaly_type: 'NORMAL',
      scale_state: 'INDETERMINATE_ZERO_MAD',
      is_cpcb_exceedance: false,
      step_change_from_prior: 0.0,
      is_heuristic_step_surge: false,
      rate_of_change_status: 'NOT_EVALUATED',
      rate_of_change_note: 'Rate of change screening not evaluated: dispersion of differences is zero.',
      consecutive_elevated_hours: 0,
      suspected_flatline: true,
      flatline_label: 'Suspected Sensor Flatline',
    },
  ],
};

const mockCallerPrecisionResponse: AirQualityAnomalyResponse = {
  ...mock24hSuccessResponse,
  sensor_precision: 0.05,
  precision_provenance: 'CALLER_SUPPLIED',
};

describe('AnomalySection Component (Milestone 6 Phase D)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'fetchLocations').mockResolvedValue({
      data: mockLocations,
      error: null,
    });
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: mock24hSuccessResponse,
      error: null,
    });
  });

  it('renders 24-hour screening dashboard with KPI summary cards', async () => {
    render(<AnomalySection />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Pollution Intelligence & Anomaly Detection/i })
      ).toBeInTheDocument();
    });

    // Check KPI Cards
    await waitFor(() => {
      expect(screen.getByText(/Data Completeness & Gate/i)).toBeInTheDocument();
      expect(screen.getByText(/100%/i)).toBeInTheDocument();
      expect(screen.getByText(/Statistical Anomalies \(\|M\| ≥ 3.5\)/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Spikes • 1 Drops/i)).toBeInTheDocument();
      expect(screen.getByText(/Moderate Deviations \(2.5 ≤ \|M\| < 3.5\)/i)).toBeInTheDocument();
      expect(screen.getByText('Rate-of-Change Surges')).toBeInTheDocument();
      expect(screen.getByText(/Sustained Episodes \(≥ 3h\)/i)).toBeInTheDocument();
    });

    // Verify Station and Pollutant Controls
    expect(screen.getByLabelText(/Monitoring Station/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Pollutant/i)).toBeInTheDocument();
  });

  it('toggles evaluation window between 24-hour and 7-day intervals', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: {
        ...mock24hSuccessResponse,
        window_preset: '7d',
        expected_observations: 168,
        valid_observations: 150,
        completeness_percentage: 89.3,
      },
      error: null,
    });

    render(<AnomalySection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /7-Day \(126\/168 min\)/i })).toBeInTheDocument();
    });

    // Click 7-Day button
    fireEvent.click(screen.getByRole('button', { name: /7-Day \(126\/168 min\)/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        3060,
        'pm25',
        '7d',
        undefined,
        undefined,
        expect.any(Object)
      );
    });

    // Verify 7-day minimum coverage guidance is visible
    expect(
      screen.getByText(/Complete historical evaluation: 168h interval \(requires ≥126 hourly observations \/ 75%\)/i)
    ).toBeInTheDocument();
  });

  it('renders prominent warning and suppresses evaluation when coverage is insufficient', async () => {
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: mockInsufficientCoverageResponse,
      error: null,
    });

    render(<AnomalySection />);

    await waitFor(() => {
      expect(
        screen.getByText(/Statistical Evaluation Suppressed: Insufficient Coverage/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Retrieved 10 of 24 expected hourly observations \(41.7%\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A minimum of 75% coverage \(18 observations\) is required to construct a valid baseline/i)
    ).toBeInTheDocument();
  });

  it('renders scientifically accurate Zero-MAD explanation when baseline dispersion is zero', async () => {
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: mockZeroMadResponse,
      error: null,
    });

    render(<AnomalySection />);

    await waitFor(() => {
      expect(screen.getByText(/Scale Indeterminate \(Zero-MAD Baseline\)/i)).toBeInTheDocument();
    });

    // Check exact approved scientific wording:
    // "At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0)."
    expect(
      screen.getAllByText(
        /At least 50% of baseline observations have zero absolute deviation from the median \(MAD = 0\)/i
      ).length
    ).toBeGreaterThan(0);
  });

  it('visually decouples statutory CPCB standard exceedance from statistical anomaly', async () => {
    render(<AnomalySection />);

    await waitFor(() => {
      expect(screen.getByText(/PM2.5 Concentration Timeline & Anomaly Markers/i)).toBeInTheDocument();
    });

    // In mock data:
    // Observation at 14:00 (value 72.0) has is_cpcb_exceedance: true, but anomaly_type: MODERATE_ELEVATION (not spike)
    // Observation at 15:00 (value 88.0) has is_cpcb_exceedance: true AND anomaly_type: STATISTICAL_SPIKE
    // Observation at 16:00 (value 12.0) has is_cpcb_exceedance: false BUT anomaly_type: STATISTICAL_DROP (drop anomaly below baseline!)
    // Check decoupling disclaimer in the evidence panel
    expect(
      screen.getByText(/Statistical anomaly screening evaluates relative deviation from baseline variance, which operates independently from statutory regulatory standards/i)
    ).toBeInTheDocument();
  });

  it('displays rate-of-change screening status and note when not evaluated', async () => {
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: mockZeroMadResponse,
      error: null,
    });

    render(<AnomalySection />);

    await waitFor(() => {
      expect(
        screen.getByText(/Rate of change screening not evaluated: dispersion of differences is zero/i)
      ).toBeInTheDocument();
    });
  });

  it('labels caller-supplied precision threshold explicitly and warns about non-authoritative provenance', async () => {
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: mockCallerPrecisionResponse,
      error: null,
    });

    render(<AnomalySection />);

    await waitFor(() => {
      expect(screen.getAllByText('CALLER_SUPPLIED').length).toBeGreaterThan(0);
    });

    expect(
      screen.getByText(/Caller-supplied precision threshold is active for exploratory testing; not verified sensor metadata/i)
    ).toBeInTheDocument();
  });

  it('displays cautious wording when sensor precision is unknown', async () => {
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: {
        ...mock24hSuccessResponse,
        sensor_precision: null,
        precision_provenance: 'UNKNOWN',
      },
      error: null,
    });

    render(<AnomalySection />);

    await waitFor(() => {
      expect(screen.getAllByText('UNKNOWN').length).toBeGreaterThan(0);
    });

    expect(
      screen.getByText(
        /Sensor resolution is unknown. Invariance screening is cautious and does not diagnose physical hardware failure/i
      )
    ).toBeInTheDocument();
  });

  it('selects an observation and displays leave-one-out metrics in the evidence panel', async () => {
    render(<AnomalySection />);

    await waitFor(() => {
      expect(screen.getByText(/PM2.5 Concentration Timeline & Anomaly Markers/i)).toBeInTheDocument();
    });

    // Verify legend distinguishes positive spike from negative drop
    expect(screen.getByText(/Spike \(M ≥ \+3.5\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Drop \(M ≤ -3.5\)/i)).toBeInTheDocument();

    // Click on the 14:00 observation in the notable events table (72.0 µg/m³)
    const eventRow = screen.getByText('72 µg/m³');
    fireEvent.click(eventRow);

    await waitFor(() => {
      expect(screen.getByText('+3.20 M')).toBeInTheDocument();
      expect(screen.getByText('44.5 µg/m³')).toBeInTheDocument(); // Independent leave-one-out median
      expect(screen.getByText('8.60 µg/m³')).toBeInTheDocument(); // Independent leave-one-out NMAD
      expect(screen.getByText('Provisional Step Surge Detected')).toBeInTheDocument();
      expect(screen.getByText(/Absolute threshold: \|M\| ≥ 3.5/i)).toBeInTheDocument();
      expect(screen.getByText(/Signed Formulation:/i)).toBeInTheDocument();
      expect(screen.getByText(/M = \(xᵢ - x̃₋ᵢ\) \/ NMAD₋ᵢ/i)).toBeInTheDocument();
    });
  });

  it('always renders the mandatory permanent attribution and limitations disclaimer', async () => {
    render(<AnomalySection />);

    await waitFor(() => {
      expect(screen.getByText(/Attribution & Limitations Notice/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /Statistical anomaly detection identifies abnormal concentration variance relative to baseline observations. It does not establish emission sources, industrial culpability, atmospheric transport mechanisms, or direct health outcomes./i
      )
    ).toBeInTheDocument();
  });

  it('synchronizes parameter when activeParameter prop changes', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: {
        ...mock24hSuccessResponse,
        parameter: 'pm10',
        parameter_display_name: 'PM10',
      },
      error: null,
    });

    const { rerender } = render(<AnomalySection activeParameter="pm25" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(3060, 'pm25', '24h', undefined, undefined, expect.any(Object));
    });

    // Rerender with activeParameter="pm10"
    rerender(<AnomalySection activeParameter="pm10" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(3060, 'pm10', '24h', undefined, undefined, expect.any(Object));
    });
  });

  it('notifies parent application when station is switched via dropdown', async () => {
    const handleSelectLocation = vi.fn();
    vi.spyOn(api, 'fetchLocationDetail').mockResolvedValue({
      data: {
        id: 3061,
        name: 'ITO, Delhi - CPCB',
        country_code: 'IN',
        country_name: 'India',
        provider_name: 'OpenAQ v3',
        is_monitor: true,
        is_mobile: false,
        available_parameters: ['pm25', 'pm10'],
        is_stale: false,
        instruments: [],
        licenses: [],
        sensors: [],
      },
      error: null,
    });

    render(<AnomalySection onSelectLocation={handleSelectLocation} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Monitoring Station/i)).toBeInTheDocument();
    });

    // Select second station (3061)
    const select = screen.getByLabelText(/Monitoring Station/i);
    fireEvent.change(select, { target: { value: '3061' } });

    await waitFor(() => {
      expect(handleSelectLocation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 3061, name: 'ITO, Delhi - CPCB' })
      );
    });
  });
});
