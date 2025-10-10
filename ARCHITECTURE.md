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

The SDK logger is set to `TRACE` level in development to capture all Stream Deck communication. Logs can be viewed at:

* **macOS**: `~/Library/Logs/ElgatoStreamDeck/StreamDeck.json` (JSON format for debugging WebSocket messages)
* **Plugin-specific logs**: Would appear at `~/Library/Logs/ElgatoStreamDeck/uk.co.roblevine.streamdeck.pomodoro.sdPlugin/logs/` if created

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

* Work periods, short breaks, and long breaks
* Automatic phase transitions
* Configurable cycle parameters (durations, cycles before long break)
* State persists across Stream Deck restarts

### Audio Notifications

* Cross-platform audio playback using native system commands
* Configurable WAV files for work completion and break completion
* Preview buttons in Property Inspector for testing sounds
* Enable/disable toggle for audio notifications
* See `plans/audio-notifications.md` for detailed implementation

### Visual Feedback

* Dynamic SVG-based donut progress indicator
* Color-coded states (blue/green/orange/red)
* Time display in MM:SS format
* Updates every second during countdown

## Platform Support

* Plugin supports Windows 10+ and macOS 12+
* Stream Deck software version 6.5+ required
* Audio implementation uses platform-specific commands (afplay/PowerShell/aplay)

## Documentation

* **README.md**: User-facing documentation and installation guide
* **AGENTS.md**: Guidelines for AI agents working with this codebase
* **ARCHITECTURE.md** (this file): Technical architecture and implementation details
* **plans/**: Detailed feature documentation and implementation notes
