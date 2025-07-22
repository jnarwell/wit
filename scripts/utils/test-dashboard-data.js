// Test script to add sample data and verify dashboard lists update

// Add sample projects
const sampleProjects = [
  {
    id: 'project-' + Date.now(),
    name: 'AI Assistant Development',
    type: 'research',
    status: 'green',
    metrics: [
      { label: 'Progress', value: '75% 🟢' },
      { label: 'Team', value: 'AI Team' }
    ],
    priority: 'high',
    team: 'AI Team',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Developing next-gen AI assistant',
    dateAdded: new Date().toISOString()
  },
  {
    id: 'project-' + (Date.now() + 1),
    name: 'Hardware Integration',
    type: 'development',
    status: 'yellow',
    metrics: [
      { label: 'Progress', value: '45% 🟡' },
      { label: 'Issues', value: '3 pending' }
    ],
    priority: 'medium',
    team: 'Hardware Team',
    dateAdded: new Date().toISOString()
  }
];

// Add sample machines
const sampleMachines = [
  {
    id: 'machine-' + Date.now(),
    name: 'Prusa MK3S+ #1',
    type: '3d-printer',
    status: 'green',
    metrics: [
      { label: 'Status', value: 'Printing 🟢' },
      { label: 'Progress', value: '67%' }
    ],
    connectionType: 'usb',
    connectionDetails: '/dev/ttyUSB0',
    manufacturer: 'Prusa',
    model: 'MK3S+',
    dateAdded: new Date().toISOString()
  },
  {
    id: 'machine-' + (Date.now() + 1),
    name: 'Epilog Laser',
    type: 'laser-cutter',
    status: 'yellow',
    metrics: [
      { label: 'Status', value: 'Maintenance 🟡' },
      { label: 'Last Service', value: '2 days ago' }
    ],
    connectionType: 'network',
    connectionDetails: '192.168.1.50',
    manufacturer: 'Epilog',
    dateAdded: new Date().toISOString()
  }
];

// Add sample sensors
const sampleSensors = [
  {
    id: 'sensor-' + Date.now(),
    name: 'Workshop Temperature',
    type: 'temperature',
    status: 'green',
    metrics: [
      { label: 'Current', value: '22.5°C 🟢' },
      { label: 'Range', value: '20-25°C' }
    ],
    connectionType: 'i2c',
    connectionDetails: '0x48',
    manufacturer: 'Adafruit',
    model: 'BME280',
    dateAdded: new Date().toISOString()
  },
  {
    id: 'sensor-' + (Date.now() + 1),
    name: 'Air Quality Monitor',
    type: 'air-quality',
    status: 'red',
    metrics: [
      { label: 'PM2.5', value: '85 µg/m³ 🔴' },
      { label: 'Alert', value: 'Poor quality' }
    ],
    connectionType: 'wireless',
    connectionDetails: 'MQTT',
    manufacturer: 'Plantower',
    dateAdded: new Date().toISOString()
  }
];

// Function to add test data
function addTestData() {
  // Add projects
  const existingProjects = JSON.parse(localStorage.getItem('wit-projects') || '[]');
  localStorage.setItem('wit-projects', JSON.stringify([...existingProjects, ...sampleProjects]));
  
  // Add machines
  const existingMachines = JSON.parse(localStorage.getItem('wit-machines') || '[]');
  localStorage.setItem('wit-machines', JSON.stringify([...existingMachines, ...sampleMachines]));
  
  // Add sensors
  const existingSensors = JSON.parse(localStorage.getItem('wit-sensors') || '[]');
  localStorage.setItem('wit-sensors', JSON.stringify([...existingSensors, ...sampleSensors]));
  
  // Dispatch custom events to trigger updates
  window.dispatchEvent(new Event('projects-updated'));
  window.dispatchEvent(new Event('machines-updated'));
  window.dispatchEvent(new Event('sensors-updated'));
  
  console.log('✅ Test data added successfully!');
  console.log('Projects:', existingProjects.length + sampleProjects.length);
  console.log('Machines:', existingMachines.length + sampleMachines.length);
  console.log('Sensors:', existingSensors.length + sampleSensors.length);
}

// Function to clear all data
function clearAllData() {
  localStorage.removeItem('wit-projects');
  localStorage.removeItem('wit-machines');
  localStorage.removeItem('wit-sensors');
  
  // Dispatch events
  window.dispatchEvent(new Event('projects-updated'));
  window.dispatchEvent(new Event('machines-updated'));
  window.dispatchEvent(new Event('sensors-updated'));
  
  console.log('🗑️ All data cleared!');
}

// Make functions available globally
window.addTestData = addTestData;
window.clearAllData = clearAllData;

console.log('Dashboard data test utilities loaded!');
console.log('Available commands:');
console.log('  addTestData() - Add sample items');
console.log('  clearAllData() - Clear all items');
