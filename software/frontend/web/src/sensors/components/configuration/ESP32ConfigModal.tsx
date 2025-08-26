import React, { useState } from 'react';
import { FiWifi, FiX, FiInfo, FiCopy, FiCheck } from 'react-icons/fi';

interface ESP32ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ESP32Config) => void;
}

interface ESP32Config {
  name: string;
  ip: string;
  port: number;
  protocol: 'websocket' | 'mqtt';
  mqttTopic?: string;
  authToken?: string;
}

const ESP32ConfigModal: React.FC<ESP32ConfigModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [config, setConfig] = useState<ESP32Config>({
    name: '',
    ip: '',
    port: 8080,
    protocol: 'websocket',
    mqttTopic: 'wit/sensors/',
    authToken: ''
  });

  const [showFirmware, setShowFirmware] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(config);
  };

  const exampleCode = `#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// WIT WebSocket server
const char* ws_host = "${config.ip || window.location.hostname}";
const int ws_port = ${config.port};
const char* ws_path = "/api/v1/sensors/ws/sensor";
const char* device_id = "esp32_01";
const char* auth_token = "${config.authToken || 'YOUR_AUTH_TOKEN'}";

WebSocketsClient webSocket;
StaticJsonDocument<256> doc;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  // Connect to WIT WebSocket
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  
  // Send authentication
  doc.clear();
  doc["type"] = "auth";
  doc["token"] = auth_token;
  doc["device_id"] = device_id;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
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

void sendSensorData() {
  doc.clear();
  doc["type"] = "sensor_data";
  doc["device_id"] = device_id;
  
  JsonObject data = doc.createNestedObject("data");
  data["temperature"] = readTemperature();
  data["humidity"] = readHumidity();
  data["timestamp"] = millis();
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket connected!");
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
  if (error) return;
  
  const char* cmd = doc["command"];
  if (strcmp(cmd, "read_sensor") == 0) {
    sendSensorData();
  }
  // Add more commands as needed
}

float readTemperature() {
  // Replace with actual sensor reading
  return 22.5 + random(-10, 10) / 10.0;
}

float readHumidity() {
  // Replace with actual sensor reading  
  return 45.0 + random(-50, 50) / 10.0;
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exampleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FiWifi className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Connect ESP32 Device</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Device Name */}
            <div>
              <label className="block text-gray-300 mb-2">Device Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Living Room Sensor"
                required
              />
            </div>

            {/* Connection Type */}
            <div>
              <label className="block text-gray-300 mb-2">Connection Protocol</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, protocol: 'websocket' })}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    config.protocol === 'websocket'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">WebSocket</div>
                  <div className="text-sm opacity-80">Real-time bidirectional</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, protocol: 'mqtt' })}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    config.protocol === 'mqtt'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">MQTT</div>
                  <div className="text-sm opacity-80">Lightweight pub/sub</div>
                </button>
              </div>
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">
                  {config.protocol === 'websocket' ? 'WebSocket Server IP' : 'MQTT Broker IP'}
                </label>
                <input
                  type="text"
                  value={config.ip}
                  onChange={(e) => setConfig({ ...config, ip: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={window.location.hostname || '192.168.1.100'}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Port</label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={config.protocol === 'websocket' ? '8080' : '1883'}
                  required
                />
              </div>
            </div>

            {/* MQTT Topic */}
            {config.protocol === 'mqtt' && (
              <div>
                <label className="block text-gray-300 mb-2">MQTT Topic Prefix</label>
                <input
                  type="text"
                  value={config.mqttTopic}
                  onChange={(e) => setConfig({ ...config, mqttTopic: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="wit/sensors/"
                />
              </div>
            )}

            {/* Auth Token */}
            <div>
              <label className="block text-gray-300 mb-2">Authentication Token (Optional)</label>
              <input
                type="text"
                value={config.authToken}
                onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty for no authentication"
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FiInfo className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                  <p className="mb-2">Make sure your ESP32 is connected to the same network as the WIT server.</p>
                  <button
                    type="button"
                    onClick={() => setShowFirmware(!showFirmware)}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    {showFirmware ? 'Hide' : 'Show'} example firmware code
                  </button>
                </div>
              </div>
            </div>

            {/* Example Firmware */}
            {showFirmware && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">ESP32 Example Firmware</h4>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? (
                      <>
                        <FiCheck className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <FiCopy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs text-gray-300 overflow-x-auto">
                  <code>{exampleCode}</code>
                </pre>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Connect Device
          </button>
        </div>
      </div>
    </div>
  );
};

export default ESP32ConfigModal;