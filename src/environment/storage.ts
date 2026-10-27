import { parseSnapshot } from './snapshot';
import { defaultSnapshot, type EnvironmentSnapshot } from './profiles';

/**
 * Read access to the stored environment settings. The Blockbench implementation lives in
 * the UI layer. The logic only sees this interface, so it runs under Vitest.
 */
export interface EnvironmentStorage {
  /** Returns the raw stored value. It is untrusted until `parseSnapshot` checks it. */
  read(): unknown;
}

/** Reads the snapshot. A failing read gives the defaults, so Blockbench keeps running. */
export function loadSnapshot(storage: EnvironmentStorage): EnvironmentSnapshot {
  try {
    return parseSnapshot(storage.read());
  } catch {
    return defaultSnapshot();
  }
}
