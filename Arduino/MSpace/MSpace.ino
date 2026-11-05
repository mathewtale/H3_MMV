/*
 * M-Space controller (Arduino MKR WiFi 1010 + MKR IoT Carrier)
 *
 * The board is only a controller. The game runs in the backend/frontend; the board
 * sends the player's input and shows feedback (LEDs, buzzer, screen) for game events.
 * <deviceId> is the board's MAC address (12 hex characters, printed on boot).
 * Every message is JSON and carries "timestamp" (UTC, ISO 8601, e.g. "2026-11-02T10:07:00Z").
 * The timestamp is left out if the board could not get the time over NTP yet.
 *
 * Touch pads
 *   00 = move left     02 = start game     04 = move right
 *   Touching several pads at once is ignored (neighbouring pads often light up together).
 *
 * ---- Board -> broker -------------------------------------------------------------- mspace/A88C7B842178/event
 * Topic mspace/<deviceId>/input   (one message per touch)
 *   MOVE_LEFT    pad 00 touched: the ship should move one lane to the left
 *   MOVE_RIGHT   pad 04 touched: the ship should move one lane to the right
 *   START_GAME   pad 02 touched: the player asks to start a new game
 *     e.g. {"event":"MOVE_LEFT","timestamp":"2026-11-02T10:07:00Z"}
 *
 * Topic mspace/<deviceId>/status  (retained)
 *   {"online":true}   sent after the board connects to the broker
 *   {"online":false}  sent by the broker (Last Will) if the board disconnects
 *
 * ---- Frontend/backend -> board ----------------------------------------------------
 * Topic mspace/<deviceId>/event   (the board reacts to each message)
 * Topic mspace/all/event          (same events, delivered to every board)
 *   GAME_START         a game has started. Shields are set to START_SHIELDS (config.h);
 *                      green LEDs, short beep, screen "GO!".
 *   GAME_OVER          the game has ended. Long red LEDs, low beep, screen "GAME OVER".
 *   OBSTACLE_HIT       the ship hit an obstacle (asteroid/satellite) and lost a shield.
 *                      Needs "data":{"shields":N} = shields left. Red LEDs, low beep.
 *   ENERGY_CELL_HIT    the ship picked up an energy cell and gained a shield.
 *                      Needs "data":{"shields":N} = shields now. Green LEDs, high beep.
 *   BORDER_HIT         the ship tried to leave the three lanes (hit the border).
 *                      Short orange LEDs and a short beep.
 *   BOOST_ACTIVATED    the boost has started. LEDs stay blue and the screen shows
 *                      "BOOST" until BOOST_DEACTIVATED arrives.
 *   BOOST_DEACTIVATED  the boost has ended. LEDs go back to off.
 *     e.g. {"event":"OBSTACLE_HIT","data":{"shields":2},"timestamp":"2026-11-02T10:07:00Z"}
 *   Unknown events and malformed JSON are ignored.
 */

#include <Arduino_MKRIoTCarrier.h>
#include <WiFiNINA.h>
#include <WiFiUdp.h>
#include <ArduinoMqttClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"

MKRIoTCarrier carrier;
WiFiClient net;
MqttClient mqtt(net);

String deviceId;
String topicInput, topicStatus, topicEvents;

/* ---------- UTC time (NTP) ---------- */

uint32_t baseEpoch = 0;       // UTC seconds at baseMillis; 0 = not synced yet
uint32_t baseMillis = 0;
uint32_t lastTimeSync = 0;

WiFiUDP ntpUdp;
const char *const NTP_SERVERS[] = {"pool.ntp.org", "time.google.com", "time.cloudflare.com", "dk.pool.ntp.org"};
const uint8_t NTP_SERVER_COUNT = sizeof(NTP_SERVERS) / sizeof(NTP_SERVERS[0]);
uint8_t ntpServerIdx = 0;

// plain NTP request over UDP port 123; returns UTC epoch seconds, 0 on failure
uint32_t ntpQuery(const char *host) {
  uint8_t pkt[48] = {0};
  pkt[0] = 0xE3;                      // LI = unsynced, version 4, mode 3 (client)
  ntpUdp.begin(2390);
  if (!ntpUdp.beginPacket(host, 123)) { ntpUdp.stop(); return 0; }
  ntpUdp.write(pkt, sizeof(pkt));
  ntpUdp.endPacket();
  const uint32_t started = millis();
  while (millis() - started < 1500) {
    if (ntpUdp.parsePacket() >= 48) {
      ntpUdp.read(pkt, sizeof(pkt));
      ntpUdp.stop();
      const uint32_t secs = ((uint32_t)pkt[40] << 24) | ((uint32_t)pkt[41] << 16) | ((uint32_t)pkt[42] << 8) | pkt[43];
      return secs > 2208988800UL ? secs - 2208988800UL : 0;   // NTP epoch 1900 -> Unix epoch 1970
    }
    delay(10);
  }
  ntpUdp.stop();
  return 0;
}

void syncTime() {
  const bool synced = baseEpoch != 0;
  if (synced && millis() - lastTimeSync < 3600000UL) return;                 // resync once an hour
  if (!synced && lastTimeSync && millis() - lastTimeSync < 5000) return;     // retry every 5 s
  lastTimeSync = millis();

  uint32_t t = WiFi.getTime();                       // the module's own NTP; 0 until it has the time
  if (!t) {
    t = ntpQuery(NTP_SERVERS[ntpServerIdx]);         // fallback: ask the NTP servers ourselves
    ntpServerIdx = (ntpServerIdx + 1) % NTP_SERVER_COUNT;
  }
  if (t) {
    baseEpoch = t;
    baseMillis = millis();
    Serial.println("Time synced");
  } else if (!synced) {
    Serial.println("Time sync failed (NTP/UDP 123 blocked?)");
  }
}

// "2026-11-02T10:07:00Z"
void isoNow(char *out, size_t size) {
  time_t t = baseEpoch + (millis() - baseMillis) / 1000;
  struct tm tmv;
  gmtime_r(&t, &tmv);
  strftime(out, size, "%Y-%m-%dT%H:%M:%SZ", &tmv);
}

/* ---------- sending events to the game ---------- */

void publishEvent(const char *event) {
  char ts[24] = "";
  if (baseEpoch) isoNow(ts, sizeof(ts));            // no clock yet -> leave the timestamp out
  mqtt.beginMessage(topicInput.c_str());
  mqtt.print("{\"event\":\"");
  mqtt.print(event);
  if (ts[0]) {
    mqtt.print("\",\"timestamp\":\"");
    mqtt.print(ts);
  }
  mqtt.print("\"}");
  mqtt.endMessage();
  Serial.print("input: ");
  Serial.print(event);
  Serial.print(" ");
  Serial.println(ts);
}

/* ---------- touch pads ---------- */

const uint32_t DEBOUNCE_MS = 35;
uint8_t rawMask = 0, stableMask = 0;
uint32_t changedAt = 0, lastPadPoll = 0;

void onPadsPressed(uint8_t pressed) {
  if (!mqtt.connected()) return;
  const uint8_t left = 1 << LEFT_PAD, start = 1 << START_PAD, right = 1 << RIGHT_PAD;
  const uint8_t used = pressed & (left | start | right);
  // several pads at once is almost always a ghost touch from a neighbouring pad: ignore it
  if (used == left) publishEvent("MOVE_LEFT");
  else if (used == right) publishEvent("MOVE_RIGHT");
  else if (used == start) publishEvent(EVENT_START);
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

/* ---------- feedback: LEDs, buzzer, screen ---------- */

uint32_t ledOffAt = 0;
bool boostOn = false;
int shields = -1;                 // -1 = unknown
const char *screenState = "READY";

void setLeds(uint8_t r, uint8_t g, uint8_t b) {
  for (uint8_t i = 0; i < 5; ++i) carrier.leds.setPixelColor(i, r, g, b);
  carrier.leds.show();
}

void flashLeds(uint8_t r, uint8_t g, uint8_t b, uint16_t ms) {
  setLeds(r, g, b);
  ledOffAt = millis() + ms;
}

// after a flash: back to blue while boost is on, otherwise off
void restoreLeds() {
  if (boostOn) setLeds(0, 80, 255);
  else setLeds(0, 0, 0);
}

void updateLeds() {
  if (ledOffAt && (int32_t)(millis() - ledOffAt) >= 0) {
    ledOffAt = 0;
    restoreLeds();
  }
}

void drawScreen() {
  carrier.display.fillScreen(0x0000);
  carrier.display.setTextColor(0xFFFF);
  carrier.display.setTextSize(4);
  carrier.display.setCursor(20, 40);
  carrier.display.print(screenState);

  // shields as squares (max 5)
  if (shields >= 0) {
    carrier.display.setTextSize(3);
    carrier.display.setCursor(20, 110);
    carrier.display.print("Shields ");
    carrier.display.print(shields);
    for (int i = 0; i < 5; ++i) {
      const uint16_t colour = (i < shields) ? 0x07FF : 0x4208;
      carrier.display.fillRect(20 + i * 42, 150, 34, 34, colour);
    }
  }
  if (boostOn) {
    carrier.display.setTextSize(3);
    carrier.display.setTextColor(0xFFE0);
    carrier.display.setCursor(20, 200);
    carrier.display.print("BOOST");
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

// events sent by the frontend/backend
void onMqttMessage(int size) {
  String body;
  while (mqtt.available()) body += (char)mqtt.read();
  JsonDocument doc;
  if (deserializeJson(doc, body)) return;   // ignore malformed messages
  const char *event = doc["event"] | "";
  const int shieldsIn = doc["data"]["shields"] | -1;
  Serial.print("event: ");
  Serial.println(event);

  if (!strcmp(event, "GAME_START")) {
    boostOn = false;
    shields = START_SHIELDS;
    screenState = "GO!";
    flashLeds(0, 255, 0, 400);
    carrier.Buzzer.beep(800, 100);
  } else if (!strcmp(event, "GAME_OVER")) {
    boostOn = false;
    screenState = "GAME OVER";
    flashLeds(255, 0, 0, 1500);
    carrier.Buzzer.beep(300, 300);
  } else if (!strcmp(event, "OBSTACLE_HIT")) {
    if (shieldsIn >= 0) shields = shieldsIn;
    screenState = "HIT!";
    flashLeds(255, 0, 0, 300);
    carrier.Buzzer.beep(200, 200);
  } else if (!strcmp(event, "ENERGY_CELL_HIT")) {
    if (shieldsIn >= 0) shields = shieldsIn;
    screenState = "ENERGY";
    flashLeds(0, 255, 0, 250);
    carrier.Buzzer.beep(1200, 80);
  } else if (!strcmp(event, "BORDER_HIT")) {
    screenState = "BORDER";
    flashLeds(255, 140, 0, 150);
    carrier.Buzzer.beep(400, 60);
  } else if (!strcmp(event, "BOOST_ACTIVATED")) {
    boostOn = true;
    screenState = "FLYING";
    setLeds(0, 80, 255);
    carrier.Buzzer.beep(1000, 100);
  } else if (!strcmp(event, "BOOST_DEACTIVATED")) {
    boostOn = false;
    screenState = "FLYING";
    restoreLeds();
    carrier.Buzzer.beep(500, 80);
  } else {
    return;                                  // unknown event: nothing to show
  }
  drawScreen();
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
  topicEvents = base + TOPIC_EVENTS_IN;
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
  mqtt.subscribe(topicEvents.c_str());                          // this board only: mspace/<id>/event
  mqtt.subscribe((String(TOPIC_BASE) + "/all/" + TOPIC_EVENTS_IN).c_str());  // every board:     mspace/all/event
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
  carrier.display.setRotation(0);   // library default is 2; 0 turns the screen 180 degrees
  showStatus("Connecting", "WiFi...");
  lastWifiAttempt = millis() - 10000;
}

void loop() {
  readPads();
  updateLeds();
  if (!ensureWifi()) return;
  syncTime();
  if (!deviceId.length()) {
    buildTopics();
    Serial.print("Device id: ");
    Serial.println(deviceId);
  }
  if (!ensureMqtt()) return;
  mqtt.poll();
}
