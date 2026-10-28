import { describe, expect, it } from 'vitest';
import type { LinkRecord } from '../../src/link/link-state';
import { attachLink, heldRecord, updateHeldEtag } from '../../src/ui/project-link';

// Each test names its own project uuid: the link records are module state, so a shared uuid would couple the tests.
function fakeProject(uuid: string): BlockbenchProject {
  return {
    uuid,
    name: 'model',
    saved: false,
    save_path: '',
    export_path: '',
    export_codec: '',
    select: () => undefined,
    close: () => Promise.resolve(true),
  };
}

function recordWithEtag(etag: string): LinkRecord {
  return { environment: 'dev', baseUrl: 'https://vulpes.example', projectId: 'p1', assetId: 'a1', key: 'model.bbmodel', etag };
}

describe('updateHeldEtag', () => {
  it('replaces the etag held for a linked project', () => {
    const project = fakeProject('etag-replaces-held');
    attachLink(project, recordWithEtag('"old"'));
    expect(updateHeldEtag(project.uuid, '"new"'), 'the update result').toBe(true);
    expect(heldRecord(project)?.etag, 'the held etag after the update').toBe('"new"');
  });

  it('keeps the other fields of the held record', () => {
    const project = fakeProject('etag-keeps-fields');
    attachLink(project, recordWithEtag('"old"'));
    updateHeldEtag(project.uuid, '"new"');
    expect(heldRecord(project), 'the record after the update').toEqual(recordWithEtag('"new"'));
  });

  it('refuses an etag that is not strong and keeps the old one', () => {
    const project = fakeProject('etag-refuses-weak');
    attachLink(project, recordWithEtag('"old"'));
    expect(updateHeldEtag(project.uuid, 'W/"new"'), 'the update result for a weak etag').toBe(false);
    expect(heldRecord(project)?.etag, 'the held etag after a refused update').toBe('"old"');
  });

  it('does nothing for a project that holds no record', () => {
    expect(updateHeldEtag('etag-without-record', '"new"'), 'the update result').toBe(false);
  });
});
