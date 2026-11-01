"""
Statutory and international reference standards for criteria air pollutants.

Primary Sources:
1. Central Pollution Control Board (CPCB) National Ambient Air Quality Standards (NAAQS),
   Ministry of Environment, Forest and Climate Change, Notification G.S.R. 826(E),
   dated 16th November, 2009 (Gazette of India, Extraordinary).
   URL: https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf
   Applicable for: Industrial, Residential, Rural and other Areas (24-hour and 8-hour standards).

2. World Health Organization (WHO) Global Air Quality Guidelines (AQG), 2021 Update.
   URL: https://www.who.int/publications/i/item/9789240034228/
   Health-based global guidelines (not Indian statutory limits).
"""

from datetime import datetime, timedelta, timezone
import statistics
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.schemas.air_quality import (
    AirQualityAnomalyResponse,
    AnomalyObservationPoint,
    AnomalySummary,
    BaselineMetrics,
    CoverageState,
    DustControlGuidance,
    EmissionFactorMetadata,
    FlatlineStatus,
    IdlingAbatementResponse,
    MeasurementPoint,
    ScaleState,
)


class StandardBenchmark(BaseModel):
    """Statutory or guideline threshold benchmark."""
    name: str
    threshold: float
    unit: str
    averaging_period_hours: int
    averaging_period_label: str
    source_url: str
    is_statutory_indian_limit: bool
    notes: Optional[str] = None


class PollutantStandardConfig(BaseModel):
    """Complete standards configuration for a pollutant."""
    parameter: str
    display_name: str
    averaging_period_hours: int
    averaging_period_label: str
    supported_units: List[str]
    cpcb_standard: StandardBenchmark
    who_guideline: Optional[StandardBenchmark] = None
    unit_conversion_notes: Optional[str] = None


class MitigationAdvisoryTemplate(BaseModel):
    """Practical, reviewed mitigation action template."""
    category: str
    action: str
    rationale: str
    uncertainty: str


# CPCB NAAQS 2009 Reference URL
CPCB_NAAQS_URL = "https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf"
# WHO 2021 Guidelines Reference URL
WHO_AQG_URL = "https://www.who.int/publications/i/item/9789240034228/"


VERIFIED_STANDARDS: Dict[str, PollutantStandardConfig] = {
    "pm25": PollutantStandardConfig(
        parameter="pm25",
        display_name="PM2.5",
        averaging_period_hours=24,
        averaging_period_label="24-hour",
        supported_units=["µg/m³", "ug/m3", "µg/m3"],
        cpcb_standard=StandardBenchmark(
            name="CPCB NAAQS (2009)",
            threshold=60.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=CPCB_NAAQS_URL,
            is_statutory_indian_limit=True,
            notes="CPCB 24-hour standard for Industrial, Residential, Rural and other Areas.",
        ),
        who_guideline=StandardBenchmark(
            name="WHO AQG (2021)",
            threshold=15.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=WHO_AQG_URL,
            is_statutory_indian_limit=False,
            notes="WHO 24-hour health-based air quality guideline (international benchmark, not Indian statutory limit).",
        ),
    ),
    "pm10": PollutantStandardConfig(
        parameter="pm10",
        display_name="PM10",
        averaging_period_hours=24,
        averaging_period_label="24-hour",
        supported_units=["µg/m³", "ug/m3", "µg/m3"],
        cpcb_standard=StandardBenchmark(
            name="CPCB NAAQS (2009)",
            threshold=100.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=CPCB_NAAQS_URL,
            is_statutory_indian_limit=True,
            notes="CPCB 24-hour standard for Industrial, Residential, Rural and other Areas.",
        ),
        who_guideline=StandardBenchmark(
            name="WHO AQG (2021)",
            threshold=45.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=WHO_AQG_URL,
            is_statutory_indian_limit=False,
            notes="WHO 24-hour health-based air quality guideline.",
        ),
    ),
    "no2": PollutantStandardConfig(
        parameter="no2",
        display_name="NO₂",
        averaging_period_hours=24,
        averaging_period_label="24-hour",
        supported_units=["µg/m³", "ug/m3", "µg/m3"],
        cpcb_standard=StandardBenchmark(
            name="CPCB NAAQS (2009)",
            threshold=80.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=CPCB_NAAQS_URL,
            is_statutory_indian_limit=True,
            notes="CPCB 24-hour standard for Nitrogen Dioxide.",
        ),
        who_guideline=StandardBenchmark(
            name="WHO AQG (2021)",
            threshold=25.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=WHO_AQG_URL,
            is_statutory_indian_limit=False,
            notes="WHO 24-hour health-based guideline.",
        ),
    ),
    "so2": PollutantStandardConfig(
        parameter="so2",
        display_name="SO₂",
        averaging_period_hours=24,
        averaging_period_label="24-hour",
        supported_units=["µg/m³", "ug/m3", "µg/m3"],
        cpcb_standard=StandardBenchmark(
            name="CPCB NAAQS (2009)",
            threshold=80.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=CPCB_NAAQS_URL,
            is_statutory_indian_limit=True,
            notes="CPCB 24-hour standard for Sulfur Dioxide.",
        ),
        who_guideline=StandardBenchmark(
            name="WHO AQG (2021)",
            threshold=40.0,
            unit="µg/m³",
            averaging_period_hours=24,
            averaging_period_label="24-hour",
            source_url=WHO_AQG_URL,
            is_statutory_indian_limit=False,
            notes="WHO 24-hour health-based guideline.",
        ),
    ),
    "o3": PollutantStandardConfig(
        parameter="o3",
        display_name="Ozone (O₃)",
        averaging_period_hours=8,
        averaging_period_label="8-hour",
        supported_units=["µg/m³", "ug/m3", "µg/m3"],
        cpcb_standard=StandardBenchmark(
            name="CPCB NAAQS (2009)",
            threshold=100.0,
            unit="µg/m³",
            averaging_period_hours=8,
            averaging_period_label="8-hour",
            source_url=CPCB_NAAQS_URL,
            is_statutory_indian_limit=True,
            notes="CPCB 8-hour standard for Ozone (100 µg/m³). Note: CPCB also defines a 1-hour standard of 180 µg/m³.",
        ),
        who_guideline=StandardBenchmark(
            name="WHO AQG (2021)",
            threshold=100.0,
            unit="µg/m³",
            averaging_period_hours=8,
            averaging_period_label="8-hour",
            source_url=WHO_AQG_URL,
            is_statutory_indian_limit=False,
            notes="WHO 8-hour daily maximum air quality guideline.",
        ),
    ),
    "co": PollutantStandardConfig(
        parameter="co",
        display_name="Carbon Monoxide (CO)",
        averaging_period_hours=8,
        averaging_period_label="8-hour",
        supported_units=["mg/m³", "mg/m3", "µg/m³", "ug/m3"],
        cpcb_standard=StandardBenchmark(
            name="CPCB NAAQS (2009)",
            threshold=2.0,
            unit="mg/m³",
            averaging_period_hours=8,
            averaging_period_label="8-hour",
            source_url=CPCB_NAAQS_URL,
            is_statutory_indian_limit=True,
            notes="CPCB 8-hour standard for CO is 2.0 mg/m³ (equivalent to 2000 µg/m³).",
        ),
        who_guideline=None,  # WHO 2021 CO guideline is 4 mg/m³ for a 24-hour period; comparing it to an 8-hour average is invalid.
        unit_conversion_notes=(
            "CO thresholds are defined in mg/m³ (2.0 mg/m³) and µg/m³ (2000 µg/m³). "
            "Sensors reporting in ppm cannot be converted to mg/m³ without local ambient temperature and pressure metadata."
        ),
    ),
}


REVIEWED_ADVISORIES: Dict[str, List[MitigationAdvisoryTemplate]] = {
    "pm25": [
        MitigationAdvisoryTemplate(
            category="Fleet & Logistics",
            action="Review and enforce site anti-idling protocols at vehicle loading and unloading bays.",
            rationale="Heavy diesel vehicle idling concentrates fine combustion particulates (PM2.5) in the immediate facility breathing zone; curtailing idle run time eliminates avoidable localized emissions.",
            uncertainty="The monitor measures regional and local ambient concentration; the reduction magnitude depends on site-specific fleet volume and prevailing atmospheric ventilation.",
        ),
        MitigationAdvisoryTemplate(
            category="Ventilation Maintenance",
            action="Check facility air-handling intake filters and inspect mechanical seals under existing standard operating procedures.",
            rationale="Elevated outdoor PM2.5 can penetrate building envelopes; ensuring filter seals are intact helps prevent particulate infiltration into occupied spaces.",
            uncertainty="Filtration efficacy depends on building envelope airtightness and filter MERV ratings; universal damper adjustments are not recommended without HVAC engineering review.",
        ),
        MitigationAdvisoryTemplate(
            category="Municipal Coordination",
            action="Check applicable Graded Response Action Plan (GRAP) stage orders or local municipal air quality advisories for active operational restrictions.",
            rationale="During high particulate episodes, state pollution control boards issue statutory orders (e.g. restrictions on diesel generator testing or road sweeping frequency) that site managers must verify.",
            uncertainty="Municipal directives vary by state and city jurisdiction; local environmental officer confirmation is required.",
        ),
    ],
    "pm10": [
        MitigationAdvisoryTemplate(
            category="Fugitive Dust Control",
            action="Review on-site fugitive dust-control practices, including surface wetting on unpaved access paths and verifying covers on dry aggregate stockpiles.",
            rationale="PM10 is heavily influenced by mechanically generated dust and surface resuspension; surface wetting and physical covers suppress particle lift-off.",
            uncertainty="Local wind gusts can transport dust from adjacent off-site construction or unpaved shoulders outside facility boundaries.",
        ),
        MitigationAdvisoryTemplate(
            category="Site Operations",
            action="Verify that vehicle wash-down stations at facility egress points are active to prevent tracking soil onto public paved roadways.",
            rationale="Tracked sediment dries and is crushed by vehicle tires into coarse airborne particles; wash-down bays mitigate roadway tracking.",
            uncertainty="Effectiveness relies on driver compliance and regular water sediment pit maintenance.",
        ),
    ],
    "no2": [
        MitigationAdvisoryTemplate(
            category="Fleet Scheduling",
            action="Check vehicle staging areas and stagger heavy transport departure schedules to reduce queue congestion.",
            rationale="Nitrogen dioxide peaks during intense stop-and-go diesel traffic; smoothing logistics flow avoids high-emission congestion spikes.",
            uncertainty="NO2 rapidly oxidizes and disperses based on ambient sunlight, ozone levels, and wind speed; source attribution cannot be isolated to a single fleet.",
        ),
        MitigationAdvisoryTemplate(
            category="Combustion Equipment",
            action="Review scheduled stationary combustion equipment maintenance and check burner tuning logs under site SOPs.",
            rationale="Poorly tuned burners or diesel generators run fuel-rich and emit significantly higher NOX concentrations.",
            uncertainty="Monitor readings reflect regional traffic and urban background in addition to stationary on-site equipment.",
        ),
    ],
    "so2": [
        MitigationAdvisoryTemplate(
            category="Fuel Verification",
            action="Verify fuel quality documentation for on-site boilers or backup generators to confirm low-sulfur specification compliance.",
            rationale="Sulfur dioxide emissions are directly proportional to fuel sulfur content; confirming compliant fuel prevents high-sulfur flue gas discharge.",
            uncertainty="SO2 in industrial corridors often originates from upwind thermal power plants or industrial clusters; monitor cannot determine point of origin.",
        ),
    ],
    "o3": [
        MitigationAdvisoryTemplate(
            category="Work Schedule Coordination",
            action="Review schedules for outdoor physical labor during peak afternoon solar radiation hours (12:00 PM – 4:00 PM).",
            rationale="Ground-level ozone is secondary photochemical smog generated by solar radiation acting on NOX and VOCs; concentration peaks during mid-afternoon sun.",
            uncertainty="Ozone formation depends strongly on solar irradiance, temperature, and regional precursor transport over tens of kilometers.",
        ),
    ],
    "co": [
        MitigationAdvisoryTemplate(
            category="Enclosed Space Ventilation",
            action="Inspect mechanical exhaust ventilation in enclosed parking decks, underground loading bays, and generator rooms.",
            rationale="Carbon monoxide is an odorless product of incomplete combustion that can accumulate dangerously in poorly ventilated enclosures.",
            uncertainty="Outdoor ambient monitors measure street-level concentrations, which may differ from indoor or enclosed chamber levels.",
        ),
    ],
}


# Canonical Publication Reference URLs for Abatement & Conservation
CRRI_STUDY_URL = "https://crridom.gov.in"
IPCC_MOBILE_GHG_URL = "https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html"
US_EPA_IDLING_FACT_SHEET_URL = "https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1001Y01.txt"
PCRA_CONSERVATION_URL = "https://pcra.org"
US_EPA_AP42_URL = "https://www.epa.gov/air-emissions-factors-and-quantification-tools/ap-42-fifth-edition-volume-i-chapter-13-miscellaneous-0"
CPCB_DUST_GUIDELINES_URL = "https://cpcb.gov.in"


def calculate_idling_abatement(vehicles: int, hours: float) -> IdlingAbatementResponse:
    """
    Canonical evidence-backed calculation of potential emissions avoided from heavy vehicle anti-idling.

    Input constraints:
    - vehicles: integer, 1 to 200
    - hours: float, 0.5 to 12.0

    Rejection policy:
    - Never silently clamp invalid inputs. Raises ValueError if out of bounds.

    Planning factors (conservative baseline for hot-stabilized curb idle):
    - Fuel: 1.0 L/vehicle-hour (CSIR-CRRI Delhi study)
    - CO2: 2.68 kg/vehicle-hour (2006 IPCC Guidelines / stoichiometric diesel balance)
    - NOx: 33.8 g/vehicle-hour (0.0338 kg/vehicle-hour) (US EPA EPA420-F-08-025 Table 1)
    - PM2.5: 1.1 g/vehicle-hour (US EPA EPA420-F-08-025 Table 1)
    """
    if not isinstance(vehicles, int) or isinstance(vehicles, bool) or vehicles < 1 or vehicles > 200:
        raise ValueError(f"Vehicle count must be an integer between 1 and 200 (received {vehicles}).")
    if not isinstance(hours, (int, float)) or hours < 0.5 or hours > 12.0:
        raise ValueError(f"Curtailed idling hours per vehicle must be between 0.5 and 12.0 hours (received {hours}).")

    total_vehicle_hours = round(float(vehicles) * float(hours), 2)
    avoided_fuel_liters = round(total_vehicle_hours * 1.0, 2)
    avoided_co2_kg = round(total_vehicle_hours * 2.68, 2)
    avoided_nox_kg = round((total_vehicle_hours * 33.8) / 1000.0, 3)
    avoided_nox_grams = round(total_vehicle_hours * 33.8, 1)
    avoided_pm25_grams = round(total_vehicle_hours * 1.1, 2)

    factors = [
        EmissionFactorMetadata(
            metric="Fuel Consumption",
            factor_value=1.0,
            unit="L/vehicle-hour",
            provenance="CRRI empirical truck-idling measurements; conservative planning value.",
            source_title="Assessment of idling fuel consumption and emissions of vehicles at signalized intersections in Delhi",
            source_url=CRRI_STUDY_URL,
            notes="Empirical fuel flow measurements on in-use commercial diesel trucks under hot-stabilized idle in Delhi (167 mL / 10 min = 1.002 L/h)."
        ),
        EmissionFactorMetadata(
            metric="Carbon Dioxide (CO2)",
            factor_value=2.68,
            unit="kg/vehicle-hour",
            provenance="Derived using diesel carbon stoichiometry (density ~0.835 kg/L, ~86% carbon mass fraction) and IPCC methodology.",
            source_title="2006 IPCC Guidelines for National Greenhouse Gas Inventories, Vol 2: Energy, Ch 3: Mobile Combustion",
            source_url=IPCC_MOBILE_GHG_URL,
            notes="Stoichiometric carbon balance for commercial diesel fuel: 1.0 L * 0.835 kg/L * 0.86 C * 44/12 = 2.68 kg CO2/L."
        ),
        EmissionFactorMetadata(
            metric="Nitrogen Oxides (NOx)",
            factor_value=33.8,
            unit="g/vehicle-hour",
            provenance="US EPA EPA420-F-08-025 model-derived factor (33.763 g/hr for Heavy-Duty Diesel Vehicles). NOT an in-use Indian tailpipe measurement.",
            source_title="US EPA Fact Sheet EPA420-F-08-025: Idling Vehicle Emissions for Passenger Cars, Light-Duty Trucks, and Heavy-Duty Trucks (Table 1)",
            source_url=US_EPA_IDLING_FACT_SHEET_URL,
            notes="US EPA MOBILE6.2/MOVES fleet baseline rate of 33.763 g/hr (0.563 g/min) for Heavy-Duty Diesel Vehicles."
        ),
        EmissionFactorMetadata(
            metric="Fine Particulate Matter (PM2.5)",
            factor_value=1.1,
            unit="g/vehicle-hour",
            provenance="US EPA EPA420-F-08-025 model-derived factor (1.09–1.12 g/hr for Heavy-Duty Diesel Vehicles). NOT an in-use Indian tailpipe measurement.",
            source_title="US EPA Fact Sheet EPA420-F-08-025: Idling Vehicle Emissions for Passenger Cars, Light-Duty Trucks, and Heavy-Duty Trucks (Table 1)",
            source_url=US_EPA_IDLING_FACT_SHEET_URL,
            notes="US EPA baseline rate of 1.09–1.12 g/hr for in-use heavy-duty diesel engines."
        ),
    ]

    assumptions = [
        "Estimates reflect a simplified hot-stabilized curb-idling assumption (600–700 RPM) for in-use commercial diesel vehicles.",
        "Calculations do not account for auxiliary power take-off (PTO) loads or mechanical air-conditioning loads, which elevate fuel burn.",
        "Emissions vary significantly across vehicle gross weights, maintenance conditions, and Bharat Stage (BS) emission standards.",
        "Modern BS-VI vehicles equipped with functional Diesel Particulate Filters (DPFs) have substantially lower particulate emissions during steady operation, whereas older BS-III and BS-IV mechanical injection fleets produce higher particulate matter and unburned hydrocarbons.",
        "Factors must not be interpreted as universal empirical measurements for every Indian vehicle.",
    ]

    return IdlingAbatementResponse(
        vehicles=vehicles,
        hours=hours,
        total_vehicle_hours=total_vehicle_hours,
        avoided_fuel_liters=avoided_fuel_liters,
        avoided_co2_kg=avoided_co2_kg,
        avoided_nox_kg=avoided_nox_kg,
        avoided_nox_grams=avoided_nox_grams,
        avoided_pm25_grams=avoided_pm25_grams,
        factors=factors,
        dust_guidance=DustControlGuidance(),
        assumptions=assumptions,
    )


# Heuristic provisional engineering noise floors (acute rapid jump floor)
HEURISTIC_STEP_FLOORS: Dict[str, Dict[str, float]] = {
    "pm25": {"µg/m³": 20.0, "ug/m3": 20.0, "µg/m3": 20.0},
    "pm10": {"µg/m³": 35.0, "ug/m3": 35.0, "µg/m3": 35.0},
    "no2":  {"µg/m³": 20.0, "ug/m3": 20.0, "µg/m3": 20.0},
    "so2":  {"µg/m³": 20.0, "ug/m3": 20.0, "µg/m3": 20.0},
    "o3":   {"µg/m³": 25.0, "ug/m3": 25.0, "µg/m3": 25.0},
    "co":   {"mg/m³": 0.5, "mg/m3": 0.5, "µg/m³": 500.0, "ug/m3": 500.0, "µg/m3": 500.0},
}


def _get_tz(tz_name: Optional[str] = "Asia/Kolkata") -> timezone:
    """Returns a timezone object, defaulting to IST (+05:30)."""
    if tz_name and tz_name.strip():
        norm = tz_name.strip()
        if norm in ("Asia/Kolkata", "Asia/Calcutta", "IST"):
            return timezone(timedelta(hours=5, minutes=30))
        try:
            from zoneinfo import ZoneInfo
            return ZoneInfo(norm)
        except Exception:
            pass
    return timezone(timedelta(hours=5, minutes=30))


def _to_local_str(dt_utc: datetime, tz_name: Optional[str] = "Asia/Kolkata") -> str:
    """Formats UTC datetime to ISO 8601 string in the station local timezone."""
    tz = _get_tz(tz_name)
    return dt_utc.astimezone(tz).isoformat()


def detect_air_quality_anomalies(
    location_id: int,
    station_name: str,
    parameter: str,
    parameter_display_name: str,
    units: str,
    window_preset: str,
    window_start_utc: datetime,
    window_end_utc: datetime,
    raw_observations: List[MeasurementPoint],
    sensor_id: Optional[int] = None,
    sensor_datetime_last_utc: Optional[datetime] = None,
    sensor_datetime_last_local: Optional[str] = None,
    locality: Optional[str] = None,
    provider_name: Optional[str] = None,
    timezone_name: str = "Asia/Kolkata",
    sensor_precision: Optional[float] = None,
    precision_provenance: str = "UNKNOWN",
    reference_time: Optional[datetime] = None,
    existing_warnings: Optional[List[str]] = None,
) -> AirQualityAnomalyResponse:
    """
    Evaluates pollution observations against an evidence-based Jackknife (leave-one-out)
    statistical baseline using Median and Median Absolute Deviation (MAD), rate-of-change
    heuristics, and sensor flatline diagnosis.

    Rules enforced:
    1. Primary 24h screening: 24 expected, minimum 18 valid (75%), leave-one-out baseline >= 17.
    2. Extended 7d evaluation window: covers the complete 168-hour evaluation interval [t_end - 168h, t_end],
       requiring 168 expected observations and minimum 126 valid (75%). Every point across the entire 168-hour
       interval is evaluated against a leave-one-out baseline (|X_(-i)| >= 125) of the remaining valid points,
       preventing each observation from contaminating its own baseline across the weekly window.
    3. Leave-one-out baseline independence: Evaluated observation is NEVER included in its baseline.
    4. Zero-MAD handling: At least 50% of baseline observations have zero absolute deviation from the
       median (MAD = 0). Sets scale to None and INDETERMINATE_ZERO_MAD (no arbitrary multipliers).
    5. Consecutive elevated runs: Resets to 1 if the gap between observations exceeds 90 minutes.
    6. Heuristic step surges: Evaluated only for supported physical units using a leave-one-out baseline
       of valid adjacent differences (excluding gaps > 90m and the evaluated difference), requiring
       diff >= 2.5 * NMAD_delta and floor. Unsupported units, gaps > 90m, zero MAD_delta, and insufficient
       difference counts (< 12) produce NOT_EVALUATED.
    7. Flatline diagnosis: >= 6 consecutive identical readings within 90 minutes. INVARIABLE_MINIMUM
       if val == 0 or val <= verified sensor_precision; caller-supplied precision is explicitly flagged;
       SUSPECTED_FLATLINE otherwise (no claim of confirmed hardware failure).
    8. CPCB statutory exceedances: Evaluated against CPCB NAAQS (2009) benchmarks, strictly decoupled from anomalies.
    """
    preset_norm = (window_preset or "24h").strip().lower()
    if preset_norm == "24h":
        expected_obs = 24
        min_coverage = 18
        min_baseline = 17
    elif preset_norm in ("7d", "168h"):
        expected_obs = 168
        min_coverage = 126
        min_baseline = 125
        preset_norm = "7d"
    else:
        raise ValueError(f"Window preset must be '24h' or '7d' (received '{window_preset}').")

    # Filter observations strictly within evaluation window and exclude negative concentrations
    valid_points: List[MeasurementPoint] = []
    for pt in raw_observations:
        if pt.value < 0.0:
            continue
        # Check window overlap
        pt_dt = pt.datetime_to_utc
        if pt_dt.tzinfo is None:
            pt_dt = pt_dt.replace(tzinfo=timezone.utc)
        if window_start_utc <= pt_dt <= window_end_utc:
            valid_points.append(pt)

    # Sort strictly chronologically by observation end timestamp
    valid_points.sort(key=lambda p: p.datetime_to_utc)

    n_valid = len(valid_points)
    completeness_pct = round((n_valid / expected_obs) * 100.0, 1) if expected_obs > 0 else 0.0
    is_coverage_satisfied = (n_valid >= min_coverage)
    coverage_state = CoverageState.SATISFIED if is_coverage_satisfied else CoverageState.INSUFFICIENT_COVERAGE

    # Freshness state derivation
    real_now_utc = datetime.now(timezone.utc)
    is_retrospective = (reference_time is not None) and (real_now_utc - reference_time > timedelta(days=30))

    if is_retrospective:
        freshness_state = "HISTORICAL"
        freshness_message = "Retrospective query: evaluation window ceased >30 days ago (Archive Telemetry)."
    elif sensor_datetime_last_utc is None:
        freshness_state = "UNAVAILABLE"
        freshness_message = "No timestamped observations available for this sensor."
    else:
        s_dt = sensor_datetime_last_utc
        if s_dt.tzinfo is None:
            s_dt = s_dt.replace(tzinfo=timezone.utc)
        diff = real_now_utc - s_dt
        diff_hours = diff.total_seconds() / 3600.0
        if diff_hours > 720.0:
            freshness_state = "HISTORICAL"
            freshness_message = f"Last observation was recorded {diff.days} days ago (>30 days lag)."
        elif diff_hours > 24.0:
            freshness_state = "STALE"
            freshness_message = f"Last observation was recorded {diff.days}d {int((diff.seconds % 86400) // 3600)}h ago (>24h lag)."
        elif diff_hours > 3.0:
            freshness_state = "DELAYED"
            freshness_message = f"Last observation was recorded {round(diff_hours, 1)}h ago (normal regional transmission lag)."
        else:
            freshness_state = "FRESH"
            freshness_message = f"Updated within 3h telemetry cycle (last observation {int(diff_hours * 60)}m ago)."

    data_quality_warnings = list(existing_warnings or [])
    start_local = _to_local_str(window_start_utc, timezone_name)
    end_local = _to_local_str(window_end_utc, timezone_name)
    s_last_local = sensor_datetime_last_local or (_to_local_str(sensor_datetime_last_utc, timezone_name) if sensor_datetime_last_utc else None)

    # Coverage gate: if coverage < 75%, suppress anomaly evaluation
    if not is_coverage_satisfied:
        gaps_count = max(0, expected_obs - n_valid)
        data_quality_warnings.append(
            f"Evaluation suppressed: {gaps_count} hourly observation gaps detected in the {expected_obs}-hour evaluation window."
        )
        return AirQualityAnomalyResponse(
            location_id=location_id,
            station_name=station_name,
            locality=locality,
            provider_name=provider_name,
            parameter=parameter,
            parameter_display_name=parameter_display_name,
            units=units,
            sensor_id=sensor_id,
            sensor_precision=sensor_precision,
            precision_provenance=precision_provenance,
            window_preset=preset_norm,
            window_start_utc=window_start_utc,
            window_end_utc=window_end_utc,
            window_start_local=start_local,
            window_end_local=end_local,
            expected_observations=expected_obs,
            valid_observations=n_valid,
            completeness_percentage=completeness_pct,
            is_coverage_satisfied=False,
            coverage_state=CoverageState.INSUFFICIENT_COVERAGE,
            freshness_state=freshness_state,
            freshness_message=freshness_message,
            sensor_datetime_last_utc=sensor_datetime_last_utc,
            sensor_datetime_last_local=s_last_local,
            baseline_metrics=None,
            summary=AnomalySummary(
                total_anomalies_detected=0,
                total_spikes=0,
                total_moderate_elevations=0,
                total_step_surges=0,
                total_sustained_episodes=0,
                max_modified_z=None,
                flatline_indicator=FlatlineStatus.NORMAL_DISPERSION,
                evaluation_suppressed=True,
                scale_indeterminate=False,
                reason=f"Insufficient hourly observations ({n_valid}/{expected_obs} valid, {completeness_pct}% coverage; minimum 75% required).",
            ),
            data_quality_warnings=data_quality_warnings,
            observations=[],
        )

    # Coverage is satisfied (>= 75%): Perform leave-one-out anomaly analysis
    raw_values = [p.value for p in valid_points]

    # Calculate overall baseline metrics
    win_med = statistics.median(raw_values)
    win_abs_devs = [abs(v - win_med) for v in raw_values]
    win_mad = statistics.median(win_abs_devs)

    if n_valid >= 4:
        quants = statistics.quantiles(raw_values, n=4)
        q1 = quants[0]
        q3 = quants[2]
    else:
        q1 = win_med
        q3 = win_med
    iqr = round(q3 - q1, 2)

    if win_mad == 0.0:
        win_scale_state = ScaleState.INDETERMINATE_ZERO_MAD
        win_nmad = None
        win_scale_explanation = (
            "At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0). "
            "A robust statistical scale cannot be reliably established without arbitrary variance assumptions."
        )
    else:
        win_scale_state = ScaleState.VALID
        win_nmad = round(1.4826 * win_mad, 4)
        win_scale_explanation = None

    baseline_metrics = BaselineMetrics(
        evaluation_method="JACKKNIFE_LEAVE_ONE_OUT",
        median=round(win_med, 2),
        mad=round(win_mad, 4),
        nmad=win_nmad,
        q1=round(q1, 2),
        q3=round(q3, 2),
        iqr=iqr,
        scale_state=win_scale_state,
        explanation=win_scale_explanation,
    )

    # Pre-calculate valid adjacent differences for rate-of-change screening
    # Only pairs of adjacent valid observations with gap <= 90 minutes (5400s) are retained
    adjacent_steps: Dict[int, float] = {}
    for k in range(1, n_valid):
        dt_k = valid_points[k].datetime_to_utc
        dt_prev = valid_points[k - 1].datetime_to_utc
        if dt_k.tzinfo is None:
            dt_k = dt_k.replace(tzinfo=timezone.utc)
        if dt_prev.tzinfo is None:
            dt_prev = dt_prev.replace(tzinfo=timezone.utc)
        gap_sec = (dt_k - dt_prev).total_seconds()
        if gap_sec <= 5400:  # <= 90 minutes
            adjacent_steps[k] = valid_points[k].value - valid_points[k - 1].value

    norm_param = parameter.strip().lower().replace(".", "").replace("-", "")
    units_norm = units.strip()
    is_gas_ratio = units_norm.lower() in ("ppm", "ppb", "ppmv", "ppbv")
    floors_for_param = HEURISTIC_STEP_FLOORS.get(norm_param, {})
    step_floor = floors_for_param.get(units_norm) or floors_for_param.get("µg/m³")

    # Sensor Flatline Screening (>= 6 consecutive identical readings within 90m gaps)
    # Identify runs of identical values
    run_indices: List[List[int]] = []
    current_run: List[int] = [0]
    for k in range(1, n_valid):
        dt_k = valid_points[k].datetime_to_utc
        dt_prev = valid_points[k - 1].datetime_to_utc
        if dt_k.tzinfo is None:
            dt_k = dt_k.replace(tzinfo=timezone.utc)
        if dt_prev.tzinfo is None:
            dt_prev = dt_prev.replace(tzinfo=timezone.utc)
        gap_sec = (dt_k - dt_prev).total_seconds()

        if valid_points[k].value == valid_points[k - 1].value and gap_sec <= 5400:
            current_run.append(k)
        else:
            if len(current_run) >= 6:
                run_indices.append(current_run)
            current_run = [k]
    if len(current_run) >= 6:
        run_indices.append(current_run)

    flatline_map: Dict[int, Tuple[bool, str]] = {}
    has_suspected_flatline = False
    has_invariable_min = False
    has_caller_supplied_invariance = False

    for run in run_indices:
        val = valid_points[run[0]].value
        if val == 0.0:
            is_zero = True
            is_near_zero = True
        elif sensor_precision is not None and val <= sensor_precision:
            is_zero = False
            is_near_zero = True
        else:
            is_zero = False
            is_near_zero = False

        if is_zero:
            has_invariable_min = True
            for idx in run:
                flatline_map[idx] = (False, "Baseline Invariance (Zero Concentration)")
        elif is_near_zero:
            if precision_provenance == "CALLER_SUPPLIED":
                has_caller_supplied_invariance = True
                for idx in run:
                    flatline_map[idx] = (False, f"Baseline Invariance (Caller-Supplied Limit: {sensor_precision} {units})")
            else:
                has_invariable_min = True
                for idx in run:
                    flatline_map[idx] = (False, f"Baseline Invariance (Metadata Limit: {sensor_precision} {units})")
        else:
            has_suspected_flatline = True
            for idx in run:
                flatline_map[idx] = (True, "Suspected Sensor Flatline")

    # Evaluate Each Point with Leave-One-Out (Jackknife) Baseline
    evaluated_obs: List[AnomalyObservationPoint] = []
    consecutive_run = 0
    total_sustained_episodes = 0
    standard_cfg = VERIFIED_STANDARDS.get(norm_param)

    for i in range(n_valid):
        pt = valid_points[i]
        val = pt.value
        pt_dt = pt.datetime_to_utc
        if pt_dt.tzinfo is None:
            pt_dt = pt_dt.replace(tzinfo=timezone.utc)
        local_iso = pt.datetime_to_local or _to_local_str(pt_dt, timezone_name)

        # Leave-one-out baseline sample
        loo_baseline = [raw_values[j] for j in range(n_valid) if j != i]

        if len(loo_baseline) < min_baseline:
            # Insufficient baseline after leaving one out
            ind_med = None
            ind_mad = None
            ind_nmad = None
            mod_z = None
            pt_scale_state = ScaleState.INDETERMINATE_INSUFFICIENT_DISPERSION
            is_anom = False
            anom_type = None
        else:
            ind_med = statistics.median(loo_baseline)
            loo_devs = [abs(v - ind_med) for v in loo_baseline]
            ind_mad = statistics.median(loo_devs)

            if ind_mad == 0.0:
                pt_scale_state = ScaleState.INDETERMINATE_ZERO_MAD
                ind_nmad = None
                mod_z = None
                is_anom = False
                anom_type = None
            else:
                pt_scale_state = ScaleState.VALID
                ind_nmad = round(1.4826 * ind_mad, 4)
                mod_z = round((val - ind_med) / (1.4826 * ind_mad), 2)
                if mod_z >= 3.5:
                    is_anom = True
                    anom_type = "STATISTICAL_SPIKE"
                elif mod_z <= -3.5:
                    is_anom = True
                    anom_type = "STATISTICAL_DROP"
                elif abs(mod_z) >= 2.5:
                    is_anom = False
                    anom_type = "MODERATE_ELEVATION"
                else:
                    is_anom = False
                    anom_type = "NORMAL"

        # Rate of change step calculation with Jackknife leave-one-out baseline
        step_change = None
        is_step_surge = False
        pt_roc_status = "NOT_EVALUATED"
        pt_roc_note = None

        if i == 0 or i not in adjacent_steps:
            step_change = None
            pt_roc_status = "NOT_EVALUATED"
            pt_roc_note = "Step change not evaluated: no prior adjacent observation within 90 minutes."
            is_step_surge = False
        else:
            step_change = round(float(adjacent_steps[i]), 2)
            if is_gas_ratio or step_floor is None:
                pt_roc_status = "NOT_EVALUATED"
                pt_roc_note = (
                    "Step change screening not evaluated: gas concentration reported in volume ratios "
                    "without ambient temperature and pressure."
                    if is_gas_ratio
                    else f"Step change screening not evaluated: unsupported unit '{units}' for parameter '{parameter}'."
                )
                is_step_surge = False
            else:
                # Jackknife leave-one-out reference sample of differences excluding the evaluated difference
                loo_diffs = [diff for idx, diff in adjacent_steps.items() if idx != i]
                MIN_DIFFERENCES_BASELINE = 12

                if len(loo_diffs) < MIN_DIFFERENCES_BASELINE:
                    pt_roc_status = "NOT_EVALUATED"
                    pt_roc_note = (
                        f"Step change screening not evaluated: insufficient adjacent observation pairs "
                        f"({len(loo_diffs)} available; minimum {MIN_DIFFERENCES_BASELINE} required)."
                    )
                    is_step_surge = False
                else:
                    diff_med = statistics.median(loo_diffs)
                    diff_devs = [abs(d - diff_med) for d in loo_diffs]
                    diff_mad = statistics.median(diff_devs)

                    if diff_mad == 0.0:
                        pt_roc_status = "NOT_EVALUATED"
                        pt_roc_note = (
                            "Step change screening not evaluated: baseline step differences have zero dispersion (MAD_Δ = 0)."
                        )
                        is_step_surge = False
                    else:
                        diff_nmad = 1.4826 * diff_mad
                        pt_roc_status = "EVALUATED"
                        pt_roc_note = None
                        if abs(step_change) >= 2.5 * diff_nmad and abs(step_change) >= step_floor:
                            is_step_surge = True
                        else:
                            is_step_surge = False

        # Consecutive elevated hours tracking (resets on gap > 90m or non-elevated point)
        is_elevated = (mod_z is not None and abs(mod_z) >= 2.5)
        if is_elevated:
            if i > 0:
                prev_dt = valid_points[i - 1].datetime_to_utc
                if prev_dt.tzinfo is None:
                    prev_dt = prev_dt.replace(tzinfo=timezone.utc)
                gap_sec = (pt_dt - prev_dt).total_seconds()
                if gap_sec <= 5400 and consecutive_run > 0:
                    consecutive_run += 1
                else:
                    consecutive_run = 1
            else:
                consecutive_run = 1

            if consecutive_run == 3:
                total_sustained_episodes += 1
        else:
            consecutive_run = 0

        # Statutory CPCB NAAQS (2009) exceedance check
        is_cpcb = False
        if standard_cfg:
            cpcb_thresh = standard_cfg.cpcb_standard.threshold
            cpcb_unit = standard_cfg.cpcb_standard.unit.strip().lower()
            u_norm = units.strip().lower()
            if (
                u_norm == cpcb_unit
                or (u_norm in ("µg/m³", "ug/m3") and cpcb_unit in ("µg/m³", "ug/m3"))
                or (u_norm in ("mg/m³", "mg/m3") and cpcb_unit in ("mg/m³", "mg/m3"))
            ):
                if val > cpcb_thresh:
                    is_cpcb = True

        # Flatline tagging
        fl_info = flatline_map.get(i)
        suspected_fl = fl_info[0] if fl_info else False
        fl_label = fl_info[1] if fl_info else None

        evaluated_obs.append(
            AnomalyObservationPoint(
                datetime_utc=pt_dt,
                datetime_local=local_iso,
                observed_value=val,
                independent_median=round(ind_med, 2) if ind_med is not None else None,
                independent_mad=ind_mad,
                independent_nmad=ind_nmad,
                modified_z_score=mod_z,
                is_anomaly=is_anom,
                anomaly_type=anom_type,
                scale_state=pt_scale_state,
                is_cpcb_exceedance=is_cpcb,
                step_change_from_prior=step_change,
                is_heuristic_step_surge=is_step_surge,
                rate_of_change_status=pt_roc_status,
                rate_of_change_note=pt_roc_note,
                consecutive_elevated_hours=consecutive_run,
                suspected_flatline=suspected_fl,
                flatline_label=fl_label,
            )
        )

    # Summary Metrics
    total_anomalies = sum(1 for p in evaluated_obs if p.is_anomaly)
    total_spikes = sum(1 for p in evaluated_obs if p.anomaly_type == "STATISTICAL_SPIKE")
    total_moderate = sum(1 for p in evaluated_obs if p.anomaly_type == "MODERATE_ELEVATION")
    total_step_surges = sum(1 for p in evaluated_obs if p.is_heuristic_step_surge)

    mod_z_vals = [abs(p.modified_z_score) for p in evaluated_obs if p.modified_z_score is not None]
    max_z = max(mod_z_vals) if mod_z_vals else None

    if has_suspected_flatline:
        overall_flatline_indicator = FlatlineStatus.SUSPECTED_FLATLINE
        if precision_provenance == "UNKNOWN":
            flatline_message = (
                "Notice: 6 or more consecutive hourly observations reported identical non-zero values. "
                "Because verified sensor precision is unknown, near-detection-limit invariance cannot be confirmed. "
                "This may indicate upstream transmission buffering, telemetry hold, or instrument sampling arrest; "
                "not confirmed hardware failure."
            )
        else:
            flatline_message = (
                "Notice: 6 or more consecutive hourly observations reported identical non-zero values exceeding "
                f"the {'caller-supplied' if precision_provenance == 'CALLER_SUPPLIED' else 'verified'} precision limit. "
                "This may indicate upstream transmission buffering, telemetry hold, or instrument sampling arrest; "
                "not confirmed hardware failure."
            )
    elif has_caller_supplied_invariance:
        overall_flatline_indicator = FlatlineStatus.INVARIABLE_MINIMUM
        flatline_message = (
            f"6 or more consecutive hourly observations reported identical values within caller-supplied precision limit "
            f"({sensor_precision} {units}). Note: Precision was supplied by the caller and is not verified against "
            "authoritative sensor metadata; normal sensor operation cannot be verified from invariance alone."
        )
    elif has_invariable_min:
        overall_flatline_indicator = FlatlineStatus.INVARIABLE_MINIMUM
        flatline_message = (
            "6 or more consecutive hourly observations reported identical values at instrument minimum. "
            "Inherent measurement quantization at low concentrations can produce repeated identical numbers; "
            "normal sensor operation cannot be verified from invariance alone."
        )
    else:
        overall_flatline_indicator = FlatlineStatus.NORMAL_DISPERSION
        flatline_message = None

    all_zero_mad = (win_scale_state == ScaleState.INDETERMINATE_ZERO_MAD)
    summary_reason = win_scale_explanation if all_zero_mad else None

    summary = AnomalySummary(
        total_anomalies_detected=total_anomalies,
        total_spikes=total_spikes,
        total_moderate_elevations=total_moderate,
        total_step_surges=total_step_surges,
        total_sustained_episodes=total_sustained_episodes,
        max_modified_z=max_z,
        flatline_indicator=overall_flatline_indicator,
        flatline_message=flatline_message,
        evaluation_suppressed=False,
        scale_indeterminate=all_zero_mad,
        reason=summary_reason,
    )

    return AirQualityAnomalyResponse(
        location_id=location_id,
        station_name=station_name,
        locality=locality,
        provider_name=provider_name,
        parameter=parameter,
        parameter_display_name=parameter_display_name,
        units=units,
        sensor_id=sensor_id,
        sensor_precision=sensor_precision,
        precision_provenance=precision_provenance,
        window_preset=preset_norm,
        window_start_utc=window_start_utc,
        window_end_utc=window_end_utc,
        window_start_local=start_local,
        window_end_local=end_local,
        expected_observations=expected_obs,
        valid_observations=n_valid,
        completeness_percentage=completeness_pct,
        is_coverage_satisfied=True,
        coverage_state=CoverageState.SATISFIED,
        freshness_state=freshness_state,
        freshness_message=freshness_message,
        sensor_datetime_last_utc=sensor_datetime_last_utc,
        sensor_datetime_last_local=s_last_local,
        baseline_metrics=baseline_metrics,
        summary=summary,
        data_quality_warnings=data_quality_warnings,
        observations=evaluated_obs,
    )
