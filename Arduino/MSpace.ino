/*
 * M-Space controller (Arduino MKR WiFi 1010 + MKR IoT Carrier)
 *
 * Touch pads  ->  MQTT  mspace/<deviceId>/input   {"t":"left"} | {"t":"right"}
 * Status      ->  MQTT  mspace/<deviceId>/status  {"online":true}   (retained, Last Will = offline)
 * Game state  <-  MQTT  mspace/<deviceId>/state   {"lane":1,"shield":3,"score":120,"over":false,"event":"hit"}
 *                       event: "hit" | "pickup" | "over" | "start" (optional)
 */

#include <Arduino_MKRIoTCarrier.h>
#include <WiFiNINA.h>
#include <ArduinoMqttClient.h>
#include <ArduinoJson.h>
#include "config.h"

MKRIoTCarrier carrier;
WiFiClient net;
MqttClient mqtt(net);

String deviceId;
String topicInput, topicStatus, topicState;

/* ---------- touch pads ---------- */

const uint32_t DEBOUNCE_MS = 35;
uint8_t rawMask = 0, stableMask = 0;
uint32_t changedAt = 0, lastPadPoll = 0;

void publishInput(const char *direction) {
  mqtt.beginMessage(topicInput.c_str());
  mqtt.print("{\"t\":\"");
  mqtt.print(direction);
  mqtt.print("\"}");
  mqtt.endMessage();
  Serial.print("input: ");
  Serial.println(direction);
}

void onPadsPressed(uint8_t pressed) {
  const bool left = pressed & (1 << LEFT_PAD);
  const bool right = pressed & (1 << RIGHT_PAD);
  if (!mqtt.connected()) return;
  // both at once is almost always a ghost touch from a neighbouring pad: ignore it
  if (left && !right) publishInput("left");
  else if (right && !left) publishInput("right");
}

void readPads() {
  if (millis() - lastPadPoll < 5) return;
  lastPadPoll = millis();
  if (!carrier.Buttons.update()) return;
  uint8_t mask = 0;
  for (uint8_t i = 0; i < 5; ++i)
    if (carrier.Buttons.getTouch((touchButtons)i)) mask |= 1 << i;
  if (mask != rawMask) { rawMask = mask; changedAt = millis(); }
  if (rawMask != stableMask && millis() - changedAt >= DEBOUNCE_MS) {
    const uint8_t pressed = rawMask & ~stableMask;
    stableMask = rawMask;
    if (pressed) onPadsPressed(pressed);
  }
}

/* ---------- feedback (LEDs, buzzer, screen) ---------- */

uint32_t ledOffAt = 0;

void flashLeds(uint8_t r, uint8_t g, uint8_t b, uint16_t ms) {
  for (uint8_t i = 0; i < 5; ++i) carrier.leds.setPixelColor(i, r, g, b);
  carrier.leds.show();
  ledOffAt = millis() + ms;
}

void updateLeds() {
  if (ledOffAt && (int32_t)(millis() - ledOffAt) >= 0) {
    ledOffAt = 0;
    for (uint8_t i = 0; i < 5; ++i) carrier.leds.setPixelColor(i, 0, 0, 0);
    carrier.leds.show();
  }
}

void showStatus(const char *line1, const char *line2 = "") {
  carrier.display.fillScreen(0x0000);
  carrier.display.setTextColor(0xFFFF);
  carrier.display.setTextSize(3);
  carrier.display.setCursor(20, 70);
  carrier.display.print(line1);
  carrier.display.setCursor(20, 120);
  carrier.display.print(line2);
}

void showGame(int lane, int shield, long score) {
  carrier.display.fillScreen(0x0000);
  carrier.display.setTextColor(0xFFFF);
  carrier.display.setTextSize(3);
  carrier.display.setCursor(20, 40);
  carrier.display.print("Score ");
  carrier.display.print(score);
  carrier.display.setCursor(20, 90);
  carrier.display.print("Shield ");
  carrier.display.print(shield);
  // three lanes with the ship in the current one
  for (int i = 0; i < 3; ++i) {
    const uint16_t colour = (i == lane) ? 0x07FF : 0x4208;
    carrier.display.fillRect(30 + i * 70, 150, 50, 50, colour);
  }
}

void onMqttMessage(int size) {
  String body;
  while (mqtt.available()) body += (char)mqtt.read();
  JsonDocument doc;
  if (deserializeJson(doc, body)) return;   // ignore malformed messages

  const char *event = doc["event"] | "";
  if (!strcmp(event, "hit")) {
    flashLeds(255, 0, 0, 300);
    carrier.Buzzer.beep(200, 200);
  } else if (!strcmp(event, "pickup")) {
    flashLeds(0, 255, 0, 250);
    carrier.Buzzer.beep(1200, 80);
  } else if (!strcmp(event, "over")) {
    flashLeds(255, 0, 0, 1000);
    carrier.Buzzer.beep(150, 500);
  }
  if (doc["over"] | false) {
    showStatus("GAME OVER", "");
    carrier.display.setCursor(20, 170);
    carrier.display.print("Score ");
    carrier.display.print((long)(doc["score"] | 0));
  } else {
    showGame(doc["lane"] | 1, doc["shield"] | 0, (long)(doc["score"] | 0));
  }
}

/* ---------- network ---------- */

uint32_t lastWifiAttempt = 0, lastMqttAttempt = 0;

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  if (millis() - lastWifiAttempt >= 10000) {
    lastWifiAttempt = millis();
    Serial.println("Connecting to WiFi...");
    if (WIFI_PASS[0]) WiFi.begin(WIFI_SSID, WIFI_PASS);
    else WiFi.begin(WIFI_SSID);
  }
  return false;
}

void buildTopics() {
  byte mac[6];
  WiFi.macAddress(mac);
  char id[13];
  snprintf(id, sizeof(id), "%02X%02X%02X%02X%02X%02X", mac[5], mac[4], mac[3], mac[2], mac[1], mac[0]);
  deviceId = id;
  const String base = String(TOPIC_BASE) + "/" + deviceId + "/";
  topicInput = base + "input";
  topicStatus = base + "status";
  topicState = base + "state";
}

void publishStatus(const char *json) {
  mqtt.beginMessage(topicStatus.c_str(), true, 1);   // retained, QoS 1
  mqtt.print(json);
  mqtt.endMessage();
}

bool ensureMqtt() {
  if (mqtt.connected()) return true;
  if (millis() - lastMqttAttempt < 3000) return false;
  lastMqttAttempt = millis();

  mqtt.setId(("mspace-" + deviceId).c_str());
  if (MQTT_USER[0]) mqtt.setUsernamePassword(MQTT_USER, MQTT_PASS);
  // Last Will: the broker publishes this if the board disappears
  mqtt.beginWill(topicStatus.c_str(), true, 1);
  mqtt.print("{\"online\":false}");
  mqtt.endWill();

  Serial.print("Connecting to MQTT... ");
  if (!mqtt.connect(MQTT_HOST, MQTT_PORT)) {
    Serial.print("failed, error ");
    Serial.println(mqtt.connectError());
    return false;
  }
  Serial.println("connected");
  mqtt.onMessage(onMqttMessage);
  mqtt.subscribe(topicState.c_str());
  publishStatus("{\"online\":true}");
  showStatus("Ready", deviceId.c_str());
  return true;
}

/* ---------- main ---------- */

void setup() {
  Serial.begin(9600);
  uint32_t started = millis();
  while (!Serial && millis() - started < 3000) {}
  Serial.println("Boot");

  if (USE_CASE) carrier.withCase();
  else carrier.noCase();
  if (!carrier.begin()) {
    Serial.println("Carrier failed");
    while (true);
  }
  showStatus("Connecting", "WiFi...");
  lastWifiAttempt = millis() - 10000;
}

void loop() {
  readPads();
  updateLeds();
  if (!ensureWifi()) return;
  if (!deviceId.length()) {
    buildTopics();
    Serial.print("Device id: ");
    Serial.println(deviceId);
  }
  if (!ensureMqtt()) return;
  mqtt.poll();
}
