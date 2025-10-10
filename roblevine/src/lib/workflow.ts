// Rough, dependency-free workflow state machine for Pomodoro.
// Discussion/Scaffold: safe to import, not yet wired.

export type Phase = 'work' | 'shortBreak' | 'longBreak';

export interface WorkflowSettings {
  workDuration: number | string;
  shortBreakDuration: number | string;
  longBreakDuration: number | string;
  cyclesBeforeLongBreak: number;
  pauseAtEndOfEachTimer?: boolean; // default true
  enableSound?: boolean;
  workEndSoundPath?: string;
  breakEndSoundPath?: string;
}

export type EventType =
  | 'APPEAR'
  | 'DISAPPEAR'
  | 'SHORT_PRESS'
  | 'LONG_PRESS'
  | 'TIMER_DONE'
  | 'SETTINGS_CHANGED';

export interface Event {
  type: EventType;
  payload?: unknown;
}

export interface Ctx {
  phase: Phase;
  cycleIndex: number; // completed work blocks in current set
  running: boolean;
  remaining?: number; // seconds (used for pausedInFlight)
  pendingNext?: Phase; // used by pausedNext
  settings: WorkflowSettings;
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

  // Audio
  playWorkEnd(path?: string): void | Promise<void>;
  playBreakEnd(path?: string): void | Promise<void>;
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

export function durationForPhaseSec(phase: Phase, s: WorkflowSettings): number {
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
  const total = durationForPhaseSec(ctx.phase, ctx.settings);
  ctx.running = true;
  ctx.remaining = undefined;
  ports.startTimer(ctx.phase, total, () => { /* controller dispatches TIMER_DONE */ });
};
const stopTimer: ActionFn = async (ctx, ports) => { ctx.running = false; ports.stopTimer(); };
const playEndSound = (kind: 'work' | 'break'): ActionFn => async (ctx, ports) => {
  if (!ctx.settings.enableSound) return;
  if (kind === 'work') await ports.playWorkEnd(ctx.settings.workEndSoundPath);
  else await ports.playBreakEnd(ctx.settings.breakEndSoundPath);
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
      on: { SHORT_PRESS: { target: 'workRunning' } }
    },

    workRunning: {
      onEnter: [ setPhase('work'), startTimerForCurrentPhase ],
      on: {
        TIMER_DONE: { target: 'workComplete' },
        SHORT_PRESS: { target: 'pausedInFlight', actions: [ stopTimer ] },
        LONG_PRESS: { target: 'idle', actions: [ stopTimer ] }
      }
    },

    shortBreakRunning: {
      onEnter: [ setPhase('shortBreak'), startTimerForCurrentPhase ],
      on: {
        TIMER_DONE: { target: 'shortBreakComplete' },
        SHORT_PRESS: { target: 'pausedInFlight', actions: [ stopTimer ] },
        LONG_PRESS: { target: 'idle', actions: [ stopTimer ] }
      }
    },

    longBreakRunning: {
      onEnter: [ setPhase('longBreak'), startTimerForCurrentPhase ],
      on: {
        TIMER_DONE: { target: 'longBreakComplete' },
        SHORT_PRESS: { target: 'pausedInFlight', actions: [ stopTimer ] },
        LONG_PRESS: { target: 'idle', actions: [ stopTimer ] }
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
        LONG_PRESS: { target: 'idle' }
      }
    },

    workComplete: {
      onEnter: [ stopTimer, playEndSound('work'), async (ctx) => { ctx.pendingNext = longBreakDue(ctx) ? 'longBreak' : 'shortBreak'; }, incCycle ],
      always: [
        { target: 'pausedNext', cond: pauseAtEnd },
        { target: 'longBreakRunning', cond: (ctx) => ctx.pendingNext === 'longBreak' },
        { target: 'shortBreakRunning' }
      ]
    },

    shortBreakComplete: {
      onEnter: [ stopTimer, playEndSound('break'), setPendingNext('work') ],
      always: [ { target: 'pausedNext', cond: pauseAtEnd }, { target: 'workRunning' } ]
    },

    longBreakComplete: {
      onEnter: [ stopTimer, playEndSound('break'), resetCycle, setPendingNext('work') ],
      always: [ { target: 'pausedNext', cond: pauseAtEnd }, { target: 'workRunning' } ]
    },

    pausedNext: {
      onEnter: [ async (ctx, ports) => { const next = ctx.pendingNext ?? 'work'; await ports.showFull(next, durationForPhaseSec(next, ctx.settings)); } ],
      on: {
        SHORT_PRESS: [
          { target: 'longBreakRunning', cond: (ctx) => ctx.pendingNext === 'longBreak' },
          { target: 'shortBreakRunning', cond: (ctx) => ctx.pendingNext === 'shortBreak' },
          { target: 'workRunning' }
        ],
        LONG_PRESS: { target: 'idle' }
      }
    }
  };
}

export class Workflow {
  private config: MachineConfig;
  private state: StateKey;
  constructor(
    public ctx: Ctx,
    private ports: Ports,
    initial: StateKey = 'idle',
    config: MachineConfig = createWorkflowConfig()
  ) {
    this.config = config;
    this.state = initial;
  }

  get current(): StateKey { return this.state; }

  async start(): Promise<void> { await this.runOnEnter(this.state); await this.runAlways(); }

  async dispatch(ev: Event): Promise<void> {
    const node = this.config[this.state];
    const handler = node.on?.[ev.type];
    const transitions: Transition[] = Array.isArray(handler) ? handler : handler ? [handler] : [];
    for (const t of transitions) {
      if (!t.cond || t.cond(this.ctx)) {
        if (t.actions) for (const a of t.actions) await a(this.ctx, this.ports);
        await this.transitionTo(t.target);
        return;
      }
    }
  }

  private async transitionTo(target: StateKey): Promise<void> {
    this.state = target;
    await this.runOnEnter(target);
    await this.runAlways();
  }

  private async runOnEnter(s: StateKey): Promise<void> {
    const actions = this.config[s].onEnter ?? [];
    for (const a of actions) await a(this.ctx, this.ports);
  }

  private async runAlways(): Promise<void> {
    while (true) {
      const node = this.config[this.state];
      const always = node.always ?? [];
      let taken = false;
      for (const t of always) {
        if (!t.cond || t.cond(this.ctx)) {
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

