#pragma once

// --- Wi-Fi ---
const char WIFI_SSID[] = "MAGS-OLC";
const char WIFI_PASS[] = "Merc1234!";   // "" for an open network

// --- MQTT broker (agree this with the backend person) ---
const char MQTT_HOST[] = "broker.hivemq.com";    // public test broker; replace with your own later
const uint16_t MQTT_PORT = 1883;
const char MQTT_USER[] = "arduinoClient";                     // leave empty if the broker has no login
const char MQTT_PASS[] = "123456";
const char TOPIC_BASE[] = "mspace";              // topics: mspace/<deviceId>/input|status|state

// --- Carrier ---
const bool USE_CASE = true;                      // false if the Carrier is used without the case
const uint8_t LEFT_PAD = 0;                      // TOUCH0..TOUCH4 (labelled 00..04 on the board)
const uint8_t RIGHT_PAD = 3;                     // pick two pads that do not light up together

