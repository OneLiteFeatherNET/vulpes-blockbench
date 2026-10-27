import { describe, expect, it } from 'vitest';
import { parseAssetPage, parseAssetSummary, parseProjectPage } from '../../src/api/dto';

const ASSET = {
  id: '6f1c0000-0000-4000-8000-000000000001',
  projectId: '6f1c0000-0000-4000-8000-000000000002',
  key: 'vulpes:item/ruby',
  kind: 'BBMODEL',
  fileName: 'ruby.bbmodel',
  size: 2048,
  sha1: '0a1b2c',
};

const PROJECT = {
  id: '6f1c0000-0000-4000-8000-000000000002',
  displayName: 'Items',
  key: 'items',
  labor: false,
};

describe('parseAssetSummary', () => {
  it('reads the id, key, file name, size and sha1 of an asset', () => {
    expect(parseAssetSummary(ASSET)).toEqual({
      id: ASSET.id,
      key: 'vulpes:item/ruby',
      fileName: 'ruby.bbmodel',
      size: 2048,
      sha1: '0a1b2c',
    });
  });

  it('rejects an asset without a sha1', () => {
    const withoutSha1 = { id: ASSET.id, key: ASSET.key, fileName: ASSET.fileName, size: ASSET.size };
    expect(parseAssetSummary(withoutSha1)).toBeUndefined();
  });

  it('rejects a value that is not an object', () => {
    expect(parseAssetSummary('ruby')).toBeUndefined();
  });
});

describe('parseAssetPage', () => {
  it('reads the content and the total size of the page envelope', () => {
    const page = parseAssetPage({ content: [ASSET], pageable: {}, totalSize: 51 });
    expect(page?.items.map((item) => item.key), 'the keys').toEqual(['vulpes:item/ruby']);
    expect(page?.totalSize, 'the total size').toBe(51);
  });

  it('rejects a page when one item is invalid', () => {
    expect(parseAssetPage({ content: [ASSET, { id: 'x' }], pageable: {}, totalSize: 2 })).toBeUndefined();
  });

  it('rejects a page without a total size', () => {
    expect(parseAssetPage({ content: [ASSET], pageable: {} })).toBeUndefined();
  });
});

describe('parseProjectPage', () => {
  it('reads the id, display name and key of each project', () => {
    const page = parseProjectPage({ content: [PROJECT], pageable: {}, totalSize: 1 });
    expect(page?.items, 'the items').toEqual([
      { id: PROJECT.id, displayName: 'Items', key: 'items' },
    ]);
  });
});
