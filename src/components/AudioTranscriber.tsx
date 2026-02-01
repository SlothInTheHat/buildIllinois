import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import axios from 'axios';

interface TranscriptEntry {
  id: string;
  timestamp: string;
  text: string;
  isComplete: boolean;
}

interface AudioTranscriberProps {
  sessionId: string;
  onTranscriptUpdate?: (entries: TranscriptEntry[]) => void;
  onSpeechFinalized?: (text: string) => void;
  autoSendToAI?: boolean;
  isAISpeaking?: boolean;
  onStopRecording?: (collectedText: string) => void;
}

// Check if browser supports Web Speech API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function AudioTranscriber({ sessionId, onTranscriptUpdate, onSpeechFinalized, autoSendToAI = false, isAISpeaking = false, onStopRecording }: AudioTranscriberProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [useBrowserAPI, setUseBrowserAPI] = useState(true);
  const [wasRecordingBeforeAI, setWasRecordingBeforeAI] = useState(false);
  const [collectedTranscript, setCollectedTranscript] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldStopRecordingRef = useRef<boolean>(false);

  // Auto-pause recording when AI starts speaking, resume when it stops
  useEffect(() => {
    if (isAISpeaking && isConnected) {
      console.log('[AudioTranscriber] AI started speaking - pausing recording');
      setWasRecordingBeforeAI(true);
      handleStopRecording();
    } else if (!isAISpeaking && wasRecordingBeforeAI && !isConnected) {
      console.log('[AudioTranscriber] AI stopped speaking - resuming recording');
      setWasRecordingBeforeAI(false);
      setTimeout(() => {
        handleStartRecording();
      }, 500); // Small delay to ensure clean transition
    }
  }, [isAISpeaking]);

  // Browser Speech Recognition
  const startBrowserRecognition = () => {
    if (!SpeechRecognition) {
      setError('Browser Speech Recognition not supported. Please use Chrome, Edge, or Safari.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('[Browser STT] Started');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          console.log('[Browser STT] Final:', finalTranscript);
          const timestamp = new Date().toLocaleTimeString();
          addCompleteSentence(finalTranscript, timestamp);
        }

        if (interimTranscript) {
          console.log('[Browser STT] Interim:', interimTranscript);
          setPartialText(interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('[Browser STT] Error:', event.error);
        if (event.error === 'no-speech') {
          // Ignore no-speech errors, they're normal
          return;
        }
        if (event.error === 'aborted') {
          // Recognition was aborted, don't show error
          return;
        }
        setError(`Speech recognition error: ${event.error}`);
        // Don't disconnect on error, will auto-restart
      };

      recognition.onend = () => {
        console.log('[Browser STT] Ended');
        // Auto-restart unless manually stopped
        if (!shouldStopRecordingRef.current && recognitionRef.current) {
          console.log('[Browser STT] Auto-restarting...');
          try {
            setTimeout(() => {
              if (recognitionRef.current && !shouldStopRecordingRef.current) {
                recognitionRef.current.start();
              }
            }, 100);
          } catch (err) {
            console.error('[Browser STT] Failed to restart:', err);
            setIsConnected(false);
            setIsConnecting(false);
          }
        } else {
          setIsConnected(false);
          setIsConnecting(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error('[Browser STT] Failed to start:', err);
      setError(`Failed to start speech recognition: ${err.message}`);
      setIsConnecting(false);
    }
  };

  const stopBrowserRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsConnected(false);
    setPartialText('');
  };

  const connectToServer = () => {
    setIsConnecting(true);
    setError(null);

    try {
      console.log('[AudioTranscriber] Connecting to speech server on ws://localhost:8765...');

      const ws = new WebSocket('ws://localhost:8765');

      ws.onopen = () => {
        console.log('[AudioTranscriber] Connected to speech server');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { text, is_final, timestamp } = data;

          console.log('[AudioTranscriber] Received:', { text, is_final });

          if (is_final) {
            addCompleteSentence(text, timestamp);
          } else {
            setPartialText(text);
          }
        } catch (err) {
          console.error('[AudioTranscriber] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[AudioTranscriber] WebSocket error:', event);
        setError('Connection error. Make sure Python speech server is running.');
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('[AudioTranscriber] Disconnected from speech server');
        setIsConnected(false);
        setIsConnecting(false);

        if (!error) {
          setError('Disconnected from server. Click to reconnect.');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[AudioTranscriber] Connection error:', err);
      setError('Failed to connect. Make sure Python speech server is running on port 8765.');
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setPartialText('');
  };

  const addCompleteSentence = async (text: string, timestamp: string) => {
    if (!text.trim()) return;

    const entry: TranscriptEntry = {
      id: crypto.randomUUID(),
      timestamp,
      text,
      isComplete: true,
    };

    setTranscriptEntries(prev => {
      const updated = [...prev, entry];
      onTranscriptUpdate?.(updated);
      return updated;
    });

    // Collect transcript for later sending
    setCollectedTranscript(prev => prev ? `${prev} ${text}` : text);

    setPartialText('');

    // Only trigger AI response if autoSendToAI is enabled (legacy behavior)
    if (autoSendToAI && onSpeechFinalized) {
      console.log('[AudioTranscriber] Auto-sending to AI:', text.substring(0, 50));
      onSpeechFinalized(text);
    }

    // Send to backend API for transcript storage
    try {
      console.log('[AudioTranscriber] Sending to backend:', { sessionId, timestamp, text: text.substring(0, 50) });
      const response = await axios.post('/api/realtime_audio_chunk', {
        sessionId,
        timestamp,
        text,
        isFinal: true,
      });
      console.log('[AudioTranscriber] Backend response:', response.data);
    } catch (err) {
      console.error('[AudioTranscriber] Failed to send to backend:', err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleStartRecording = () => {
    shouldStopRecordingRef.current = false;
    if (useBrowserAPI || !SpeechRecognition) {
      startBrowserRecognition();
    } else {
      connectToServer();
    }
  };

  const handleStopRecording = () => {
    // Set flag to prevent auto-restart
    shouldStopRecordingRef.current = true;

    // Send collected transcript to parent component
    if (collectedTranscript.trim() && onStopRecording) {
      console.log('[AudioTranscriber] Sending collected transcript on stop:', collectedTranscript.substring(0, 50));
      onStopRecording(collectedTranscript);
    }

    // Clear collected transcript
    setCollectedTranscript('');

    if (useBrowserAPI || recognitionRef.current) {
      stopBrowserRecognition();
    } else {
      disconnect();
    }
  };

  return (
    <div className="audio-transcriber">
      <div className="transcriber-controls">
        <button
          className={`btn ${isConnected ? 'btn-recording' : 'btn-secondary'}`}
          onClick={isConnected ? handleStopRecording : handleStartRecording}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="spinning" size={18} />
              Connecting...
            </>
          ) : isConnected ? (
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
        
        {SpeechRecognition && (
          <label style={{ marginLeft: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <input
              type="checkbox"
              checked={useBrowserAPI}
              onChange={(e) => setUseBrowserAPI(e.target.checked)}
              disabled={isConnected}
            />
            <span>Use Browser API (no server needed)</span>
          </label>
        )}
      </div>

      <div className="transcript-display">
        <h4>Live Transcript</h4>
        {isConnected && transcriptEntries.length === 0 && !partialText && (
          <div style={{ padding: '1rem', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
            🎤 Listening... Speak into your microphone.
          </div>
        )}
        {!isConnected && !isConnecting && (
          <div style={{ padding: '1rem', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
            {useBrowserAPI ? (
              <>⚠️ Not recording. Click "Start Recording" to begin.</>
            ) : (
              <>⚠️ Not connected. Make sure Python speech server is running: <code>python speech_server.py</code></>
            )}
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
