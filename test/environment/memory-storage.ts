import type { EnvironmentStorage } from '../../src/environment/storage';

// In-memory storage for one test. Each test creates its own instance.
export function memoryStorage(initial: unknown): EnvironmentStorage & { stored: unknown } {
  const storage = {
    stored: initial,
    read(): unknown {
      return storage.stored;
    },
    write(snapshot: unknown): void {
      storage.stored = snapshot;
    },
  };
  return storage;
}
