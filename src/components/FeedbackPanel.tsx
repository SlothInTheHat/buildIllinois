import { useState, useEffect } from 'react';
import type { SessionFeedback } from '../types/index';
import { CheckCircle2, XCircle, Lightbulb, TrendingUp, Volume2, Square, Settings, BarChart3 } from 'lucide-react';

interface FeedbackPanelProps {
  feedback: SessionFeedback;
  onNewInterview: () => void;
  onViewTelemetry?: () => void;
}

// Get Google voices (prefer female, English)
const getGoogleVoices = () => {
  const voices = window.speechSynthesis.getVoices();
  return voices.filter((voice) =>
    voice.lang.startsWith('en') && voice.name.includes('Google')
  );
};

// Get the best Google voice
const getBestGoogleVoice = (): SpeechSynthesisVoice | null => {
  const googleVoices = getGoogleVoices();
  if (googleVoices.length === 0) return null;

  // Prefer female voices
  const femaleVoice = googleVoices.find((voice) =>
    voice.name.toLowerCase().includes('female')
  );

  return femaleVoice || googleVoices[0];
};

// Split text into sentences for better pacing
const splitIntoSentences = (text: string): string[] => {
  return text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) || [text];
};

interface VoiceSettings {
  rate: number;
  pitch: number;
  selectedVoice: SpeechSynthesisVoice | null;
}

export default function FeedbackPanel({ feedback, onNewInterview, onViewTelemetry }: FeedbackPanelProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    rate: 1.0,
    pitch: 1.1,
    selectedVoice: null,
  });

  // Load Google voices
  useEffect(() => {
    const loadVoices = () => {
      const googleVoices = getGoogleVoices();
      setAvailableVoices(googleVoices);

      if (!voiceSettings.selectedVoice && googleVoices.length > 0) {
        const bestVoice = getBestGoogleVoice();
        setVoiceSettings((prev) => ({
          ...prev,
          selectedVoice: bestVoice,
        }));
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const handleSpeakFeedback = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    playGoogleVoice(feedback.detailedFeedback);
  };

  /**
   * Play audio using Web Speech API with Google voices
   */
  const playGoogleVoice = (text: string) => {
    const sentences = splitIntoSentences(text);
    let sentenceIndex = 0;

    const speakNextSentence = () => {
      if (sentenceIndex >= sentences.length) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sentences[sentenceIndex]);
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      if (voiceSettings.selectedVoice) {
        utterance.voice = voiceSettings.selectedVoice;
      }

      utterance.onend = () => {
        sentenceIndex++;
        setTimeout(speakNextSentence, 300);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextSentence();
  };

  return (
    <div className="feedback-panel">
      <h2 className="feedback-title">Interview Complete!</h2>

      <div className="overall-score">
        <div className="score-circle">
          <span className="score-number">{feedback.overallScore}</span>
          <span className="score-label">/10</span>
        </div>
      </div>

      {/* Rubric Scores - Color coded by performance */}
      {feedback.rubricScores && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {Object.entries(feedback.rubricScores).map(([key, value]) => {
            const getColor = (score: number) => {
              if (score >= 7) return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#10b981' }; // green
              if (score >= 4) return { bg: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', text: '#fbbf24' }; // yellow
              return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444' }; // red
            };
            
            const colors = getColor(value);
            const label = key === 'beforeCoding' ? 'Before Coding' : 
                         key === 'duringCoding' ? 'During Coding' : 
                         'After Coding';
            
            return (
              <div key={key} style={{
                background: colors.bg,
                border: `2px solid ${colors.border}`,
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {label}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: colors.text }}>
                  {value}/10
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Voice Settings Panel */}
      {showSettings && (
        <div
          style={{
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Voice Settings</h4>

          {/* Google Voice Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Select Voice:
            </label>
            <select
              value={availableVoices.indexOf(voiceSettings.selectedVoice || (getBestGoogleVoice() as SpeechSynthesisVoice))}
              onChange={(e) => {
                const voice = availableVoices[parseInt(e.target.value)];
                setVoiceSettings((prev) => ({ ...prev, selectedVoice: voice }));
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
              }}
            >
              {availableVoices.map((voice, idx) => (
                <option key={idx} value={idx}>
                  {voice.name}
                </option>
              ))}
            </select>
            {availableVoices.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                No Google voices available. Using default system voice.
              </p>
            )}
          </div>

          {/* Speech Rate Slider */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Speed:</label>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>{voiceSettings.rate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={voiceSettings.rate}
              onChange={(e) => {
                setVoiceSettings((prev) => ({
                  ...prev,
                  rate: parseFloat(e.target.value),
                }));
              }}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>0.5x (slow) — 2.0x (fast)</div>
          </div>

          {/* Pitch Slider */}
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Pitch:</label>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>{voiceSettings.pitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={voiceSettings.pitch}
              onChange={(e) => {
                setVoiceSettings((prev) => ({
                  ...prev,
                  pitch: parseFloat(e.target.value),
                }));
              }}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>0.5 (low) — 2.0 (high)</div>
          </div>
        </div>
      )}

      <div className="detailed-feedback">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <p style={{ margin: 0, flex: 1 }}>{feedback.detailedFeedback}</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexDirection: 'column', alignItems: 'center' }}>
            <button
              className="btn btn-icon"
              onClick={handleSpeakFeedback}
              title={isSpeaking ? 'Stop listening' : 'Hear feedback'}
              style={{
                padding: '0.5rem',
                minWidth: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #ddd',
                background: isSpeaking ? '#ff6b6b' : '#f8f9fa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSpeaking) {
                  e.currentTarget.style.background = '#e9ecef';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSpeaking) {
                  e.currentTarget.style.background = '#f8f9fa';
                }
              }}
            >
              {isSpeaking ? (
                <Square size={18} style={{ color: '#fff', fill: '#fff' }} />
              ) : (
                <Volume2 size={18} style={{ color: '#495057' }} />
              )}
            </button>

            {/* Speaking Status Indicator */}
            {isSpeaking && (
              <div
                style={{
                  fontSize: '0.65rem',
                  padding: '0.2rem 0.4rem',
                  background: '#d3f9d8',
                  color: '#2f5233',
                  borderRadius: '0.3rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Speaking...
              </div>
            )}

            <button
              className="btn btn-icon"
              onClick={() => setShowSettings(!showSettings)}
              title="Voice settings"
              style={{
                padding: '0.5rem',
                minWidth: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #ddd',
                background: showSettings ? '#4c6ef5' : '#f8f9fa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!showSettings) {
                  e.currentTarget.style.background = '#e9ecef';
                }
              }}
              onMouseLeave={(e) => {
                if (!showSettings) {
                  e.currentTarget.style.background = '#f8f9fa';
                }
              }}
            >
              <Settings size={18} style={{ color: showSettings ? '#fff' : '#495057' }} />
            </button>
          </div>
        </div>
      </div>

      <div className="feedback-section">
        <div className="section-header">
          <CheckCircle2 className="icon success" size={20} />
          <h3>Strengths</h3>
        </div>
        <ul className="feedback-list">
          {feedback.strengths.map((strength, idx) => (
            <li key={idx}>{strength}</li>
          ))}
        </ul>
      </div>

      <div className="feedback-section">
        <div className="section-header">
          <XCircle className="icon warning" size={20} />
          <h3>Areas for Improvement</h3>
        </div>
        <ul className="feedback-list">
          {feedback.weaknesses.map((weakness, idx) => (
            <li key={idx}>{weakness}</li>
          ))}
        </ul>
      </div>

      <div className="feedback-section">
        <div className="section-header">
          <Lightbulb className="icon info" size={20} />
          <h3>Suggested Practice Topics</h3>
        </div>
        <ul className="feedback-list">
          {feedback.suggestedTopics.map((topic, idx) => (
            <li key={idx}>{topic}</li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={onNewInterview}>
          <TrendingUp size={18} />
          Start New Interview
        </button>

        {onViewTelemetry && (
          <button className="btn btn-secondary" onClick={onViewTelemetry}>
            <BarChart3 size={18} />
            View Telemetry
          </button>
        )}
      </div>
    </div>
  );
}
