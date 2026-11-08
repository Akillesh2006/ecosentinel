import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  SpatialComparisonMap,
  isValidCoordinate,
} from './SpatialComparisonMap';
import type { StationComparisonMetadata } from '../types';

const mockStations: StationComparisonMetadata[] = [
  {
    location_id: 3060,
    station_name: 'Punjabi Bagh, Delhi - DPCC',
    locality: 'Delhi',
    provider_name: 'OpenAQ v3',
    owner_name: 'DPCC',
    is_reference: true,
    distance_from_reference_km: 0.0,
    coordinates: { latitude: 28.67, longitude: 77.12 },
    sensor_id: 100,
    units: 'µg/m³',
    total_valid_observations: 24,
    expected_observations: 24,
    station_coverage_percentage: 100.0,
    coverage_percentage: 100.0,
    coincident_with_reference_hours: 24,
    pairwise_overlap_coverage_percentage: 100.0,
    coincident_coverage_percentage: 100.0,
    conditional_reference_coverage_percentage: 100.0,
    min_correlation_samples_threshold: 6,
    pearson_correlation_with_reference: 1.0,
    correlation_status: 'REFERENCE_STATION',
    is_stale: false,
  },
  {
    location_id: 3061,
    station_name: 'Anand Vihar, Delhi - DPCC',
    locality: 'Delhi',
    provider_name: 'OpenAQ v3',
    owner_name: 'DPCC',
    is_reference: false,
    distance_from_reference_km: 14.8,
    coordinates: { latitude: 28.65, longitude: 77.31 },
    sensor_id: 101,
    units: 'µg/m³',
    total_valid_observations: 22,
    expected_observations: 24,
    station_coverage_percentage: 91.7,
    coverage_percentage: 91.7,
    coincident_with_reference_hours: 22,
    pairwise_overlap_coverage_percentage: 91.7,
    coincident_coverage_percentage: 91.7,
    conditional_reference_coverage_percentage: 91.7,
    min_correlation_samples_threshold: 6,
    pearson_correlation_with_reference: 0.842,
    correlation_status: 'CALCULATED',
    is_stale: false,
  },
  {
    location_id: 3062,
    station_name: 'R.K. Puram, Delhi - DPCC',
    locality: 'Delhi',
    provider_name: 'CPCB CAAQMS',
    owner_name: 'CPCB',
    is_reference: false,
    distance_from_reference_km: 18.2,
    coordinates: { latitude: 28.56, longitude: 77.18 },
    sensor_id: 102,
    units: 'µg/m³',
    total_valid_observations: 5,
    expected_observations: 24,
    station_coverage_percentage: 20.8,
    coverage_percentage: 20.8,
    coincident_with_reference_hours: 5,
    pairwise_overlap_coverage_percentage: 20.8,
    coincident_coverage_percentage: 20.8,
    conditional_reference_coverage_percentage: 20.8,
    min_correlation_samples_threshold: 6,
    pearson_correlation_with_reference: null,
    correlation_status: 'INSUFFICIENT_COINCIDENT_DATA',
    is_stale: false,
  },
];

describe('SpatialComparisonMap Component (Milestone 7 Phase C)', () => {
  // Test 1: Valid coordinate plotting
  it('1. renders SVG canvas and plots markers for reference and neighbor stations with valid coordinates', () => {
    const { container } = render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    const svg = container.querySelector('svg.spatial-map-svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 800 440');

    // Reference marker and neighbor markers rendered
    const refMarker = container.querySelector('.spatial-marker-reference');
    expect(refMarker).toBeInTheDocument();

    const neighborMarkers = container.querySelectorAll('.spatial-marker-neighbor');
    expect(neighborMarkers.length).toBe(2);
  });

  // Test 2: Exclusion of non-geocoded / missing coordinate stations
  it('2. omits stations with missing coordinates from SVG markers and displays non-geocoded advisory banner', () => {
    const stationsWithMissing: StationComparisonMetadata[] = [
      ...mockStations,
      {
        location_id: 3099,
        station_name: 'Palam Field, Delhi - IMD',
        locality: 'Delhi',
        provider_name: 'IMD',
        owner_name: 'IMD',
        is_reference: false,
        distance_from_reference_km: null,
        coordinates: null, // missing coordinates
        sensor_id: 199,
        units: 'µg/m³',
        total_valid_observations: 18,
        expected_observations: 24,
        station_coverage_percentage: 75.0,
        coverage_percentage: 75.0,
        coincident_with_reference_hours: 18,
        pairwise_overlap_coverage_percentage: 75.0,
        coincident_coverage_percentage: 75.0,
        conditional_reference_coverage_percentage: 75.0,
        min_correlation_samples_threshold: 6,
        pearson_correlation_with_reference: 0.72,
        correlation_status: 'CALCULATED',
        is_stale: false,
      },
    ];

    const { container } = render(
      <SpatialComparisonMap
        stations={stationsWithMissing}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Advisory banner is rendered
    expect(screen.getByText(/Non-Geocoded Station Notice/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Station 3099 \(Palam Field, Delhi - IMD\) — omitted from geographic map \(coordinates unavailable\)\./i)
    ).toBeInTheDocument();

    // SVG markers count should remain 3 (1 ref + 2 valid neighbors), NOT 4
    const allMarkers = container.querySelectorAll('.spatial-marker');
    expect(allMarkers.length).toBe(3);
  });

  // Test 3: Latitude & Longitude bounds enforcement
  it('3. validates WGS-84 coordinate bounds and rejects out-of-range, NaN, or non-finite coordinates', () => {
    expect(isValidCoordinate({ latitude: 28.67, longitude: 77.12 })).toBe(true);
    expect(isValidCoordinate({ latitude: -90.0, longitude: 180.0 })).toBe(true);
    expect(isValidCoordinate({ latitude: 90.0, longitude: -180.0 })).toBe(true);
    expect(isValidCoordinate({ latitude: 0.0, longitude: 0.0 })).toBe(true);

    // Out of bounds
    expect(isValidCoordinate({ latitude: 90.1, longitude: 77.12 })).toBe(false);
    expect(isValidCoordinate({ latitude: -90.5, longitude: 77.12 })).toBe(false);
    expect(isValidCoordinate({ latitude: 28.67, longitude: 180.5 })).toBe(false);
    expect(isValidCoordinate({ latitude: 28.67, longitude: -180.5 })).toBe(false);

    // Non-numeric / NaN / null / undefined
    expect(isValidCoordinate(null)).toBe(false);
    expect(isValidCoordinate(undefined)).toBe(false);
    expect(isValidCoordinate({ latitude: NaN, longitude: 77.12 })).toBe(false);
    expect(isValidCoordinate({ latitude: 28.67, longitude: Infinity })).toBe(false);
    expect(isValidCoordinate({ latitude: -Infinity, longitude: 77.12 })).toBe(false);
  });

  // Test 4: Dynamic bounding box calculation across stations
  it('4. computes dynamic bounding box adapting to station spread with padding', () => {
    render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Midpoint latitude between 28.56 and 28.67 is ~28.615°N, lon between 77.12 and 77.31 is ~77.215°E
    // Grid text should display approximate latitude and longitude guides
    expect(screen.getByText(/Lat: 28\.62°N/i)).toBeInTheDocument();
  });

  // Test 5: Cosine aspect correction factor computation
  it('5. computes cosine aspect correction factor based on mean network latitude', () => {
    // In Delhi (~28.6°N), cos(28.65° * pi / 180) ~ 0.877
    // Testing projection calculation directly through Delhi stations vs southern Indian stations (Chennai ~13.08°N)
    const chennaiStations: StationComparisonMetadata[] = [
      {
        ...mockStations[0],
        location_id: 4001,
        station_name: 'Alandur, Chennai - CPCB',
        coordinates: { latitude: 13.00, longitude: 80.20 },
      },
      {
        ...mockStations[1],
        location_id: 4002,
        station_name: 'Manali, Chennai - TNPCB',
        coordinates: { latitude: 13.16, longitude: 80.26 },
      },
    ];

    const { container } = render(
      <SpatialComparisonMap
        stations={chennaiStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    expect(screen.getByText(/Lat: 13\.08°N/i)).toBeInTheDocument();
    const markers = container.querySelectorAll('.spatial-marker');
    expect(markers.length).toBe(2);
  });

  // Test 6: Single-coordinate fallback
  it('6. generates fallback window centered on station using radiusKm when only 1 valid station exists', () => {
    const singleStation: StationComparisonMetadata[] = [mockStations[0]];

    const { container } = render(
      <SpatialComparisonMap
        stations={singleStation}
        radiusKm={30.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Should render SVG canvas without crashing or NaN coordinates
    const svg = container.querySelector('svg.spatial-map-svg');
    expect(svg).toBeInTheDocument();

    const refMarker = container.querySelector('.spatial-marker-reference');
    expect(refMarker).toBeInTheDocument();

    // Verify distance scale bar and rings exist
    expect(container.querySelector('.spatial-map-scale-bar')).toBeInTheDocument();
  });

  // Test 7: Empty-coordinate state rendering
  it('7. renders empty-state banner with accessible role when zero stations report valid coordinates', () => {
    const zeroValidStations: StationComparisonMetadata[] = [
      {
        ...mockStations[0],
        coordinates: null,
      },
      {
        ...mockStations[1],
        coordinates: undefined,
      },
    ];

    const { container } = render(
      <SpatialComparisonMap
        stations={zeroValidStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Must NOT render SVG map
    expect(container.querySelector('svg.spatial-map-svg')).toBeNull();

    // Must render accessible empty state banner
    expect(screen.getByRole('status', { name: /No geographical coordinates available/i })).toBeInTheDocument();
    expect(screen.getByText(/No Geographical Coordinates Available/i)).toBeInTheDocument();
    expect(screen.getByText(/Station 3060 \(Punjabi Bagh, Delhi - DPCC\) — omitted/i)).toBeInTheDocument();
    expect(screen.getByText(/Station 3061 \(Anand Vihar, Delhi - DPCC\) — omitted/i)).toBeInTheDocument();
  });

  // Test 8: Co-located marker handling with visual offset
  it('8. detects co-located stations (<24px) and applies deterministic visual offset with advisory badge', () => {
    // Two stations with near-identical coordinates
    const coLocatedStations: StationComparisonMetadata[] = [
      mockStations[0], // Lat: 28.67, Lon: 77.12
      {
        ...mockStations[1],
        location_id: 3077,
        station_name: 'Punjabi Bagh School - DPCC',
        coordinates: { latitude: 28.67001, longitude: 77.12001 }, // co-located with 3060
        distance_from_reference_km: 0.05,
      },
    ];

    const { container } = render(
      <SpatialComparisonMap
        stations={coLocatedStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Advisory badge for co-location must be displayed
    expect(screen.getByText(/Co-Located Stations Offset/i)).toBeInTheDocument();

    // Connecting offset line should be present in SVG
    const colocLines = container.querySelectorAll('line[stroke-dasharray="2 2"]');
    expect(colocLines.length).toBeGreaterThanOrEqual(1);
  });

  // Test 9: Visual distinction between reference and neighbor markers
  it('9. renders reference marker as teal diamond and neighbor markers as numbered circles', () => {
    const { container } = render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Reference marker contains a path (diamond) filled with teal (#14b8a6)
    const refMarker = container.querySelector('.spatial-marker-reference');
    expect(refMarker).toBeInTheDocument();
    const diamondPath = refMarker?.querySelector('path');
    expect(diamondPath).toHaveAttribute('fill', '#14b8a6');

    // Reference label
    expect(screen.getByText(/Ref: Punjabi Bagh/i)).toBeInTheDocument();

    // Neighbor marker contains circles and neighbor numbers
    const neighborMarkers = container.querySelectorAll('.spatial-marker-neighbor');
    expect(neighborMarkers.length).toBe(2);
    expect(neighborMarkers[0].querySelector('circle')).toBeInTheDocument();
  });

  // Test 10: Color & Index parity with comparison chart
  it('10. uses color palette and index digits matching comparison chart for non-color accessibility', () => {
    const { container } = render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Neighbor 1 has Amber (#f59e0b) circle and text digit '1'
    const neighbor1Marker = container.querySelectorAll('.spatial-marker-neighbor')[0];
    const circle1 = neighbor1Marker.querySelectorAll('circle')[0];
    expect(circle1).toHaveAttribute('fill', '#f59e0b');
    expect(neighbor1Marker).toHaveTextContent('1');

    // Neighbor 2 has Sky (#38bdf8) circle and text digit '2'
    const neighbor2Marker = container.querySelectorAll('.spatial-marker-neighbor')[1];
    const circle2 = neighbor2Marker.querySelectorAll('circle')[0];
    expect(circle2).toHaveAttribute('fill', '#38bdf8');
    expect(neighbor2Marker).toHaveTextContent('2');
  });

  // Test 11: Authoritative API-provided Haversine distance display
  it('11. displays API-provided Haversine distance in marker labels and tooltips, not recalculated Euclidean distance', () => {
    const { container } = render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Distance labels rendered below neighbor markers
    expect(screen.getByText('14.8 km')).toBeInTheDocument();
    expect(screen.getByText('18.2 km')).toBeInTheDocument();

    // Hover neighbor 1 marker to check tooltip authoritative Haversine distance
    const neighbor1Marker = container.querySelectorAll('.spatial-marker-neighbor')[0];
    fireEvent.mouseEnter(neighbor1Marker);

    const tooltip = container.querySelector('.spatial-map-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/Authoritative Haversine Distance:/i);
    expect(tooltip).toHaveTextContent('14.8 km');
    expect(tooltip).toHaveTextContent('Neighbor #1');
  });

  // Test 12: Accessibility: ARIA roles, labels, tabIndex, and keyboard navigation
  it('12. provides accessible region, img role, keyboard focusability, and Enter/Space tooltip toggle', () => {
    const { container } = render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // ARIA roles
    expect(screen.getByRole('region', { name: /Geographic Point Network Map/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Geographic station location map for PM2\.5/i })).toBeInTheDocument();

    // Interactive markers have tabindex="0" and role="button"
    const refMarker = container.querySelector('.spatial-marker-reference');
    expect(refMarker).toHaveAttribute('tabindex', '0');
    expect(refMarker).toHaveAttribute('role', 'button');
    expect(refMarker).toHaveAttribute('aria-label', expect.stringContaining('Reference Station: Punjabi Bagh, Delhi - DPCC'));

    // Keyboard focus triggers tooltip
    fireEvent.focus(refMarker!);
    expect(container.querySelector('.spatial-map-tooltip')).toBeInTheDocument();
    expect(container.querySelector('.spatial-map-tooltip')).toHaveTextContent(/0\.0 km \(Reference Anchor\)/i);

    // Keyboard blur hides tooltip
    fireEvent.blur(refMarker!);
    expect(container.querySelector('.spatial-map-tooltip')).toBeNull();

    // Keyboard Enter toggles tooltip
    fireEvent.keyDown(refMarker!, { key: 'Enter' });
    expect(container.querySelector('.spatial-map-tooltip')).toBeInTheDocument();
  });

  // Test 13: Responsive SVG behavior
  it('13. sets SVG viewBox, preserveAspectRatio, and 100% width for fluid responsiveness', () => {
    const { container } = render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    const svg = container.querySelector('svg.spatial-map-svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 800 440');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    expect(svg?.getAttribute('style')).toContain('width: 100%');
  });

  // Test 14: Mandatory scientific disclaimer presence
  it('14. displays exact mandatory Point Observation Notice disclaimer', () => {
    render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    const expectedNotice =
      'Point Observation Notice: Station markers represent discrete physical monitor coordinates on the WGS-84 datum. Ambient monitors reflect local micro-environments and do not depict continuous spatial airsheds, regional dispersion gradients, or industrial emission source attribution.';

    const disclaimerEl = screen.getByText(/Point Observation Notice:/i).parentElement;
    expect(disclaimerEl).toHaveTextContent(expectedNotice);
  });

  // Test 15: Prohibited spatial artifacts absence
  it('15. strictly excludes heatmaps, contours, Voronoi polygons, IDW interpolation, and transport vectors', () => {
    const { container } = render(
      <SpatialComparisonMap
        stations={mockStations}
        radiusKm={25.0}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // No canvas or raster heatmaps
    expect(container.querySelector('canvas')).toBeNull();

    // No Voronoi polygons
    expect(container.querySelector('.voronoi')).toBeNull();
    expect(container.querySelector('polygon')).toBeNull();

    // No contour path collections
    expect(container.querySelector('.contours')).toBeNull();
    expect(container.querySelector('.heatmap')).toBeNull();

    // No transport directional arrow markers in defs
    expect(container.querySelector('marker[id*="arrow"]')).toBeNull();
  });
});
