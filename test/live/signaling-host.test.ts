import { describe, expect, it } from 'vitest';
import { validateSignalingHost } from '../../src/live/signaling-host';

describe('validateSignalingHost', () => {
  it('accepts a bare host name', () => {
    expect(validateSignalingHost('localhost'), 'the result').toEqual({ ok: true, host: 'localhost' });
  });

  it('accepts a dotted host name with digits and hyphens', () => {
    expect(validateSignalingHost('sig-1.example.net'), 'the result').toEqual({ ok: true, host: 'sig-1.example.net' });
  });

  it('treats an empty value as disabled', () => {
    expect(validateSignalingHost(''), 'the result').toEqual({ ok: true, host: undefined });
  });

  it('rejects a host with a scheme', () => {
    expect(validateSignalingHost('https://signal.example.net'), 'the result').toEqual({ ok: false, reason: 'scheme' });
  });

  it('rejects a host with a port', () => {
    expect(validateSignalingHost('localhost:9000'), 'the result').toEqual({ ok: false, reason: 'port' });
  });

  it('rejects a host with a path', () => {
    expect(validateSignalingHost('signal.example.net/sessions'), 'the result').toEqual({ ok: false, reason: 'path' });
  });

  it('rejects a host with a space', () => {
    expect(validateSignalingHost('local host'), 'the result').toEqual({ ok: false, reason: 'space' });
  });

  it('rejects an uppercase host', () => {
    expect(validateSignalingHost('Localhost'), 'the result').toEqual({ ok: false, reason: 'characters' });
  });

  it('rejects a label that starts with a hyphen', () => {
    expect(validateSignalingHost('-signal.example.net'), 'the result').toEqual({ ok: false, reason: 'characters' });
  });
});
