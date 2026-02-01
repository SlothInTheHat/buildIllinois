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

// Helper: Get interviewer prompt V1 (strict)
const getInterviewerPromptV1 = (problemTitle, problemDescription, currentCode, hintsUsed, userQuestion = null) => {
  const questionContext = userQuestion ? `\n\nCANDIDATE'S QUESTION:\n"${userQuestion}"\n` : '';
  
  return `You are a strict technical interviewer at a top tech company conducting a coding interview.

PROBLEM:
${problemTitle}
${problemDescription}

CANDIDATE'S CURRENT CODE:
\`\`\`python
${currentCode}
\`\`\`${questionContext}

CONTEXT:
- This is hint request #${hintsUsed + 1}
- You should NOT give away the solution
- Ask probing questions about their approach
- Point out potential issues without fixing them
- Focus on time/space complexity, edge cases, and correctness
${userQuestion ? '- Respond to their specific question while maintaining interview standards' : ''}

YOUR RESPONSE SHOULD:
1. Be brief (2-3 sentences max)
2. Either ask a clarifying question about their approach OR give a subtle hint
3. Sound like a real interviewer (professional but slightly challenging)
4. NOT provide code snippets
5. Encourage them to think through the problem
${userQuestion ? '6. Address their question directly but don\'t give away the answer' : ''}

Respond as the interviewer now:`;
};

// Helper: Get interviewer prompt V2 (supportive)
const getInterviewerPromptV2 = (problemTitle, problemDescription, currentCode, hintsUsed, userQuestion = null) => {
  const questionContext = userQuestion ? `\n\nCANDIDATE'S QUESTION:\n"${userQuestion}"\n` : '';
  
  return `You are a supportive technical interviewer helping a candidate succeed in their coding interview.

PROBLEM:
${problemTitle}
${problemDescription}

CANDIDATE'S CURRENT CODE:
\`\`\`python
${currentCode}
\`\`\`${questionContext}

CONTEXT:
- This is hint request #${hintsUsed + 1}
- The candidate is asking for help - be encouraging and helpful
- Guide them toward the solution without giving it away entirely
- Focus on building their confidence while improving their approach
${userQuestion ? '- They\'ve asked a specific question - address it helpfully' : ''}

YOUR RESPONSE SHOULD:
1. Be encouraging and supportive (2-4 sentences)
2. Acknowledge what they've done well so far
3. Provide a helpful hint or ask a guiding question
4. Can include small code hints if they're really stuck (but not the full solution)
5. Sound like a friendly mentor
${userQuestion ? '6. Directly answer their question in a helpful, educational way' : ''}

Respond as the supportive interviewer now:`;
};

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

    const { problemTitle, problemDescription, code = '', hintsUsed, mode = 'v1', userQuestion = null } = req.body;

    // Only validate that problemTitle and problemDescription exist
    // Code can be empty (user asking for initial hints)
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

    const prompt =
      mode === 'v2'
        ? getInterviewerPromptV2(problemTitle, problemDescription, code, hintsUsed, userQuestion)
        : getInterviewerPromptV1(problemTitle, problemDescription, code, hintsUsed, userQuestion);

    console.log(`[ask-interviewer] Calling Keywords AI with mode=${mode}, model=claude-sonnet-4-5-20250929`);
    if (userQuestion) {
      console.log(`[ask-interviewer] User question: "${userQuestion.substring(0, 100)}..."`);
    }
    console.log(`[ask-interviewer] API Key: ${apiKey.slice(0, 10)}... (redacted)`);

    let response;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        response = await axios.post(
          KEYWORDS_AI_API_URL,
          {
            model: 'claude-sonnet-4-5-20250929',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 200,
            temperature: 0.7,
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
          const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s
          console.log(`[ask-interviewer] Rate limited (429), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw error; // Re-throw if not a 429 or out of retries
        }
      }
    }

    const latency = Date.now() - startTime;
    const message = response.data.choices[0]?.message?.content || 'No response from interviewer';
    const promptTokens = response.data.usage?.prompt_tokens || 0;
    const completionTokens = response.data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    const telemetry = {
      timestamp: Date.now(),
      type: 'hint',
      model: 'claude-sonnet-4-5-20250929',
      promptTokens,
      completionTokens,
      totalTokens,
      latency,
      mode,
      success: true,
    };

    console.log(
      `[ask-interviewer] Success - Tokens: ${totalTokens}, Latency: ${latency}ms`
    );

    return res.status(200).json({
      message,
      type: 'hint',
      telemetry,
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

    const { problemTitle, problemDescription, code = '', hintsUsed, executionCount } = req.body;

    // Only validate that problemTitle and problemDescription exist
    // Code can be empty (user might end session without writing code)
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

    const prompt = `You are a technical interviewer providing feedback after a coding interview session.

PROBLEM:
${problemTitle}
${problemDescription}

CANDIDATE'S FINAL CODE:
\`\`\`python
${code}
\`\`\`

SESSION STATS:
- Hints requested: ${hintsUsed}
- Code executions: ${executionCount}

Analyze the candidate's performance and provide structured feedback in the following JSON format:

{
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestedTopics": ["topic 1", "topic 2", "topic 3"],
  "overallScore": <number from 1-10>,
  "detailedFeedback": "<2-3 sentence summary of performance>"
}

EVALUATION CRITERIA:
1. Code correctness and completeness
2. Time and space complexity
3. Code quality (readability, variable names, structure)
4. Edge case handling
5. Problem-solving approach (based on hints needed)

Be honest but constructive. Focus on specific, actionable feedback.

Return ONLY the JSON object, no other text:`;

    console.log('[end-session] Calling Keywords AI with model=claude-sonnet-4-5-20250929');

    let response;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        response = await axios.post(
          KEYWORDS_AI_API_URL,
          {
            model: 'claude-sonnet-4-5-20250929',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 500,
            temperature: 0.5,
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
    let feedbackData;

    try {
      // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
      let jsonString = responseContent.trim();
      if (jsonString.startsWith('```')) {
        // Remove opening code fence (```json or ```)
        jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '');
        // Remove closing code fence (```)
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

    const promptTokens = response.data.usage?.prompt_tokens || 0;
    const completionTokens = response.data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    const telemetry = {
      timestamp: Date.now(),
      type: 'feedback',
      model: 'claude-sonnet-4-5-20250929',
      promptTokens,
      completionTokens,
      totalTokens,
      latency,
      success: true,
    };

    console.log(
      `[end-session] Success - Tokens: ${totalTokens}, Latency: ${latency}ms`
    );

    return res.status(200).json({
      ...feedbackData,
      telemetry,
    });
  } catch (error) {
    console.error('[end-session] Error:', error.message);

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
