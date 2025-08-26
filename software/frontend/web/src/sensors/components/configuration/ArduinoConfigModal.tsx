import React, { useState } from 'react';
import { FiCpu, FiX, FiInfo, FiCopy, FiCheck, FiRefreshCw } from 'react-icons/fi';

interface ArduinoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ArduinoConfig) => void;
}

interface ArduinoConfig {
  name: string;
  port: string;
  baudRate: number;
  board: string;
  sensors: string[];
}

const ArduinoConfigModal: React.FC<ArduinoConfigModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [config, setConfig] = useState<ArduinoConfig>({
    name: '',
    port: '/dev/ttyUSB0',
    baudRate: 9600,
    board: 'arduino:avr:uno',
    sensors: []
  });

  const [showExample, setShowExample] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(config);
  };

  const scanPorts = async () => {
    setScanning(true);
    // TODO: Actually query UDC for available ports
    setTimeout(() => {
      setAvailablePorts(['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0']);
      setScanning(false);
    }, 1500);
  };

  const exampleCode = `/*
 * WIT Sensor Integration for Arduino
 * Sends sensor data via USB Serial to UDC
 */

// Sensor pin definitions
const int TEMP_PIN = A0;
const int HUMIDITY_PIN = A1;
const int LIGHT_PIN = A2;

// JSON buffer
char jsonBuffer[256];

void setup() {
  // Initialize serial communication
  Serial.begin(${config.baudRate});
  
  // Wait for serial port to connect
  while (!Serial) {
    ; // Wait for serial port to connect (needed for native USB)
  }
  
  // Send initialization message
  Serial.println("{\"type\":\"init\",\"device\":\"arduino\",\"sensors\":[\"temperature\",\"humidity\",\"light\"]}");
}

void loop() {
  // Read sensor values
  float temperature = readTemperature();
  float humidity = readHumidity();
  int lightLevel = readLight();
  
  // Create JSON message
  sprintf(jsonBuffer, 
    "{\"type\":\"data\",\"temperature\":%.2f,\"humidity\":%.2f,\"light\":%d,\"timestamp\":%lu}",
    temperature, humidity, lightLevel, millis()
  );
  
  // Send data
  Serial.println(jsonBuffer);
  
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
  // Replace with actual sensor reading logic
  int reading = analogRead(HUMIDITY_PIN);
  float humidity = map(reading, 0, 1023, 0, 100);
  return humidity;
}

int readLight() {
  // Example: LDR light sensor
  return analogRead(LIGHT_PIN);
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
            <FiCpu className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-bold text-white">Connect Arduino Device</h2>
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
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Workshop Arduino"
                required
              />
            </div>

            {/* Serial Port */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-300">Serial Port</label>
                <button
                  type="button"
                  onClick={scanPorts}
                  disabled={scanning}
                  className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
                >
                  {scanning ? (
                    <>
                      <FiRefreshCw className="w-3 h-3 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <FiRefreshCw className="w-3 h-3" />
                      Scan Ports
                    </>
                  )}
                </button>
              </div>
              {availablePorts.length > 0 ? (
                <select
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  {availablePorts.map(port => (
                    <option key={port} value={port}>{port}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="/dev/ttyUSB0"
                  required
                />
              )}
            </div>

            {/* Baud Rate and Board */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Baud Rate</label>
                <select
                  value={config.baudRate}
                  onChange={(e) => setConfig({ ...config, baudRate: parseInt(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Board Type</label>
                <select
                  value={config.board}
                  onChange={(e) => setConfig({ ...config, board: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="arduino:avr:uno">Arduino Uno</option>
                  <option value="arduino:avr:mega">Arduino Mega</option>
                  <option value="arduino:avr:nano">Arduino Nano</option>
                  <option value="arduino:avr:leonardo">Arduino Leonardo</option>
                  <option value="arduino:samd:mkr1000">Arduino MKR1000</option>
                  <option value="arduino:samd:zero">Arduino Zero</option>
                </select>
              </div>
            </div>

            {/* Sensor Types */}
            <div>
              <label className="block text-gray-300 mb-2">Sensor Types</label>
              <div className="grid grid-cols-2 gap-2">
                {['temperature', 'humidity', 'pressure', 'light', 'motion', 'distance', 'gas', 'soil'].map(sensor => (
                  <label key={sensor} className="flex items-center gap-2 text-gray-400 hover:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.sensors.includes(sensor)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfig({ ...config, sensors: [...config.sensors, sensor] });
                        } else {
                          setConfig({ ...config, sensors: config.sensors.filter(s => s !== sensor) });
                        }
                      }}
                      className="rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500"
                    />
                    <span className="capitalize">{sensor}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FiInfo className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-300">
                  <p className="mb-2">Arduino will communicate via USB Serial through the Universal Desktop Controller.</p>
                  <button
                    type="button"
                    onClick={() => setShowExample(!showExample)}
                    className="text-green-400 hover:text-green-300 underline"
                  >
                    {showExample ? 'Hide' : 'Show'} example Arduino code
                  </button>
                </div>
              </div>
            </div>

            {/* Example Code */}
            {showExample && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Arduino Example Code</h4>
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
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Connect Device
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArduinoConfigModal;