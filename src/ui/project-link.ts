// The Vulpes link of each open project. The export path names the asset; the base URL,
// the key and the ETag are held here in memory, by project uuid. A restart drops them,
// so a linked project refuses to save until it is opened from Vulpes again.

import { parseEntityTag } from '../api/http';
import { linkedRecord, type LinkRecord } from '../link/link-state';
import { buildVulpesPath, parseVulpesPath } from '../link/vulpes-path';

export const VULPES_CODEC = 'vulpes';

const records = new Map<string, LinkRecord>();

/** Links a project: the export codec, the export path and the record. A linked project has no local save path. */
export function attachLink(project: BlockbenchProject, record: LinkRecord): void {
  records.set(project.uuid, record);
  project.export_codec = VULPES_CODEC;
  project.export_path = buildVulpesPath(record);
  project.save_path = '';
}

/** Removes the link. The project keeps its content and becomes a local project. */
export function detachLink(project: BlockbenchProject): void {
  records.delete(project.uuid);
  if (project.export_codec === VULPES_CODEC) {
    project.export_codec = '';
    project.export_path = '';
  }
}

/** The record held for the project. It is returned even when the project no longer points to it. */
export function heldRecord(project: BlockbenchProject): LinkRecord | undefined {
  return records.get(project.uuid);
}

/** The link as the designer sees it. A local save ends the link, so it reads as not linked. */
export function linkOf(project: BlockbenchProject): LinkRecord | undefined {
  if (project.export_codec !== VULPES_CODEC || project.save_path !== '') {
    return undefined;
  }
  return linkedRecord(parseVulpesPath(project.export_path), records.get(project.uuid));
}

/**
 * Replaces the ETag held for a project, after a save by another participant. Returns false when
 * the project holds no record or the value is not a strong ETag, so nothing is changed.
 */
export function updateHeldEtag(uuid: string, etag: string): boolean {
  const record = records.get(uuid);
  if (record === undefined || parseEntityTag(etag) === undefined) {
    return false;
  }
  records.set(uuid, { ...record, etag });
  return true;
}

/** Clears the link of every open project, so no vulpes:// path is left for a codec that is gone. */
export function detachAll(): void {
  for (const project of ModelProject.all) {
    detachLink(project);
  }
  records.clear();
}
