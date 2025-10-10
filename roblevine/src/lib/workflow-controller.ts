// WorkflowController: integrates the workflow state machine with TimerManager,
// DisplayGenerator, AudioPlayer, and Stream Deck settings persistence.
// Initial scaffold to enable incremental wiring in the action.

import streamDeck from "@elgato/streamdeck";
import { TimerManager } from "./timer-manager";
import { DisplayGenerator } from "./display-generator";
import { AudioPlayer } from "./audio-player";
import { Ctx, Phase, Ports, Workflow, ConfigSettings, durationForPhaseSec } from "./workflow";

export interface ControllerDeps {
  timer: TimerManager;
  display: DisplayGenerator;
}

export class WorkflowController {
  private wf: Workflow | null = null;
  private deps: ControllerDeps;
  private actionId: string;
  private lastRemaining?: number;
  private lastTotal?: number;
  private lastPhase?: Phase;
  private currentSettings?: ConfigSettings;
  private currentAction?: any;
  private hasStarted = false;
  private logDebug(msg: string, data?: unknown) {
    try { streamDeck.logger.debug(msg, data as any); } catch { /* noop */ }
  }
  private logTrace(msg: string, data?: unknown) {
    try { streamDeck.logger.trace(msg, data as any); } catch { /* noop */ }
  }
  private pauseBlinkTimer: NodeJS.Timeout | null = null;
  private pauseBlinkOn = false;

  private stopPauseBlink() {
    if (this.pauseBlinkTimer) {
      clearInterval(this.pauseBlinkTimer);
      this.pauseBlinkTimer = null;
      this.pauseBlinkOn = false;
    }
  }

  private async drawPausedFrame(action: any, remaining: number, total: number, phase: Phase) {
    const color = this.pauseBlinkOn ? '#F44336' /* red */ : undefined; // undefined uses base phase color
    const main = this.deps.display.formatTime(remaining);
    const sub = this.getCycleLabel(phase);
    const svg = this.deps.display.generateDonutWithTextsSVG(remaining, total, false, phase, main, sub, color);
    const dataUrl = this.deps.display.svgToDataUrl(svg);
    await action.setImage(dataUrl);
    try { await action.setTitle(""); } catch {}
  }

  private async runCompletionAnimation(action: any, durationMs: number) {
    // Show 'Done' title, animate a spinning dashed white ring for durationMs
    let angle = 0;
    const stepMs = 100;
    const tick = async () => {
      angle = (angle + 20) % 360;
      const svg = this.deps.display.generateDashedRingSVG(angle, '#FFFFFF');
      const dataUrl = this.deps.display.svgToDataUrl(svg);
      await action.setImage(dataUrl);
      await action.setTitle('Done');
    };
    await tick();
    return new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        try { await tick(); } catch {}
      }, stepMs);
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, Math.max(0, durationMs));
    });
  }

  constructor(actionId: string, deps?: Partial<ControllerDeps>) {
    this.actionId = actionId;
    this.deps = {
      timer: (deps?.timer) ?? new TimerManager(),
      display: (deps?.display) ?? new DisplayGenerator(),
    };
  }

  private getCycleLabel(phase: Phase): string | undefined {
    const totalCycles = this.currentSettings?.cyclesBeforeLongBreak ?? 4;
    let idx = this.wf?.ctx.cycleIndex ?? 0;
    if (phase === 'work') idx = idx + 1;
    if (phase === 'longBreak') idx = totalCycles;
    if (idx < 0) idx = 0;
    if (idx > totalCycles) idx = totalCycles;
    return `${idx}/${totalCycles}`;
  }

  createPorts(action: any, settings: ConfigSettings, tickRef?: { total?: number }): Ports {
    this.currentAction = action;
    return {
      showFull: async (phase: Phase, total: number) => {
        this.logDebug('[PI] showFull', { phase, total });
        this.stopPauseBlink();
        const main = this.deps.display.formatTime(total);
        const sub = this.getCycleLabel(phase);
        const svg = this.deps.display.generateDonutWithTextsSVG(total, total, false, phase, main, sub);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await (this.currentAction ?? action).setImage(dataUrl);
        try { await (this.currentAction ?? action).setTitle(""); } catch {}
        // Do not persist runtime state to settings
      },
      updateRunning: async (remaining: number, total: number, phase: Phase) => {
        // Cache last known values for accurate pause computation
        this.lastRemaining = remaining;
        this.lastTotal = total;
        this.lastPhase = phase;
        this.logTrace('[PI] updateRunning', { phase, remaining, total });
        this.stopPauseBlink();
        const main = this.deps.display.formatTime(remaining);
        const sub = this.getCycleLabel(phase);
        const svg = this.deps.display.generateDonutWithTextsSVG(remaining, total, true, phase, main, sub);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await (this.currentAction ?? action).setImage(dataUrl);
        try { await (this.currentAction ?? action).setTitle(""); } catch {}
        // Do not persist runtime state to settings
      },
      showPaused: async (remaining: number, total: number, phase: Phase) => {
        this.logTrace('[PI] showPaused', { phase, remaining, total });
        this.stopPauseBlink();
        // Draw first frame immediately, then blink between phase color and red
        this.pauseBlinkOn = false;
        await this.drawPausedFrame((this.currentAction ?? action), remaining, total, phase);
        this.pauseBlinkTimer = setInterval(async () => {
          this.pauseBlinkOn = !this.pauseBlinkOn;
          try { await this.drawPausedFrame((this.currentAction ?? action), remaining, total, phase); } catch {}
        }, 600);
        // Do not persist runtime state to settings
      },
      showCompletionWithSound: async (kind: 'work' | 'break', durationMs: number) => {
        this.stopPauseBlink();
        // Start animation and sound in parallel; extend hold if sound is longer
        const anim = this.runCompletionAnimation((this.currentAction ?? action), durationMs);
        let soundPath: string | undefined;
        const cur = this.currentSettings ?? settings;
        if ((cur as any).enableSound) {
          if (kind === 'work') soundPath = (cur as any).workEndSoundPath as string | undefined;
          else soundPath = (cur as any).breakEndSoundPath as string | undefined;
        }
        const soundPromise = (soundPath && soundPath.length > 0)
          ? AudioPlayer.play(soundPath, 'timer-completion')
          : Promise.resolve();
        await Promise.all([anim, soundPromise]);
        try { await this.wf?.dispatch({ type: 'COMPLETE_ANIM_DONE' }); } catch (e) { this.logDebug('[WF] COMPLETE_ANIM_DONE dispatch failed', e as any); }
      },
      startTimer: (phase: Phase, durationSec: number, onDone: () => void) => {
        tickRef && (tickRef.total = durationSec);
        const cfg = (this.currentSettings ?? settings) as ConfigSettings;
        const fullTotal = durationForPhaseSec(phase, cfg);
        const endTime = Date.now() + durationSec * 1000;
        // Initialize cache for resume visualization
        this.lastRemaining = durationSec;
        this.lastTotal = fullTotal;
        this.lastPhase = phase;
        this.stopPauseBlink();
        this.logDebug('[TIMER] start', { phase, durationSec, fullTotal, endTime });
        // Do not persist runtime state to settings
        this.hasStarted = true;
        this.deps.timer.start(
          this.actionId,
          durationSec,
          async (remaining) => {
            this.logTrace('[TIMER] tick', { remaining });
            await (this.wf?.ctx ? this.createPorts((this.currentAction ?? action), this.currentSettings ?? settings).updateRunning(remaining, fullTotal, phase) : Promise.resolve());
          },
          async () => {
            this.logDebug('[TIMER] complete dispatch');
            try { onDone(); } catch {}
            try { await this.wf?.dispatch({ type: 'TIMER_DONE' }); } catch (e) { streamDeck.logger.debug('dispatch TIMER_DONE failed', e as any); }
          }
        );
      },
      stopTimer: () => {
        this.logDebug('[TIMER] stop');
        this.deps.timer.stop(this.actionId);
      },
      
    };
  }

  init(action: any, settings: ConfigSettings): void {
    // Start neutral (runtime not persisted across deletion), but allow in-session reuse later
    const ctx: Ctx = {
      phase: 'work',
      cycleIndex: 0,
      running: false,
      remaining: undefined,
      pendingNext: 'work',
      settings
    };
    const initial: any = 'pausedNext';
    this.logDebug('[WF] init', { initial, phase: ctx.phase, running: ctx.running, pausedRemaining: ctx.remaining });
    this.currentSettings = settings;
    this.currentAction = action;
    this.wf = new Workflow(
      ctx,
      this.createPorts(action, settings),
      initial,
      undefined,
      { debug: (m: string, d?: unknown) => this.logDebug(m, d), trace: (m: string, d?: unknown) => this.logTrace(m, d) }
    );
  }

  async appear(action: any, settings: ConfigSettings): Promise<void> {
    if (!this.wf) {
      this.init(action, settings);
      this.currentSettings = settings;
      this.logDebug('[WF] appear (fresh)');
      await this.wf!.start();
      this.hasStarted = true;
      return;
    }
    // Rebind action and config, then re-render without restarting timers
    this.currentAction = action;
    this.currentSettings = settings;
    const phase = this.wf!.ctx.phase;
    const total = durationForPhaseSec(phase, this.currentSettings);
    if (this.deps.timer.isRunning(this.actionId) || this.wf!.ctx.running) {
      const remaining = this.lastRemaining ?? total;
      await this.createPorts(action, this.currentSettings).updateRunning(remaining, total, phase);
    } else if ((this.wf as any).current === 'pausedInFlight') {
      const remaining = Math.max(0, this.wf!.ctx.remaining ?? total);
      await this.createPorts(action, this.currentSettings).showPaused(remaining, total, phase);
    } else {
      // pausedNext or idle-like
      const next = (this.wf!.ctx.pendingNext ?? phase) as Phase;
      const nextTotal = durationForPhaseSec(next, this.currentSettings);
      await this.createPorts(action, this.currentSettings).showFull(next, nextTotal);
    }
  }

  // Simple helpers for pause bookkeeping (remaining from settings)
  getPausedRemaining(settings: any): number | undefined {
    const remaining = typeof settings?.remainingTime === 'number' ? settings.remainingTime : undefined;
    return remaining;
  }

  totalForPhase(phase: Phase, settings: ConfigSettings): number {
    return durationForPhaseSec(phase, settings);
  }

  computeRemaining(settings: any, phase: Phase): number {
    // Prefer cached remaining from live ticks
    if (typeof this.lastRemaining === 'number') {
      this.logTrace('[WF] computeRemaining (cached)', { remaining: this.lastRemaining });
      return Math.max(0, this.lastRemaining);
    }
    const total = this.totalForPhase(phase, this.currentSettings ?? settings);
    this.logTrace('[WF] computeRemaining (default total)', { total });
    return total;
  }

  async shortPress(action: any, settings: ConfigSettings): Promise<void> {
    if (!this.wf) this.init(action, settings);
    // Ensure latest settings in context
    this.wf!.ctx.settings = settings;
    this.currentSettings = settings;
    // If currently running, snapshot remaining before dispatch so pausedInFlight can show it
    const runningStates = new Set(['workRunning','shortBreakRunning','longBreakRunning']);
    const wasRunning = runningStates.has((this.wf as any).current);
    if (wasRunning) {
      const phase = this.wf!.ctx.phase;
      this.wf!.ctx.remaining = this.computeRemaining(settings as any, phase);
      this.logDebug('[INPUT] shortPress (pause)', { phase, remaining: this.wf!.ctx.remaining });
    } else {
      this.logDebug('[INPUT] shortPress (resume/start)', { phase: this.wf!.ctx.phase });
    }
    await this.wf!.dispatch({ type: 'SHORT_PRESS' });
  }

  async longPress(action: any, settings: ConfigSettings): Promise<void> {
    if (!this.wf) this.init(action, settings);
    this.wf!.ctx.settings = settings;
    this.currentSettings = settings;
    this.logDebug('[INPUT] longPress (reset)');
    await this.wf!.dispatch({ type: 'LONG_PRESS' });
  }

  settingsChanged(action: any, settings: ConfigSettings): void {
    if (!this.wf) this.init(action, settings);
    this.wf!.ctx.settings = settings;
    this.logDebug('[WF] settingsChanged', { pauseAtEnd: settings.pauseAtEndOfEachTimer, cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak });
    this.currentSettings = settings;
  }
}
