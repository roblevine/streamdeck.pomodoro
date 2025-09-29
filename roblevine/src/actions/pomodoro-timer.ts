import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

/**
 * Pomodoro timer action - 5 minute countdown timer
 */
@action({ UUID: "uk.co.roblevine.streamdeck.pomodoro.timer" })
export class PomodoroTimer extends SingletonAction<PomodoroSettings> {
	private timers: Map<string, NodeJS.Timeout> = new Map();
	private endTimes: Map<string, number> = new Map();
	private readonly totalDuration = 5 * 60; // 5 minutes in seconds

	/**
	 * Initialize the timer display when the action appears
	 */
	override async onWillAppear(ev: WillAppearEvent<PomodoroSettings>): Promise<void> {
		const { settings } = ev.payload;
		const isRunning = settings.isRunning ?? false;
		const remainingTime = settings.remainingTime ?? 300; // Default 5 minutes

		if (isRunning && settings.endTime) {
			// Resume timer if it was running
			const now = Date.now();
			if (settings.endTime > now) {
				this.startTimer(ev.action.id, settings.endTime, ev);
			} else {
				// Timer expired while action was hidden
				await this.completeTimer(ev.action.id, ev);
			}
		} else {
			await this.updateDisplay(ev.action, remainingTime);
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
	 * Start a new 5-minute timer
	 */
	private async startNewTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>): Promise<void> {
		const duration = 5 * 60; // 5 minutes in seconds
		const endTime = Date.now() + duration * 1000;

		await ev.action.setSettings({
			...ev.payload.settings,
			isRunning: true,
			remainingTime: duration,
			endTime: endTime
		});

		this.startTimer(actionId, endTime, ev);
	}

	/**
	 * Start or resume a timer
	 */
	private startTimer(actionId: string, endTime: number, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>): void {
		// Clear any existing timer
		const existingTimer = this.timers.get(actionId);
		if (existingTimer) {
			clearInterval(existingTimer);
		}

		this.endTimes.set(actionId, endTime);

		// Update every second
		const timerId = setInterval(async () => {
			const now = Date.now();
			const remaining = Math.ceil((endTime - now) / 1000);

			if (remaining <= 0) {
				await this.completeTimer(actionId, ev);
			} else {
				await this.updateDisplay(ev.action, remaining);
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

		const remainingTime = ev.payload.settings.remainingTime ?? 300;

		await ev.action.setSettings({
			...ev.payload.settings,
			isRunning: false,
			endTime: undefined
		});

		await this.updateDisplay(ev.action, remainingTime);
	}

	/**
	 * Complete the timer
	 */
	private async completeTimer(actionId: string, ev: KeyDownEvent<PomodoroSettings> | WillAppearEvent<PomodoroSettings>): Promise<void> {
		const timerId = this.timers.get(actionId);
		if (timerId) {
			clearInterval(timerId);
			this.timers.delete(actionId);
		}
		this.endTimes.delete(actionId);

		await ev.action.setSettings({
			...ev.payload.settings,
			isRunning: false,
			remainingTime: 300,
			endTime: undefined
		});

		await ev.action.setTitle("Done!");
		await ev.action.showAlert();

		// Reset display after 2 seconds
		setTimeout(async () => {
			await this.updateDisplay(ev.action, 300);
		}, 2000);
	}

	/**
	 * Update the display with formatted time and donut circle
	 */
	private async updateDisplay(action: any, seconds: number): Promise<void> {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		const timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;

		// Generate SVG donut circle
		const svg = this.generateDonutSVG(seconds, this.totalDuration);

		// Convert SVG to base64 data URL
		const base64 = Buffer.from(svg).toString('base64');
		const dataUrl = `data:image/svg+xml;base64,${base64}`;

		await action.setImage(dataUrl);
		await action.setTitle(timeString);
	}

	/**
	 * Generate SVG donut circle that depletes as time runs out
	 */
	private generateDonutSVG(remainingSeconds: number, totalSeconds: number): string {
		const size = 144; // Stream Deck button size
		const center = size / 2;
		const radius = 50;
		const strokeWidth = 16;

		// Calculate percentage remaining (0 to 1)
		const percentage = remainingSeconds / totalSeconds;

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
			if (percentage === 1) {
				// Full circle - need to draw as two arcs
				const midX = center + radius * Math.cos(0);
				const midY = center + radius * Math.sin(0);
				path = `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${midX} ${midY} A ${radius} ${radius} 0 1 1 ${startX} ${startY}`;
			} else {
				path = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
			}
		}

		return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${size}" height="${size}" fill="#1a1a1a"/>
			${path ? `<path d="${path}" stroke="#4CAF50" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"/>` : ''}
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
};