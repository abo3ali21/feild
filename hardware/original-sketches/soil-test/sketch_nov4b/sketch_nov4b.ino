#define SOIL_MOISTURE_PIN 32
#define WET_THRESHOLD 1500
#define DRY_THRESHOLD 2500

void setup() {
  Serial.begin(115200);
  pinMode(SOIL_MOISTURE_PIN, INPUT);
}

void loop() {
  int soilValue = analogRead(SOIL_MOISTURE_PIN);
  
  Serial.print(soilValue);
  Serial.print(" - ");
  
  if (soilValue > DRY_THRESHOLD) {
    Serial.println("DRY");
  } else if (soilValue < WET_THRESHOLD) {
    Serial.println("WET");
  } else {
    Serial.println("GOOD");
  }
  
  delay(2000);
}