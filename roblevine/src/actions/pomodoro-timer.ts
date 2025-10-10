import { action, KeyDownEvent, KeyUpEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { TimerManager } from "../lib/timer-manager";
import { DisplayGenerator } from "../lib/display-generator";
import { PomodoroCycle, type Phase, type CycleConfig, type CycleState } from "../lib/pomodoro-cycle";
import { WorkflowController } from "../lib/workflow-controller";
import { AudioPlayer } from "../lib/audio-player";
import { PluginMessageObserver } from "../lib/plugin-message-observer";
import { handlePreviewSound } from "../lib/message-handlers/preview-sound-handler";
import { handleStopSound } from "../lib/message-handlers/stop-sound-handler";
import type { PropertyInspectorMessage } from "../types/messages";

/**
 * Pomodoro timer action - configurable countdown timer
 */
@action({ UUID: "uk.co.roblevine.streamdeck.pomodoro.timer" })
export class PomodoroTimer extends SingletonAction<PomodoroSettings> {
	private timerManager = new TimerManager();
	private displayGenerator = new DisplayGenerator();
	private messageObserver = new PluginMessageObserver(false);
    private keyDownAt: number | null = null;
    private readonly LONG_PRESS_MS = 700;
    private controllers: Map<string, WorkflowController> = new Map();

    private getController(actionId: string): WorkflowController {
        let c = this.controllers.get(actionId);
        if (!c) {
            c = new WorkflowController(actionId, { timer: this.timerManager, display: this.displayGenerator });
            this.controllers.set(actionId, c);
        }
        return c;
    }

	constructor() {
		super();

		// Register message handlers
		this.messageObserver.registerHandler('previewSound', (ctx, msg) =>
			handlePreviewSound(ctx, msg as any, this.messageObserver)
		);
		this.messageObserver.registerHandler('stopSound', (ctx, msg) =>
			handleStopSound(ctx, msg as any, this.messageObserver)
		);

		// Message handlers registered
	}

	/**
	 * Initialize the timer display when the action appears
	 */
	override async onWillAppear(ev: WillAppearEvent<PomodoroSettings>): Promise<void> {
		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;

		// Initialize Pomodoro cycle settings with defaults
		const config: CycleConfig = {
			workDuration: settings.workDuration ?? '00:10',
			shortBreakDuration: settings.shortBreakDuration ?? '00:02',
			longBreakDuration: settings.longBreakDuration ?? '00:05',
			cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak ?? 4
		};
		const currentPhase = settings.currentPhase ?? 'work';

		// Calculate duration based on current phase
		const duration = PomodoroCycle.getDurationForPhase(currentPhase, config) * 60;
		const remainingTime = settings.remainingTime ?? duration;

		// Store the duration for this action instance
		this.timerManager.setDuration(ev.action.id, duration);

		// Ensure settings are initialized
		if (!settings.workDuration) {
			await ev.action.setSettings({
				...settings,
				...config,
				currentCycleIndex: 0,
				currentPhase: 'work',
				remainingTime: 10
			});
		}

		if (isRunning && settings.endTime) {
			// Resume timer if it was running
			const now = Date.now();
			if (settings.endTime > now) {
				this.timerManager.resume(
					ev.action.id,
					settings.endTime,
					duration,
					async (remaining) => {
						await this.updateDisplay(ev.action, remaining, true, duration, currentPhase);
						await ev.action.setSettings({ ...settings, remainingTime: remaining });
					},
					() => this.completeTimer(ev.action.id, ev)
				);
			} else {
				// Timer expired while action was hidden
				await this.completeTimer(ev.action.id, ev);
			}
		}

		// Always update display to ensure proper initialization
		await this.updateDisplay(ev.action, remainingTime, isRunning, duration, currentPhase);

		// Initialize workflow controller (scaffold)
		try {
			const controller = this.getController(ev.action.id);
			await controller.appear(ev.action, {
				workDuration: settings.workDuration ?? '00:10',
				shortBreakDuration: settings.shortBreakDuration ?? '00:02',
				longBreakDuration: settings.longBreakDuration ?? '00:05',
				cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak ?? 4,
				pauseAtEndOfEachTimer: settings.pauseAtEndOfEachTimer ?? true,
				enableSound: settings.enableSound,
				workEndSoundPath: settings.workEndSoundPath,
				breakEndSoundPath: settings.breakEndSoundPath
			});
		} catch (err) {
			// Non-fatal: controller is additive for now
			streamDeck.logger.debug('WorkflowController.appear failed (non-fatal)', err as any);
		}
	}

	/**
	 * Clean up timer when action disappears
	 */
	override onWillDisappear(ev: WillDisappearEvent<PomodoroSettings>): void {
		this.timerManager.cleanup(ev.action.id);
		this.controllers.delete(ev.action.id);
	}

	/**
	 * Handle settings changes from the property inspector
	 */
	override async onDidReceiveSettings(ev: any): Promise<void> {
		// Settings received from property inspector

		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;
		const duration = settings.duration ?? 300;

		// Update stored duration
		this.timerManager.setDuration(ev.action.id, duration);

		// Only update display if timer is not running
		if (!isRunning) {
			const currentPhase = settings.currentPhase ?? 'work';
			await this.updateDisplay(ev.action, duration, false, duration, currentPhase);
		}

		// Inform workflow controller of settings change (non-breaking)
		try {
			this.getController(ev.action.id).settingsChanged(ev.action, this.extractWorkflowSettings(settings));
		} catch {}
	}

	/**
	 * Record key down time for press classification.
	 */
	override async onKeyDown(ev: KeyDownEvent<PomodoroSettings>): Promise<void> {
		this.keyDownAt = Date.now();
	}

	/**
	 * Classify short vs long press and dispatch behavior.
	 */
	override async onKeyUp(ev: KeyUpEvent<PomodoroSettings>): Promise<void> {
		const startedAt = this.keyDownAt;
		this.keyDownAt = null;
		const elapsed = startedAt ? Date.now() - startedAt : 0;
		const controller = this.getController(ev.action.id);
		if (elapsed >= this.LONG_PRESS_MS) {
			await controller.longPress(ev.action, this.extractWorkflowSettings(ev.payload.settings));
		} else {
			await controller.shortPress(ev.action, this.extractWorkflowSettings(ev.payload.settings));
		}
	}


	private extractWorkflowSettings(settings: PomodoroSettings) {
		return {
			workDuration: settings.workDuration ?? '00:10',
			shortBreakDuration: settings.shortBreakDuration ?? '00:02',
			longBreakDuration: settings.longBreakDuration ?? '00:05',
			cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak ?? 4,
			pauseAtEndOfEachTimer: settings.pauseAtEndOfEachTimer ?? true,
			enableSound: settings.enableSound,
			workEndSoundPath: settings.workEndSoundPath,
			breakEndSoundPath: settings.breakEndSoundPath
		};
	}

	/**
	 * Handle messages from the property inspector
	 */
	override async onSendToPlugin(ev: SendToPluginEvent<any, PomodoroSettings>): Promise<void> {
		// Delegate all messages to the message observer
		await this.messageObserver.handleMessage(ev.action.id, ev.payload as PropertyInspectorMessage);
	}

	/**
	 * Start a new timer with configured duration based on current phase
	 */
	private async startNewTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>): Promise<void> {
		const { settings } = ev.payload;
		const currentPhase = settings.currentPhase ?? 'work';
		const config: CycleConfig = {
			workDuration: settings.workDuration ?? '00:10',
			shortBreakDuration: settings.shortBreakDuration ?? '00:02',
			longBreakDuration: settings.longBreakDuration ?? '00:05',
			cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak ?? 4
		};

		// Get duration in seconds for current phase
		const duration = PomodoroCycle.getDurationForPhase(currentPhase, config) * 60;
		const endTime = Date.now() + duration * 1000;

		await ev.action.setSettings({
			...settings,
			isRunning: true,
			remainingTime: duration,
			endTime: endTime
		});

		this.timerManager.setDuration(actionId, duration);
		this.timerManager.start(
			actionId,
			duration,
			async (remaining) => {
				await this.updateDisplay(ev.action, remaining, true, duration, currentPhase);
				await ev.action.setSettings({ ...settings, remainingTime: remaining });
			},
			() => this.completeTimer(actionId, ev)
		);
	}

	/**
	 * Stop the timer
	 */
	private async stopTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings>): Promise<void> {
		this.timerManager.stop(actionId);

		const duration = ev.payload.settings.duration ?? 300;
		const remainingTime = ev.payload.settings.remainingTime ?? duration;
		const currentPhase = ev.payload.settings.currentPhase ?? 'work';

		await ev.action.setSettings({
			...ev.payload.settings,
			isRunning: false,
			endTime: undefined
		});

		await this.updateDisplay(ev.action, remainingTime, false, duration, currentPhase);
	}

	/**
	 * Complete the timer and advance to next phase in cycle
	 */
	private async completeTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>): Promise<void> {
		this.timerManager.stop(actionId);

		const { settings } = ev.payload;
		const currentPhase = settings.currentPhase ?? 'work';
		const currentCycleIndex = settings.currentCycleIndex ?? 0;
		const config: CycleConfig = {
			workDuration: settings.workDuration ?? '00:10',
			shortBreakDuration: settings.shortBreakDuration ?? '00:02',
			longBreakDuration: settings.longBreakDuration ?? '00:05',
			cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak ?? 4
		};

		// Calculate next phase
		const nextState = PomodoroCycle.getNextPhase(
			{ currentPhase, currentCycleIndex },
			config
		);

		// Play sound if enabled (accept boolean or 'true' string)
		const soundOn = settings.enableSound === true || (settings as any).enableSound === 'true';
		if (soundOn) {
			if (currentPhase === 'work' && settings.workEndSoundPath) {
				await AudioPlayer.play(settings.workEndSoundPath, 'timer-completion');
			} else if ((currentPhase === 'shortBreak' || currentPhase === 'longBreak') && settings.breakEndSoundPath) {
				await AudioPlayer.play(settings.breakEndSoundPath, 'timer-completion');
			}
		}

		const nextDuration = PomodoroCycle.getDurationForPhase(nextState.currentPhase, config) * 60;

		await ev.action.setSettings({
			...settings,
			isRunning: false,
			remainingTime: nextDuration,
			endTime: undefined,
			currentPhase: nextState.currentPhase,
			currentCycleIndex: nextState.currentCycleIndex
		});

		await ev.action.setTitle("Done!");

		// Reset display after 2 seconds
		setTimeout(async () => {
			await this.updateDisplay(ev.action, nextDuration, false, nextDuration, nextState.currentPhase);
		}, 2000);
	}

	/**
	 * Update the display with formatted time and donut circle
	 */
	private async updateDisplay(action: any, seconds: number, isRunning: boolean = false, totalDuration: number = 300, phase: Phase = 'work'): Promise<void> {
		const timeString = this.displayGenerator.formatTime(seconds);
		const svg = this.displayGenerator.generateDonutSVG(seconds, totalDuration, isRunning, phase);
		const dataUrl = this.displayGenerator.svgToDataUrl(svg);

		await action.setImage(dataUrl);
		await action.setTitle(timeString);
	}
}

/**
 * Settings for {@link PomodoroTimer}.
 */
type PomodoroSettings = {
	isRunning?: boolean;
	remainingTime?: number;
	endTime?: number;
	duration?: number;
	// Pomodoro cycle configuration (can be number in minutes or string in mm:ss format)
	workDuration?: number | string;
	shortBreakDuration?: number | string;
	longBreakDuration?: number | string;
	cyclesBeforeLongBreak?: number;
	// Current cycle state
	currentCycleIndex?: number; // Which step in the cycle (0-based)
	currentPhase?: Phase;
	// Audio settings
	enableSound?: boolean;
	workEndSoundPath?: string;
	breakEndSoundPath?: string;
    // Workflow policy
    pauseAtEndOfEachTimer?: boolean;
};
