import json
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.services import sensor_store

FARM_A = {"farm_id": "farm-a", "latitude": 14.120, "longitude": -16.035}
EVALUATION = {
    "latitude": 14.1203, "longitude": -16.0351, "current_crop_id": "groundnut",
    "soil_texture": "LOAM", "is_irrigated": True, "farmer_priority": "balanced", "demo_profile_id": "sahel",
}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SENSOR_DB_PATH", str(tmp_path / "sensors.db"))
    (tmp_path / "setup.json").write_text(json.dumps({
        "farms": [FARM_A],
        "devices": [{"device_id": "dev-a1", "farm_id": "farm-a", "api_key": "secret-a"}],
    }))
    monkeypatch.setenv("SENSOR_SETUP_PATH", str(tmp_path / "setup.json"))
    monkeypatch.delenv("DEMO_MODE", raising=False)
    return TestClient(main_module.app)


def evaluate(client):
    response = client.post("/api/v1/farms/evaluate", json=EVALUATION)
    assert response.status_code == 200
    body = response.json()
    body.pop("evaluation_id")
    return body


def ingest(client, raw):
    response = client.post(
        "/api/v1/sensors/readings",
        json={"device_id": "dev-a1", "temperature_c": 30.0, "humidity_percent": 40.0, "pressure_hpa": 1010.0,
              "gas_resistance_ohms": 20000, "soil_moisture_raw": raw,
              "device_timestamp": sensor_store.iso(sensor_store.now_utc())},
        headers={"X-Device-Id": "dev-a1", "X-Device-Key": "secret-a"},
    )
    assert response.status_code == 200


def age_all_readings(days=30):
    connection = sensor_store.connect()
    connection.execute("UPDATE readings SET received_at = ?", (sensor_store.iso(sensor_store.now_utc() - timedelta(days=days)),))
    connection.commit()
    connection.close()


def test_no_sensor_readings_results_unchanged(client):
    assert evaluate(client) == evaluate(client)


def test_valid_wet_moisture_changes_water_scores(client):
    baseline = evaluate(client)
    ingest(client, 1200)  # below firmware WET_THRESHOLD -> 100% relative moisture
    updated = evaluate(client)
    assert baseline["environmental_context"]["soil_moisture_index"] is None
    assert updated["environmental_context"]["soil_moisture_index"] == pytest.approx(1.0)
    assert updated["environmental_context"]["soil_moisture_state"] == "SENSOR_WET"
    for base, new in zip(baseline["recommended_rotations"], updated["recommended_rotations"]):
        assert new["scores"]["water"] >= base["scores"]["water"]
        if base["scores"]["water"] < 100:
            assert new["scores"]["water"] <= min(100, round(base["scores"]["water"] * 1.10) + 1)
    assert any(new["scores"]["water"] != base["scores"]["water"] for base, new in zip(baseline["recommended_rotations"], updated["recommended_rotations"]))


def test_dry_moisture_reduces_water_within_bound(client):
    baseline = evaluate(client)
    ingest(client, 2600)  # above DRY_THRESHOLD -> 0% relative moisture
    updated = evaluate(client)
    for base, new in zip(baseline["recommended_rotations"], updated["recommended_rotations"]):
        assert base["scores"]["water"] * 0.9 - 1 <= new["scores"]["water"] <= base["scores"]["water"]


def test_mcda_weights_and_overall_formula_preserved(client):
    ingest(client, 1200)
    result = evaluate(client)
    for rotation in result["recommended_rotations"]:
        score = rotation["scores"]
        expected = .30 * score["climate"] + .30 * score["water"] + .25 * score["soil"] + .15 * score["diversity"]
        assert abs(score["overall"] - expected) <= 1.5


def test_stale_readings_fall_back_to_existing_behavior(client):
    baseline = evaluate(client)
    ingest(client, 1200)
    age_all_readings(days=30)
    assert evaluate(client) == baseline


def test_missing_sensor_data_never_treated_as_zero(client):
    baseline = evaluate(client)
    fresh = evaluate(client)
    assert fresh["environmental_context"]["seasonal_rainfall_mm"] == baseline["environmental_context"]["seasonal_rainfall_mm"]
    assert fresh["environmental_context"]["soil_moisture_index"] is None


def test_stuck_sensor_excluded_from_scoring(client):
    baseline = evaluate(client)
    for minute in range(3):
        response = client.post(
            "/api/v1/sensors/readings",
            json={"device_id": "dev-a1", "soil_moisture_raw": 1850,
                  "device_timestamp": sensor_store.iso(sensor_store.now_utc() - timedelta(minutes=minute))},
            headers={"X-Device-Id": "dev-a1", "X-Device-Key": "secret-a"},
        )
        assert response.status_code == 200
    assert evaluate(client) == baseline


def test_invalid_moisture_falls_back(client):
    baseline = evaluate(client)
    rejected = client.post(
        "/api/v1/sensors/readings",
        json={"device_id": "dev-a1", "soil_moisture_raw": 99999,
              "device_timestamp": sensor_store.iso(sensor_store.now_utc())},
        headers={"X-Device-Id": "dev-a1", "X-Device-Key": "secret-a"},
    )
    assert rejected.status_code == 422
    assert evaluate(client) == baseline


def test_climate_inputs_and_hard_filters_unchanged_by_sensors(client):
    baseline = evaluate(client)
    ingest(client, 1200)
    updated = evaluate(client)
    for key in ("annual_gdd", "seasonal_rainfall_mm", "historical_rainfall_mm", "heat_stress_days", "soil_ph"):
        assert updated["environmental_context"][key] == baseline["environmental_context"][key]
    assert updated["rejected_examples"] == baseline["rejected_examples"]
    assert len(updated["recommended_rotations"]) == len(baseline["recommended_rotations"])
    from app.core.engine import load_crops
    family_of = {crop.crop_id: crop.family for crop in load_crops()}
    for rotation in updated["recommended_rotations"]:
        families = {family_of[item["crop_id"]] for item in rotation["sequence"]}
        assert len(families) == 3


def test_diversity_and_soil_and_climate_scores_untouched(client):
    baseline = evaluate(client)
    ingest(client, 2600)
    updated = evaluate(client)
    for base, new in zip(baseline["recommended_rotations"], updated["recommended_rotations"]):
        assert base["scores"]["climate"] == new["scores"]["climate"]
        assert base["scores"]["soil"] == new["scores"]["soil"]
        assert base["scores"]["diversity"] == new["scores"]["diversity"]


def test_other_farm_sensor_data_not_used(client, tmp_path, monkeypatch):
    baseline = evaluate(client)
    setup = json.loads((tmp_path / "setup.json").read_text())
    setup["farms"].append({"farm_id": "farm-b", "latitude": 41.878, "longitude": -93.093})
    setup["devices"].append({"device_id": "dev-b1", "farm_id": "farm-b", "api_key": "secret-b"})
    (tmp_path / "setup.json").write_text(json.dumps(setup))
    response = client.post(
        "/api/v1/sensors/readings",
        json={"device_id": "dev-b1", "soil_moisture_raw": 1200,
              "device_timestamp": sensor_store.iso(sensor_store.now_utc())},
        headers={"X-Device-Id": "dev-b1", "X-Device-Key": "secret-b"},
    )
    assert response.status_code == 200
    assert evaluate(client) == baseline


def test_sensor_provenance_reported(client):
    result = evaluate(client)
    moisture = next(p for p in result["data_provenance"] if p["variable"] == "root_zone_moisture")
    assert moisture["status"] == "UNAVAILABLE"
    ingest(client, 1200)
    result = evaluate(client)
    moisture = next(p for p in result["data_provenance"] if p["variable"] == "root_zone_moisture")
    assert moisture["status"] == "SENSOR"
    assert result["environmental_context"]["data_quality"]["soil_moisture"] == "SENSOR"
