// Voice Service for WIT Terminal
// Handles speech recognition, text-to-speech, and wake word detection

interface VoiceSettings {
  enabled: boolean;
  wakeWord: string;
  voice: string;
  pitch: number;
  rate: number;
  volume: number;
  continuous: boolean;
  autoSleep: boolean;
  sleepTimeout: number; // in minutes
}

interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isSleeping: boolean;
  lastActivity: Date;
}

class VoiceService {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private settings: VoiceSettings = {
    enabled: false,
    wakeWord: 'hey wit',
    voice: 'default',
    pitch: 0.9,  // Lower pitch for deeper voice
    rate: 0.9,   // Slightly slower for British accent
    volume: 1,
    continuous: true,
    autoSleep: true,
    sleepTimeout: 5
  };
  private state: VoiceState = {
    isListening: false,
    isSpeaking: false,
    isSleeping: false,
    lastActivity: new Date()
  };
  private sleepTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private commandBuffer: string = '';
  private silenceTimer: NodeJS.Timeout | null = null;
  private isProcessingCommand = false;

  constructor() {
    this.initializeSpeechRecognition();
    this.synthesis = window.speechSynthesis;
    this.loadSettings();
    
    // Ensure voices are loaded
    if (this.synthesis) {
      // Some browsers need a delay to load voices
      this.synthesis.getVoices();
      this.synthesis.onvoiceschanged = () => {
        const voices = this.synthesis!.getVoices();
        console.log('[VoiceService] Available voices:', voices.map(v => `${v.name} (${v.lang})`));
      };
    }
  }

  private initializeSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[VoiceService] Speech recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      console.log('[VoiceService] Recognition started');
      this.state.isListening = true;
      this.emit('listening-start');
    };

    this.recognition.onend = () => {
      console.log('[VoiceService] Recognition ended');
      this.state.isListening = false;
      this.emit('listening-end');
      
      // Restart if continuous mode is enabled and not sleeping
      if (this.settings.enabled && this.settings.continuous && !this.state.isSleeping) {
        setTimeout(() => this.startListening(), 100);
      }
    };

    this.recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      const isFinal = event.results[current].isFinal;

      if (isFinal) {
        this.handleFinalTranscript(transcript);
      } else {
        this.handleInterimTranscript(transcript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[VoiceService] Recognition error:', event.error);
      this.emit('error', event.error);
      
      // Restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        if (this.settings.enabled && this.settings.continuous && !this.state.isSleeping) {
          setTimeout(() => this.startListening(), 1000);
        }
      }
    };
  }

  private loadSettings() {
    const saved = localStorage.getItem('wit-voice-settings');
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }
  }

  private saveSettings() {
    localStorage.setItem('wit-voice-settings', JSON.stringify(this.settings));
  }

  public updateSettings(settings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
    
    if (this.recognition) {
      this.recognition.continuous = this.settings.continuous;
    }

    if (settings.enabled !== undefined) {
      if (settings.enabled) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  private handleInterimTranscript(transcript: string) {
    this.emit('interim-transcript', transcript);
    
    // Update activity timestamp
    this.state.lastActivity = new Date();
    
    // Clear silence timer on any speech
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private handleFinalTranscript(transcript: string) {
    console.log('[VoiceService] Final transcript:', transcript);
    
    // Ignore input while speaking to prevent feedback loops
    if (this.state.isSpeaking) {
      console.log('[VoiceService] Ignoring transcript while speaking');
      return;
    }
    
    this.emit('final-transcript', transcript);
    
    const lowerTranscript = transcript.toLowerCase().trim();
    
    // Check for wake word if sleeping
    if (this.state.isSleeping) {
      if (lowerTranscript.includes(this.settings.wakeWord.toLowerCase())) {
        this.wakeUp();
        // Remove wake word from command
        const command = transcript.replace(new RegExp(this.settings.wakeWord, 'i'), '').trim();
        if (command) {
          this.processCommand(command);
        }
      }
      return;
    }

    // Check for stop command
    if (lowerTranscript === 'stop' || lowerTranscript === 'stop listening') {
      this.stop();
      return;
    }

    // Process command
    this.processCommand(transcript);

    // Reset sleep timer
    this.resetSleepTimer();

    // Start silence detection timer
    this.startSilenceTimer();
  }

  private processCommand(command: string) {
    if (this.isProcessingCommand) {
      this.commandBuffer = command;
      return;
    }

    this.isProcessingCommand = true;
    this.emit('command', command);
    
    // Reset processing flag after a delay
    setTimeout(() => {
      this.isProcessingCommand = false;
      if (this.commandBuffer) {
        const buffered = this.commandBuffer;
        this.commandBuffer = '';
        this.processCommand(buffered);
      }
    }, 500);
  }

  private startSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Pause after 3 seconds of silence
    this.silenceTimer = setTimeout(() => {
      if (!this.state.isSpeaking && !this.state.isSleeping) {
        console.log('[VoiceService] Pausing due to silence');
        this.emit('pause');
      }
    }, 3000);
  }

  private resetSleepTimer() {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
    }

    if (this.settings.autoSleep && this.settings.sleepTimeout > 0) {
      const timeout = this.settings.sleepTimeout * 60 * 1000;
      this.sleepTimer = setTimeout(() => this.sleep(), timeout);
    }
  }

  private sleep() {
    console.log('[VoiceService] Going to sleep');
    this.state.isSleeping = true;
    this.emit('sleep');
    
    // Continue listening for wake word
    if (this.state.isListening && this.settings.continuous) {
      // Keep recognition active but in sleep mode
    }
  }

  private wakeUp() {
    console.log('[VoiceService] Waking up');
    this.state.isSleeping = false;
    this.state.lastActivity = new Date();
    this.resetSleepTimer();
    this.emit('wake');
    
    // Announce wake up
    this.speak('I\'m listening');
  }

  public start() {
    if (!this.recognition) {
      console.error('[VoiceService] Speech recognition not initialized');
      return;
    }

    this.settings.enabled = true;
    this.saveSettings();
    this.startListening();
    this.resetSleepTimer();
    
    // Announce activation
    this.speak('Voice mode activated. Say "hey wit" to wake me up anytime.');
  }

  public stop() {
    this.settings.enabled = false;
    this.saveSettings();
    this.stopListening();
    
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Announce deactivation
    this.speak('Voice mode deactivated');
  }

  private startListening() {
    if (!this.recognition || this.state.isListening) return;

    try {
      this.recognition.start();
    } catch (error) {
      console.error('[VoiceService] Failed to start recognition:', error);
    }
  }

  private stopListening() {
    if (!this.recognition || !this.state.isListening) return;

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('[VoiceService] Failed to stop recognition:', error);
    }
  }

  public async speak(text: string, options?: { priority?: boolean }) {
    if (!this.synthesis) {
      console.warn('[VoiceService] Speech synthesis not supported');
      return;
    }

    // Stop listening while speaking to prevent feedback loop
    const wasListening = this.state.isListening;
    if (wasListening) {
      this.stopListening();
    }

    // Cancel current speech if priority
    if (options?.priority && this.state.isSpeaking) {
      this.synthesis.cancel();
    }

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply voice settings
      utterance.pitch = this.settings.pitch;
      utterance.rate = this.settings.rate;
      utterance.volume = this.settings.volume;
      
      // Try to select a British male voice
      const voices = this.synthesis!.getVoices();
      const britishVoices = voices.filter(v => 
        v.lang.includes('en-GB') && 
        (v.name.toLowerCase().includes('male') || 
         v.name.toLowerCase().includes('daniel') ||
         v.name.toLowerCase().includes('arthur') ||
         v.name.toLowerCase().includes('george'))
      );
      
      // Fallback to any British voice
      const anyBritishVoice = britishVoices.length > 0 
        ? britishVoices[0] 
        : voices.find(v => v.lang.includes('en-GB'));
      
      if (anyBritishVoice) {
        utterance.voice = anyBritishVoice;
        console.log('[VoiceService] Using voice:', anyBritishVoice.name);
      } else if (this.settings.voice !== 'default') {
        const selectedVoice = voices.find(v => v.name === this.settings.voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onstart = () => {
        this.state.isSpeaking = true;
        this.emit('speech-start');
      };

      utterance.onend = () => {
        this.state.isSpeaking = false;
        this.emit('speech-end');
        
        // Resume listening after speaking if it was active
        if (wasListening && this.settings.enabled && !this.state.isSleeping) {
          setTimeout(() => this.startListening(), 500); // Small delay to avoid picking up echo
        }
        
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('[VoiceService] Speech error:', event);
        this.state.isSpeaking = false;
        
        // Resume listening on error too
        if (wasListening && this.settings.enabled && !this.state.isSleeping) {
          setTimeout(() => this.startListening(), 500);
        }
        
        resolve();
      };

      this.synthesis.speak(utterance);
    });
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  public on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: string, listener: Function) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, ...args: any[]) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  public getState(): VoiceState {
    return { ...this.state };
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  public isSleeping(): boolean {
    return this.state.isSleeping;
  }

  // Manual wake command
  public wake() {
    if (this.state.isSleeping) {
      this.wakeUp();
    }
  }

  // Test TTS
  public testVoice() {
    this.speak('Testing voice output. This is how I sound with current settings.');
  }
}

// Export singleton instance
export default new VoiceService();