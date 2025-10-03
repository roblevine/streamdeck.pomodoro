/**
 * Manages Pomodoro cycle logic and phase transitions
 */
export type Phase = 'work' | 'shortBreak' | 'longBreak';

export interface CycleState {
	currentPhase: Phase;
	currentCycleIndex: number;
}

export interface CycleConfig {
	workDuration: number | string;
	shortBreakDuration: number | string;
	longBreakDuration: number | string;
	cyclesBeforeLongBreak: number;
}

export class PomodoroCycle {
	/**
	 * Parse duration value (supports both number and mm:ss string format)
	 */
	static parseDuration(value: number | string): number {
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
	}

	/**
	 * Get duration in minutes for a given phase
	 */
	static getDurationForPhase(phase: Phase, config: CycleConfig): number {
		switch (phase) {
			case 'work':
				return this.parseDuration(config.workDuration);
			case 'shortBreak':
				return this.parseDuration(config.shortBreakDuration);
			case 'longBreak':
				return this.parseDuration(config.longBreakDuration);
		}
	}

	/**
	 * Calculate the next phase in the Pomodoro cycle
	 */
	static getNextPhase(currentState: CycleState, config: CycleConfig): CycleState {
		const { currentPhase, currentCycleIndex } = currentState;
		const { cyclesBeforeLongBreak } = config;

		if (currentPhase === 'work') {
			// After work, determine if it's time for long break
			const nextCycleIndex = currentCycleIndex + 1;
			if (nextCycleIndex >= cyclesBeforeLongBreak) {
				return {
					currentPhase: 'longBreak',
					currentCycleIndex: 0 // Reset cycle count
				};
			} else {
				return {
					currentPhase: 'shortBreak',
					currentCycleIndex: nextCycleIndex
				};
			}
		} else {
			// After any break, go back to work
			return {
				currentPhase: 'work',
				currentCycleIndex
			};
		}
	}

	/**
	 * Get default cycle configuration
	 */
	static getDefaultConfig(): CycleConfig {
		return {
			workDuration: '25:00',
			shortBreakDuration: '5:00',
			longBreakDuration: '15:00',
			cyclesBeforeLongBreak: 4
		};
	}

	/**
	 * Get default cycle state
	 */
	static getDefaultState(): CycleState {
		return {
			currentPhase: 'work',
			currentCycleIndex: 0
		};
	}
}
