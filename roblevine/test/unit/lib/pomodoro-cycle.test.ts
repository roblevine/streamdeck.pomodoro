import { describe, it, expect } from 'vitest';
import { PomodoroCycle, type Phase, type CycleState, type CycleConfig } from '../../../src/lib/pomodoro-cycle';

describe('PomodoroCycle', () => {
	describe('parseDuration', () => {
		describe('numeric input', () => {
			it('should return number as-is', () => {
				expect(PomodoroCycle.parseDuration(25)).toBe(25);
			});

			it('should handle zero', () => {
				expect(PomodoroCycle.parseDuration(0)).toBe(0);
			});

			it('should handle decimal values', () => {
				expect(PomodoroCycle.parseDuration(1.5)).toBe(1.5);
			});

			it('should handle large values', () => {
				expect(PomodoroCycle.parseDuration(90)).toBe(90);
			});
		});

		describe('string mm:ss format', () => {
			it('should parse "25:00" as 25 minutes', () => {
				expect(PomodoroCycle.parseDuration('25:00')).toBe(25);
			});

			it('should parse "5:00" as 5 minutes', () => {
				expect(PomodoroCycle.parseDuration('5:00')).toBe(5);
			});

			it('should parse "15:00" as 15 minutes', () => {
				expect(PomodoroCycle.parseDuration('15:00')).toBe(15);
			});

			it('should parse "1:30" as 1.5 minutes', () => {
				expect(PomodoroCycle.parseDuration('1:30')).toBe(1.5);
			});

			it('should parse "0:30" as 0.5 minutes', () => {
				expect(PomodoroCycle.parseDuration('0:30')).toBe(0.5);
			});

			it('should parse "0:00" as 0 minutes', () => {
				expect(PomodoroCycle.parseDuration('0:00')).toBe(0);
			});

			it('should parse "2:15" as 2.25 minutes', () => {
				expect(PomodoroCycle.parseDuration('2:15')).toBe(2.25);
			});

			it('should parse "10:45" as 10.75 minutes', () => {
				expect(PomodoroCycle.parseDuration('10:45')).toBe(10.75);
			});
		});

		describe('string numeric format', () => {
			it('should parse string number "25" as 25', () => {
				expect(PomodoroCycle.parseDuration('25')).toBe(25);
			});

			it('should parse string decimal "1.5" as 1.5', () => {
				expect(PomodoroCycle.parseDuration('1.5')).toBe(1.5);
			});
		});

		describe('invalid input', () => {
			it('should return 0 for invalid string', () => {
				expect(PomodoroCycle.parseDuration('invalid')).toBe(0);
			});

			it('should return 0 for empty string', () => {
				expect(PomodoroCycle.parseDuration('')).toBe(0);
			});

			it('should fallback to parseFloat for malformed mm:ss (extra colons)', () => {
				// "25:00:00" doesn't match mm:ss pattern, so falls back to parseFloat("25:00:00") = 25
				expect(PomodoroCycle.parseDuration('25:00:00')).toBe(25);
			});
		});
	});

	describe('getDurationForPhase', () => {
		const mockConfig: CycleConfig = {
			workDuration: '25:00',
			shortBreakDuration: '5:00',
			longBreakDuration: '15:00',
			cyclesBeforeLongBreak: 4
		};

		it('should return work duration for work phase', () => {
			expect(PomodoroCycle.getDurationForPhase('work', mockConfig)).toBe(25);
		});

		it('should return short break duration for shortBreak phase', () => {
			expect(PomodoroCycle.getDurationForPhase('shortBreak', mockConfig)).toBe(5);
		});

		it('should return long break duration for longBreak phase', () => {
			expect(PomodoroCycle.getDurationForPhase('longBreak', mockConfig)).toBe(15);
		});

		it('should handle numeric duration values', () => {
			const numericConfig: CycleConfig = {
				workDuration: 25,
				shortBreakDuration: 5,
				longBreakDuration: 15,
				cyclesBeforeLongBreak: 4
			};
			expect(PomodoroCycle.getDurationForPhase('work', numericConfig)).toBe(25);
			expect(PomodoroCycle.getDurationForPhase('shortBreak', numericConfig)).toBe(5);
			expect(PomodoroCycle.getDurationForPhase('longBreak', numericConfig)).toBe(15);
		});

		it('should handle mixed format durations', () => {
			const mixedConfig: CycleConfig = {
				workDuration: '25:00',
				shortBreakDuration: 5,
				longBreakDuration: '15:30',
				cyclesBeforeLongBreak: 4
			};
			expect(PomodoroCycle.getDurationForPhase('work', mixedConfig)).toBe(25);
			expect(PomodoroCycle.getDurationForPhase('shortBreak', mixedConfig)).toBe(5);
			expect(PomodoroCycle.getDurationForPhase('longBreak', mixedConfig)).toBe(15.5);
		});
	});

	describe('getNextPhase', () => {
		const mockConfig: CycleConfig = {
			workDuration: 25,
			shortBreakDuration: 5,
			longBreakDuration: 15,
			cyclesBeforeLongBreak: 4
		};

		describe('from work phase', () => {
			it('should transition to short break after first work session (cycle 0)', () => {
				const currentState: CycleState = {
					currentPhase: 'work',
					currentCycleIndex: 0
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentPhase).toBe('shortBreak');
				expect(nextState.currentCycleIndex).toBe(1);
			});

			it('should transition to short break after second work session (cycle 1)', () => {
				const currentState: CycleState = {
					currentPhase: 'work',
					currentCycleIndex: 1
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentPhase).toBe('shortBreak');
				expect(nextState.currentCycleIndex).toBe(2);
			});

			it('should transition to short break after third work session (cycle 2)', () => {
				const currentState: CycleState = {
					currentPhase: 'work',
					currentCycleIndex: 2
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentPhase).toBe('shortBreak');
				expect(nextState.currentCycleIndex).toBe(3);
			});

			it('should transition to long break after fourth work session (cycle 3)', () => {
				const currentState: CycleState = {
					currentPhase: 'work',
					currentCycleIndex: 3
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentPhase).toBe('longBreak');
				expect(nextState.currentCycleIndex).toBe(0);
			});

			it('should reset cycle index to 0 when transitioning to long break', () => {
				const currentState: CycleState = {
					currentPhase: 'work',
					currentCycleIndex: 3
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentCycleIndex).toBe(0);
			});
		});

		describe('from short break phase', () => {
			it('should transition to work after short break (cycle 1)', () => {
				const currentState: CycleState = {
					currentPhase: 'shortBreak',
					currentCycleIndex: 1
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentPhase).toBe('work');
				expect(nextState.currentCycleIndex).toBe(1);
			});

			it('should transition to work after short break (cycle 2)', () => {
				const currentState: CycleState = {
					currentPhase: 'shortBreak',
					currentCycleIndex: 2
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentPhase).toBe('work');
				expect(nextState.currentCycleIndex).toBe(2);
			});

			it('should preserve cycle index when transitioning from short break to work', () => {
				const currentState: CycleState = {
					currentPhase: 'shortBreak',
					currentCycleIndex: 1
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentCycleIndex).toBe(currentState.currentCycleIndex);
			});
		});

		describe('from long break phase', () => {
			it('should transition to work after long break', () => {
				const currentState: CycleState = {
					currentPhase: 'longBreak',
					currentCycleIndex: 0
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentPhase).toBe('work');
				expect(nextState.currentCycleIndex).toBe(0);
			});

			it('should preserve cycle index 0 when transitioning from long break to work', () => {
				const currentState: CycleState = {
					currentPhase: 'longBreak',
					currentCycleIndex: 0
				};
				const nextState = PomodoroCycle.getNextPhase(currentState, mockConfig);
				expect(nextState.currentCycleIndex).toBe(0);
			});
		});

		describe('with different cyclesBeforeLongBreak values', () => {
			it('should handle 2 cycles before long break', () => {
				const config: CycleConfig = {
					...mockConfig,
					cyclesBeforeLongBreak: 2
				};

				// Cycle 0: work -> short break
				let state: CycleState = { currentPhase: 'work', currentCycleIndex: 0 };
				state = PomodoroCycle.getNextPhase(state, config);
				expect(state).toEqual({ currentPhase: 'shortBreak', currentCycleIndex: 1 });

				// Cycle 1: work -> long break (cycle reset)
				state = { currentPhase: 'work', currentCycleIndex: 1 };
				state = PomodoroCycle.getNextPhase(state, config);
				expect(state).toEqual({ currentPhase: 'longBreak', currentCycleIndex: 0 });
			});

			it('should handle 6 cycles before long break', () => {
				const config: CycleConfig = {
					...mockConfig,
					cyclesBeforeLongBreak: 6
				};

				// Cycle 5: work -> long break
				const state: CycleState = { currentPhase: 'work', currentCycleIndex: 5 };
				const nextState = PomodoroCycle.getNextPhase(state, config);
				expect(nextState).toEqual({ currentPhase: 'longBreak', currentCycleIndex: 0 });
			});

			it('should handle 1 cycle before long break (every work followed by long break)', () => {
				const config: CycleConfig = {
					...mockConfig,
					cyclesBeforeLongBreak: 1
				};

				// Cycle 0: work -> long break
				const state: CycleState = { currentPhase: 'work', currentCycleIndex: 0 };
				const nextState = PomodoroCycle.getNextPhase(state, config);
				expect(nextState).toEqual({ currentPhase: 'longBreak', currentCycleIndex: 0 });
			});
		});

		describe('complete cycle sequences', () => {
			it('should complete a full 4-work-session cycle correctly', () => {
				let state: CycleState = { currentPhase: 'work', currentCycleIndex: 0 };

				// Work 1 -> Short Break 1
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'shortBreak', currentCycleIndex: 1 });

				// Short Break 1 -> Work 2
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'work', currentCycleIndex: 1 });

				// Work 2 -> Short Break 2
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'shortBreak', currentCycleIndex: 2 });

				// Short Break 2 -> Work 3
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'work', currentCycleIndex: 2 });

				// Work 3 -> Short Break 3
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'shortBreak', currentCycleIndex: 3 });

				// Short Break 3 -> Work 4
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'work', currentCycleIndex: 3 });

				// Work 4 -> Long Break (cycle reset)
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'longBreak', currentCycleIndex: 0 });

				// Long Break -> Work 1 (new cycle)
				state = PomodoroCycle.getNextPhase(state, mockConfig);
				expect(state).toEqual({ currentPhase: 'work', currentCycleIndex: 0 });
			});
		});
	});
});
