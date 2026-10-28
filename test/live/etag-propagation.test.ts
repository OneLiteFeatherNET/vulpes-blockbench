import { describe, expect, it } from 'vitest';
import { decideEtagPropagation, type LocalLink } from '../../src/live/etag-propagation';

const ENVIRONMENT = 'dev';
const ASSET = '6f1c0000-0000-4000-8000-000000000001';
const OTHER_ASSET = '6f1c0000-0000-4000-8000-000000000009';
const OLD = '"old"';
const NEW = '"new"';

function link(projectKey: string, overrides: Partial<LocalLink> = {}): LocalLink {
  return { projectKey, environment: ENVIRONMENT, assetId: ASSET, etag: OLD, ...overrides };
}

function decide(links: readonly LocalLink[]): ReturnType<typeof decideEtagPropagation> {
  return decideEtagPropagation({
    environment: ENVIRONMENT,
    assetId: ASSET,
    saved: { etag: NEW, sha1: 'new', revision: 4 },
    links,
  });
}

describe('decideEtagPropagation', () => {
  it('updates the held ETag of a link of the same asset and environment', () => {
    expect(decide([link('a')]).updates, 'the updates').toEqual([{ projectKey: 'a', etag: NEW }]);
  });

  it('announces a save by another participant, which no local link holds', () => {
    expect(decide([link('a')]).announcement, 'the announcement').toEqual({ revision: 4 });
  });

  it('ignores a saved event whose ETag the only link already holds, without update or message', () => {
    expect(decide([link('a', { etag: NEW })]), 'the decision').toEqual({ updates: [], announcement: undefined });
  });

  it('does not announce an own save, because the saving link already holds the new ETag', () => {
    expect(decide([link('a', { etag: NEW })]).announcement, 'the announcement').toBeUndefined();
  });

  it('updates the other links of the asset but does not announce when one link already holds the ETag', () => {
    const result = decide([link('a', { etag: NEW }), link('b')]);
    expect(result.updates, 'the updates').toEqual([{ projectKey: 'b', etag: NEW }]);
    expect(result.announcement, 'the announcement').toBeUndefined();
  });

  it('leaves a link of another asset untouched', () => {
    const result = decide([link('a'), link('other', { assetId: OTHER_ASSET })]);
    expect(result.updates, 'the updates').toEqual([{ projectKey: 'a', etag: NEW }]);
  });

  it('leaves a link of another environment untouched', () => {
    const result = decide([link('a'), link('prod', { environment: 'prod' })]);
    expect(result.updates, 'the updates').toEqual([{ projectKey: 'a', etag: NEW }]);
  });

  it('does not count a link of another environment that holds the ETag as holding it', () => {
    const result = decide([link('a'), link('prod', { environment: 'prod', etag: NEW })]);
    expect(result.announcement, 'the announcement').toEqual({ revision: 4 });
  });

  it('announces nothing for an asset without a local link', () => {
    const result = decide([link('other', { assetId: OTHER_ASSET })]);
    expect(result, 'the decision').toEqual({ updates: [], announcement: undefined });
  });
});
