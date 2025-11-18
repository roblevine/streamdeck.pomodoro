# Pomodoro Timer - Stream Deck Plugin

A feature-rich Pomodoro timer plugin for Elgato Stream Deck, built with TypeScript and Node.js.

## Features

- Pomodoro cycle with work, short break, and long break
- Configurable durations and cycles-before-long-break
- Auto-advance between phases with optional boundary pause
- Double-press: skip to the next phase (no completion animation/sound)
- Visual donut countdown with static color scheme
  - Blue: Work
  - Dark Green: Short break
  - Light Green: Long break
- Pause controls
  - Short press: pause/resume mid-timer (ring blinks phase/red while paused)
  - Long press (2 seconds): full reset to start
  - On reset: ring flashes several times; a short double-pip plays (if sound enabled)
- Completion feedback
  - Spinning dashed white ring with "Done" during a configurable hold
  - Sound and animation run concurrently; hold extends if sound is longer
- Audio notifications (WAV)
  - Separate sounds for work completion and break completion
  - Preview buttons and enable/disable toggle
  - Windows uses a persistent PowerShell host; macOS uses `afplay`
  - Key click on every press (respects Enable Sound)
- In-session resume when hidden/shown (page/profile switches); runtime is not persisted across deletion
- Time display in MM:SS

## Requirements

- **Stream Deck Software**: Version 6.5 or higher
- **Operating System**:
  - Windows 10 or higher
  - macOS 12 or higher
- **Node.js**: Version 20 (bundled with plugin)

## Installation

1. Double-click the `.streamDeckPlugin` file to install
2. The plugin will appear in your Stream Deck actions list under "Pomodoro Timer" category
3. Drag the "Pomodoro Timer" action onto any button

## Usage

### Basic Operation

1. **Add Action**: Drag "Pomodoro Timer" from the actions list to a Stream Deck button
2. **Start**: Press the button to start the countdown
3. **Pause/Resume**: Press while running to pause; press again to resume
4. **Skip**: Double-press (two taps within 320ms) to skip to the next phase (stops if running; no completion effects)
5. **Reset**: Long-press (2 seconds) to reset timer and cycle to start
6. **Completion**: When time expires, the button shows "Done" with a spinning dashed ring; sound plays if enabled

### Configuration

Click on the Pomodoro Timer button in Stream Deck to open the Property Inspector and configure:

- Work Duration (mm:ss)
- Short Break Duration (mm:ss)
- Long Break Duration (mm:ss)
- Cycles Before Long Break
- Pause At End Of Each Phase (toggle)
- Completion Hold (seconds)
- Enable Sound (toggle)
- Work End Sound (.wav)
- Break End Sound (.wav)

### Behavior Summary

- **Short press**: Pauses/resumes mid-timer
- **Double-press** (within 320ms): Skips current (or pending) phase and advances to the next; stops timer if running; no completion animation/sound
- **Long press** (2 seconds): Resets timer and cycle count; ring flashes 3 times and double-pip sound plays when audio is enabled
- **Input precedence**: Long-press takes over after 2 seconds; double-press only applies to short presses
- If "Pause At End Of Each Phase" is on, next phase waits for a press; otherwise auto-starts
- When a timer completes, "Done" shows with a spinning dashed ring; sound (if enabled) plays in parallel; the hold lasts at least the configured seconds, longer if the sound is still playing

### Config vs State

- Config settings (PI): durations, cycles, pause-at-end, audio toggles/paths, completion hold — persisted by Stream Deck
- Runtime state (in-memory): phase, cycleIndex, running, remaining — not written to settings; cleared on long-press reset and when the action is removed## Development

### Setup

```bash
npm install
```

### Build

```bash
# Production build
npm run build

# Development build with watch mode (auto-restarts plugin on changes)
npm run watch
```

The `npm run build` command automatically generates audio assets before compiling TypeScript.

### Testing

The plugin includes a comprehensive test suite using Vitest:

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with visual UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

**Test Organization:**

```
test/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for component interactions
├── e2e/            # End-to-end workflow tests
├── mocks/          # Mock implementations (Stream Deck SDK, audio, etc.)
├── helpers/        # Test utilities and helpers
└── fixtures/       # Test data and fixture files
```

**Coverage Targets:**
- Overall: 85% line coverage
- Core business logic: 95% coverage
- See `plans/0008-comprehensive-testing.md` for detailed testing strategy

### Asset Generation

The build process includes automatic generation of CC0-licensed audio assets:

```bash
# Generate audio assets (runs automatically during build)
npm run build:assets
```

**Generated Assets** (in `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/assets/sounds/`):

- `reset-double-pip.wav`: Two-tone beep played on long-press reset (880 Hz, ~300ms total)
- `key-click.wav`: Short click sound on button press (1800/3000 Hz blend, ~35ms)
- `silent-prime.wav`: Silent 12ms WAV used to prime audio driver on startup (eliminates first-play latency)

**Technical Details**:

- Pure sine wave synthesis with no external dependencies
- 44.1 kHz sample rate, 16-bit PCM, mono
- Envelope shaping to prevent audio clicks
- CC0 license (public domain)
- Script: `scripts/generate-sounds.mjs`
- Skips generation if files already exist (idempotent)

**Purpose**: Pre-generated assets eliminate the need for bundled audio files and ensure consistent sound quality across platforms. The silent primer WAV is played on plugin startup to initialize the audio driver, reducing latency on the first actual sound playback.

### Project Structure

```
roblevine/
├── src/
│   ├── plugin.ts                           # Main entry point
│   ├── actions/
│   │   └── pomodoro-timer.ts               # Pomodoro timer action
│   └── lib/
│       ├── audio-driver/                   # Audio driver implementations
│       │   ├── driver.ts                   # AudioDriver interface and factory
│       │   ├── windows-persistent.ts       # Windows PowerShell driver
│       │   └── macos-system.ts             # macOS/Linux afplay/aplay driver
│       ├── audio-player.ts                 # AudioPlayer facade
│       ├── defaults.ts                     # Default configuration values
│       ├── display-generator.ts            # SVG generation for button display
│       ├── message-handlers/               # Property Inspector message handlers
│       │   ├── preview-sound-handler.ts    # Preview button handler
│       │   └── stop-sound-handler.ts       # Stop sound handler
│       ├── plugin-message-observer.ts      # Message routing pattern
│       ├── pomodoro-cycle.ts               # Pomodoro cycle state management
│       ├── timer-manager.ts                # Timer lifecycle management
│       ├── workflow.ts                     # State machine definition
│       └── workflow-controller.ts          # Workflow controller (ports implementation)
├── plans/
│   ├── 0001-audio-notifications.md        # Audio feature implementation
│   ├── 0002-preview-button-toggle.md      # Preview/stop button feature
│   ├── 0003-pomodoro-workflow.md          # Workflow state machine
│   ├── 0004-double-press-skip.md          # Double-press skip feature
│   ├── 0005-shared-global-timer.md        # Proposed shared timer (not implemented)
│   ├── 0006-reset-feedback.md             # Reset feedback implementation
│   └── 0007-documentation-remediation.md  # Documentation improvement plan
├── scripts/
│   └── generate-sounds.mjs                 # Build-time sound asset generation
└── uk.co.roblevine.streamdeck.pomodoro.sdPlugin/
    ├── manifest.json                       # Plugin metadata
    ├── bin/plugin.js                       # Compiled plugin (generated)
    ├── assets/sounds/                      # Audio assets (generated at build)
    └── ui/
        └── pomodoro-timer.html             # Timer settings UI
```

### Technology Stack

- **Language**: TypeScript (ES2022)
- **Runtime**: Node.js 20
- **SDK**: Elgato Stream Deck SDK v1.0
- **Build Tool**: Rollup with TypeScript plugin
- **Minification**: Terser (production builds)

### Build Configuration

The build process:
- Compiles TypeScript from `src/` directory
- Outputs to `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/bin/plugin.js`
- Generates sourcemaps in watch mode for debugging
- Auto-restarts Stream Deck plugin on file changes (watch mode)

### Debugging

**Plugin Logs:**

Plugin logs are automatically written to the plugin's log directory using `streamDeck.logger`:

- **Development directory**: `roblevine/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/logs/`
- **Installed plugin directory** (Windows): `%APPDATA%\Elgato\StreamDeck\Plugins\uk.co.roblevine.streamdeck.pomodoro.sdPlugin\logs\`
- **Installed plugin directory** (macOS): `~/Library/Application Support/com.elgato.StreamDeck/Plugins/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/logs/`

Log files are automatically rotated, keeping the 10 most recent logs with a maximum size of 10 MiB each. The most recent log is always `uk.co.roblevine.streamdeck.pomodoro.0.log`.

**Monitor logs in real-time:**

```bash
# Windows (Git Bash) - Development
tail -f roblevine/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/logs/uk.co.roblevine.streamdeck.pomodoro.0.log

# Windows (Git Bash) - Installed plugin
tail -f "$APPDATA/Elgato/StreamDeck/Plugins/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/logs/uk.co.roblevine.streamdeck.pomodoro.0.log"

# macOS - Installed plugin
tail -f ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/logs/uk.co.roblevine.streamdeck.pomodoro.0.log
```

**Log Levels:**

The plugin uses `LogLevel.TRACE` in development (set in `src/plugin.ts`) which captures all debug messages including:
- `[PluginMessageObserver]` - Message routing and handler dispatch
- `[PreviewSoundHandler]` - Audio preview functionality
- `[StopSoundHandler]` - Stop audio functionality
- SDK protocol messages (connection, events, etc.)

**Property Inspector Logs:**

The Property Inspector runs in an embedded web view with `[PI MessageBus]` console logging. To access:

1. Open the Property Inspector (click on a Pomodoro button in Stream Deck)
2. Check if Stream Deck has remote debugging enabled at: `http://localhost:23654`
3. Look for `[PI MessageBus]` logs showing message subscriptions and publications
4. Alternatively, check Stream Deck preferences for "Enable Developer Mode" option

Note: Property Inspector debugging availability depends on your Stream Deck version.

**Stream Deck Application Logs:**

Stream Deck's main application logs (SDK protocol messages only, not plugin-level logs):
- **Windows**: `%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.json`
- **macOS**: `~/Library/Logs/ElgatoStreamDeck/StreamDeck.json`

### Architecture

The plugin follows the Elgato Stream Deck SDK architecture:

- **Actions**: Extend `SingletonAction<SettingsType>` with `@action` decorator
- **Lifecycle Events**: `onWillAppear`, `onKeyDown`, `onWillDisappear`, etc.
- **Settings Persistence**: Actions store persistent settings via `setSettings()`/`getSettings()`
- **Visual Updates**: SVG generation for dynamic button graphics

## Plugin ID

`uk.co.roblevine.streamdeck.pomodoro`

## Version

0.1.0.0

## Author

Rob Levine

## Troubleshooting

### Missing Sound Files

**Issue**: Configured sound files deleted or path invalid

**Behavior**: The plugin operates silently without errors when sound files are missing:
- Audio playback is skipped (no error shown to user)
- Visual feedback continues normally (completion animation, reset flash)
- Timer and workflow continue functioning
- Plugin logs will show file access errors if log level is DEBUG or TRACE

**Solution**: Verify sound file paths in Property Inspector settings, or disable "Enable Sound" if audio is not needed.

### Completion Hold Duration

**Issue**: "Done" state appears to last longer than configured completion hold

**Behavior**: The completion hold extends automatically when sound playback exceeds the configured duration:
- Hold duration = `max(completionHoldSeconds, actualSoundDuration)`
- If sound is 5 seconds and hold is configured for 3 seconds, hold will last 5 seconds
- Sound and animation run in parallel; hold waits for both to complete
- This ensures sound is never cut off prematurely

**This is by design**, not a bug. Adjust `completionHoldSeconds` or use shorter sound files if needed.

### Double-Press vs Long-Press Interaction

**Issue**: Confusion about when double-press vs long-press is triggered

**Behavior**: Input detection follows strict precedence rules:
- **Long-press detection starts at button down**: A 2-second timer begins when you press the button
- **Long-press triggers at 2 seconds**: If you hold for ≥2 seconds, long-press fires immediately (reset action)
- **Double-press window is 320ms**: Two taps within 320ms trigger skip (only applies to short presses)
- **Long-press takes precedence**: If you hold past 2 seconds, it becomes a reset regardless of previous taps

**Examples**:
- Tap, wait 100ms, tap again → Double-press (skip)
- Tap, wait 500ms, tap again → Two separate short presses (pause/unpause twice)
- Press and hold for 2+ seconds → Long-press (reset)
- Tap, then hold second press for 2+ seconds → Long-press on second tap (reset)

### Audio Not Playing

**Issue**: Sounds enabled but no audio plays

**Check**:
1. Verify "Enable Sound" is checked in Property Inspector
2. Confirm sound file paths are valid and files exist
3. Test with preview buttons in Property Inspector
4. Check OS audio output is not muted
5. On Windows: Ensure PowerShell execution is not blocked by security policy
6. On macOS: Verify `afplay` command works in terminal
7. Check plugin logs for audio driver errors

**Note**: First sound playback may have slight delay (~50-100ms) as audio driver initializes. Silent primer WAV played on startup minimizes this.

## Known Limitations

### Audio Preview Stop Button

The Property Inspector includes preview buttons to test work/break completion sounds. While the preview playback works correctly, the stop functionality does not currently work:

- **Working**: Clicking "Preview" plays the selected sound; button changes to "Stop"
- **Not Working**: Clicking "Stop" changes the button text back to "Preview" but audio continues playing until completion

**Workaround**: Wait for the audio to complete (typically 1-3 seconds), or start another preview to stop the current one.

See [Plan 0002](plans/0002-preview-button-toggle.md) for technical details and debugging notes.

## License

(License information to be added)


