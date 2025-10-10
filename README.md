# Pomodoro Timer - Stream Deck Plugin

A feature-rich Pomodoro timer plugin for Elgato Stream Deck, built with TypeScript and Node.js.

## Features

- **Pomodoro Cycle Management**: Full Pomodoro technique support with work periods, short breaks, and long breaks
- **Configurable Durations**: Customize work, short break, and long break durations (default: 25:00 work, 5:00 short break, 15:00 long break)
- **Automatic Phase Transitions**: Automatically advances through work → short break → work → long break cycle
- **Visual Countdown Display**: Dynamic donut-style circular progress indicator that depletes as time runs out
- **Color-Coded States**:
  - 🔵 Blue: Timer stopped/ready
  - 🟢 Green: Timer running (>25% remaining)
  - 🟠 Orange: Warning state (<25% remaining)
  - 🔴 Red: Critical state (<10% remaining)
- **Audio Notifications**: Configurable sound alerts when work periods and breaks complete
  - Custom WAV file support
  - Separate sounds for work completion and break completion
  - Preview buttons to test sounds before use
  - Enable/disable toggle
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

- **Work Duration**: Set work period length in mm:ss format (default: 25:00)
- **Short Break Duration**: Set short break length in mm:ss format (default: 5:00)
- **Long Break Duration**: Set long break length in mm:ss format (default: 15:00)
- **Cycles Before Long Break**: Number of work/short break cycles before a long break (default: 4)
- **Enable Sound**: Toggle audio notifications on/off
- **Work End Sound**: Select a WAV file to play when work periods complete (with preview button)
- **Break End Sound**: Select a WAV file to play when breaks complete (with preview button)

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
│   ├── actions/
│   │   └── pomodoro-timer.ts               # Pomodoro timer action
│   └── lib/
│       ├── audio-player.ts                 # Cross-platform audio playback
│       ├── display-generator.ts            # SVG generation for button display
│       ├── pomodoro-cycle.ts               # Pomodoro cycle state management
│       └── timer-manager.ts                # Timer lifecycle management
├── plans/
│   └── audio-notifications.md              # Audio feature documentation
└── uk.co.roblevine.streamdeck.pomodoro.sdPlugin/
    ├── manifest.json                       # Plugin metadata
    ├── bin/plugin.js                       # Compiled plugin (generated)
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

## License

(License information to be added)
