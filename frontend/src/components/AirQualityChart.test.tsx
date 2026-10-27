import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AirQualityChart } from './AirQualityChart';
import type { MeasurementPoint } from '../types';

describe('AirQualityChart Component', () => {
  const continuousMeasurements: MeasurementPoint[] = [
    {
      value: 120.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T10:00:00Z',
      datetime_to_utc: '2026-10-26T11:00:00Z',
      datetime_from_local: '2026-10-26 15:30:00+05:30',
      datetime_to_local: '2026-10-26 16:30:00+05:30',
      is_missing: false,
    },
    {
      value: 135.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T11:00:00Z',
      datetime_to_utc: '2026-10-26T12:00:00Z',
      datetime_from_local: '2026-10-26 16:30:00+05:30',
      datetime_to_local: '2026-10-26 17:30:00+05:30',
      is_missing: false,
    },
    {
      value: 150.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T12:00:00Z',
      datetime_to_utc: '2026-10-26T13:00:00Z',
      datetime_from_local: '2026-10-26 17:30:00+05:30',
      datetime_to_local: '2026-10-26 18:30:00+05:30',
      is_missing: false,
    },
  ];

  const measurementsWithLargeGap: MeasurementPoint[] = [
    // Segment 1 (2 points: 10:00 and 11:00)
    {
      value: 120.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T10:00:00Z',
      datetime_to_utc: '2026-10-26T11:00:00Z',
      datetime_from_local: '2026-10-26 15:30:00+05:30',
      datetime_to_local: '2026-10-26 16:30:00+05:30',
      is_missing: false,
    },
    {
      value: 135.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T11:00:00Z',
      datetime_to_utc: '2026-10-26T12:00:00Z',
      datetime_from_local: '2026-10-26 16:30:00+05:30',
      datetime_to_local: '2026-10-26 17:30:00+05:30',
      is_missing: false,
    },
    // Missing interval: 12:00 to 17:00 (6 hours gap!)
    // Segment 2 (2 points: 17:00 and 18:00)
    {
      value: 95.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T17:00:00Z',
      datetime_to_utc: '2026-10-26T18:00:00Z',
      datetime_from_local: '2026-10-26 22:30:00+05:30',
      datetime_to_local: '2026-10-26 23:30:00+05:30',
      is_missing: false,
    },
    {
      value: 90.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T18:00:00Z',
      datetime_to_utc: '2026-10-26T19:00:00Z',
      datetime_from_local: '2026-10-26 23:30:00+05:30',
      datetime_to_local: '2026-10-27 00:30:00+05:30',
      is_missing: false,
    },
  ];

  it('renders single polyline and area polygon for continuous observations', () => {
    const { container } = render(
      <AirQualityChart
        measurements={continuousMeasurements}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stationName="Anand Vihar"
      />
    );

    const polylines = container.querySelectorAll('polyline');
    expect(polylines).toHaveLength(1);

    const polygons = container.querySelectorAll('polygon');
    expect(polygons).toHaveLength(1);

    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(3);

    expect(screen.queryByText(/data gap/i)).not.toBeInTheDocument();
  });

  it('breaks the plotted line across large gaps in the observation timeline without interpolating', () => {
    const { container } = render(
      <AirQualityChart
        measurements={measurementsWithLargeGap}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stationName="Anand Vihar"
      />
    );

    // Verify 2 separate polylines are rendered for the 2 segments across the 6-hour gap
    const polylines = container.querySelectorAll('polyline');
    expect(polylines).toHaveLength(2);

    // Verify 2 separate area fill polygons are rendered
    const polygons = container.querySelectorAll('polygon');
    expect(polygons).toHaveLength(2);

    // All 4 actual observation points are preserved as circles
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(4);

    // Gap indicator is displayed in legend
    expect(screen.getByText(/1 data gap \(uninterpolated\)/i)).toBeInTheDocument();
  });

  it('does not draw lines across isolated single points surrounded by gaps', () => {
    const isolatedPoints: MeasurementPoint[] = [
      {
        value: 50.0,
        parameter: 'pm25',
        units: 'µg/m³',
        period_label: 'hour',
        interval: '01:00:00',
        datetime_from_utc: '2026-10-25T10:00:00Z',
        datetime_to_utc: '2026-10-25T11:00:00Z',
        is_missing: false,
      },
      // 24-hour gap
      {
        value: 70.0,
        parameter: 'pm25',
        units: 'µg/m³',
        period_label: 'hour',
        interval: '01:00:00',
        datetime_from_utc: '2026-10-26T10:00:00Z',
        datetime_to_utc: '2026-10-26T11:00:00Z',
        is_missing: false,
      },
    ];

    const { container } = render(
      <AirQualityChart
        measurements={isolatedPoints}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stationName="Anand Vihar"
      />
    );

    // Because each segment has only 1 point, no polylines are drawn connecting across the 24-hour gap
    const polylines = container.querySelectorAll('polyline');
    expect(polylines).toHaveLength(0);

    // Both observation values are strictly preserved as circles
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2);
  });

  it('supports mobile tap / click and displays both local and UTC timestamps in tooltip', () => {
    const { container } = render(
      <AirQualityChart
        measurements={continuousMeasurements}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stationName="Anand Vihar"
      />
    );

    const circles = container.querySelectorAll('circle');
    // Click on first point
    fireEvent.click(circles[0]);

    // Tooltip display shows value, units, Local time and UTC time
    expect(screen.getByText(/120 µg\/m³/i)).toBeInTheDocument();
    expect(screen.getByText(/Local/i)).toBeInTheDocument();
    expect(screen.getByText(/UTC/i)).toBeInTheDocument();

    // Toggle off
    fireEvent.click(circles[0]);
    expect(screen.queryByText(/120 µg\/m³/i)).not.toBeInTheDocument();
  });

  it('renders accessible empty state when measurements array is empty', () => {
    render(
      <AirQualityChart
        measurements={[]}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stationName="Anand Vihar"
      />
    );

    expect(screen.getByText(/No measurement data points available to plot/i)).toBeInTheDocument();
  });
});
