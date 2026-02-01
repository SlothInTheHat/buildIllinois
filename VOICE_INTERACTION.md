# Voice Interaction Guide

## Overview
The interview platform now supports **bidirectional voice interaction** - speak to the AI interviewer and hear responses spoken back to you.

## Features

### 🎤 Speech-to-Text (Already Implemented)
- **Live transcription** using RealtimeSTT
- WebSocket connection to Python speech server
- Real-time partial updates and finalized text
- Automatic saving to transcript files

### 🔊 Text-to-Speech (NEW)
- **Auto-speak AI responses** when enabled
- Browser-based Web Speech API (no external dependencies)
- Manual controls to speak/stop at any time
- Configurable voice settings (rate, pitch)

## How to Use

### 1. Start the Speech Server
```bash
cd buildIllinois/buildIllinois
python speech_server.py
```

This starts:
- WebSocket server on `ws://localhost:8765`
- Real-time audio transcription using RealtimeSTT
- Automatic transcript logging

### 2. Start the Dev Environment
In separate terminals:
```bash
# Terminal 1: Backend API server
npm run dev:server

# Terminal 2: Frontend Vite server
npm run dev
```

### 3. Interactive Voice Session

#### Speaking to the AI:
1. Click **"Audio Transcriber"** section (or use the AudioTranscriber component)
2. Click **"Start Recording"**
3. Speak your question or code explanation
4. Wait for a brief pause - sentence will be finalized
5. Continue speaking or click **"Stop Recording"**

#### Hearing AI Responses:
1. **Auto-speak mode** (enabled by default):
   - Check ✅ "🔊 Auto-speak responses"
   - Click **"Ask Interviewer"** button
   - AI response will automatically be spoken aloud

2. **Manual control**:
   - Uncheck "Auto-speak responses"
   - When interviewer message appears, click **"🔊 Speak"** button
   - Click **"⏸️ Stop"** to interrupt

## Voice Settings

### Auto-Speak Toggle
Located in the interview header:
- ✅ **Enabled**: AI responses are automatically spoken
- ❌ **Disabled**: Manual control only

### Voice Customization (in code)
Adjust these variables in InterviewPanel:
```typescript
const [voiceRate, setVoiceRate] = useState(1.0);  // 0.1 to 10 (1.0 = normal)
const [voicePitch, setVoicePitch] = useState(1.0); // 0 to 2 (1.0 = normal)
```

## Technical Details

### Speech-to-Text Architecture
```
Microphone → RealtimeSTT (Python) → WebSocket → React Frontend
                ↓
         Transcript Files
```

### Text-to-Speech Architecture
```
AI Response → SpeechSynthesisUtterance → Browser TTS Engine → Audio Output
```

### Key Functions

#### `speakText(text: string)`
Converts text to speech using Web Speech API
- Cancels any ongoing speech
- Uses preferred natural voice if available
- Tracks speaking state

#### `stopSpeaking()`
Immediately stops current speech synthesis

#### `handleAskInterviewer()`
Enhanced to auto-speak responses:
```typescript
const message = response.data.message;
setInterviewerMessage(message);

// Auto-speak if enabled
if (autoSpeak) {
  speakText(message);
}
```

## Browser Compatibility

### Text-to-Speech Support
✅ Chrome/Edge (Best quality)
✅ Firefox (Good quality)
✅ Safari (Good quality)
⚠️ Older browsers may have limited voice options

### Available Voices
The system automatically selects the best available voice:
1. Google voices (highest quality)
2. Natural-sounding system voices
3. Fallback to default system voice

## Usage Tips

### Best Practices
1. **Use headphones** to prevent audio feedback loops
2. **Pause between sentences** for better transcription accuracy
3. **Enable auto-speak** for hands-free coding practice
4. **Adjust microphone sensitivity** in speech_server.py if needed

### Interview Flow
```
1. Ask question verbally → Transcribed
2. Click "Ask Interviewer" → AI processes
3. Response appears as text → Auto-spoken
4. Continue conversation naturally
```

### Troubleshooting

#### Speech server not connecting:
```bash
# Check if Python server is running
ps aux | grep speech_server.py

# Restart server
python speech_server.py
```

#### TTS not working:
- Check browser console for errors
- Verify browser supports Web Speech API
- Try different browser (Chrome recommended)
- Check system audio settings

#### Voice sounds robotic:
- Install better voices on your OS
- Windows: Settings → Time & Language → Speech
- Mac: System Settings → Accessibility → Spoken Content
- Linux: Install espeak-ng or festival

## Future Enhancements

Potential improvements:
- [ ] Voice selector UI (choose specific voice)
- [ ] Speed/pitch controls in UI
- [ ] Voice activity detection (automatic question detection)
- [ ] Multi-language support
- [ ] Premium TTS integration (ElevenLabs, Google Cloud TTS)
- [ ] Voice interruption handling
- [ ] Conversation history playback

## Demo Scenario

### Full Voice Interview Session:
1. Start Python server: `python speech_server.py`
2. Start dev servers: `npm run dev:server` + `npm run dev`
3. Enable auto-speak in UI
4. Start audio transcriber
5. **You say**: "I'm having trouble with this algorithm. Can you give me a hint about the time complexity?"
6. Click "Ask Interviewer"
7. **AI speaks**: "What's the time complexity of your current approach? Can you optimize it?"
8. **You say**: "I think it's O(n squared) because of the nested loops"
9. Click "Ask Interviewer"
10. **AI speaks**: "That's correct. What data structure could help you achieve O(n) lookup?"
11. Continue natural conversation...

---

**Note**: This feature leverages existing browser APIs for TTS (no additional dependencies) and integrates seamlessly with the existing RealtimeSTT Python server for STT.
