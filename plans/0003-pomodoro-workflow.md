# Pomodoro Workflow State Machine

Status: Complete
Date: 2025-10-10

Decisions (Locked)
- Short press while running pauses/resumes.
- Long press while running resets to idle.
- After long break, auto-start work unless pauseAtEndOfEachTimer is true.
- Default pauseAtEndOfEachTimer: true.

Goals
- Centralize Pomodoro flow as a typed state machine configured in one place.
- Support mid-timer pause/resume and long-press reset while keeping current modules.
- No new dependencies; TypeScript-only.
- Preserve persistence/resume behavior.

States
- `idle`: shows full work timer; awaits short press to start.
- `workRunning`: active work timer.
- `pausedInFlight`: paused mid-timer for current phase.
- `workComplete`: boundary after work completion (sound, compute next).
- `shortBreakRunning`: active short break timer.
- `shortBreakComplete`: boundary after short break.
- `longBreakRunning`: active long break timer.
- `longBreakComplete`: boundary after long break.
- `pausedNext`: boundary pause awaiting confirmation to start computed next phase.

Events
- `APPEAR`, `DISAPPEAR`.
- `SHORT_PRESS`, `LONG_PRESS`.
- `TIMER_DONE`.
- `SETTINGS_CHANGED`.

Guards
- `pauseAtEnd`: settings.pauseAtEndOfEachTimer.
- `longBreakDue`: (cycleIndex + 1) >= cyclesBeforeLongBreak.

Actions
- Display: `showFull(phase)`, `updateRunning(remaining,total,phase)`.
- Timer: `startTimer(phase,durationSec,onDone)`, `stopTimer()`, `resumeTimer(remainingSec)`.
- Audio: `playWorkEnd()`, `playBreakEnd()`.
- Context: `setPhase(phase)`, `setPendingNext(phase)`, `incCycle()`, `resetCycle()`, `saveRemaining()`, `clearRemaining()`.

Phase Flow (Happy Path)
1. `idle.onEnter` → `showFull('work')`.
2. Short press in `idle` → `workRunning.onEnter` → `startTimer('work')`.
3. `workRunning.TIMER_DONE` → `workComplete` → play sound; set `pendingNext = longBreak|shortBreak`; `incCycle()`.
4. If `pauseAtEnd` → `pausedNext` showing full upcoming phase; else auto-advance to the corresponding `*Running` state.
5. Break completes → boundary state → `workRunning` (or `pausedNext` if `pauseAtEnd`).
6. Long break completes → `resetCycle()` then `workRunning` (or `pausedNext` if `pauseAtEnd`).

Short Press / Long Press
- While running: short press → `pausedInFlight` (stop, save remaining). Short press again → resume to prior `*Running`. Long press → reset to `idle`.
- Boundary states (`*Complete`, `pausedNext`): short press advances; long press resets to `idle`.

Timer Management
- Pause: compute remaining from `endTime` or last tick; stop timer; persist `remainingTime`; `isRunning=false`.
- Resume: start with saved remaining; set `isRunning=true`; recompute `endTime`.
- Boundary pause: show full upcoming phase; do not start timer until short press.

Display
- Running: donut reflects remaining/total; urgency colors.
- Paused mid-timer: show remaining and phase color with `isRunning=false`.
- Boundary pause: show full upcoming phase time.

Audio
- On completion: work → `workEndSoundPath`; break → `breakEndSoundPath`, when enabled.
- No sounds on pause/resume/reset.

Settings & Defaults
- Add `pauseAtEndOfEachTimer` (default true).
- Keep existing durations and `cyclesBeforeLongBreak`.
- Persist: `currentPhase`, `currentCycleIndex`, `remainingTime`, `isRunning`, `endTime`.

Persistence & Resume
- On appear: if `isRunning` and `endTime>now` → resume running; if expired → dispatch `TIMER_DONE`; if paused with `remainingTime` → `pausedInFlight`/`pausedNext`; else `idle`.

Integration Plan
1. Add `lib/workflow.ts` (config + light interpreter) with states/events/guards/actions.
2. Add `lib/workflow-controller.ts` to implement Ports using `TimerManager`, `DisplayGenerator`, `AudioPlayer`, and to persist settings via `Action.setSettings`.
3. Update `actions/pomodoro-timer.ts` to delegate:
   - `onWillAppear` → controller.onAppear
   - `onWillDisappear` → controller.cleanup
   - `onKeyDown/onKeyUp` → detect short vs long press, dispatch `SHORT_PRESS`/`LONG_PRESS`
   - `onDidReceiveSettings` → controller.onSettingsChanged
   - Timer callbacks → dispatch `TIMER_DONE`
4. Keep `PomodoroCycle.getNextPhase` or fold into workflow; prefer reuse for consistency.
5. Add `pauseAtEndOfEachTimer` to settings and PI (PI wiring can be a follow-up slice).

Testing Plan
- Harness tests for transitions: work→short/long break, boundary gating, pause/resume, long-press reset.
- Manual verification with emulator/hardware; confirm display, audio, resume.

Logging
- Add debug logs in controller for press classification, transitions, and guard decisions.

Acceptance Criteria
- Short press pauses/resumes; long press resets.
- Auto-advance between phases; honors boundary pause (default true).
- Long break every N work blocks; after long break, cycle resets; work auto-starts unless boundary pause.
- State persists and resumes correctly; no regressions to display/audio.

Progress
- Scaffolded typed workflow engine (lib/workflow.ts).
- Added WorkflowController with ports to TimerManager/Display/Audio (lib/workflow-controller.ts).
- Routed SHORT_PRESS/LONG_PRESS through controller; TIMER_DONE dispatched from ports.
- Action now classifies short vs long press and delegates to controller; controller initialized on appear.

Completion Summary
- Pause/resume on short press implemented and verified.
- Long-press reset (>2s) implemented from all states with watchdog.
- Appear/resume/expiry handled by controller/workflow; legacy paths removed.
- Boundary pause honored (pauseAtEndOfEachTimer, default true).
- PI toggle for pauseAtEndOfEachTimer added and persisted.
- Debug/trace logging added across inputs, workflow, and timers; default level set back to DEBUG.

Post-Completion Notes
- Optional next: lightweight transition tests and small README/PI doc updates for short/long press behavior.
 - Config vs State separation applied: PI config persists; runtime (phase, remaining, running) is in-memory only and resets on long-press or deletion.
 - In-session resume across appear/disappear without persisting runtime to settings.
 - Color scheme simplified (blue work, dark green short break, light green long break). Completion hold added with spinning dashed ring; runs concurrently with sounds and extends hold if needed.
