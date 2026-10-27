import { describe, expect, it } from 'vitest';
import { isRemoteReference, type RemoteReference } from '../../src/remote/reference';

const REFERENCE: RemoteReference = {
  baseUrl: 'http://localhost:8085',
  projectId: '6f1c0000-0000-4000-8000-000000000002',
  assetId: '6f1c0000-0000-4000-8000-000000000001',
  key: 'vulpes:item/ruby',
  etag: '"0a1b2c"',
};

describe('isRemoteReference', () => {
  it('accepts a complete reference read back from the project', () => {
    expect(isRemoteReference({ ...REFERENCE })).toBe(true);
  });

  it('rejects the empty object that a project without a link carries', () => {
    expect(isRemoteReference({})).toBe(false);
  });

  it('rejects a reference without an etag', () => {
    expect(isRemoteReference({ ...REFERENCE, etag: undefined })).toBe(false);
  });

  it('rejects a reference whose etag is weak', () => {
    expect(isRemoteReference({ ...REFERENCE, etag: 'W/"0a1b2c"' })).toBe(false);
  });

  it('rejects a reference with an empty asset id', () => {
    expect(isRemoteReference({ ...REFERENCE, assetId: '' })).toBe(false);
  });

  it('rejects a value that is not an object', () => {
    expect(isRemoteReference(undefined)).toBe(false);
  });
});
