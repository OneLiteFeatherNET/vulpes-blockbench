import { describe, expect, it } from 'vitest';
import { decideWrite, linkedRecord, type LinkRecord } from '../../src/link/link-state';
import type { VulpesPath } from '../../src/link/vulpes-path';

const path: VulpesPath = { environment: 'prod', projectId: 'p1', assetId: 'a1' };

const record: LinkRecord = {
  environment: 'prod',
  baseUrl: 'https://vulpes.example',
  projectId: 'p1',
  assetId: 'a1',
  key: 'vulpes:item/ruby',
  etag: '"abc"',
};

describe('linked record', () => {
  it('is the record when the path names the same asset', () => {
    expect(linkedRecord(path, record)).toBe(record);
  });

  it('is undefined when the path names another asset', () => {
    expect(linkedRecord({ ...path, assetId: 'other' }, record)).toBeUndefined();
  });

  it('is undefined when no record is held', () => {
    expect(linkedRecord(path, undefined)).toBeUndefined();
  });
});

describe('write decision', () => {
  it('unlinks instead of uploading when the project has a local save path', () => {
    expect(decideWrite({ localSavePath: '/home/me/ruby.bbmodel', path, record })).toEqual({ kind: 'unlink' });
  });

  it('replaces the asset when the path and the held record match', () => {
    expect(decideWrite({ localSavePath: '', path, record })).toEqual({ kind: 'replace', record });
  });

  it('refuses without sending when no version is held', () => {
    expect(decideWrite({ localSavePath: '', path, record: undefined })).toEqual({ kind: 'refuse', reason: 'no-version' });
  });

  it('refuses when the path cannot be read', () => {
    expect(decideWrite({ localSavePath: '', path: undefined, record })).toEqual({ kind: 'refuse', reason: 'invalid-path' });
  });
});
