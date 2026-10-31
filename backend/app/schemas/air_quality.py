from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class Coordinates(BaseModel):
    """Geographical coordinates (WGS84)."""
    latitude: float
    longitude: float


class SensorSummary(BaseModel):
    """Sensor metadata attached to a monitoring station."""
    id: int = Field(description="Unique OpenAQ sensor identifier")
    name: str = Field(description="Sensor label or channel identifier")
    parameter_id: int = Field(description="Identifier of the measured parameter")
    parameter_name: str = Field(description="Standard pollutant code (e.g. pm25, no2)")
    parameter_display_name: str = Field(description="Human-readable pollutant name (e.g. PM2.5)")
    units: str = Field(description="Measurement unit (e.g. µg/m³, ppm)")
    datetime_first_utc: Optional[datetime] = Field(default=None, description="First recorded measurement timestamp in UTC")
    datetime_first_local: Optional[str] = Field(default=None, description="First recorded measurement timestamp in local time")
    datetime_last_utc: Optional[datetime] = Field(default=None, description="Latest recorded measurement timestamp in UTC")
    datetime_last_local: Optional[str] = Field(default=None, description="Latest recorded measurement timestamp in local time")


class LocationSummary(BaseModel):
    """Normalized summary of a monitoring location."""
    id: int = Field(description="Unique location identifier")
    name: str = Field(description="Station name")
    locality: Optional[str] = Field(default=None, description="City, district, or locality name")
    country_code: str = Field(default="IN", description="ISO 3166-1 alpha-2 country code")
    country_name: str = Field(default="India", description="Country name")
    provider_name: str = Field(description="Organization facilitating data sharing")
    owner_name: Optional[str] = Field(default=None, description="Responsible station owner")
    is_monitor: bool = Field(default=True, description="Whether station is considered a reference monitor")
    is_mobile: bool = Field(default=False, description="Whether station is mobile")
    coordinates: Optional[Coordinates] = None
    available_parameters: List[str] = Field(default_factory=list, description="List of pollutants measured at this station")
    datetime_last_utc: Optional[datetime] = Field(default=None, description="Latest recorded measurement timestamp in UTC")
    datetime_last_local: Optional[str] = Field(default=None, description="Latest recorded measurement timestamp in local time")
    is_stale: bool = Field(default=False, description="Whether data has not been updated within stale threshold")


class LocationDetail(LocationSummary):
    """Detailed metadata for a monitoring location including sensors and licensing."""
    timezone: Optional[str] = Field(default="Asia/Kolkata", description="IANA timezone name")
    instruments: List[str] = Field(default_factory=list, description="Instrumentation used at the station")
    licenses: List[Dict[str, Any]] = Field(default_factory=list, description="Data licensing and attribution details")
    datetime_first_utc: Optional[datetime] = Field(default=None, description="First recorded measurement timestamp in UTC")
    sensors: List[SensorSummary] = Field(default_factory=list, description="Available sensors at this location")

    @field_validator("instruments", "licenses", "sensors", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> List[Any]:
        if v is None:
            return []
        return v


class MeasurementPoint(BaseModel):
    """Individual observation point in a time-series."""
    value: float = Field(description="Reported concentration or average value")
    parameter: str = Field(description="Pollutant code (e.g. pm25)")
    units: str = Field(description="Measurement unit (e.g. µg/m³)")
    period_label: str = Field(default="hour", description="Observation resolution/label (raw, hour, day)")
    interval: Optional[str] = Field(default=None, description="Averaging interval string (e.g. 01:00:00)")
    datetime_from_utc: datetime = Field(description="Measurement start timestamp in UTC")
    datetime_to_utc: datetime = Field(description="Measurement end timestamp in UTC")
    datetime_from_local: Optional[str] = Field(default=None, description="Measurement start in local time")
    datetime_to_local: Optional[str] = Field(default=None, description="Measurement end in local time")
    is_missing: bool = Field(default=False, description="Explicit flag for missing observation in expected sequence")
    percent_complete: Optional[float] = Field(default=None, description="Coverage percentage if aggregated")


class LocationMeasurementsResponse(BaseModel):
    """Normalized time-series measurements response for a station and pollutant."""
    location_id: int
    station_name: str
    locality: Optional[str] = None
    provider_name: str
    parameter: str
    parameter_display_name: str
    units: str
    sensor_id: int
    sensor_datetime_last_utc: Optional[datetime] = Field(default=None, description="Latest observation timestamp for this specific sensor in UTC")
    sensor_datetime_last_local: Optional[str] = Field(default=None, description="Latest observation timestamp for this specific sensor in local time")
    requested_from_utc: datetime
    requested_to_utc: datetime
    retrieved_at_utc: datetime
    total_observations: int
    expected_observations: Optional[int] = None
    missing_percentage: Optional[float] = None
    is_stale: bool = False
    stale_message: Optional[str] = None
    data_integrity_notice: str = Field(
        default="Concentration measurements reflect physical observations and do not represent calculated AQI or legal pollution causation."
    )
    excluded_observations: int = Field(default=0, description="Invalid or negative observations excluded")
    data_quality_warnings: List[str] = Field(default_factory=list, description="Data quality notices including negative value exclusions")
    measurements: List[MeasurementPoint] = Field(default_factory=list)


class ProviderStatus(BaseModel):
    """Operational status and configuration of the upstream data provider."""
    provider: str = "OpenAQ v3"
    is_configured: bool = Field(description="Whether a valid API key is configured")
    is_reachable: bool = Field(description="Whether upstream API endpoint is reachable")
    base_url: str
    message: str
    key_instructions: str




class AssessmentStatus(str, Enum):
    BELOW_REFERENCE = "below_reference"
    ABOVE_REFERENCE = "above_reference"
    INSUFFICIENT_DATA = "insufficient_data"
    STALE_DATA = "stale_data"
    HISTORICAL_DATA = "historical_data"
    UNSUPPORTED_PARAMETER = "unsupported_parameter"
    UNAVAILABLE = "unavailable"


class FreshnessState(str, Enum):
    FRESH = "fresh"
    STALE = "stale"
    HISTORICAL = "historical"
    UNAVAILABLE = "unavailable"


class MitigationAdvisory(BaseModel):
    """Practical operational mitigation recommendation."""
    category: str = Field(description="Operational category (e.g. Fleet & Logistics, Dust Control)")
    action: str = Field(description="Reversible, cautious operational protocol")
    rationale: str = Field(description="Scientific and operational rationale")
    uncertainty: str = Field(description="Scope limitations and environmental uncertainty disclosure")


class RiskAssessmentResponse(BaseModel):
    """Evidence-backed operational risk assessment and mitigation advisory."""
    location_id: int
    station_name: str
    locality: Optional[str] = None
    sensor_id: Optional[int] = None
    parameter: str
    parameter_display_name: str
    units: str

    # Observation window & calculation metadata
    calculation_timestamp_utc: datetime
    calculation_timestamp_local: Optional[str] = None
    window_start_utc: datetime
    window_end_utc: datetime
    window_start_local: Optional[str] = None
    window_end_local: Optional[str] = None
    averaging_period_hours: int
    averaging_period_label: str

    # Data completeness & quality gate
    valid_observations: int
    expected_observations: int
    missing_observations: int
    excluded_observations: int = Field(default=0, description="Invalid or negative observations excluded")
    completeness_percentage: float
    is_completeness_satisfied: bool
    completeness_rule_label: str = Field(
        default="EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)"
    )
    data_quality_warnings: List[str] = Field(default_factory=list)

    # Calculated concentration average (None if incomplete, stale, historical, or unavailable)
    calculated_average: Optional[float] = None

    # Sensor-specific freshness
    sensor_datetime_last_utc: Optional[datetime] = None
    sensor_datetime_last_local: Optional[str] = None
    freshness_state: FreshnessState
    freshness_message: str

    # Standard benchmark references
    standard_name: Optional[str] = None
    standard_threshold: Optional[float] = None
    standard_unit: Optional[str] = None
    standard_url: Optional[str] = None
    secondary_benchmark_name: Optional[str] = None
    secondary_benchmark_threshold: Optional[float] = None
    secondary_benchmark_unit: Optional[str] = None
    secondary_benchmark_url: Optional[str] = None
    secondary_benchmark_notes: Optional[str] = None

    # Assessment outcome
    status: AssessmentStatus
    status_label: str
    ratio_to_standard: Optional[float] = None

    # Limitations & Disclaimers
    screening_limitations: str
    regulatory_disclaimer: str = Field(
        default=(
            "Operational screening result only: this comparison evaluates an operational rolling window "
            "at a single monitor and does not constitute a formal regulatory compliance determination "
            "or statutory enforcement finding under CPCB rules."
        )
    )
    spatial_disclaimer: str = Field(
        default=(
            "Spatial representativeness limitation: observations represent physical conditions at this specific "
            "monitoring station and cannot be assumed to represent an entire metropolitan area or identify a specific upwind source."
        )
    )
    advisories: List[MitigationAdvisory] = Field(default_factory=list)


class AirQualityError(BaseModel):
    """Structured error schema for air-quality endpoints."""
    error: str
    message: str
    error_code: str
    instructions: Optional[str] = None


class EmissionFactorMetadata(BaseModel):
    """Metadata and scientific provenance for an emission or fuel factor."""
    metric: str = Field(description="Name of the quantified metric")
    factor_value: float = Field(description="Numerical factor value per vehicle-hour")
    unit: str = Field(description="Measurement unit")
    provenance: str = Field(description="Issuing organization and empirical basis")
    source_title: str = Field(description="Formal study or regulatory publication title")
    source_url: Optional[str] = Field(default=None, description="Authoritative publication URL")
    notes: Optional[str] = Field(default=None, description="Applicability and technical constraints")


class DustControlGuidance(BaseModel):
    """Procedural dust-control guidance and empirical efficiency benchmarks."""
    control_efficiency_range: str = Field(
        default="50%–70%",
        description="Empirical lift-off reduction range for surface watering under US EPA AP-42 §13.2.2"
    )
    control_efficiency_scope: str = Field(
        default=(
            "The 50%–70% control-efficiency range applies strictly to unpaved-road surface watering "
            "maintaining approximately twice baseline surface moisture under US EPA AP-42 §13.2.2 conditions. "
            "Watering effectiveness declines as moisture evaporates and vehicle traffic continues."
        )
    )
    mass_avoided_notice: str = Field(
        default=(
            "PM10 mass avoided is N/A: calculating mass avoided requires site-specific surface silt content, "
            "vehicle weight, and vehicle-kilometres travelled. Estimating mass without geotechnical data is unsupported."
        )
    )
    supportive_controls: List[str] = Field(
        default_factory=lambda: [
            "Scheduled haul-road dampening using treated wastewater (zero potable water wastage)",
            "Anti-smog mist cannon atomization (10–50 µm droplets directed at active aggregate piles)",
            "Vehicle egress wheel wash-down bays to prevent roadway mud track-out",
            "Speed restrictions (≤ 15–20 km/h) on unpaved site corridors to reduce kinetic dust resuspension",
            "Impermeable tarpaulin covers on inactive bulk material and soil stockpiles",
        ]
    )
    supportive_controls_note: str = Field(
        default=(
            "Supportive measures represent procedural good practices under CPCB guidelines and CAQM mandates; "
            "they do not add separate additive percentage reductions."
        )
    )


class IdlingAbatementResponse(BaseModel):
    """Evidence-backed potential emissions abatement estimate from heavy vehicle anti-idling."""
    vehicles: int = Field(ge=1, le=200, description="Eligible heavy commercial vehicles (1 to 200)")
    hours: float = Field(ge=0.5, le=12.0, description="Curtailed idling duration per vehicle in hours (0.5 to 12.0)")
    total_vehicle_hours: float = Field(description="Total operational vehicle-hours curtailed (vehicles * hours)")

    avoided_fuel_liters: float = Field(description="Estimated fuel saved in liters (N * H * 1.0)")
    avoided_co2_kg: float = Field(description="Estimated CO2 avoided in kilograms (N * H * 2.68)")
    avoided_nox_kg: float = Field(description="Estimated NOx avoided in kilograms (N * H * 33.8 / 1000)")
    avoided_nox_grams: float = Field(description="Estimated NOx avoided in grams (N * H * 33.8)")
    avoided_pm25_grams: float = Field(description="Estimated PM2.5 avoided in grams (N * H * 1.1)")

    factors: List[EmissionFactorMetadata] = Field(default_factory=list)
    dust_guidance: DustControlGuidance = Field(default_factory=DustControlGuidance)
    assumptions: List[str] = Field(default_factory=list)
    fleet_technology_caveat: str = Field(
        default=(
            "Factors represent a simplified hot-stabilized curb-idling assumption for in-use commercial diesel fleets. "
            "They do not account for PTO loads, air-conditioning, or distinct vehicle weight classes. "
            "Emissions vary substantially across Bharat Stage (BS) standards: modern BS-VI commercial vehicles with functional "
            "Diesel Particulate Filters (DPFs) emit substantially lower PM during steady operation, whereas legacy BS-III/IV "
            "fleets produce higher particulate and unburned hydrocarbon emissions. Factors must not be interpreted as universal "
            "measurements for every Indian vehicle."
        )
    )
    atmospheric_boundary_caveat: str = Field(
        default=(
            "Estimated emissions avoided reflect direct localized tailpipe curtailment within the facility perimeter. "
            "Localized operational source curtailment reduces on-site breathing-zone exposure, but does not predict or guarantee "
            "an immediate measurable concentration reduction at distant municipal ambient monitors governed by atmospheric "
            "boundary layer dynamics, thermal inversions, and regional background advection."
        )
    )
    statutory_disclaimer: str = Field(
        default=(
            "Engineering estimate only: this abatement calculation and facility action dossier represent an operational planning "
            "tool and do NOT constitute a statutory compliance certificate or legal regulatory determination under the "
            "Air (Prevention and Control of Pollution) Act, 1981."
        )
    )
