"""
Automated unit and integration test suite for EcoSentinel Milestone 6 — Phase C:
Pollution Intelligence & Robust Non-Parametric Anomaly Detection Engine.

Covers:
1. Genuine isolated spike.
2. Self-contamination immunity (leave-one-out baseline independence).
3. Moderate elevation classification (2.5 <= |M| < 3.5).
4. Normal observations (|M| < 2.5).
5. Insufficient 24-hour coverage (< 18 valid observations, 75% gate).
6. Sufficient 24-hour coverage (>= 18 valid observations).
7. Insufficient 7-day coverage (< 126 valid observations, 75% gate).
8. Sufficient 7-day coverage (>= 126 valid observations).
9. Leave-one-out baseline sample count guarantees (|X_{(-i)}| >= 17 for 24h, >= 125 for 7d).
10. Zero MAD and identical observations (INDETERMINATE_ZERO_MAD without arbitrary multipliers).
11. Missing observations and gap integrity (consecutive run counter resets on >90m gap).
12. Irregular timestamps within tolerance.
13. Sensor flatline detection with known precision (INVARIABLE_MINIMUM).
14. Sensor flatline detection with unknown precision (SUSPECTED_FLATLINE).
15. Unsupported gas units (ppm/ppb) returning NOT_EVALUATED.
16. Provisional engineering rate-of-change screening with physical noise floors.
17. Decoupling of statistical anomalies from statutory CPCB exceedances.
18. Observation freshness hierarchy (FRESH, DELAYED, STALE, HISTORICAL).
19. API endpoint integration (/api/air-quality/locations/{location_id}/anomalies).
20. OpenAQ provider error handling and parameter validation.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.standards import detect_air_quality_anomalies, HEURISTIC_STEP_FLOORS
from app.main import app
from app.schemas.air_quality import (
    CoverageState,
    FlatlineStatus,
    MeasurementPoint,
    ScaleState,
)

client = TestClient(app)

FIXED_NOW = datetime(2026, 10, 31, 18, 0, 0, tzinfo=timezone.utc)


def make_measurement_point(
    value: float,
    dt_end: datetime,
    dt_start: datetime = None,
    parameter: str = "pm25",
    units: str = "µg/m³",
) -> MeasurementPoint:
    """Helper to create a validated MeasurementPoint fixture."""
    if dt_start is None:
        dt_start = dt_end - timedelta(hours=1)
    return MeasurementPoint(
        value=value,
        parameter=parameter,
        units=units,
        period_label="hour",
        interval="01:00:00",
        datetime_from_utc=dt_start,
        datetime_to_utc=dt_end,
        datetime_from_local=dt_start.isoformat(),
        datetime_to_local=dt_end.isoformat(),
        is_missing=False,
    )


# ============================================================================
# 1. Genuine Isolated Spike & Baseline Self-Contamination Immunity
# ============================================================================

def test_anomaly_detection_isolated_spike():
    """
    Verify that an isolated spike is flagged as STATISTICAL_SPIKE (|M| >= 3.5).
    23 points at 40 µg/m³ and 1 point at 180 µg/m³.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    for i in range(23):
        pt_dt = t_start + timedelta(hours=i + 1)
        points.append(make_measurement_point(40.0 + (i % 3), pt_dt))
    # Inject spike at hour 24
    points.append(make_measurement_point(180.0, t_end))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.is_coverage_satisfied is True
    assert result.coverage_state == CoverageState.SATISFIED
    assert result.valid_observations == 24
    assert result.summary.total_spikes == 1
    assert result.summary.total_anomalies_detected == 1

    spike_obs = result.observations[-1]
    assert spike_obs.is_anomaly is True
    assert spike_obs.anomaly_type == "STATISTICAL_SPIKE"
    assert spike_obs.modified_z_score is not None
    assert spike_obs.modified_z_score >= 3.5


def test_spike_self_contamination_immunity():
    """
    Verify that leave-one-out baseline derivation prevents the spike from
    inflating its own dispersion or shifting its own median (self-contamination immunity).
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # 23 normal points with gentle natural dispersion (e.g. 35 to 39 µg/m³)
    for i in range(23):
        pt_dt = t_start + timedelta(hours=i + 1)
        points.append(make_measurement_point(35.0 + (i % 5), pt_dt))
    # Massive extreme spike
    points.append(make_measurement_point(350.0, t_end))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    spike_obs = result.observations[-1]
    # In leave-one-out, the 350.0 value is excluded from its own baseline!
    # The remaining 23 values have median 37.0 and MAD ~ 1.0 - 2.0.
    assert spike_obs.independent_median is not None
    assert 35.0 <= spike_obs.independent_median <= 38.0
    assert spike_obs.independent_mad is not None
    assert spike_obs.independent_mad > 0.0
    assert spike_obs.modified_z_score is not None
    assert spike_obs.modified_z_score > 100.0  # Massive clear departure


# ============================================================================
# 2. Moderate Elevation & Normal Classifications
# ============================================================================

def test_moderate_elevation_classification():
    """
    Verify that an observation with 2.5 <= |M| < 3.5 is classified as
    MODERATE_ELEVATION, with is_anomaly=False.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # Baseline around 42, with MAD around 1.0 (NMAD = 1.4826)
    # A point with (val - 42) = 4.45 gives M = 3.0 (moderate elevation)
    for i in range(23):
        pt_dt = t_start + timedelta(hours=i + 1)
        points.append(make_measurement_point(40.0 + (i % 5), pt_dt))
    points.append(make_measurement_point(46.45, t_end))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    last_pt = result.observations[-1]
    assert last_pt.modified_z_score is not None
    assert 2.5 <= last_pt.modified_z_score < 3.5
    assert last_pt.anomaly_type == "MODERATE_ELEVATION"
    assert last_pt.is_anomaly is False  # Not a full spike
    assert result.summary.total_moderate_elevations >= 1


def test_normal_observations():
    """
    Verify that observations with |M| < 2.5 are classified as NORMAL.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = [
        make_measurement_point(45.0 + (i % 5), t_start + timedelta(hours=i + 1))
        for i in range(24)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.summary.total_anomalies_detected == 0
    assert result.summary.total_moderate_elevations == 0
    for obs in result.observations:
        assert obs.anomaly_type == "NORMAL"
        assert obs.is_anomaly is False


# ============================================================================
# 3. Window Coverage Gates: 24h (18 min) & 7d (126 min)
# ============================================================================

def test_insufficient_24h_coverage_gate():
    """
    Verify that 17 valid observations in a 24-hour window (< 75% of 24)
    suppresses evaluation with INSUFFICIENT_COVERAGE and empty observations.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = [
        make_measurement_point(45.0, t_start + timedelta(hours=i + 1))
        for i in range(17)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.is_coverage_satisfied is False
    assert result.coverage_state == CoverageState.INSUFFICIENT_COVERAGE
    assert result.valid_observations == 17
    assert result.expected_observations == 24
    assert result.completeness_percentage == 70.8
    assert result.baseline_metrics is None
    assert result.summary.evaluation_suppressed is True
    assert "Insufficient hourly observations" in result.summary.reason
    assert len(result.observations) == 0
    assert any("7 hourly observation gaps detected" in w for w in result.data_quality_warnings)


def test_sufficient_24h_coverage_gate():
    """
    Verify that exactly 18 valid observations in a 24-hour window (= 75% of 24)
    satisfies coverage and executes full anomaly evaluation.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = [
        make_measurement_point(45.0 + (i % 4), t_start + timedelta(hours=i + 1))
        for i in range(18)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.is_coverage_satisfied is True
    assert result.coverage_state == CoverageState.SATISFIED
    assert result.valid_observations == 18
    assert result.completeness_percentage == 75.0
    assert result.baseline_metrics is not None
    assert result.summary.evaluation_suppressed is False
    assert len(result.observations) == 18


def test_insufficient_7d_coverage_gate():
    """
    Verify that 125 valid observations in a 168-hour (7-day) window (< 75% of 168)
    suppresses evaluation with INSUFFICIENT_COVERAGE.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=168)
    points = [
        make_measurement_point(50.0, t_start + timedelta(hours=i + 1))
        for i in range(125)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="7d",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.is_coverage_satisfied is False
    assert result.coverage_state == CoverageState.INSUFFICIENT_COVERAGE
    assert result.valid_observations == 125
    assert result.expected_observations == 168
    assert result.completeness_percentage == 74.4
    assert result.baseline_metrics is None
    assert result.summary.evaluation_suppressed is True
    assert len(result.observations) == 0


def test_sufficient_7d_coverage_gate():
    """
    Verify that exactly 126 valid observations in a 168-hour (7-day) window (= 75% of 168)
    satisfies coverage and executes full extended anomaly evaluation.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=168)
    points = [
        make_measurement_point(50.0 + (i % 6), t_start + timedelta(hours=i + 1))
        for i in range(126)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="7d",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.is_coverage_satisfied is True
    assert result.coverage_state == CoverageState.SATISFIED
    assert result.valid_observations == 126
    assert result.completeness_percentage == 75.0
    assert result.baseline_metrics is not None
    assert len(result.observations) == 126


# ============================================================================
# 4. Zero-MAD & Scale Indeterminacy
# ============================================================================

def test_zero_mad_and_identical_observations():
    """
    Verify that when > 50% of readings are identical (MAD = 0), the engine returns
    INDETERMINATE_ZERO_MAD without fabricating arbitrary multipliers or scale constants.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    # 24 identical readings of 20.0 µg/m³
    points = [
        make_measurement_point(20.0, t_start + timedelta(hours=i + 1))
        for i in range(24)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.is_coverage_satisfied is True
    assert result.baseline_metrics is not None
    assert result.baseline_metrics.mad == 0.0
    assert result.baseline_metrics.nmad is None
    assert result.baseline_metrics.scale_state == ScaleState.INDETERMINATE_ZERO_MAD
    assert "At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0)." in result.baseline_metrics.explanation
    assert result.summary.scale_indeterminate is True
    assert result.summary.total_anomalies_detected == 0
    assert "At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0)." in result.summary.reason

    for obs in result.observations:
        assert obs.scale_state == ScaleState.INDETERMINATE_ZERO_MAD
        assert obs.modified_z_score is None
        assert obs.is_anomaly is False
        assert obs.anomaly_type is None


# ============================================================================
# 5. Missing Observations, Gaps & Consecutive Run Counter Reset
# ============================================================================

def test_consecutive_elevated_hours_gap_reset():
    """
    Verify that consecutive elevated runs reset to 1 if the gap between observations
    exceeds 90 minutes, preventing gaps from falsely creating sustained episodes.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # 18 normal points around 30.0
    for i in range(18):
        pt_dt = t_start + timedelta(hours=i + 1)
        points.append(make_measurement_point(30.0 + (i % 2), pt_dt))

    # Point 19: elevated spike at 15:00
    t_19 = t_start + timedelta(hours=19)
    points.append(make_measurement_point(150.0, t_19))

    # Introduce a 2.5-hour telemetry gap (next point at 17:30, 150 min gap > 90 min)
    t_20 = t_19 + timedelta(minutes=150)
    points.append(make_measurement_point(160.0, t_20))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    obs_19 = [o for o in result.observations if o.datetime_utc == t_19][0]
    obs_20 = [o for o in result.observations if o.datetime_utc == t_20][0]

    assert obs_19.consecutive_elevated_hours == 1
    # Because gap was 150m > 90m, consecutive counter MUST reset to 1 (not 2!)
    assert obs_20.consecutive_elevated_hours == 1
    # Did not reach 3 consecutive hours, so 0 sustained episodes
    assert result.summary.total_sustained_episodes == 0


def test_sustained_episode_counting():
    """
    Verify that 3 consecutive elevated hours with gaps <= 90 minutes increments
    total_sustained_episodes exactly once.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    for i in range(20):
        pt_dt = t_start + timedelta(hours=i + 1)
        points.append(make_measurement_point(30.0 + (i % 2), pt_dt))

    # 4 consecutive elevated hours (hours 21, 22, 23, 24)
    for i in range(4):
        pt_dt = t_start + timedelta(hours=21 + i)
        points.append(make_measurement_point(150.0 + i, pt_dt))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    elevated_obs = result.observations[-4:]
    assert elevated_obs[0].consecutive_elevated_hours == 1
    assert elevated_obs[1].consecutive_elevated_hours == 2
    assert elevated_obs[2].consecutive_elevated_hours == 3
    assert elevated_obs[3].consecutive_elevated_hours == 4
    # The distinct episode is counted once
    assert result.summary.total_sustained_episodes == 1


# ============================================================================
# 6. Sensor Flatline Screening & Precision Awareness
# ============================================================================

def test_flatline_detection_with_known_precision_invariable_min():
    """
    Verify that 6 consecutive identical readings <= sensor_precision (e.g. 1.0 µg/m³)
    are classified as INVARIABLE_MINIMUM (Baseline Invariance Near Detection Limit),
    not as suspected hardware failure.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # 18 normal fluctuating points
    for i in range(18):
        points.append(make_measurement_point(30.0 + i, t_start + timedelta(hours=i + 1)))
    # 6 consecutive identical readings at 1.0 µg/m³
    for i in range(6):
        points.append(make_measurement_point(1.0, t_start + timedelta(hours=19 + i)))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        sensor_precision=1.0,  # Known integer precision
        reference_time=t_end,
    )

    assert result.summary.flatline_indicator == FlatlineStatus.INVARIABLE_MINIMUM
    assert "instrument minimum" in result.summary.flatline_message
    flatline_pts = result.observations[-6:]
    for pt in flatline_pts:
        assert pt.suspected_flatline is False
        assert "Baseline Invariance" in pt.flatline_label


def test_flatline_detection_unknown_precision_suspected_flatline():
    """
    Verify that 6 consecutive identical non-zero readings (e.g. 142.3 µg/m³)
    with unknown sensor precision are classified as SUSPECTED_FLATLINE,
    disclosing transmission buffering/sampling arrest, without claiming confirmed failure.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    for i in range(18):
        points.append(make_measurement_point(30.0 + i, t_start + timedelta(hours=i + 1)))
    # 6 consecutive identical readings at 142.3 µg/m³
    for i in range(6):
        points.append(make_measurement_point(142.3, t_start + timedelta(hours=19 + i)))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        sensor_precision=None,  # Unknown precision
        reference_time=t_end,
    )

    assert result.precision_provenance == "UNKNOWN"
    assert result.sensor_precision is None
    assert result.summary.flatline_indicator == FlatlineStatus.SUSPECTED_FLATLINE
    assert "not confirmed hardware failure" in result.summary.flatline_message
    assert "verified sensor precision is unknown" in result.summary.flatline_message
    flatline_pts = result.observations[-6:]
    for pt in flatline_pts:
        assert pt.suspected_flatline is True
        assert pt.flatline_label == "Suspected Sensor Flatline"


# ============================================================================
# 7. Rate-of-Change Heuristics & Unsupported Units
# ============================================================================

def test_unsupported_gas_units_returns_not_evaluated():
    """
    Verify that gas concentrations in volume ratios (ppm/ppb) without temperature/pressure
    return rate_of_change_status = NOT_EVALUATED and is_heuristic_step_surge = False.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = [
        make_measurement_point(0.04 + (i * 0.005), t_start + timedelta(hours=i + 1), parameter="no2", units="ppm")
        for i in range(24)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="no2",
        parameter_display_name="NO₂",
        units="ppm",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.observations[1].rate_of_change_status == "NOT_EVALUATED"
    assert "volume ratios" in result.observations[1].rate_of_change_note
    assert result.observations[1].is_heuristic_step_surge is False
    assert result.summary.total_step_surges == 0


def test_rate_of_change_step_surge_evaluated():
    """
    Verify that a sudden jump meeting both statistical step significance (>= 2.5 * NMAD)
    and provisional noise floor (20.0 µg/m³ for PM2.5) flags is_heuristic_step_surge.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # Stable baseline around 40, tiny variations of 1 µg/m³
    for i in range(23):
        points.append(make_measurement_point(40.0 + (i % 2), t_start + timedelta(hours=i + 1)))
    # Sudden step jump of +45 µg/m³ from hour 23 to 24 (well above 20.0 floor)
    points.append(make_measurement_point(85.0, t_end))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    last_pt = result.observations[-1]
    assert last_pt.rate_of_change_status == "EVALUATED"
    assert last_pt.step_change_from_prior == 45.0
    assert last_pt.is_heuristic_step_surge is True
    assert result.summary.total_step_surges >= 1


def test_rate_of_change_below_floor_suppressed():
    """
    Verify that a step change meeting statistical criteria but failing the physical
    floor (e.g. 15.0 < 20.0 µg/m³ floor for PM2.5) does NOT trigger step surge alert.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # Perfectly calm ambient air (variations of 0.1 µg/m³)
    for i in range(23):
        points.append(make_measurement_point(20.0 + (i % 2) * 0.1, t_start + timedelta(hours=i + 1)))
    # Jump of 15.0 µg/m³ (statistically large relative to 0.1, but below 20.0 physical floor)
    points.append(make_measurement_point(35.0, t_end))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    last_pt = result.observations[-1]
    assert last_pt.step_change_from_prior == 15.0
    assert last_pt.is_heuristic_step_surge is False


def test_rate_of_change_self_contamination_immunity():
    """
    Verify that an acute step change (+80 µg/m³) is excluded from its own leave-one-out
    differences baseline, preventing the jump from inflating MAD_delta and masking itself.
    """
    import math

    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # 23 points around 40 µg/m³ with natural varying differences
    for i in range(23):
        pt_dt = t_start + timedelta(hours=i + 1)
        val = 40.0 + round(math.sin(i * 0.8) * 3.5, 2)
        points.append(make_measurement_point(val, pt_dt))
    # Acute step jump of +80 µg/m³ at hour 24 relative to hour 23
    last_val = points[-1].value + 80.0
    points.append(make_measurement_point(last_val, t_end))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    last_pt = result.observations[-1]
    assert last_pt.rate_of_change_status == "EVALUATED"
    assert last_pt.step_change_from_prior == 80.0
    # Because +80 is excluded from the leave-one-out differences baseline, the baseline NMAD_delta
    # remains uncontaminated, easily classifying the +80 jump as a step surge.
    assert last_pt.is_heuristic_step_surge is True


def test_rate_of_change_gaps_exceeding_90_minutes_excluded():
    """
    Verify that adjacent differences across gaps > 90 minutes are excluded,
    returning NOT_EVALUATED for step change on the post-gap observation.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # 18 points with normal 1h spacing
    for i in range(18):
        points.append(make_measurement_point(35.0 + (i % 2), t_start + timedelta(hours=i + 1)))

    # Point 19: 150-minute gap from point 18
    t_post_gap = points[-1].datetime_to_utc + timedelta(minutes=150)
    points.append(make_measurement_point(70.0, t_post_gap))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    post_gap_obs = result.observations[-1]
    assert post_gap_obs.step_change_from_prior is None
    assert post_gap_obs.rate_of_change_status == "NOT_EVALUATED"
    assert "no prior adjacent observation within 90 minutes" in post_gap_obs.rate_of_change_note
    assert post_gap_obs.is_heuristic_step_surge is False


def test_rate_of_change_insufficient_differences_not_evaluated():
    """
    Verify that when the count of valid adjacent differences in the leave-one-out baseline
    is below the defensible minimum threshold (< 12 differences), step change screening
    returns NOT_EVALUATED.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # Create 18 points but with multiple 2-hour gaps such that valid adjacent pairs (< 90m) is only 8
    # Point pairs: (1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16), (17, 18)
    curr_t = t_start + timedelta(hours=1)
    for pair in range(9):
        points.append(make_measurement_point(40.0, curr_t))
        curr_t += timedelta(minutes=60)
        points.append(make_measurement_point(42.0, curr_t))
        curr_t += timedelta(minutes=120)  # 2h gap between pairs

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    # 18 valid points, but only 9 adjacent pairs, so loo_diffs has 8 differences < 12
    for obs in result.observations:
        assert obs.rate_of_change_status == "NOT_EVALUATED"
        assert obs.is_heuristic_step_surge is False
        if obs.step_change_from_prior is not None:
            assert "insufficient adjacent observation pairs" in obs.rate_of_change_note


def test_rate_of_change_zero_dispersion_differences_not_evaluated():
    """
    Verify that when baseline step differences have zero dispersion (MAD_delta = 0),
    rate of change screening returns NOT_EVALUATED without inventing an arbitrary scale.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    # Series with perfectly identical steps of +2.0 µg/m³ every hour (all differences = 2.0, MAD_delta = 0)
    points = [
        make_measurement_point(30.0 + (i * 2.0), t_start + timedelta(hours=i + 1))
        for i in range(24)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    for obs in result.observations[1:]:
        assert obs.rate_of_change_status == "NOT_EVALUATED"
        assert "zero dispersion (MAD_Δ = 0)" in obs.rate_of_change_note
        assert obs.is_heuristic_step_surge is False


def test_sensor_precision_caller_supplied_semantics():
    """
    Verify that caller-supplied precision is never represented as verified metadata,
    is explicitly labeled CALLER_SUPPLIED, and does not claim verified near-detection-limit.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    for i in range(18):
        points.append(make_measurement_point(30.0 + i, t_start + timedelta(hours=i + 1)))
    # 6 identical readings of 2.0 µg/m³
    for i in range(6):
        points.append(make_measurement_point(2.0, t_start + timedelta(hours=19 + i)))

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        sensor_precision=2.0,
        precision_provenance="CALLER_SUPPLIED",
        reference_time=t_end,
    )

    assert result.sensor_precision == 2.0
    assert result.precision_provenance == "CALLER_SUPPLIED"
    assert result.summary.flatline_indicator == FlatlineStatus.INVARIABLE_MINIMUM
    assert "Precision was supplied by the caller and is not verified against authoritative sensor metadata" in result.summary.flatline_message
    assert "Caller-Supplied Limit: 2.0 µg/m³" in result.observations[-1].flatline_label


def test_7d_window_evaluates_entire_168h_interval():
    """
    Verify that the 7-day window covers the complete 168-hour evaluation interval,
    evaluating every individual observation against a leave-one-out baseline of
    the remaining valid observations in the 168-hour window.
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=168)
    points = [
        make_measurement_point(40.0 + (i % 8), t_start + timedelta(hours=i + 1))
        for i in range(168)
    ]

    result = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="7d",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )

    assert result.window_preset == "7d"
    assert result.expected_observations == 168
    assert result.valid_observations == 168
    assert result.completeness_percentage == 100.0
    assert result.is_coverage_satisfied is True
    assert len(result.observations) == 168

    # Each observation is evaluated with leave-one-out baseline size 167 (>= 125)
    for obs in result.observations:
        assert obs.independent_median is not None
        assert obs.scale_state == ScaleState.VALID
        assert obs.modified_z_score is not None


# ============================================================================
# 8. Decoupling: Statistical Anomalies vs. Statutory CPCB Exceedances
# ============================================================================

def test_decoupling_statistical_anomaly_vs_cpcb_exceedance():
    """
    Verify that:
    1. A point above CPCB standard (e.g. 65 µg/m³) in a typical polluted baseline is a
       CPCB exceedance (is_cpcb_exceedance=True) but NOT an anomaly (NORMAL).
    2. A point below CPCB standard (e.g. 48 µg/m³) in a clean baseline (median 10) is a
       statistical spike (is_anomaly=True) but NOT a CPCB exceedance (is_cpcb_exceedance=False).
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)

    # Case 1: High baseline around 64 µg/m³
    points_high = [
        make_measurement_point(64.0 + (i % 3), t_start + timedelta(hours=i + 1))
        for i in range(23)
    ]
    points_high.append(make_measurement_point(65.0, t_end))

    res_high = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points_high,
        reference_time=t_end,
    )

    pt_high = res_high.observations[-1]
    assert pt_high.is_cpcb_exceedance is True  # 65 > 60 CPCB standard
    assert pt_high.is_anomaly is False         # Completely normal in a 64 baseline
    assert pt_high.anomaly_type == "NORMAL"

    # Case 2: Clean baseline around 10 µg/m³
    points_clean = [
        make_measurement_point(10.0 + (i % 5), t_start + timedelta(hours=i + 1))
        for i in range(23)
    ]
    points_clean.append(make_measurement_point(48.0, t_end))

    res_clean = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points_clean,
        reference_time=t_end,
    )

    pt_clean = res_clean.observations[-1]
    assert pt_clean.is_cpcb_exceedance is False  # 48 < 60 CPCB standard
    assert pt_clean.is_anomaly is True          # Huge anomaly relative to 10
    assert pt_clean.anomaly_type == "STATISTICAL_SPIKE"


# ============================================================================
# 9. Freshness Hierarchy & Attribution Boundary
# ============================================================================

def test_freshness_hierarchy_and_attribution_boundary():
    """
    Verify FRESH (<= 3h), DELAYED (3-24h), STALE (> 24h), and HISTORICAL (> 30d).
    Also verify attribution disclaimer.
    """
    t_now = datetime.now(timezone.utc)
    t_start = t_now - timedelta(hours=24)
    points = [
        make_measurement_point(30.0 + (i % 3), t_start + timedelta(hours=i + 1))
        for i in range(24)
    ]

    # Fresh: 2 hours ago
    res_fresh = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_now,
        raw_observations=points,
        sensor_datetime_last_utc=t_now - timedelta(hours=2),
    )
    assert res_fresh.freshness_state == "FRESH"
    assert "within 3h telemetry cycle" in res_fresh.freshness_message
    assert "does not establish emission sources" in res_fresh.attribution_disclaimer

    # Delayed: 6 hours ago
    res_delayed = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_now,
        raw_observations=points,
        sensor_datetime_last_utc=t_now - timedelta(hours=6),
    )
    assert res_delayed.freshness_state == "DELAYED"

    # Stale: 48 hours ago
    res_stale = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_now,
        raw_observations=points,
        sensor_datetime_last_utc=t_now - timedelta(hours=48),
    )
    assert res_stale.freshness_state == "STALE"

    # Historical: 45 days ago
    res_hist = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_now,
        raw_observations=points,
        sensor_datetime_last_utc=t_now - timedelta(days=45),
    )
    assert res_hist.freshness_state == "HISTORICAL"


# ============================================================================
# 10. API Route Integration & Upstream Error Handling
# ============================================================================

@pytest.mark.anyio
async def test_anomalies_endpoint_success():
    """
    Test GET /api/air-quality/locations/8118/anomalies with mocked OpenAQ data.
    """
    from app.services.openaq import openaq_service
    from app.schemas.air_quality import LocationDetail, LocationMeasurementsResponse

    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    pts = [
        make_measurement_point(40.0 + (i % 3), t_start + timedelta(hours=i + 1))
        for i in range(24)
    ]

    mock_loc = LocationDetail(
        id=8118,
        name="Anand Vihar, Delhi - DPCC",
        locality="Delhi",
        country_code="IN",
        country_name="India",
        provider_name="CPCB",
        is_monitor=True,
        available_parameters=["pm25"],
        datetime_last_utc=t_end,
        sensors=[],
    )

    mock_meas = LocationMeasurementsResponse(
        location_id=8118,
        station_name="Anand Vihar, Delhi - DPCC",
        provider_name="CPCB",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        sensor_id=101,
        sensor_datetime_last_utc=t_end,
        requested_from_utc=t_start,
        requested_to_utc=t_end,
        retrieved_at_utc=t_end,
        total_observations=24,
        measurements=pts,
    )

    with patch.object(openaq_service, "get_location_detail", AsyncMock(return_value=mock_loc)):
        with patch.object(openaq_service, "get_measurements", AsyncMock(return_value=mock_meas)):
            ref_str = t_end.strftime("%Y-%m-%dT%H:%M:%SZ")
            resp = client.get(f"/api/air-quality/locations/8118/anomalies?parameter=pm25&window=24h&reference_time={ref_str}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["location_id"] == 8118
            assert data["station_name"] == "Anand Vihar, Delhi - DPCC"
            assert data["parameter"] == "pm25"
            assert data["window_preset"] == "24h"
            assert data["is_coverage_satisfied"] is True
            assert len(data["observations"]) == 24


def test_anomalies_endpoint_invalid_window_rejection():
    """
    Verify rejection of unsupported window preset with HTTP 400.
    """
    resp = client.get("/api/air-quality/locations/8118/anomalies?window=30d")
    assert resp.status_code == 400
    assert "Expected '24h' or '7d'" in resp.json()["message"]


def test_leave_one_out_sample_counts_guarantee():
    """
    Verify that in both 24h and 7d configurations, each observation point is
    evaluated against a baseline having exactly N-1 observations (>= 17 for 24h, >= 125 for 7d).
    """
    t_end = FIXED_NOW
    t_start_24h = t_end - timedelta(hours=24)
    points_24h = [
        make_measurement_point(40.0 + (i % 5), t_start_24h + timedelta(hours=i + 1))
        for i in range(18)
    ]
    res_24h = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start_24h,
        window_end_utc=t_end,
        raw_observations=points_24h,
        reference_time=t_end,
    )
    # Exactly 18 valid observations, each evaluated against N - 1 = 17 baseline observations
    assert len(res_24h.observations) == 18
    for obs in res_24h.observations:
        assert obs.independent_median is not None
        assert obs.scale_state == ScaleState.VALID

    t_start_7d = t_end - timedelta(hours=168)
    points_7d = [
        make_measurement_point(40.0 + (i % 7), t_start_7d + timedelta(hours=i + 1))
        for i in range(126)
    ]
    res_7d = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="7d",
        window_start_utc=t_start_7d,
        window_end_utc=t_end,
        raw_observations=points_7d,
        reference_time=t_end,
    )
    # Exactly 126 valid observations, each evaluated against N - 1 = 125 baseline observations
    assert len(res_7d.observations) == 126
    for obs in res_7d.observations:
        assert obs.independent_median is not None
        assert obs.scale_state == ScaleState.VALID


def test_irregular_timestamps():
    """
    Verify handling of non-uniform timestamps within tolerance (e.g. 45m, 60m, 75m).
    """
    t_end = FIXED_NOW
    t_start = t_end - timedelta(hours=24)
    points = []
    # 20 observations spaced irregularly between 45 and 75 minutes
    curr_t = t_start + timedelta(minutes=60)
    idx = 0
    while curr_t <= t_end and len(points) < 20:
        points.append(make_measurement_point(45.0 + (idx % 4), curr_t))
        interval_min = 50 + (idx % 3) * 10  # 50m, 60m, 70m
        curr_t += timedelta(minutes=interval_min)
        idx += 1

    res = detect_air_quality_anomalies(
        location_id=8118,
        station_name="Anand Vihar, Delhi",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units="µg/m³",
        window_preset="24h",
        window_start_utc=t_start,
        window_end_utc=t_end,
        raw_observations=points,
        reference_time=t_end,
    )
    assert res.is_coverage_satisfied is True
    assert res.valid_observations == len(points)
    assert len(res.observations) == len(points)


@pytest.mark.anyio
async def test_anomalies_endpoint_provider_missing_key():
    """
    Verify OpenAQMissingKeyError returns HTTP 503 with structured instructions.
    """
    from app.services.openaq import openaq_service, OpenAQMissingKeyError

    with patch.object(openaq_service, "detect_anomalies", AsyncMock(side_effect=OpenAQMissingKeyError())):
        resp = client.get("/api/air-quality/locations/8118/anomalies")
        assert resp.status_code == 503
        data = resp.json()
        assert data["error_code"] == "MISSING_API_KEY"
        assert "explore.openaq.org" in data["instructions"]


@pytest.mark.anyio
async def test_anomalies_endpoint_provider_upstream_error():
    """
    Verify upstream OpenAQ failures return HTTP 502 with error details.
    """
    from app.services.openaq import openaq_service, OpenAQServiceError

    with patch.object(openaq_service, "detect_anomalies", AsyncMock(side_effect=OpenAQServiceError("Upstream timeout", 502, "UPSTREAM_TIMEOUT"))):
        resp = client.get("/api/air-quality/locations/8118/anomalies")
        assert resp.status_code == 502
        data = resp.json()
        assert data["error_code"] == "UPSTREAM_TIMEOUT"
        assert "Upstream timeout" in data["message"]


@pytest.mark.anyio
async def test_anomalies_endpoint_not_found():
    """
    Verify 404 is returned when location does not exist.
    """
    from app.services.openaq import openaq_service, OpenAQServiceError

    with patch.object(openaq_service, "detect_anomalies", AsyncMock(side_effect=OpenAQServiceError("Station 99999 not found", 404, "STATION_NOT_FOUND"))):
        resp = client.get("/api/air-quality/locations/99999/anomalies")
        assert resp.status_code == 404
        data = resp.json()
        assert data["error_code"] == "STATION_NOT_FOUND"
