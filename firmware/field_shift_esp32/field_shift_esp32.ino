// Field Shift ESP32 — combined BME680 + soil moisture + OLED firmware with
// authenticated backend upload. Derived from the verified final sketch
// (HardWare Coding/1.final code/Final Test/sketch_oct29d): same pins
// (soil ADC GPIO32, BME680 @0x77, SSD1306 hardware I2C), same oversampling,
// same OLED layout. Network behavior is additive: sensor measurement and the
// OLED keep running while uploads fail, retry with backoff, or wait for Wi-Fi.
//
// Secrets live in Secrets.h (copy Secrets.example.h, never commit it).

#include <Wire.h>
#include <U8g2lib.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include "Secrets.h"

#define SOIL_MOISTURE_PIN 32
#define SEALEVELPRESSURE_HPA (1013.25)
#define WET_THRESHOLD 1500
#define DRY_THRESHOLD 2500

#ifndef MEASUREMENT_INTERVAL_MS
#define MEASUREMENT_INTERVAL_MS 2000      // OLED + sampling cadence (as original)
#endif
#ifndef UPLOAD_INTERVAL_MS
#define UPLOAD_INTERVAL_MS 900000UL       // one upload every 15 minutes
#endif
#ifndef RETRY_BASE_MS
#define RETRY_BASE_MS 5000UL              // exponential backoff base after failure
#endif
#ifndef RETRY_MAX_MS
#define RETRY_MAX_MS 300000UL             // backoff ceiling (5 minutes)
#endif

U8G2_SSD1306_128X64_NONAME_1_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);
Adafruit_BME680 bme;

bool haveReading = false;
bool lastUploadValid = false;
unsigned long lastMeasureMs = 0;
unsigned long lastUploadAttemptMs = 0;
unsigned long retryDelayMs = RETRY_BASE_MS;
int consecutiveUploadFailures = 0;

struct Reading {
  bool temperatureValid, humidityValid, pressureValid, gasValid, soilValid;
  float temperatureC, humidity, pressureHpa, gasOhms;
  int soilRaw;
} latest;

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("WiFi connect started");
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  static unsigned long lastConnectAttempt = 0;
  if (millis() - lastConnectAttempt < 10000UL) return;
  lastConnectAttempt = millis();
  connectWifi();
}

void ensureTime() {
  static bool sntpConfigured = false;
  if (!sntpConfigured && WiFi.status() == WL_CONNECTED) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    sntpConfigured = true;
  }
}

bool deviceTimestamp(String &iso) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 50)) return false;  // NTP not ready yet
  char stamp[32];
  strftime(stamp, sizeof(stamp), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  iso = String(stamp);
  return true;
}

void measureSensors() {
  if (bme.performReading()) {
    latest.temperatureValid = !isnan(bme.temperature);
    latest.humidityValid = !isnan(bme.humidity);
    latest.pressureValid = !isnan(bme.pressure);
    latest.gasValid = !isnan(bme.gas_resistance);
    latest.temperatureC = bme.temperature;
    latest.humidity = bme.humidity;
    latest.pressureHpa = bme.pressure / 100.0;
    latest.gasOhms = bme.gas_resistance;
    haveReading = true;
  }
  latest.soilRaw = analogRead(SOIL_MOISTURE_PIN);
  latest.soilValid = latest.soilRaw >= 0 && latest.soilRaw <= 4095;
}

String buildJson() {
  String timestamp;
  if (!deviceTimestamp(timestamp)) return String();
  String body = "{\"device_id\":\"" DEVICE_ID "\",\"device_timestamp\":\"" + timestamp + "\"";
  if (latest.temperatureValid) body += ",\"temperature_c\":" + String(latest.temperatureC, 2);
  if (latest.humidityValid) body += ",\"humidity_percent\":" + String(latest.humidity, 1);
  if (latest.pressureValid) body += ",\"pressure_hpa\":" + String(latest.pressureHpa, 1);
  if (latest.gasValid) body += ",\"gas_resistance_ohms\":" + String((long)latest.gasOhms);
  if (latest.soilValid) body += ",\"soil_moisture_raw\":" + String(latest.soilRaw);
  body += "}";
  return body;
}

bool uploadReading() {
  if (!haveReading) return false;
  String json = buildJson();
  if (json.length() == 0) return false;  // clock not synced; retry next cycle
  if (WiFi.status() != WL_CONNECTED) return false;

  String url = String(API_BASE_URL) + "/api/v1/sensors/readings";
  HTTPClient http;
  http.setTimeout(8000);
  WiFiClientSecure secure;
  bool began;
  if (url.startsWith("https://")) {
    secure.setInsecure();  // MVP without a CA bundle; use setCACert() in production
    began = http.begin(secure, url);
  } else {
    began = http.begin(url);  // plain HTTP only for a local development backend
  }
  if (!began) {
    Serial.println("HTTP begin failed");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(json);
  bool ok = (code == 200 || code == 201);
  if (ok) {
    Serial.printf("Upload accepted (%d): %s\n", code, http.getString().c_str());
  } else {
    Serial.printf("Upload failed, HTTP %d\n", code);
  }
  http.end();
  return ok;
}

void handleUploadOutcome(bool ok) {
  if (ok) {
    consecutiveUploadFailures = 0;
    retryDelayMs = RETRY_BASE_MS;
    lastUploadValid = true;
    return;
  }
  lastUploadValid = false;
  consecutiveUploadFailures++;
  unsigned long shift = consecutiveUploadFailures > 6 ? 6 : consecutiveUploadFailures - 1;
  retryDelayMs = min(RETRY_BASE_MS << shift, RETRY_MAX_MS);
}

void setup() {
  Serial.begin(115200);
  u8g2.begin();

  if (!bme.begin(0x77)) {
    u8g2.firstPage();
    do {
      u8g2.setFont(u8g2_font_6x10_tr);
      u8g2.drawStr(10, 30, "BME680 Error!");
    } while (u8g2.nextPage());
    while (1);
  }

  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150);

  pinMode(SOIL_MOISTURE_PIN, INPUT);
  connectWifi();
}

void loop() {
  unsigned long now = millis();

  // Measurement + OLED at the original ~2 s cadence; never gated by the network.
  if (now - lastMeasureMs >= MEASUREMENT_INTERVAL_MS) {
    lastMeasureMs = now;
    measureSensors();
  }

  // Upload scheduling with exponential backoff; a slow or absent network
  // cannot stall the measurement loop beyond the single 8 s request timeout.
  unsigned long uploadDue = lastUploadValid ? UPLOAD_INTERVAL_MS : retryDelayMs;
  if (haveReading && now - lastUploadAttemptMs >= uploadDue) {
    lastUploadAttemptMs = now;
    handleUploadOutcome(uploadReading());
  }

  ensureWifi();
  ensureTime();

  float altitude = latest.pressureValid ? 44330.0 * (1.0 - pow(latest.pressureHpa / SEALEVELPRESSURE_HPA, 0.1903)) : 0;
  const char *soilStatus = (latest.soilRaw > DRY_THRESHOLD) ? "DRY" : ((latest.soilRaw < WET_THRESHOLD) ? "WET" : "GOOD");
  u8g2.firstPage();
  do {
    u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.setCursor(0, 10);
    u8g2.print("T: "); u8g2.print(latest.temperatureC, 1); u8g2.print("C");
    u8g2.setCursor(64, 10);
    u8g2.print("HumAir: "); u8g2.print(latest.humidity, 0); u8g2.print("%");
    u8g2.setCursor(0, 22);
    u8g2.print("P: "); u8g2.print(latest.pressureHpa, 0); u8g2.print("hPa");
    u8g2.setCursor(64, 22);
    u8g2.print("Alt: "); u8g2.print(altitude, 0); u8g2.print("m");
    u8g2.setCursor(0, 34);
    u8g2.print("G: "); u8g2.print(latest.gasOhms / 1000.0, 1); u8g2.print(" kOhm");
    u8g2.drawHLine(0, 40, 128);
    u8g2.setCursor(0, 52);
    u8g2.print("Hum Mud: "); u8g2.print(latest.soilRaw);
    u8g2.setCursor(0, 64);
    u8g2.print("Status:  "); u8g2.print(soilStatus);
  } while (u8g2.nextPage());
}
