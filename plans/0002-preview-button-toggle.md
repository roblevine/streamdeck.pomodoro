# Preview Button Toggle Feature

**Status:** Complete
**Date:** 2025-10-03
**Fixed:** 2025-10-30
**Related Commits:**
- `b88b711` - feat: add play/stop toggle to preview buttons (partial)
- `fc94792` - feat: add preview buttons for sound file selectors
- `010c196` - fix: preview stop button and audio playback completion

## Overview

Preview buttons in the Property Inspector toggle between "Preview" and "Stop" states. When audio is playing, clicking the button stops playback immediately. Both the UI toggle and audio stop functionality are working correctly.

## Functionality

### Working Features

1. **Preview → Stop Toggle (UI & Functionality)**
   - Button text changes from "Preview" to "Stop" when clicked
   - Uses optimistic UI updates for instant feedback
   - Stop button immediately stops audio playback
   - Button resets to "Preview" when playback completes or is stopped

2. **Audio Playback**
   - Clicking "Preview" plays the selected sound file
   - Audio plays correctly through AudioPlayer
   - Only one preview can play at a time (new playback stops previous)
   - macOS driver now waits for process completion (prevents button flicker)

## Implementation

### AudioPlayer Updates ([audio-player.ts](../roblevine/src/lib/audio-player.ts))

```typescript
class AudioPlayer {
    private static currentProcess: ChildProcess | null = null;
    private static currentPlaybackId: string | null = null;

    static async play(filePath: string, playbackId: string): Promise<void>
    static stop(): void
    static isPlaying(playbackId?: string): boolean
}
```

**Key Features:**
- Tracks current playback process and ID
- `stop()` method calls `process.kill()` on current process
- Automatically stops previous playback when starting new one
- Uses `exec()` to run platform-specific audio commands (afplay, PowerShell, aplay)

**Implementation Details:**
- Stores `ChildProcess` from `exec()` call
- Listens for 'exit' event to clean up state
- Kills process with `this.currentProcess.kill()` (uses default SIGTERM)

### Plugin Message Handling ([pomodoro-timer.ts](../roblevine/src/actions/pomodoro-timer.ts))

```typescript
override async onSendToPlugin(ev: SendToPluginEvent<any, PomodoroSettings>): Promise<void> {
    const { action, filePath, playbackId } = ev.payload;

    if (action === 'previewSound' && filePath && playbackId) {
        // Send playback started message
        await streamDeck.ui.current?.sendToPropertyInspector({
            event: 'playbackStarted',
            playbackId: playbackId
        });

        // Play the sound (blocks until complete)
        await AudioPlayer.play(filePath, playbackId);

        // Send playback stopped message
        await streamDeck.ui.current?.sendToPropertyInspector({
            event: 'playbackStopped',
            playbackId: playbackId
        });
    } else if (action === 'stopSound') {
        AudioPlayer.stop();
        // Send playback stopped message
        if (playbackId) {
            await streamDeck.ui.current?.sendToPropertyInspector({
                event: 'playbackStopped',
                playbackId: playbackId
            });
        }
    }
}
```

**Message Flow:**
1. Property Inspector sends `previewSound` or `stopSound` action via WebSocket
2. Plugin receives via `onSendToPlugin()`
3. Plugin calls `AudioPlayer.play()` or `AudioPlayer.stop()`
4. Plugin sends status messages back to Property Inspector

### Property Inspector UI ([pomodoro-timer.html](../roblevine/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/ui/pomodoro-timer.html))

**State Management:**
```javascript
const playbackState = {
    work: false,
    break: false
};

function updateButtonState(playbackId, isPlaying) {
    if (playbackId === 'work-preview') {
        playbackState.work = isPlaying;
        const button = document.querySelector('#workPreviewBtn');
        if (button) {
            button.textContent = isPlaying ? 'Stop' : 'Preview';
        }
    }
    // Similar for break-preview
}
```

**Button Click Handlers:**
```javascript
window.previewWorkSound = function() {
    if (playbackState.work) {
        // Stop playback
        updateButtonState('work-preview', false);
        sendToPlugin({
            action: 'stopSound',
            playbackId: 'work-preview'
        });
    } else {
        // Start playback
        const filePath = document.getElementById('workSoundFile')?.value;
        if (filePath) {
            updateButtonState('work-preview', true);
            sendToPlugin({
                action: 'previewSound',
                filePath: filePath,
                playbackId: 'work-preview'
            });

            // Auto-reset after 5 seconds
            setTimeout(() => {
                if (playbackState.work) {
                    updateButtonState('work-preview', false);
                }
            }, 5000);
        }
    }
};
```

**Design Decision: Optimistic UI Updates**
- Button state updates immediately when clicked (doesn't wait for plugin confirmation)
- Provides instant feedback to user
- Avoids dependency on bi-directional WebSocket messaging
- Timeout ensures button resets even if messages are lost

## Debugging the Stop Bug

### Possible Causes

1. **WebSocket Context Issue**
   - `stopSound` message may be using wrong context (similar to earlier preview button issue)
   - Need to verify message is reaching `onSendToPlugin()`

2. **Process Kill Not Working**
   - `process.kill()` using default SIGTERM signal
   - May need SIGKILL for immediate termination: `process.kill('SIGKILL')`
   - macOS `afplay` may not respond to SIGTERM

3. **Process Reference Issue**
   - `currentProcess` may be null when stop is called
   - Timing issue: process completes before stop is called

4. **Message Not Reaching Plugin**
   - WebSocket connection issue
   - Need to add logging to verify message receipt

### Debug Steps

1. **Add logging to AudioPlayer.stop()**
   ```typescript
   static stop(): void {
       console.log('AudioPlayer.stop() called');
       console.log('Current process:', this.currentProcess);
       console.log('Current playback ID:', this.currentPlaybackId);

       if (this.currentProcess) {
           console.log('Killing process...');
           this.currentProcess.kill('SIGKILL'); // Try SIGKILL instead
           this.currentProcess = null;
           this.currentPlaybackId = null;
           console.log('Process killed');
       } else {
           console.log('No process to kill');
       }
   }
   ```

2. **Add logging to onSendToPlugin()**
   ```typescript
   if (action === 'stopSound') {
       console.log('Received stopSound action for:', playbackId);
       AudioPlayer.stop();
       console.log('AudioPlayer.stop() completed');
   }
   ```

3. **Check WebSocket message**
   - Verify `stopSound` message is being sent with correct context
   - Check Stream Deck logs for WebSocket errors
   - May need to use same context as `previewSound` (pluginUUID)

4. **Test process.kill() signals**
   - Try `SIGKILL` instead of default `SIGTERM`
   - Test if `afplay` can be interrupted
   - May need platform-specific kill commands

### Potential Fixes

**Option 1: Use SIGKILL**
```typescript
static stop(): void {
    if (this.currentProcess) {
        this.currentProcess.kill('SIGKILL'); // Force kill
        this.currentProcess = null;
        this.currentPlaybackId = null;
    }
}
```

**Option 2: Platform-specific kill**
```typescript
static stop(): void {
    if (this.currentProcess && this.currentProcess.pid) {
        if (process.platform === 'darwin') {
            // macOS: use kill command directly
            exec(`kill -9 ${this.currentProcess.pid}`);
        } else {
            this.currentProcess.kill('SIGKILL');
        }
        this.currentProcess = null;
        this.currentPlaybackId = null;
    }
}
```

**Option 3: Store PID and kill directly**
```typescript
private static currentPid: number | null = null;

static async play(filePath: string, playbackId: string): Promise<void> {
    // ...
    this.currentProcess = exec(command);
    this.currentPid = this.currentProcess.pid ?? null;
    // ...
}

static stop(): void {
    if (this.currentPid) {
        try {
            process.kill(this.currentPid, 'SIGKILL');
        } catch (e) {
            // Process already dead
        }
        this.currentProcess = null;
        this.currentPid = null;
        this.currentPlaybackId = null;
    }
}
```

## Testing Scenarios

### Manual Tests

1. **Basic Toggle**
   - Click "Preview" → Button changes to "Stop" ✓
   - Wait for audio to finish → Button resets to "Preview" ✓

2. **Stop During Playback** ✓ FIXED
   - Click "Preview" to start audio
   - Click "Stop" while audio playing
   - Expected: Audio stops immediately
   - Actual: Audio stops immediately ✓

3. **Multiple Previews**
   - Click "Preview" on work sound
   - Click "Preview" on break sound while first is playing
   - Expected: First audio stops, second audio plays
   - Actual: Works correctly (play() stops previous) ✓

4. **Timeout Behavior**
   - Click "Preview"
   - Don't click stop
   - Wait 5 seconds
   - Expected: Button resets to "Preview"
   - Actual: Works correctly ✓

## Fix Summary (2025-10-30)

The stop button bug was fixed with the following changes:

1. **macOS Audio Driver** - Made `play()` wait for process completion using Promise with exit event listener, preventing premature `playbackStopped` messages
2. **Process Termination** - Improved `stop()` with SIGTERM first, then SIGKILL fallback, with proper PID validation
3. **PlaybackId Validation** - Added playbackId parameter to `AudioPlayer.stop()` to ensure only matching playback is stopped
4. **Message Handling** - Verified message flow with debug logging (disabled by default)

The fix ensures that:
- macOS `afplay` processes are properly tracked and can be killed
- Button state updates correctly as playback starts/stops
- No flickering between "Stop" and "Preview" states

## Future Enhancements

1. **Visual Feedback**
   - Progress bar or animation while playing
   - Spinner or loading indicator

2. **Error Handling**
   - Show error if file not found
   - Show error if audio format not supported

3. **Keyboard Support**
   - Spacebar to stop playback
   - ESC key to stop

## References

- AudioPlayer implementation: [src/lib/audio-player.ts](../roblevine/src/lib/audio-player.ts)
- Plugin message handler: [src/actions/pomodoro-timer.ts](../roblevine/src/actions/pomodoro-timer.ts#L115)
- Property Inspector UI: [ui/pomodoro-timer.html](../roblevine/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/ui/pomodoro-timer.html)
- Node.js ChildProcess docs: https://nodejs.org/api/child_process.html
- Process signals: https://nodejs.org/api/process.html#process_signal_events
