// Rough, dependency-free workflow state machine for Pomodoro.
// Discussion/Scaffold: safe to import, not yet wired.

import { DEFAULT_CONFIG } from "./defaults";

export type Phase = 'work' | 'shortBreak' | 'longBreak';

// Config settings persisted via Property Inspector
export interface ConfigSettings {
  workDuration: number | string;
  shortBreakDuration: number | string;
  longBreakDuration: number | string;
  cyclesBeforeLongBreak: number;
  pauseAtEndOfEachTimer?: boolean; // default true
  enableSound?: boolean;
  workEndSoundPath?: string;
  breakEndSoundPath?: string;
  completionHoldSeconds?: number;
}

// Backward-compat alias if other modules still import WorkflowSettings
export type WorkflowSettings = ConfigSettings;

// Runtime state for the workflow (in-memory only; not persisted)
export interface RuntimeState {
  phase: Phase;
  cycleIndex: number;
  running: boolean;
  remaining?: number;
  pendingNext?: Phase;
}

export type EventType =
  | 'APPEAR'
  | 'DISAPPEAR'
  | 'SHORT_PRESS'
  | 'DOUBLE_PRESS'
  | 'LONG_PRESS'
  | 'TIMER_DONE'
  | 'COMPLETE_ANIM_DONE'
  | 'SETTINGS_CHANGED';

export interface Event {
  type: EventType;
  payload?: unknown;
}

export interface Ctx extends RuntimeState {
  // Persisted config
  settings: ConfigSettings;
}

// Ports implemented by controller
export interface Ports {
  // Display
  showFull(phase: Phase, durationSec: number): void | Promise<void>;
  updateRunning(remainingSec: number, totalSec: number, phase: Phase): void | Promise<void>;
  showPaused(remainingSec: number, totalSec: number, phase: Phase): void | Promise<void>;

  // Timer
  startTimer(phase: Phase, durationSec: number, onDone: () => void): void;
  stopTimer(): void;

  // Completion animation + sound (in parallel); must dispatch COMPLETE_ANIM_DONE when finished
  showCompletionWithSound(kind: 'work' | 'break', durationMs: number): void | Promise<void>;

  // Reset feedback (ring flash + optional double pip sound)
  showResetFeedback(): void | Promise<void>;
}

export type ActionFn = (ctx: Ctx, ports: Ports) => void | Promise<void>;
export type CondFn = (ctx: Ctx) => boolean;

export interface Transition {
  target: StateKey;
  cond?: CondFn;
  actions?: ActionFn[];
}

export interface Node {
  onEnter?: ActionFn[];
  on?: Partial<Record<EventType, Transition | Transition[]>>;
  always?: Transition[]; // evaluated in order
}

export type StateKey =
  | 'idle'
  | 'workRunning'
  | 'shortBreakRunning'
  | 'longBreakRunning'
  | 'pausedInFlight'
  | 'workComplete'
  | 'shortBreakComplete'
  | 'longBreakComplete'
  | 'pausedNext';

export type MachineConfig = Record<StateKey, Node>;

// Helpers
function parseDurationToSeconds(v: number | string): number {
  if (typeof v === 'number') return Math.max(0, Math.round(v * 60));
  const parts = v.split(':');
  const mm = parseInt(parts[0] ?? '0', 10);
  const ss = parts.length > 1 ? parseInt(parts[1] ?? '0', 10) : 0;
  const total = (isFinite(mm) ? mm : 0) * 60 + (isFinite(ss) ? ss : 0);
  return Math.max(0, total);
}

export function durationForPhaseSec(phase: Phase, s: ConfigSettings): number {
  switch (phase) {
    case 'work': return parseDurationToSeconds(s.workDuration);
    case 'shortBreak': return parseDurationToSeconds(s.shortBreakDuration);
    case 'longBreak': return parseDurationToSeconds(s.longBreakDuration);
  }
}

const longBreakDue: CondFn = (ctx) => (ctx.cycleIndex + 1) >= ctx.settings.cyclesBeforeLongBreak;
const pauseAtEnd: CondFn = (ctx) => ctx.settings.pauseAtEndOfEachTimer !== false; // default true

// Actions
const setPhase = (phase: Phase): ActionFn => async (ctx) => { ctx.phase = phase; };
const showFullFor = (phase: Phase): ActionFn => async (ctx, ports) => {
  const total = durationForPhaseSec(phase, ctx.settings);
  await ports.showFull(phase, total);
};
const startTimerForCurrentPhase: ActionFn = async (ctx, ports) => {
  const fullTotal = durationForPhaseSec(ctx.phase, ctx.settings);
  const effective = typeof ctx.remaining === 'number' && ctx.remaining > 0 && ctx.remaining < fullTotal
    ? ctx.remaining
    : fullTotal;
  ctx.running = true;
  ctx.remaining = undefined; // consume remaining on resume
  ports.startTimer(ctx.phase, effective, () => { /* controller dispatches TIMER_DONE */ });
};
const stopTimer: ActionFn = async (ctx, ports) => { ctx.running = false; ports.stopTimer(); };
const runCompletionEffects = (kind: 'work' | 'break'): ActionFn => async (ctx, ports) => {
  const seconds = typeof (ctx.settings as any).completionHoldSeconds === 'number'
    ? (ctx.settings as any).completionHoldSeconds
    : DEFAULT_CONFIG.completionHoldSeconds;
  const ms = Math.max(0, Math.round(seconds * 1000));
  await ports.showCompletionWithSound(kind, ms);
};
const setPendingNext = (phase: Phase): ActionFn => async (ctx) => { ctx.pendingNext = phase; };
const incCycle: ActionFn = async (ctx) => { ctx.cycleIndex += 1; };
const resetCycle: ActionFn = async (ctx) => { ctx.cycleIndex = 0; };
const showPausedNow: ActionFn = async (ctx, ports) => {
  const total = durationForPhaseSec(ctx.phase, ctx.settings);
  const remaining = Math.max(0, ctx.remaining ?? total);
  await ports.showPaused(remaining, total, ctx.phase);
};

export function createWorkflowConfig(): MachineConfig {
  return {
    idle: {
      onEnter: [ setPhase('work'), showFullFor('work'), async (ctx) => { ctx.running = false; ctx.pendingNext = undefined; ctx.remaining = undefined; } ],
      on: {
        SHORT_PRESS: { target: 'workRunning' },
        LONG_PRESS: { target: 'idle', actions: [ resetCycle, async (_ctx, ports) => { await ports.showResetFeedback(); } ] }
      }
    },

    workRunning: {
      onEnter: [ setPhase('work'), startTimerForCurrentPhase ],
      on: {
        TIMER_DONE: { target: 'workComplete' },
        SHORT_PRESS: { target: 'pausedInFlight', actions: [ stopTimer ] },
        // Skip current work without completion effects
        DOUBLE_PRESS: [
          // Pause at end: compute next and show pausedNext
          { target: 'pausedNext', cond: (ctx) => pauseAtEnd(ctx), actions: [ stopTimer, async (ctx) => { ctx.pendingNext = longBreakDue(ctx) ? 'longBreak' : 'shortBreak'; }, incCycle ] },
          // Auto-advance to long break
          { target: 'longBreakRunning', cond: (ctx) => longBreakDue(ctx), actions: [ stopTimer, incCycle ] },
          // Auto-advance to short break
          { target: 'shortBreakRunning', actions: [ stopTimer, incCycle ] }
        ],
        LONG_PRESS: { target: 'idle', actions: [ stopTimer, resetCycle, async (_ctx, ports) => { await ports.showResetFeedback(); } ] }
      }
    },

    shortBreakRunning: {
      onEnter: [ setPhase('shortBreak'), startTimerForCurrentPhase ],
      on: {
        TIMER_DONE: { target: 'shortBreakComplete' },
        SHORT_PRESS: { target: 'pausedInFlight', actions: [ stopTimer ] },
        // Skip current short break without completion effects
        DOUBLE_PRESS: [
          { target: 'pausedNext', cond: (ctx) => pauseAtEnd(ctx), actions: [ stopTimer, setPendingNext('work') ] },
          { target: 'workRunning', actions: [ stopTimer ] }
        ],
        LONG_PRESS: { target: 'idle', actions: [ stopTimer, resetCycle, async (_ctx, ports) => { await ports.showResetFeedback(); } ] }
      }
    },

    longBreakRunning: {
      onEnter: [ setPhase('longBreak'), startTimerForCurrentPhase ],
      on: {
        TIMER_DONE: { target: 'longBreakComplete' },
        SHORT_PRESS: { target: 'pausedInFlight', actions: [ stopTimer ] },
        // Skip current long break without completion effects
        DOUBLE_PRESS: [
          { target: 'pausedNext', cond: (ctx) => pauseAtEnd(ctx), actions: [ stopTimer, resetCycle, setPendingNext('work') ] },
          { target: 'workRunning', actions: [ stopTimer, resetCycle ] }
        ],
        LONG_PRESS: { target: 'idle', actions: [ stopTimer, resetCycle, async (_ctx, ports) => { await ports.showResetFeedback(); } ] }
      }
    },

    pausedInFlight: {
      onEnter: [ showPausedNow ],
      on: {
        SHORT_PRESS: [
          { target: 'workRunning', cond: (ctx) => ctx.phase === 'work' },
          { target: 'shortBreakRunning', cond: (ctx) => ctx.phase === 'shortBreak' },
          { target: 'longBreakRunning' } // phase === 'longBreak'
        ],
        // Skip current phase while paused mid-timer
        DOUBLE_PRESS: [
          // Paused work: compute next break
          { target: 'pausedNext', cond: (ctx) => ctx.phase === 'work' && pauseAtEnd(ctx), actions: [ async (ctx) => { ctx.pendingNext = longBreakDue(ctx) ? 'longBreak' : 'shortBreak'; }, incCycle ] },
          { target: 'longBreakRunning', cond: (ctx) => ctx.phase === 'work' && longBreakDue(ctx), actions: [ incCycle ] },
          { target: 'shortBreakRunning', cond: (ctx) => ctx.phase === 'work', actions: [ incCycle ] },
          // Paused short break: go to work
          { target: 'pausedNext', cond: (ctx) => ctx.phase === 'shortBreak' && pauseAtEnd(ctx), actions: [ setPendingNext('work') ] },
          { target: 'workRunning', cond: (ctx) => ctx.phase === 'shortBreak' },
          // Paused long break: go to work and reset cycle
          { target: 'pausedNext', cond: (ctx) => ctx.phase === 'longBreak' && pauseAtEnd(ctx), actions: [ resetCycle, setPendingNext('work') ] },
          { target: 'workRunning', cond: (ctx) => ctx.phase === 'longBreak', actions: [ resetCycle ] }
        ],
        LONG_PRESS: { target: 'idle', actions: [ resetCycle, async (_ctx, ports) => { await ports.showResetFeedback(); } ] }
      }
    },

    workComplete: {
      onEnter: [ stopTimer, async (ctx) => { ctx.pendingNext = longBreakDue(ctx) ? 'longBreak' : 'shortBreak'; }, incCycle, runCompletionEffects('work') ],
      on: {
        COMPLETE_ANIM_DONE: [
          { target: 'pausedNext', cond: pauseAtEnd },
          { target: 'longBreakRunning', cond: (ctx) => ctx.pendingNext === 'longBreak' },
          { target: 'shortBreakRunning' }
        ]
      }
    },

    shortBreakComplete: {
      onEnter: [ stopTimer, setPendingNext('work'), runCompletionEffects('break') ],
      on: {
        COMPLETE_ANIM_DONE: [ { target: 'pausedNext', cond: pauseAtEnd }, { target: 'workRunning' } ]
      }
    },

    longBreakComplete: {
      onEnter: [ stopTimer, resetCycle, setPendingNext('work'), runCompletionEffects('break') ],
      on: {
        COMPLETE_ANIM_DONE: [ { target: 'pausedNext', cond: pauseAtEnd }, { target: 'workRunning' } ]
      }
    },

    pausedNext: {
      onEnter: [ async (ctx, ports) => { const next = ctx.pendingNext ?? 'work'; await ports.showFull(next, durationForPhaseSec(next, ctx.settings)); } ],
      on: {
        SHORT_PRESS: [
          { target: 'longBreakRunning', cond: (ctx) => ctx.pendingNext === 'longBreak' },
          { target: 'shortBreakRunning', cond: (ctx) => ctx.pendingNext === 'shortBreak' },
          { target: 'workRunning' }
        ],
        // Skip the pending phase and jump to the following one
        DOUBLE_PRESS: [
          // Pending work: skip to next break based on longBreakDue
          { target: 'pausedNext', cond: (ctx) => (ctx.pendingNext ?? 'work') === 'work' && pauseAtEnd(ctx), actions: [ async (ctx) => { ctx.pendingNext = longBreakDue(ctx) ? 'longBreak' : 'shortBreak'; }, incCycle ] },
          { target: 'longBreakRunning', cond: (ctx) => (ctx.pendingNext ?? 'work') === 'work' && longBreakDue(ctx), actions: [ incCycle ] },
          { target: 'shortBreakRunning', cond: (ctx) => (ctx.pendingNext ?? 'work') === 'work', actions: [ incCycle ] },
          // Pending short break: skip to work
          { target: 'pausedNext', cond: (ctx) => ctx.pendingNext === 'shortBreak' && pauseAtEnd(ctx), actions: [ setPendingNext('work') ] },
          { target: 'workRunning', cond: (ctx) => ctx.pendingNext === 'shortBreak' },
          // Pending long break: skip to work and reset cycle
          { target: 'pausedNext', cond: (ctx) => ctx.pendingNext === 'longBreak' && pauseAtEnd(ctx), actions: [ resetCycle, setPendingNext('work') ] },
          { target: 'workRunning', cond: (ctx) => ctx.pendingNext === 'longBreak', actions: [ resetCycle ] }
        ],
        LONG_PRESS: { target: 'idle', actions: [ resetCycle, async (_ctx, ports) => { await ports.showResetFeedback(); } ] }
      }
    }
  };
}

export class Workflow {
  private config: MachineConfig;
  private state: StateKey;
  private logger?: { debug: (msg: string, data?: unknown) => void; trace?: (msg: string, data?: unknown) => void };
  constructor(
    public ctx: Ctx,
    private ports: Ports,
    initial: StateKey = 'idle',
    config: MachineConfig = createWorkflowConfig(),
    logger?: { debug: (msg: string, data?: unknown) => void; trace?: (msg: string, data?: unknown) => void }
  ) {
    this.config = config;
    this.state = initial;
    this.logger = logger;
  }

  get current(): StateKey { return this.state; }

  async start(): Promise<void> {
    this.logger?.debug('[WF] start', { state: this.state, ctx: { phase: this.ctx.phase, cycleIndex: this.ctx.cycleIndex } });
    await this.runOnEnter(this.state);
    await this.runAlways();
  }

  async dispatch(ev: Event): Promise<void> {
    this.logger?.debug('[WF] dispatch', { event: ev.type, state: this.state });
    const node = this.config[this.state];
    const handler = node.on?.[ev.type];
    const transitions: Transition[] = Array.isArray(handler) ? handler : handler ? [handler] : [];
    for (const t of transitions) {
      if (!t.cond || t.cond(this.ctx)) {
        this.logger?.debug('[WF] transition', { from: this.state, to: t.target, on: ev.type });
        if (t.actions) for (const a of t.actions) await a(this.ctx, this.ports);
        await this.transitionTo(t.target);
        return;
      }
    }
  }

  private async transitionTo(target: StateKey): Promise<void> {
    this.logger?.debug('[WF] enter', { state: target });
    this.state = target;
    await this.runOnEnter(target);
    await this.runAlways();
  }

  private async runOnEnter(s: StateKey): Promise<void> {
    const actions = this.config[s].onEnter ?? [];
    this.logger?.trace?.('[WF] onEnter actions', { state: s, count: actions.length });
    for (const a of actions) await a(this.ctx, this.ports);
  }

  private async runAlways(): Promise<void> {
    while (true) {
      const node = this.config[this.state];
      const always = node.always ?? [];
      let taken = false;
      for (const t of always) {
        if (!t.cond || t.cond(this.ctx)) {
          this.logger?.trace?.('[WF] always transition', { from: this.state, to: t.target });
          if (t.actions) for (const a of t.actions) await a(this.ctx, this.ports);
          await this.transitionTo(t.target);
          taken = true;
          break;
        }
      }
      if (!taken) break;
    }
  }
}
