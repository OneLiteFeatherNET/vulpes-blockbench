import type { EnvironmentStorage } from '../../src/environment/storage';

// In-memory storage for one test. Each test creates its own instance.
export function memoryStorage(initial: unknown): EnvironmentStorage {
  return {
    read(): unknown {
      return initial;
    },
  };
}
