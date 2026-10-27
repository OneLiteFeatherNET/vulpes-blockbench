import { parseSnapshot } from './snapshot';
import { defaultSnapshot, type EnvironmentSnapshot } from './profiles';

/**
 * Storage for the environment snapshot. The Blockbench implementation lives in
 * the UI layer. The logic only sees this interface, so it runs under Vitest.
 */
export interface EnvironmentStorage {
  /** Returns the raw stored value. It is untrusted until `parseSnapshot` checks it. */
  read(): unknown;
  write(snapshot: EnvironmentSnapshot): void;
}

/** Reads the snapshot. A failing read gives the defaults, so Blockbench keeps running. */
export function loadSnapshot(storage: EnvironmentStorage): EnvironmentSnapshot {
  try {
    return parseSnapshot(storage.read());
  } catch {
    return defaultSnapshot();
  }
}

/** Writes the snapshot. Returns false instead of throwing when the write fails. */
export function saveSnapshot(storage: EnvironmentStorage, snapshot: EnvironmentSnapshot): boolean {
  try {
    storage.write(snapshot);
    return true;
  } catch {
    return false;
  }
}
