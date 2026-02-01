    # Fix: Get Your OpenAI API Key

## Problem
The Ask Interviewer button is failing because Keywords AI didn't have OpenAI credentials configured. We've switched to using OpenAI directly, which is faster and more reliable.

## Solution: Get Your OpenAI API Key

### Step 1: Go to OpenAI Platform
Visit: https://platform.openai.com/api-keys

### Step 2: Sign in (or create account if needed)
- If you don't have an account, create one (free tier available)
- Note: Free tier has limited credits, but should be enough for hackathon testing

### Step 3: Create API Key
1. Click "Create new secret key"
2. Copy the key (starts with `sk-`)
3. **IMPORTANT**: Store it safely - you won't see it again!

### Step 4: Add to .env.local
Edit `.env.local` and replace:
```
VITE_OPENAI_API_KEY=sk-YOUR_OPENAI_API_KEY_HERE
```

With your actual key:
```
VITE_OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
```

### Step 5: Restart Dev Server
```bash
npm run dev:server
```

Then try the "Ask Interviewer" button again!

## Testing Without OpenAI Key (Demo Mode)

If you don't have an OpenAI account yet, I can add mock responses for demo purposes. Just let me know!

## Cost Estimate
- "Ask Interviewer" hints: ~$0.001-0.002 per call (gpt-3.5-turbo is cheap)
- "End Session" feedback: ~$0.01-0.03 per call (more tokens)
- **Total per session**: ~$0.02-0.05 ✅ Very affordable

For a 2-hour demo, you'll spend less than $1-2 total.
