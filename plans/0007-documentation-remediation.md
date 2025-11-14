# Plan 0007: Documentation Remediation

**Status**: Pending Approval
**Created**: 2025-11-14
**Context**: Comprehensive review identified 47 documentation issues across 11 files

## Executive Summary

This plan addresses critical gaps, inconsistencies, and outdated information across the project's documentation suite following a comprehensive audit. The remediation is organized into 4 priority tiers with 16 specific tasks.

## Issues Summary

- **Documentation gaps**: 23
- **Inconsistencies**: 12
- **Plan status issues**: 2
- **Cross-reference issues**: 6
- **File-specific issues**: 4
- **Total**: 47 issues

## Remediation Tasks

### Priority 1: Critical Issues (4 tasks)

#### Task 1.1: Fix Plan 0002 Status
**Files**: `plans/0002-preview-button-toggle.md`
**Issue**: Plan claims "Complete" but documents broken stop functionality (lines 27-35)
**Actions**:
- Change status from "Complete" to "Partial - Stop Functionality Blocked"
- Add "Known Limitations" section to README documenting stop button issue
- Consider creating follow-up issue/plan to fix or remove stop button

**Impact**: High - misleading status affects trust in documentation

#### Task 1.2: Standardize Long-Press Timing
**Files**: `README.md` (lines 50, 69), `ARCHITECTURE.md` (line 98), `plans/0003-pomodoro-workflow.md`
**Issue**: Mixed use of "≥2s" and ">2s" creates ambiguity
**Actions**:
- Use "2 seconds" in user-facing docs (README)
- Use "≥2000ms" in technical docs (ARCHITECTURE, plans)
- Update all 4+ occurrences consistently

**Impact**: Medium - creates technical ambiguity

#### Task 1.3: Add Double-Press Skip to ARCHITECTURE
**Files**: `ARCHITECTURE.md`
**Issue**: Feature fully implemented (plan 0004) but not documented in architecture
**Actions**:
- Add to "Key Features" section (after line 98)
- Document 320ms window, skip semantics, interaction with long-press
- Reference plan 0004

**Impact**: High - major feature missing from technical docs

#### Task 1.4: Add Reset Feedback to ARCHITECTURE
**Files**: `ARCHITECTURE.md`, `README.md` (line 18)
**Issue**: Vague "several times" instead of specific implementation details
**Actions**:
- Update ARCHITECTURE "Visual Feedback" section with specifics: 3 flashes at ~120ms cadence
- Update README line 18 from "several times" to "3 times"
- Reference plan 0006

**Impact**: Medium - implemented feature poorly documented

---

### Priority 2: Important Gaps (4 tasks)

#### Task 2.1: Document Workflow State Machine
**Files**: `ARCHITECTURE.md`
**Issue**: `workflow.ts` (354 lines) implements state machine but architecture doesn't explain it
**Actions**:
- Add new major section "Workflow State Machine" after "State Management"
- Document states: idle, running, pausedInFlight, pausedNext, completing, resetting
- Document events: SHORT_PRESS, LONG_PRESS, DOUBLE_PRESS, TICK, COMPLETE
- Document key transitions and guards
- Reference workflow.ts and workflow-controller.ts

**Impact**: High - core architecture component undocumented

#### Task 2.2: Document Audio Driver Architecture
**Files**: `ARCHITECTURE.md`
**Issue**: Mentions persistent PowerShell/afplay but not driver pattern
**Actions**:
- Expand "Audio Notifications" section (lines 100-108)
- Add subsection "Driver Architecture"
- Document driver interface pattern
- Explain windows-persistent.ts, macos-system.ts implementations
- Clarify Linux support status (aplay - basic fallback)
- Document driver disposal on shutdown

**Impact**: High - audio subsystem architecture missing

#### Task 2.3: Fix Project Structure Documentation
**Files**: `README.md` (lines 109-110), `ARCHITECTURE.md` (lines 37-38)
**Issue**: Shows old filenames, only 1 of 6 plans, missing directories
**Actions**:
- Update plan filename from `audio-notifications.md` to `0001-audio-notifications.md`
- List all 6 plans or use `*.md` wildcard
- Add missing directories: `audio-driver/`, message handler files
- Ensure both files match

**Impact**: Medium - confusing for new developers

#### Task 2.4: Document Message Handler Pattern
**Files**: `ARCHITECTURE.md`
**Issue**: PluginMessageObserver pattern in use but not documented
**Actions**:
- Add new subsection "Message Routing" under "Stream Deck SDK Architecture"
- Document PluginMessageObserver pattern
- Explain handler registration (preview-sound-handler, stop-sound-handler)
- Show message flow: PI → WebSocket → Observer → Handler
- Reference implementation files

**Impact**: Medium - architectural pattern undocumented

---

### Priority 3: Consistency & Polish (4 tasks)

#### Task 3.1: Clarify Double-Press Timing
**Files**: `README.md`, `plans/0004-double-press-skip.md` (line 7)
**Issue**: Plan mentions "300-350ms range" but code uses fixed 320ms; README doesn't specify timing
**Actions**:
- Update plan 0004 line 7 to "320ms window" (remove range language)
- Add timing detail to README: "Double-press (within 320ms)"
- Explain interaction with long-press detection
- Update SESSION-NOTES if needed

**Impact**: Low - clarity improvement

#### Task 3.2: Document Build-Time Asset Generation
**Files**: `README.md`
**Issue**: `npm run build:assets` and `generate-sounds.mjs` exist but undocumented
**Actions**:
- Add subsection "Asset Generation" to Development section
- Explain `npm run build:assets` command
- List generated assets: silent-prime.wav, key-click.wav, reset-double-pip.wav
- Note CC0 licensing for generated sounds
- Mention priming optimization

**Impact**: Low - developer convenience

#### Task 3.3: Expand Config vs State Persistence
**Files**: `ARCHITECTURE.md` (lines 120-132)
**Issue**: Mentions what's persisted but not how
**Actions**:
- Expand "State Management" section
- Explain Stream Deck setSettings/getSettings mechanism
- Clarify "deletion" vs "hide/show" (disappear) behavior
- Document defaults.ts and DEFAULT_CONFIG pattern
- Show example of runtime-only state vs persisted config

**Impact**: Low - implementation clarity

#### Task 3.4: Add Edge Case Documentation
**Files**: `README.md`
**Issue**: Missing sound files, completion hold extension logic undocumented
**Actions**:
- Add "Troubleshooting" section to README
- Document behavior when sound files are missing (silent operation)
- Explain completion hold extension: max(completionHoldSeconds, soundDuration)
- Document double-press vs long-press interaction (long-press takes precedence after 2s)

**Impact**: Low - user support

---

### Priority 4: Maintenance (4 tasks)

#### Task 4.1: Update Plan 0005 Status
**Files**: `plans/0005-shared-global-timer.md`, `SESSION-NOTES.md`
**Issue**: Status "Proposed" but no decision recorded about priority/timeline
**Actions**:
- Review plan with user for decision (implement/defer/reject)
- Add SESSION-NOTES entry documenting decision
- Update plan status based on decision
- If deferred, add reasoning to plan

**Impact**: Low - roadmap clarity (requires user input)

#### Task 4.2: Fix README Markdown Formatting
**Files**: `README.md` (line 28)
**Issue**: Missing newline creates malformed heading
**Actions**:
- Add newline between "Time display in MM:SS" and "## Requirements"

**Impact**: Trivial - formatting fix

#### Task 4.3: Consolidate SESSION-NOTES
**Files**: `SESSION-NOTES.md`
**Issue**: Multiple entries for 2025-10-10; no compression per AGENTS.md guidance
**Actions**:
- Merge or add timestamps to multiple 2025-10-10 entries
- Add latest session notes (work since 2025-10-20)
- Consider compression of older entries per AGENTS.md line 20

**Impact**: Low - maintenance hygiene

#### Task 4.4: Verify and Document Linux Support
**Files**: `README.md`, `ARCHITECTURE.md`, `plans/0001-audio-notifications.md`
**Issue**: Plan 0001 mentions Linux/aplay but README/ARCHITECTURE don't
**Actions**:
- Test on Linux if available OR review code to confirm
- Update README "Platform Support" section consistently
- Update ARCHITECTURE "Audio Notifications" section
- Ensure all three docs align on Linux status

**Impact**: Low - platform clarity (may require testing)

---

## Task Dependencies

```
Priority 1 (can run in parallel):
- Task 1.1 (Plan 0002) - independent
- Task 1.2 (Timing) - independent
- Task 1.3 (Double-press) - independent
- Task 1.4 (Reset feedback) - independent

Priority 2:
- Task 2.1 (Workflow) - independent
- Task 2.2 (Audio drivers) - independent
- Task 2.3 (Project structure) - independent
- Task 2.4 (Message handlers) - independent

Priority 3:
- Task 3.1 (Double-press timing) - depends on 1.3 (same feature)
- Task 3.2 (Build assets) - independent
- Task 3.3 (State persistence) - independent
- Task 3.4 (Edge cases) - independent

Priority 4:
- Task 4.1 (Plan 0005) - requires user decision
- Task 4.2 (Markdown) - independent
- Task 4.3 (SESSION-NOTES) - independent
- Task 4.4 (Linux) - may require testing
```

## Success Criteria

- All 47 identified issues addressed
- No contradictions between docs
- All implemented features documented in ARCHITECTURE
- Plan statuses accurate
- README complete for users
- ARCHITECTURE complete for developers

## Files Affected

- `README.md` (8 tasks)
- `ARCHITECTURE.md` (9 tasks)
- `plans/0002-preview-button-toggle.md` (1 task)
- `plans/0004-double-press-skip.md` (1 task)
- `plans/0005-shared-global-timer.md` (1 task)
- `SESSION-NOTES.md` (2 tasks)

**Total files**: 6

## Notes

- User requested incremental commits after each task
- User review required before starting and after each completion
- Task 4.1 requires user input (Plan 0005 decision)
- Task 4.4 may require Linux testing (can document based on code review if unavailable)

## References

- Feature-planner comprehensive review (2025-11-14)
- Full audit report with 47 issues across 11 files
- 85% user docs completion, 60% technical docs completion baseline
