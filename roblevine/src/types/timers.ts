/**
 * Timer system abstraction for testability
 */
export interface ITimerSystem {
	setInterval(callback: () => void, ms: number): NodeJS.Timeout;
	clearInterval(timer: NodeJS.Timeout): void;
	now(): number;
}

/**
 * Default implementation using global timer functions
 */
export const globalTimers: ITimerSystem = {
	setInterval: (callback, ms) => setInterval(callback, ms),
	clearInterval: (timer) => clearInterval(timer),
	now: () => Date.now()
};
