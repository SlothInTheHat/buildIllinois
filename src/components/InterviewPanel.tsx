import { useState } from 'react';
import { Play, HelpCircle, CheckSquare, Loader2, Terminal, BarChart3, Mic, MicOff } from 'lucide-react';
import CodeEditor from './CodeEditor';
import FeedbackPanel from './FeedbackPanel';
import TelemetryPanel from './TelemetryPanel';
import AudioTranscriber from './AudioTranscriber';
import type { Problem, SessionFeedback } from '../types/index';
import type { TelemetryEntry } from '../lib/telemetry';
import axios from 'axios';

interface InterviewPanelProps {
  problem: Problem;
  onProblemChange: (problemId: string) => void;
}

interface SessionTelemetry {
  hints: TelemetryEntry[];
  feedback: TelemetryEntry | null;
  executions: { timestamp: number; latency: number }[];
}


interface InterviewPanelProps {
  problem: Problem;
  onProblemChange: (problemId: string) => void;
}

export default function InterviewPanel({ problem, onProblemChange: _onProblemChange }: InterviewPanelProps) {
  // Generate unique session ID for transcript tracking
  const [sessionId] = useState(() => crypto.randomUUID());

  const [code, setCode] = useState(problem.starterCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isAskingInterviewer, setIsAskingInterviewer] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [interviewerMessage, setInterviewerMessage] = useState<string>('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [executionCount, setExecutionCount] = useState(0);
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [sessionTelemetry, setSessionTelemetry] = useState<SessionTelemetry>({
    hints: [],
    feedback: null,
    executions: [],
  });
  const [mode, setMode] = useState<'v1' | 'v2'>('v1');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTranscript, setRecordingTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || '');
  };

  const speakText = (text: string) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    utterance.volume = 1.0;

    // Try to use a more natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log('[TTS] Started speaking');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log('[TTS] Finished speaking');
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      console.error('[TTS] Error:', event);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Running code...');

    try {
      // Call backend endpoint instead of Piston directly
      const response = await axios.post('/api/run-code', {
        code,
      });

      const result = response.data;
      const output = result.output || '';
      const hasError = !result.success;

      if (!hasError) {
        setOutput(`✓ Success\n\n${output}`);
      } else {
        setOutput(`✗ Error\n\n${result.error || output}`);
      }

      setExecutionCount((prev) => prev + 1);

      // Track execution telemetry
      if (result.telemetry) {
        setSessionTelemetry((prev) => ({
          ...prev,
          executions: [...prev.executions, result.telemetry],
        }));
      }
    } catch (error: any) {
      setOutput(`✗ Execution Error\n\n${error.message || 'Failed to run code'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleAskInterviewer = async () => {
    setIsAskingInterviewer(true);
    setInterviewerMessage('Thinking...');

    try {
      // Debug logging
      console.log('[Frontend] Sending request with:', {
        problemTitle: problem.title,
        problemDescription: problem.description,
        code,
        hintsUsed,
        mode,
      });

      const response = await axios.post('/api/ask-interviewer', {
        problemTitle: problem.title,
        problemDescription: problem.description,
        code,
        hintsUsed,
        mode,
      });

      const message = response.data.message;
      setInterviewerMessage(message);
      setHintsUsed((prev) => prev + 1);

      // Auto-speak the response if enabled
      if (autoSpeak) {
        speakText(message);
      }

      // Track telemetry
      if (response.data.telemetry) {
        setSessionTelemetry((prev) => ({
          ...prev,
          hints: [...prev.hints, response.data.telemetry],
        }));
      }
    } catch (error: any) {
      const errorMessage = 'Failed to get interviewer response. Please try again.';
      setInterviewerMessage(errorMessage);
      console.error('Error:', error.response?.data || error.message);
    } finally {
      setIsAskingInterviewer(false);
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingTranscript('');

    // Connect to WebSocket
    const ws = new WebSocket('ws://localhost:8765');

    ws.onopen = () => {
      console.log('Connected to speech server');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { text, is_final, timestamp } = data;

        // Append to transcript
        setRecordingTranscript((prev) => {
          const prefix = prev ? prev + '\n' : '';
          return prefix + `[${timestamp}] ${text}`;
        });

        console.log(`[${is_final ? 'FINAL' : 'PARTIAL'}] ${text}`);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      alert('Failed to connect to speech server. Make sure speech_server.py is running.');
      setIsRecording(false);
    };

    ws.onclose = () => {
      console.log('Disconnected from speech server');
    };

    setWsConnection(ws);
  };

  const handleStopRecording = () => {
    setIsRecording(false);

    // Stop any ongoing speech
    stopSpeaking();

    // Close WebSocket connection
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }

    // Save transcript to file
    if (recordingTranscript) {
      saveTranscriptToFile(recordingTranscript);
    }
  };

  const saveTranscriptToFile = async (transcript: string) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `transcription_${timestamp}.txt`;

      // Save to backend
      await axios.post('/api/save-transcript', {
        filename,
        transcript,
        problemTitle: problem.title,
      });

      console.log(`📝 Transcript saved: ${filename}`);
    } catch (error: any) {
      console.error('Error saving transcript:', error.message);
    }
  };

  const handleEndSession = async () => {
    setIsEndingSession(true);

    try {
      const response = await axios.post('/api/end-session', {
        problemTitle: problem.title,
        problemDescription: problem.description,
        code,
        hintsUsed,
        executionCount,
      });

      // Extract feedback and telemetry
      const { telemetry, ...feedbackData } = response.data;
      setFeedback(feedbackData);

      if (telemetry) {
        setSessionTelemetry((prev) => ({
          ...prev,
          feedback: telemetry,
        }));
      }

      setShowFeedback(true);
    } catch (error: any) {
      alert('Failed to generate feedback. Please try again.');
      console.error('Error:', error.response?.data || error.message);
    } finally {
      setIsEndingSession(false);
    }
  };

  const handleNewInterview = () => {
    setCode(problem.starterCode);
    setOutput('');
    setInterviewerMessage('');
    setHintsUsed(0);
    setExecutionCount(0);
    setFeedback(null);
    setShowFeedback(false);
    setShowTelemetry(false);
    setSessionTelemetry({
      hints: [],
      feedback: null,
      executions: [],
    });
  };

  if (showTelemetry) {
    return <TelemetryPanel telemetry={sessionTelemetry} onBack={() => setShowTelemetry(false)} />;
  }

  if (showFeedback && feedback) {
    return (
      <FeedbackPanel
        feedback={feedback}
        onNewInterview={handleNewInterview}
        onViewTelemetry={() => setShowTelemetry(true)}
      />
    );
  }

  return (
    <div className="interview-panel">
      <div className="interview-header">
        <div>
          <h1 className="problem-title">{problem.title}</h1>
          <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="session-stats">
          <span className="stat">Hints: {hintsUsed}</span>
          <span className="stat">Runs: {executionCount}</span>
        </div>
      </div>

      <div className="interview-header" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Interviewer Mode:</label>
          <button
            className={`btn ${mode === 'v1' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('v1')}
            style={{ marginRight: '0.5rem' }}
          >
            v1 (Strict)
          </button>
          <button
            className={`btn ${mode === 'v2' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('v2')}
          >
            v2 (Supportive)
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
            />
            <span>🔊 Auto-speak responses</span>
          </label>
        </div>
      </div>

      <div className="problem-description">
        <pre>{problem.description}</pre>
      </div>

      {/* Audio Transcription Section */}
      <div className="audio-section">
        <AudioTranscriber sessionId={sessionId} />
      </div>

      <div className="interview-workspace">
        <div className="editor-section">
          <div className="section-header">
            <h3>Your Solution</h3>
            <div className="editor-actions">
              <button
                className="btn btn-secondary"
                onClick={handleRunCode}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="spinning" size={18} />
                    Running...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Run Code
                  </>
                )}
              </button>
            </div>
          </div>
          <CodeEditor code={code} onChange={handleCodeChange} />
        </div>

        <div className="output-section">
          <div className="section-header">
            <Terminal size={18} />
            <h3>Output</h3>
          </div>
          <div className="output-content">
            <pre>{output || 'Click "Run Code" to see output...'}</pre>
          </div>
        </div>
      </div>

      {interviewerMessage && (
        <div className="interviewer-message">
          <div className="message-header">
            <HelpCircle size={18} />
            <span>Interviewer</span>
            <button
              className="btn btn-secondary"
              style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
              onClick={() => isSpeaking ? stopSpeaking() : speakText(interviewerMessage)}
            >
              {isSpeaking ? '⏸️ Stop' : '🔊 Speak'}
            </button>
          </div>
          <p>{interviewerMessage}</p>
        </div>
      )}

      {/* Audio Recording Section */}
      {isRecording && (
        <div className="recording-section">
          <div className="recording-header">
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              Recording...
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleStopRecording}
            >
              <MicOff size={18} />
              Stop Recording
            </button>
          </div>
          <div className="recording-transcript">
            <h4>Live Transcription:</h4>
            <pre>{recordingTranscript || 'Listening...'}</pre>
          </div>
        </div>
      )}

      <div className="interview-actions">
        {!isRecording && (
          <button
            className="btn btn-secondary"
            onClick={handleStartRecording}
          >
            <Mic size={18} />
            Record Audio
          </button>
        )}

        <button
          className="btn btn-hint"
          onClick={handleAskInterviewer}
          disabled={isAskingInterviewer}
        >
          {isAskingInterviewer ? (
            <>
              <Loader2 className="spinning" size={18} />
              Asking...
            </>
          ) : (
            <>
              <HelpCircle size={18} />
              Ask Interviewer
            </>
          )}
        </button>

        <button
          className="btn btn-primary"
          onClick={handleEndSession}
          disabled={isEndingSession}
        >
          {isEndingSession ? (
            <>
              <Loader2 className="spinning" size={18} />
              Ending...
            </>
          ) : (
            <>
              <CheckSquare size={18} />
              End Interview
            </>
          )}
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => setShowTelemetry(true)}
          disabled={sessionTelemetry.hints.length === 0 && sessionTelemetry.executions.length === 0}
        >
          <BarChart3 size={18} />
          View Telemetry
        </button>
      </div>
    </div>
  );
}
