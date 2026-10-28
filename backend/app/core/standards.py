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

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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
