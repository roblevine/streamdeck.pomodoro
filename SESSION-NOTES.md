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
