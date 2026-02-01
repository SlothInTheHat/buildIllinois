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
  const [leftPanelWidth, setLeftPanelWidth] = useState(35); // percentage

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
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', text: string}>>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || '');
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const container = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newWidth = ((e.clientX - container.left) / container.width) * 100;

    if (newWidth > 20 && newWidth < 60) {
      setLeftPanelWidth(newWidth);
    }
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

  const handleUserSpeech = async (spokenText: string) => {
    console.log('[Voice] User said:', spokenText);
    
    // Add to conversation history
    setConversationHistory(prev => [...prev, { role: 'user', text: spokenText }]);

    // Automatically ask the interviewer with the spoken question
    setIsAskingInterviewer(true);
    setInterviewerMessage('Thinking...');

    try {
      console.log('[Voice] Sending to AI:', {
        problemTitle: problem.title,
        userQuestion: spokenText,
        mode,
      });

      const response = await axios.post('/api/ask-interviewer', {
        problemTitle: problem.title,
        problemDescription: problem.description,
        code,
        hintsUsed,
        mode,
        userQuestion: spokenText, // Include what the user asked
      });

      const message = response.data.message;
      setInterviewerMessage(message);
      setHintsUsed((prev) => prev + 1);

      // Add to conversation history
      setConversationHistory(prev => [...prev, { role: 'assistant', text: message }]);

      // Auto-speak the response
      speakText(message);

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
      console.error('[Voice] Error:', error.response?.data || error.message);
    } finally {
      setIsAskingInterviewer(false);
    }
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

      // Auto-speak the response
      speakText(message);

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
        <div className="header-controls">
          <div className="mode-selector">
            <label style={{ fontWeight: 'bold', marginRight: '0.75rem' }}>Mode:</label>
            <button
              className={`btn ${mode === 'v1' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('v1')}
              style={{ marginRight: '0.5rem' }}
            >
              Strict
            </button>
            <button
              className={`btn ${mode === 'v2' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('v2')}
            >
              Supportive
            </button>
          </div>
        </div>
      </div>

      {/* Two-Panel Layout */}
      <div 
        className="resizable-layout"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Left Panel: Problem & Interviewer */}
        <div className="left-panel" style={{ width: `${leftPanelWidth}%` }}>
          <div className="problem-section">
            <h3>Problem</h3>
            <div className="problem-description">
              <pre>{problem.description}</pre>
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
        />

        {/* Right Panel: Code Editor & Output */}
        <div className="right-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
          <div className="code-section">
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
            
            <div className="terminal-output">
              <div className="terminal-header">
                <Terminal size={16} />
                <span>Output</span>
              </div>
              <pre className="terminal-content">{output || 'Click "Run Code" to see output...'}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Audio Section */}
      <div className="audio-interview-section">
        <div className="audio-controls-container">
          {/* Left: Human Transcript */}
          <div className="audio-left-panel">
            <AudioTranscriber 
              sessionId={sessionId} 
              onSpeechFinalized={handleUserSpeech}
              autoSendToAI={true}
            />
          </div>
          
          {/* Right: AI Response */}
          <div className="audio-right-panel">
            <div className="conversation-history">
              <h4 style={{ margin: '0 0 1rem 0', padding: '1rem 1rem 0 1rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>AI Responses</h4>
              <div className="conversation-entries" style={{ flex: 1, overflow: 'auto', padding: '0 1rem 1rem 1rem' }}>
                {conversationHistory.filter(msg => msg.role === 'assistant').length === 0 && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%', 
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                  }}>
                    💬 AI Interview response will appear here
                  </div>
                )}
                {conversationHistory.filter(msg => msg.role === 'assistant').map((msg, idx) => (
                  <div key={idx} className="conversation-entry assistant-entry" style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem' }}>
                      <HelpCircle size={14} />
                      <span>AI Response #{idx + 1}</span>
                      <button
                        className="btn btn-secondary"
                        style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => speakText(msg.text)}
                      >
                        🔊
                      </button>
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>{msg.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="interview-actions">
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
      </div>
    </div>
  );
}
