#pragma once

// --- Wi-Fi ---
const char WIFI_SSID[] = "MAGS-OLC";
const char WIFI_PASS[] = "Merc1234!";   // "" for an open network

// --- MQTT broker (agree this with the backend person) ---
const char MQTT_HOST[] = "192.168.1.183";    // Mosquitto in Docker (IP only, no http://)  //alternatives: broker.hivemq.com, 192.168.1.183
const uint16_t MQTT_PORT = 1883;
const char MQTT_USER[] = "arduinoClient";                     // leave empty if the broker has no login
const char MQTT_PASS[] = "123456";
const uint32_t MQTT_KEEP_ALIVE_MS = 3000;         // min 2000; a lost board is noticed after ~1.5x this
const char TOPIC_BASE[] = "mspace";              // topics: mspace/<deviceId>/input|status|state

// --- Carrier ---
const bool USE_CASE = true;                      // false if the Carrier is used without the case
const uint8_t LEFT_PAD = 0;                      // TOUCH0..TOUCH4 (labelled 00..04 on the board)
const uint8_t START_PAD = 2;
const uint8_t RIGHT_PAD = 4;

// --- Game protocol ---
const char TOPIC_EVENTS_IN[] = "event";          // frontend -> board: mspace/<deviceId>/event
const char EVENT_START[] = "START_GAME";         // sent by the board when the start pad is touched (agree the name!)
const uint8_t START_SHIELDS = 3;                 // shown on the display after GAME_START

