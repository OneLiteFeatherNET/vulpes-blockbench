import { isRecord } from '../json';
import { parseEntityTag } from '../api/http';

/**
 * Where a Blockbench project came from in Vulpes. It is stored on the project and
 * never written into the model JSON. Saves go to `baseUrl`, not to the active environment.
 */
export interface RemoteReference {
  readonly baseUrl: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly key: string;
  /** The last version the plugin saw, exactly as the backend sent it. */
  readonly etag: string;
}

function nonEmpty(record: Record<string, unknown>, name: string): string | undefined {
  const value = record[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Checks a value read back from the project. The stored data is untrusted. */
export function isRemoteReference(value: unknown): value is RemoteReference {
  if (!isRecord(value)) {
    return false;
  }
  const baseUrl = nonEmpty(value, 'baseUrl');
  const projectId = nonEmpty(value, 'projectId');
  const assetId = nonEmpty(value, 'assetId');
  const key = nonEmpty(value, 'key');
  const etag = nonEmpty(value, 'etag');
  return (
    baseUrl !== undefined &&
    projectId !== undefined &&
    assetId !== undefined &&
    key !== undefined &&
    etag !== undefined &&
    parseEntityTag(etag) !== undefined
  );
}
