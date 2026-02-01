import time
import threading
import asyncio
import json
from websockets.server import serve
from datetime import datetime
import os

# WebSocket clients
connected_clients = set()
clients_lock = threading.Lock()

# Session logging
session_file = None
session_start_time = None

# ------------------------------
# Helper functions
# ------------------------------
def create_session_file():
    """Create a new session log file with timestamp."""
    global session_file, session_start_time

    # Create transcripts directory if it doesn't exist
    os.makedirs("transcripts", exist_ok=True)

    # Generate filename with timestamp
    session_start_time = datetime.now()
    timestamp = session_start_time.strftime("%Y%m%d_%H%M%S")
    filename = f"transcripts/transcription_{timestamp}.txt"

    # Create and open the file
    session_file = open(filename, "w", encoding="utf-8")

    # Write header
    session_file.write(f"Audio Transcription Log\n")
    session_file.write(f"Started: {session_start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    session_file.write("=" * 80 + "\n\n")
    session_file.flush()

    print(f"📝 Transcription log created: {filename}")
    return filename

def log_transcript(text, is_final):
    """Log transcript to the session file."""
    if session_file is None:
        return

    timestamp = datetime.now().strftime("%H:%M:%S")
    status = "FINAL" if is_final else "PARTIAL"

    # Write to log
    session_file.write(f"[{timestamp}] [{status}]\n")
    session_file.write(f"Text: {text}\n\n")
    session_file.flush()

async def broadcast_transcript(text, is_final):
    """Send transcript updates to all connected WebSocket clients."""
    if not connected_clients:
        return

    message = json.dumps({
        "text": text,
        "is_final": is_final,
        "timestamp": datetime.now().strftime("%H:%M:%S")
    })

    with clients_lock:
        # Create a copy to avoid modification during iteration
        clients = connected_clients.copy()

    # Send to all clients
    for client in clients:
        try:
            await client.send(message)
        except Exception:
            # Remove disconnected clients
            with clients_lock:
                connected_clients.discard(client)


def on_text(text, is_final):
    """Callback triggered by RealtimeSTT with transcription chunks."""

    if not is_final:
        # Provisional update - just log and broadcast
        print(f"[Partial] {text}")
        log_transcript(text, False)
        asyncio.run(broadcast_transcript(text, False))
        return

    # Final chunk - record it
    print(f"[Speech] {text}")
    log_transcript(text, True)
    asyncio.run(broadcast_transcript(text, True))

async def websocket_handler(websocket):
    """Handle incoming WebSocket connections."""
    print(f"New client connected from {websocket.remote_address}")

    with clients_lock:
        connected_clients.add(websocket)

    try:
        # Keep connection alive
        async for message in websocket:
            pass  # We don't expect messages from clients, but keep the connection open
    except Exception as e:
        print(f"Client error: {e}")
    finally:
        with clients_lock:
            connected_clients.discard(websocket)
        print(f"Client disconnected")

async def start_websocket_server():
    """Start the WebSocket server."""
    async with serve(websocket_handler, "localhost", 8765):
        print("🌐 WebSocket server started on ws://localhost:8765")
        print("📱 Frontend will connect to receive live transcriptions")
        await asyncio.Future()  # Run forever

def run_websocket_server():
    """Run WebSocket server in a thread."""
    asyncio.run(start_websocket_server())

if __name__ == "__main__":
    # Create session log file
    log_filename = create_session_file()

    # Start WebSocket server in background thread
    ws_thread = threading.Thread(target=run_websocket_server, daemon=True)
    ws_thread.start()

    # Import heavy dependencies lazily
    try:
        print("📥 Initializing audio recorder...")
        from RealtimeSTT import AudioToTextRecorder

        # Create recorder using the tiny model (fastest, low-latency)
        recorder = AudioToTextRecorder(
            model="tiny",
            language="en",
            silero_sensitivity=0.4,
            webrtc_sensitivity=2,
            post_speech_silence_duration=0.2,  # Faster finalization
            min_length_of_recording=0.3,       # Quicker response
            min_gap_between_recordings=0,
            on_realtime_transcription_update=lambda txt: on_text(txt, False),  # Real-time updates
        )

        print("🎤 Listening... Press Ctrl+C to stop.")
        print("Start speaking to see real-time transcription.\n")

        # Keep the main thread alive while recorder runs in background
        try:
            while True:
                # text() is a blocking call that returns when speech is detected and processed
                full_text = recorder.text(on_transcription_finished=lambda txt: on_text(txt, True))

        except KeyboardInterrupt:
            print("\nStopped by user.")
    except KeyboardInterrupt:
        print("\nStopped by user.")
    except Exception as exc:
        print(f"Initialization failed: {exc}")
        import traceback
        traceback.print_exc()
    finally:
        # Ensure recorder is stopped/cleaned up
        try:
            if 'recorder' in locals() and recorder is not None:
                recorder.stop()
        except Exception:
            pass

        # Close session log file
        if session_file is not None:
            session_end_time = datetime.now()
            duration = session_end_time - session_start_time

            session_file.write("\n" + "=" * 80 + "\n")
            session_file.write(f"Session ended: {session_end_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            session_file.write(f"Duration: {duration}\n")
            session_file.close()
            print(f"📝 Transcription log saved: {log_filename}")


