from fastapi.testclient import TestClient

from app.main import EVALUATIONS, app

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


def test_evaluation_persists_across_restart():
    original = client.post("/api/v1/farms/evaluate", json=payload("iowa")).json()
    eval_id = original["evaluation_id"]

    # Simulate server restart by clearing the in-memory cache
    EVALUATIONS.clear()
    assert eval_id not in EVALUATIONS

    # Simulation should transparently reload the evaluation from persistent storage
    response = client.post("/api/v1/farms/simulate", json={
        "evaluation_id": eval_id,
        "rainfall_change_pct": 10,
        "temperature_change_c": 1,
        "irrigation_available": True,
    })
    assert response.status_code == 200
    assert response.json()["evaluation_id"] != eval_id


def test_hybrid_ml_confidence_and_scoring():
    from app.core.calculations import compute_hybrid_plan_score, compute_ml_crop_suitability

    crop = {"crop_id": "sorghum", "temp_min": 18, "temp_max": 35, "water_mm": 400, "ph_optimal": 6.8}
    prob = compute_ml_crop_suitability(crop, temp_c=28.0, soil_moisture_pct=45.0, soil_ph=7.0)
    assert 0.0 <= prob <= 100.0

    plan_score = compute_hybrid_plan_score(rule_score=80.0, crop_ml_probs=[prob, prob, prob], use_ml_blend=True)
    assert plan_score["scoring_mode"] == "Hybrid (Rule-Based + ML)"
    assert "ml_confidence_pct" in plan_score
    assert "final_hybrid_score" in plan_score


def test_hardware_sensor_ingest_and_latest():
    payload_data = {
        "device_id": "esp32-field-node-01",
        "temperature_c": 29.5,
        "humidity_pct": 46.0,
        "pressure_hpa": 1011.2,
        "gas_resistance_kohm": 140.0,
        "soil_moisture_pct": 58.2,
        "soil_raw_adc": 1890,
        "rssi_dbm": -62,
    }
    ingest_res = client.post("/api/sensors/ingest", json=payload_data)
    assert ingest_res.status_code == 200
    assert ingest_res.json()["received"] is True

    latest_res = client.get("/api/sensors/latest")
    assert latest_res.status_code == 200
    data = latest_res.json()
    assert data["active"] is True
    assert data["temperature_c"] == 29.5
    assert data["soil_moisture_pct"] == 58.2
