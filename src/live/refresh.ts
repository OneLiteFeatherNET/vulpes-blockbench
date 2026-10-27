// Keeps a hosted session registered: calls `refresh` on a fixed interval. The timers are
// injected, so the module reads no global timer and tests drive it with a fake.

/** The registration TTL is 60 seconds; a refresh every 20 seconds keeps two chances before it expires. */
export const REFRESH_INTERVAL_MS = 20_000;

export interface RefreshTimers<H> {
  setInterval(handler: () => void, ms: number): H;
  clearInterval(handle: H): void;
}

export interface RefreshSchedulerOptions<H> {
  readonly timers: RefreshTimers<H>;
  readonly refresh: () => Promise<unknown>;
  /** Receives a failed refresh. The schedule keeps running after a failure. */
  readonly onError?: (error: unknown) => void;
  readonly intervalMs?: number;
}

export interface RefreshScheduler {
  /** Starts the interval. Starting a running scheduler keeps the one timer. */
  start(): void;
  /** Clears the interval. Stopping a stopped scheduler does nothing. */
  stop(): void;
  isRunning(): boolean;
}

export function createRefreshScheduler<H>(options: RefreshSchedulerOptions<H>): RefreshScheduler {
  const interval = options.intervalMs ?? REFRESH_INTERVAL_MS;
  let handle: H | undefined;

  const attempt = async (): Promise<void> => {
    try {
      await options.refresh();
    } catch (error: unknown) {
      options.onError?.(error);
    }
  };

  return {
    start: (): void => {
      if (handle !== undefined) {
        return;
      }
      handle = options.timers.setInterval(() => {
        void attempt();
      }, interval);
    },
    stop: (): void => {
      if (handle === undefined) {
        return;
      }
      options.timers.clearInterval(handle);
      handle = undefined;
    },
    isRunning: (): boolean => handle !== undefined,
  };
}
