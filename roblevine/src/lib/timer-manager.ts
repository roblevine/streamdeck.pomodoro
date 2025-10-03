/**
 * Manages timer state and lifecycle for action instances
 */
export class TimerManager {
	private timers: Map<string, NodeJS.Timeout> = new Map();
	private endTimes: Map<string, number> = new Map();
	private durations: Map<string, number> = new Map();

	/**
	 * Start a new timer for an action instance
	 */
	start(
		actionId: string,
		durationSeconds: number,
		onTick: (remainingSeconds: number) => Promise<void>,
		onComplete: () => Promise<void>
	): void {
		this.stop(actionId);

		const endTime = Date.now() + durationSeconds * 1000;
		this.endTimes.set(actionId, endTime);
		this.durations.set(actionId, durationSeconds);

		// Initial tick
		const initialRemaining = Math.ceil((endTime - Date.now()) / 1000);
		onTick(initialRemaining);

		// Update every second
		const timerId = setInterval(async () => {
			const now = Date.now();
			const remaining = Math.ceil((endTime - now) / 1000);

			if (remaining <= 0) {
				await onTick(0);
				await onComplete();
			} else {
				await onTick(remaining);
			}
		}, 1000);

		this.timers.set(actionId, timerId);
	}

	/**
	 * Resume a timer from a saved end time
	 */
	resume(
		actionId: string,
		endTime: number,
		durationSeconds: number,
		onTick: (remainingSeconds: number) => Promise<void>,
		onComplete: () => Promise<void>
	): void {
		const now = Date.now();
		if (endTime <= now) {
			// Already expired
			onComplete();
			return;
		}

		const remainingSeconds = Math.ceil((endTime - now) / 1000);
		this.start(actionId, remainingSeconds, onTick, onComplete);
	}

	/**
	 * Stop a timer
	 */
	stop(actionId: string): void {
		const timerId = this.timers.get(actionId);
		if (timerId) {
			clearInterval(timerId);
			this.timers.delete(actionId);
		}
		this.endTimes.delete(actionId);
	}

	/**
	 * Check if a timer is running
	 */
	isRunning(actionId: string): boolean {
		return this.timers.has(actionId);
	}

	/**
	 * Get the stored duration for an action
	 */
	getDuration(actionId: string): number | undefined {
		return this.durations.get(actionId);
	}

	/**
	 * Set the stored duration for an action
	 */
	setDuration(actionId: string, durationSeconds: number): void {
		this.durations.set(actionId, durationSeconds);
	}

	/**
	 * Clean up all state for an action
	 */
	cleanup(actionId: string): void {
		this.stop(actionId);
		this.durations.delete(actionId);
	}
}
