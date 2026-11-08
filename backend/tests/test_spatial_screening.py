"""Comprehensive tests for Milestone 7 Phase D: Multi-Station Neighborhood Anomaly Screening.

Validates:
1. Concurrent elevation (MULTI_STATION_CONCURRENT_ELEVATION)
2. Station-localized elevation (STATION_LOCALIZED_ELEVATION)
3. Baseline consistent (BASELINE_CONSISTENT)
4. Neighbor elevation only (NEIGHBOR_ELEVATION_ONLY)
5. Negative scores never elevated (statistical drops are not elevations)
6. Missing reference observation
7. Invalid/indeterminate reference score
8. Fewer than two comparable neighbors
9. Reference coverage suppression (<75%)
10. Neighbor coverage exclusion with remaining comparable neighbors
11. Neighbor zero-MAD exclusion
12. Reference zero-MAD suppression
13. Partial upstream failure
14. Unit incompatibility
15. Unsupported 48-hour comparison window suppression
16. Zero denominator percentage safety
17. Summary counts reconciliation
18. UTC timestamp alignment and missing-hour handling
19. Regression tests proving Milestone 6 single-station anomaly detection remains unchanged
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
import pytest

from app.core.spatial import evaluate_neighborhood_screening
from app.core.standards import detect_air_quality_anomalies
from app.schemas.air_quality import (
    CoverageState,
    MeasurementPoint,
    ScaleState,
)
from app.schemas.spatial import (
    ComparisonTimeSlice,
    SpatialScreeningClassification,
    SpatialScreeningStatus,
)

BASE_TIME = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)


def make_measurement_point(
    val: float,
    dt_end: datetime,
    dt_from: Optional[datetime] = None,
    param: str = "pm25",
    units: str = "µg/m³",
) -> MeasurementPoint:
    """Helper creating a valid non-negative hourly measurement point."""
    if dt_from is None:
        dt_from = dt_end - timedelta(hours=1)
    return MeasurementPoint(
        value=val,
        parameter=param,
        units=units,
        period_label="hourly",
        datetime_from_utc=dt_from,
        datetime_to_utc=dt_end,
        datetime_from_local=dt_from.strftime("%Y-%m-%d %H:%M:%S IST"),
        datetime_to_local=dt_end.strftime("%Y-%m-%d %H:%M:%S IST"),
        is_missing=False,
    )


def build_24h_series(
    baseline_vals: List[float],
    t_end: datetime = BASE_TIME,
) -> List[MeasurementPoint]:
    """Generates 24 hourly measurement points ending at t_end."""
    t_start = t_end - timedelta(hours=24)
    pts = []
    for i in range(24):
        dt_to = t_start + timedelta(hours=i + 1)
        dt_from = t_start + timedelta(hours=i)
        val = baseline_vals[i % len(baseline_vals)]
        pts.append(make_measurement_point(val, dt_to, dt_from))
    return pts


# -----------------------------------------------------------------------------
# Core Screening Logic Tests
# -----------------------------------------------------------------------------

def test_screening_concurrent_elevation():
    """Branch 1: Reference elevated (M >= +2.5) + >= 1 neighbor elevated -> MULTI_STATION_CONCURRENT_ELEVATION."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    # Reference station: 23 baseline points, 1 spike at 180.0 (M >= 3.5)
    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(23)] + [180.0]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    # Neighbor 1: 23 baseline points, 1 elevation at 130.0 (M >= 2.5)
    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(23)] + [130.0]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    # Neighbor 2: Normal observations throughout
    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    # Build 24 time slices
    slices = []
    for i in range(24):
        dt = t_start + timedelta(hours=i)
        slices.append(
            ComparisonTimeSlice(
                datetime_utc=dt,
                station_values={3060: ref_vals[i], 3061: n1_vals[i], 3062: n2_vals[i]},
                contributing_stations=3,
            )
        )

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATED
    assert summary.evaluable_hours_count == 24
    assert summary.concurrent_elevation_hours_count == 1

    last_slice = hourly[-1]
    assert last_slice.classification == SpatialScreeningClassification.MULTI_STATION_CONCURRENT_ELEVATION
    assert last_slice.subclassification == "SPIKE_CONCURRENT"
    assert last_slice.is_reference_elevated is True
    assert last_slice.is_reference_spike is True
    assert last_slice.neighbors_comparable_count == 2
    assert last_slice.elevated_neighbors_count == 1
    assert last_slice.elevated_neighbor_ids == [3061]
    assert 3061 in last_slice.contributing_neighbor_ids
    assert 3062 in last_slice.contributing_neighbor_ids


def test_screening_station_localized_elevation():
    """Branch 2: Reference elevated (M >= +2.5) + 0 neighbors elevated -> STATION_LOCALIZED_ELEVATION."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(23)] + [150.0]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(24)]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: ref_vals[i], 3061: n1_vals[i], 3062: n2_vals[i]},
            contributing_stations=3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert summary.station_localized_elevation_hours_count == 1
    last_slice = hourly[-1]
    assert last_slice.classification == SpatialScreeningClassification.STATION_LOCALIZED_ELEVATION
    assert last_slice.subclassification == "SPIKE_LOCALIZED"
    assert last_slice.is_reference_elevated is True
    assert last_slice.elevated_neighbors_count == 0


def test_screening_baseline_consistent():
    """Branch 3: Reference normal + all neighbors normal -> BASELINE_CONSISTENT."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(24)]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(24)]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: ref_vals[i], 3061: n1_vals[i], 3062: n2_vals[i]},
            contributing_stations=3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert summary.baseline_consistent_hours_count == 24
    assert summary.evaluable_hours_count == 24
    for h in hourly:
        assert h.classification == SpatialScreeningClassification.BASELINE_CONSISTENT
        assert h.subclassification == "REGIONAL_NORMAL"


def test_screening_neighbor_elevation_only():
    """Branch 4: Reference normal + >= 1 neighbor elevated -> NEIGHBOR_ELEVATION_ONLY (distinct from BASELINE_CONSISTENT)."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(24)]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(23)] + [160.0]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: ref_vals[i], 3061: n1_vals[i], 3062: n2_vals[i]},
            contributing_stations=3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert summary.neighbor_only_elevation_hours_count == 1
    last_slice = hourly[-1]
    assert last_slice.classification == SpatialScreeningClassification.NEIGHBOR_ELEVATION_ONLY
    assert last_slice.subclassification == "PERIPHERAL_ELEVATION"
    assert last_slice.is_reference_elevated is False
    assert last_slice.elevated_neighbors_count == 1
    assert last_slice.elevated_neighbor_ids == [3061]


def test_screening_negative_scores_never_elevated():
    """Branch 5: Negative scores (statistical drops) must NEVER be counted as elevated."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    # Reference drops from 100.0 to 10.0 (M <= -3.5, Statistical Drop)
    ref_vals = [100.0 + (i % 7) * 2.0 for i in range(23)] + [10.0]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [100.0 + (i % 7) * 2.0 for i in range(23)] + [12.0]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [95.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: ref_vals[i], 3061: n1_vals[i], 3062: n2_vals[i]},
            contributing_stations=3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    last_slice = hourly[-1]
    # Negative score must NOT count as elevation!
    assert last_slice.is_reference_elevated is False
    assert last_slice.classification != SpatialScreeningClassification.MULTI_STATION_CONCURRENT_ELEVATION
    assert last_slice.classification == SpatialScreeningClassification.BASELINE_CONSISTENT


def test_screening_missing_reference_observation():
    """Branch 6: Missing reference observation produces INSUFFICIENT_SPATIAL_EVIDENCE with MISSING_REFERENCE_OBSERVATION."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(24)]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(24)]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    # Slice at index 5 has missing reference observation (None)
    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={
                3060: None if i == 5 else ref_vals[i],
                3061: n1_vals[i],
                3062: n2_vals[i],
            },
            contributing_stations=2 if i == 5 else 3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert hourly[5].classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
    assert hourly[5].subclassification == "MISSING_REFERENCE_OBSERVATION"
    assert hourly[5].reference_eligibility == "MISSING_OBSERVATION"


def test_screening_fewer_than_two_comparable_neighbors():
    """Branch 8: When fewer than 2 neighbors report comparable scores at an hour -> INSUFFICIENT_SPATIAL_EVIDENCE."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(24)]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(24)]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    # Slice at index 10 has Neighbor 2 missing, leaving only 1 comparable neighbor
    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={
                3060: ref_vals[i],
                3061: n1_vals[i],
                3062: None if i == 10 else n2_vals[i],
            },
            contributing_stations=2 if i == 10 else 3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert hourly[10].classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
    assert hourly[10].subclassification == "FEWER_THAN_TWO_ELIGIBLE_NEIGHBORS"
    assert hourly[10].neighbors_comparable_count == 1
    excl = [e for e in hourly[10].timestamp_exclusions if e.location_id == 3062]
    assert len(excl) == 1
    assert excl[0].reason_code == "MISSING_HOURLY_OBSERVATION"


def test_screening_reference_coverage_suppression():
    """Branch 9: Reference station coverage failure (<75%) suppresses entire window."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    # Reference has only 12 valid points (50% coverage, fails 75% gate)
    ref_pts = []
    for i in range(12):
        dt_to = t_start + timedelta(hours=i + 1)
        ref_pts.append(make_measurement_point(40.0 + (i % 7) * 2.0, dt_to))

    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )
    assert ref_res.is_coverage_satisfied is False

    n1_pts = build_24h_series([50.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: 40.0 if i < 12 else None, 3061: 50.0},
            contributing_stations=2 if i < 12 else 1,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts},
    )

    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATED.EVALUATION_SUPPRESSED_REFERENCE_INSUFFICIENT_COVERAGE
    assert summary.evaluable_hours_count == 0
    assert summary.insufficient_evidence_hours_count == 24
    for h in hourly:
        assert h.classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
        assert h.subclassification == "REFERENCE_COVERAGE_FAILURE"


def test_screening_neighbor_coverage_exclusion_with_two_remaining_comparable():
    """Branch 10: Ineligible neighbor is excluded, while 2 remaining eligible neighbors proceed."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_pts = build_24h_series([40.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    # Neighbor 1 has only 10 points (fails 75% coverage)
    n1_pts = [make_measurement_point(50.0 + (i % 7) * 2.0, t_start + timedelta(hours=i + 1)) for i in range(10)]
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )
    assert n1_res.is_coverage_satisfied is False

    # Neighbors 2 and 3 have full 24 points with good variance
    n2_pts = build_24h_series([45.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    n3_pts = build_24h_series([48.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n3_res = detect_air_quality_anomalies(
        location_id=3063,
        station_name="Shadipur",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n3_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: 40.0, 3061: 50.0 if i < 10 else None, 3062: 45.0, 3063: 48.0},
            contributing_stations=4 if i < 10 else 3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062, 3063],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram", 3063: "Shadipur"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res, 3063: n3_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts, 3063: n3_pts},
    )

    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATED
    assert len(summary.window_exclusions) == 1
    assert summary.window_exclusions[0].location_id == 3061
    assert summary.window_exclusions[0].reason_code == "INSUFFICIENT_WINDOW_COVERAGE"

    # All slices should have exactly 2 comparable neighbors (3062 and 3063)
    for h in hourly:
        assert h.neighbors_comparable_count == 2
        assert 3061 not in h.contributing_neighbor_ids
        assert 3062 in h.contributing_neighbor_ids
        assert 3063 in h.contributing_neighbor_ids


def test_screening_neighbor_zero_mad_exclusion():
    """Branch 11: Neighbor with zero MAD is excluded from comparable scores."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_pts = build_24h_series([40.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    # Neighbor 1 has constant readings (40.0 throughout -> MAD == 0.0)
    n1_pts = build_24h_series([40.0] * 24, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )
    assert n1_res.summary.scale_indeterminate is True

    # Neighbors 2 and 3 have varying readings (MAD > 0)
    n2_pts = build_24h_series([45.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    n3_pts = build_24h_series([48.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n3_res = detect_air_quality_anomalies(
        location_id=3063,
        station_name="Shadipur",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n3_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: 40.0, 3061: 40.0, 3062: 45.0, 3063: 48.0},
            contributing_stations=4,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062, 3063],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram", 3063: "Shadipur"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res, 3063: n3_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts, 3063: n3_pts},
    )

    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATED
    # Zero-MAD neighbor 3061 must be excluded from window and comparable counts
    assert any(e.location_id == 3061 and e.reason_code == "INDETERMINATE_ZERO_MAD" for e in summary.window_exclusions)
    for h in hourly:
        assert 3061 not in h.contributing_neighbor_ids
        assert h.neighbors_comparable_count == 2


def test_screening_reference_zero_mad_suppression():
    """Branch 12: Reference station with zero MAD suppresses entire window."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    # Reference has flatline zero variance (MAD == 0.0)
    ref_pts = build_24h_series([35.0] * 24, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )
    assert ref_res.summary.scale_indeterminate is True

    n1_pts = build_24h_series([50.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: 35.0, 3061: 50.0},
            contributing_stations=2,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts},
    )

    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATION_SUPPRESSED_REFERENCE_ZERO_MAD
    assert summary.evaluable_hours_count == 0
    assert summary.insufficient_evidence_hours_count == 24


def test_screening_partial_upstream_and_unit_mismatch():
    """Branches 13 & 14: Upstream failure and unit mismatch properly excluded."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_pts = build_24h_series([40.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    # Neighbors 2 and 3 are valid
    n2_pts = build_24h_series([45.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    n3_pts = build_24h_series([48.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n3_res = detect_air_quality_anomalies(
        location_id=3063,
        station_name="Shadipur",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n3_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: 40.0, 3062: 45.0, 3063: 48.0},
            contributing_stations=3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062, 3063, 3064],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram", 3063: "Shadipur", 3064: "Mandir Marg"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3062: n2_res, 3063: n3_res},
        partial_failure_ids=[3061, 3064],
        unit_mismatch_ids=[3064],
        measurements_by_station={3060: ref_pts, 3062: n2_pts, 3063: n3_pts},
    )

    excl_codes = {e.location_id: e.reason_code for e in summary.window_exclusions}
    assert excl_codes[3061] == "UPSTREAM_FAILURE"
    assert excl_codes[3064] == "UNIT_MISMATCH"
    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATED


def test_screening_unsupported_48h_window_suppression():
    """Branch 15: 48-hour comparison window must be explicitly suppressed without inventing a baseline."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=48)

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: 40.0, 3061: 50.0, 3062: 45.0},
            contributing_stations=3,
        )
        for i in range(48)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="48h",
        reference_anomaly_result=None,
        neighbor_anomaly_results={},
    )

    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATION_SUPPRESSED_UNSUPPORTED_WINDOW
    assert "48-hour" in summary.suppression_reason
    assert summary.total_window_hours == 48
    assert summary.evaluable_hours_count == 0
    assert summary.insufficient_evidence_hours_count == 48
    assert summary.evaluable_percentage_of_window == 0.0

    for h in hourly:
        assert h.classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
        assert h.subclassification == "UNSUPPORTED_COMPARISON_WINDOW"


def test_screening_zero_denominator_percentages_are_none():
    """Branch 16: When evaluable hours is 0, percentage metrics must be None rather than division by zero."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: None, 3061: 50.0, 3062: 45.0},
            contributing_stations=2,
        )
        for i in range(24)
    ]

    ref_pts = build_24h_series([40.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_pts = build_24h_series([50.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_pts = build_24h_series([45.0 + (i % 7) * 2.0 for i in range(24)], t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,  # all slices have ref missing!
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert summary.evaluable_hours_count == 0
    assert summary.concurrent_elevation_percentage_of_evaluable is None
    assert summary.station_localized_percentage_of_evaluable is None
    assert summary.neighbor_only_percentage_of_evaluable is None
    assert summary.baseline_consistent_percentage_of_evaluable is None


def test_screening_summary_counts_reconcile_exactly():
    """Branch 17: All counts must reconcile: total_window_hours == evaluable + insufficient."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(23)] + [180.0]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(23)] + [130.0]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={
                3060: None if i == 0 else ref_vals[i],
                3061: n1_vals[i],
                3062: None if i == 1 else n2_vals[i],
            },
            contributing_stations=2 if i in (0, 1) else 3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    assert (
        summary.total_window_hours
        == summary.evaluable_hours_count + summary.insufficient_evidence_hours_count
    )
    assert summary.evaluable_hours_count == (
        summary.concurrent_elevation_hours_count
        + summary.station_localized_elevation_hours_count
        + summary.neighbor_only_elevation_hours_count
        + summary.baseline_consistent_hours_count
    )
    assert len(hourly) == summary.total_window_hours


# -----------------------------------------------------------------------------
# Regression Tests for Unchanged Milestone 6 Single-Station Anomaly Behaviour
# -----------------------------------------------------------------------------

def test_milestone_6_single_station_anomaly_regression():
    """Verify that detect_air_quality_anomalies produces identical single-station results as in Milestone 6."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    pts = []
    for i in range(23):
        dt_to = t_start + timedelta(hours=i + 1)
        pts.append(make_measurement_point(40.0 + (i % 7) * 2.0, dt_to))
    pts.append(make_measurement_point(180.0, t_end))

    res = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=pts,
        reference_time=t_end,
    )

    assert res.is_coverage_satisfied is True
    assert res.coverage_state == CoverageState.SATISFIED
    assert res.valid_observations == 24
    assert res.summary.total_spikes == 1
    assert res.summary.total_anomalies_detected == 1

    spike_obs = res.observations[-1]
    assert spike_obs.is_anomaly is True
    assert spike_obs.anomaly_type == "STATISTICAL_SPIKE"
    assert spike_obs.modified_z_score is not None
    assert spike_obs.modified_z_score >= 3.5


def test_screening_hourly_temporary_neighbor_shortage_does_not_suppress_window():
    """Verify that an hourly shortage of comparable neighbors does not suppress the window."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(24)]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(24)]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    # Hours 3 and 7 have neighbor observations missing, causing <2 comparable neighbors at those two hours
    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={
                3060: ref_vals[i],
                3061: None if i in (3, 7) else n1_vals[i],
                3062: None if i == 7 else n2_vals[i],
            },
            contributing_stations=1 if i == 7 else (2 if i == 3 else 3),
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    # Window remains EVALUATED, NOT suppressed!
    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATED
    assert summary.suppression_reason is None

    # Hours 3 and 7 are classified as INSUFFICIENT_SPATIAL_EVIDENCE
    assert hourly[3].classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
    assert hourly[7].classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
    assert hourly[3].subclassification == "FEWER_THAN_TWO_ELIGIBLE_NEIGHBORS"
    assert hourly[7].subclassification == "FEWER_THAN_TWO_ELIGIBLE_NEIGHBORS"

    # Strict arithmetic validation
    assert summary.insufficient_evidence_hours_count == 2
    assert summary.evaluable_hours_count == 22
    assert summary.total_window_hours == 24

    # 1. evaluable strictly equals sum of 4 evaluable categories
    assert summary.evaluable_hours_count == (
        summary.concurrent_elevation_hours_count
        + summary.station_localized_elevation_hours_count
        + summary.neighbor_only_elevation_hours_count
        + summary.baseline_consistent_hours_count
    )

    # 2. total_window_hours strictly equals evaluable + insufficient
    assert summary.total_window_hours == (
        summary.evaluable_hours_count + summary.insufficient_evidence_hours_count
    )

    # 3. Explicitly verify that evaluable does NOT equal the incorrect formula
    incorrect_evaluable = (
        summary.concurrent_elevation_hours_count
        + summary.station_localized_elevation_hours_count
        + summary.neighbor_only_elevation_hours_count
        + summary.baseline_consistent_hours_count
        + summary.insufficient_evidence_hours_count
    )
    assert summary.evaluable_hours_count != incorrect_evaluable
    assert incorrect_evaluable == summary.total_window_hours


def test_screening_hourly_reference_zero_mad_at_single_timestamp():
    """Verify that a reference station with zero-MAD at an isolated hour produces INSUFFICIENT_SPATIAL_EVIDENCE."""
    t_end = BASE_TIME
    t_start = t_end - timedelta(hours=24)

    ref_vals = [40.0 + (i % 7) * 2.0 for i in range(24)]
    ref_pts = build_24h_series(ref_vals, t_end)
    ref_res = detect_air_quality_anomalies(
        location_id=3060,
        station_name="Punjabi Bagh",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=ref_pts,
        reference_time=t_end,
    )

    # Simulate an isolated zero-MAD point for the reference station at hour index 4
    ref_res.observations[4].scale_state = ScaleState.INDETERMINATE_ZERO_MAD
    ref_res.observations[4].modified_z_score = None

    n1_vals = [50.0 + (i % 7) * 2.0 for i in range(24)]
    n1_pts = build_24h_series(n1_vals, t_end)
    n1_res = detect_air_quality_anomalies(
        location_id=3061,
        station_name="Anand Vihar",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n1_pts,
        reference_time=t_end,
    )

    n2_vals = [45.0 + (i % 7) * 2.0 for i in range(24)]
    n2_pts = build_24h_series(n2_vals, t_end)
    n2_res = detect_air_quality_anomalies(
        location_id=3062,
        station_name="R.K. Puram",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=n2_pts,
        reference_time=t_end,
    )

    slices = [
        ComparisonTimeSlice(
            datetime_utc=t_start + timedelta(hours=i),
            station_values={3060: ref_vals[i], 3061: n1_vals[i], 3062: n2_vals[i]},
            contributing_stations=3,
        )
        for i in range(24)
    ]

    hourly, summary = evaluate_neighborhood_screening(
        reference_station_id=3060,
        reference_station_name="Punjabi Bagh",
        all_neighbor_ids=[3061, 3062],
        station_names={3060: "Punjabi Bagh", 3061: "Anand Vihar", 3062: "R.K. Puram"},
        time_slices=slices,
        window_preset="24h",
        reference_anomaly_result=ref_res,
        neighbor_anomaly_results={3061: n1_res, 3062: n2_res},
        measurements_by_station={3060: ref_pts, 3061: n1_pts, 3062: n2_pts},
    )

    # Hour 4 must be INSUFFICIENT_SPATIAL_EVIDENCE due to ZERO_MAD reference
    assert hourly[4].classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
    assert hourly[4].reference_eligibility == "ZERO_MAD"
    ref_excl = [e for e in hourly[4].timestamp_exclusions if e.location_id == 3060]
    assert len(ref_excl) == 1
    assert ref_excl[0].reason_code == "INDETERMINATE_ZERO_MAD"

    # Window remains EVALUATED with 23 evaluable hours
    assert summary.evaluation_status == SpatialScreeningStatus.EVALUATED
    assert summary.evaluable_hours_count == 23
    assert summary.insufficient_evidence_hours_count == 1
    assert summary.total_window_hours == 24
