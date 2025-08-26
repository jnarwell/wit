# ESP32 Sensor Integration Guide

## Overview

The WIT platform provides comprehensive support for ESP32-based sensor devices through WebSocket connections. This guide covers everything from hardware setup to real-time data streaming.

## Architecture

```
┌─────────────────┐         WebSocket          ┌─────────────────┐
│   ESP32 Device  │ ◄─────────────────────────► │   WIT Backend   │
│                 │    /api/v1/sensors/ws/      │                 │
│ - WiFi Connected│         /sensor             │ - Python/FastAPI│
│ - Sensors       │                             │ - WebSocket     │
│ - Arduino IDE   │                             │ - Data Storage  │
└─────────────────┘                             └─────────────────┘
                                                          │
                                                          │ WebSocket
                                                          │ /api/v1/sensors/ws/ui
                                                          ▼
                                                ┌─────────────────┐
                                                │  WIT Frontend   │
                                                │                 │
                                                │ - React UI      │
                                                │ - Real-time viz │
                                                │ - Device mgmt   │
                                                └─────────────────┘
```

## Features

### 1. Device Management
- **Auto-discovery**: ESP32 devices can announce themselves on the network
- **Authentication**: Optional token-based security
- **Status Monitoring**: Real-time connection status (connected, disconnected, connecting)
- **Multiple Devices**: Support for unlimited ESP32 devices

### 2. Data Streaming
- **Real-time Updates**: WebSocket enables instant data transmission
- **Bidirectional Communication**: Send commands to ESP32, receive sensor data
- **Data Persistence**: Last 1000 readings stored per sensor
- **Multiple Channels**: Support for multiple sensor types per device

### 3. Supported Protocols
- **WebSocket**: Primary protocol for real-time communication
- **MQTT**: Alternative protocol (planned integration)
- **REST API**: For non-streaming operations

## Quick Start

### Step 1: Hardware Setup

Required components:
- ESP32 development board (ESP32-WROOM-32, NodeMCU-32S, etc.)
- Sensors (temperature, humidity, pressure, etc.)
- USB cable for programming

### Step 2: Install Arduino IDE

1. Download Arduino IDE from https://www.arduino.cc/
2. Add ESP32 board support:
   - File → Preferences → Additional Board URLs
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Tools → Board → Boards Manager → Search "ESP32" → Install

### Step 3: Install Required Libraries

```arduino
// Required libraries (install via Library Manager)
- WebSocketsClient by Markus Sattler
- ArduinoJson by Benoit Blanchon
```

### Step 4: Configure WiFi and Upload Code

1. Navigate to WIT Frontend → Sensors → Configuration
2. Click "Add ESP32"
3. Copy the generated Arduino code
4. Update WiFi credentials in the code:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```
5. Upload to ESP32 via Arduino IDE

### Step 5: Add Device in WIT

1. In the ESP32 configuration modal:
   - **Device Name**: Give your ESP32 a friendly name
   - **Protocol**: Select WebSocket (recommended)
   - **Server IP**: Auto-populated with WIT server address
   - **Port**: Default 8000
   - **Auth Token**: Optional security token

2. Click "Connect Device"

## Example ESP32 Firmware

```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* ws_host = "192.168.1.100";  // WIT server IP
const int ws_port = 8000;
const char* ws_path = "/api/v1/sensors/ws/sensor";
const char* device_id = "esp32_01";

WebSocketsClient webSocket;
StaticJsonDocument<256> doc;

// Example sensor pins
const int TEMP_PIN = 34;
const int HUMIDITY_PIN = 35;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  // Connect to WIT WebSocket
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  
  // Authenticate with server
  sendAuth();
}

void loop() {
  webSocket.loop();
  
  // Send sensor data every 5 seconds
  static unsigned long lastSend = 0;
  if (millis() - lastSend > 5000) {
    sendSensorData();
    lastSend = millis();
  }
}

void sendAuth() {
  doc.clear();
  doc["type"] = "auth";
  doc["device_id"] = device_id;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

void sendSensorData() {
  doc.clear();
  doc["type"] = "sensor_data";
  doc["device_id"] = device_id;
  doc["timestamp"] = millis();
  
  JsonObject data = doc.createNestedObject("data");
  data["temperature"] = readTemperature();
  data["humidity"] = readHumidity();
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
  
  Serial.print("Sent: temp=");
  Serial.print(data["temperature"].as<float>());
  Serial.print("°C, humidity=");
  Serial.print(data["humidity"].as<float>());
  Serial.println("%");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket connected!");
      sendAuth();
      break;
      
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected!");
      break;
      
    case WStype_TEXT:
      handleCommand((char*)payload);
      break;
  }
}

void handleCommand(char* payload) {
  DeserializationError error = deserializeJson(doc, payload);
  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }
  
  const char* cmd = doc["command"];
  if (strcmp(cmd, "read_sensor") == 0) {
    sendSensorData();
  } else if (strcmp(cmd, "reset") == 0) {
    ESP.restart();
  }
  // Add more commands as needed
}

float readTemperature() {
  // Replace with actual sensor reading
  // Example for analog sensor:
  // int raw = analogRead(TEMP_PIN);
  // float voltage = (raw / 4095.0) * 3.3;
  // float temp = (voltage - 0.5) * 100; // For TMP36
  
  // Simulated data
  return 22.5 + random(-50, 50) / 10.0;
}

float readHumidity() {
  // Replace with actual sensor reading
  // Simulated data
  return 45.0 + random(-100, 100) / 10.0;
}
```

## WebSocket API Reference

### Client → Server Messages

#### Authentication
```json
{
  "type": "auth",
  "device_id": "esp32_01",
  "token": "optional_auth_token"
}
```

#### Sensor Data
```json
{
  "type": "sensor_data",
  "device_id": "esp32_01",
  "timestamp": 1234567890,
  "data": {
    "temperature": 23.5,
    "humidity": 45.2,
    "pressure": 1013.25
  },
  "metadata": {
    "battery": 85,
    "rssi": -67
  }
}
```

#### Status Update
```json
{
  "type": "status",
  "device_id": "esp32_01",
  "status": {
    "uptime": 3600,
    "free_heap": 45000,
    "wifi_strength": -65
  }
}
```

### Server → Client Messages

#### Commands
```json
{
  "type": "command",
  "command": "read_sensor",
  "params": {}
}
```

#### Configuration
```json
{
  "type": "config",
  "sampling_rate": 1000,
  "channels": ["temperature", "humidity"]
}
```

## Frontend Integration

### Viewing Sensor Data

1. **Configuration Tab**: Manage ESP32 devices
   - Add/remove devices
   - View connection status
   - Configure device settings

2. **Live Data Tab**: Real-time sensor visualization
   - Live graphs and gauges
   - Current values display
   - Data streaming indicators

3. **History Tab**: Historical data analysis
   - Time-series graphs
   - Data export options
   - Statistical analysis

4. **Alerts Tab**: Threshold monitoring
   - Set min/max thresholds
   - Email/SMS notifications
   - Alert history

## Backend API Endpoints

### WebSocket Endpoints
- `ws://localhost:8000/api/v1/sensors/ws/sensor` - ESP32 connection endpoint
- `ws://localhost:8000/api/v1/sensors/ws/ui` - Frontend subscription endpoint

### REST Endpoints
- `GET /api/v1/sensors/connected` - List connected sensors
- `GET /api/v1/sensors/data/{sensor_id}` - Get historical data
- `POST /api/v1/sensors/command/{sensor_id}` - Send command to sensor
- `DELETE /api/v1/sensors/data/{sensor_id}` - Clear sensor data

## Troubleshooting

### ESP32 Won't Connect

1. **Check WiFi Connection**
   ```cpp
   // Add debug output
   Serial.print("Connecting to WiFi");
   while (WiFi.status() != WL_CONNECTED) {
     delay(500);
     Serial.print(".");
   }
   Serial.println("\nConnected!");
   Serial.print("IP: ");
   Serial.println(WiFi.localIP());
   ```

2. **Verify Server Address**
   - Ensure ESP32 and WIT server are on same network
   - Check firewall settings for port 8000

3. **Monitor Serial Output**
   - Use Arduino IDE Serial Monitor (115200 baud)
   - Look for connection errors

### No Data Appearing

1. **Check WebSocket Connection**
   - Look for "WebSocket connected!" in serial monitor
   - Verify authentication succeeded

2. **Validate JSON Format**
   - Use ArduinoJson Assistant: https://arduinojson.org/v6/assistant/
   - Ensure all required fields are present

3. **Test with Simulator**
   ```bash
   # Run the test script
   python test_sensor_websocket.py
   ```

## Security Considerations

1. **Network Security**
   - Use WPA2/WPA3 encryption
   - Consider network segmentation for IoT devices

2. **Authentication**
   - Implement token-based auth for production
   - Rotate tokens regularly

3. **Data Validation**
   - Validate all sensor readings
   - Implement rate limiting

4. **OTA Updates**
   - Use ESP32 OTA capabilities for remote updates
   - Sign firmware updates

## Advanced Features

### Multi-Sensor Support
```cpp
// Support multiple sensor types
JsonObject data = doc.createNestedObject("data");
data["temperature"] = dht.readTemperature();
data["humidity"] = dht.readHumidity();
data["pressure"] = bmp.readPressure();
data["light"] = analogRead(LDR_PIN);
data["motion"] = digitalRead(PIR_PIN);
```

### Power Management
```cpp
// Deep sleep between readings
esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
esp_deep_sleep_start();
```

### Local Storage
```cpp
// Store data during connection loss
#include <SPIFFS.h>
// Buffer readings to SPIFFS
// Send when reconnected
```

## Next Steps

1. **Expand Sensor Support**
   - Add I2C/SPI sensor libraries
   - Implement sensor auto-detection

2. **Add MQTT Support**
   - Alternative to WebSocket
   - Better for battery-powered devices

3. **Implement OTA Updates**
   - Remote firmware updates
   - Version management

4. **Create Sensor Templates**
   - Pre-configured sensor types
   - Plug-and-play functionality

## Resources

- [ESP32 Arduino Core Documentation](https://docs.espressif.com/projects/arduino-esp32/en/latest/)
- [WebSocketsClient Library](https://github.com/Links2004/arduinoWebSockets)
- [ArduinoJson Documentation](https://arduinojson.org/v6/doc/)
- [WIT Platform Documentation](/docs/README.md)