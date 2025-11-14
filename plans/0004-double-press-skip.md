# Double-Press to Skip Phase

Status: Implemented
Date: 2025-10-12

Decisions (Locked)
- Double-press window: 320ms (two taps within 320ms are detected as double-press).
- PausedNext behavior: double-press skips the pending phase.
- Skipping never plays completion animation or sound.
- Always enabled (no setting for this behavior).

Goals
- Allow users to double-press the key to skip the current phase (or pending phase) and jump to the next logical phase in the Pomodoro cycle.
- Preserve existing short-press pause/resume and long-press reset behaviors.
- Keep logic centralized in the workflow state machine.

Scope
- Input classification in action: single vs double vs long press.
- New workflow event and transitions for skipping without completion effects.
- Minor Property Inspector doc text update.

User Experience
- Single press: pause/resume as today.
- Long press (≥2000ms): reset to idle as today.
- Double-press: skip current phase. If running, the timer stops immediately, no completion effects.
  - Work → next is short or long break per cycle; cycle index increments.
  - Short/Long Break → next is Work; long break skip resets cycle index.
  - Paused mid-timer → same skip rules (no completion effects).
  - PausedNext → skip the pending phase to the following one (per decision above).
  - In all cases, honor pauseAtEndOfEachTimer: either land on pausedNext or auto-start into the running state of the next phase.

Design
- Action (`actions/pomodoro-timer.ts`):
  - Add `DOUBLE_TAP_MS = 320`, `lastTapAt`, and `singlePressTimer`.
  - Delay dispatch of SHORT_PRESS slightly to see if a second tap arrives; on second tap within the window, cancel the pending single and dispatch DOUBLE_PRESS via controller.
  - Keep existing long-press watchdog; double-press only applies to short presses.
- Workflow (`lib/workflow.ts`):
  - Add `DOUBLE_PRESS` to the event union.
  - For running states (`workRunning`, `shortBreakRunning`, `longBreakRunning`): add `DOUBLE_PRESS` transitions to stop the timer and advance without completion effects. Respect pauseAtEnd.
  - For `pausedInFlight`: add `DOUBLE_PRESS` to advance as above (no timer to stop).
  - For `pausedNext`: double-press skips pending to the following phase; if pauseAtEnd, stay in `pausedNext` for the following; otherwise start it.
- Controller (`lib/workflow-controller.ts`):
  - Add `doublePress(...)` method to dispatch `DOUBLE_PRESS` with current settings.

Edge Cases & Notes
- Double-press timing can introduce up to ~340 ms latency for single-press actions; acceptable trade-off.
- Skipping work increments cycle index; skipping long break resets cycle index.
- No completion animation or sound for skips by design.

Acceptance Criteria
- Double-press advances phases per above rules from running, paused-in-flight, and paused-next states.
- Single press and long press behaviors unchanged.
- Pause-at-end respected for all skip paths.
- PI text updated to mention double-press.

Manual Test Plan
1. Work running → double-press: stops, goes to short/long break per cycle; pauseAtEnd gates start.
2. Short break running → double-press: stops, goes to work; pauseAtEnd gates start.
3. Long break running → double-press: stops, resets cycle index, goes to work; pauseAtEnd gates start.
4. PausedInFlight (any phase) → double-press: advances as above, no completion effects.
5. PausedNext with pending work → double-press: computes following break (inc cycle) and either shows pausedNext or starts it.
6. PausedNext with pending short/long break → double-press: goes to work (reset cycle for long); pauseAtEnd gates start.
7. Single press still pause/resumes; long-press (≥2000ms) still resets.

Implementation Checklist
- [x] Action: add double-tap detection and dispatch.
- [x] Workflow: add DOUBLE_PRESS event and transitions.
- [x] Controller: add doublePress method.
- [x] PI: doc text update.
- [x] Manual verification.
