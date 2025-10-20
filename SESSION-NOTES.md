Date: 2025-10-10

Decisions
- Treat `enableSound` as enabled only when explicitly true/'true' in PI and Plugin.
- Update PI to immediately reflect checkbox changes in UI and robustly disable dependent controls.

Rationale
- On initial load, `enableSound` can be undefined; prior logic defaulted to enabled, causing controls to appear active while checkbox was unchecked.
- Users expect instant UI feedback without waiting for didReceiveSettings echo.

Rejected Alternatives
- Rely solely on didReceiveSettings to drive UI (too latent and brittle to type coercion).

Pending Intents
- Validate on-device that `sdpi-file` and `sdpi-button` respect `disabled` attribute consistently across Stream Deck versions.
- Consider normalizing settings types on the plugin side for all boolean-like fields.

Heuristics
- For sdpi-components, default unset booleans to false in UI.
- Coerce mixed-type settings (`boolean|string`) explicitly at boundaries.

Bootstrap Snippet
- In PI: `const isEnabled = settings.enableSound === true || settings.enableSound === 'true'; updateSoundControlsState(isEnabled);`
- In Plugin: `const soundOn = settings.enableSound === true || settings.enableSound === 'true'; if (soundOn) { /* play */ }`

Date: 2025-10-10

Decisions
- Short press while running pauses/resumes; long press resets to idle.
- After a long break, auto-start work unless `pauseAtEndOfEachTimer` is true.
- Default `pauseAtEndOfEachTimer` is true.
- Represent flow with a typed state machine configured in one place.

Rationale
- Centralizing flow removes scattered conditionals and makes behavior changes simple and safe.
- Pause/resume aligns with expected timer UX and adds control without losing progress.
- Boundary pause default reduces accidental auto-advances at phase edges.

Rejected Alternatives
- Implementing via ad-hoc flags in the action (harder to evolve and test).
- Introducing a heavy external state machine dependency (adds complexity without clear benefit).

Pending Intents
- Scaffold `workflow.ts` (typed state machine + light interpreter).
- Add `workflow-controller.ts` to integrate TimerManager, DisplayGenerator, AudioPlayer, and settings persistence.
- Wire `pomodoro-timer.ts` to controller with short/long press handling and boundary pauses.
- Add PI toggle for `pauseAtEndOfEachTimer` (default on).

Heuristics
- Keep the state machine the single source of truth for transitions and guards.
- Favor small, reviewable commits that keep the app working.
- Persist only what is necessary for resume (`phase`, `cycleIndex`, `remainingTime`, `isRunning`, `endTime`).

Bootstrap Snippet
```ts
// Key press classification in action
let keyDownAt: number | null = null;
const LONG_PRESS_MS = 700;

onKeyDown: () => { keyDownAt = Date.now(); }
onKeyUp: () => {
  const dt = keyDownAt ? Date.now() - keyDownAt : 0;
  dispatch(dt >= LONG_PRESS_MS ? 'LONG_PRESS' : 'SHORT_PRESS');
  keyDownAt = null;
}
```

Date: 2025-10-10

Decisions
- Ship pause/resume on short press; long-press (>2s) reset from all states.
- Controller is single source of truth for appear/resume/completion and transitions.
- Keep default log level at DEBUG; use TRACE temporarily when diagnosing.

Rationale
- Centralizing workflow simplifies reasoning and future changes, while pause/resume improves UX.
- Robust long-press detection via watchdog avoids misclassification on key-up timing drift.

Rejected Alternatives
- Relying on key-up elapsed only for long-press (less reliable across devices).
- Continuing legacy in-action phase advancement (duplicated logic, harder to maintain).

Pending Intents
- Optional: add lightweight state transition tests.
- Optional: update README/PI Info to mention short/long press behavior.

Heuristics
- Use cached lastRemaining from ticks to snapshot pause accurately; fall back to endTime, then settings.
- Log high-level at DEBUG, chatty per-tick/UI at TRACE.

Bootstrap Snippet
```ts
// Robust long-press in action
let longPressTimer: NodeJS.Timeout | null = null;
let longPressFired = false;
const LONG_PRESS_MS = 2000;

onKeyDown: () => {
  longPressFired = false;
  clearTimeout(longPressTimer!);
  longPressTimer = setTimeout(() => { longPressFired = true; dispatch('LONG_PRESS'); }, LONG_PRESS_MS);
}
onKeyUp: () => {
  clearTimeout(longPressTimer!);
  if (!longPressFired) dispatch('SHORT_PRESS');
}
```
Date: 2025-10-10

Decisions
- Increase default `completionHoldSeconds` to 3 seconds while keeping `pauseAtEndOfEachTimer` enabled by default.

Rationale
- Longer default hold gives a clearer completion acknowledgement before the next phase begins automatically.

Rejected Alternatives
- None.

Pending Intents
- Smoke test on hardware to confirm the longer hold still feels responsive.

Heuristics
- Keep PI default values in lockstep with runtime defaults to avoid confusing first-run behavior.

Bootstrap Snippet
```ts
// Default config fragment
export const DEFAULT_CONFIG = {
  pauseAtEndOfEachTimer: true,
  completionHoldSeconds: 3
};
```
Date: 2025-10-12

Decisions
- Add double-press to skip the current (or pending) phase.
- Double-press window: 320 ms target (300–350 ms acceptable).
- When skipping: do not play completion animation or sound.
- In pausedNext, double-press skips the pending phase to the following phase.
- Always enabled (no setting).

Rationale
- Skipping phases quickly is a common need; double-press matches muscle memory and avoids adding UI clutter.
- Avoiding completion effects keeps skips fast and unambiguous.
- Consistent skip semantics from running, pausedInFlight, and pausedNext reduces cognitive load.

Rejected Alternatives
- Making the behavior configurable in settings (added complexity without clear demand yet).
- Playing completion animation/sound during skips (adds delay and blurs the distinction between completion vs skip).

Pending Intents
- Validate double-press window on physical hardware; tune if necessary.
- Consider a future PI toggle if users request turning off double-press.

Heuristics
- Keep short press semantics unchanged; reserve double-press exclusively for skip.
- Respect pauseAtEndOfEachTimer across all skip transitions.

Bootstrap Snippet
```ts
// Double-press detection (excerpt)
const DOUBLE_TAP_MS = 320;
let lastTapAt: number | null = null;
let singlePressTimer: NodeJS.Timeout | null = null;

if (lastTapAt && (Date.now() - lastTapAt) <= DOUBLE_TAP_MS) {
  clearTimeout(singlePressTimer!);
  lastTapAt = null;
  controller.doublePress(action, settings);
} else {
  lastTapAt = Date.now();
  singlePressTimer = setTimeout(() => controller.shortPress(action, settings), DOUBLE_TAP_MS + 20);
}
```
Date: 2025-10-10

Decisions
- Centralize default values in `DEFAULT_CONFIG`, relying on runtime to propagate them to UI/pipeline.

Rationale
- Avoids drift between runtime and property inspector defaults and keeps a single source of truth.

Rejected Alternatives
- Importing default literals into PI markup via build-time templating (overkill for current scale).

Pending Intents
- Observe PI load timing to ensure defaults arrive before user interaction on fresh installs.

Heuristics
- When a UI control needs a default, push it from plugin state rather than duplicating constants in markup.

Bootstrap Snippet
```ts
if (!settings.workDuration) {
  await action.setSettings({
    ...DEFAULT_CONFIG,
    ...settings,
    currentPhase: 'work',
    currentCycleIndex: 0
  });
}
```
## 2025-10-19

Decisions
- Implement reset feedback on long-press: ring flashes 3x at ~120ms cadence; double-pip sound plays when `enableSound` is true.
- Use a single bundled WAV `reset-double-pip.wav` (license must allow redistribution) placed under `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/assets/sounds/`.

Rationale
- Clear tactile confirmation on destructive reset; aligns with existing audio/visual design.
- Keeps complexity low by reusing current rendering/audio utilities.

Pending Intents
- Add/confirm a properly licensed `reset-double-pip.wav` asset.

Heuristics
- Prefer async port action so transition waits for feedback before entering `idle`.

Bootstrap Snippet
- If audio is not heard on reset: ensure `enableSound` is on and the WAV exists at `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/assets/sounds/reset-double-pip.wav`.

## 2025-10-19 (Later)

Decisions
- Audio latency on Windows (~500–1000 ms) persists across plays; cause is per‑play process startup (PowerShell/.NET SoundPlayer via node-wav-player).
- Interim: proceed with reset feature; accept current latency while we evaluate a persistent audio subprocess driver for Windows.
- For diagnostics, temporarily:
  - Disabled reset ring flash to isolate audio timing.
  - Played the double‑pip on every key press to confirm consistent latency.

Rationale
- Spawn-based playback adds fixed startup overhead each play on Windows; macOS `afplay` is generally fast.
- Persistent subprocess (single long‑lived PowerShell host) should eliminate most of the per‑play delay without new npm deps.

Rejected Alternatives
- Pre‑warm single play on startup: ineffective because each subsequent play spawns again.
- Switching to native addons now: adds build complexity; deferring until needed.

Pending Intents
- Implement `AudioDriver` abstraction with Windows persistent subprocess; keep macOS on `afplay` for now.
- Re‑enable reset ring flash and add a small UI sync delay (e.g., 200–300 ms) only if needed after persistent driver.
- Remove experimental keypress double‑pip once latency solution is in place.

Heuristics
- Keep audio non‑blocking; schedule UI updates via timers to avoid serializing event loop.
- Add fallback to current player if driver init fails.

Bootstrap Snippet
```ts
// Driver interface sketch
interface AudioDriver { init(): Promise<void>; play(path: string): Promise<void>; stop(): void; dispose(): void; }
// Windows driver: spawn persistent PowerShell host, read stdin lines (PLAY/STOP), call SoundPlayer.Load/Play.
```
