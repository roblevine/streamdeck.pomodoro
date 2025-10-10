# Agent Guidelines

This file provides comprehensive guidance for AI Agents (Claude, GitHub Copilot, Cursor, Windsurf, OpenAI Codex, etc.) working with this codebase.

**For project architecture and technical details, see [ARCHITECTURE.md](ARCHITECTURE.md)**

## Expected Behaviours

**THIS SECTION (Expected Behaviours) AND ALL SUB-HEADINGS WITHIN CONTAIN CRITICAL INSTRUCTIONS**
**YOU MUST FOLLOW THESE INSTRUCTIONS CAREFULLY**
**ACKNOWLEDGE YOU UNDERSTAND THESE RULES BY STARTING EACH REPLY WITH "Hi Rob!"**

### Maintaining Session Notes

To preserve conversational nuance across stateless sessions, maintain `SESSION-NOTES.md`:

* Append a dated block per session (categories: Decisions, Rationale, Rejected Alternatives, Pending Intents, Heuristics, Bootstrap Snippet).
* After adding a Decision here, reflect stable ones in the appropriate plan or architecture file during the same or next commit.
* Use the latest Bootstrap Snippet when starting a fresh chat to rehydrate context quickly.
* Periodically compress older entries (e.g. older than 21 sessions) into plan revision history and prune them from the notes file.
* Do NOT store sensitive data or credentials; this file is purely for modeling narrative and intent continuity.

### Core behaviours

* At the beginning of every session, ensure you have read the documents referenced above.
* Default mode is Propose-Only: do not make code edits, create files, or run commands without explicit approval.
* Allowed without approval: read-only actions (read/search code/docs, summarize findings, propose todos/plan).
* Implementation occurs only after explicit approval (“Proceed”, “Implement”, “Approved”) from Rob.
* If approval is unclear or not given, do not proceed.
* After approval: restate the plan (edits, tests, commands), execute, and report results.
* Conventional Commits: Use conventional commit messages for all changes (e.g. feat, fix, docs, chore)

### Core Workflow: Analyse → Plan → Execute → Review

1. **Analyse**: Break down requirements, understand existing codebase context
2. **Plan**: Document approach in a plan file, in the plans folder
3. **Execute**: Implement in small, testable increments with comprehensive tests
4. **Review**: Verify functionality, update documentation, ensure no regressions

### Working Agreements

* **Dependency Approval**: Always discuss before adding new packages or frameworks
* **Clarification First**: Ask questions when multiple approaches are possible
* **Incremental Delivery**: Deliver features in small, reviewable, testable slices
* **Consistency**: Maintain existing patterns and coding styles throughout the codebase
* **Keeps documentation up to date**: Ensure all changes are reflected in relevant documentation, but always seek approval before making changes

## Quick Reference

* **Build**: `npm run build`
* **Watch mode**: `npm run watch` (auto-restarts plugin)
* **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
* **Feature docs**: See `plans/` directory
* **Commits**: Use conventional commits (feat, fix, docs, chore)
