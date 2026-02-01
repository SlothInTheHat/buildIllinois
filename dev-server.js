// Simple Express server for local development
// Mocks the Vercel API endpoints

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config(); // Loads from .env by default

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Transcripts directory setup
const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');

// Create transcripts directory on startup (synchronous to avoid top-level await)
if (!fssync.existsSync(TRANSCRIPTS_DIR)) {
  fssync.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}
console.log(`📁 Transcripts directory ready at: ${TRANSCRIPTS_DIR}`);

// Using Keywords AI (OpenAI-compatible API)
const KEYWORDS_AI_API_URL = 'https://api.keywordsai.co/api/chat/completions';

// Prompt IDs from Keywords AI dashboard
const INTERVIEWER_PROMPT_ID = '1565ee';
const FEEDBACK_PROMPT_ID = 'c20b03';

// POST /api/run-code
app.post('/api/run-code', async (req, res) => {
  try {
    const startTime = Date.now();
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    console.log('[run-code] Executing code via Piston API');

    const response = await axios.post(
      'https://emkc.org/api/v2/piston/execute',
      {
        language: 'python',
        version: '3.10.0',
        files: [{ content: code }],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      },
      { timeout: 15000 }
    );

    const latency = Date.now() - startTime;
    const result = response.data;
    const output = result.run.stdout || result.run.stderr || result.run.output;
    const hasError = result.run.code !== 0;

    const executionResult = {
      success: !hasError,
      output: output.trim(),
      error: hasError ? result.run.stderr || 'Execution failed' : undefined,
      executionTime: latency,
      telemetry: {
        timestamp: Date.now(),
        latency,
        service: 'piston',
      },
    };

    console.log(`[run-code] Success - Latency: ${latency}ms`);
    return res.status(200).json(executionResult);
  } catch (error) {
    console.error('[run-code] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to run code',
    });
  }
});

// POST /api/ask-interviewer
app.post('/api/ask-interviewer', async (req, res) => {
  try {
    const startTime = Date.now();

    // Debug logging
    console.log('[ask-interviewer] Received request body:', JSON.stringify(req.body, null, 2));

    const {
      problemTitle,
      problemDescription,
      code = '',
      hintsUsed = 0,
      mode = 'v1',
      userQuestion = '',
      // New variables for managed prompt
      interviewerPersonality,
      difficultyLevel,
      interviewStyle,
      interviewMode,
      currentQuestion = '',
    } = req.body;

    // Only validate that problemTitle and problemDescription exist
    if (!problemTitle || !problemDescription) {
      console.log('[ask-interviewer] Validation failed:', {
        hasProblemTitle: !!problemTitle,
        hasProblemDescription: !!problemDescription,
      });
      return res.status(400).json({
        error: 'Missing required fields: problemTitle, problemDescription',
      });
    }

    const apiKey = process.env.VITE_KEYWORDS_AI_API_KEY;
    if (!apiKey) {
      console.error('[ask-interviewer] CRITICAL: Keywords AI API key not configured');
      return res.status(500).json({
        error: 'Keywords AI API key not configured. Set VITE_KEYWORDS_AI_API_KEY in .env',
      });
    }

    // Map old mode to new variables (for backward compatibility)
    const personality = interviewerPersonality || (mode === 'v2' ? 'Supportive and encouraging mentor' : 'Professional and rigorous evaluator');
    const difficulty = difficultyLevel || (mode === 'v2' ? 'Medium' : 'Hard');
    const style = interviewStyle || (mode === 'v2' ? 'Collaborative and guiding' : 'Probing and challenging');
    const intMode = interviewMode || (mode === 'v2' ? 'practice' : 'test');

    // Build problem statement
    const problemStatement = `${problemTitle}\n\n${problemDescription}`;

    // Build candidate transcript from user's spoken question
    const transcript = userQuestion || (hintsUsed > 0
      ? `The candidate has requested ${hintsUsed} hint(s) so far and is working on the problem.`
      : 'The candidate is starting to work on the problem.');

    // Build current question context
    const question = currentQuestion || 'This is the beginning of the interview. Ask the candidate to explain their initial approach.';

    console.log(`[ask-interviewer] Calling Keywords AI managed prompt id=${INTERVIEWER_PROMPT_ID}, mode=${intMode}`);
    if (userQuestion) {
      console.log(`[ask-interviewer] User question: "${userQuestion.substring(0, 100)}..."`);
    }

    let response;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        response = await axios.post(
          KEYWORDS_AI_API_URL,
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
              override: true,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            timeout: 30000,
          }
        );
        break; // Success, exit retry loop
      } catch (error) {
        if (error.response?.status === 429 && retries < maxRetries - 1) {
          const waitTime = Math.pow(2, retries) * 1000;
          console.log(`[ask-interviewer] Rate limited (429), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw error;
        }
      }
    }

    const latency = Date.now() - startTime;
    const message = response.data.choices[0]?.message?.content || 'No response from interviewer';
    const promptTokens = response.data.usage?.prompt_tokens || 0;
    const completionTokens = response.data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const modelUsed = response.data.model || 'unknown';

    const telemetry = {
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
      currentQuestion: message,
    });
  } catch (error) {
    console.error('[ask-interviewer] Error:', error.message);
    console.error('[ask-interviewer] Error details:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers
    });

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Keywords AI authentication failed. Check your API key.',
      });
    }

    return res.status(500).json({
      error: error.response?.data?.error || error.message || 'Failed to get interviewer response',
      details: error.response?.data
    });
  }
});

// POST /api/end-session
app.post('/api/end-session', async (req, res) => {
  try {
    const startTime = Date.now();

    // Debug logging
    console.log('[end-session] Received request body:', JSON.stringify(req.body, null, 2));

    const {
      problemTitle,
      problemDescription,
      code = '',
      hintsUsed,
      executionCount,
      mode = 'v1',
      // New variables for managed prompt
      feedbackStyle,
      scoringStrictness,
      interviewMode,
    } = req.body;

    // Only validate that problemTitle and problemDescription exist
    if (!problemTitle || !problemDescription) {
      console.log('[end-session] Validation failed:', {
        hasProblemTitle: !!problemTitle,
        hasProblemDescription: !!problemDescription,
      });
      return res.status(400).json({
        error: 'Missing required fields: problemTitle, problemDescription',
      });
    }

    const apiKey = process.env.VITE_KEYWORDS_AI_API_KEY;
    if (!apiKey) {
      console.error('[end-session] CRITICAL: Keywords AI API key not configured');
      return res.status(500).json({
        error: 'Keywords AI API key not configured. Set VITE_KEYWORDS_AI_API_KEY in .env',
      });
    }

    // Map old mode to new variables (for backward compatibility)
    const feedback = feedbackStyle || (mode === 'v2' ? 'actionable' : 'detailed');
    const strictness = scoringStrictness || (mode === 'v2' ? 'lenient' : 'standard');
    const intMode = interviewMode || (mode === 'v2' ? 'practice' : 'test');

    // Build problem statement
    const problemStatement = `${problemTitle}\n\n${problemDescription}`;

    console.log(`[end-session] Calling Keywords AI managed prompt id=${FEEDBACK_PROMPT_ID}, mode=${intMode}`);

    let response;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        response = await axios.post(
          KEYWORDS_AI_API_URL,
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
              },
              override: true,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            timeout: 30000,
          }
        );
        break; // Success, exit retry loop
      } catch (error) {
        if (error.response?.status === 429 && retries < maxRetries - 1) {
          const waitTime = Math.pow(2, retries) * 1000;
          console.log(`[end-session] Rate limited (429), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw error;
        }
      }
    }

    const latency = Date.now() - startTime;
    const responseContent = response.data.choices[0]?.message?.content || '{}';
    const promptTokens = response.data.usage?.prompt_tokens || 0;
    const completionTokens = response.data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const modelUsed = response.data.model || 'unknown';

    let feedbackData;
    try {
      // Strip markdown code fences if present
      let jsonString = responseContent.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '');
        jsonString = jsonString.replace(/\n?```\s*$/, '');
      }
      feedbackData = JSON.parse(jsonString);
    } catch (e) {
      console.error('[end-session] Failed to parse feedback JSON:', responseContent);
      feedbackData = {
        strengths: ['Code execution successful'],
        weaknesses: ['Unable to parse feedback'],
        suggestedTopics: ['Try again'],
        overallScore: 5,
        detailedFeedback: 'Session completed but feedback generation encountered an issue.',
      };
    }

    const telemetry = {
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
  } catch (error) {
    console.error('[end-session] Error:', error.message);
    console.error('[end-session] Error details:', {
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Keywords AI authentication failed. Check your API key.',
      });
    }

    return res.status(500).json({
      error: error.message || 'Failed to generate feedback',
    });
  }
});

// POST /api/realtime_audio_chunk - Save audio transcription to file
app.post('/api/realtime_audio_chunk', async (req, res) => {
  try {
    const startTime = Date.now();
    const { sessionId, timestamp, text, confidence, isFinal } = req.body;

    console.log('[realtime_audio_chunk] Received:', { sessionId, timestamp, text: text?.substring(0, 50), isFinal });

    // Validate required fields
    if (!sessionId || !text) {
      return res.status(400).json({
        error: 'sessionId and text are required'
      });
    }

    // Only write complete sentences to file
    if (!isFinal) {
      return res.status(200).json({
        success: true,
        message: 'Partial transcript received but not written to file'
      });
    }

    // Create transcript filename: transcript_[sessionId].txt
    const filename = `transcript_${sessionId}.txt`;
    const filepath = path.join(TRANSCRIPTS_DIR, filename);

    // Format: [HH:MM:SS] sentence text
    const line = `[${timestamp}] ${text}\n`;

    // Append to file (create if doesn't exist)
    await fs.appendFile(filepath, line, 'utf8');

    // Get line number by counting lines in file
    const content = await fs.readFile(filepath, 'utf8');
    const lineNumber = content.split('\n').filter(l => l.trim()).length;

    const latency = Date.now() - startTime;

    console.log(`[realtime_audio_chunk] ✓ Written to ${filename}:${lineNumber} - "${text.substring(0, 50)}..."`);

    return res.status(200).json({
      success: true,
      transcriptPath: `transcripts/${filename}`,
      lineNumber,
      telemetry: {
        timestamp: Date.now(),
        latency,
      },
    });
  } catch (error) {
    console.error('[realtime_audio_chunk] Error:', error.message);
    return res.status(500).json({
      error: error.message || 'Failed to write transcript',
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `\n🚀 Dev server running on http://localhost:${PORT}`
  );
  console.log(`📝 API endpoints ready:
    POST /api/run-code
    POST /api/ask-interviewer
    POST /api/end-session
    POST /api/realtime_audio_chunk\n`
  );
});
