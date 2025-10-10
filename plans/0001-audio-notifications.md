# Audio Notifications Feature

**Status:** Implemented
**Date:** 2025-10-03
**Related Commits:**
- `45e6001` - feat: add configurable audio notifications for timer completion
- `fc94792` - feat: add preview buttons for sound file selectors

## Overview

The Pomodoro Timer now supports configurable audio notifications that play when work periods and break periods complete. Users can select custom WAV files and preview them before use.

## Functionality

### User-Facing Features

1. **Configurable Sound Files**
   - Work End Sound: Plays when a work period completes
   - Break End Sound: Plays when a break period (short or long) completes
   - File format: WAV files only
   - File selection via Property Inspector

2. **Enable/Disable Toggle**
   - `enableSound` setting allows users to turn audio notifications on/off
   - Sounds only play when enabled and file paths are configured

3. **Preview Functionality**
   - Preview buttons next to each file selector
   - Plays the selected sound immediately for testing
   - Works even when audio notifications are disabled globally

### Settings

Property Inspector settings for audio:
- `enableSound` (boolean): Master toggle for audio notifications
- `workEndSoundPath` (string): File path to work completion sound
- `breakEndSoundPath` (string): File path to break completion sound

## Implementation

### Architecture

```
┌─────────────────────────────────────┐
│   Property Inspector (HTML)         │
│  - Sound file selectors              │
│  - Preview buttons                   │
│  - Enable/disable toggle             │
└──────────────┬──────────────────────┘
               │ WebSocket
               │ sendToPlugin()
               ▼
┌─────────────────────────────────────┐
│   PomodoroTimer Action               │
│  - onSendToPlugin() handler          │
│  - Timer completion logic            │
└──────────────┬──────────────────────┘
               │ calls
               ▼
┌─────────────────────────────────────┐
│   AudioPlayer Library                │
│  - Cross-platform playback           │
│  - afplay (macOS)                    │
│  - PowerShell (Windows)              │
│  - aplay/paplay (Linux)              │
└─────────────────────────────────────┘
```

### Key Components

#### 1. AudioPlayer (`src/lib/audio-player.ts`)

Cross-platform audio playback utility using Node.js `child_process.exec`:

- **macOS**: `afplay` command
- **Windows**: PowerShell SoundPlayer
- **Linux**: `aplay` (ALSA) or `paplay` (PulseAudio)

**API:**
```typescript
AudioPlayer.play(filePath: string): Promise<void>
```

Silently fails if audio playback is unavailable or file doesn't exist.

#### 2. Property Inspector WebSocket Connection

The Property Inspector uses raw WebSocket API to communicate with the plugin:

```javascript
function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo, inActionInfo)
```

**Key Implementation Detail:**
Messages must use `pluginUUID` as the context (not `actionInfo.context`) to avoid "wrong context" errors.

#### 3. Preview Button Handler

Preview buttons send messages directly to the plugin via WebSocket:

```javascript
sendToPlugin({
    action: 'previewSound',
    filePath: filePath
});
```

The plugin's `onSendToPlugin()` handler receives these messages and plays the sound immediately.

#### 4. Timer Completion Integration

In `pomodoro-timer.ts`, the `completeTimer()` method checks settings and plays appropriate sounds:

```typescript
if (settings.enableSound) {
    if (currentPhase === 'work' && settings.workEndSoundPath) {
        await AudioPlayer.play(settings.workEndSoundPath);
    } else if ((currentPhase === 'shortBreak' || currentPhase === 'longBreak') && settings.breakEndSoundPath) {
        await AudioPlayer.play(settings.breakEndSoundPath);
    }
}
```

## Technical Challenges & Solutions

### Challenge 1: Property Inspector to Plugin Communication

**Problem:** sdpi-components v4 abstracts away the Stream Deck API, making it difficult to send custom messages from Property Inspector to plugin.

**Solution:** Bypassed sdpi-components and used the raw Stream Deck WebSocket API via `connectElgatoStreamDeckSocket()`.

### Challenge 2: Wrong Context Errors

**Problem:** Messages sent with `actionInfo.context` were rejected with "wrong context" errors.

**Solution:** Use `pluginUUID` instead of `actionInfo.context` when sending messages from Property Inspector.

### Challenge 3: Debugging Without Visible Logs

**Problem:** Plugin logs weren't appearing in expected locations, making debugging difficult.

**Solution:** Used Stream Deck JSON logs at `~/Library/Logs/ElgatoStreamDeck/StreamDeck.json` to trace WebSocket message flow and identify context mismatch issues.

## Future Enhancements

Potential improvements:
- Support for additional audio formats (MP3, OGG)
- Volume control slider
- Built-in sound library
- Different sounds for different break types (short vs long)
- Audio visualization or playback confirmation UI

## Testing

### Manual Test Scenarios

1. **Basic Playback**
   - Enable sound
   - Select WAV files for work and break sounds
   - Start and complete a timer
   - Verify sound plays at completion

2. **Preview Functionality**
   - Select a sound file
   - Click preview button
   - Sound should play immediately
   - Should work even when `enableSound` is disabled

3. **Disabled State**
   - Disable sound toggle
   - Complete a timer
   - Verify no sound plays

4. **Missing Files**
   - Configure sound file path
   - Delete the file from filesystem
   - Complete timer
   - Verify plugin doesn't crash (silent failure)

## References

- AudioPlayer implementation: `roblevine/src/lib/audio-player.ts`
- Property Inspector UI: `roblevine/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/ui/pomodoro-timer.html`
- Timer action: `roblevine/src/actions/pomodoro-timer.ts`
- Stream Deck SDK docs: https://docs.elgato.com/streamdeck/sdk/
