# ESP32 Drone Controller Bridge (E88 / WiFi UFO / JY-UFO Quadcopters)

This document contains the complete ESP32 firmware code, wiring, configuration, and flashing instructions to bridge your Web Browser / Laptop to the Drone over **Bluetooth** (Classic SPP / Web Serial) and **Wi-Fi** (UDP 8080 Handshake & UDP 8090 Control).

---

## 🚁 Architecture Overview

```
┌─────────────────────────┐          Bluetooth (SPP / Serial)         ┌─────────────────────────┐           Wi-Fi (UDP 8090 / 8080)          ┌─────────────────────────┐
│       Web App / PC      │  ======================================>  │         ESP32           │  ========================================> │       E88 Drone         │
│ (Chrome Web Serial/BLE) │  <======================================  │   (Access Point Client) │  <======================================== │ (WIFI-UFO Hotspot AP)   │
└─────────────────────────┘          Logs & Telemetry Packets         └─────────────────────────┘          Heartbeat & Flight Packets        └─────────────────────────┘
```

1. **ESP32 connects as a Station (STA)** to the drone's Wi-Fi hotspot (`WIFI-UFO-289424` or similar).
2. **ESP32 advertises Bluetooth** as `ESP32_Drone`.
3. **Your Laptop/Browser connects via Bluetooth Serial** (paired COM port or Web Serial API).
4. **Commands sent from the web app** (`'t'`, `'l'`, `'s'`, or continuous roll/pitch/throttle/yaw packets) are received by the ESP32 and transmitted via UDP packets to `192.168.4.1:8090` at 25Hz.

---

## 🛠️ Complete ESP32 Arduino Code (`drone_bridge.ino`)

Copy and paste this code into Arduino IDE / PlatformIO:

```cpp
#include <WiFi.h>
#include <WiFiUdp.h>
#include "BluetoothSerial.h"
#include "esp_bt.h"
#include "esp_coexist.h"

// ==========================================
// CONFIGURATION
// ==========================================
// Change this to your drone's SSID (found in your phone's Wi-Fi scan)
const char* DRONE_SSID = "WIFI-UFO-289424";
const char* DRONE_PASS = ""; // Usually open (no password)

const char* DRONE_IP          = "192.168.4.1";
const uint16_t HANDSHAKE_PORT = 8080;
const uint16_t CONTROL_PORT   = 8090;

#define LED_PIN 2 // Built-in Blue LED on most ESP32 Dev Kits

BluetoothSerial SerialBT;
WiFiUDP udp;

bool btConnected = false;

// Flight State Variables (Center = 128, Min = 0, Max = 255)
uint8_t curRoll     = 128; // 128 = Center (Left: 0, Right: 255)
uint8_t curPitch    = 128; // 128 = Center (Backward: 0, Forward: 255)
uint8_t curThrottle = 128; // 128 = Center (Down: 0, Up: 255)
uint8_t curYaw      = 128; // 128 = Center (Turn Left: 0, Turn Right: 255)
uint8_t curCmd      = 0x00; // 0x00=Hold, 0x01=Takeoff, 0x02=Land, 0x04=Emergency Stop, 0x08=Calibrate

// Callback to handle Bluetooth link connection / disconnection
void btCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  if (event == ESP_SPP_SRV_OPEN_EVT) {
    btConnected = true;
    Serial.println("[BT] Client Connected!");
    if (SerialBT.hasClient()) {
      SerialBT.println("STATUS:ESP32_CONNECTED");
    }
  } else if (event == ESP_SPP_CLOSE_EVT) {
    btConnected = false;
    Serial.println("[BT] Client Disconnected!");
  }
}

// Send standard 8-byte E88 / WIFI-UFO Drone Control Frame
void sendControlPacket(uint8_t roll, uint8_t pitch, uint8_t throttle, uint8_t yaw, uint8_t cmd) {
  uint8_t checksum = roll ^ pitch ^ throttle ^ yaw;
  uint8_t packet[8] = { 0x66, roll, pitch, throttle, yaw, cmd, checksum, 0x99 };

  udp.beginPacket(DRONE_IP, CONTROL_PORT);
  udp.write(packet, sizeof(packet));
  udp.endPacket();
}

// Send Handshake packet to unlock drone motors / camera feed
void sendHandshake() {
  uint8_t handshake[2] = { 0x42, 0x76 };
  udp.beginPacket(DRONE_IP, HANDSHAKE_PORT);
  udp.write(handshake, sizeof(handshake));
  udp.endPacket();
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("=================================");
  Serial.println("🚀 ESP32 Drone Controller Bridge");
  Serial.println("=================================");

  // 1. Initialize Bluetooth with event callback
  SerialBT.register_callback(btCallback);
  if (!SerialBT.begin("ESP32_Drone")) {
    Serial.println("[ERROR] Failed to initialize Bluetooth!");
  } else {
    Serial.println("[BT] Bluetooth 'ESP32_Drone' Ready for Pairing.");
  }

  // 2. Connect to Drone's Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(DRONE_SSID, DRONE_PASS);
  Serial.printf("[WIFI] Connecting to Drone SSID: %s...\n", DRONE_SSID);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Blink while searching
    delay(250);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH); // Solid blue = Wi-Fi locked
    Serial.println("\n[WIFI] Connected to Drone!");
    Serial.print("[WIFI] ESP32 IP: ");
    Serial.println(WiFi.localIP());

    // 3. Send activation handshake
    Serial.println("[UDP] Sending Handshake (0x42, 0x76)...");
    for (int i = 0; i < 5; i++) {
      sendHandshake();
      delay(60);
    }
  } else {
    Serial.println("\n[WIFI] Failed to connect to Drone. Will keep retrying in loop...");
  }
}

void loop() {
  // 1. Maintain Wi-Fi connection if lost
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (millis() - lastWifiRetry > 3000) {
      lastWifiRetry = millis();
      WiFi.reconnect();
      digitalWrite(LED_PIN, LOW);
    }
  } else {
    digitalWrite(LED_PIN, HIGH);
  }

  // 2. Paced 25Hz (40ms) Heartbeat / Flight Packet Stream
  static unsigned long lastFrame = 0;
  if (millis() - lastFrame >= 40) {
    lastFrame = millis();
    sendControlPacket(curRoll, curPitch, curThrottle, curYaw, curCmd);
    // Reset momentary command back to 0x00 after firing
    if (curCmd != 0x00) {
      curCmd = 0x00;
    }
  }

  // 3. Read incoming Bluetooth commands from Web App / PC
  if (SerialBT.available()) {
    String input = SerialBT.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      char c = input[0];

      // --- TAKEOFF (T / t) ---
      if (c == 't' || c == 'T') {
        if (btConnected) SerialBT.println("TAKEOFF_ACK");
        Serial.println("[CMD] TAKEOFF Triggered");
        for (int i = 0; i < 25; i++) {
          sendControlPacket(128, 128, 128, 128, 0x01);
          delay(40);
        }
      } 
      // --- LAND (L / l) ---
      else if (c == 'l' || c == 'L') {
        if (btConnected) SerialBT.println("LAND_ACK");
        Serial.println("[CMD] LAND Triggered");
        for (int i = 0; i < 25; i++) {
          sendControlPacket(128, 128, 128, 128, 0x02);
          delay(40);
        }
      } 
      // --- EMERGENCY STOP (S / s) ---
      else if (c == 's' || c == 'S') {
        if (btConnected) SerialBT.println("STOP_ACK");
        Serial.println("[CMD] STOP Triggered");
        curThrottle = 0;
        for (int i = 0; i < 20; i++) {
          sendControlPacket(128, 128, 0, 128, 0x04);
          delay(40);
        }
      }
      // --- GYRO CALIBRATION (C / c) ---
      else if (c == 'c' || c == 'C') {
        if (btConnected) SerialBT.println("CALIBRATE_ACK");
        Serial.println("[CMD] CALIBRATE Triggered");
        for (int i = 0; i < 15; i++) {
          sendControlPacket(128, 128, 128, 128, 0x08);
          delay(40);
        }
      }
      // --- HANDSHAKE RE-TRIGGER (H / h) ---
      else if (c == 'h' || c == 'H') {
        if (btConnected) SerialBT.println("HANDSHAKE_ACK");
        sendHandshake();
      }
      // --- PARAMETRIC PACKET: P,roll,pitch,throttle,yaw,cmd ---
      // Example: P,128,150,180,128,0
      else if (input.startsWith("P,")) {
        int r, p, t, y, cmd;
        if (sscanf(input.c_str(), "P,%d,%d,%d,%d,%d", &r, &p, &t, &y, &cmd) >= 4) {
          curRoll     = (uint8_t)constrain(r, 0, 255);
          curPitch    = (uint8_t)constrain(p, 0, 255);
          curThrottle = (uint8_t)constrain(t, 0, 255);
          curYaw      = (uint8_t)constrain(y, 0, 255);
          curCmd      = (uint8_t)constrain(cmd, 0, 255);
        }
      }
    }
  }

  // Mandatory yield to prevent FreeRTOS watchdog reset on radio core
  vTaskDelay(5 / portTICK_PERIOD_MS);
}
```

---

## ⚡ Step-by-Step Instructions

### 1. Requirements & Tools
- **Hardware**: ESP32 Development Board (ESP32-WROOM-32, NodeMCU ESP32, etc.)
- **Micro-USB / Type-C Cable** for flashing
- **Arduino IDE** (version 2.0+ recommended)
- **ESP32 Board Package installed** (`Tools` > `Board` > `Boards Manager` > Search `esp32` by Espressif Systems).

### 2. Flashing to ESP32
1. Open Arduino IDE.
2. Select your board: **Tools > Board > esp32 > ESP32 Dev Module**.
3. Select your COM Port: **Tools > Port > COMx**.
4. Set Flash Frequency to **80MHz** and Partition Scheme to **Default 4MB with spiffs** or **Huge APP (3MB No OTA/1MB SPIFFS)**.
5. Update `DRONE_SSID` if your drone uses a different SSID (e.g., `WIFI-4K-xxxxxx` or `WIFI-UFO-xxxxxx`).
6. Click **Upload** (Arrow icon).

### 3. Pairing with PC / Laptop
1. Power on the ESP32 (LED will blink while connecting to Wi-Fi).
2. On your Windows/Mac PC, go to **Settings > Bluetooth & Devices > Add Device > Bluetooth**.
3. Select and pair with **`ESP32_Drone`** (PIN is usually `1234` or `0000`, or none).
4. Once paired, Windows creates a standard Bluetooth Serial COM Port.

### 4. Connecting via the Web App
1. Open the Web App in **Google Chrome** or **Microsoft Edge**.
2. Select **"ESP32 Drone Mode"** on the home screen.
3. Click **"Connect to ESP32 (Bluetooth / Serial)"**.
4. Choose the paired **`ESP32_Drone`** device / serial port from the browser prompt.
5. Use on-screen controls, joysticks, or keyboard shortcuts (`T` for Takeoff, `L` for Land, `Space` for Emergency Stop).

---

## 📡 E88 Drone Packet Protocol Reference

| Byte # | Value | Description |
| :--- | :--- | :--- |
| `0` | `0x66` | Packet Start Header |
| `1` | `0x00 - 0xFF` (Default: `128`) | Roll / Aileron (0 = Left, 255 = Right) |
| `2` | `0x00 - 0xFF` (Default: `128`) | Pitch / Elevator (0 = Backward, 255 = Forward) |
| `3` | `0x00 - 0xFF` (Default: `128`) | Throttle (0 = Down / Idle, 255 = Maximum Altitude) |
| `4` | `0x00 - 0xFF` (Default: `128`) | Yaw / Rudder (0 = Spin Left, 255 = Spin Right) |
| `5` | `0x00` - `0x08` | Command Byte (`0x00`=Normal, `0x01`=Takeoff, `0x02`=Land, `0x04`=Stop, `0x08`=Calibrate) |
| `6` | `Roll ^ Pitch ^ Throttle ^ Yaw` | XOR Checksum of bytes 1 to 4 |
| `7` | `0x99` | Packet End Footer |
