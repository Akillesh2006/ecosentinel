import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  generateObservationsCsv,
  generateDossierJson,
  generateDossierCsv,
} from './exportEvidence';
import type {
  LocationMeasurementsResponse,
  LocationDetail,
  RiskAssessmentResponse,
  IdlingAbatementResponse,
} from '../types';

describe('exportEvidence utility', () => {
  describe('escapeCsvField', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('returns unquoted string for simple alpha-numeric values', () => {
      expect(escapeCsvField('Delhi')).toBe('Delhi');
      expect(escapeCsvField(42.5)).toBe('42.5');
      expect(escapeCsvField(true)).toBe('true');
    });

    it('wraps fields containing commas in quotes', () => {
      expect(escapeCsvField('Anand Vihar, Delhi')).toBe('"Anand Vihar, Delhi"');
    });

    it('doubles internal double quotes and wraps in quotes', () => {
      expect(escapeCsvField('Station "A"')).toBe('"Station ""A"""');
    });

    it('wraps fields with newline characters in quotes', () => {
      expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });
  });

  describe('generateObservationsCsv', () => {
    const mockMeasurements: LocationMeasurementsResponse = {
      location_id: 8118,
      station_name: 'Anand Vihar, Delhi - DPCC',
      locality: 'Delhi',
      provider_name: 'CPCB',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      requested_from_utc: '2026-10-25T12:00:00Z',
      requested_to_utc: '2026-10-26T12:00:00Z',
      total_observations: 3,
      excluded_observations: 0,
      missing_percentage: 33.3,
      is_stale: false,
      retrieved_at_utc: '2026-10-26T12:05:00Z',
      measurements: [
        {
          datetime_from_utc: '2026-10-25T12:00:00Z',
          datetime_to_utc: '2026-10-25T13:00:00Z',
          datetime_from_local: '2026-10-25T17:30:00+05:30',
          datetime_to_local: '2026-10-25T18:30:00+05:30',
          parameter: 'pm25',
          value: 145.8,
          units: 'µg/m³',
          is_missing: false,
          percent_complete: 100,
          period_label: '1 hour',
          interval: '1h',
        },
        {
          datetime_from_utc: '2026-10-25T13:00:00Z',
          datetime_to_utc: '2026-10-25T14:00:00Z',
          datetime_from_local: '2026-10-25T18:30:00+05:30',
          datetime_to_local: '2026-10-25T19:30:00+05:30',
          parameter: 'pm25',
          value: 0, // Genuine 0 observation
          units: 'µg/m³',
          is_missing: false,
          percent_complete: 100,
          period_label: '1 hour',
          interval: '1h',
        },
        {
          datetime_from_utc: '2026-10-25T14:00:00Z',
          datetime_to_utc: '2026-10-25T15:00:00Z',
          datetime_from_local: '2026-10-25T19:30:00+05:30',
          datetime_to_local: '2026-10-25T20:30:00+05:30',
          parameter: 'pm25',
          value: -999, // Missing entry with sentinel
          units: 'µg/m³',
          is_missing: true, // Missing!
          percent_complete: 0,
          period_label: '1 hour',
          interval: '1h',
        },
      ],
    };

    const mockLocationDetail: LocationDetail = {
      id: 8118,
      name: 'Anand Vihar, Delhi - DPCC',
      locality: 'Delhi',
      country_code: 'IN',
      country_name: 'India',
      provider_name: 'CPCB',
      is_monitor: true,
      is_mobile: false,
      is_stale: false,
      available_parameters: ['pm25', 'pm10'],
      coordinates: { latitude: 28.6476, longitude: 77.3158 },
      instruments: ['Continuous Ambient Air Quality Monitoring Station'],
      licenses: [],
      sensors: [],
    };

    it('generates CSV with metadata header comments and column names', () => {
      const csv = generateObservationsCsv(mockMeasurements, mockLocationDetail);
      expect(csv).toContain('# EcoSentinel Verified Ambient Observations Export');
      expect(csv).toContain('# Station Name: Anand Vihar, Delhi - DPCC');
      expect(csv).toContain('# Coordinates: 28.6476N, 77.3158E');
      expect(csv).toContain('# Statutory Disclaimer:');
      expect(csv).toContain('timestamp_utc,timestamp_local,parameter_name,parameter_display_name,value,units,is_missing');
    });

    it('preserves genuine value of 0, but leaves missing observations EMPTY (never 0)', () => {
      const csv = generateObservationsCsv(mockMeasurements, mockLocationDetail);
      const lines = csv.split('\r\n');
      const dataRows = lines.filter((l) => !l.startsWith('#') && !l.startsWith('timestamp_utc'));

      expect(dataRows.length).toBe(3);

      // Row 1: 145.8
      expect(dataRows[0]).toContain(',145.8,');
      expect(dataRows[0]).toContain(',FALSE,');

      // Row 2: genuine 0
      expect(dataRows[1]).toContain(',0,');
      expect(dataRows[1]).toContain(',FALSE,');

      // Row 3: missing value must be empty string, NOT 0 or -999
      expect(dataRows[2]).toContain(',TRUE,');
      // Verify value is empty between commas
      const row3Cols = dataRows[2].split(',');
      // parameter_display_name is PM2.5, next is value, next is units
      expect(row3Cols[4]).toBe('');
    });
  });

  describe('generateDossierJson', () => {
    const mockAssessment: RiskAssessmentResponse = {
      status: 'above_reference',
      status_label: 'Above Reference',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      averaging_period: '24h',
      averaging_period_label: '24-hour',
      units: 'µg/m³',
      calculated_average: 115.4,
      standard_threshold: 60.0,
      standard_name: 'CPCB NAAQS (2009)',
      ratio_to_standard: 1.92,
      completeness_percentage: 91.7,
      is_completeness_satisfied: true,
      valid_observations: 22,
      expected_observations: 24,
      excluded_observations: 0,
      freshness_state: 'fresh',
      station_name: 'Anand Vihar, Delhi - DPCC',
      location_id: 8118,
      locality: 'Delhi',
      is_stale: false,
      stale_threshold_hours: 24,
      window_start_utc: '2026-10-25T12:00:00Z',
      window_end_utc: '2026-10-26T12:00:00Z',
      query_timestamp_utc: '2026-10-26T12:05:00Z',
      completeness_rule_label: '75% valid hourly observations required',
      spatial_disclaimer: 'Observations represent physical conditions at this specific coordinate.',
      advisories: [
        {
          category: 'Fleet Operations',
          action: 'Enforce anti-idling on heavy commercial vehicles',
          rationale: 'Curtails local combustion emissions',
          uncertainty: 'Local vs regional advection cannot be verified from a single sensor',
        },
      ],
    };

    const mockAbatement: IdlingAbatementResponse = {
      vehicles: 10,
      hours: 4,
      total_vehicle_hours: 40,
      avoided_fuel_liters: 40.0,
      avoided_co2_kg: 107.2,
      avoided_nox_kg: 1.352,
      avoided_nox_grams: 1352.0,
      avoided_pm25_grams: 44.0,
      factors: [],
      dust_guidance: {
        control_efficiency_range: '50%–70%',
        basis: 'AP-42',
        recommendations: [],
        supportive_controls_note: 'Note',
      },
      assumptions: ['1 L/veh-h fuel consumption'],
      fleet_technology_caveat: 'Fleet technology caveat note',
      atmospheric_boundary_caveat: 'Boundary layer caveat note',
      statutory_disclaimer: 'Statutory disclaimer note',
    };

    it('generates structured JSON distinguishing physical observations from engineering estimates', () => {
      const jsonStr = generateDossierJson({
        assessmentData: mockAssessment,
        abatementData: mockAbatement,
        checkedControls: { 'Water unpaved haul roads twice daily': true },
      });

      const parsed = JSON.parse(jsonStr);
      expect(parsed.export_schema).toBe('EcoSentinel-Environmental-Dossier-v1');
      expect(parsed.station_metadata.id).toBe(8118);
      expect(parsed.operational_risk_screening.calculated_average).toBe(115.4);
      expect(parsed.operational_risk_screening.is_completeness_satisfied).toBe(true);

      // Engineering estimates are clearly marked
      expect(parsed.engineering_abatement_estimates.evidence_type).toBe(
        'CANONICAL_ENGINEERING_ESTIMATES_NOT_PHYSICAL_MEASUREMENTS'
      );
      expect(parsed.engineering_abatement_estimates.curtailed_vehicles).toBe(10);
      expect(parsed.engineering_abatement_estimates.avoided_co2_kg).toBe(107.2);

      // Disclaimers are included
      expect(parsed.statutory_and_scientific_disclaimers.operational_screening_disclaimer).toContain(
        'Operational screening against a rolling window serves as local facility decision support'
      );
    });

    it('generates valid Dossier CSV format', () => {
      const csvStr = generateDossierCsv({
        assessmentData: mockAssessment,
        abatementData: mockAbatement,
      });

      expect(csvStr).toContain('# EcoSentinel Five-Part Environmental Evidence Dossier');
      expect(csvStr).toContain('Station Identity,Station Name,"Anand Vihar, Delhi - DPCC"');
      expect(csvStr).toContain('Engineering Estimates,Fleet Scope,10 vehicles for 4 hours,veh-h,Canonical Engineering Simulation');
      expect(csvStr).toContain('Engineering Estimates,Avoided CO2,107.20,kg,2.68 kg/L (IPCC Factor)');
    });
  });
});
