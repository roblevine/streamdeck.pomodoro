// WorkflowController: integrates the workflow state machine with TimerManager,
// DisplayGenerator, AudioPlayer, and Stream Deck settings persistence.
// Initial scaffold to enable incremental wiring in the action.

import streamDeck from "@elgato/streamdeck";
import { TimerManager } from "./timer-manager";
import { DisplayGenerator } from "./display-generator";
import { AudioPlayer } from "./audio-player";
import { Ctx, Phase, Ports, Workflow, WorkflowSettings, durationForPhaseSec } from "./workflow";

export interface ControllerDeps {
  timer: TimerManager;
  display: DisplayGenerator;
}

export class WorkflowController {
  private wf: Workflow | null = null;
  private deps: ControllerDeps;
  private actionId: string;

  constructor(actionId: string, deps?: Partial<ControllerDeps>) {
    this.actionId = actionId;
    this.deps = {
      timer: (deps?.timer) ?? new TimerManager(),
      display: (deps?.display) ?? new DisplayGenerator(),
    };
  }

  createPorts(action: any, settings: WorkflowSettings, tickRef?: { total?: number }): Ports {
    return {
      showFull: async (phase: Phase, total: number) => {
        const svg = this.deps.display.generateDonutSVG(total, total, false, phase);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await action.setImage(dataUrl);
        await action.setTitle(this.deps.display.formatTime(total));
        try {
          await action.setSettings({
            ...settings,
            isRunning: false,
            currentPhase: phase,
            remainingTime: total,
            endTime: undefined
          });
        } catch {}
      },
      updateRunning: async (remaining: number, total: number, phase: Phase) => {
        const svg = this.deps.display.generateDonutSVG(remaining, total, true, phase);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await action.setImage(dataUrl);
        await action.setTitle(this.deps.display.formatTime(remaining));
        try {
          await action.setSettings({
            ...settings,
            isRunning: true,
            currentPhase: phase,
            remainingTime: remaining
          });
        } catch {}
      },
      showPaused: async (remaining: number, total: number, phase: Phase) => {
        const svg = this.deps.display.generateDonutSVG(remaining, total, false, phase);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await action.setImage(dataUrl);
        await action.setTitle(this.deps.display.formatTime(remaining));
        try {
          await action.setSettings({
            ...settings,
            isRunning: false,
            currentPhase: phase,
            remainingTime: remaining,
            endTime: undefined
          });
        } catch {}
      },
      startTimer: (phase: Phase, durationSec: number, onDone: () => void) => {
        tickRef && (tickRef.total = durationSec);
        this.deps.timer.setDuration(this.actionId, durationSec);
        this.deps.timer.start(
          this.actionId,
          durationSec,
          async (remaining) => {
            await (this.wf?.ctx ? this.createPorts(action, settings).updateRunning(remaining, durationSec, phase) : Promise.resolve());
          },
          async () => {
            try { onDone(); } catch {}
            try { await this.wf?.dispatch({ type: 'TIMER_DONE' }); } catch (e) { streamDeck.logger.debug('dispatch TIMER_DONE failed', e as any); }
          }
        );
      },
      stopTimer: () => {
        this.deps.timer.stop(this.actionId);
      },
      playWorkEnd: async (path?: string) => { await AudioPlayer.play(path ?? "", 'timer-completion'); },
      playBreakEnd: async (path?: string) => { await AudioPlayer.play(path ?? "", 'timer-completion'); }
    };
  }

  init(action: any, settings: WorkflowSettings): void {
    const ctx: Ctx = {
      phase: 'work',
      cycleIndex: settings?.cyclesBeforeLongBreak ? 0 : 0,
      running: false,
      settings
    };
    this.wf = new Workflow(ctx, this.createPorts(action, settings));
  }

  async appear(action: any, settings: WorkflowSettings): Promise<void> {
    if (!this.wf) this.init(action, settings);
    await this.wf!.start();
  }

  // Simple helpers for pause bookkeeping (remaining from settings)
  getPausedRemaining(settings: any): number | undefined {
    const remaining = typeof settings?.remainingTime === 'number' ? settings.remainingTime : undefined;
    return remaining;
  }

  totalForPhase(phase: Phase, settings: WorkflowSettings): number {
    return durationForPhaseSec(phase, settings);
  }

  computeRemaining(settings: any, phase: Phase): number {
    const total = this.totalForPhase(phase, settings);
    if (typeof settings?.endTime === 'number' && settings.endTime > Date.now()) {
      const rem = Math.ceil((settings.endTime - Date.now()) / 1000);
      return Math.min(Math.max(rem, 0), total);
    }
    if (typeof settings?.remainingTime === 'number') {
      return Math.min(Math.max(settings.remainingTime, 0), total);
    }
    return total;
  }

  async shortPress(action: any, settings: WorkflowSettings): Promise<void> {
    if (!this.wf) this.init(action, settings);
    // Ensure latest settings in context
    this.wf!.ctx.settings = settings;
    // If currently running, snapshot remaining before dispatch so pausedInFlight can show it
    const runningStates = new Set(['workRunning','shortBreakRunning','longBreakRunning']);
    if (runningStates.has((this.wf as any).current)) {
      const phase = this.wf!.ctx.phase;
      this.wf!.ctx.remaining = this.computeRemaining(settings as any, phase);
    }
    await this.wf!.dispatch({ type: 'SHORT_PRESS' });
  }

  async longPress(action: any, settings: WorkflowSettings): Promise<void> {
    if (!this.wf) this.init(action, settings);
    this.wf!.ctx.settings = settings;
    await this.wf!.dispatch({ type: 'LONG_PRESS' });
  }

  settingsChanged(action: any, settings: WorkflowSettings): void {
    if (!this.wf) this.init(action, settings);
    this.wf!.ctx.settings = settings;
  }
}
