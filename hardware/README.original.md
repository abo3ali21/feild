# Nasa-Luxor-HAMADA-Yl3AB-2025
🌱 Smart IoT agricultural probe &amp; AI dashboard integrating real-time soil data with NASA Earth Observations. Built for NASA Space Apps Luxor.


# 🌱 Field Shift: Adapting Farms with NASA Data

![NASA Space Apps](https://img.shields.io/badge/NASA_Space_Apps-Luxor_2026-blue?style=for-the-badge&logo=nasa)
![Hardware](https://img.shields.io/badge/Hardware-ESP32-success?style=for-the-badge&logo=espressif)
![Status](https://img.shields.io/badge/Status-Working_Prototype-brightgreen?style=for-the-badge)

## 🌍 Overview
Farmers worldwide face unprecedented challenges due to shifting climates, erratic rainfall, and declining soil health. **Field Shift** is a comprehensive decision-support system built for the NASA Space Apps Challenge (Luxor). 

Our solution bridges the gap between macro-level satellite data and micro-level ground realities by integrating a **custom 3D-printed IoT Smart Probe** with **NASA Earth Observations (POWER API)**. An AI-powered chatbot processes this combined data to advise farmers on crop rotation, irrigation scheduling, and soil health resilience.

## ✨ Key Features
- **🌡️ The Smart Probe (Hardware):** A portable, vertically-designed field sensor powered by an ESP32. It captures real-time local environment data (Soil Moisture, Temperature, Humidity, Pressure, and Air Quality) instantly upon insertion into the ground.
- **🛰️ NASA Data Integration:** Pulls historical and predictive agroclimatology data based on the farm's exact coordinates using the NASA POWER API.
- **☁️ Real-time Dashboard:** A dynamic web interface hosting data synced seamlessly via Firebase Realtime Database.
- **🤖 AI Decision-Support Chatbot:** Analyzes both the live ground data and NASA's climate patterns to give actionable, conversational advice to farmers (e.g., "Delay irrigation by 2 days due to incoming rain").

## 🛠️ System Architecture

### 1. Hardware Stack (The Edge)
- **Microcontroller:** ESP32 (Wi-Fi Enabled)
- **Environmental Sensor:** BME680 (Temp, Humidity, Pressure, VOC Air Quality)
- **Soil Sensor:** LM393 Soil Moisture Probe
- **Display:** SSD1306 OLED (0.96")
- **Power Architecture:** Ultra-safe 3.3V isolated logic (Zero 5V exposure to ESP32 for maximum field reliability).
- **Enclosure:** Custom 3D-printed vertical shell engineered for agricultural field conditions.

### 2. Software Stack (The Cloud & Web)
- **Backend/Database:** Firebase Realtime Database
- **Frontend:** HTML/CSS/JavaScript with Chart.js for data visualization
- **External APIs:** NASA POWER API, OpenAI/Gemini API (for the Chatbot)
- **Hosting:** GitHub Pages

## 🚀 How It Works
1. The user powers the **Smart Probe** and inserts it into the soil.
2. The ESP32 reads the local BME680 and Soil Moisture data and pushes it to **Firebase**.
3. The **Web Dashboard** fetches the real-time data from Firebase and overlays it with **NASA API** historical data.
4. The user asks the **AI Chatbot** for advice. The AI evaluates the combined datasets to recommend the optimal crop rotation or immediate field action.

## 👥 Team HAMADA YL3AB
- **Hardware & Mechatronics:** ESP32 Integration, Sensor Calibration, 3.3V Power Architecture, and 3D Mechanical Design.
- **Software & Web:** Firebase Integration, NASA API Routing, Dashboard UI, and AI Chatbot prompt engineering.

---
*Built with 💻 and ☕ for the NASA Space Apps Challenge, Luxor Event.*
