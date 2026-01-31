import { useState, useEffect } from 'react';
import InterviewPanel from './components/InterviewPanel';
import { loadProblems, getDefaultProblem } from './data/problems';
import type { Problem } from './types/index';
import { Brain } from 'lucide-react';
import './App.css';

function App() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load problems from Supabase on mount
  useEffect(() => {
    const fetchProblems = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching problems from Supabase...');
        const data = await loadProblems();
        console.log('Received problems:', data.length);
        console.log('Problem data:', data);
        setProblems(data);
        if (data.length > 0) {
          console.log('Setting current problem to:', data[0]);
          setCurrentProblem(data[0]);
        } else {
          console.warn('No problems loaded, using default');
          const defaultProblem = getDefaultProblem();
          console.log('Default problem:', defaultProblem);
          setCurrentProblem(defaultProblem);
        }
      } catch (err) {
        console.error('Failed to fetch problems:', err);
        setError('Failed to load problems. Using fallback.');
        const fallback = getDefaultProblem();
        console.log('Using fallback problem:', fallback);
        setProblems([fallback]);
        setCurrentProblem(fallback);
      } finally {
        setLoading(false);
      }
    };

    fetchProblems();
  }, []);

  const handleProblemChange = (problemId: string) => {
    const problem = problems.find((p) => p.id === problemId);
    if (problem) {
      setCurrentProblem(problem);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="logo">
            <Brain size={32} />
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
          <Brain size={32} />
          <h1>AI Interview Coach</h1>
        </div>
        <div className="problem-selector">
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
