# Pomodoro Timer - Stream Deck Plugin

A feature-rich Pomodoro timer plugin for Elgato Stream Deck, built with TypeScript and Node.js.

## Features

- **Configurable Timer Duration**: Set custom timer lengths (default: 5 minutes)
- **Visual Countdown Display**: Dynamic donut-style circular progress indicator that depletes as time runs out
- **Color-Coded States**:
  - 🔵 Blue: Timer stopped/ready
  - 🟢 Green: Timer running (>25% remaining)
  - 🟠 Orange: Warning state (<25% remaining)
  - 🔴 Red: Critical state (<10% remaining)
- **Start/Stop Control**: Press the button to start or stop the timer
- **Persistent State**: Timer state persists even when the action is hidden or Stream Deck restarts
- **Time Display**: Shows remaining time in MM:SS format

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
2. **Start Timer**: Press the button to start the countdown
3. **Stop Timer**: Press again to stop and reset
4. **Timer Complete**: When time expires, the button shows "Done!" with an alert

### Configuration

Click on the Pomodoro Timer button in Stream Deck to open the Property Inspector and configure:

- **Timer Duration**: Set custom duration in seconds (e.g., 1500 for 25 minutes)

## Development

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

### Project Structure

```
roblevine/
├── src/
│   ├── plugin.ts                           # Main entry point
│   └── actions/
│       ├── increment-counter.ts            # Example counter action
│       └── pomodoro-timer.ts               # Pomodoro timer implementation
└── uk.co.roblevine.streamdeck.pomodoro.sdPlugin/
    ├── manifest.json                       # Plugin metadata
    ├── bin/plugin.js                       # Compiled plugin (generated)
    └── ui/
        ├── increment-counter.html          # Counter settings UI
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

## License

(License information to be added)
