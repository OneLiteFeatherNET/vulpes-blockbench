import { describe, expect, it } from 'vitest';
import { createEnvironmentService } from '../../src/environment/service';
import { memoryStorage } from './memory-storage';

describe('createEnvironmentService', () => {
  it('starts in dev with the default URLs when nothing is stored', () => {
    const service = createEnvironmentService(memoryStorage(undefined));
    expect(service.activeProfile()).toEqual({ id: 'dev', baseUrl: 'http://localhost:8085' });
  });

  it('reads the stored active environment and its URL', () => {
    const stored = { active: 'prod', baseUrls: { dev: 'http://localhost:8085', prod: 'https://vulpes.example.org' } };
    const service = createEnvironmentService(memoryStorage(stored));
    expect(service.activeProfile()).toEqual({ id: 'prod', baseUrl: 'https://vulpes.example.org' });
  });

  it('reports the active environment as configured when its URL is set', () => {
    const stored = { active: 'dev', baseUrls: { dev: 'http://localhost:9000', prod: '' } };
    const service = createEnvironmentService(memoryStorage(stored));
    expect(service.configuredActiveProfile()).toEqual({ ok: true, baseUrl: 'http://localhost:9000' });
  });

  it('reports prod as not configured while its URL is empty', () => {
    const stored = { active: 'prod', baseUrls: { dev: 'http://localhost:8085', prod: '' } };
    const service = createEnvironmentService(memoryStorage(stored));
    expect(service.configuredActiveProfile()).toEqual({ ok: false, reason: 'not-configured' });
  });
});
