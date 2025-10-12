import { action, KeyDownEvent, KeyUpEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { TimerManager } from "../lib/timer-manager";
import { DisplayGenerator } from "../lib/display-generator";
import { PomodoroCycle, type Phase, type CycleConfig, type CycleState } from "../lib/pomodoro-cycle";
import { DEFAULT_CONFIG } from "../lib/defaults";
import { WorkflowController } from "../lib/workflow-controller";
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
    private readonly LONG_PRESS_MS = 2000;
    private longPressTimer: NodeJS.Timeout | null = null;
    private longPressFired: boolean = false;
    private lastTapAt: number | null = null;
    private singlePressTimer: NodeJS.Timeout | null = null;
    private readonly DOUBLE_TAP_MS = 320;
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
		// Ensure minimal defaults exist once
		if (!settings.workDuration) {
			const mergedDefaults: PomodoroSettings = {
				...DEFAULT_CONFIG,
				...settings
			};
			const cycleDefaults: CycleConfig = {
				workDuration: mergedDefaults.workDuration ?? DEFAULT_CONFIG.workDuration,
				shortBreakDuration: mergedDefaults.shortBreakDuration ?? DEFAULT_CONFIG.shortBreakDuration,
				longBreakDuration: mergedDefaults.longBreakDuration ?? DEFAULT_CONFIG.longBreakDuration,
				cyclesBeforeLongBreak: mergedDefaults.cyclesBeforeLongBreak ?? DEFAULT_CONFIG.cyclesBeforeLongBreak
			};
			await ev.action.setSettings({
				...mergedDefaults,
				currentCycleIndex: 0,
				currentPhase: 'work',
				remainingTime: PomodoroCycle.getDurationForPhase('work', cycleDefaults) * 60,
				isRunning: false
			});
		}

		// Initialize/workflow-driven appear (resume/expired/full display)
		try {
			const controller = this.getController(ev.action.id);
			await controller.appear(ev.action, this.extractWorkflowSettings(settings));
		} catch (err) {
			// Non-fatal: controller is additive for now
			streamDeck.logger.debug('WorkflowController.appear failed (non-fatal)', err as any);
		}
	}

	/**
	 * Clean up timer when action disappears
	 */
	override onWillDisappear(ev: WillDisappearEvent<PomodoroSettings>): void {
		// Do not cleanup to allow in-session resume across appear/disappear.
		// Cleanup happens on plugin shutdown or when intentionally resetting via long press.
	}

	/**
	 * Handle settings changes from the property inspector
	 */
	override async onDidReceiveSettings(ev: any): Promise<void> {
		// Settings received from property inspector

		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;
		const duration = settings.duration ?? 300;

		// Note: duration persistence removed; controller manages runtime only

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
		// Start long-press watchdog to trigger reset without relying on keyup timing
		try { if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; } } catch {}
		this.longPressFired = false;
		try { streamDeck.logger.trace('[INPUT] keyDown'); } catch {}
		const settingsForPress = this.extractWorkflowSettings(ev.payload.settings);
		const actionRef = ev.action;
		this.longPressTimer = setTimeout(async () => {
			this.longPressFired = true;
			try { streamDeck.logger.trace('[INPUT] longPress watchdog fired'); } catch {}
			try {
				await this.getController(actionRef.id).longPress(actionRef, settingsForPress);
			} catch {}
		}, this.LONG_PRESS_MS);
	}

	/**
	 * Classify short vs long press and dispatch behavior.
	 */
    override async onKeyUp(ev: KeyUpEvent<PomodoroSettings>): Promise<void> {
        const startedAt = this.keyDownAt;
        this.keyDownAt = null;
        if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
        if (this.longPressFired) { this.longPressFired = false; return; }
        const now = Date.now();
        const elapsed = startedAt ? now - startedAt : 0;
        try { streamDeck.logger.trace('[INPUT] keyUp', { elapsed }); } catch {}
        const controller = this.getController(ev.action.id);
        if (elapsed >= this.LONG_PRESS_MS) {
            await controller.longPress(ev.action, this.extractWorkflowSettings(ev.payload.settings));
            return;
        }

        // Double-press detection window
        const prev = this.lastTapAt;
        const withinWindow = typeof prev === 'number' && (now - prev) <= this.DOUBLE_TAP_MS;
        const settings = this.extractWorkflowSettings(ev.payload.settings);
        if (withinWindow) {
            // Second tap: fire DOUBLE and cancel pending single
            this.lastTapAt = null;
            if (this.singlePressTimer) { try { clearTimeout(this.singlePressTimer); } catch {} this.singlePressTimer = null; }
            try { streamDeck.logger.trace('[INPUT] doublePress'); } catch {}
            await controller.doublePress(ev.action, settings);
        } else {
            // First tap: queue single, allow brief time for a second tap
            this.lastTapAt = now;
            if (this.singlePressTimer) { try { clearTimeout(this.singlePressTimer); } catch {} this.singlePressTimer = null; }
            this.singlePressTimer = setTimeout(async () => {
                this.lastTapAt = null;
                this.singlePressTimer = null;
                try { streamDeck.logger.trace('[INPUT] shortPress (after double window)'); } catch {}
                await controller.shortPress(ev.action, settings);
            }, this.DOUBLE_TAP_MS + 20);
        }
    }


	private extractWorkflowSettings(settings: PomodoroSettings) {
		// Normalize toggles from PI which may arrive as string 'true'/'false'
		const enableSound = (settings as any).enableSound === true || (settings as any).enableSound === 'true';
		const pauseSetting = (settings as any).pauseAtEndOfEachTimer;
		const pauseAtEnd = pauseSetting === true || pauseSetting === 'true'
			? true
			: (pauseSetting === false || pauseSetting === 'false'
				? false
				: DEFAULT_CONFIG.pauseAtEndOfEachTimer);
		// Normalize number field that may arrive as string
		let cycles = (settings as any).cyclesBeforeLongBreak;
		if (typeof cycles === 'string') {
			const parsed = parseInt(cycles, 10);
			cycles = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONFIG.cyclesBeforeLongBreak;
		} else if (typeof cycles !== 'number' || !Number.isFinite(cycles) || cycles <= 0) {
			cycles = DEFAULT_CONFIG.cyclesBeforeLongBreak;
		}
		// Completion hold seconds
		let completionHoldSeconds = (settings as any).completionHoldSeconds;
		if (typeof completionHoldSeconds === 'string') {
			const parsed = parseFloat(completionHoldSeconds);
			completionHoldSeconds = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CONFIG.completionHoldSeconds;
		} else if (typeof completionHoldSeconds !== 'number' || !Number.isFinite(completionHoldSeconds) || completionHoldSeconds < 0) {
			completionHoldSeconds = DEFAULT_CONFIG.completionHoldSeconds;
		}
		return {
			workDuration: settings.workDuration ?? (DEFAULT_CONFIG.workDuration as any),
			shortBreakDuration: settings.shortBreakDuration ?? (DEFAULT_CONFIG.shortBreakDuration as any),
			longBreakDuration: settings.longBreakDuration ?? (DEFAULT_CONFIG.longBreakDuration as any),
			cyclesBeforeLongBreak: cycles as number,
			pauseAtEndOfEachTimer: pauseAtEnd,
			enableSound,
			workEndSoundPath: settings.workEndSoundPath,
			breakEndSoundPath: settings.breakEndSoundPath,
			completionHoldSeconds: completionHoldSeconds as number
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
	completionHoldSeconds?: number;
};
