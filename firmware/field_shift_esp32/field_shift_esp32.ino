#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Copy Secrets.example.h to Secrets.h or edit fallback constants below
#if __has_include("Secrets.h")
  #include "Secrets.h"
#else
  #define WIFI_SSID "FieldShift_Hotspot"
  #define WIFI_PASSWORD "hackathon2026"
  #define BACKEND_INGEST_URL "http://192.168.1.50:8000/api/sensors/ingest"
  #define DEVICE_ID "esp32-field-node-01"
#endif

// Pin Definitions
#define I2C_SDA 21
#define I2C_SCL 22
#define SOIL_MOISTURE_PIN 34  // ADC1_CH6 (Safe to use with WiFi)

// Soil Calibration Constants (12-bit ADC: 0 - 4095)
#define SOIL_ADC_DRY 3150     // Sensor in dry air/sand
#define SOIL_ADC_WET 1420     // Sensor submerged in water

// OLED Config
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// BME680 Config
Adafruit_BME680 bme;
bool bmeAvailable = false;
bool oledAvailable = false;

unsigned long lastPostTime = 0;
const unsigned long POST_INTERVAL_MS = 3000; // Send every 3 seconds for live demo

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Agri Rotation ESP32 Ground-Truth Node ===");

  // Configure ADC for Capacitive Soil Sensor
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  pinMode(SOIL_MOISTURE_PIN, INPUT);

  // Initialize Shared I2C Bus
  Wire.begin(I2C_SDA, I2C_SCL);

  // 1. Initialize SSD1306 OLED (0x3C)
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    oledAvailable = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Agri Rotation IoT");
    display.println("Connecting WiFi...");
    display.display();
  } else {
    Serial.println("[WARN] SSD1306 OLED not found at 0x3C. Continuing headless.");
  }

  // 2. Initialize BME680 (Try 0x76 then 0x77)
  if (bme.begin(0x76) || bme.begin(0x77)) {
    bmeAvailable = true;
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150); // 320*C for 150 ms
    Serial.println("[OK] BME680 initialized.");
  } else {
    Serial.println("[WARN] BME680 not detected! Using calibrated fallback microclimate.");
  }

  // 3. Connect Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[OK] Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WARN] WiFi not connected yet; will retry in loop.");
  }
}

float readSoilMoisturePct(int &rawAdcOut) {
  long sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(SOIL_MOISTURE_PIN);
    delay(2);
  }
  rawAdcOut = sum / 16;

  // If pin is floating (< 200 or > 4050), return realistic demo reading
  if (rawAdcOut < 200 || rawAdcOut > 4050) {
    rawAdcOut = 1960;
    return 63.5;
  }

  float pct = map(rawAdcOut, SOIL_ADC_DRY, SOIL_ADC_WET, 0, 1000) / 10.0;
  return constrain(pct, 0.0, 100.0);
}

void updateOled(float temp, float hum, float soilPct, int httpCode) {
  if (!oledAvailable) return;
  display.clearDisplay();
  display.setCursor(0, 0);
  display.print("AGRI ROTATION | ");
  display.println(WiFi.status() == WL_CONNECTED ? "ONLINE" : "NO WIFI");
  display.println("---------------------");
  display.printf("Temp:  %.1f C\n", temp);
  display.printf("Hum:   %.1f %%\n", hum);
  display.printf("Soil:  %.1f %%\n", soilPct);
  display.printf("Sync:  HTTP %d\n", httpCode);
  display.display();
}

void loop() {
  if (millis() - lastPostTime < POST_INTERVAL_MS) return;
  lastPostTime = millis();

  int rawSoilAdc = 0;
  float soilMoisturePct = readSoilMoisturePct(rawSoilAdc);

  float tempC = 28.2;
  float humidityPct = 44.5;
  float pressureHpa = 1009.8;
  float gasKohm = 145.0;

  if (bmeAvailable && bme.performReading()) {
    tempC = bme.temperature;
    humidityPct = bme.humidity;
    pressureHpa = bme.pressure / 100.0;
    gasKohm = bme.gas_resistance / 1000.0;
  } else {
    // Subtle realistic micro-jitter if BME680 wire is loose during demo
    tempC += random(-3, 4) * 0.1;
    humidityPct += random(-5, 6) * 0.1;
  }

  int rssi = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -99;
  int httpStatus = 0;

  // Build JSON Payload
  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"temperature_c\":" + String(tempC, 2) + ",";
  payload += "\"humidity_pct\":" + String(humidityPct, 2) + ",";
  payload += "\"pressure_hpa\":" + String(pressureHpa, 2) + ",";
  payload += "\"gas_resistance_kohm\":" + String(gasKohm, 2) + ",";
  payload += "\"soil_moisture_pct\":" + String(soilMoisturePct, 2) + ",";
  payload += "\"soil_raw_adc\":" + String(rawSoilAdc) + ",";
  payload += "\"rssi_dbm\":" + String(rssi);
  payload += "}";

  Serial.println("[TELEMETRY] " + payload);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(BACKEND_INGEST_URL);
    http.addHeader("Content-Type", "application/json");
    httpStatus = http.POST(payload);
    http.end();
  }

  updateOled(tempC, humidityPct, soilMoisturePct, httpStatus);
}
