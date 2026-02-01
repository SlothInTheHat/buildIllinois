import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import axios from 'axios';

interface TranscriptEntry {
  id: string;
  timestamp: string;
  text: string;
  isComplete: boolean;
  confidence?: number;
}

interface AudioTranscriberProps {
  sessionId: string;
  onTranscriptUpdate?: (entries: TranscriptEntry[]) => void;
}

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export default function AudioTranscriber({ sessionId, onTranscriptUpdate }: AudioTranscriberProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[AudioTranscriber] Recognition started, listening for speech...');
    };

    recognition.onresult = handleSpeechResult;
    recognition.onerror = handleSpeechError;
    recognition.onend = handleSpeechEnd;

    recognitionRef.current = recognition;

    console.log('[AudioTranscriber] Speech recognition initialized');

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSpeechResult = (event: SpeechRecognitionEvent) => {
    const current = event.resultIndex;
    const transcript = event.results[current][0].transcript;
    const confidence = event.results[current][0].confidence;
    const isFinal = event.results[current].isFinal;

    console.log('[AudioTranscriber] Result:', { transcript, isFinal, confidence });

    if (isFinal) {
      addCompleteSentence(transcript.trim(), confidence);
    } else {
      setPartialText(transcript);
    }
  };

  const handleSpeechError = (event: SpeechRecognitionErrorEvent) => {
    console.error('[AudioTranscriber] Speech error:', event.error);

    // Don't treat "no-speech" as a fatal error - it's just silence
    if (event.error === 'no-speech') {
      console.log('[AudioTranscriber] No speech detected, continuing...');
      return;
    }

    // Other errors should stop recording
    setError(`Recognition error: ${event.error}`);
    setIsRecording(false);
  };

  const handleSpeechEnd = () => {
    console.log('[AudioTranscriber] Speech ended, auto-restarting...');
    // Auto-restart if still recording (prevents timeout)
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('[AudioTranscriber] Failed to restart:', e);
      }
    }
  };

  const addCompleteSentence = async (text: string, confidence?: number) => {
    if (!text.trim()) return;

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const entry: TranscriptEntry = {
      id: crypto.randomUUID(),
      timestamp,
      text,
      isComplete: true,
      confidence,
    };

    setTranscriptEntries(prev => {
      const updated = [...prev, entry];
      onTranscriptUpdate?.(updated);
      return updated;
    });

    setPartialText('');

    // Send to backend
    try {
      console.log('[AudioTranscriber] Sending to backend:', { sessionId, timestamp, text: text.substring(0, 50) });
      const response = await axios.post('/api/realtime_audio_chunk', {
        sessionId,
        timestamp,
        text,
        confidence,
        isFinal: true,
      });
      console.log('[AudioTranscriber] Backend response:', response.data);
    } catch (err) {
      console.error('[AudioTranscriber] Failed to send to backend:', err);
    }
  };

  const startRecording = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Request microphone permission and test audio input
      console.log('[AudioTranscriber] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[AudioTranscriber] Microphone access granted:', stream.getAudioTracks());

      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
        console.log('[AudioTranscriber] Speech recognition started - please speak clearly!');
      }
    } catch (err) {
      setError('Microphone permission denied');
      console.error('[AudioTranscriber] Microphone error:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setPartialText('');
      console.log('[AudioTranscriber] Recording stopped');
    }
  };

  return (
    <div className="audio-transcriber">
      <div className="transcriber-controls">
        <button
          className={`btn ${isRecording ? 'btn-recording' : 'btn-secondary'}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isInitializing || !!error}
        >
          {isInitializing ? (
            <>
              <Loader2 className="spinning" size={18} />
              Initializing...
            </>
          ) : isRecording ? (
            <>
              <MicOff size={18} />
              Stop Recording
            </>
          ) : (
            <>
              <Mic size={18} />
              Start Recording
            </>
          )}
        </button>

        {error && <span className="error-text">{error}</span>}
      </div>

      <div className="transcript-display">
        <h4>Live Transcript</h4>
        {isRecording && transcriptEntries.length === 0 && !partialText && (
          <div style={{ padding: '1rem', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
            🎤 Listening... Speak clearly into your microphone and pause after each sentence.
          </div>
        )}
        <div className="transcript-entries">
          {transcriptEntries.map(entry => (
            <div key={entry.id} className="transcript-entry complete">
              <span className="timestamp">[{entry.timestamp}]</span>
              <span className="text">{entry.text}</span>
            </div>
          ))}
          {partialText && (
            <div className="transcript-entry partial">
              <span className="text">{partialText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
