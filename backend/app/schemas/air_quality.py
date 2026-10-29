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
