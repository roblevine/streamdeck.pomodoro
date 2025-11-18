import type { ITimerSystem } from '../../src/types/timers';

interface ScheduledCallback {
	id: number;
	callback: () => void;
	intervalMs: number;
	nextExecutionTime: number;
	isInterval: boolean;
}

/**
 * Fake clock for testing timer-based code
 * Allows controlling time progression in tests
 */
export class FakeClock implements ITimerSystem {
	private currentTime = 0;
	private nextId = 1;
	private scheduled: Map<number, ScheduledCallback> = new Map();

	/**
	 * Get current fake time
	 */
	now(): number {
		return this.currentTime;
	}

	/**
	 * Schedule an interval callback
	 */
	setInterval(callback: () => void, ms: number): NodeJS.Timeout {
		const id = this.nextId++;
		this.scheduled.set(id, {
			id,
			callback,
			intervalMs: ms,
			nextExecutionTime: this.currentTime + ms,
			isInterval: true
		});
		return id as unknown as NodeJS.Timeout;
	}

	/**
	 * Clear an interval
	 */
	clearInterval(timer: NodeJS.Timeout): void {
		const id = timer as unknown as number;
		this.scheduled.delete(id);
	}

	/**
	 * Advance time by specified milliseconds and execute due callbacks
	 */
	tick(ms: number): void {
		const targetTime = this.currentTime + ms;

		while (this.currentTime < targetTime) {
			// Find all callbacks that should execute at the next time point
			let nextTime = targetTime;

			for (const scheduled of this.scheduled.values()) {
				if (scheduled.nextExecutionTime < nextTime) {
					nextTime = scheduled.nextExecutionTime;
				}
			}

			// Advance to next execution time
			this.currentTime = nextTime;

			// Execute all callbacks due at this time
			const callbacksToExecute: ScheduledCallback[] = [];
			for (const scheduled of this.scheduled.values()) {
				if (scheduled.nextExecutionTime <= this.currentTime) {
					callbacksToExecute.push(scheduled);
				}
			}

			// Execute callbacks
			for (const callback of callbacksToExecute) {
				callback.callback();

				// Reschedule if it's an interval
				if (callback.isInterval && this.scheduled.has(callback.id)) {
					callback.nextExecutionTime = this.currentTime + callback.intervalMs;
				} else {
					this.scheduled.delete(callback.id);
				}
			}

			// If no callbacks were executed, we've reached the target time
			if (callbacksToExecute.length === 0) {
				break;
			}
		}

		this.currentTime = targetTime;
	}

	/**
	 * Reset the clock to time 0 and clear all scheduled callbacks
	 */
	reset(): void {
		this.currentTime = 0;
		this.scheduled.clear();
		this.nextId = 1;
	}

	/**
	 * Get count of scheduled timers (for testing)
	 */
	getScheduledCount(): number {
		return this.scheduled.size;
	}
}
