// The save and open operations against Vulpes, one function per user choice. Each
// returns an outcome that tells the caller what to do with the local project. None
// of them touches Blockbench, so the rules are tested with a fake fetch.

import type { VulpesClient } from '../api/client';
import { describeFailure, type UserMessage, type VulpesProblem } from '../problem';
import type { RemoteReference } from './reference';

export type SaveOutcome =
  | { readonly kind: 'saved'; readonly reference: RemoteReference }
  | { readonly kind: 'conflict'; readonly currentEtag: string | undefined }
  | { readonly kind: 'failed'; readonly message: UserMessage };

export type LoadOutcome =
  | { readonly kind: 'loaded'; readonly text: string; readonly reference: RemoteReference }
  | { readonly kind: 'failed'; readonly message: UserMessage };

export type CreateOutcome =
  | { readonly kind: 'created'; readonly reference: RemoteReference }
  | { readonly kind: 'failed'; readonly message: UserMessage };

/** The part of a reference that a new asset takes over: the origin and the project. */
export interface CreateTarget {
  readonly baseUrl: string;
  readonly projectId: string;
}

function isPrecondition(problem: VulpesProblem): boolean {
  return problem.code === 'ASSET_PRECONDITION_FAILED';
}

/** Saves over the asset with the given ETag in If-Match. A stale ETag becomes a conflict. */
async function replaceWith(
  client: VulpesClient,
  reference: RemoteReference,
  ifMatch: string,
  text: string,
): Promise<SaveOutcome> {
  const result = await client.replaceModel(reference.projectId, reference.assetId, ifMatch, reference.key, text);
  if (result.ok) {
    return { kind: 'saved', reference: { ...reference, etag: result.value.etag } };
  }
  const { failure } = result;
  if (failure.kind === 'problem' && isPrecondition(failure.problem)) {
    return { kind: 'conflict', currentEtag: failure.problem.etag };
  }
  return { kind: 'failed', message: describeFailure(failure) };
}

/** Ctrl+S on a linked project: replaces the asset with the ETag the plugin last saw. */
export function saveLinked(client: VulpesClient, reference: RemoteReference, text: string): Promise<SaveOutcome> {
  return replaceWith(client, reference, reference.etag, text);
}

/** Overwrite from the conflict dialog: the ETag of the 412 response, without a GET first. */
export function overwriteLinked(
  client: VulpesClient,
  reference: RemoteReference,
  text: string,
  currentEtag: string,
): Promise<SaveOutcome> {
  return replaceWith(client, reference, currentEtag, text);
}

/** Load latest from the conflict dialog: reads the current content and its ETag. */
export async function loadLatest(client: VulpesClient, reference: RemoteReference): Promise<LoadOutcome> {
  const result = await client.readModel(reference.projectId, reference.assetId);
  if (!result.ok) {
    return { kind: 'failed', message: describeFailure(result.failure) };
  }
  return { kind: 'loaded', text: result.value.text, reference: { ...reference, etag: result.value.etag } };
}

/** Creates a model under a key. Used for a new model and for Save as copy. */
export async function createLinked(
  client: VulpesClient,
  target: CreateTarget,
  key: string,
  text: string,
): Promise<CreateOutcome> {
  const result = await client.createModel(target.projectId, key, text);
  if (!result.ok) {
    return { kind: 'failed', message: describeFailure(result.failure) };
  }
  return {
    kind: 'created',
    reference: {
      baseUrl: target.baseUrl,
      projectId: target.projectId,
      assetId: result.value.asset.id,
      key,
      etag: result.value.etag,
    },
  };
}
