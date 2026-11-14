# Field Shift --- System Architecture & Data Flow

This document details the end-to-end architecture and multi-tier data flow of Field Shift v1.0.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph DataSources["External Environmental & Earth Observation Data"]
        NASA["NASA POWER API<br/>(Daily Solar, Temp, Rainfall)"]
        SoilGrids["ISRIC SoilGrids 2.0<br/>(0-30cm pH, Texture, SOC)"]
        SMAP["NASA SMAP<br/>(Optional Remote Sensing Soil Moisture)"]
    end

    subgraph Edge["Field In-Situ Telemetry"]
        ESP32["ESP32 DevKit v1<br/>- Bosch BME680 (Air T/RH/P/Gas)<br/>- Capacitive Soil Sensor (ADC)<br/>- SSD1306 Local OLED"]
    end

    subgraph Backend["Field Shift Core Backend (FastAPI)"]
        Ingest["Telemetry Ingestion & Auth<br/>(SHA-256 + HMAC-SHA256)"]
        Storage[("Persistent Storage<br/>SQLite WAL Mode")]
        Cache["TTL Cache<br/>(24h Geo-Keyed)"]
        SciEngine["Deterministic Agronomic Engine<br/>- Van Bemmelen SOM<br/>- Crop-Specific GDD<br/>- USDA SCS Water Balance<br/>- 4-Tier MCDA Scoring"]
    end

    subgraph Frontend["Field Shift Web Application (Next.js 15)"]
        UI["Bilingual UI (Arabic/English + RTL)<br/>- Interactive Farm Map<br/>- Agroclimatic Dashboard<br/>- Crop Rotation Cards & Calendar<br/>- Trade-off & Decision Breakdown<br/>- Data Provenance Audit Trail<br/>- Climate Stress-Test Simulator"]
    end

    NASA -->|Agroclimatology| Cache
    SoilGrids -->|Edaphic Profiling| Cache
    SMAP -.->|Optional| Cache
    Cache --> SciEngine

    ESP32 -->|Authenticated HTTP POST| Ingest
    Ingest --> Storage
    Storage --> SciEngine

    SciEngine -->|Evaluation JSON Response| UI
    UI -->|Evaluate & Simulate Requests| SciEngine
```

---

## 2. Telemetry & Decision Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as Farmer / Extension Worker
    participant Web as Next.js Dashboard
    participant API as FastAPI Backend
    participant DB as SQLite Storage
    participant Sensor as ESP32 Field Sensor
    participant Satellite as NASA POWER & SoilGrids

    rect rgb(240, 248, 255)
        note over Sensor, API: Edge Telemetry Ingestion Flow
        Sensor->>API: POST /api/v1/sensors/readings (Signed headers: X-Device-Id, X-Device-Key)
        API->>DB: Verify credentials, rate-limit, and insert reading
        API-->>Sensor: 200 OK (status: ok | duplicate)
    end

    rect rgb(255, 250, 240)
        note over Farmer, Satellite: Decision Support & Rotation Evaluation Flow
        Farmer->>Web: Select region (e.g. Luxor), starting crop, & irrigation mode
        Web->>API: POST /api/v1/farms/evaluate
        API->>Satellite: Fetch multi-year climate & edaphic data (or check TTL cache)
        Satellite-->>API: Temperature, rainfall records & Soil profile
        API->>DB: Query fresh field telemetry for farm
        DB-->>API: Latest soil moisture & microclimate readings
        API->>API: Execute Agronomic Hard Constraints & MCDA Scoring
        API->>DB: Persist evaluation record
        API-->>Web: Return Ranked Rotations, Provenance & Dashboards
        Web-->>Farmer: Render 3-Year Crop Calendar & Climate Resilience Scores
    end
```
