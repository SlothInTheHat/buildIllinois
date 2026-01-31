import { useState, useEffect } from 'react';
import { Brain, Filter, Building2, Tag, Trophy } from 'lucide-react';
import '../styles/LandingPage.css';

interface LandingPageProps {
  onStartInterview: (filters: ProblemFilters) => void;
}

export interface ProblemFilters {
  difficulty: string;
  topics: string[];
  companies: string[];
}

// Common companies and topics - will be populated from database
const POPULAR_COMPANIES = [
  'Amazon', 'Google', 'Microsoft', 'Facebook', 'Apple',
  'Bloomberg', 'Adobe', 'Oracle', 'Uber', 'Tesla'
];

const POPULAR_TOPICS = [
  'Array', 'Hash Table', 'String', 'Dynamic Programming',
  'Math', 'Sorting', 'Greedy', 'Tree', 'Binary Search',
  'Graph', 'Two Pointers', 'Stack', 'Heap', 'Linked List'
];

export default function LandingPage({ onStartInterview }: LandingPageProps) {
  const [difficulty, setDifficulty] = useState<string>('all');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const toggleCompany = (company: string) => {
    setSelectedCompanies(prev =>
      prev.includes(company)
        ? prev.filter(c => c !== company)
        : [...prev, company]
    );
  };

  const handleStartInterview = () => {
    onStartInterview({
      difficulty,
      topics: selectedTopics,
      companies: selectedCompanies,
    });
  };

  return (
    <div className="landing-page">
      <div className="landing-header">
        <Brain size={48} className="landing-icon" />
        <h1>AI Interview Coach</h1>
        <p className="landing-subtitle">
          Practice coding interviews with AI guidance. Select your preferences below.
        </p>
      </div>

      <div className="filters-container">
        {/* Difficulty Filter */}
        <div className="filter-section">
          <div className="filter-header">
            <Trophy size={20} />
            <h3>Difficulty Level</h3>
          </div>
          <div className="difficulty-buttons">
            <button
              className={`difficulty-btn ${difficulty === 'all' ? 'active' : ''}`}
              onClick={() => setDifficulty('all')}
            >
              All Levels
            </button>
            <button
              className={`difficulty-btn easy ${difficulty === 'Easy' ? 'active' : ''}`}
              onClick={() => setDifficulty('Easy')}
            >
              Easy
            </button>
            <button
              className={`difficulty-btn medium ${difficulty === 'Medium' ? 'active' : ''}`}
              onClick={() => setDifficulty('Medium')}
            >
              Medium
            </button>
            <button
              className={`difficulty-btn hard ${difficulty === 'Hard' ? 'active' : ''}`}
              onClick={() => setDifficulty('Hard')}
            >
              Hard
            </button>
          </div>
        </div>

        {/* Topics Filter */}
        <div className="filter-section">
          <div className="filter-header">
            <Tag size={20} />
            <h3>Topics (Optional)</h3>
          </div>
          <div className="tag-container">
            {POPULAR_TOPICS.map(topic => (
              <button
                key={topic}
                className={`tag ${selectedTopics.includes(topic) ? 'active' : ''}`}
                onClick={() => toggleTopic(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Companies Filter */}
        <div className="filter-section">
          <div className="filter-header">
            <Building2 size={20} />
            <h3>Companies (Optional)</h3>
          </div>
          <div className="tag-container">
            {POPULAR_COMPANIES.map(company => (
              <button
                key={company}
                className={`tag ${selectedCompanies.includes(company) ? 'active' : ''}`}
                onClick={() => toggleCompany(company)}
              >
                {company}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-actions">
        <button className="btn btn-primary btn-large" onClick={handleStartInterview}>
          <Filter size={20} />
          Start Interview
        </button>
        {(selectedTopics.length > 0 || selectedCompanies.length > 0 || difficulty !== 'all') && (
          <p className="filter-summary">
            Filtering: {difficulty !== 'all' && `${difficulty} difficulty`}
            {selectedTopics.length > 0 && ` • ${selectedTopics.length} topic${selectedTopics.length > 1 ? 's' : ''}`}
            {selectedCompanies.length > 0 && ` • ${selectedCompanies.length} compan${selectedCompanies.length > 1 ? 'ies' : 'y'}`}
          </p>
        )}
      </div>

      <footer className="landing-footer">
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
