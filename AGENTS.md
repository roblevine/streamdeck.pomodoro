# Agent Guidelines

This file provides comprehensive guidance for AI Agents (Claude, GitHub Copilot, Cursor, Windsurf, OpenAI Codex, etc.) working with this Stream Deck Pomodoro plugin.

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

## Documentation Navigation

### Primary Documentation
1. **Project Overview**: Start with [README.md](README.md) for understanding project goals and structure
2. **Technical Details**: Refer to [ARCHITECTURE.md](ARCHITECTURE.md) for design patterns and service structure
3. **Development Process**: Use [DEVELOPMENT.md](DEVELOPMENT.md) for workflow and operational guidance
4. **Current Work**: Check [TODO.md](TODO.md) for ongoing tasks and project status
5. **[plans/](plans/)**: Detailed document of implementation plans and architectural decision records for major features - as referenced in TODO.md
6. **[SESSION-NOTES.md](SESSION-NOTES.md)**: Log of session notes capturing decisions, rationale, and heuristics to maintain context across stateless interactions

## Development Methodology

### Maintaining Session Notes
To preserve conversational nuance across stateless sessions, maintain `SESSION-NOTES.md`:
* Append a dated block per session (categories: Decisions, Rationale, Rejected Alternatives, Pending Intents, Heuristics, Bootstrap Snippet).
* After adding a Decision here, reflect stable ones in the appropriate plan or architecture file during the same or next commit.
* Use the latest Bootstrap Snippet when starting a fresh chat to rehydrate context quickly.
* Periodically compress older entries (e.g. older than 21 sessions) into plan revision history and prune them from the notes file.
* Do NOT store sensitive data or credentials; this file is purely for modeling narrative and intent continuity.

### Core behaviours
- At the beginning of every session, ensure you have read the documents referenced above.
- Begin replies with "Hi Rob!". 
- Default mode is Propose-Only: do not make code edits, create files, or run commands without explicit approval.
- Allowed without approval: read-only actions (read/search code/docs, summarize findings, propose todos/plan).
- Implementation occurs only after explicit approval (“Proceed”, “Implement”, “Approved”) from Rob.
- If approval is unclear or not given, do not proceed.
- After approval: restate the plan (edits, tests, commands), execute, and report results.
- Conventional Commits: Use conventional commit messages for all changes (e.g. feat, fix, docs, chore)

### Core Workflow: Analyse → Plan → Execute → Review
1. **Analyse**: Break down requirements, understand existing codebase context
2. **Plan**: Document approach in a plan file, in the plans folder
3. **Execute**: Implement in small, testable increments with comprehensive tests
4. **Review**: Verify functionality, update documentation, ensure no regressions

### Working Agreements
- **Dependency Approval**: Always discuss before adding new packages or frameworks
- **Clarification First**: Ask questions when multiple approaches are possible
- **Incremental Delivery**: Deliver features in small, reviewable, testable slices
- **Consistency**: Maintain existing patterns and coding styles throughout the codebase
- **Keeps documentation up to date**: Ensure all changes are reflected in relevant documentation, but always seek approval before making changes