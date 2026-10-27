import { describe, expect, it } from 'vitest';
import { createEnvironmentService } from '../../src/environment/service';
import { memoryStorage } from './memory-storage';

describe('createEnvironmentService', () => {
  it('starts in dev with the default URLs when nothing is stored', () => {
    const service = createEnvironmentService(memoryStorage(undefined));
    expect(service.activeProfile()).toEqual({ id: 'dev', baseUrl: 'http://localhost:8085' });
  });

  it('stores a validated base URL without the trailing slash', () => {
    const storage = memoryStorage(undefined);
    const service = createEnvironmentService(storage);
    expect(service.setBaseUrl('dev', 'http://localhost:9000/')).toEqual({
      ok: true,
      value: 'http://localhost:9000',
    });
    expect(service.snapshot().baseUrls.dev, 'the stored Dev URL').toBe('http://localhost:9000');
  });

  it('keeps the old URL when the new value is invalid', () => {
    const service = createEnvironmentService(memoryStorage(undefined));
    service.setBaseUrl('prod', 'http://vulpes.example.org');
    expect(service.snapshot().baseUrls.prod, 'the Prod URL after a rejected value').toBe('');
  });

  it('refuses a switch to prod without confirmation', () => {
    const service = createEnvironmentService(memoryStorage(undefined));
    expect(service.switchTo('prod', false)).toEqual({ ok: false, reason: 'confirmation-required' });
    expect(service.snapshot().active, 'the active environment after a refused switch').toBe('dev');
  });

  it('switches to prod after confirmation', () => {
    const service = createEnvironmentService(memoryStorage(undefined));
    service.setBaseUrl('prod', 'https://vulpes.example.org');
    expect(service.switchTo('prod', true)).toEqual({ ok: true });
    expect(service.snapshot().active).toBe('prod');
  });

  it('switches back to dev without confirmation', () => {
    const service = createEnvironmentService(memoryStorage(undefined));
    service.setBaseUrl('prod', 'https://vulpes.example.org');
    service.switchTo('prod', true);
    expect(service.switchTo('dev', false)).toEqual({ ok: true });
  });

  it('reports prod as not configured while its URL is empty', () => {
    const service = createEnvironmentService(memoryStorage(undefined));
    service.switchTo('prod', true);
    expect(service.configuredActiveProfile()).toEqual({ ok: false, reason: 'not-configured' });
  });

  it('keeps the active environment after a restart on the same storage', () => {
    const storage = memoryStorage(undefined);
    const first = createEnvironmentService(storage);
    first.setBaseUrl('prod', 'https://vulpes.example.org');
    first.switchTo('prod', true);
    const restarted = createEnvironmentService(storage);
    expect(restarted.snapshot().active, 'the active environment after a restart').toBe('prod');
  });
});
