import { describe, expect, it } from 'vitest';
import { DEFAULT_DEV_SIGNALING_HOST, DEFAULT_PROD_SIGNALING_HOST, signalingHostFor, readSignalingHost } from '../../src/live/signaling-settings';

describe('signalingHostFor', () => {
  it('gives the dev default localhost when the value is missing', () => {
    expect(signalingHostFor('dev', undefined), 'the host').toBe('localhost');
    expect(DEFAULT_DEV_SIGNALING_HOST, 'the dev default').toBe('localhost');
  });

  it('gives an empty host for prod when the value is missing', () => {
    expect(signalingHostFor('prod', undefined), 'the host').toBe('');
    expect(DEFAULT_PROD_SIGNALING_HOST, 'the prod default').toBe('');
  });

  it('gives the default when the stored value is not a string', () => {
    expect(signalingHostFor('dev', 42), 'the dev host').toBe('localhost');
    expect(signalingHostFor('prod', null), 'the prod host').toBe('');
  });

  it('uses a valid host as it is for dev', () => {
    expect(signalingHostFor('dev', 'sig.example.net'), 'the host').toBe('sig.example.net');
  });

  it('uses a valid host as it is for prod', () => {
    expect(signalingHostFor('prod', 'signal.onelitefeather.net'), 'the host').toBe('signal.onelitefeather.net');
  });

  it('treats an explicitly empty dev value as disabled, not as the default', () => {
    expect(signalingHostFor('dev', ''), 'the host').toBe('');
  });

  it('treats a host with a scheme as empty for dev, so live editing is disabled', () => {
    expect(signalingHostFor('dev', 'http://localhost'), 'the host').toBe('');
  });

  it('treats a host with a port as empty for prod', () => {
    expect(signalingHostFor('prod', 'signal.example.net:9000'), 'the host').toBe('');
  });
});

describe('readSignalingHost', () => {
  it('gives the default when the accessor throws', () => {
    const throwing = (): unknown => {
      throw new Error('settings are not ready');
    };
    expect(readSignalingHost('dev', throwing), 'the dev host').toBe('localhost');
    expect(readSignalingHost('prod', throwing), 'the prod host').toBe('');
  });

  it('reads the value that the accessor returns', () => {
    expect(readSignalingHost('dev', () => 'relay.example.net'), 'the host').toBe('relay.example.net');
  });
});
