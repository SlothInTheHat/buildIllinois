# Development Setup

## Quick Start

Run both the dev server and Vite frontend with a single command:

```bash
npm run dev:full
```

This will start:
- **Dev Server** (port 5174): Handles API calls to Keywords AI
- **Vite Frontend** (port 5173): Your React app

## Individual Commands

If you want to run them separately:

```bash
# Terminal 1: Start the backend dev server
npm run dev:server

# Terminal 2: Start the frontend Vite dev server
npm run dev
```

## How It Works

- Vite proxies all `/api/*` requests to the dev server on port 5174
- The dev server forwards requests to Keywords AI API
- Your `.env.local` file provides the Keywords AI API key

## Troubleshooting

### "Ask Interviewer" button still not working?

1. **Check the dev server is running** - You should see "🚀 Dev server running on http://localhost:5174"
2. **Check Keywords AI API key** - Make sure `VITE_KEYWORDS_AI_API_KEY` is set in `.env.local`
3. **Check browser console** - Open DevTools (F12) and check the Console tab for errors
4. **Check Network tab** - See if the request to `/api/ask-interviewer` succeeds or fails

### Port already in use?

If port 5174 is already taken, edit `dev-server.js` and change the `PORT` variable.

## What Changed

- ✅ Created `dev-server.js` - Local Express server for API calls
- ✅ Updated `vite.config.ts` - Added `/api` proxy
- ✅ Updated `package.json` - Added new scripts and dependencies
- ✅ Added `express`, `cors`, `dotenv`, `concurrently`

## Next Steps

Once the dev environment is working:
1. Test the "Ask Interviewer" button with a sample code
2. Build the evaluation dataset (5-10 test cases)
3. Create the demo script
