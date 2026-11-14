import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_scenario_egypt_luxor_nile_valley():
    """Scenario 1: Egyptian agricultural area (Luxor / Nile Valley, lat 25.687, lon 32.640).

    Conditions: High ambient solar radiation and temperature, irrigated Nile alluvial soil.
    Expected: Heat-tolerant crops (e.g. sorghum, cowpea) pass; non-irrigated sensitive crops are screened out.
    """
    payload = {
        "latitude": 25.6872,
        "longitude": 32.6396,
        "current_crop_id": "sorghum",
        "soil_texture_override": "CLAY_LOAM",
        "is_irrigated": True,
        "farmer_priority": "drought_resilience",
        "demo_profile_id": None,
    }
    response = client.post("/api/v1/farms/evaluate", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["recommended_rotations"]) > 0
    assert data["environmental_context"]["soil_texture"] == "CLAY_LOAM"
    assert data["environmental_context"]["soil_texture_source"] == "OVERRIDE"


def test_scenario_semi_arid_water_scarcity():
    """Scenario 2: Semi-arid scenario (Sahel, Senegal, lat 14.120, lon -16.035).

    Conditions: Significant rainfall deficit, high heat stress.
    Expected: Drought-tolerant crops (pearl millet, cowpea, sorghum) prioritized.
    """
    payload = {
        "latitude": 14.1203,
        "longitude": -16.0351,
        "current_crop_id": "groundnut",
        "is_irrigated": False,
        "farmer_priority": "drought_resilience",
        "demo_profile_id": "sahel",
    }
    response = client.post("/api/v1/farms/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    best_seq = [c["crop_id"] for c in data["recommended_rotations"][0]["sequence"]]
    # At least one high drought-tolerance crop is present
    assert any(c in best_seq for c in ("pearl_millet", "cowpea", "sorghum", "groundnut"))


def test_scenario_temperate_corn_belt():
    """Scenario 3: Temperate scenario (Iowa, USA, lat 42.031, lon -93.632).

    Conditions: Moderate GDD, adequate rainfall, deep loam soil, soil recovery priority.
    Expected: Sequences feature legume phases (soybean/cowpea) and root diversity.
    """
    payload = {
        "latitude": 42.0308,
        "longitude": -93.6319,
        "current_crop_id": "maize",
        "is_irrigated": False,
        "farmer_priority": "soil_recovery",
        "demo_profile_id": "iowa",
    }
    response = client.post("/api/v1/farms/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    best_rot = data["recommended_rotations"][0]
    assert best_rot["scores"]["soil"] > 0
