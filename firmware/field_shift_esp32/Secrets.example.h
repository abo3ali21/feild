// Copy to Secrets.h and fill in real values. Secrets.h is git-ignored.
// Register the device_id + api key pair in the backend sensor setup file
// (backend/app/data/sensor_setup.json or a SENSOR_SETUP_PATH override).

#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"

// Backend API base URL without a trailing slash, e.g. https://api.example.com
#define API_BASE_URL "http://192.168.1.50:8000"

// Stable unique identifier for this device and its shared secret.
// The backend (never the firmware user) determines the farm association.
#define DEVICE_ID "esp32-device-001"
#define DEVICE_KEY "replace-with-device-secret"
