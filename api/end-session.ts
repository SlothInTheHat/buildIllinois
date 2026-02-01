import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const KEYWORDS_AI_URL = 'https://api.keywordsai.co/api/chat/completions';

// Prompt ID from Keywords AI dashboard
const FEEDBACK_PROMPT_ID = 'c20b03';

interface TelemetryData {
  timestamp: number;
  type: 'feedback';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latency: number;
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
      executionCount,
      mode = 'v1',
      // New variables for managed prompt
      feedbackStyle,
      scoringStrictness,
      interviewMode,
      pastConversation = 'No conversation recorded.',
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
    const feedback = feedbackStyle || (mode === 'v2' ? 'actionable' : 'detailed');
    const strictness = scoringStrictness || (mode === 'v2' ? 'lenient' : 'standard');
    const intMode = interviewMode || (mode === 'v2' ? 'practice' : 'test');

    // Build problem statement
    const problemStatement = `${problemTitle}\n\n${problemDescription}`;

    console.log(`[end-session] Calling Keywords AI managed prompt id=${FEEDBACK_PROMPT_ID}, mode=${intMode}`);

    const response = await axios.post(
      KEYWORDS_AI_URL,
      {
        prompt: {
          prompt_id: FEEDBACK_PROMPT_ID,
          variables: {
            feedback_style: feedback,
            scoring_strictness: strictness,
            interview_mode: intMode,
            problem_statement: problemStatement,
            final_code: code || '# No code written',
            hints_used: String(hintsUsed || 0),
            execution_count: String(executionCount || 0),
            past_conversation: pastConversation,
          },
          override: true,
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
    const feedbackText = response.data.choices[0]?.message?.content || '{}';
    const promptTokens = response.data.usage?.prompt_tokens || 0;
    const completionTokens = response.data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const modelUsed = response.data.model || 'unknown';

    // Parse the JSON response
    let feedbackData;
    try {
      // Strip markdown code fences if present
      let jsonString = feedbackText.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '');
        jsonString = jsonString.replace(/\n?```\s*$/, '');
      }
      feedbackData = JSON.parse(jsonString);
    } catch (e) {
      console.error('[end-session] Failed to parse feedback JSON:', feedbackText);
      feedbackData = {
        strengths: ['Code execution successful'],
        weaknesses: ['Unable to parse feedback'],
        suggestedTopics: ['Try again'],
        overallScore: 5,
        detailedFeedback: 'Session completed but feedback generation encountered an issue.',
      };
    }

    // Log telemetry
    const telemetry: TelemetryData = {
      timestamp: Date.now(),
      type: 'feedback',
      model: modelUsed,
      promptTokens,
      completionTokens,
      totalTokens,
      latency,
      success: true,
    };

    console.log(`[end-session] Success - Model: ${modelUsed}, Tokens: ${totalTokens}, Latency: ${latency}ms`);

    return res.status(200).json({
      ...feedbackData,
      telemetry,
    });
  } catch (error: any) {
    const latency = Date.now() - (error.startTime || Date.now());
    console.error('[end-session] Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      latency,
    });

    const telemetry: TelemetryData = {
      timestamp: Date.now(),
      type: 'feedback',
      model: 'unknown',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latency,
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

    // Return fallback feedback on error but include telemetry
    return res.status(200).json({
      strengths: ['Attempted the problem', 'Used proper Python syntax'],
      weaknesses: ['Could not complete full evaluation - Keywords AI service temporarily unavailable'],
      suggestedTopics: ['Data Structures', 'Algorithms', 'Time Complexity'],
      overallScore: 5,
      detailedFeedback: 'Session completed. Keep practicing coding problems to improve your skills.',
      telemetry,
    });
  }
}
