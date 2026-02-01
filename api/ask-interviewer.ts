import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const KEYWORDS_AI_URL = 'https://api.keywordsai.co/api/chat/completions';

// Prompt ID from Keywords AI dashboard
const INTERVIEWER_PROMPT_ID = '1565ee';

interface TelemetryData {
  timestamp: number;
  type: 'hint';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latency: number;
  mode: string;
  success: boolean;
  error?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    const {
      problemTitle,
      problemDescription,
      code,
      hintsUsed,
      mode = 'v1',
      userQuestion = '',
      // New variables for managed prompt
      interviewerPersonality,
      difficultyLevel,
      interviewStyle,
      interviewMode,
      currentQuestion = '',
    } = req.body;

    if (!problemTitle || !problemDescription) {
      return res.status(400).json({ error: 'Missing required fields: problemTitle, problemDescription' });
    }

    const apiKey = process.env.VITE_KEYWORDS_AI_API_KEY;
    if (!apiKey) {
      console.error('CRITICAL: Keywords AI API key not configured');
      return res.status(500).json({
        error: 'Keywords AI API key not configured. Please set VITE_KEYWORDS_AI_API_KEY environment variable.'
      });
    }

    // Map old mode to new variables (for backward compatibility)
    // If new variables aren't provided, derive them from mode
    const personality = interviewerPersonality || (mode === 'v2' ? 'Supportive and encouraging mentor' : 'Professional and rigorous evaluator');
    const difficulty = difficultyLevel || (mode === 'v2' ? 'Medium' : 'Hard');
    const style = interviewStyle || (mode === 'v2' ? 'Collaborative and guiding' : 'Probing and challenging');
    const intMode = interviewMode || (mode === 'v2' ? 'practice' : 'test');

    // Build problem statement
    const problemStatement = `${problemTitle}\n\n${problemDescription}`;

    // Build candidate transcript from user's spoken question or indicate they're working
    const transcript = userQuestion || (hintsUsed > 0
      ? `The candidate has requested ${hintsUsed} hint(s) so far and is working on the problem.`
      : 'The candidate is starting to work on the problem.');

    // Build current question context
    const question = currentQuestion || 'This is the beginning of the interview. Ask the candidate to explain their initial approach.';

    console.log(`[ask-interviewer] Calling Keywords AI managed prompt id=${INTERVIEWER_PROMPT_ID}, mode=${intMode}`);

    const response = await axios.post(
      KEYWORDS_AI_URL,
      {
        prompt: {
          prompt_id: INTERVIEWER_PROMPT_ID,
          variables: {
            interviewer_personality: personality,
            difficulty_level: difficulty,
            interview_style: style,
            interview_mode: intMode,
            problem_statement: problemStatement,
            current_code: code || '# No code written yet',
            candidate_transcript: transcript,
            current_question: question,
          },
          override: true, // Use model/params configured in the prompt
        },
        metadata: {
          session_id: req.body.sessionId || 'unknown',
          problem_title: problemTitle,
          interview_mode: intMode,
          hints_used: hintsUsed,
          endpoint: 'ask-interviewer',
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    const latency = Date.now() - startTime;
    const message = response.data.choices[0]?.message?.content || 'No response from interviewer';
    const promptTokens = response.data.usage?.prompt_tokens || 0;
    const completionTokens = response.data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const modelUsed = response.data.model || 'unknown';

    // Log telemetry
    const telemetry: TelemetryData = {
      timestamp: Date.now(),
      type: 'hint',
      model: modelUsed,
      promptTokens,
      completionTokens,
      totalTokens,
      latency,
      mode: intMode,
      success: true,
    };

    console.log(`[ask-interviewer] Success - Model: ${modelUsed}, Tokens: ${totalTokens}, Latency: ${latency}ms`);

    return res.status(200).json({
      message,
      type: 'hint',
      telemetry,
      // Return the current question for tracking conversation flow
      currentQuestion: message,
    });
  } catch (error: any) {
    const latency = Date.now() - (error.startTime || Date.now());
    console.error('[ask-interviewer] Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      latency,
    });

    const telemetry: TelemetryData = {
      timestamp: Date.now(),
      type: 'hint',
      model: 'unknown',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latency,
      mode: req.body.interviewMode || req.body.mode || 'test',
      success: false,
      error: error.message,
    };

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Keywords AI authentication failed. Check your API key.',
        telemetry,
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Keywords AI request timed out',
        telemetry,
      });
    }

    return res.status(500).json({
      error: error.message || 'Failed to get interviewer response',
      telemetry,
    });
  }
}
