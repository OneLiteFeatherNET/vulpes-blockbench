import { describe, expect, it } from 'vitest';
import { createReconnectBackoff } from '../../src/live/reconnect-backoff';

describe('createReconnectBackoff', () => {
  it('waits one second before the first reconnect', () => {
    expect(createReconnectBackoff().nextDelayMs(), 'the first delay').toBe(1_000);
  });

  it('doubles the delay on each attempt', () => {
    const backoff = createReconnectBackoff();
    const delays = [backoff.nextDelayMs(), backoff.nextDelayMs(), backoff.nextDelayMs(), backoff.nextDelayMs()];
    expect(delays, 'the delays in order').toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it('never waits longer than thirty seconds', () => {
    const backoff = createReconnectBackoff();
    const delays = [1, 2, 3, 4, 5, 6, 7].map(() => backoff.nextDelayMs());
    expect(delays.at(-1), 'the delay after several attempts').toBe(30_000);
    expect(Math.max(...delays), 'the longest delay').toBe(30_000);
  });

  it('starts again at one second after a reset', () => {
    const backoff = createReconnectBackoff();
    backoff.nextDelayMs();
    backoff.nextDelayMs();
    backoff.reset();
    expect(backoff.nextDelayMs(), 'the delay after the reset').toBe(1_000);
  });
});
