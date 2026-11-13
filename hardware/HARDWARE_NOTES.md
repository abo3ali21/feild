# Hardware Notes — Field Shift

The original team README in this folder (`README.original.md`) is a historical document; Firebase is not part of the current data flow, and the original sketches it accompanies contain no Wi-Fi or Firebase code.

This file records only facts verified from the actual files during the November 2026 integration audit. Anything from `README.original.md` that could not be checked against files or hardware is explicitly labeled.

## Provenance

- Source: team archive `Nasa-Luxor-HAMADA-Yl3AB-2025-main.zip` (NASA Space Apps Luxor 2025, team HAMADA YL3AB), extracted copy untouched at `../field-shift-hardware/`.
- Every file in this folder is a byte-identical copy of an archive file (verified by SHA-256). Only container directory names and the README filename were changed.
- PNG screenshots from the archive are **not copied yet**; they are pending a separate visual review and approval step.

## Folder map

| Path | Content |
|---|---|
| `README.original.md` | Historical team project README (was `README.md` in the archive) |
| `original-sketches/final/sketch_oct29d/` | Final combined sketch: BME680 + soil ADC + SSD1306 OLED dashboard |
| `original-sketches/tests/sketch_oct29c/` | Byte-identical duplicate of `sketch_oct29d.ino` (verified with `diff`) |
| `original-sketches/tests/Test 2.txt` | Earlier combined-sketch variant using U8x8 instead of U8g2; same pins and thresholds |
| `original-sketches/bme680-test/sketch_nov4a/` | BME680-only serial test |
| `original-sketches/oled-test/sketch_nov4a/` | OLED-only test display |
| `original-sketches/soil-test/sketch_nov4b/` | Soil-moisture-only serial test |

## Verified component and pin values (from the original sketches)

| Parameter | Value | Where |
|---|---|---|
| Soil sensor analog input | GPIO 32 | all combined/soil sketches (`SOIL_MOISTURE_PIN`) |
| Soil wet threshold (raw ADC) | 1500 | `WET_THRESHOLD` |
| Soil dry threshold (raw ADC) | 2500 | `DRY_THRESHOLD` |
| BME680 I2C address | 0x77 | `bme.begin(0x77)` |
| BME680 oversampling | temperature 8X, humidity 2X, pressure 4X | `set*Oversampling` calls |
| BME680 IIR filter | size 3 | `setIIRFilterSize(BME680_FILTER_SIZE_3)` |
| BME680 gas heater | 320 °C for 150 ms | `setGasHeater(320, 150)` |
| Sea-level reference pressure | 1013.25 hPa | `SEALEVELPRESSURE_HPA` |
| OLED | SSD1306 128×64, hardware I2C, U8g2 page-buffer mode, rotation `U8G2_R0`, reset `U8X8_PIN_NONE` | `U8G2_SSD1306_128X64_NONAME_1_HW_I2C` declaration |
| Libraries | Wire, U8g2 (U8x8 in `Test 2.txt`), Adafruit_Sensor, Adafruit_BME680 | includes |
| Serial baud | 115200 | `Serial.begin` |
| Loop cadence | 2000 ms | `delay(2000)` |

No sketch contains Wi-Fi, HTTP, Firebase, or credential code. The BME680 error path in the final sketch halts forever (`while (1)`).

## Relationship to the integrated firmware

`firmware/field_shift_esp32/field_shift_esp32.ino` preserves every value in the table above (measured cadence now as `MEASUREMENT_INTERVAL_MS`, default 2000) and adds: Wi-Fi STA with non-blocking reconnect, HTTPS/HTTP upload to the FastAPI backend with `DEVICE_ID`/`DEVICE_KEY` auth, NTP-synced timestamps, a 900 s upload interval with exponential retry backoff, and continued measurement/display during upload failures. The permanent halt on BME680 init failure (`while (1)`) is preserved unchanged from the original; the display is redrawn on every loop iteration instead of once per 2 s (values still update only at the measurement cadence).

## Architecture clarification (current project)

- Original README describes Firebase Realtime Database, a Chart.js dashboard, and an AI chatbot on GitHub Pages. **Current Field Shift data flow: ESP32 → FastAPI backend (`POST /api/v1/sensors/readings`) → recommendation engine → Next.js frontend.** Firebase is not used anywhere in this repository (verified by grep over `backend/`, `firmware/`, `.env.example`).
- Claims in the original README that could not be verified from files or without the physical device, and are therefore recorded as *claimed in original README, not verified*:
  - "Working Prototype" status — not verified.
  - "Ultra-safe 3.3V isolated logic (Zero 5V exposure to ESP32)" power architecture — not verified; no wiring documentation exists in the archive.
  - Custom 3D-printed vertical enclosure engineered for field conditions — **the 3D design files are not available**; no CAD/STL file exists in the archive.
- Wiring diagram / schematic / parts list: not present in the archive. Pin facts above come from code, not from a documented diagram.
- Neither the original sketches nor the integrated firmware were compiled during this audit — no Arduino toolchain is installed on the audit machine.
