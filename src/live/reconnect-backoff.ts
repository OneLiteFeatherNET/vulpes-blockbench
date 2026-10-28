// The reconnect policy of the `events` stream: 1 second after the first drop, doubling on each
// further attempt, capped at 30 seconds. The stream resets it once a reopened stream delivers data.
// It is pure, so the policy is tested without timers.

/** The delay before the first reconnect. */
export const RECONNECT_INITIAL_MS = 1_000;

/** The longest delay between two attempts. */
export const RECONNECT_MAX_MS = 30_000;

export interface ReconnectBackoff {
  /** The delay before the next attempt. Each call returns the current delay and doubles it, up to the cap. */
  nextDelayMs(): number;
  /** Starts again at the initial delay. */
  reset(): void;
}

export function createReconnectBackoff(): ReconnectBackoff {
  let delay = RECONNECT_INITIAL_MS;
  return {
    nextDelayMs: (): number => {
      const current = delay;
      delay = Math.min(delay * 2, RECONNECT_MAX_MS);
      return current;
    },
    reset: (): void => {
      delay = RECONNECT_INITIAL_MS;
    },
  };
}
