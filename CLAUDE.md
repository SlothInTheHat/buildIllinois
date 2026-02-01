# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CheatCode - An interactive coding interview platform where an AI interviewer watches you code, provides hints, and gives comprehensive feedback. Built with React + TypeScript + Vite, deployed on Vercel with serverless functions.

## Common Commands

```bash
# Development (recommended - runs both servers)
npm run dev:full

# Or run separately:
npm run dev:server    # Backend API server (port 5174)
npm run dev           # Vite frontend (port 5173)

# Build & Lint
npm run build         # TypeScript check + Vite build
npm run lint          # ESLint

# Voice feature (requires Python)
python speech_server.py   # Start STT WebSocket server (port 8765)
```

## Architecture

```
React Frontend (Vite)
    ↓
Vercel API Functions (/api)
    ├── /api/ask-interviewer → Keywords AI (GPT-3.5 for hints)
    ├── /api/end-session     → Keywords AI (GPT-4 for feedback)
    └── /api/run-code        → Piston API (Python execution)
```

### Key Data Flow

1. **Interview Mode Selection**: App.tsx manages `mode` state ('v1' = Strict, 'v2' = Supportive) passed to InterviewPanel
2. **AI Prompts**: Two interviewer personalities defined in `api/ask-interviewer.ts` (getInterviewerPromptV1/V2)
3. **Voice Interaction**: AudioTranscriber (STT via Python WebSocket) → speakText function (TTS via Web Speech API)

## Key Files

| Path | Purpose |
|------|---------|
| `api/ask-interviewer.ts` | Hint generation endpoint - contains both V1/V2 prompt templates |
| `api/end-session.ts` | Feedback endpoint - GPT-4 structured evaluation |
| `src/components/InterviewPanel.tsx` | Main interview UI, voice controls, conversation history |
| `src/components/FeedbackPanel.tsx` | End-of-session feedback with TTS |
| `src/components/AudioTranscriber.tsx` | Speech-to-text component |
| `src/data/problems.ts` | Coding problems (fetched from Supabase or fallback) |
| `dev-server.js` | Local Express server that proxies API calls during development |

## Prompts

The app uses 3 AI prompts (duplicated in API files for serverless):
- **Interviewer V1** (Strict): Brief, challenging, no code snippets
- **Interviewer V2** (Supportive): Encouraging, acknowledges progress, gentle hints
- **Feedback**: JSON-structured evaluation with strengths/weaknesses/score

## Environment Variables

Required in `.env`:
```
VITE_KEYWORDS_AI_API_KEY=   # Keywords AI (required)
VITE_SUPABASE_URL=          # Optional - for problem storage
VITE_SUPABASE_ANON_KEY=     # Optional
```

## Voice Feature

- **STT**: Python `speech_server.py` uses RealtimeSTT, connects via WebSocket (ws://localhost:8765)
- **TTS**: Browser Web Speech API with Google voice preference, sentence-by-sentence pacing
- Voice settings (rate, pitch, voice selection) available in UI header

## Deployment

Deployed to Vercel. The `/api` directory contains serverless functions that are automatically deployed. Set environment variables in Vercel dashboard.
