#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>

#define SEALEVELPRESSURE_HPA (1013.25)

Adafruit_BME680 bme;

void setup() {
  Serial.begin(115200);
  if (!bme.begin(0x77)) {
    while (1);
  }
  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150);
}

void loop() {
  if (!bme.performReading()) return;

  Serial.print(bme.temperature);
  Serial.println(" C");
  Serial.print(bme.humidity);
  Serial.println(" %");
  Serial.print(bme.pressure / 100.0);
  Serial.println(" hPa");
  Serial.print(bme.gas_resistance / 1000.0);
  Serial.println(" kOhms");
  Serial.print(bme.readAltitude(SEALEVELPRESSURE_HPA));
  Serial.println(" m");

  delay(2000);
}