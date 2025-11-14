# Stream Deck Pomodoro Timer - Architecture

## Project Overview

This is a Stream Deck plugin for a Pomodoro timer, built using the Elgato Stream Deck SDK. The plugin is written in TypeScript and uses Node.js 20 runtime.

**Plugin ID**: `uk.co.roblevine.streamdeck.pomodoro`
**Current Actions**: Pomodoro Timer (full-featured Pomodoro timer with cycle management and audio notifications)

## Build System

* **Build tool**: Rollup with TypeScript
* **Build**: `npm run build`
* **Watch mode**: `npm run watch` (automatically restarts Stream Deck plugin on changes)

The build process:

* Compiles TypeScript from `src/`
* Outputs to `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/bin/plugin.js`
* Uses terser for minification in production builds
* Generates sourcemaps in watch mode for debugging

## Project Structure

```
roblevine/
├── src/
│   ├── plugin.ts                    # Main entry point - registers actions and connects to Stream Deck
│   ├── actions/
│   │   └── pomodoro-timer.ts        # Pomodoro timer action implementation
│   └── lib/
│       ├── audio-player.ts          # Cross-platform audio playback utility
│       ├── display-generator.ts     # SVG generation for button display
│       ├── pomodoro-cycle.ts        # Pomodoro cycle state management
│       └── timer-manager.ts         # Timer lifecycle management
├── plans/
│   └── audio-notifications.md       # Audio feature documentation
└── uk.co.roblevine.streamdeck.pomodoro.sdPlugin/
    ├── manifest.json                # Stream Deck plugin metadata and action definitions
    ├── bin/plugin.js                # Built plugin code (generated)
    └── ui/
        └── pomodoro-timer.html      # Property inspector UI for timer settings
```

## Stream Deck SDK Architecture

### Action Registration Pattern

Actions extend `SingletonAction<SettingsType>` and use the `@action` decorator:

* `UUID` in decorator must match the action's UUID in `manifest.json`
* Actions have persistent settings stored via `setSettings()`/`getSettings()`
* Common lifecycle events: `onWillAppear`, `onKeyDown`, `onKeyUp`, `onDialRotate`, etc.

### Key Components

* **plugin.ts**: Registers all actions and establishes Stream Deck connection
* **manifest.json**: Defines plugin metadata, actions, icons, OS compatibility, and Node.js version
* **Property Inspector**: HTML files in `ui/` directory provide settings UI using Stream Deck's `sdpi-components`
* **lib/**: Modular libraries for timer management, display generation, cycle logic, and audio playback

### Property Inspector Communication

The Property Inspector uses raw WebSocket API to communicate with the plugin:

* **Important**: Messages from Property Inspector to plugin must use `pluginUUID` as context (not `actionInfo.context`)
* WebSocket connection established via `connectElgatoStreamDeckSocket()` callback
* Custom messages sent via `sendToPlugin()` event and handled by action's `onSendToPlugin()` method

### Logging

- Default log level: `DEBUG`
- For deep diagnostics, temporarily switch to `TRACE`
- Logs are written via `streamDeck.logger`

## TypeScript Configuration

* Extends `@tsconfig/node20`
* ES2022 modules with Bundler resolution
* Compiles all `.ts` files in `src/`

## Development Workflow

1. Make changes to TypeScript files in `src/`
2. If in watch mode, plugin automatically rebuilds and restarts
3. To manually test: build and use Stream Deck application to test actions
4. Property inspector changes require editing HTML in `ui/` directory

## Key Features

### Pomodoro Cycle Management

- Work periods, short breaks, and long breaks
- Automatic phase transitions
- Configurable cycle parameters (durations, cycles before long break)
- In-session resume across appear/disappear (page/profile switches)
- Runtime state is not persisted across deletion; PI config is

### Input Handling

**Short Press**: Pause/Resume
- While running: pauses the timer and preserves remaining time
- While paused: resumes countdown from where it left off
- Visual feedback: ring blinks between phase color and red while paused

**Double-Press**: Skip Phase
- Detection window: 320ms between taps
- Skips current (or pending) phase and advances to the next phase
- If timer is running, stops immediately without completion effects
- No completion animation or sound played for skips
- Respects `pauseAtEndOfEachTimer` setting for next phase
- See `plans/0004-double-press-skip.md` for detailed semantics

**Long-Press**: Reset (≥2000ms)
- Resets timer and cycle count to initial state
- Works from any state (running, paused, or pending)
- Triggers reset feedback: 3 ring flashes + double-pip sound (if audio enabled)
- See `plans/0006-reset-feedback.md` for reset feedback details

**Interaction**: Long-press takes precedence after 2000ms threshold; double-press only applies to short presses within 320ms window.

### Audio Notifications

* Cross-platform playback with OS-specific drivers
  - Windows: persistent PowerShell subprocess using System.Media.SoundPlayer (low-latency without per-play spawn)
  - macOS: afplay per play (fast enough), same abstraction
* Configurable WAV files for work completion and break completion
* Preview buttons in Property Inspector for testing sounds
* Enable/disable toggle for audio notifications
* See `plans/audio-notifications.md` for detailed implementation

### Visual Feedback

- Dynamic SVG-based donut progress indicator
- Static color scheme:
  - Blue: work, Dark Green: short break, Light Green: long break
- Paused mid-timer: ring blinks phase/red
- Completion: spinning dashed white ring with "Done" during configurable hold; sound and animation run concurrently
- Time display in MM:SS; updates every second during countdown

## State Management

### Config vs Runtime

- ConfigSettings (persisted via PI): durations, cyclesBeforeLongBreak, pauseAtEndOfEachTimer, enableSound, workEndSoundPath, breakEndSoundPath, completionHoldSeconds
- RuntimeState (in-memory only): phase, cycleIndex, running, remaining, pendingNext
- Ctx = RuntimeState + ConfigSettings

### Lifecycle

- onWillAppear (fresh): initialize controller/workflow with neutral state (pausedNext/work)
- onWillAppear (existing): rebind action, re-render current state without restarting timers
- onWillDisappear: no cleanup (to retain in-session state); long-press reset clears runtime

### Inputs and Events

- Short press → SHORT_PRESS
- Double-press (≤ ~320 ms between taps) → DOUBLE_PRESS (skip)
- Long press (≥2000ms) → LONG_PRESS

## Platform Support

* Plugin supports Windows 10+ and macOS 12+
* Stream Deck software version 6.5+ required
* No external npm audio deps; Windows uses a resident PowerShell host, macOS uses `afplay`.

## Documentation

* **README.md**: User-facing documentation and installation guide
* **AGENTS.md**: Guidelines for AI agents working with this codebase
* **ARCHITECTURE.md** (this file): Technical architecture and implementation details
* **plans/**: Detailed feature documentation and implementation notes
