"""Pydantic schemas for spatial neighbor discovery and multi-station comparison.

EcoSentinel Milestone 7 Phase A.
"""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.air_quality import Coordinates


class NeighborStationSummary(BaseModel):
    """Summary of an eligible neighboring monitoring station within spatial search radius."""
    id: int = Field(description="Unique location identifier")
    name: str = Field(description="Station name")
    locality: Optional[str] = Field(default=None, description="City, district, or locality name")
    country_code: str = Field(default="IN", description="ISO 3166-1 alpha-2 country code")
    provider_name: str = Field(description="Organization facilitating data sharing")
    owner_name: Optional[str] = Field(default=None, description="Responsible station owner or agency")
    coordinates: Coordinates = Field(description="Geographical coordinates (WGS-84 datum)")
    distance_km: float = Field(
        description=(
            "Spherical great-circle distance from the reference station in kilometers "
            "(Haversine approximation with Earth mean radius 6371.0088 km; coordinates on WGS-84 datum)"
        )
    )
    available_parameters: List[str] = Field(default_factory=list, description="Pollutants monitored at this station")
    sensor_id: Optional[int] = Field(default=None, description="Sensor ID for the queried pollutant at this station")
    datetime_last_utc: Optional[datetime] = Field(default=None, description="Latest recorded measurement timestamp in UTC")
    datetime_last_local: Optional[str] = Field(default=None, description="Latest recorded measurement timestamp in local time")
    is_stale: bool = Field(default=False, description="Whether data has not been updated within stale threshold")


class SpatialNeighborsResponse(BaseModel):
    """Response payload for spatial neighbor discovery within a defined geographic radius."""
    reference_station_id: int = Field(description="Reference station identifier")
    reference_station_name: str = Field(description="Reference station name")
    reference_coordinates: Coordinates = Field(description="Reference station coordinates (WGS-84 datum)")
    reference_provider_name: str = Field(description="Reference station provider name")
    reference_owner_name: Optional[str] = Field(default=None, description="Reference station owner or agency")
    parameter: str = Field(description="Target pollutant code (e.g. pm25, no2)")
    parameter_display_name: str = Field(description="Human-readable pollutant display name (e.g. PM2.5)")
    radius_km: float = Field(description="Evaluated search radius in kilometers")
    candidates_examined_count: int = Field(description="Total candidate stations evaluated in the spatial area")
    eligible_neighbors_count: int = Field(description="Total eligible neighbor stations found and returned")
    missing_coordinates_count: int = Field(description="Candidate stations excluded due to missing coordinates")
    pollutant_incompatible_count: int = Field(description="Candidate stations excluded because they do not monitor the target pollutant")
    outside_radius_count: int = Field(description="Candidate stations excluded because exact distance exceeds the radius")
    self_excluded_count: int = Field(default=1, description="Count of reference station instances excluded from neighbor results")
    neighbors: List[NeighborStationSummary] = Field(default_factory=list, description="List of eligible neighbor stations sorted by distance ascending")
    spatial_disclaimer: str = Field(
        default=(
            "Point observation notice: distance does not establish atmospheric connectivity, wind transport, "
            "or shared emission sources. Neighboring stations represent discrete point observations with potential "
            "micro-siting and instrument variations. Distances represent spherical great-circle approximations."
        ),
        description="Scientific interpretation safeguards",
    )


class SpatialComparisonRequest(BaseModel):
    """Request payload for multi-station comparative air quality analysis."""
    reference_location_id: int = Field(description="Primary reference monitoring station ID")
    neighbor_location_ids: List[int] = Field(
        description="List of 1 to 4 neighboring station IDs for comparison (total stations must be between 2 and 5)"
    )
    parameter: str = Field(description="Pollutant parameter code to compare across all stations (e.g. pm25, pm10, no2)")
    date_from: Optional[datetime] = Field(default=None, description="Start date/time in ISO 8601 UTC (defaults to 24h prior to date_to)")
    date_to: Optional[datetime] = Field(default=None, description="End date/time in ISO 8601 UTC (defaults to current time)")

    @field_validator("parameter")
    @classmethod
    def validate_parameter(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not cleaned:
            raise ValueError("Parameter must not be empty.")
        return cleaned

    @model_validator(mode="after")
    def validate_station_selection(self) -> "SpatialComparisonRequest":
        if not (1 <= len(self.neighbor_location_ids) <= 4):
            raise ValueError(
                f"neighbor_location_ids must contain between 1 and 4 station IDs (received {len(self.neighbor_location_ids)}). "
                "Total comparison size must be between 2 and 5 stations."
            )
        if self.reference_location_id in self.neighbor_location_ids:
            raise ValueError(
                f"Reference station ID {self.reference_location_id} cannot be included in neighbor_location_ids. "
                "A station cannot be compared against itself."
            )
        if len(set(self.neighbor_location_ids)) != len(self.neighbor_location_ids):
            raise ValueError("Duplicate station IDs found in neighbor_location_ids. All station IDs must be distinct.")
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be earlier than date_to.")
        return self


class StationComparisonMetadata(BaseModel):
    """Metadata, spatial distance, and observation coverage for a participating station."""
    location_id: int = Field(description="Unique location identifier")
    station_name: str = Field(description="Station name")
    locality: Optional[str] = Field(default=None, description="City, district, or locality name")
    provider_name: str = Field(description="Organization facilitating data sharing")
    owner_name: Optional[str] = Field(default=None, description="Responsible station owner or agency")
    is_reference: bool = Field(description="True if this is the primary reference station")
    distance_from_reference_km: Optional[float] = Field(
        default=None,
        description=(
            "Spherical great-circle distance from the reference station in kilometers "
            "(Haversine approximation with Earth mean radius 6371.0088 km; 0.0 for reference station; null if coordinates are unavailable)"
        ),
    )
    coordinates: Optional[Coordinates] = Field(default=None, description="Station coordinates if available (WGS-84 datum)")
    sensor_id: int = Field(description="OpenAQ sensor ID used for this comparison")
    units: str = Field(description="Measurement units (e.g. µg/m³)")
    total_valid_observations: int = Field(description="Count of valid non-negative observations recorded by this station in the window")
    expected_observations: int = Field(description="Expected hourly observation count across the evaluation window")
    station_coverage_percentage: Optional[float] = Field(
        default=None,
        description="Station coverage: (valid observations / expected observations) * 100 (null if expected observations is 0)",
    )
    coverage_percentage: Optional[float] = Field(
        default=None,
        description="Alias for station_coverage_percentage for backward compatibility",
    )
    coincident_with_reference_hours: int = Field(
        description="Count of hourly timestamps where BOTH this station and the reference station have valid observations"
    )
    pairwise_overlap_coverage_percentage: Optional[float] = Field(
        default=None,
        description="Pairwise overlap coverage: (coincident valid hours with reference / expected observations) * 100 (null if expected observations is 0)",
    )
    coincident_coverage_percentage: Optional[float] = Field(
        default=None,
        description="Alias for pairwise_overlap_coverage_percentage for backward compatibility",
    )
    conditional_reference_coverage_percentage: Optional[float] = Field(
        default=None,
        description="Conditional reference coverage: (coincident valid hours with reference / valid reference observations) * 100 (null if valid reference observations is 0)",
    )
    min_correlation_samples_threshold: int = Field(
        default=6,
        description="Documented minimum coincident observation count required to compute exploratory Pearson correlation (threshold: 6)",
    )
    pearson_correlation_with_reference: Optional[float] = Field(
        default=None,
        description=(
            "Exploratory, descriptive pairwise Pearson correlation coefficient r with the reference station across "
            "coincident hours (null when unavailable, insufficient samples, or constant series; distinct from 0.0). "
            "Does not imply physical causation, atmospheric transport, or regional airshed representativeness."
        ),
    )
    correlation_status: str = Field(
        description=(
            "Descriptive correlation status: CALCULATED, INSUFFICIENT_COINCIDENT_DATA (coincident hours < 6), "
            "ZERO_VARIANCE_CONSTANT_SERIES (variance is zero in at least one series), or REFERENCE_STATION"
        )
    )
    is_stale: bool = Field(default=False, description="Whether data has not been updated within stale threshold")
    sensor_datetime_last_utc: Optional[datetime] = Field(default=None, description="Latest observation timestamp in UTC")
    sensor_datetime_last_local: Optional[str] = Field(default=None, description="Latest observation timestamp in local time")


class ComparisonTimeSlice(BaseModel):
    """Synchronized hourly cross-station observation slice."""
    datetime_utc: datetime = Field(description="Measurement interval start timestamp in UTC")
    datetime_local: Optional[str] = Field(default=None, description="Measurement start timestamp in local time")
    station_values: Dict[int, Optional[float]] = Field(
        description="Reported pollutant concentration by station ID (null if observation was missing or unavailable)"
    )
    contributing_stations: int = Field(description="Count of participating stations with valid observations in this time slice")
    neighborhood_median: Optional[float] = Field(
        default=None,
        description="Median concentration across contributing stations in this time slice (null if < 2 stations)",
    )
    neighborhood_min: Optional[float] = Field(
        default=None,
        description="Minimum concentration across contributing stations in this time slice (null if < 2 stations)",
    )
    neighborhood_max: Optional[float] = Field(
        default=None,
        description="Maximum concentration across contributing stations in this time slice (null if < 2 stations)",
    )
    neighborhood_iqr: Optional[float] = Field(
        default=None,
        description="Interquartile range (Q3 - Q1) across contributing stations in this time slice (null if < 2 stations)",
    )


class StationPartialFailure(BaseModel):
    """Details of a station that failed retrieval or verification during comparison."""
    location_id: int = Field(description="Failed station ID")
    error_code: str = Field(description="Error classification code")
    message: str = Field(description="Explanation of the failure")


class SpatialComparisonResponse(BaseModel):
    """Complete response payload for multi-station spatial air quality comparison."""
    parameter: str = Field(description="Target pollutant parameter code (e.g. pm25)")
    parameter_display_name: str = Field(description="Human-readable pollutant display name")
    units: str = Field(description="Measurement units (strictly verified across all stations)")
    requested_from_utc: datetime = Field(description="Start timestamp of the comparison window in UTC")
    requested_to_utc: datetime = Field(description="End timestamp of the comparison window in UTC")
    reference_station_id: int = Field(description="Primary reference station ID")
    total_stations_requested: int = Field(description="Total station IDs requested for comparison")
    total_valid_stations: int = Field(description="Count of stations with valid sensors and measurements included")
    partial_failures: List[StationPartialFailure] = Field(
        default_factory=list,
        description="List of stations that could not be included due to missing sensors, upstream errors, or unit mismatches",
    )
    all_stations_coincident_hours: int = Field(
        description="Number of hourly intervals where ALL participating valid stations have concurrent observations"
    )
    all_stations_coincident_coverage_percentage: Optional[float] = Field(
        default=None,
        description="All-stations coincident coverage: (all-stations coincident hours / expected observations) * 100 (null if expected observations is 0)",
    )
    mixed_providers: bool = Field(
        default=False,
        description="Flag indicating whether participating stations represent different providers or instrumentation owners",
    )
    stations: List[StationComparisonMetadata] = Field(
        default_factory=list,
        description="Station metadata, distance, coverage, and pairwise correlation against reference station",
    )
    time_slices: List[ComparisonTimeSlice] = Field(
        default_factory=list,
        description="Chronological time-aligned hourly observations across all participating stations",
    )
    spatial_disclaimer: str = Field(
        default=(
            "Point observation limitation: air quality measurements reflect physical observations at discrete "
            "station sites. Multi-station comparison does not establish a continuous spatial surface, atmospheric "
            "connectivity, wind transport, or industrial source culpability. Distances represent spherical great-circle approximations."
        ),
        description="Scientific interpretation safeguards",
    )
    data_quality_warnings: List[str] = Field(
        default_factory=list,
        description="Diagnostic notices regarding missing data, unit compatibility, or station exclusions",
    )
