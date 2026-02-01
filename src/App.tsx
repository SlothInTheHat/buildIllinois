import { useState } from 'react';
import LandingPage, { type ProblemFilters } from './components/LandingPage';
import InterviewPanel from './components/InterviewPanel';
import { loadProblems, getDefaultProblem } from './data/problems';
import type { Problem } from './types/index';
import { Users, Home } from 'lucide-react';
import './App.css';

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="problem-selector">
          <button className="btn-back" onClick={handleBackToLanding} title="Back to filters">
            <Home size={18} />
          </button>
          <label htmlFor="problem-select">Problem:</label>
          {error && <span style={{ color: '#ff6b6b', marginRight: '0.5rem' }}>⚠ {error}</span>}
          <select
            id="problem-select"
            value={currentProblem?.id || ''}
            onChange={(e) => handleProblemChange(e.target.value)}
          >
            {problems.map((problem) => (
              <option key={problem.id} value={problem.id}>
                {problem.title} ({problem.difficulty})
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="app-main">
        {currentProblem && (
          <InterviewPanel problem={currentProblem} onProblemChange={handleProblemChange} />
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
