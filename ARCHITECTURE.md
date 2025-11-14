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
│       ├── audio-driver/            # Audio driver implementations
│       │   ├── driver.ts            # AudioDriver interface and factory
│       │   ├── windows-persistent.ts # Windows PowerShell driver
│       │   └── macos-system.ts      # macOS/Linux afplay/aplay driver
│       ├── audio-player.ts          # AudioPlayer facade
│       ├── defaults.ts              # Default configuration values
│       ├── display-generator.ts     # SVG generation for button display
│       ├── message-handlers/         # Property Inspector message handlers
│       │   ├── preview-sound-handler.ts # Preview button handler
│       │   └── stop-sound-handler.ts    # Stop sound handler
│       ├── plugin-message-observer.ts # Message routing pattern
│       ├── pomodoro-cycle.ts        # Pomodoro cycle state management
│       ├── timer-manager.ts         # Timer lifecycle management
│       ├── workflow.ts              # State machine definition (354 lines)
│       └── workflow-controller.ts   # Workflow controller (ports implementation)
├── plans/
│   ├── 0001-audio-notifications.md # Audio feature implementation
│   ├── 0002-preview-button-toggle.md # Preview/stop button feature
│   ├── 0003-pomodoro-workflow.md   # Workflow state machine
│   ├── 0004-double-press-skip.md   # Double-press skip feature
│   ├── 0005-shared-global-timer.md # Proposed shared timer (not implemented)
│   ├── 0006-reset-feedback.md      # Reset feedback implementation
│   └── 0007-documentation-remediation.md # Documentation improvement plan
├── scripts/
│   └── generate-sounds.mjs          # Build-time sound asset generation
└── uk.co.roblevine.streamdeck.pomodoro.sdPlugin/
    ├── manifest.json                # Stream Deck plugin metadata and action definitions
    ├── bin/plugin.js                # Built plugin code (generated)
    ├── assets/sounds/               # Audio assets (generated at build)
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

### Message Handler Pattern

The plugin uses an observable pattern to route Property Inspector messages to specific handlers:

**Architecture Components**

- `PluginMessageObserver`: Central message dispatcher with handler registration
- Message handlers: Individual functions in `lib/message-handlers/` that handle specific message types
- Type-safe message interfaces: Defined in `types/messages.ts`

**Message Flow**

1. Property Inspector sends message via WebSocket (`sendToPlugin()`)
2. Action's `onSendToPlugin()` receives message and forwards to `PluginMessageObserver`
3. Observer dispatches to all registered handlers for that message type
4. Handlers execute (can be async), perform actions, and send responses back to Property Inspector
5. Observer sends response via `sendToPropertyInspector()`

**Handler Registration**

Handlers are registered at action initialization:

```typescript
messageObserver.registerHandler('previewSound', (ctx, msg) =>
    handlePreviewSound(ctx, msg, messageObserver)
);
messageObserver.registerHandler('stopSound', (ctx, msg) =>
    handleStopSound(ctx, msg, messageObserver)
);
```

**Current Handlers**

- `preview-sound-handler`: Plays audio preview and sends playback status messages (`playbackStarted`, `playbackStopped`)
- `stop-sound-handler`: Stops audio playback and notifies Property Inspector

**Benefits**

- Separation of concerns: Message routing separated from handler logic
- Extensibility: New message types added by registering additional handlers
- Error isolation: Handler exceptions don't crash the action; logged via Stream Deck logger
- Type safety: TypeScript interfaces for all message payloads
- Testability: Handlers are pure functions that can be tested independently

**Implementation Files**

- `lib/plugin-message-observer.ts`: Observer pattern implementation
- `lib/message-handlers/preview-sound-handler.ts`: Preview audio handler
- `lib/message-handlers/stop-sound-handler.ts`: Stop audio handler
- `types/messages.ts`: Message type definitions

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

The plugin provides cross-platform audio playback with no external npm dependencies, using OS-specific system commands via a driver abstraction.

**Driver Architecture**

The audio subsystem uses a driver pattern to abstract platform differences:

- `AudioDriver` interface: Defines `init()`, `play(filePath)`, `stop()`, `dispose()` methods
- `AudioPlayer` facade: Singleton that manages driver lifecycle and playback state
- `createAudioDriver()` factory: Selects appropriate driver based on `process.platform`

**Platform-Specific Drivers**

**Windows: `WindowsPersistentDriver`**
- Spawns a persistent PowerShell subprocess on first play
- PowerShell script keeps `System.Media.SoundPlayer` resident in memory
- Accepts commands via stdin: `PLAYB64 <base64-path>`, `STOP`, `EXIT`
- Low-latency playback: eliminates per-play process startup overhead (~500-1000ms saved)
- Disposed on plugin shutdown via `EXIT` command

**macOS: `MacOsSystemDriver`**
- Uses `afplay` system command per play (spawned on demand)
- Fast enough without persistence (~50-100ms startup)
- Stopped via `SIGKILL` signal to child process
- Simple implementation: no initialization required

**Linux: `MacOsSystemDriver` (with `aplay`)**
- Reuses macOS driver implementation with `aplay` command
- Basic fallback: environment-dependent (requires ALSA utilities)
- Same spawn-per-play approach as macOS
- Not extensively tested; best-effort support

**Features**

* Configurable WAV files for work completion and break completion
* Preview buttons in Property Inspector for testing sounds
* Enable/disable toggle for audio notifications
* Key-click sound on button press (respects Enable Sound setting)
* Silent WAV priming on startup to initialize audio driver
* Build-time generation of CC0-licensed sound assets (see `scripts/generate-sounds.mjs`)

**Driver Lifecycle**

- Driver created on first `AudioPlayer.play()` call (lazy initialization)
- Driver initialization is asynchronous; `play()` waits for `init()` to complete
- Driver persists for plugin lifetime (Windows) or per-play (macOS/Linux)
- Driver disposed on plugin shutdown via process exit/signal handlers in `plugin.ts`

**Implementation Files**

- `lib/audio-player.ts`: AudioPlayer facade and playback state management
- `lib/audio-driver/driver.ts`: AudioDriver interface and factory function
- `lib/audio-driver/windows-persistent.ts`: Windows PowerShell persistent driver
- `lib/audio-driver/macos-system.ts`: macOS afplay / Linux aplay driver

See `plans/0001-audio-notifications.md` for detailed design decisions and evolution notes.

### Visual Feedback

- Dynamic SVG-based donut progress indicator
- Static color scheme:
  - Blue: work, Dark Green: short break, Light Green: long break
- Paused mid-timer: ring blinks phase/red
- Completion: spinning dashed white ring with "Done" during configurable hold; sound and animation run concurrently
- Time display in MM:SS; updates every second during countdown

## State Management

The plugin maintains two types of state: persisted configuration and ephemeral runtime state.

### Config vs Runtime

**ConfigSettings** (persisted via Stream Deck)
- Stored via `action.setSettings()` and retrieved via `action.getSettings()`
- Persisted to Stream Deck's profile storage (survives plugin restarts, profile switches)
- Updated when user changes values in Property Inspector
- Fields: `workDuration`, `shortBreakDuration`, `longBreakDuration`, `cyclesBeforeLongBreak`, `pauseAtEndOfEachTimer`, `enableSound`, `workEndSoundPath`, `breakEndSoundPath`, `completionHoldSeconds`

**RuntimeState** (in-memory only)
- Lives only in action instance memory (not persisted via `setSettings()`)
- Reset when action is deleted from Stream Deck button
- Preserved during profile switches or temporary disappearance (page navigation)
- Fields: `phase` (current phase: work/shortBreak/longBreak), `cycleIndex` (current cycle count), `running` (timer active), `remaining` (seconds left if paused mid-timer), `pendingNext` (next phase when in pausedNext state)

**Context (Ctx)**
- Combined view: `Ctx = RuntimeState + ConfigSettings`
- Passed to workflow state machine and ports for decision-making
- Workflow reads both config and runtime to determine transitions

### Persistence Mechanism

**Stream Deck SDK**
- Settings persisted via `action.setSettings(settings)` (async)
- Settings retrieved via `action.getSettings()` (async)
- Stored in Stream Deck profile JSON (per action instance, per button)
- Survive plugin restarts, Stream Deck restarts, profile switches

**Default Values**
- Centralized in `lib/defaults.ts` as `DEFAULT_CONFIG`
- Applied on first `onWillAppear` when settings object is empty or missing keys
- Property Inspector uses same defaults for initial UI state
- Example defaults: workDuration='25:00', pauseAtEndOfEachTimer=true, enableSound=false

**Runtime State**
- Stored in `Map<string, WorkflowController>` keyed by action context ID
- Controller holds workflow instance with current runtime state
- Not persisted; action deletion destroys controller and runtime state
- Long-press reset clears runtime state (sets to idle/work/cycle 0)

### Lifecycle

**onWillAppear (fresh)**
- No existing controller for this context
- Load settings via `getSettings()`, merge with `DEFAULT_CONFIG`
- Initialize new `WorkflowController` with neutral runtime state (pausedNext/work, cycle 0)
- Render full display for work phase

**onWillAppear (existing)**
- Controller already exists for this context (action previously appeared, then disappeared)
- Rebind action reference to controller
- Re-render current state without restarting timers or resetting runtime
- Preserves in-session progress across page/profile switches

**onWillDisappear**
- Action hidden (page switch, profile change)
- No cleanup performed to retain in-session state
- Controller and runtime state remain in memory
- Timer continues running in background (will fire completion even while hidden)

**Action Deletion**
- User removes action from button in Stream Deck
- Action context destroyed
- Controller removed from map, garbage collected
- Runtime state lost (next placement starts fresh)
- ConfigSettings remain in Stream Deck profile (can be recovered if action re-added to same button)

**Note**: "Deletion" means removing action from Stream Deck button; "Disappear" means temporary hiding (page switch). Only deletion clears runtime state.

## Workflow State Machine

The plugin uses a dependency-free state machine (`lib/workflow.ts`) to manage Pomodoro cycle transitions, timer lifecycle, and user inputs. The state machine separates business logic from Stream Deck SDK concerns.

### States

**Idle State**
- `idle`: Initial state; shows full work ring; ready to start first work session

**Running States** (timer actively counting down)
- `workRunning`: Work session in progress
- `shortBreakRunning`: Short break in progress
- `longBreakRunning`: Long break in progress

**Paused States**
- `pausedInFlight`: Timer paused mid-countdown; preserves remaining time; ring blinks phase color/red
- `pausedNext`: Waiting at phase boundary for user to start next phase (when `pauseAtEndOfEachTimer` is enabled)

**Completion States** (animation + sound playing)
- `workComplete`: Work session finished; playing completion effects; increments cycle; determines next break type
- `shortBreakComplete`: Short break finished; playing completion effects
- `longBreakComplete`: Long break finished; playing completion effects; resets cycle index

### Events

**User Input Events**
- `SHORT_PRESS`: Pause/resume or start pending phase
- `DOUBLE_PRESS`: Skip current/pending phase without completion effects
- `LONG_PRESS`: Reset to idle with feedback (≥2000ms)

**System Events**
- `TIMER_DONE`: Timer countdown reached zero
- `COMPLETE_ANIM_DONE`: Completion animation and sound finished playing
- `APPEAR`: Action appeared on Stream Deck (not currently used for transitions)
- `DISAPPEAR`: Action disappeared from view (not currently used for transitions)
- `SETTINGS_CHANGED`: Configuration updated via Property Inspector (not currently used for transitions)

### Key Transitions

**Starting Timers**
- `idle` + SHORT_PRESS → `workRunning`
- `pausedNext` + SHORT_PRESS → start pending phase (work/short/long break running)
- `pausedInFlight` + SHORT_PRESS → resume to appropriate running state based on `ctx.phase`

**Pausing**
- Any running state + SHORT_PRESS → `pausedInFlight` (stops timer, preserves remaining time)

**Skipping (Double-Press)**
- Running/paused work + DOUBLE_PRESS → next break (short or long based on cycle)
- Running/paused break + DOUBLE_PRESS → work
- Respects `pauseAtEndOfEachTimer`: lands on `pausedNext` or auto-starts next phase
- Increments/resets cycle index appropriately
- No completion effects

**Completion Flow**
- Running state + TIMER_DONE → completion state (work/short/long break complete)
- Completion state: runs animation + sound in parallel, dispatches COMPLETE_ANIM_DONE when done
- Completion state + COMPLETE_ANIM_DONE → `pausedNext` (if pausing enabled) or auto-start next phase

**Resetting**
- Any state + LONG_PRESS → `idle` (stops timers, resets cycle, shows reset feedback)

### Guards and Conditions

**Guards** control which transition is taken when multiple options exist:

- `pauseAtEnd`: Checks if `pauseAtEndOfEachTimer` setting is enabled (default: true)
- `longBreakDue`: Checks if `(cycleIndex + 1) >= cyclesBeforeLongBreak`
- Phase checks: `ctx.phase === 'work'` / `'shortBreak'` / `'longBreak'`
- Pending phase checks: `ctx.pendingNext === 'work'` / `'shortBreak'` / `'longBreak'`

Transitions are evaluated in order; first matching guard wins.

### Port Interface

The state machine communicates with the outside world via the `Ports` interface (implemented by `WorkflowController`):

**Display Ports**
- `showFull(phase, durationSec)`: Render full donut ring for a phase
- `updateRunning(remainingSec, totalSec, phase)`: Update countdown display while running
- `showPaused(remainingSec, totalSec, phase)`: Show paused state with blinking ring
- `showCompletionWithSound(kind, durationMs)`: Play completion animation + sound; dispatch COMPLETE_ANIM_DONE when done
- `showResetFeedback()`: Flash ring 3x and play double-pip sound

**Timer Ports**
- `startTimer(phase, durationSec, onDone)`: Start countdown; call `onDone` when complete (dispatches TIMER_DONE)
- `stopTimer()`: Stop active countdown

This port-based design allows the state machine to remain pure (no direct dependencies on Stream Deck SDK, audio player, or display generator).

### Implementation Files

- `lib/workflow.ts` (354 lines): State machine definition, states, events, transitions, guards
- `lib/workflow-controller.ts`: Implements Ports interface; bridges state machine and Stream Deck action
- `actions/pomodoro-timer.ts`: Detects user inputs (short/double/long press); dispatches events to controller

See `plans/0003-pomodoro-workflow.md` for detailed design decisions and implementation notes.

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
