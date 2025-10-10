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
      },
      updateRunning: async (remaining: number, total: number, phase: Phase) => {
        const svg = this.deps.display.generateDonutSVG(remaining, total, true, phase);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await action.setImage(dataUrl);
        await action.setTitle(this.deps.display.formatTime(remaining));
      },
      showPaused: async (remaining: number, total: number, phase: Phase) => {
        const svg = this.deps.display.generateDonutSVG(remaining, total, false, phase);
        const dataUrl = this.deps.display.svgToDataUrl(svg);
        await action.setImage(dataUrl);
        await action.setTitle(this.deps.display.formatTime(remaining));
      },
      startTimer: (phase: Phase, durationSec: number, onDone: () => void) => {
        tickRef && (tickRef.total = durationSec);
        this.deps.timer.setDuration(this.actionId, durationSec);
        this.deps.timer.start(
          this.actionId,
          durationSec,
          async (remaining) => {
            await action.setSettings({ ...settings, isRunning: true, remainingTime: remaining });
            await (this.wf?.ctx ? this.createPorts(action, settings).updateRunning(remaining, durationSec, phase) : Promise.resolve());
          },
          async () => { onDone(); }
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
}

