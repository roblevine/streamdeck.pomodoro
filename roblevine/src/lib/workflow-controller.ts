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
  private lastRemaining?: number;
  private lastTotal?: number;
  private lastPhase?: Phase;
  private currentSettings?: any;
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
    const svg = this.deps.display.generateDonutSVG(remaining, total, false, phase, color);
    const dataUrl = this.deps.display.svgToDataUrl(svg);
    await action.setImage(dataUrl);
    await action.setTitle(this.deps.display.formatTime(remaining));
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

  createPorts(action: any, settings: WorkflowSettings, tickRef?: { total?: number }): Ports {
    return {
      showFull: async (phase: Phase, total: number) => {
        this.logDebug('[PI] showFull', { phase, total });
        this.stopPauseBlink();
        const svg = this.deps.display.generateDonutSVG(total, total, false, phase);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await action.setImage(dataUrl);
        await action.setTitle(this.deps.display.formatTime(total));
        // Do not persist runtime state to settings
      },
      updateRunning: async (remaining: number, total: number, phase: Phase) => {
        // Cache last known values for accurate pause computation
        this.lastRemaining = remaining;
        this.lastTotal = total;
        this.lastPhase = phase;
        this.logTrace('[PI] updateRunning', { phase, remaining, total });
        this.stopPauseBlink();
        const svg = this.deps.display.generateDonutSVG(remaining, total, true, phase);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await action.setImage(dataUrl);
        await action.setTitle(this.deps.display.formatTime(remaining));
        // Do not persist runtime state to settings
      },
      showPaused: async (remaining: number, total: number, phase: Phase) => {
        this.logTrace('[PI] showPaused', { phase, remaining, total });
        this.stopPauseBlink();
        // Draw first frame immediately, then blink between phase color and red
        this.pauseBlinkOn = false;
        await this.drawPausedFrame(action, remaining, total, phase);
        this.pauseBlinkTimer = setInterval(async () => {
          this.pauseBlinkOn = !this.pauseBlinkOn;
          try { await this.drawPausedFrame(action, remaining, total, phase); } catch {}
        }, 600);
        // Do not persist runtime state to settings
      },
      showCompletionWithSound: async (kind: 'work' | 'break', durationMs: number) => {
        this.stopPauseBlink();
        // Start animation and sound in parallel; extend hold if sound is longer
        const anim = this.runCompletionAnimation(action, durationMs);
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
        const cfg = (this.currentSettings ?? settings) as WorkflowSettings;
        const fullTotal = durationForPhaseSec(phase, cfg);
        const endTime = Date.now() + durationSec * 1000;
        // Initialize cache for resume visualization
        this.lastRemaining = durationSec;
        this.lastTotal = fullTotal;
        this.lastPhase = phase;
        this.stopPauseBlink();
        this.logDebug('[TIMER] start', { phase, durationSec, fullTotal, endTime });
        // Do not persist runtime state to settings
        this.deps.timer.start(
          this.actionId,
          durationSec,
          async (remaining) => {
            this.logTrace('[TIMER] tick', { remaining });
            await (this.wf?.ctx ? this.createPorts(action, this.currentSettings ?? settings).updateRunning(remaining, fullTotal, phase) : Promise.resolve());
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

  init(action: any, settings: WorkflowSettings): void {
    // Always start new instances neutral (no persisted runtime state)
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
    this.wf = new Workflow(
      ctx,
      this.createPorts(action, settings),
      initial,
      undefined,
      { debug: (m: string, d?: unknown) => this.logDebug(m, d), trace: (m: string, d?: unknown) => this.logTrace(m, d) }
    );
  }

  async appear(action: any, settings: WorkflowSettings): Promise<void> {
    if (!this.wf) this.init(action, settings);
    this.currentSettings = settings;
    this.logDebug('[WF] appear', { wasRunning: this.wf!.ctx.running });
    await this.wf!.start();
    // No resume from persisted data
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
    // Prefer cached remaining from live ticks
    if (typeof this.lastRemaining === 'number') {
      this.logTrace('[WF] computeRemaining (cached)', { remaining: this.lastRemaining });
      return Math.max(0, this.lastRemaining);
    }
    const total = this.totalForPhase(phase, this.currentSettings ?? settings);
    this.logTrace('[WF] computeRemaining (default total)', { total });
    return total;
  }

  async shortPress(action: any, settings: WorkflowSettings): Promise<void> {
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

  async longPress(action: any, settings: WorkflowSettings): Promise<void> {
    if (!this.wf) this.init(action, settings);
    this.wf!.ctx.settings = settings;
    this.currentSettings = settings;
    this.logDebug('[INPUT] longPress (reset)');
    await this.wf!.dispatch({ type: 'LONG_PRESS' });
  }

  settingsChanged(action: any, settings: WorkflowSettings): void {
    if (!this.wf) this.init(action, settings);
    this.wf!.ctx.settings = settings;
    this.logDebug('[WF] settingsChanged', { pauseAtEnd: settings.pauseAtEndOfEachTimer, cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak });
    this.currentSettings = settings;
  }
}
