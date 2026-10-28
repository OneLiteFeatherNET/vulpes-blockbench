// Decides what a `saved` event changes in the local links. It is pure: the caller applies
// the updates and shows the announcement.

import type { SavedEvent } from './events';

/** A local project linked to an asset, with the ETag it holds for that asset. */
export interface LocalLink {
  readonly projectKey: string;
  readonly environment: string;
  readonly assetId: string;
  readonly etag: string;
}

export interface EtagUpdate {
  readonly projectKey: string;
  readonly etag: string;
}

export interface EtagPropagation {
  /** The links of this asset that hold an older ETag and must take the new one. */
  readonly updates: readonly EtagUpdate[];
  /** Set when the save was made by another participant. Undefined for an own save or an unknown asset. */
  readonly announcement: { readonly revision: number } | undefined;
}

export interface EtagPropagationInput {
  readonly environment: string;
  readonly assetId: string;
  readonly saved: SavedEvent;
  readonly links: readonly LocalLink[];
}

/**
 * Only links of the same environment and asset take part. A save is announced when none of
 * them holds the new ETag, which means this instance did not make the save.
 */
export function decideEtagPropagation(input: EtagPropagationInput): EtagPropagation {
  const { environment, assetId, saved } = input;
  const relevant = input.links.filter((link) => link.environment === environment && link.assetId === assetId);
  if (relevant.length === 0) {
    return { updates: [], announcement: undefined };
  }
  const held = relevant.some((link) => link.etag === saved.etag);
  const updates = relevant
    .filter((link) => link.etag !== saved.etag)
    .map((link): EtagUpdate => ({ projectKey: link.projectKey, etag: saved.etag }));
  return { updates, announcement: held ? undefined : { revision: saved.revision } };
}
