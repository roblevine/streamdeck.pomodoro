# 0005 — Shared Global Pomodoro Timer (multi‑instance sync)

Status: Deferred - Awaiting user demand; current per-instance model sufficient

Owner: Rob / Plugin Team

## Summary

Enable multiple instances of the Pomodoro action (across keys, pages, and devices) to control and display a single shared timer. All instances subscribe to the same underlying timer state maintained in the plugin process; UI instances become thin views/controllers. Persist minimal state via Stream Deck global settings so the timer can rehydrate after plugin reloads.

## Goals

- One canonical timer per `timerId` (default `main`) shared by all key instances.
- Instances can control the timer interchangeably (start/pause/reset/skip) and stay in sync.
- Persist essential state in global settings to rehydrate on restart.
- Maintain backward compatibility via a per‑instance setting: Shared vs Independent.
- Throttle UI updates to avoid SDK spam while keeping UX responsive (≈1 Hz updates).

## Non‑Goals

- Full historical analytics or multi‑profile isolation beyond a simple `timerId` namespace.
- Cloud sync beyond Stream Deck’s built‑in global settings.

## User Stories

- As a user, I can place the timer action on multiple keys/pages and have them all show the same countdown and phase.
- As a user, I can control the shared timer from any page (start/pause/reset/skip) and all keys reflect changes immediately.
- As a user, I can optionally create separate groups (e.g., `work`, `breakfast`) by setting a `Timer ID` per instance.

## Technical Approach

### Core Design

- Singleton `TimerRegistry` (in `roblevine/src/plugin.ts`) that owns timers by `timerId` and tracks subscribed Stream Deck `context`s.
- One `PomodoroCycle` (from `roblevine/src/lib/pomodoro-cycle.ts`) per `timerId`. The registry drives each cycle with an interval/tick and broadcasts state to subscribers.
- Persist timer snapshots (phase, remaining, startedAt, running) per `timerId` using Stream Deck global settings (`setGlobalSettings`, `getGlobalSettings`, `didReceiveGlobalSettings`).
- UI instance settings add `mode` (Shared/Independent) and `timerId` (default `main` when Shared; default to unique `context` when Independent for backward compatibility).

### Action/Event Wiring

- `willAppear`: Determine `mode`/`timerId` from instance settings, subscribe `context` to that timer, and immediately push current state to hydrate UI.
- `willDisappear`: Unsubscribe `context` (do not stop timer).
- `keyDown`: Map button press to control commands (`start`, `pause`, `reset`, `skip`) for the instance’s `timerId` and forward to the registry.
- `didReceiveSettings`: If `mode`/`timerId` changes, move the `context` to the new group and push current state.

### Property Inspector (PI)

- In `uk.co.roblevine.streamdeck.pomodoro.sdPlugin/ui/pomodoro-timer.html`, add:
  - `Mode`: Shared | Independent (default Shared for new installs, Independent for legacy if needed).
  - `Timer ID` (text/select) when in Shared mode; default `main`.
  - Optional: `Keep running when hidden` toggle (default true; timer continues when no subscribers are visible).
- Persist via `setSettings`. No new dependencies.

### Persistence & Rehydration

- On start/pause/reset/phase changes, snapshot minimal state per `timerId` to global settings (coalesce writes to avoid chattiness).
- On plugin init, call `getGlobalSettings` and reconstruct timers in the registry; resume running timers and set next expiry from `startedAt` and cycle config.

### UI Updates

- Broadcast deltas at 1 Hz: use `setTitle` for remaining time, `setState`/image to indicate running/paused/phase.
- Push a full state immediately on subscribe and after settings changes to avoid stale keys.

### Edge Cases

- Last subscriber disappears: default keep running; if `Keep running when hidden` is false, auto‑pause.
- Multiple devices/profiles: same plugin runtime; sharing works by default. If isolation per profile is desired later, namespace `timerId` by `profile`.
- Backward compatibility: Instances without `mode` default to Independent with implicit `timerId = context` until user changes settings.

## Incremental Delivery (slices)

1) Registry skeleton and wiring
- Add `TimerRegistry` with subscribe/broadcast APIs; integrate `willAppear`/`willDisappear`/`keyDown` minimally.
- No persistence; default single `timerId = main`. Throttle updates.

2) Property Inspector controls
- Add `Mode` and `Timer ID` controls; persist per‑instance settings; support moving contexts between groups.

3) Persistence and rehydration
- Save snapshots to global settings per `timerId`; load and resume on plugin start.

4) Backward compatibility polish
- Default existing instances to Independent; add migration note in README.

## Testing Plan

- Manual: place multiple action instances on different keys/pages; verify synced countdown, controls from any key, and state after switching pages/profiles.
- Restart plugin/Stream Deck app; verify rehydration from global settings.
- Toggle modes and `timerId` live; confirm context migrates and UI hydrates correctly.
- Performance: confirm update rate is ~1 Hz and no UI spam/errors.

## Risks & Mitigations

- Excessive SDK traffic: throttle to 1 Hz; batch global settings writes.
- Race conditions on rehydrate: gate broadcasts until registry is warmed from `getGlobalSettings` (or tolerate later deltas).
- Legacy behavior surprises: keep Independent mode and document migration.

## Rollout

- Feature flag via `Mode` setting; default conservative for existing users.
- Update README with Shared/Independent usage and examples.

## Dependencies

- None (uses existing Stream Deck APIs: `setGlobalSettings`, `getGlobalSettings`, `didReceiveGlobalSettings`).

## Estimated Effort

- 1–2 sessions for slices (1) and (2); +1 session for (3) persistence; +0.5 session for polish.

## Implementation Notes (when approved)

- Files touched: `roblevine/src/plugin.ts`, `roblevine/src/lib/pomodoro-cycle.ts` (ensure context‑agnostic API), `roblevine/.../ui/pomodoro-timer.html`.
- Commit style: Conventional Commits per slice (feat, docs, chore), with tests/verification notes in commit body.

