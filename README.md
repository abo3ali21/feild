# Field Shift

Field Shift helps compare three-year crop rotations using regional climate evidence, estimated soil conditions, crop-family breaks, and a deterministic scoring model. It does not predict yield.

## Fast local run with NASA, soil data, and sensors

You need Node.js 22+, Python 3.12+, and internet access for the NASA POWER and SoilGrids requests. No `.env` file is required.

### 1. Install backend dependencies (once)

Open PowerShell in the project root:

```powershell
cd C:\Users\menat\Downloads\feild\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Start the backend

In that same PowerShell window:

```powershell
$env:DEMO_MODE = "false"
$env:CORS_ORIGINS = "http://localhost:3000"
uvicorn app.main:app --reload --port 8000
```

Keep this window open. The backend will try NASA POWER and SoilGrids for custom coordinates and use labelled fallback data if those sources are unavailable. Selecting one of the five named demo farms deliberately uses its demo profile instead of live requests.

### 3. Install and start the frontend

Open a second PowerShell window:

```powershell
cd C:\Users\menat\Downloads\feild\frontend
npm ci
npm run dev
```

Open http://localhost:3000. The frontend's local Next.js proxy forwards `/api/...` requests to the backend at port 8000.

### 4. Connect the ESP32

The backend includes a placeholder device registration in `backend/app/data/sensor_setup.json`. To use your board:

1. In Arduino IDE, install ESP32 board support and the libraries `U8g2`, `Adafruit Unified Sensor`, and `Adafruit BME680`.
2. Open `firmware/field_shift_esp32/Secrets.example.h`, save a copy beside it named `Secrets.h`, and fill in your Wi-Fi name/password, a device ID, and a long device key. Do not share or commit this file.
3. Find your computer's local IPv4 address (Windows: run `ipconfig` and look for the active Wi-Fi adapter's IPv4 Address). Put it in `API_BASE_URL`, like `http://192.168.1.25:8000`—not `localhost`.
4. In `backend/app/data/sensor_setup.json`, replace the example device `api_key` with exactly the same device key. Put the farm's actual latitude/longitude in the matching farm entry. Make sure the analysis uses those coordinates to three decimal places (for example `14.120`, `-16.035`).
5. Connect the BME680 over I2C at address `0x77`, the soil probe signal to GPIO32, and the SSD1306 OLED over hardware I2C. Power the components according to their specifications; do not connect a 5V signal to an ESP32 GPIO.
6. Compile/upload the sketch from Arduino IDE. Keep both backend and frontend running. The OLED updates locally; uploads are sent about every 15 minutes. The device needs Wi-Fi and correct time from NTP before the first upload.
7. If upload fails, check Arduino Serial Monitor at 115200 baud, confirm the computer and board are on the same Wi-Fi/LAN, and allow inbound TCP port 8000 in Windows Firewall. Do not expose port 8000 directly to the public internet.

The backend associates devices to farms from `sensor_setup.json`, not from data in the upload. The only sensor value currently affecting recommendations is soil moisture. It is a device-relative index using the default ADC thresholds (wet 1500, dry 2500), not a laboratory volumetric-water percentage. The sensor only affects scoring when evaluation coordinates match the registered farm after rounding to three decimal places.


Backend API docs: http://localhost:8000/docs.

## Deployment note

The root `vercel.json` describes a combined Vercel Services deployment. Vercel Services availability can vary by account/plan and platform rollout; check that it is available to your account before relying on it.

The backend currently keeps evaluations in memory and sensor records in local SQLite/files. Serverless instances may restart or scale independently, so persistent evaluation/sensor behavior requires a durable shared database before production use.

## Main folders

- `frontend/`: Next.js user interface and built-in demo fallback.
- `backend/`: FastAPI API and deterministic crop-rotation engine.
- `firmware/field_shift_esp32/`: ESP32 sensor firmware.
- `hardware/`: verified hardware notes and original sketches.

Always treat recommendations as comparative decision support and verify them with local agronomic guidance before planting.
