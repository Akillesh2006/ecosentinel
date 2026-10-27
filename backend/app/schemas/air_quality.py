from datetime import datetime
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
    measurements: List[MeasurementPoint] = Field(default_factory=list)


class ProviderStatus(BaseModel):
    """Operational status and configuration of the upstream data provider."""
    provider: str = "OpenAQ v3"
    is_configured: bool = Field(description="Whether a valid API key is configured")
    is_reachable: bool = Field(description="Whether upstream API endpoint is reachable")
    base_url: str
    message: str
    key_instructions: str


class AirQualityError(BaseModel):
    """Structured error schema for air-quality endpoints."""
    error: str
    message: str
    error_code: str
    instructions: Optional[str] = None
