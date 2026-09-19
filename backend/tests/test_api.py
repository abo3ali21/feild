from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def payload(profile="sahel"):
    values = {
        "sahel": [14.1203, -16.0351, "groundnut"],
        "iowa": [42.0308, -93.6319, "maize"],
        "punjab": [30.1575, 71.5249, "cotton"],
        "andes": [-13.5319, -71.9675, "potato"],
        "western_australia": [-31.48, 117.16, "barley"],
    }[profile]
    return {"latitude": values[0], "longitude": values[1], "current_crop_id": values[2], "is_irrigated": profile == "punjab", "farmer_priority": "balanced", "demo_profile_id": profile}


def test_health_and_crops():
    assert client.get("/api/v1/health").status_code == 200
    assert len(client.get("/api/v1/crops").json()["crops"]) >= 15


def test_all_demo_profiles():
    for profile in ("sahel", "iowa", "punjab", "andes", "western_australia"):
        response = client.post("/api/v1/farms/evaluate", json=payload(profile))
        assert response.status_code == 200, response.text
        assert len(response.json()["recommended_rotations"]) == 3


def test_simulation_reranks():
    original = client.post("/api/v1/farms/evaluate", json=payload()).json()
    response = client.post("/api/v1/farms/simulate", json={
        "evaluation_id": original["evaluation_id"], "rainfall_change_pct": -30,
        "temperature_change_c": 3, "irrigation_available": False,
    })
    assert response.status_code == 200
    assert response.json()["environmental_context"]["seasonal_rainfall_mm"] < original["environmental_context"]["seasonal_rainfall_mm"]
