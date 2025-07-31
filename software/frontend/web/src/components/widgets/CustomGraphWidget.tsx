import React, { useState, useEffect } from 'react';
import { FaTimes, FaCog, FaChartBar, FaChartLine, FaChartPie, FaChartArea, FaSortNumericUp } from 'react-icons/fa';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CustomGraphWidgetProps {
  onRemove: () => void;
  width?: number;
  height?: number;
  data?: any;
}

type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'area' | 'numeric';
type DataSource = 'random' | 'api' | 'manual' | 'sensor' | 'system';

interface ChartSettings {
  title: string;
  chartType: ChartType;
  dataSource: DataSource;
  refreshInterval: number; // seconds
  showLegend: boolean;
  showGrid: boolean;
  colorScheme: 'default' | 'blue' | 'green' | 'purple' | 'orange';
  dataPoints: number;
  unit: string;
}

const CustomGraphWidget: React.FC<CustomGraphWidgetProps> = ({ onRemove, width = 1, height = 1, data }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [numericValue, setNumericValue] = useState<number>(0);
  const [numericLabel, setNumericLabel] = useState<string>('');
  const [settings, setSettings] = useState<ChartSettings>({
    title: 'Custom Chart',
    chartType: 'line',
    dataSource: 'random',
    refreshInterval: 5,
    showLegend: true,
    showGrid: true,
    colorScheme: 'default',
    dataPoints: 10,
    unit: 'units'
  });

  const colorSchemes = {
    default: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
    blue: ['#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93BBFC', '#BFDBFE', '#DBEAFE', '#EFF6FF'],
    green: ['#14532D', '#166534', '#15803D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0'],
    purple: ['#3B0764', '#4C1D95', '#5B21B6', '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD'],
    orange: ['#7C2D12', '#9A3412', '#C2410C', '#EA580C', '#F97316', '#FB923C', '#FDBA74', '#FED7AA']
  };

  // Generate sample data based on settings
  const generateData = () => {
    const labels = Array.from({ length: settings.dataPoints }, (_, i) => {
      if (settings.dataSource === 'sensor') {
        return new Date(Date.now() - (settings.dataPoints - i - 1) * settings.refreshInterval * 1000).toLocaleTimeString();
      }
      return `Point ${i + 1}`;
    });

    const colors = colorSchemes[settings.colorScheme];
    
    if (settings.chartType === 'numeric') {
      // For numeric display, generate a single value
      const value = Math.floor(Math.random() * 1000);
      setNumericValue(value);
      setNumericLabel(settings.title);
      return;
    }

    const datasets = [];
    
    if (['pie', 'doughnut', 'radar', 'polarArea'].includes(settings.chartType)) {
      // Single dataset for pie-like charts
      datasets.push({
        label: settings.title,
        data: Array.from({ length: settings.dataPoints }, () => Math.floor(Math.random() * 100)),
        backgroundColor: colors.slice(0, settings.dataPoints),
        borderColor: colors.slice(0, settings.dataPoints).map(c => c + 'CC'),
        borderWidth: 2
      });
    } else {
      // Multiple datasets possible for line/bar charts
      const numDatasets = Math.min(3, Math.floor(Math.random() * 3) + 1);
      for (let i = 0; i < numDatasets; i++) {
        datasets.push({
          label: `Series ${i + 1}`,
          data: Array.from({ length: settings.dataPoints }, () => Math.floor(Math.random() * 100)),
          backgroundColor: settings.chartType === 'bar' ? colors[i] + '80' : colors[i] + '20',
          borderColor: colors[i],
          borderWidth: 2,
          fill: settings.chartType === 'area',
          tension: 0.4
        });
      }
    }

    setChartData({
      labels,
      datasets
    });
  };

  // Update data based on refresh interval
  useEffect(() => {
    generateData();
    const interval = setInterval(generateData, settings.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [settings]);

  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: settings.showLegend && !isCompact,
        position: 'top' as const,
        labels: {
          color: '#9CA3AF',
          font: {
            size: isCompact ? 10 : 12
          }
        }
      },
      title: {
        display: !isCompact,
        text: settings.title,
        color: '#F3F4F6',
        font: {
          size: isCompact ? 12 : 16
        }
      },
      tooltip: {
        enabled: !isCompact
      }
    },
    scales: ['line', 'bar', 'area'].includes(settings.chartType) ? {
      x: {
        display: !isCompact,
        grid: {
          display: settings.showGrid,
          color: '#374151'
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 10
          },
          maxTicksLimit: isCompact ? 5 : 10
        }
      },
      y: {
        display: !isCompact,
        grid: {
          display: settings.showGrid,
          color: '#374151'
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 10
          }
        }
      }
    } : {}
  };

  const renderChart = () => {
    if (!chartData && settings.chartType !== 'numeric') return null;

    switch (settings.chartType) {
      case 'line':
        return <Line data={chartData} options={chartOptions} />;
      case 'bar':
        return <Bar data={chartData} options={chartOptions} />;
      case 'area':
        return <Line data={chartData} options={chartOptions} />;
      case 'pie':
        return <Pie data={chartData} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={chartOptions} />;
      case 'radar':
        return <Doughnut data={chartData} options={chartOptions} />; // Using Doughnut as placeholder for Radar
      case 'numeric':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className={`${isCompact ? 'text-3xl' : isMedium ? 'text-5xl' : 'text-7xl'} font-bold text-white`}>
              {numericValue.toLocaleString()}
            </div>
            <div className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-400 mt-2`}>
              {settings.unit}
            </div>
            {!isCompact && (
              <div className="text-xs text-gray-500 mt-1">
                {numericLabel}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const getChartIcon = () => {
    switch (settings.chartType) {
      case 'bar': return FaChartBar;
      case 'pie': 
      case 'doughnut': return FaChartPie;
      case 'area': return FaChartArea;
      case 'numeric': return FaSortNumericUp;
      default: return FaChartLine;
    }
  };

  const ChartIcon = getChartIcon();

  return (
    <div className="widget-container group h-full">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r from-purple-600 to-purple-700 ${isCompact ? 'p-2' : 'p-3'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <ChartIcon size={isCompact ? 20 : 24} />
              {!isCompact && <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>{settings.title}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-white hover:text-purple-300 transition-colors"
              >
                <FaCog size={isCompact ? 14 : 16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
              >
                <FaTimes size={isCompact ? 14 : 16} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={`${isCompact ? 'p-3' : 'p-4'} flex-1 flex flex-col overflow-hidden`}>
          {showSettings ? (
            // Settings Panel
            <div className="space-y-3 overflow-y-auto">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1">Chart Type</label>
                <select
                  value={settings.chartType}
                  onChange={(e) => setSettings({ ...settings, chartType: e.target.value as ChartType })}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="line">Line Chart</option>
                  <option value="bar">Bar Chart</option>
                  <option value="area">Area Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="doughnut">Doughnut Chart</option>
                  <option value="radar">Radar Chart</option>
                  <option value="numeric">Numeric Display</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Data Source</label>
                <select
                  value={settings.dataSource}
                  onChange={(e) => setSettings({ ...settings, dataSource: e.target.value as DataSource })}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="random">Random Data</option>
                  <option value="sensor">Sensor Data</option>
                  <option value="system">System Metrics</option>
                  <option value="api">API Endpoint</option>
                  <option value="manual">Manual Input</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Color Scheme</label>
                <select
                  value={settings.colorScheme}
                  onChange={(e) => setSettings({ ...settings, colorScheme: e.target.value as any })}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="default">Default</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="purple">Purple</option>
                  <option value="orange">Orange</option>
                </select>
              </div>

              {settings.chartType !== 'numeric' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Data Points</label>
                    <input
                      type="number"
                      value={settings.dataPoints}
                      onChange={(e) => setSettings({ ...settings, dataPoints: parseInt(e.target.value) || 10 })}
                      min="3"
                      max="20"
                      className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showLegend"
                      checked={settings.showLegend}
                      onChange={(e) => setSettings({ ...settings, showLegend: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="showLegend" className="text-xs text-gray-400">Show Legend</label>
                  </div>

                  {['line', 'bar', 'area'].includes(settings.chartType) && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showGrid"
                        checked={settings.showGrid}
                        onChange={(e) => setSettings({ ...settings, showGrid: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="showGrid" className="text-xs text-gray-400">Show Grid</label>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1">Refresh Interval (seconds)</label>
                <input
                  type="number"
                  value={settings.refreshInterval}
                  onChange={(e) => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) || 5 })}
                  min="1"
                  max="60"
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Unit</label>
                <input
                  type="text"
                  value={settings.unit}
                  onChange={(e) => setSettings({ ...settings, unit: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                />
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded text-sm transition-colors"
              >
                Apply Settings
              </button>
            </div>
          ) : (
            // Chart Display
            <div className="flex-1 min-h-0">
              {renderChart()}
            </div>
          )}

          {/* Status Bar */}
          {!showSettings && !isCompact && (
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>Source: {settings.dataSource}</span>
              <span>Updates every {settings.refreshInterval}s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomGraphWidget;