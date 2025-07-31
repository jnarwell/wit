import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaVideo, FaVideoSlash, FaCog, FaPlay, FaPause, FaExpand, FaCircle, FaStop, FaDownload } from 'react-icons/fa';

interface VideoStreamWidgetProps {
  onRemove: () => void;
  width?: number;
  height?: number;
  data?: {
    sourceId?: string;
    sourceName?: string;
    streamUrl?: string;
  };
}

interface VideoSource {
  id: string;
  name: string;
  type: 'webcam' | 'stream' | 'machine' | 'security';
  url?: string;
  deviceId?: string;
}

const VideoStreamWidget: React.FC<VideoStreamWidgetProps> = ({ onRemove, width = 1, height = 1, data }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>(data?.sourceId || 'default');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<{ url: string; timestamp: Date; duration: number }[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  // Available video sources
  const videoSources: VideoSource[] = [
    { id: 'default', name: 'Default Webcam', type: 'webcam' },
    { id: 'machine-cam-1', name: 'CNC Mill Camera', type: 'machine', url: 'http://192.168.1.100:8080/stream' },
    { id: 'machine-cam-2', name: '3D Printer Camera', type: 'machine', url: 'http://192.168.1.101:8080/stream' },
    { id: 'security-1', name: 'Workshop Entrance', type: 'security', url: 'rtsp://192.168.1.200:554/stream1' },
    { id: 'security-2', name: 'Storage Area', type: 'security', url: 'rtsp://192.168.1.201:554/stream1' },
  ];

  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  // Get available cameras
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoInputs);
      })
      .catch(err => console.error('Error getting devices:', err));
  }, []);

  // Initialize video source
  useEffect(() => {
    const initVideo = async () => {
      setIsLoading(true);
      setHasError(false);

      const source = videoSources.find(s => s.id === selectedSource);
      
      try {
        if (source?.type === 'webcam') {
          // Use webcam
          const constraints = {
            video: {
              deviceId: selectedCamera !== 'default' ? { exact: selectedCamera } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          mediaStream.current = stream;
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } else if (source?.url) {
          // Use stream URL (simulated for demo)
          if (videoRef.current) {
            // In a real implementation, you'd handle different stream types
            // For now, we'll simulate with a placeholder
            videoRef.current.src = '';
            simulateVideoStream();
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing video:', err);
        setHasError(true);
        setIsLoading(false);
      }
    };

    initVideo();

    return () => {
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [selectedSource, selectedCamera]);

  // Simulate video stream for non-webcam sources
  const simulateVideoStream = () => {
    // In a real implementation, this would connect to actual streams
    // For demo, we'll show a placeholder
    setIsLoading(false);
  };

  // Update current time
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !isPaused) {
        const minutes = Math.floor(videoRef.current.currentTime / 60);
        const seconds = Math.floor(videoRef.current.currentTime % 60);
        setCurrentTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
      setIsPaused(!isPaused);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const getSourceType = () => {
    const source = videoSources.find(s => s.id === selectedSource);
    return source?.type || 'webcam';
  };

  const startRecording = () => {
    if (!mediaStream.current) return;

    recordingChunks.current = [];
    
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus' 
        : 'video/webm';
        
      mediaRecorder.current = new MediaRecorder(mediaStream.current, {
        mimeType: mimeType
      });

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(recordingChunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        setRecordings(prev => [...prev, {
          url,
          timestamp: new Date(),
          duration: recordingTime
        }]);

        // Auto-download the recording
        downloadRecording(blob, `video-recording-${new Date().toISOString()}.webm`);
        
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

  return (
    <div className="widget-container group h-full" ref={containerRef}>
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r from-purple-600 to-purple-700 ${isCompact ? 'p-2' : 'p-3'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <FaVideo size={isCompact ? 20 : 24} />
              {!isCompact && <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>Video Stream</span>}
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
                  className="text-white hover:text-purple-300 transition-colors"
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
        <div className={`${isCompact ? 'p-2' : 'p-3'} flex-1 flex flex-col`}>
          {showSettings && !isCompact ? (
            // Settings View
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Video Source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                >
                  {videoSources.map(source => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>
              
              {getSourceType() === 'webcam' && availableCameras.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Camera Device</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  >
                    <option value="default">Default Camera</option>
                    {availableCameras.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {getSourceType() !== 'webcam' && (
                <div className="text-xs text-gray-500 bg-gray-700 p-2 rounded">
                  <div className="font-medium text-gray-400 mb-1">Stream Info:</div>
                  <div>Type: {getSourceType()}</div>
                  <div>URL: {videoSources.find(s => s.id === selectedSource)?.url || 'N/A'}</div>
                </div>
              )}
              
              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded text-sm transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            // Video Display View
            <>
              {/* Source Name */}
              {!isCompact && (
                <div className="text-sm text-gray-400 mb-2">
                  {videoSources.find(s => s.id === selectedSource)?.name || 'Unknown Source'}
                </div>
              )}

              {/* Video Container */}
              <div 
                className="relative flex-1 bg-black rounded overflow-hidden cursor-pointer group/video"
                onClick={togglePlayPause}
              >
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-gray-400">
                      <FaVideo size={32} className="animate-pulse" />
                      <div className="text-xs mt-2">Loading...</div>
                    </div>
                  </div>
                )}

                {hasError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-red-400 text-center">
                      <FaVideoSlash size={32} />
                      <div className="text-xs mt-2">Stream Error</div>
                    </div>
                  </div>
                )}

                {!hasError && !isLoading && getSourceType() !== 'webcam' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-gray-500 text-center">
                      <FaVideo size={48} />
                      <div className="text-sm mt-2">Stream: {videoSources.find(s => s.id === selectedSource)?.name}</div>
                      <div className="text-xs mt-1 text-gray-600">Simulated Feed</div>
                    </div>
                  </div>
                )}

                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                  style={{ display: getSourceType() === 'webcam' ? 'block' : 'none' }}
                />

                {/* Play/Pause Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                  isPaused ? 'opacity-100 bg-black bg-opacity-50' : 'opacity-0 group-hover/video:opacity-100'
                }`}>
                  <button
                    className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-4 hover:bg-opacity-30 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPause();
                    }}
                  >
                    {isPaused ? <FaPlay size={isCompact ? 16 : 24} /> : <FaPause size={isCompact ? 16 : 24} />}
                  </button>
                </div>

                {/* Controls Overlay */}
                {!isCompact && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 opacity-0 group-hover/video:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between text-white text-xs">
                      <span>{isRecording ? `Recording: ${formatTime(recordingTime)}` : currentTime}</span>
                      <div className="flex items-center gap-2">
                        {getSourceType() === 'webcam' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              isRecording ? stopRecording() : startRecording();
                            }}
                            className={`hover:text-red-300 transition-colors ${isRecording ? 'text-red-400 animate-pulse' : ''}`}
                            disabled={hasError || isLoading}
                          >
                            {isRecording ? <FaStop size={14} /> : <FaCircle size={14} />}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFullscreen();
                          }}
                          className="hover:text-purple-300 transition-colors"
                        >
                          <FaExpand size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Bar */}
              {!isCompact && (
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${!hasError && !isLoading ? (isRecording ? 'bg-red-400' : 'bg-green-400') : 'bg-red-400'}`} />
                    {hasError ? 'Error' : isLoading ? 'Loading' : isRecording ? 'Recording' : isPaused ? 'Paused' : 'Live'}
                  </span>
                  <span>{getSourceType() === 'webcam' ? 'Webcam' : 'Stream'}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoStreamWidget;