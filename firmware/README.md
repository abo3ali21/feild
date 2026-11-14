# Field Shift ESP32 Firmware & Hardware Guide

This directory contains the edge telemetry firmware for the Field Shift agricultural decision-support platform. It captures in-situ microclimate and soil conditions and transmits authenticated measurements to the Field Shift backend.

---

## 1. Hardware Bill of Materials (BOM)

| Component | Model / Specification | Purpose | Interface | Pin / Address |
| :--- | :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32 DevKit v1 (ESP-WROOM-32) | Core compute, Wi-Fi & TLS telemetry | Standard | — |
| **Microclimate Sensor** | Bosch BME680 | Air Temperature, Relative Humidity, Barometric Pressure, Gas Resistance (IAQ) | I2C | `0x77` (SDA: GPIO 21, SCL: GPIO 22) |
| **Soil Moisture Sensor** | Capacitive Soil Moisture Sensor v1.2 / v2.0 | Volumetric Soil Water Content proxy (anti-corrosion) | Analog ADC | ADC1_CH4 (GPIO 32) |
| **Display** | 0.96" SSD1306 128x64 Monochrome OLED | Local diagnostic and telemetry dashboard | I2C | `0x3C` (SDA: GPIO 21, SCL: GPIO 22) |
| **Power Supply** | 5V / 2A Micro-USB or Solar LiPo Charger | System power | Power | VIN (5V) & GND |

---

## 2. Wiring & Pinout Diagram

```
+-------------------------------------------------------------+
|                      ESP32 DevKit v1                        |
|                                                             |
|  [3V3] -------------------+-----------+                     |
|                           |           |                     |
|  [GND] -------+-----------+-----------+                     |
|               |           |           |                     |
|  [GPIO 21] ---|-----------+-------+   |   (I2C SDA)         |
|  [GPIO 22] ---|-----------+---+   |   |   (I2C SCL)         |
|               |           |   |   |   |                     |
|  [GPIO 32] ---|-------+   |   |   |   |   (Analog ADC)      |
+---------------+-------+---+---+---+---+---------------------+
                |       |   |   |   |   |
                |       |   |   |   |   +---> BME680 VCC (3.3V)
                |       |   |   |   +-------> SSD1306 VCC (3.3V)
                |       |   |   +-----------> BME680 SCL & SSD1306 SCL
                |       |   +---------------> BME680 SDA & SSD1306 SDA
                |       +-------------------> Soil Moisture Signal (AOUT)
                +---------------------------> GND for BME680, OLED, & Soil Sensor
```

---

## 3. Soil Moisture Calibration Procedure

Capacitive soil sensors output an analog voltage inversely proportional to moisture:
1. **Dry Air Calibration:** Expose sensor to dry ambient air. Read raw 12-bit ADC value $\approx 2500 - 3200$.
2. **Saturated Wet Calibration:** Submerge sensor blade up to max depth in water (do not submerge circuitry). Read raw ADC value $\approx 1200 - 1500$.
3. Configure `WET_THRESHOLD` and `DRY_THRESHOLD` in `Secrets.h` or via backend device registration `soil_wet_adc` and `soil_dry_adc`.

The backend computes relative calibrated soil moisture:
$$\text{Calibrated \%} = \text{clamp}\left(0, 100, \frac{\text{DRY\_ADC} - \text{RAW\_ADC}}{\text{DRY\_ADC} - \text{WET\_ADC}} \times 100\right)$$

---

## 4. Compilation & Flashing Instructions

### Option A: PlatformIO (Recommended)
```bash
cd firmware/field_shift_esp32
cp Secrets.example.h Secrets.h
# Edit Secrets.h with your Wi-Fi SSID, Password, Device ID, and Device Key
pio run -t upload
pio devicemonitor -b 115200
```

### Option B: Arduino IDE
1. Install **ESP32 by Espressif Systems** via Board Manager (v2.0.14 or v3.0+).
2. Install Required Libraries via Library Manager:
   - `Adafruit BME680 Library` (v2.0.4+)
   - `Adafruit Unified Sensor` (v1.1.14+)
   - `U8g2` by oliver (v2.35.9+)
   - `ArduinoJson` by Benoit Blanchon (v7.0.4+)
3. Select Board: **ESP32 Dev Module**.
4. Open `field_shift_esp32.ino`. Copy `Secrets.example.h` to `Secrets.h`.
5. Compile and upload.

---

## 5. Security & TLS Configuration

- **Development:** Default firmware uses `secure.setInsecure()` when pointing to internal test domains.
- **Production:** Define `ROOT_CA_CERTIFICATE` in `Secrets.h` containing your server's root CA certificate (PEM format) to enforce strict TLS chain validation:
  ```cpp
  #define ROOT_CA_CERTIFICATE "-----BEGIN CERTIFICATE-----\n..."
  ```
- **Authentication:** All telemetry payloads require `X-Device-Id` and `X-Device-Key` headers. The backend validates device credentials using SHA-256 and constant-time HMAC comparison.
