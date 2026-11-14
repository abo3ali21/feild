import json
from datetime import timedelta
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.services import sensor_store

SETUP = {
    "farms": [
        {"farm_id": "farm-a", "latitude": 14.120, "longitude": -16.035},
        {"farm_id": "farm-b", "latitude": 41.878, "longitude": -93.093},
    ],
    "devices": [
        {"device_id": "dev-a1", "farm_id": "farm-a", "api_key": "secret-a"},
        {"device_id": "dev-b1", "farm_id": "farm-b", "api_key": "secret-b"},
        {"device_id": "dev-off", "farm_id": "farm-a", "api_key": "secret-off", "active": 0},
    ],
}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SENSOR_DB_PATH", str(tmp_path / "sensors.db"))
    setup_path = tmp_path / "setup.json"
    setup_path.write_text(json.dumps(SETUP))
    monkeypatch.setenv("SENSOR_SETUP_PATH", str(setup_path))
    monkeypatch.setenv("SENSOR_INTERNAL_TOKEN", "internal")
    monkeypatch.delenv("DEMO_MODE", raising=False)
    main_module.INGEST_WINDOW.clear()
    return TestClient(main_module.app)


def payload(device="dev-a1", timestamp=None, **overrides):
    body = {
        "device_id": device,
        "temperature_c": 29.5,
        "humidity_percent": 55.0,
        "pressure_hpa": 1008.2,
        "gas_resistance_ohms": 12500,
        "soil_moisture_raw": 1850,
        "device_timestamp": timestamp or sensor_store.iso(sensor_store.now_utc()),
    }
    body.update(overrides)
    return body


def headers(device="dev-a1", key="secret-a"):
    return {"X-Device-Id": device, "X-Device-Key": key}


def submit(client, body, **kwargs):
    return client.post("/api/v1/sensors/readings", json=body, headers=headers(**kwargs))


def test_valid_device_submission(client):
    response = submit(client, payload())
    assert response.status_code == 200
    assert response.json() == {"status": "stored", "farm_id": "farm-a", "duplicate": False}


def test_unknown_device_rejected(client):
    response = submit(client, payload(device="ghost"), device="ghost")
    assert response.status_code == 401
    assert "Unknown device" in response.json()["detail"]


def test_unauthorized_device_rejected(client):
    assert submit(client, payload(), key="wrong").status_code == 401
    assert submit(client, payload(device="dev-off"), device="dev-off", key="secret-off").status_code == 401


def test_device_cannot_submit_for_another_device(client):
    response = client.post("/api/v1/sensors/readings", json=payload(device="dev-b1"), headers=headers("dev-a1"))
    assert response.status_code == 403


def test_invalid_measurement_rejected(client):
    assert submit(client, payload(temperature_c=500)).status_code == 422
    assert submit(client, payload(soil_moisture_raw=9999)).status_code == 422
    assert submit(client, payload(humidity_percent=-5)).status_code == 422
    assert submit(client, payload(temperature_c=None, humidity_percent=None, pressure_hpa=None, gas_resistance_ohms=None, soil_moisture_raw=None)).status_code == 422


def test_future_timestamp_rejected(client):
    future = sensor_store.iso(sensor_store.now_utc().replace(year=sensor_store.now_utc().year + 2))
    assert submit(client, payload(timestamp=future)).status_code == 422


def test_duplicate_submission_handled(client):
    timestamp = sensor_store.iso(sensor_store.now_utc())
    assert submit(client, payload(timestamp=timestamp)).json()["status"] == "stored"
    second = submit(client, payload(timestamp=timestamp))
    assert second.status_code == 200
    assert second.json()["duplicate"] is True


def test_readings_persist_across_connections(client):
    submit(client, payload())
    connection = sqlite3.connect(sensor_store.db_path())
    count = connection.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    connection.close()
    assert count == 1


def test_latest_and_out_of_order(client):
    old = sensor_store.iso(sensor_store.now_utc() - timedelta(hours=5))
    submit(client, payload(timestamp=old, soil_moisture_raw=2600))
    submit(client, payload(soil_moisture_raw=1200))
    backfill = submit(client, payload(timestamp=sensor_store.iso(sensor_store.now_utc() - timedelta(hours=2)), soil_moisture_raw=2000))
    assert backfill.json()["status"] == "stored"
    latest = client.get("/api/v1/sensors/farm-a/latest", headers={"X-Internal-Token": "internal"})
    assert latest.status_code == 200
    rows = latest.json()["readings"]
    assert len(rows) == 1
    assert rows[0]["soil_moisture_raw"] == 1200


def test_stale_detection(client):
    submit(client, payload())
    connection = sqlite3.connect(sensor_store.db_path())
    connection.execute("UPDATE readings SET received_at = ?", (sensor_store.iso(sensor_store.now_utc() - timedelta(days=30)),))
    connection.commit()
    connection.close()
    status = client.get("/api/v1/sensors/farm-a/status", headers={"X-Internal-Token": "internal"}).json()
    assert status["devices"][0]["fresh"] is False
    assert sensor_store.fresh_aggregate("farm-a") is None


def test_history_retrieval(client):
    now = sensor_store.now_utc()
    for hour in range(3):
        submit(client, payload(timestamp=sensor_store.iso(now - timedelta(hours=hour))))
    history = client.get("/api/v1/sensors/farm-a/history?hours=48", headers={"X-Internal-Token": "internal"})
    assert history.status_code == 200
    assert len(history.json()["readings"]) == 3


def test_cross_farm_isolation(client):
    submit(client, payload())
    other = client.get("/api/v1/sensors/farm-b/history", headers={"X-Internal-Token": "internal"})
    assert other.status_code == 200
    assert other.json()["readings"] == []
    assert client.get("/api/v1/sensors/farm-unknown/latest", headers={"X-Internal-Token": "internal"}).status_code == 404


def test_query_endpoints_require_internal_token(client):
    submit(client, payload())
    for path in ("latest", "history", "status"):
        assert client.get(f"/api/v1/sensors/farm-a/{path}").status_code == 403
        assert client.get(f"/api/v1/sensors/farm-a/{path}", headers={"X-Internal-Token": "wrong"}).status_code == 403


def test_rate_limit(client, monkeypatch):
    monkeypatch.setenv("SENSOR_RATE_LIMIT_PER_MINUTE", "2")
    now = sensor_store.now_utc()
    results = [submit(client, payload(timestamp=sensor_store.iso(now - timedelta(seconds=i)))) for i in range(3)]
    assert [response.status_code for response in results[:2]] == [200, 200]
    assert results[2].status_code == 429


def test_invalid_credentials_do_not_consume_authenticated_rate_limit(client, monkeypatch):
    monkeypatch.setenv("SENSOR_RATE_LIMIT_PER_MINUTE", "1")
    timestamp = sensor_store.iso(sensor_store.now_utc())
    invalid = submit(client, payload(timestamp=timestamp), key="wrong")
    valid = submit(client, payload(timestamp=timestamp))
    assert invalid.status_code == 401
    assert valid.status_code == 200


def test_rate_limiter_bounds_untrusted_device_keys(client):
    main_module.MAX_INGEST_KEYS = 10
    try:
        for index in range(25):
            main_module._rate_limited(f"untrusted-{index}")
        assert len(main_module.INGEST_WINDOW) <= 10
    finally:
        main_module.MAX_INGEST_KEYS = 10_000


def test_device_farm_association_is_backend_managed(client):
    response = submit(client, payload())
    assert response.json()["farm_id"] == "farm-a"
    response = submit(client, payload(device="dev-b1"), device="dev-b1", key="secret-b")
    assert response.json()["farm_id"] == "farm-b"


def test_moisture_calibration_index(client):
    assert sensor_store.moisture_percent(1500, 1500, 2500) == 100.0
    assert sensor_store.moisture_percent(2500, 1500, 2500) == 0.0
    assert sensor_store.moisture_percent(2000, 1500, 2500) == 50.0
    assert sensor_store.moisture_percent(3000, 1500, 2500) == 0.0
    assert sensor_store.moisture_percent(1000, 1500, 2500) == 100.0
    assert sensor_store.moisture_percent(1000, 2500, 2500) is None


def test_setup_duplicate_coordinates_are_rejected_before_sync(client, tmp_path):
    setup_path = tmp_path / "setup.json"
    setup_path.write_text(json.dumps({
        "farms": [
            {"farm_id": "farm-a", "latitude": 14.1201, "longitude": -16.0351},
            {"farm_id": "farm-b", "latitude": 14.1204, "longitude": -16.0354},
        ],
        "devices": [],
    }))
    connection = sensor_store.connect()
    try:
        with pytest.raises(ValueError, match="duplicate farm coordinates"):
            sensor_store.sync_setup(connection)
    finally:
        connection.close()


def test_setup_rejects_devices_with_unknown_farm(client, tmp_path):
    setup_path = tmp_path / "setup.json"
    setup_path.write_text(json.dumps({
        "farms": [{"farm_id": "farm-a", "latitude": 14.120, "longitude": -16.035}],
        "devices": [{"device_id": "orphan", "farm_id": "missing", "api_key": "secret"}],
    }))
    connection = sensor_store.connect()
    try:
        with pytest.raises(ValueError, match="unregistered farms"):
            sensor_store.sync_setup(connection)
    finally:
        connection.close()
