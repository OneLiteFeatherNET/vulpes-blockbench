import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerNativeSettings } from '../../src/ui/native-settings';

describe('registerNativeSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the settings although the settings dialog was never opened', () => {
    const registered: string[] = [];
    vi.stubGlobal('Settings', {
      addCategory: () => {
        // Blockbench rebuilds the dialog sidebar here; before the first open it has no DOM yet.
        throw new TypeError("Cannot read properties of undefined (reading 'querySelector')");
      },
    });
    vi.stubGlobal(
      'Setting',
      vi.fn(function register(id: string) {
        registered.push(id);
      }),
    );

    registerNativeSettings({ active: 'dev', dev: 'http://localhost:8085', prod: '' }, () => undefined, () => undefined);

    expect(registered, 'all three settings are registered').toHaveLength(3);
  });
});
