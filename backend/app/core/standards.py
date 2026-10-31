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

from app.schemas.air_quality import (
    DustControlGuidance,
    EmissionFactorMetadata,
    IdlingAbatementResponse,
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
