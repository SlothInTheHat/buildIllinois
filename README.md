# CheetCode

> Real-time AI coding interviewer powered by Keywords AI - Built for hackathons

An interactive coding interview platform where an AI interviewer watches you code, provides hints, and gives comprehensive feedback on your performance.

## Features

- **Live Code Editor**: Monaco Editor with Python syntax highlighting
- **Real-Time Code Execution**: Safe Python code execution via Piston API
- **AI Interviewer**: Get hints and guidance from an AI interviewer (powered by Keywords AI)
- **Two Interview Modes**:
  - **v1 (Strict)**: Rigorous technical interviewer focusing on best practices
  - **v2 (Supportive)**: Encouraging coach that guides you more gently
- **Comprehensive Feedback**: End-of-session analysis with strengths, weaknesses, and practice suggestions
- **Multiple Problems**: Practice with curated LeetCode-style problems (Two Sum, Valid Parentheses, etc.)
- **Session Tracking**: Monitor hints used and code executions

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Code Editor**: Monaco Editor
- **Code Execution**: Piston API (sandboxed Python runtime)
- **AI/LLM**: Keywords AI (prompt versioning, model routing, observability)
- **Database**: Supabase (optional - for session persistence)
- **Deployment**: Vercel (serverless functions + static hosting)

## Architecture

```
┌─────────────────┐
│  React Frontend │
│   (Vite + TS)   │
└────────┬────────┘
         │
         v
┌─────────────────────────┐
│ Vercel API Functions    │
│  ├─ /api/run-code       │──► Piston API
│  ├─ /api/ask-interviewer│──► Keywords AI (GPT-3.5 for hints)
│  └─ /api/end-session    │──► Keywords AI (GPT-4 for feedback)
└─────────────────────────┘
```

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd buildIllinois
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

**Required Environment Variables:**

```env
# Keywords AI - Get from https://keywordsai.co
VITE_KEYWORDS_AI_API_KEY=your_keywords_ai_api_key

# Supabase (optional for session storage)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Interview Mode (v1 = strict, v2 = supportive)
VITE_INTERVIEWER_MODE=v1
```

### 3. Get Your API Keys

#### Keywords AI (Required)
1. Go to [keywordsai.co](https://keywordsai.co)
2. Sign up and create a project
3. Copy your API key
4. Paste it in `.env` as `VITE_KEYWORDS_AI_API_KEY`

#### Supabase (Optional)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy the URL and anon key
5. Run this SQL to create the sessions table:

```sql
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  code TEXT NOT NULL,
  hints_requested INT DEFAULT 0,
  code_executions INT DEFAULT 0,
  feedback JSONB
);
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:5173`

## Deployment to Vercel

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
vercel
```

Follow the prompts. Vercel will auto-detect the Vite project.

### 3. Set Environment Variables in Vercel Dashboard

Go to your Vercel project settings and add:
- `VITE_KEYWORDS_AI_API_KEY`
- `VITE_SUPABASE_URL` (optional)
- `VITE_SUPABASE_ANON_KEY` (optional)
- `VITE_INTERVIEWER_MODE` (v1 or v2)

### 4. Redeploy

```bash
vercel --prod
```

## Keywords AI Integration (Hackathon Demo Points)

This project demonstrates advanced LLM ops using Keywords AI:

### 1. **Prompt Versioning**
- Two interviewer personas (v1 strict, v2 supportive)
- Switch between them without touching code
- Set `VITE_INTERVIEWER_MODE=v2` to demo

### 2. **Model Routing**
- **Cheap model (GPT-3.5)** for real-time hints → `/api/ask-interviewer`
- **Strong model (GPT-4)** for final evaluation → `/api/end-session`
- Optimizes cost vs. quality

### 3. **Observability**
- All prompts and responses logged in Keywords AI dashboard
- Can debug bad hints and track token usage
- Show judges: "Here's how we monitor AI quality"

### 4. **Evaluation** (Bonus Points)
Create a simple eval dataset:
- 5 test cases with expected hint quality
- Run through Keywords AI eval framework
- Show in demo: "We systematically test our AI interviewer"

## Project Structure

```
├── api/                      # Vercel serverless functions
│   ├── run-code.ts          # Python code execution (Piston)
│   ├── ask-interviewer.ts   # AI hints (Keywords AI)
│   └── end-session.ts       # Final feedback (Keywords AI)
├── src/
│   ├── components/          # React components
│   │   ├── CodeEditor.tsx   # Monaco editor wrapper
│   │   ├── InterviewPanel.tsx  # Main interview UI
│   │   └── FeedbackPanel.tsx   # End-session feedback
│   ├── data/
│   │   └── problems.ts      # Coding problems
│   ├── lib/
│   │   ├── supabase.ts      # Database client
│   │   └── piston.ts        # Code execution client
│   ├── prompts/
│   │   ├── interviewer-v1.ts  # Strict interviewer prompt
│   │   ├── interviewer-v2.ts  # Supportive coach prompt
│   │   └── feedback.ts        # Feedback generation prompt
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   ├── App.tsx              # Main app component
│   └── App.css              # Styles
├── .env.example             # Environment template
├── vercel.json              # Vercel config
└── README.md                # This file
```

## Demo Script for Hackathon Judges

### 1. Start Interview (30 seconds)
- "I'm going to solve Two Sum"
- Write partial code (nested loops)

### 2. Ask Interviewer (30 seconds)
- Click "Ask Interviewer"
- AI: *"What's the time complexity of your current approach? Can you optimize it?"*
- Show: Real-time AI response

### 3. Improve Code (30 seconds)
- Refactor to use hash map
- Run code, show output

### 4. End Interview (30 seconds)
- Click "End Interview"
- Show comprehensive feedback with score, strengths, weaknesses

### 5. Show Keywords AI Dashboard (30 seconds)
- Pull up Keywords AI dashboard
- Show logged prompts, responses, costs
- **Judge wow moment**: "This is how we track AI quality and debug issues"

## Hackathon-Specific Features to Highlight

1. **Model Routing**: "We use GPT-3.5 for hints (fast/cheap) and GPT-4 for evaluation (accurate)"
2. **Prompt Versioning**: "Switch interviewer personality in one line of config"
3. **Observability**: "Every AI decision is logged and debuggable"
4. **Real Code Execution**: "Safe sandboxed Python in containers via Piston"
5. **Full Stack**: "React frontend, serverless backend, all on Vercel"

## Future Enhancements (Post-Hackathon)

- [ ] Voice input (speech-to-text for explaining code)
- [ ] Multi-language support (JavaScript, Java, C++)
- [ ] Live complexity analysis
- [ ] Hint cost system (limited hints per interview)
- [ ] Leaderboard and user profiles
- [ ] Video recording of sessions
- [ ] More problems (50+ LeetCode problems)

## Troubleshooting

### Keywords AI not responding
- Check API key is set correctly in `.env`
- Check Vercel environment variables are set
- Look at Keywords AI dashboard for error logs

### Code not executing
- Piston API might be rate-limited (free tier has limits)
- Check browser console for API errors

### Monaco Editor not loading
- Clear browser cache
- Check if `@monaco-editor/react` is installed

## License

MIT

## Built For

This project was built for [Your Hackathon Name] to demonstrate:
- AI-powered developer tools
- LLM ops best practices with Keywords AI
- Real-time code execution
- Full-stack serverless architecture

---

**Keywords AI**: Prompt versioning, model routing, and observability for LLMs
**Piston API**: Safe sandboxed code execution
**Vercel**: Serverless deployment made simple
