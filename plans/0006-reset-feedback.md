# Reset Feedback (Ring Flash + Double Pip)

Status: Implemented
Date: 2025-10-19

Decisions (Locked)
- Trigger on long-press reset (>2s) only.
- Ring flashes several times (3 flashes) at ~120ms on/off cadence.
- Short double-pip sound plays when `enableSound` is true.
- Sound asset: single bundled WAV named `reset-double-pip.wav` under `sdPlugin/assets/sounds/` with redistribution-friendly license.

Implementation Summary
- Workflow ports extended with `showResetFeedback()`.
- LONG_PRESS transitions in all relevant states now include `showResetFeedback` before transitioning to `idle`.
- Controller implements `showResetFeedback` to:
  - Stop pause blink, flash a white full ring 3x (work phase baseline), and clear title.
  - Play the bundled WAV concurrently when audio is enabled.
  - Rely on `idle.onEnter` to render the final full work display.

Files
- `src/lib/workflow.ts`: add port and transitions.
- `src/lib/workflow-controller.ts`: implement flashing + sound.
- `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/assets/sounds/README.txt`: asset instructions.
- `README.md`: user-visible behavior update.

Notes
- If the WAV asset is missing, audio is skipped silently.
- Uses existing `AudioPlayer` semantics (stops prior playback).

