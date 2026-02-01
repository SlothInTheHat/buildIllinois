import { useState } from 'react';
import LandingPage, { type ProblemFilters } from './components/LandingPage';
import InterviewPanel from './components/InterviewPanel';
import { loadProblems, getDefaultProblem } from './data/problems';
import type { Problem } from './types/index';
import { Users, Home, Settings, Sliders } from 'lucide-react';
import './App.css';

// Interview settings type for prompt customization
export interface InterviewSettings {
  // Interviewer prompt variables
  interviewerPersonality: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  interviewStyle: string;
  // Feedback prompt variables
  feedbackStyle: 'detailed' | 'brief' | 'actionable';
  scoringStrictness: 'lenient' | 'standard' | 'strict';
}

// Default settings for each mode
const practiceDefaults: InterviewSettings = {
  interviewerPersonality: 'Supportive and encouraging mentor',
  difficultyLevel: 'Medium',
  interviewStyle: 'Collaborative and guiding',
  feedbackStyle: 'actionable',
  scoringStrictness: 'lenient',
};

const testDefaults: InterviewSettings = {
  interviewerPersonality: 'Professional and rigorous evaluator',
  difficultyLevel: 'Hard',
  interviewStyle: 'Probing and challenging',
  feedbackStyle: 'detailed',
  scoringStrictness: 'standard',
};

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'practice' | 'test'>('practice');
  const [interviewSettings, setInterviewSettings] = useState<InterviewSettings>(practiceDefaults);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showInterviewSettings, setShowInterviewSettings] = useState(false);

  // Update settings when mode changes
  const handleModeChange = (newMode: 'practice' | 'test') => {
    setMode(newMode);
    setInterviewSettings(newMode === 'practice' ? practiceDefaults : testDefaults);
  };

  const handleStartInterview = async (filters: ProblemFilters) => {
    setLoading(true);
    setError(null);
    setShowLanding(false);

    try {
      console.log('Fetching problems with filters:', filters);
      const data = await loadProblems(filters);
      console.log('Received problems:', data.length);
      setProblems(data);
      if (data.length > 0) {
        setCurrentProblem(data[0]);
      } else {
        console.warn('No problems loaded, using default');
        const defaultProblem = getDefaultProblem();
        setCurrentProblem(defaultProblem);
        setProblems([defaultProblem]);
      }
    } catch (err) {
      console.error('Failed to fetch problems:', err);
      setError('Failed to load problems. Using fallback.');
      const fallback = getDefaultProblem();
      setProblems([fallback]);
      setCurrentProblem(fallback);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLanding = () => {
    setShowLanding(true);
    setProblems([]);
    setCurrentProblem(null);
  };

  const handleProblemChange = (problemId: string) => {
    const problem = problems.find((p) => p.id === problemId);
    if (problem) {
      setCurrentProblem(problem);
    }
  };

  if (showLanding) {
    return <LandingPage onStartInterview={handleStartInterview} />;
  }

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="logo">
            <Users size={32} />
            <h1>AI Interview Coach</h1>
          </div>
        </header>
        <main className="app-main" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading problems...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <Users size={32} />
          <h1>AI Interview Coach</h1>
        </div>
        <div className="header-controls">
          <button className="btn-back" onClick={handleBackToLanding} title="Back to filters">
            <Home size={18} />
          </button>
          <div className="mode-selector">
            <label style={{ fontWeight: 'bold', marginRight: '0.75rem' }}>Mode:</label>
            <button
              className={`btn ${mode === 'practice' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleModeChange('practice')}
              style={{ marginRight: '0.5rem' }}
            >
              Practice
            </button>
            <button
              className={`btn ${mode === 'test' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleModeChange('test')}
            >
              Test
            </button>
          </div>
          <button
            className={`btn ${showInterviewSettings ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowInterviewSettings(!showInterviewSettings)}
            title="Interview Settings"
            style={{ marginLeft: '0.5rem' }}
          >
            <Sliders size={18} />
          </button>
          <button
            className={`btn ${showVoiceSettings ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            title="Voice Settings"
            style={{ marginLeft: '0.5rem' }}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="app-main">
        {currentProblem && (
          <InterviewPanel
            problem={currentProblem}
            onProblemChange={handleProblemChange}
            mode={mode}
            interviewSettings={interviewSettings}
            setInterviewSettings={setInterviewSettings}
            showVoiceSettings={showVoiceSettings}
            setShowVoiceSettings={setShowVoiceSettings}
            showInterviewSettings={showInterviewSettings}
            setShowInterviewSettings={setShowInterviewSettings}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          Powered by{' '}
          <a href="https://keywordsai.co" target="_blank" rel="noopener noreferrer">
            Keywords AI
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
