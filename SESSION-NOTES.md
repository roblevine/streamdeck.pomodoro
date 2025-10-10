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

