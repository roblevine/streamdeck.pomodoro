# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stream Deck plugin for a Pomodoro timer, built using the Elgato Stream Deck SDK. The plugin is written in TypeScript and uses Node.js 20 runtime.

**Plugin ID**: `uk.co.roblevine.streamdeck.pomodoro`
**Current Actions**: Counter (increment counter example action)

## Build System

- **Build tool**: Rollup with TypeScript
- **Build**: `npm run build`
- **Watch mode**: `npm run watch` (automatically restarts Stream Deck plugin on changes)

The build process:
- Compiles TypeScript from `src/`
- Outputs to `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/bin/plugin.js`
- Uses terser for minification in production builds
- Generates sourcemaps in watch mode for debugging

## Project Structure

```
roblevine/
├── src/
│   ├── plugin.ts                    # Main entry point - registers actions and connects to Stream Deck
│   └── actions/
│       └── increment-counter.ts     # Example action (to be replaced with Pomodoro functionality)
└── uk.co.roblevine.streamdeck.pomodoro.sdPlugin/
    ├── manifest.json                # Stream Deck plugin metadata and action definitions
    ├── bin/plugin.js                # Built plugin code (generated)
    └── ui/
        └── increment-counter.html   # Property inspector UI for action settings
```

## Stream Deck SDK Architecture

### Action Registration Pattern
Actions extend `SingletonAction<SettingsType>` and use the `@action` decorator:
- `UUID` in decorator must match the action's UUID in `manifest.json`
- Actions have persistent settings stored via `setSettings()`/`getSettings()`
- Common lifecycle events: `onWillAppear`, `onKeyDown`, `onKeyUp`, `onDialRotate`, etc.

### Key Files
- **plugin.ts**: Registers all actions and establishes Stream Deck connection
- **manifest.json**: Defines plugin metadata, actions, icons, OS compatibility, and Node.js version
- **Property Inspector**: HTML files in `ui/` directory provide settings UI using Stream Deck's `sdpi-components`

### Logging
The SDK logger is set to `TRACE` level in development to capture all Stream Deck communication.

## TypeScript Configuration

- Extends `@tsconfig/node20`
- ES2022 modules with Bundler resolution
- Compiles all `.ts` files in `src/`

## Development Workflow

1. Make changes to TypeScript files in `src/`
2. If in watch mode, plugin automatically rebuilds and restarts
3. To manually test: build and use Stream Deck application to test actions
4. Property inspector changes require editing HTML in `ui/` directory

## Notes

- The current "Counter" action is a template example
- Pomodoro timer functionality needs to be implemented
- Plugin supports Windows 10+ and macOS 12+
- Stream Deck software version 6.5+ required