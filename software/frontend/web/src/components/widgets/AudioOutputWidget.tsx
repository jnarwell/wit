import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaVolumeUp, FaVolumeMute, FaCog, FaMicrophone, FaWaveSquare, FaCircle, FaStop, FaDownload } from 'react-icons/fa';

interface AudioOutputWidgetProps {
  onRemove: () => void;
  width?: number;
  height?: number;
  data?: {
    sourceId?: string;
    sourceName?: string;
    deviceId?: string;
  };
}

interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system' | 'stream' | 'sensor';
  deviceId?: string;
}

const AudioOutputWidget: React.FC<AudioOutputWidgetProps> = ({ onRemove, width = 1, height = 1, data }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(75);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>(data?.sourceId || 'default');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(data?.deviceId || 'default');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<{ url: string; timestamp: Date; duration: number }[]>([]);
  
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animationId = useRef<number | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  // Available audio sources
  const audioSources: AudioSource[] = [
    { id: 'default', name: 'Default Microphone', type: 'microphone' },
    { id: 'system', name: 'System Audio', type: 'system' },
    { id: 'machine-1', name: 'CNC Mill Audio', type: 'sensor' },
    { id: 'machine-2', name: '3D Printer Audio', type: 'sensor' },
    { id: 'stream-1', name: 'Workshop Stream', type: 'stream' },
  ];

  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  // Get available audio devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAvailableDevices(audioInputs);
      })
      .catch(err => console.error('Error getting devices:', err));
  }, []);

  // Initialize audio analysis
  useEffect(() => {
    if (selectedSource === 'default' || selectedSource.startsWith('machine')) {
      initializeAudio();
    } else {
      // Simulate audio for non-microphone sources
      simulateAudio();
    }

    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [selectedSource, selectedDevice]);

  const initializeAudio = async () => {
    try {
      // Get microphone access
      const constraints = {
        audio: {
          deviceId: selectedDevice !== 'default' ? { exact: selectedDevice } : undefined
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStream.current = stream;

      // Create audio context and analyser
      audioContext.current = new AudioContext();
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;

      const source = audioContext.current.createMediaStreamSource(stream);
      source.connect(analyser.current);

      setIsActive(true);
      visualize();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setIsActive(false);
    }
  };

  const simulateAudio = () => {
    setIsActive(true);
    const simulate = () => {
      // Simulate audio levels
      const baseLevel = selectedSource === 'system' ? 30 : 20;
      const variance = selectedSource === 'system' ? 40 : 25;
      const newLevel = baseLevel + Math.random() * variance;
      setAudioLevel(isMuted ? 0 : newLevel * (volume / 100));
      
      animationId.current = requestAnimationFrame(simulate);
    };
    simulate();
  };

  const visualize = () => {
    if (!analyser.current) return;

    const bufferLength = analyser.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyser.current) return;
      
      analyser.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedLevel = (average / 255) * 100;
      
      setAudioLevel(isMuted ? 0 : normalizedLevel * (volume / 100));
      
      animationId.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const startRecording = () => {
    if (!mediaStream.current) return;

    recordingChunks.current = [];
    
    try {
      mediaRecorder.current = new MediaRecorder(mediaStream.current, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(recordingChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        setRecordings(prev => [...prev, {
          url,
          timestamp: new Date(),
          duration: recordingTime
        }]);

        // Auto-download the recording
        downloadRecording(blob, `audio-recording-${new Date().toISOString()}.webm`);
        
        setRecordingTime(0);
      };

      mediaRecorder.current.start();
      setIsRecording(true);

      // Start recording timer
      const startTime = Date.now();
      recordingInterval.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      setIsRecording(false);
      
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  };

  const downloadRecording = (blob: Blob, filename: string) => {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceIcon = () => {
    const source = audioSources.find(s => s.id === selectedSource);
    if (source?.type === 'microphone') return FaMicrophone;
    if (source?.type === 'system') return FaVolumeUp;
    return FaWaveSquare;
  };

  const SourceIcon = getSourceIcon();

  // Visual bars for audio level
  const renderAudioBars = () => {
    const barCount = isCompact ? 5 : isMedium ? 8 : 12;
    const bars = [];
    
    for (let i = 0; i < barCount; i++) {
      const barHeight = (audioLevel / 100) * ((i + 1) / barCount) * 100;
      const isActive = barHeight > 10;
      
      bars.push(
        <div
          key={i}
          className="audio-bar"
          style={{
            height: `${Math.min(barHeight, 100)}%`,
            backgroundColor: isActive ? (barHeight > 70 ? '#ef4444' : barHeight > 40 ? '#f59e0b' : '#10b981') : '#374151'
          }}
        />
      );
    }
    
    return bars;
  };

  return (
    <div className="widget-container group h-full">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r from-green-600 to-green-700 ${isCompact ? 'p-2' : 'p-3'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <SourceIcon size={isCompact ? 20 : 24} />
              {!isCompact && <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>Audio Output</span>}
              {isCompact && isRecording && (
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isCompact && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(!showSettings);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-white hover:text-green-300 transition-colors"
                >
                  <FaCog size={14} />
                </button>
              )}
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
        <div className={`${isCompact ? 'p-3' : 'p-4'} flex-1 flex flex-col`}>
          {showSettings && !isCompact ? (
            // Settings View
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Audio Source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                >
                  {audioSources.map(source => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>
              
              {availableDevices.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Input Device</label>
                  <select
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  >
                    <option value="default">Default Device</option>
                    {availableDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Device ${device.deviceId.substring(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            // Audio Display View
            <>
              {/* Source Name */}
              {!isCompact && (
                <div className="text-sm text-gray-400 mb-2">
                  {audioSources.find(s => s.id === selectedSource)?.name || 'Unknown Source'}
                </div>
              )}

              {/* Audio Visualization */}
              <div 
                className={`flex-1 flex items-end justify-center gap-1 ${isCompact ? 'mb-2' : 'mb-3'} cursor-pointer`}
                onClick={toggleMute}
                style={{ minHeight: isCompact ? '60px' : '100px' }}
              >
                {renderAudioBars()}
              </div>

              {/* Mute Button, Record Button and Volume */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className={`${isCompact ? 'p-2' : 'p-3'} rounded-lg transition-all ${
                    isMuted 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {isMuted ? <FaVolumeMute size={isCompact ? 16 : 20} /> : <FaVolumeUp size={isCompact ? 16 : 20} />}
                </button>

                {/* Record Button */}
                {selectedSource === 'default' && (
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`${isCompact ? 'p-2' : 'p-3'} rounded-lg transition-all ${
                      isRecording 
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                    disabled={!isActive}
                  >
                    {isRecording ? <FaStop size={isCompact ? 16 : 20} /> : <FaCircle size={isCompact ? 16 : 20} />}
                  </button>
                )}

                {!isCompact && (
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      disabled={isMuted}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #10b981 0%, #10b981 ${volume}%, #374151 ${volume}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>{volume}%</span>
                      <span>100</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              {!isCompact && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span>
                    {isRecording ? (
                      <span className="text-red-400 font-medium">Recording: {formatTime(recordingTime)}</span>
                    ) : (
                      isMuted ? 'Muted' : `Volume: ${volume}%`
                    )}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .audio-bar {
          width: ${isCompact ? '8px' : '12px'};
          background-color: #374151;
          border-radius: 2px;
          transition: all 0.1s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AudioOutputWidget;