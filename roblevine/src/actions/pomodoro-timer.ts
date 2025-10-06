import { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { TimerManager } from "../lib/timer-manager";
import { DisplayGenerator } from "../lib/display-generator";
import { PomodoroCycle, type Phase, type CycleConfig, type CycleState } from "../lib/pomodoro-cycle";
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
	private messageObserver = new PluginMessageObserver(true); // Debug mode ON

	constructor() {
		super();

		// Register message handlers
		this.messageObserver.registerHandler('previewSound', (ctx, msg) =>
			handlePreviewSound(ctx, msg as any, this.messageObserver)
		);
		this.messageObserver.registerHandler('stopSound', (ctx, msg) =>
			handleStopSound(ctx, msg as any, this.messageObserver)
		);

		streamDeck.logger.info('[PomodoroTimer] Message handlers registered');
	}

	/**
	 * Initialize the timer display when the action appears
	 */
	override async onWillAppear(ev: WillAppearEvent<PomodoroSettings>): Promise<void> {
		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;

		// Initialize Pomodoro cycle settings with defaults
		const config: CycleConfig = {
			workDuration: settings.workDuration ?? '25:00',
			shortBreakDuration: settings.shortBreakDuration ?? '5:00',
			longBreakDuration: settings.longBreakDuration ?? '15:00',
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
				remainingTime: 25 * 60
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
	}

	/**
	 * Clean up timer when action disappears
	 */
	override onWillDisappear(ev: WillDisappearEvent<PomodoroSettings>): void {
		this.timerManager.cleanup(ev.action.id);
	}

	/**
	 * Handle settings changes from the property inspector
	 */
	override async onDidReceiveSettings(ev: any): Promise<void> {
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
	}

	/**
	 * Handle key press - start/stop timer
	 */
	override async onKeyDown(ev: KeyDownEvent<PomodoroSettings>): Promise<void> {
		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;

		if (isRunning) {
			// Stop the timer
			await this.stopTimer(ev.action.id, ev);
		} else {
			// Start the timer (5 minutes)
			await this.startNewTimer(ev.action.id, ev);
		}
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
			workDuration: settings.workDuration ?? '25:00',
			shortBreakDuration: settings.shortBreakDuration ?? '5:00',
			longBreakDuration: settings.longBreakDuration ?? '15:00',
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
			workDuration: settings.workDuration ?? '25:00',
			shortBreakDuration: settings.shortBreakDuration ?? '5:00',
			longBreakDuration: settings.longBreakDuration ?? '15:00',
			cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak ?? 4
		};

		// Calculate next phase
		const nextState = PomodoroCycle.getNextPhase(
			{ currentPhase, currentCycleIndex },
			config
		);

		// Play sound if enabled
		if (settings.enableSound) {
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
};