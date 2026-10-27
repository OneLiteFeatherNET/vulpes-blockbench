// Restoring a revision. The plan decides whether a request may be sent at all; the outcome
// tells the caller whether the linked model now holds the restored content.

import type { VulpesClient } from '../api/client';
import { parseEntityTag } from '../api/http';
import type { UserMessage } from '../problem';
import { revisionFailureMessage } from './availability';

export type RestorePlan =
  | { readonly kind: 'send'; readonly ifMatch: string }
  | { readonly kind: 'refuse'; readonly message: UserMessage };

/** A restore needs a strong ETag of the linked model. Without one nothing is sent. */
export function planRestore(heldEtag: string | undefined): RestorePlan {
  if (heldEtag === undefined || parseEntityTag(heldEtag) === undefined) {
    return { kind: 'refuse', message: { key: 'vulpes.problem.refused', params: [] } };
  }
  return { kind: 'send', ifMatch: heldEtag };
}

export type RestoreOutcome =
  | { readonly kind: 'restored'; readonly etag: string }
  | { readonly kind: 'conflict'; readonly currentEtag: string | undefined }
  | { readonly kind: 'failed'; readonly message: UserMessage };

export interface RestoreTarget {
  readonly projectId: string;
  readonly assetId: string;
}

/** Restores one revision over the asset with the given ETag. A stale ETag becomes a conflict. */
export async function restoreRevision(
  client: VulpesClient,
  target: RestoreTarget,
  revisionId: string,
  ifMatch: string,
): Promise<RestoreOutcome> {
  const result = await client.restoreRevision(target.projectId, target.assetId, revisionId, ifMatch);
  if (result.ok) {
    return { kind: 'restored', etag: result.value.etag };
  }
  const { failure } = result;
  if (failure.kind === 'problem' && failure.problem.code === 'ASSET_PRECONDITION_FAILED') {
    return { kind: 'conflict', currentEtag: failure.problem.etag };
  }
  return { kind: 'failed', message: revisionFailureMessage(failure) };
}
