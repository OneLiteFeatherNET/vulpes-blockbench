// Guards for the response bodies of the Vulpes asset and project endpoints. The
// bodies are untrusted: each field is checked and a body that does not fit is rejected.

import { isRecord } from '../json';

export interface AssetSummary {
  readonly id: string;
  readonly key: string;
  readonly fileName: string;
  readonly size: number;
  readonly sha1: string;
}

export interface ProjectSummary {
  readonly id: string;
  readonly displayName: string;
  readonly key: string;
}

/** One page of the `{ content, pageable, totalSize }` envelope. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly totalSize: number;
}

function text(record: Record<string, unknown>, name: string): string | undefined {
  const value = record[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function parseAssetSummary(value: unknown): AssetSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = text(value, 'id');
  const key = text(value, 'key');
  const fileName = text(value, 'fileName');
  const sha1 = text(value, 'sha1');
  const size = value['size'];
  if (id === undefined || key === undefined || fileName === undefined || sha1 === undefined || typeof size !== 'number') {
    return undefined;
  }
  return { id, key, fileName, size, sha1 };
}

export function parseProjectSummary(value: unknown): ProjectSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = text(value, 'id');
  const displayName = text(value, 'displayName');
  const key = text(value, 'key');
  if (id === undefined || displayName === undefined || key === undefined) {
    return undefined;
  }
  return { id, displayName, key };
}

/** Reads a page envelope. A page with one invalid item is rejected as a whole. */
export function parsePage<T>(value: unknown, parseItem: (item: unknown) => T | undefined): Page<T> | undefined {
  if (!isRecord(value) || !Array.isArray(value['content'])) {
    return undefined;
  }
  const totalSize = value['totalSize'];
  if (typeof totalSize !== 'number') {
    return undefined;
  }
  const items: T[] = [];
  for (const entry of value['content']) {
    const item = parseItem(entry);
    if (item === undefined) {
      return undefined;
    }
    items.push(item);
  }
  return { items, totalSize };
}

export function parseAssetPage(value: unknown): Page<AssetSummary> | undefined {
  return parsePage(value, parseAssetSummary);
}

export function parseProjectPage(value: unknown): Page<ProjectSummary> | undefined {
  return parsePage(value, parseProjectSummary);
}
