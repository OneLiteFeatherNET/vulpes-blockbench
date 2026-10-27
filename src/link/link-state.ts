// What the plugin remembers about a project that was opened from or saved to Vulpes,
// and the decision a write takes from it. Pure: the Blockbench glue reads the project.

import type { ProfileId } from '../environment/profiles';
import type { VulpesPath } from './vulpes-path';

/** The link of one project. It is held in memory only, so it ends with the Blockbench session. */
export interface LinkRecord {
  readonly environment: ProfileId;
  /** The origin the project was opened from. Saves go there, never to the active environment. */
  readonly baseUrl: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly key: string;
  /** The last version the plugin saw, exactly as the backend sent it. */
  readonly etag: string;
}

/** The record, when the export path names the same asset. Otherwise the project is not linked. */
export function linkedRecord(path: VulpesPath | undefined, record: LinkRecord | undefined): LinkRecord | undefined {
  if (path === undefined || record === undefined) {
    return undefined;
  }
  const same = path.environment === record.environment && path.projectId === record.projectId && path.assetId === record.assetId;
  return same ? record : undefined;
}

export type WriteDecision =
  /** A local save exists: the project is no longer linked and nothing is sent. */
  | { readonly kind: 'unlink' }
  | { readonly kind: 'refuse'; readonly reason: 'invalid-path' | 'no-version' }
  | { readonly kind: 'replace'; readonly record: LinkRecord };

/** Decides what a write of the export codec does. Without a held ETag nothing is replaced. */
export function decideWrite(input: {
  readonly localSavePath: string;
  readonly path: VulpesPath | undefined;
  readonly record: LinkRecord | undefined;
}): WriteDecision {
  if (input.localSavePath !== '') {
    return { kind: 'unlink' };
  }
  if (input.path === undefined) {
    return { kind: 'refuse', reason: 'invalid-path' };
  }
  const record = linkedRecord(input.path, input.record);
  return record === undefined ? { kind: 'refuse', reason: 'no-version' } : { kind: 'replace', record };
}
