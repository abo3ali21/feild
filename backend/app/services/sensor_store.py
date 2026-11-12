from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Relative moisture calibration defaults, taken verbatim from the ESP32 firmware
# (sketch_oct29d: WET_THRESHOLD 1500 / DRY_THRESHOLD 2500, 12-bit ADC). These
# produce a device-relative index, not an absolute volumetric water content.
DEFAULT_SOIL_WET_ADC = 1500
DEFAULT_SOIL_DRY_ADC = 2500

SCHEMA = """
CREATE TABLE IF NOT EXISTS farms (
    farm_id TEXT PRIMARY KEY,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    coord_key TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL REFERENCES farms(farm_id),
    api_key_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    soil_wet_adc INTEGER NOT NULL DEFAULT 1500,
    soil_dry_adc INTEGER NOT NULL DEFAULT 2500,
    planted_depth_cm REAL,
    calibration_source TEXT,
    registered_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL REFERENCES devices(device_id),
    farm_id TEXT NOT NULL REFERENCES farms(farm_id),
    temperature_c REAL,
    humidity_percent REAL,
    pressure_hpa REAL,
    gas_resistance_ohms REAL,
    soil_moisture_raw INTEGER,
    soil_moisture_percent REAL,
    device_timestamp TEXT NOT NULL,
    received_at TEXT NOT NULL,
    UNIQUE(device_id, device_timestamp)
);
CREATE INDEX IF NOT EXISTS idx_readings_farm_time ON readings(farm_id, received_at);
"""


def db_path() -> Path:
    return Path(os.getenv("SENSOR_DB_PATH", str(Path.cwd() / "sensor_readings.db")))


def setup_config_path() -> Path:
    return Path(os.getenv("SENSOR_SETUP_PATH", str(DATA_DIR / "sensor_setup.json")))


def max_age_hours() -> float:
    try:
        return float(os.getenv("SENSOR_MAX_AGE_HOURS", "24"))
    except ValueError:
        return 24.0


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def parse_timestamp(raw: str) -> datetime:
    moment = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def ensure_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA)


def coord_key(latitude: float, longitude: float) -> str:
    # Same coordinate-key convention as services/environment.py cache keys.
    return f"{latitude:.3f}:{longitude:.3f}"


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def sync_setup(connection: sqlite3.Connection) -> None:
    """Idempotently apply the backend-managed device/farm configuration file."""
    ensure_schema(connection)
    config = setup_config_path()
    if not config.exists():
        return
    document = json.loads(config.read_text())
    registered_at = iso(now_utc())
    for farm in document.get("farms", []):
        connection.execute(
            "INSERT INTO farms(farm_id, latitude, longitude, coord_key) VALUES(?,?,?,?) "
            "ON CONFLICT(farm_id) DO UPDATE SET latitude=excluded.latitude, longitude=excluded.longitude, coord_key=excluded.coord_key",
            (farm["farm_id"], farm["latitude"], farm["longitude"], coord_key(farm["latitude"], farm["longitude"])),
        )
    for device in document.get("devices", []):
        connection.execute(
            "INSERT INTO devices(device_id, farm_id, api_key_hash, active, soil_wet_adc, soil_dry_adc, planted_depth_cm, calibration_source, registered_at) "
            "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET farm_id=excluded.farm_id, api_key_hash=excluded.api_key_hash, "
            "active=excluded.active, soil_wet_adc=excluded.soil_wet_adc, soil_dry_adc=excluded.soil_dry_adc, planted_depth_cm=excluded.planted_depth_cm, calibration_source=excluded.calibration_source",
            (
                device["device_id"], device["farm_id"], hash_api_key(device["api_key"]), int(device.get("active", 1)),
                int(device.get("soil_wet_adc", DEFAULT_SOIL_WET_ADC)), int(device.get("soil_dry_adc", DEFAULT_SOIL_DRY_ADC)),
                device.get("planted_depth_cm"), device.get("calibration_source"), registered_at,
            ),
        )
    connection.commit()


def get_device(connection: sqlite3.Connection, device_id: str) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,)).fetchone()


def authenticate(device_id: str, api_key: str) -> sqlite3.Row | None:
    """Return the device row when the credential matches and the device is active."""
    status, row = check_credentials(device_id, api_key)
    return row if status == "ok" else None


def check_credentials(device_id: str, api_key: str) -> tuple[str, sqlite3.Row | None]:
    """Distinguish unknown devices from bad credentials for accurate rejection logging."""
    connection = connect()
    try:
        sync_setup(connection)
        device = get_device(connection, device_id)
        if device is None:
            return "unknown_device", None
        if not device["active"] or device["api_key_hash"] != hash_api_key(api_key):
            return "unauthorized", None
        return "ok", device
    finally:
        connection.close()


def moisture_percent(raw: int, wet_adc: int, dry_adc: int) -> float | None:
    """Two-point relative moisture index from the firmware's own ADC thresholds."""
    if dry_adc <= wet_adc:
        return None
    return max(0.0, min(100.0, (dry_adc - raw) / (dry_adc - wet_adc) * 100))


def insert_reading(device: sqlite3.Row, values: dict[str, Any], device_timestamp: str) -> str:
    connection = connect()
    try:
        sync_setup(connection)
        received_at = iso(now_utc())
        raw = values.get("soil_moisture_raw")
        percent = moisture_percent(raw, device["soil_wet_adc"], device["soil_dry_adc"]) if raw is not None else None
        cursor = connection.execute(
            "INSERT OR IGNORE INTO readings(device_id, farm_id, temperature_c, humidity_percent, pressure_hpa, gas_resistance_ohms, soil_moisture_raw, soil_moisture_percent, device_timestamp, received_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?)",
            (device["device_id"], device["farm_id"], values.get("temperature_c"), values.get("humidity_percent"),
             values.get("pressure_hpa"), values.get("gas_resistance_ohms"), raw, percent,
             iso(parse_timestamp(device_timestamp)), received_at),
        )
        connection.commit()
        return "stored" if cursor.rowcount else "duplicate"
    finally:
        connection.close()


def _rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]


def latest_readings(farm_id: str) -> list[dict] | None:
    connection = connect()
    try:
        sync_setup(connection)
        if connection.execute("SELECT 1 FROM farms WHERE farm_id = ?", (farm_id,)).fetchone() is None:
            return None
        rows = connection.execute(
            "SELECT * FROM ("
            "  SELECT *, ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY device_timestamp DESC, id DESC) AS rn "
            "  FROM readings WHERE farm_id = ?"
            ") WHERE rn = 1 ORDER BY device_timestamp DESC",
            (farm_id,),
        ).fetchall()
        return [{key: value for key, value in dict(row).items() if key != "rn"} for row in rows]
    finally:
        connection.close()


def reading_history(farm_id: str, hours: float = 168, limit: int = 1000) -> list[dict] | None:
    connection = connect()
    try:
        sync_setup(connection)
        if connection.execute("SELECT 1 FROM farms WHERE farm_id = ?", (farm_id,)).fetchone() is None:
            return None
        cutoff = iso(now_utc() - timedelta(hours=hours))
        rows = connection.execute(
            "SELECT * FROM readings WHERE farm_id = ? AND received_at >= ? ORDER BY received_at DESC LIMIT ?",
            (farm_id, cutoff, limit),
        ).fetchall()
        return _rows_to_dicts(rows)
    finally:
        connection.close()


def farm_status(farm_id: str) -> dict | None:
    connection = connect()
    try:
        sync_setup(connection)
        farm = connection.execute("SELECT * FROM farms WHERE farm_id = ?", (farm_id,)).fetchone()
        if farm is None:
            return None
        cutoff = iso(now_utc() - timedelta(hours=max_age_hours()))
        devices = []
        for device in connection.execute("SELECT * FROM devices WHERE farm_id = ?", (farm_id,)).fetchall():
            latest = connection.execute(
                "SELECT * FROM readings WHERE device_id = ? ORDER BY received_at DESC LIMIT 1", (device["device_id"],)
            ).fetchone()
            devices.append({
                "device_id": device["device_id"],
                "active": bool(device["active"]),
                "last_received_at": latest["received_at"] if latest else None,
                "fresh": bool(latest and latest["received_at"] > cutoff),
            })
        return {"farm_id": farm_id, "fresh_window_hours": max_age_hours(), "devices": devices}
    finally:
        connection.close()


def farm_for_coordinates(latitude: float, longitude: float) -> str | None:
    connection = connect()
    try:
        sync_setup(connection)
        row = connection.execute("SELECT farm_id FROM farms WHERE coord_key = ?", (coord_key(float(latitude), float(longitude)),)).fetchone()
        return row["farm_id"] if row else None
    finally:
        connection.close()


def fresh_aggregate(farm_id: str) -> dict | None:
    """Median aggregate of valid readings inside the configurable freshness window.

    Returns None when no fresh readings exist, so callers fall back to the
    original model inputs. Repeated identical soil values (>=3 samples) are
    treated as a stuck sensor and excluded from the moisture aggregate.
    """
    connection = connect()
    try:
        sync_setup(connection)
        cutoff = iso(now_utc() - timedelta(hours=max_age_hours()))
        rows = connection.execute(
            "SELECT * FROM readings WHERE farm_id = ? AND received_at >= ? ORDER BY received_at DESC LIMIT 500",
            (farm_id, cutoff),
        ).fetchall()
        if not rows:
            return None
        aggregate: dict[str, Any] = {"sample_count": len(rows), "window_hours": max_age_hours()}
        for channel, column in (
            ("temperature_c", "temperature_c"), ("humidity_percent", "humidity_percent"),
            ("pressure_hpa", "pressure_hpa"), ("gas_resistance_ohms", "gas_resistance_ohms"),
            ("soil_moisture_raw", "soil_moisture_raw"), ("soil_moisture_percent", "soil_moisture_percent"),
        ):
            values = [row[column] for row in rows if row[column] is not None]
            aggregate[channel] = median(values) if values else None
            aggregate[f"{channel}_samples"] = len(values)
        soil_samples = [row["soil_moisture_raw"] for row in rows if row["soil_moisture_raw"] is not None]
        aggregate["soil_stuck_sensor"] = len(soil_samples) >= 3 and len(set(soil_samples)) == 1
        aggregate["latest_received_at"] = rows[0]["received_at"]
        return aggregate
    finally:
        connection.close()
