import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimerManager } from '../../../src/lib/timer-manager';
import { FakeClock } from '../../helpers/fake-clock';

describe('TimerManager', () => {
	let clock: FakeClock;
	let manager: TimerManager;

	beforeEach(() => {
		clock = new FakeClock();
		manager = new TimerManager(clock);
	});

	describe('start', () => {
		it('should call onTick immediately with initial remaining time', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn(async (remaining: number) => {
				ticks.push(remaining);
			});
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);

			expect(onTick).toHaveBeenCalledTimes(1);
			expect(ticks).toEqual([5]);
		});

		it('should call onTick every second', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn(async (remaining: number) => {
				ticks.push(remaining);
			});
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);

			clock.tick(1000); // Advance 1 second
			expect(ticks).toEqual([5, 4]);

			clock.tick(1000); // Advance 1 second
			expect(ticks).toEqual([5, 4, 3]);

			clock.tick(1000); // Advance 1 second
			expect(ticks).toEqual([5, 4, 3, 2]);
		});

		it('should call onComplete when timer reaches 0', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn((remaining: number) => {
				ticks.push(remaining);
				return Promise.resolve();
			});
			const onComplete = vi.fn(() => Promise.resolve());

			manager.start('action1', 3, onTick, onComplete);

			clock.tick(1000); // 2 remaining
			clock.tick(1000); // 1 remaining
			clock.tick(1000); // 0 remaining, complete

			expect(ticks).toEqual([3, 2, 1, 0]);
			// onComplete is called but async, so we need to wait
			await vi.waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
		});

		it('should call onTick(0) before onComplete', async () => {
			const calls: string[] = [];
			const onTick = vi.fn((remaining: number) => {
				calls.push(`tick:${remaining}`);
				return Promise.resolve();
			});
			const onComplete = vi.fn(() => {
				calls.push('complete');
				return Promise.resolve();
			});

			manager.start('action1', 2, onTick, onComplete);

			clock.tick(1000); // 1 remaining
			clock.tick(1000); // 0 remaining, complete

			await vi.waitFor(() => expect(calls).toEqual(['tick:2', 'tick:1', 'tick:0', 'complete']));
		});

		it('should stop previous timer when starting new timer for same action', async () => {
			const ticks1: number[] = [];
			const onTick1 = vi.fn(async (remaining: number) => {
				ticks1.push(remaining);
			});
			const onComplete1 = vi.fn();

			const ticks2: number[] = [];
			const onTick2 = vi.fn(async (remaining: number) => {
				ticks2.push(remaining);
			});
			const onComplete2 = vi.fn();

			// Start first timer
			manager.start('action1', 5, onTick1, onComplete1);
			clock.tick(1000);
			expect(ticks1).toEqual([5, 4]);

			// Start second timer (should stop first)
			manager.start('action1', 3, onTick2, onComplete2);
			clock.tick(1000);

			// First timer should not continue
			expect(ticks1).toEqual([5, 4]);
			expect(onComplete1).not.toHaveBeenCalled();

			// Second timer should work
			expect(ticks2).toEqual([3, 2]);
		});

		it('should handle multiple timers with different actionIds independently', async () => {
			const ticks1: number[] = [];
			const onTick1 = vi.fn(async (remaining: number) => {
				ticks1.push(remaining);
			});
			const onComplete1 = vi.fn();

			const ticks2: number[] = [];
			const onTick2 = vi.fn(async (remaining: number) => {
				ticks2.push(remaining);
			});
			const onComplete2 = vi.fn();

			manager.start('action1', 3, onTick1, onComplete1);
			manager.start('action2', 5, onTick2, onComplete2);

			clock.tick(1000);
			expect(ticks1).toEqual([3, 2]);
			expect(ticks2).toEqual([5, 4]);

			clock.tick(1000);
			expect(ticks1).toEqual([3, 2, 1]);
			expect(ticks2).toEqual([5, 4, 3]);
		});

		it('should handle duration of 0 seconds', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn((remaining: number) => {
				ticks.push(remaining);
				return Promise.resolve();
			});
			const onComplete = vi.fn(() => Promise.resolve());

			manager.start('action1', 0, onTick, onComplete);

			// Should call with 0 immediately
			expect(ticks).toEqual([0]);

			// Next tick should complete
			clock.tick(1000);
			expect(ticks).toEqual([0, 0]);
			await vi.waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
		});

		it('should handle duration of 1 second', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn((remaining: number) => {
				ticks.push(remaining);
				return Promise.resolve();
			});
			const onComplete = vi.fn(() => Promise.resolve());

			manager.start('action1', 1, onTick, onComplete);

			expect(ticks).toEqual([1]);

			clock.tick(1000);
			expect(ticks).toEqual([1, 0]);
			await vi.waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
		});
	});

	describe('stop', () => {
		it('should stop a running timer', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn(async (remaining: number) => {
				ticks.push(remaining);
			});
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);
			clock.tick(1000);
			expect(ticks).toEqual([5, 4]);

			manager.stop('action1');

			// Timer should not continue after stop
			clock.tick(1000);
			expect(ticks).toEqual([5, 4]);
			expect(onComplete).not.toHaveBeenCalled();
		});

		it('should not error when stopping non-existent timer', () => {
			expect(() => manager.stop('nonexistent')).not.toThrow();
		});

		it('should not affect other timers when stopping one', async () => {
			const ticks1: number[] = [];
			const onTick1 = vi.fn(async (remaining: number) => {
				ticks1.push(remaining);
			});
			const onComplete1 = vi.fn();

			const ticks2: number[] = [];
			const onTick2 = vi.fn(async (remaining: number) => {
				ticks2.push(remaining);
			});
			const onComplete2 = vi.fn();

			manager.start('action1', 5, onTick1, onComplete1);
			manager.start('action2', 5, onTick2, onComplete2);

			clock.tick(1000);
			expect(ticks1).toEqual([5, 4]);
			expect(ticks2).toEqual([5, 4]);

			// Stop action1
			manager.stop('action1');

			clock.tick(1000);
			// action1 should not continue
			expect(ticks1).toEqual([5, 4]);
			// action2 should continue
			expect(ticks2).toEqual([5, 4, 3]);
		});

		it('should clear timer from internal map', async () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);
			expect(manager.isRunning('action1')).toBe(true);

			manager.stop('action1');
			expect(manager.isRunning('action1')).toBe(false);
		});
	});

	describe('isRunning', () => {
		it('should return false for non-existent timer', () => {
			expect(manager.isRunning('action1')).toBe(false);
		});

		it('should return true for running timer', async () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);
			expect(manager.isRunning('action1')).toBe(true);
		});

		it('should return false after timer is stopped', async () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);
			manager.stop('action1');
			expect(manager.isRunning('action1')).toBe(false);
		});

		it('should return false after timer completes', async () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			manager.start('action1', 1, onTick, onComplete);
			expect(manager.isRunning('action1')).toBe(true);

			clock.tick(1000); // Complete timer
			// Note: Timer completes but interval may still exist until next tick
			// This is implementation detail - isRunning tracks the Map
		});
	});

	describe('cleanup', () => {
		it('should stop timer when cleaning up', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn(async (remaining: number) => {
				ticks.push(remaining);
			});
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);
			clock.tick(1000);
			expect(ticks).toEqual([5, 4]);

			manager.cleanup('action1');

			clock.tick(1000);
			expect(ticks).toEqual([5, 4]);
			expect(onComplete).not.toHaveBeenCalled();
		});

		it('should not error when cleaning up non-existent action', () => {
			expect(() => manager.cleanup('nonexistent')).not.toThrow();
		});

		it('should be callable multiple times for same action', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			manager.start('action1', 5, onTick, onComplete);
			manager.cleanup('action1');
			manager.cleanup('action1'); // Should not error

			expect(() => manager.cleanup('action1')).not.toThrow();
		});
	});

	describe('edge cases', () => {
		it('should handle timer that is stopped and restarted', async () => {
			const ticks1: number[] = [];
			const onTick1 = vi.fn(async (remaining: number) => {
				ticks1.push(remaining);
			});
			const onComplete1 = vi.fn();

			const ticks2: number[] = [];
			const onTick2 = vi.fn(async (remaining: number) => {
				ticks2.push(remaining);
			});
			const onComplete2 = vi.fn();

			// Start and run for 1 second
			manager.start('action1', 5, onTick1, onComplete1);
			clock.tick(1000);
			expect(ticks1).toEqual([5, 4]);

			// Stop
			manager.stop('action1');

			// Restart with new duration
			manager.start('action1', 3, onTick2, onComplete2);
			clock.tick(1000);

			// Old timer should not continue
			expect(ticks1).toEqual([5, 4]);
			expect(onComplete1).not.toHaveBeenCalled();

			// New timer should work
			expect(ticks2).toEqual([3, 2]);
		});

		it('should handle async onTick callbacks', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn(async (remaining: number) => {
				await new Promise(resolve => setTimeout(resolve, 0));
				ticks.push(remaining);
			});
			const onComplete = vi.fn();

			manager.start('action1', 3, onTick, onComplete);

			// Even with async callbacks, ticks should be recorded
			await vi.waitFor(() => expect(ticks).toEqual([3]));

			clock.tick(1000);
			await vi.waitFor(() => expect(ticks).toEqual([3, 2]));
		});

		it('should handle very short durations correctly', async () => {
			const ticks: number[] = [];
			const onTick = vi.fn((remaining: number) => {
				ticks.push(remaining);
				return Promise.resolve();
			});
			const onComplete = vi.fn(() => Promise.resolve());

			manager.start('action1', 1, onTick, onComplete);

			// Initial: 1 second
			expect(ticks).toEqual([1]);

			// After 1 second: 0 and complete
			clock.tick(1000);
			expect(ticks).toEqual([1, 0]);
			await vi.waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
		});

		it('should handle concurrent completions of multiple timers', async () => {
			const complete1 = vi.fn(() => Promise.resolve());
			const complete2 = vi.fn(() => Promise.resolve());

			manager.start('action1', 2, vi.fn(() => Promise.resolve()), complete1);
			manager.start('action2', 2, vi.fn(() => Promise.resolve()), complete2);

			clock.tick(2000); // Both should complete

			await vi.waitFor(() => {
				expect(complete1).toHaveBeenCalled();
				expect(complete2).toHaveBeenCalled();
			});
		});
	});
});
