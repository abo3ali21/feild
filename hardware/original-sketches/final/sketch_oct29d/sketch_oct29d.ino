#include <Wire.h>
#include <U8g2lib.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>

#define SOIL_MOISTURE_PIN 32 
#define SEALEVELPRESSURE_HPA (1013.25) 
#define WET_THRESHOLD 1500
#define DRY_THRESHOLD 2500

// Initialize U8g2 using the RAM-saving Page Buffer mode
U8G2_SSD1306_128X64_NONAME_1_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);
Adafruit_BME680 bme; 

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
}

void loop() {
  if (!bme.performReading()) return;

  int soilValue = analogRead(SOIL_MOISTURE_PIN);
  const char* soilStatus = (soilValue > DRY_THRESHOLD) ? "DRY" : ((soilValue < WET_THRESHOLD) ? "WET" : "GOOD");

  u8g2.firstPage();
  do {
    // 6x10 font is clean and readable but fits the screen perfectly
    u8g2.setFont(u8g2_font_6x10_tr);

    // --- TOP SECTION: AIR & ENV (Dual Column) ---
    
    // Row 1 (Y = 10)
    u8g2.setCursor(0, 10);
    u8g2.print("T: "); u8g2.print(bme.temperature, 1); u8g2.print("C");
    
    u8g2.setCursor(64, 10); // Start column 2 halfway across the screen
    u8g2.print("HumAir: "); u8g2.print(bme.humidity, 0); u8g2.print("%");

    // Row 2 (Y = 22)
    u8g2.setCursor(0, 22);
    u8g2.print("P: "); u8g2.print(bme.pressure / 100.0, 0); u8g2.print("hPa");
    
    u8g2.setCursor(64, 22);
    u8g2.print("Alt: "); u8g2.print(bme.readAltitude(SEALEVELPRESSURE_HPA), 0); u8g2.print("m");

    // Row 3 (Y = 34)
    u8g2.setCursor(0, 34);
    u8g2.print("G: "); u8g2.print(bme.gas_resistance / 1000.0, 1); u8g2.print(" kOhm");

    // --- DASHBOARD DIVIDER ---
    // Draws a solid line across the screen at Y=40
    u8g2.drawHLine(0, 40, 128); 

    // --- BOTTOM SECTION: SOIL ---
    
    // Row 4 (Y = 52)
    u8g2.setCursor(0, 52);
    u8g2.print("Hum Mud: "); u8g2.print(soilValue);

    // Row 5 (Y = 64)
    u8g2.setCursor(0, 64);
    u8g2.print("Status:  "); u8g2.print(soilStatus);

  } while (u8g2.nextPage());

  delay(2000);
}