import { describe, expect, it } from 'vitest';
import { createRefreshScheduler, type RefreshTimers } from '../../src/live/refresh';

/** A timer double: records the requested intervals and runs the handlers only when the test fires them. */
function fakeTimers(): {
  timers: RefreshTimers<number>;
  requestedMs: number[];
  activeCount: () => number;
  fire: () => void;
} {
  const handlers = new Map<number, () => void>();
  const requestedMs: number[] = [];
  let next = 1;
  const timers: RefreshTimers<number> = {
    setInterval: (handler, ms) => {
      const handle = next;
      next += 1;
      handlers.set(handle, handler);
      requestedMs.push(ms);
      return handle;
    },
    clearInterval: (handle) => {
      handlers.delete(handle);
    },
  };
  return {
    timers,
    requestedMs,
    activeCount: () => handlers.size,
    fire: () => {
      for (const handler of [...handlers.values()]) {
        handler();
      }
    },
  };
}

/** Lets the promise chain of a fired refresh finish. Only microtasks run, so the test stays deterministic. */
async function settle(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

describe('createRefreshScheduler', () => {
  it('does not refresh before the first interval has passed', () => {
    const clock = fakeTimers();
    let calls = 0;
    const scheduler = createRefreshScheduler({ timers: clock.timers, refresh: () => { calls += 1; return Promise.resolve(); } });
    scheduler.start();
    expect(calls, 'the refresh calls before any tick').toBe(0);
  });

  it('schedules a refresh every 20 seconds', () => {
    const clock = fakeTimers();
    const scheduler = createRefreshScheduler({ timers: clock.timers, refresh: () => Promise.resolve() });
    scheduler.start();
    expect(clock.requestedMs, 'the requested intervals').toEqual([20_000]);
  });

  it('refreshes when the interval fires', async () => {
    const clock = fakeTimers();
    let calls = 0;
    const scheduler = createRefreshScheduler({ timers: clock.timers, refresh: () => { calls += 1; return Promise.resolve(); } });
    scheduler.start();
    clock.fire();
    await settle();
    expect(calls, 'the refresh calls after one tick').toBe(1);
  });

  it('stop clears the timer, so no refresh follows', async () => {
    const clock = fakeTimers();
    let calls = 0;
    const scheduler = createRefreshScheduler({ timers: clock.timers, refresh: () => { calls += 1; return Promise.resolve(); } });
    scheduler.start();
    scheduler.stop();
    expect(clock.activeCount(), 'the active timers after stop').toBe(0);
    clock.fire();
    await settle();
    expect(calls, 'the refresh calls after stop').toBe(0);
  });

  it('reports itself as running only between start and stop', () => {
    const clock = fakeTimers();
    const scheduler = createRefreshScheduler({ timers: clock.timers, refresh: () => Promise.resolve() });
    expect(scheduler.isRunning(), 'before start').toBe(false);
    scheduler.start();
    expect(scheduler.isRunning(), 'after start').toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning(), 'after stop').toBe(false);
  });

  it('keeps a single timer when started twice', () => {
    const clock = fakeTimers();
    const scheduler = createRefreshScheduler({ timers: clock.timers, refresh: () => Promise.resolve() });
    scheduler.start();
    scheduler.start();
    expect(clock.activeCount(), 'the active timers').toBe(1);
  });

  it('stopping a scheduler that never started does nothing', () => {
    const clock = fakeTimers();
    const scheduler = createRefreshScheduler({ timers: clock.timers, refresh: () => Promise.resolve() });
    expect(() => { scheduler.stop(); }, 'the stop call').not.toThrow();
    expect(clock.activeCount(), 'the active timers').toBe(0);
  });

  it('keeps the schedule when a refresh fails', async () => {
    const clock = fakeTimers();
    let calls = 0;
    const scheduler = createRefreshScheduler({
      timers: clock.timers,
      refresh: () => {
        calls += 1;
        return Promise.reject(new Error('offline'));
      },
    });
    scheduler.start();
    clock.fire();
    await settle();
    expect(scheduler.isRunning(), 'running after a failed refresh').toBe(true);
    clock.fire();
    await settle();
    expect(calls, 'the refresh calls after two ticks').toBe(2);
  });

  it('passes a failed refresh to onError', async () => {
    const clock = fakeTimers();
    const failures: unknown[] = [];
    const scheduler = createRefreshScheduler({
      timers: clock.timers,
      refresh: () => Promise.reject(new Error('offline')),
      onError: (error) => {
        failures.push(error);
      },
    });
    scheduler.start();
    clock.fire();
    await settle();
    expect(failures.length, 'the reported failures').toBe(1);
  });
});
