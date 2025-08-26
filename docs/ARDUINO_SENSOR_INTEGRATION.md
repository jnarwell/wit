# Arduino Sensor Integration Guide

## Overview

The WIT platform provides seamless integration with Arduino devices through the Universal Desktop Controller (UDC). This enables real-time sensor data collection from Arduino boards connected via USB.

## Architecture

```
┌─────────────────┐         USB Serial         ┌─────────────────┐
│ Arduino Device  │ ◄─────────────────────────► │      UDC        │
│                 │        9600 baud            │                 │
│ - Sensors       │                             │ - Serial Bridge │
│ - Arduino IDE   │                             │ - Auto-detect   │
└─────────────────┘                             └─────────────────┘
                                                          │
                                                          │ WebSocket
                                                          │ ws://localhost:8080/ws
                                                          ▼
                                                ┌─────────────────┐
                                                │  WIT Frontend   │
                                                │                 │
                                                │ - Device Mgmt   │
                                                │ - Data Display  │
                                                │ - Real-time Mon │
                                                └─────────────────┘
```

## Features

### 1. Auto-Detection
- **USB Port Scanning**: Automatically detects connected Arduino boards
- **Board Identification**: Recognizes common Arduino models (Uno, Mega, Nano, etc.)
- **Hot-plug Support**: Detects boards as they're connected/disconnected

### 2. Serial Communication
- **JSON Protocol**: Structured data exchange using JSON messages
- **Bidirectional**: Send commands to Arduino, receive sensor data
- **Multiple Baud Rates**: Support for 9600 to 115200 baud
- **Error Handling**: Automatic reconnection on serial errors

### 3. Sensor Support
- **Temperature**: Analog and digital temperature sensors
- **Humidity**: DHT11, DHT22, and analog humidity sensors
- **Pressure**: BMP280, BME280 barometric sensors
- **Light**: LDR, photodiodes, light sensors
- **Motion**: PIR sensors, accelerometers
- **Distance**: Ultrasonic sensors (HC-SR04)
- **Gas**: MQ series gas sensors
- **Soil**: Moisture and pH sensors

## Quick Start

### Prerequisites

1. **Universal Desktop Controller** installed and running
2. **Arduino IDE** for uploading sketches
3. **Arduino board** with sensors connected

### Step 1: Install Arduino Libraries

```bash
# In Arduino IDE, install these libraries via Library Manager:
- ArduinoJson (for JSON communication)
```

### Step 2: Upload Arduino Sketch

```cpp
/*
 * WIT Sensor Integration for Arduino
 * Sends sensor data via USB Serial to UDC
 */

#include <ArduinoJson.h>

// Sensor pin definitions
const int TEMP_PIN = A0;
const int HUMIDITY_PIN = A1;
const int LIGHT_PIN = A2;

// JSON document
StaticJsonDocument<256> doc;

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Wait for serial port to connect
  while (!Serial) {
    ; // Wait for serial port (needed for native USB)
  }
  
  // Send initialization message
  doc.clear();
  doc["type"] = "init";
  doc["device"] = "arduino";
  JsonArray sensors = doc.createNestedArray("sensors");
  sensors.add("temperature");
  sensors.add("humidity");
  sensors.add("light");
  
  serializeJson(doc, Serial);
  Serial.println();
}

void loop() {
  // Read sensor values
  float temperature = readTemperature();
  float humidity = readHumidity();
  int lightLevel = readLight();
  
  // Create data message
  doc.clear();
  doc["type"] = "data";
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["light"] = lightLevel;
  doc["timestamp"] = millis();
  
  // Send data
  serializeJson(doc, Serial);
  Serial.println();
  
  // Check for incoming commands
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }
  
  // Wait before next reading
  delay(5000); // Send data every 5 seconds
}

float readTemperature() {
  // Example: TMP36 temperature sensor
  int reading = analogRead(TEMP_PIN);
  float voltage = reading * 5.0 / 1023.0;
  float temperatureC = (voltage - 0.5) * 100.0;
  return temperatureC;
}

float readHumidity() {
  // Example: Simple analog humidity sensor
  int reading = analogRead(HUMIDITY_PIN);
  float humidity = map(reading, 0, 1023, 0, 100);
  return humidity;
}

int readLight() {
  // Example: LDR light sensor
  return analogRead(LIGHT_PIN);
}

void handleCommand(String cmd) {
  // Parse and handle commands from WIT
  StaticJsonDocument<128> cmdDoc;
  DeserializationError error = deserializeJson(cmdDoc, cmd);
  
  if (!error) {
    const char* command = cmdDoc["command"];
    if (strcmp(command, "read_now") == 0) {
      // Force immediate sensor reading
      loop();
    } else if (strcmp(command, "led_on") == 0) {
      digitalWrite(LED_BUILTIN, HIGH);
    } else if (strcmp(command, "led_off") == 0) {
      digitalWrite(LED_BUILTIN, LOW);
    }
  }
}
```

### Step 3: Connect in WIT

1. Ensure UDC is running
2. Navigate to **Sensors → Configuration**
3. Click **"Add Controller"** under Arduino section
4. Configure:
   - **Device Name**: Friendly name for your Arduino
   - **Serial Port**: Select detected port or enter manually
   - **Baud Rate**: Match your sketch (9600 default)
   - **Board Type**: Select your Arduino model
   - **Sensor Types**: Check sensors you're using

5. Click **"Connect Device"**

## Communication Protocol

### Message Types

#### Initialization (Arduino → WIT)
```json
{
  "type": "init",
  "device": "arduino",
  "sensors": ["temperature", "humidity", "light"]
}
```

#### Sensor Data (Arduino → WIT)
```json
{
  "type": "data",
  "temperature": 23.5,
  "humidity": 45.2,
  "light": 750,
  "timestamp": 123456789
}
```

#### Status Update (Arduino → WIT)
```json
{
  "type": "status",
  "freeMemory": 1024,
  "uptime": 3600000,
  "errors": 0
}
```

#### Commands (WIT → Arduino)
```json
{
  "command": "read_now",
  "params": {}
}
```

## Advanced Examples

### DHT22 Temperature & Humidity

```cpp
#include <DHT.h>
#include <ArduinoJson.h>

#define DHTPIN 2
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);
StaticJsonDocument<256> doc;

void setup() {
  Serial.begin(9600);
  dht.begin();
  
  // Send init message
  doc["type"] = "init";
  doc["device"] = "arduino";
  doc["model"] = "DHT22";
  JsonArray sensors = doc.createNestedArray("sensors");
  sensors.add("temperature");
  sensors.add("humidity");
  
  serializeJson(doc, Serial);
  Serial.println();
}

void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if (isnan(h) || isnan(t)) {
    Serial.println("{\"type\":\"error\",\"message\":\"Failed to read from DHT sensor\"}");
    return;
  }
  
  doc.clear();
  doc["type"] = "data";
  doc["temperature"] = t;
  doc["humidity"] = h;
  doc["timestamp"] = millis();
  
  serializeJson(doc, Serial);
  Serial.println();
  
  delay(5000);
}
```

### Multiple Sensor Types

```cpp
#include <ArduinoJson.h>
#include <NewPing.h>

// Pins
const int TRIGGER_PIN = 12;
const int ECHO_PIN = 11;
const int PIR_PIN = 7;
const int GAS_PIN = A0;

NewPing sonar(TRIGGER_PIN, ECHO_PIN, 200);
StaticJsonDocument<512> doc;

void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN, INPUT);
  
  doc["type"] = "init";
  doc["device"] = "arduino_multi";
  JsonArray sensors = doc.createNestedArray("sensors");
  sensors.add("distance");
  sensors.add("motion");
  sensors.add("gas");
  
  serializeJson(doc, Serial);
  Serial.println();
}

void loop() {
  doc.clear();
  doc["type"] = "data";
  
  // Ultrasonic distance
  int distance = sonar.ping_cm();
  doc["distance"] = distance;
  
  // PIR motion
  bool motion = digitalRead(PIR_PIN);
  doc["motion"] = motion;
  
  // Gas sensor
  int gasLevel = analogRead(GAS_PIN);
  doc["gas"] = gasLevel;
  
  doc["timestamp"] = millis();
  
  serializeJson(doc, Serial);
  Serial.println();
  
  delay(1000);
}
```

## Troubleshooting

### Arduino Not Detected

1. **Check USB Connection**
   - Ensure cable supports data (not charge-only)
   - Try different USB ports

2. **Verify Drivers**
   - Install CH340/FTDI drivers if needed
   - Check Device Manager (Windows) or System Information (Mac)

3. **UDC Connection**
   - Ensure UDC is running
   - Check UDC logs for errors
   - Verify Arduino plugin is loaded

### No Data Received

1. **Check Serial Monitor**
   - Open Arduino IDE Serial Monitor
   - Verify data is being sent
   - Check baud rate matches

2. **JSON Format**
   - Ensure valid JSON syntax
   - Use ArduinoJson library for reliable formatting
   - Check Serial buffer size

3. **Timing Issues**
   - Add delays between readings
   - Avoid flooding serial port
   - Check for blocking operations

### Connection Drops

1. **Power Issues**
   - Use powered USB hub for high-power sensors
   - Check voltage regulator on Arduino
   - Monitor current draw

2. **Serial Buffer**
   - Clear buffer regularly
   - Handle incomplete messages
   - Implement error recovery

## Best Practices

### 1. Error Handling
```cpp
void sendSensorData() {
  if (!Serial) return; // Check serial is ready
  
  float temp = readTemperature();
  if (isnan(temp)) {
    sendError("Temperature sensor error");
    return;
  }
  
  // Send valid data
  doc["temperature"] = temp;
  serializeJson(doc, Serial);
  Serial.println();
}
```

### 2. Memory Management
```cpp
// Use appropriate JSON document size
StaticJsonDocument<256> smallDoc;  // For simple messages
StaticJsonDocument<1024> largeDoc; // For complex data

// Monitor free memory
int freeRam() {
  extern int __heap_start, *__brkval;
  int v;
  return (int) &v - (__brkval == 0 ? (int) &__heap_start : (int) __brkval);
}
```

### 3. Sensor Calibration
```cpp
// Store calibration values in EEPROM
#include <EEPROM.h>

struct Calibration {
  float tempOffset;
  float humidityOffset;
};

Calibration cal;

void loadCalibration() {
  EEPROM.get(0, cal);
}

float getCalibratedTemp() {
  return readRawTemp() + cal.tempOffset;
}
```

## Integration with WIT Features

### 1. Live Data Visualization
- Data automatically appears in Live Data tab
- Real-time graphs update as data arrives
- Multiple Arduino devices supported simultaneously

### 2. Historical Storage
- All sensor data is stored in WIT database
- Query historical data via API
- Export data for analysis

### 3. Alerts & Automation
- Set thresholds for sensor values
- Trigger actions based on sensor data
- Email/SMS notifications

### 4. Project Integration
- Link Arduino sensors to WIT projects
- Use sensor data in workflows
- Control Arduino outputs from WIT

## Security Considerations

1. **Serial Port Access**
   - UDC requires appropriate permissions
   - Serial ports isolated per device
   - No direct network exposure

2. **Data Validation**
   - Validate all incoming data
   - Sanitize sensor readings
   - Handle malformed messages

3. **Command Authorization**
   - Commands require authentication via UDC
   - Rate limiting on commands
   - Audit trail for all operations

## Performance Tips

1. **Optimize Data Rate**
   ```cpp
   // Adaptive sampling based on change
   if (abs(currentTemp - lastTemp) > 0.5) {
     sendUpdate();
     lastTemp = currentTemp;
   }
   ```

2. **Batch Updates**
   ```cpp
   // Send multiple readings in one message
   doc["readings"][0]["type"] = "temperature";
   doc["readings"][0]["value"] = temp;
   doc["readings"][1]["type"] = "humidity";
   doc["readings"][1]["value"] = humidity;
   ```

3. **Use Binary Protocol** (Advanced)
   ```cpp
   // For high-frequency data
   struct SensorPacket {
     uint8_t type;
     uint32_t timestamp;
     float value;
   } __attribute__((packed));
   ```

## Resources

- [Arduino JSON Library](https://arduinojson.org/)
- [Arduino Serial Reference](https://www.arduino.cc/reference/en/language/functions/communication/serial/)
- [WIT API Documentation](/docs/API.md)
- [UDC Plugin Development](/software/universal-desktop-controller/docs/PLUGIN_DEVELOPMENT_GUIDE.md)