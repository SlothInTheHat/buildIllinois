import { useState } from 'react';
import { Play, HelpCircle, CheckSquare, Loader2, Terminal, BarChart3 } from 'lucide-react';
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

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || '');
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

      setInterviewerMessage(response.data.message);
      setHintsUsed((prev) => prev + 1);

      // Track telemetry
      if (response.data.telemetry) {
        setSessionTelemetry((prev) => ({
          ...prev,
          hints: [...prev.hints, response.data.telemetry],
        }));
      }
    } catch (error: any) {
      setInterviewerMessage('Failed to get interviewer response. Please try again.');
      console.error('Error:', error.response?.data || error.message);
    } finally {
      setIsAskingInterviewer(false);
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

      <div className="interview-header" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
          </div>
          <p>{interviewerMessage}</p>
        </div>
      )}

      <div className="interview-actions">
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
