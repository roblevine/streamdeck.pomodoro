/**
 * Manages timer state and lifecycle for action instances
 */
export class TimerManager {
	private timers: Map<string, NodeJS.Timeout> = new Map();

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
	 * Stop a timer
	 */
	stop(actionId: string): void {
		const timerId = this.timers.get(actionId);
		if (timerId) {
			clearInterval(timerId);
			this.timers.delete(actionId);
		}
	}

	/**
	 * Check if a timer is running
	 */
	isRunning(actionId: string): boolean {
		return this.timers.has(actionId);
	}

	/**
	 * Clean up all state for an action
	 */
	cleanup(actionId: string): void {
		this.stop(actionId);
	}
}
