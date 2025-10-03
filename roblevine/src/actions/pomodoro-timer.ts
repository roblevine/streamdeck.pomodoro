import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Pomodoro timer action - configurable countdown timer
 */
@action({ UUID: "uk.co.roblevine.streamdeck.pomodoro.timer" })
export class PomodoroTimer extends SingletonAction<PomodoroSettings> {
	private timers: Map<string, NodeJS.Timeout> = new Map();
	private endTimes: Map<string, number> = new Map();
	private durations: Map<string, number> = new Map(); // Store duration per action instance

	/**
	 * Initialize the timer display when the action appears
	 */
	override async onWillAppear(ev: WillAppearEvent<PomodoroSettings>): Promise<void> {
		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;

		// Initialize Pomodoro cycle settings with defaults
		const workDuration = settings.workDuration ?? '25:00';
		const shortBreakDuration = settings.shortBreakDuration ?? '5:00';
		const longBreakDuration = settings.longBreakDuration ?? '15:00';
		const cyclesBeforeLongBreak = settings.cyclesBeforeLongBreak ?? 4;
		const currentCycleIndex = settings.currentCycleIndex ?? 0;
		const currentPhase = settings.currentPhase ?? 'work';

		// Calculate duration based on current phase
		const duration = this.getDurationForPhase(currentPhase, workDuration, shortBreakDuration, longBreakDuration) * 60;
		const remainingTime = settings.remainingTime ?? duration;

		// Store the duration for this action instance
		this.durations.set(ev.action.id, duration);

		// Ensure settings are initialized
		if (!settings.workDuration) {
			await ev.action.setSettings({
				...settings,
				workDuration: '25:00',
				shortBreakDuration: '5:00',
				longBreakDuration: '15:00',
				cyclesBeforeLongBreak: 4,
				currentCycleIndex: 0,
				currentPhase: 'work',
				remainingTime: 25 * 60
			});
		}

		if (isRunning && settings.endTime) {
			// Resume timer if it was running
			const now = Date.now();
			if (settings.endTime > now) {
				this.startTimer(ev.action.id, settings.endTime, ev, duration);
			} else {
				// Timer expired while action was hidden
				await this.completeTimer(ev.action.id, ev);
			}
		}

		// Always update display to ensure proper initialization
		await this.updateDisplay(ev.action, remainingTime, isRunning, duration, currentPhase);
	}

	/**
	 * Get duration in minutes for a given phase
	 */
	private getDurationForPhase(phase: 'work' | 'shortBreak' | 'longBreak', work: number | string, shortBreak: number | string, longBreak: number | string): number {
		const parseDuration = (value: number | string): number => {
			if (typeof value === 'number') {
				return value;
			}
			// Parse mm:ss format
			const parts = value.split(':');
			if (parts.length === 2) {
				const minutes = parseInt(parts[0], 10);
				const seconds = parseInt(parts[1], 10);
				return minutes + (seconds / 60);
			}
			// Fallback to parsing as number
			return parseFloat(value) || 0;
		};

		switch (phase) {
			case 'work': return parseDuration(work);
			case 'shortBreak': return parseDuration(shortBreak);
			case 'longBreak': return parseDuration(longBreak);
		}
	}

	/**
	 * Clean up timer when action disappears
	 */
	override onWillDisappear(ev: WillDisappearEvent<PomodoroSettings>): void {
		const timerId = this.timers.get(ev.action.id);
		if (timerId) {
			clearInterval(timerId);
			this.timers.delete(ev.action.id);
		}
		this.endTimes.delete(ev.action.id);
		this.durations.delete(ev.action.id);
	}

	/**
	 * Handle settings changes from the property inspector
	 */
	override async onDidReceiveSettings(ev: any): Promise<void> {
		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;
		const duration = settings.duration ?? 300;
		const remainingTime = settings.remainingTime ?? duration;

		// Update stored duration
		this.durations.set(ev.action.id, duration);

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
	 * Start a new timer with configured duration based on current phase
	 */
	private async startNewTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>): Promise<void> {
		const { settings } = ev.payload;
		const currentPhase = settings.currentPhase ?? 'work';
		const workDuration = settings.workDuration ?? '25:00';
		const shortBreakDuration = settings.shortBreakDuration ?? '5:00';
		const longBreakDuration = settings.longBreakDuration ?? '15:00';

		// Get duration in seconds for current phase
		const duration = this.getDurationForPhase(currentPhase, workDuration, shortBreakDuration, longBreakDuration) * 60;
		const endTime = Date.now() + duration * 1000;

		await ev.action.setSettings({
			...settings,
			isRunning: true,
			remainingTime: duration,
			endTime: endTime
		});

		this.durations.set(actionId, duration);
		this.startTimer(actionId, endTime, ev, duration);
	}

	/**
	 * Start or resume a timer
	 */
	private startTimer(actionId: string, endTime: number, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>, duration: number): void {
		// Clear any existing timer
		const existingTimer = this.timers.get(actionId);
		if (existingTimer) {
			clearInterval(existingTimer);
		}

		this.endTimes.set(actionId, endTime);
		this.durations.set(actionId, duration);

		// Update immediately to show the first frame
		const now = Date.now();
		const initialRemaining = Math.ceil((endTime - now) / 1000);
		const currentPhase = ev.payload.settings.currentPhase ?? 'work';
		this.updateDisplay(ev.action, initialRemaining, true, duration, currentPhase);

		// Update every second
		const timerId = setInterval(async () => {
			const now = Date.now();
			const remaining = Math.ceil((endTime - now) / 1000);
			const currentDuration = this.durations.get(actionId) ?? duration;
			const phase = ev.payload.settings.currentPhase ?? 'work';

			if (remaining <= 0) {
				// Show 0:00 before completing
				await this.updateDisplay(ev.action, 0, true, currentDuration, phase);
				await this.completeTimer(actionId, ev);
			} else {
				await this.updateDisplay(ev.action, remaining, true, currentDuration, phase);
				await ev.action.setSettings({
					...ev.payload.settings,
					remainingTime: remaining
				});
			}
		}, 1000);

		this.timers.set(actionId, timerId);
	}

	/**
	 * Stop the timer
	 */
	private async stopTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings>): Promise<void> {
		const timerId = this.timers.get(actionId);
		if (timerId) {
			clearInterval(timerId);
			this.timers.delete(actionId);
		}
		this.endTimes.delete(actionId);

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
	 * Play a sound file
	 */
	private async playSound(filePath: string): Promise<void> {
		if (!filePath) {
			return;
		}

		try {
			// Use different commands based on platform
			if (process.platform === 'win32') {
				// Windows: use PowerShell's SoundPlayer
				const command = `powershell -c "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`;
				await execAsync(command);
			} else if (process.platform === 'darwin') {
				// macOS: use afplay
				await execAsync(`afplay "${filePath}"`);
			} else {
				// Linux: try aplay (ALSA), fallback to paplay (PulseAudio)
				try {
					await execAsync(`aplay "${filePath}"`);
				} catch {
					await execAsync(`paplay "${filePath}"`);
				}
			}
		} catch (error) {
			// Silently fail if audio playback fails
			console.error('Failed to play sound:', error);
		}
	}

	/**
	 * Complete the timer and advance to next phase in cycle
	 */
	private async completeTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>): Promise<void> {
		const timerId = this.timers.get(actionId);
		if (timerId) {
			clearInterval(timerId);
			this.timers.delete(actionId);
		}
		this.endTimes.delete(actionId);

		const { settings } = ev.payload;
		const currentPhase = settings.currentPhase ?? 'work';
		const currentCycleIndex = settings.currentCycleIndex ?? 0;
		const cyclesBeforeLongBreak = settings.cyclesBeforeLongBreak ?? 4;
		const workDuration = settings.workDuration ?? '25:00';
		const shortBreakDuration = settings.shortBreakDuration ?? '5:00';
		const longBreakDuration = settings.longBreakDuration ?? '15:00';

		// Calculate next phase
		let nextPhase: 'work' | 'shortBreak' | 'longBreak';
		let nextCycleIndex = currentCycleIndex;

		if (currentPhase === 'work') {
			// After work, determine if it's time for long break
			nextCycleIndex = currentCycleIndex + 1;
			if (nextCycleIndex >= cyclesBeforeLongBreak) {
				nextPhase = 'longBreak';
				nextCycleIndex = 0; // Reset cycle count
			} else {
				nextPhase = 'shortBreak';
			}
		} else {
			// After any break, go back to work
			nextPhase = 'work';
		}

		// Play sound if enabled
		if (settings.enableSound) {
			if (currentPhase === 'work' && settings.workEndSoundPath) {
				// Work period just ended, play work end sound
				await this.playSound(settings.workEndSoundPath);
			} else if ((currentPhase === 'shortBreak' || currentPhase === 'longBreak') && settings.breakEndSoundPath) {
				// Break period just ended, play break end sound
				await this.playSound(settings.breakEndSoundPath);
			}
		}

		const nextDuration = this.getDurationForPhase(nextPhase, workDuration, shortBreakDuration, longBreakDuration) * 60;

		await ev.action.setSettings({
			...settings,
			isRunning: false,
			remainingTime: nextDuration,
			endTime: undefined,
			currentPhase: nextPhase,
			currentCycleIndex: nextCycleIndex
		});

		await ev.action.setTitle("Done!");

		// Reset display after 2 seconds
		setTimeout(async () => {
			await this.updateDisplay(ev.action, nextDuration, false, nextDuration, nextPhase);
		}, 2000);
	}

	/**
	 * Update the display with formatted time and donut circle
	 */
	private async updateDisplay(action: any, seconds: number, isRunning: boolean = false, totalDuration: number = 300, phase: 'work' | 'shortBreak' | 'longBreak' = 'work'): Promise<void> {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		const timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;

		// Generate SVG donut circle with phase indicator
		const svg = this.generateDonutSVG(seconds, totalDuration, isRunning, phase);

		// Convert SVG to base64 data URL
		const base64 = Buffer.from(svg).toString('base64');
		const dataUrl = `data:image/svg+xml;base64,${base64}`;

		await action.setImage(dataUrl);
		await action.setTitle(timeString);
	}

	/**
	 * Generate SVG donut circle that depletes as time runs out
	 */
	private generateDonutSVG(remainingSeconds: number, totalSeconds: number, isRunning: boolean, phase: 'work' | 'shortBreak' | 'longBreak' = 'work'): string {
		const size = 144; // Stream Deck button size
		const center = size / 2;
		const radius = 50;
		const strokeWidth = 16;

		// Calculate percentage remaining (0 to 1)
		const percentage = remainingSeconds / totalSeconds;

		// Determine color based on phase and state
		let color: string;
		if (!isRunning) {
			// Different colors for each phase when not running
			switch (phase) {
				case 'work':
					color = "#2196F3"; // Blue for work
					break;
				case 'shortBreak':
					color = "#4CAF50"; // Green for short break
					break;
				case 'longBreak':
					color = "#9C27B0"; // Purple for long break
					break;
			}
		} else {
			// When running, use phase color but with urgency indicators
			let baseColor: string;
			switch (phase) {
				case 'work':
					baseColor = "#2196F3"; // Blue for work
					break;
				case 'shortBreak':
					baseColor = "#4CAF50"; // Green for short break
					break;
				case 'longBreak':
					baseColor = "#9C27B0"; // Purple for long break
					break;
			}

			if (percentage <= 0.10) {
				color = "#F44336"; // Red when less than 10% left
			} else if (percentage <= 0.25) {
				color = "#FF9800"; // Orange when less than 25% left
			} else {
				color = baseColor;
			}
		}

		// Calculate the arc path
		// Start at top (12 o'clock) and go clockwise
		const startAngle = -90; // degrees
		const endAngle = startAngle + (360 * percentage);

		// Convert to radians
		const startRad = (startAngle * Math.PI) / 180;
		const endRad = (endAngle * Math.PI) / 180;

		// Calculate arc points
		const startX = center + radius * Math.cos(startRad);
		const startY = center + radius * Math.sin(startRad);
		const endX = center + radius * Math.cos(endRad);
		const endY = center + radius * Math.sin(endRad);

		// Determine if we need the large arc flag
		const largeArcFlag = percentage > 0.5 ? 1 : 0;

		// Build the path
		let path = '';
		if (percentage > 0) {
			if (percentage >= 0.999) {
				// Full circle - draw as two semicircles to avoid SVG arc rendering issues
				const bottomX = center;
				const bottomY = center + radius;
				path = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${bottomX} ${bottomY} A ${radius} ${radius} 0 0 1 ${startX} ${startY}`;
			} else {
				path = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
			}
		}

		return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${size}" height="${size}" fill="#1a1a1a"/>
			${path ? `<path d="${path}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"/>` : ''}
		</svg>`;
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
	currentPhase?: 'work' | 'shortBreak' | 'longBreak';
	// Audio settings
	enableSound?: boolean;
	workEndSoundPath?: string;
	breakEndSoundPath?: string;
};