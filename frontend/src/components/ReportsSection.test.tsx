import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportsSection } from './ReportsSection';
import * as api from '../services/api';
import type {
  IdlingAbatementResponse,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../types';

const mockLocation: LocationDetail = {
  id: 8118,
  name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  country_code: 'IN',
  country_name: 'India',
  provider_name: 'CPCB',
  owner_name: 'Delhi Pollution Control Committee',
  is_monitor: true,
  is_mobile: false,
  coordinates: { latitude: 28.6508, longitude: 77.3152 },
  available_parameters: ['pm25'],
  datetime_last_utc: '2026-10-28T12:00:00Z',
  datetime_last_local: '2026-10-28 17:30:00 IST',
  is_stale: false,
  timezone: 'Asia/Kolkata',
  instruments: ['Beta Attenuation Monitor BAM-1020'],
  licenses: [],
  sensors: [],
};

const mockMeasurements: LocationMeasurementsResponse = {
  location_id: 8118,
  station_name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  provider_name: 'CPCB',
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  sensor_id: 101,
  sensor_datetime_last_utc: '2026-10-28T11:45:00Z',
  sensor_datetime_last_local: '2026-10-28 17:15:00 IST',
  requested_from_utc: '2026-10-27T12:00:00Z',
  requested_to_utc: '2026-10-28T12:00:00Z',
  retrieved_at_utc: '2026-10-28T12:05:00Z',
  total_observations: 24,
  expected_observations: 24,
  missing_percentage: 0.0,
  is_stale: false,
  data_integrity_notice: 'Concentration measurements reflect physical observations.',
  excluded_observations: 1,
  data_quality_warnings: ['Excluded 1 invalid negative concentration measurement(s)'],
  measurements: [
    {
      value: 110.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-27T12:00:00Z',
      datetime_to_utc: '2026-10-27T13:00:00Z',
      is_missing: false,
      percent_complete: 100.0,
    },
    {
      value: 120.8,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-27T13:00:00Z',
      datetime_to_utc: '2026-10-27T14:00:00Z',
      is_missing: false,
      percent_complete: 100.0,
    },
  ],
};

const mockAssessmentFreshAbove: RiskAssessmentResponse = {
  location_id: 8118,
  station_name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  sensor_id: 101,
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  calculation_timestamp_utc: '2026-10-28T12:05:00Z',
  window_start_utc: '2026-10-27T12:00:00Z',
  window_end_utc: '2026-10-28T12:00:00Z',
  window_start_local: '2026-10-27 17:30:00 IST',
  window_end_local: '2026-10-28 17:30:00 IST',
  averaging_period_hours: 24,
  averaging_period_label: '24-hour standard',
  valid_observations: 22,
  expected_observations: 24,
  missing_observations: 2,
  excluded_observations: 1,
  completeness_percentage: 91.7,
  is_completeness_satisfied: true,
  completeness_rule_label: 'EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)',
  data_quality_warnings: [],
  calculated_average: 115.4,
  sensor_datetime_last_utc: '2026-10-28T11:45:00Z',
  sensor_datetime_last_local: '2026-10-28 17:15:00 IST',
  freshness_state: 'fresh',
  freshness_message: 'Sensor observation is current within 24 hours.',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: 60.0,
  standard_unit: 'µg/m³',
  standard_url: 'https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf',
  secondary_benchmark_name: 'WHO Air Quality Guidelines (2021)',
  secondary_benchmark_threshold: 15.0,
  secondary_benchmark_unit: 'µg/m³',
  secondary_benchmark_url: 'https://www.who.int/publications/i/item/9789240034228',
  status: 'above_reference',
  status_label: 'Above reference level',
  ratio_to_standard: 1.92,
  screening_limitations: 'Station sensor rolling average exceeds statutory CPCB 24-hour limit.',
  regulatory_disclaimer:
    'Operational screening result only: does not constitute a formal regulatory compliance determination under CPCB rules.',
  spatial_disclaimer:
    'Spatial representativeness limitation: observations represent physical conditions at this specific monitoring station.',
  advisories: [
    {
      category: 'Fleet & Logistics',
      action: 'Enforce anti-idling protocols at vehicle staging bays.',
      rationale: 'Heavy diesel idling concentrates fine combustion particulates.',
      uncertainty: 'Single roadside monitor cannot verify source attribution.',
    },
  ],
};

const mockAbatementCanonicalResponse: IdlingAbatementResponse = {
  vehicles: 10,
  hours: 2,
  total_vehicle_hours: 20.0,
  avoided_fuel_liters: 20.0,
  avoided_co2_kg: 53.6,
  avoided_nox_kg: 0.676,
  avoided_nox_grams: 676.0,
  avoided_pm25_grams: 22.0,
  factors: [
    {
      metric: 'Fuel Consumption',
      factor_value: 1.0,
      unit: 'L/vehicle-hour',
      provenance: 'CRRI empirical truck-idling measurements; conservative planning value.',
      source_title: 'Assessment of idling fuel consumption and emissions of vehicles at signalized intersections in Delhi',
      source_url: 'https://crridom.gov.in',
    },
    {
      metric: 'Carbon Dioxide (CO2)',
      factor_value: 2.68,
      unit: 'kg/vehicle-hour',
      provenance: 'Derived using diesel carbon stoichiometry and IPCC methodology.',
      source_title: '2006 IPCC Guidelines for National Greenhouse Gas Inventories, Vol 2: Energy, Ch 3: Mobile Combustion',
    },
    {
      metric: 'Nitrogen Oxides (NOx)',
      factor_value: 33.8,
      unit: 'g/vehicle-hour',
      provenance: 'US EPA EPA420-F-08-025 model factor. NOT an in-use Indian tailpipe measurement.',
      source_title: 'Idling Vehicle Emissions for Passenger Cars, Light-Duty Trucks, and Heavy-Duty Trucks',
    },
    {
      metric: 'Fine Particulate Matter (PM2.5)',
      factor_value: 1.1,
      unit: 'g/vehicle-hour',
      provenance: 'US EPA EPA420-F-08-025 model factor. NOT an in-use Indian tailpipe measurement.',
      source_title: 'Idling Vehicle Emissions for Passenger Cars, Light-Duty Trucks, and Heavy-Duty Trucks',
    },
  ],
  dust_guidance: {
    control_efficiency_range: '50%–70%',
    control_efficiency_scope:
      'Applies strictly to unpaved-road surface watering maintaining approximately twice baseline surface moisture under US EPA AP-42 §13.2.2 conditions.',
    mass_avoided_notice: 'PM10 mass avoided is N/A: calculating mass avoided requires site-specific data.',
    supportive_controls: ['Treated wastewater dampening'],
    supportive_controls_note: 'Supportive controls represent procedural good practices.',
  },
  assumptions: ['Hot-stabilized curb-idle assumption'],
  fleet_technology_caveat: 'Factors do not apply equally across all BS standards.',
  atmospheric_boundary_caveat: 'Localized source curtailment does not predict reduction at distant monitors.',
  statutory_disclaimer:
    'Engineering estimate only: represents an operational planning tool and does NOT constitute a statutory compliance certificate under the Air (Prevention and Control of Pollution) Act, 1981.',
};

describe('ReportsSection & EnvironmentalActionPlan Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'fetchAbatementEstimate').mockResolvedValue({
      data: mockAbatementCanonicalResponse,
      error: null,
    });
  });

  it('renders descriptive statistical profile and active dossier when measurements are loaded', () => {
    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText(/Client-Side Summary Dossier/i)).toBeInTheDocument();
    expect(screen.getByText('Anand Vihar, Delhi - DPCC')).toBeInTheDocument();
    expect(screen.getByText(/Observed Range \(Min - Max\)/i)).toBeInTheDocument();
    expect(screen.getByText('110.00 – 120.80')).toBeInTheDocument();
    expect(screen.getByText(/Milestone 2A Scope:/i)).toBeInTheDocument();
  });

  it('renders canonical backend abatement estimates when inputs are valid', async () => {
    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(api.fetchAbatementEstimate).toHaveBeenCalledWith(10, 2, expect.any(Object));
      expect(screen.getByText('20.00 L')).toBeInTheDocument();
      expect(screen.getByText('53.60 kg')).toBeInTheDocument();
      expect(screen.getByText('676.0 g')).toBeInTheDocument();
      expect(screen.getByText('22.00 g')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/CSIR-CRRI/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/IPCC balance/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/US EPA model/i).length).toBeGreaterThanOrEqual(1);
  });

  it('rejects out-of-range vehicle count and displays error without calling API or silently clamping', async () => {
    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    const vehicleInput = screen.getByLabelText(/Eligible Commercial Vehicles/i);
    fireEvent.change(vehicleInput, { target: { value: '250' } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Vehicle count must be an integer between 1 and 200/i);
    });

    // Check that input was NOT silently clamped
    expect(vehicleInput).toHaveValue(250);
    // Previous estimates should be cleared
    expect(screen.queryByText('20.00 L')).not.toBeInTheDocument();
  });

  it('rejects out-of-range hours and displays error without calling API or silently clamping', async () => {
    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    const hoursInput = screen.getByLabelText(/Curtailed Idling Duration per Vehicle/i);
    fireEvent.change(hoursInput, { target: { value: '0.2' } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Curtailed idling duration must be between 0.5 and 12.0 hours/i);
    });

    expect(hoursInput).toHaveValue(0.2);
    expect(screen.queryByText('20.00 L')).not.toBeInTheDocument();
  });

  it('suppresses live operational planner when assessment is stale (>24h old)', () => {
    const staleAssessment: RiskAssessmentResponse = {
      ...mockAssessmentFreshAbove,
      freshness_state: 'stale',
      status: 'stale_data',
    };

    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={staleAssessment}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText(/Sensor observations have not updated within the past 24 hours/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Eligible Commercial Vehicles/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Export Facility Action Dossier/i })).toBeDisabled();
  });

  it('suppresses live operational planner when assessment is historical (>30d old) while preserving historical dossier', () => {
    const historicalAssessment: RiskAssessmentResponse = {
      ...mockAssessmentFreshAbove,
      freshness_state: 'historical',
      status: 'historical_data',
      status_label: 'Historical sensor data',
      calculated_average: 112.0,
    };

    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={historicalAssessment}
        onNavigate={vi.fn()}
      />
    );

    // Retrospective dossier title must be displayed
    expect(screen.getByText(/Retrospective Environmental Evidence Dossier/i)).toBeInTheDocument();
    // Calculated historical average must remain visible
    expect(screen.getByText('112.00 µg/m³')).toBeInTheDocument();
    // Action planner must be suppressed with historical warning
    expect(screen.getByText(/Retrospective evaluation of historical baseline data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Facility Action Dossier/i })).toBeDisabled();
  });

  it('suppresses live operational planner when completeness is below 75%', () => {
    const incompleteAssessment: RiskAssessmentResponse = {
      ...mockAssessmentFreshAbove,
      valid_observations: 12,
      expected_observations: 24,
      completeness_percentage: 50.0,
      is_completeness_satisfied: false,
      status: 'insufficient_data',
      calculated_average: null,
    };

    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={incompleteAssessment}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText(/Evaluation window contains insufficient hourly observations/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Facility Action Dossier/i })).toBeDisabled();
  });

  it('displays API error alert when backend abatement endpoint fails', async () => {
    vi.spyOn(api, 'fetchAbatementEstimate').mockResolvedValue({
      data: null,
      error: {
        error: 'ServerError',
        message: 'Internal estimation service error.',
        error_code: 'ABATEMENT_SERVICE_ERROR',
      },
    });

    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Backend Calculation Error \(ABATEMENT_SERVICE_ERROR\)/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Export Facility Action Dossier/i })).toBeDisabled();
  });

  it('discards out-of-order stale API responses from older inputs', async () => {
    let resolveFirst: ((val: any) => void) | null = null;
    let resolveSecond: ((val: any) => void) | null = null;

    vi.spyOn(api, 'fetchAbatementEstimate').mockImplementation((vehicles) => {
      if (vehicles === 10) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Promise((resolve) => {
        resolveSecond = resolve;
      });
    });

    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    const vehicleInput = screen.getByLabelText(/Eligible Commercial Vehicles/i);
    // Change to 20
    fireEvent.change(vehicleInput, { target: { value: '20' } });

    // Now resolve second request (vehicles=20)
    const responseFor20: IdlingAbatementResponse = {
      ...mockAbatementCanonicalResponse,
      vehicles: 20,
      avoided_fuel_liters: 40.0,
    };
    resolveSecond!({ data: responseFor20, error: null });

    await waitFor(() => {
      expect(screen.getByText('40.00 L')).toBeInTheDocument();
    });

    // Now resolve slow first request (vehicles=10) with old value 20.00 L
    resolveFirst!({ data: mockAbatementCanonicalResponse, error: null });

    // It must NOT overwrite 40.00 L with 20.00 L
    await waitFor(() => {
      expect(screen.getByText('40.00 L')).toBeInTheDocument();
      expect(screen.queryByText('20.00 L')).not.toBeInTheDocument();
    });
  });

  it('renders dust mitigation protocol with 50%–70% efficiency and N/A mass notice', () => {
    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('50% – 70% lift-off reduction')).toBeInTheDocument();
    expect(screen.getByText('N/A (Geotechnical data unmeasured)')).toBeInTheDocument();
    expect(screen.getByText(/strictly to unpaved-road surface watering/i)).toBeInTheDocument();
  });

  it('copies complete five-part dossier to clipboard on export click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ReportsSection
        locationDetail={mockLocation}
        measurementsData={mockMeasurements}
        assessmentData={mockAssessmentFreshAbove}
        onNavigate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('20.00 L')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Export Facility Action Dossier/i });
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      const text = writeTextMock.mock.calls[0][0];
      expect(text).toContain('ECOSENTINEL FACILITY ENVIRONMENTAL ACTION & EVIDENCE DOSSIER');
      expect(text).toContain('Not a Statutory Compliance Certificate');
      expect(text).toContain('[PART A: VERIFIED AMBIENT EVIDENCE & SCREENING FINDING]');
      expect(text).toContain('[PART B: DATA INTEGRITY & SENSOR PROVENANCE AUDIT]');
      expect(text).toContain('[PART C: OPERATIONAL MITIGATION PROTOCOLS]');
      expect(text).toContain('[PART D: QUANTIFIED POTENTIAL ABATEMENT (CANONICAL BACKEND ESTIMATES)]');
      expect(text).toContain('[PART E: STATUTORY & ATMOSPHERIC CAVEATS]');
      expect(text).toContain('20.00 L');
      expect(text).toContain('53.60 kg');
      expect(text).toContain('50%–70%');
      expect(text).toContain('PM10 Mass Avoided: N/A');
    });

    expect(screen.getByText('✓ Dossier Copied to Clipboard')).toBeInTheDocument();
  });
});
