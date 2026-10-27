// Guards for the item and component bodies of the Vulpes API. The bodies are untrusted:
// each field is checked and a body that does not fit is rejected.

import { parsePage, type Page } from '../api/dto';
import { isRecord } from '../json';

export interface ItemSummary {
  readonly id: string;
  /** The display name. Empty when the item has none. */
  readonly uiName: string;
  readonly key: string;
}

/** One data component of an item. The value is the vanilla JSON value, kept as it was received. */
export interface ComponentEntry {
  readonly id: string;
  readonly componentKey: string;
  readonly value: unknown;
}

function nonEmpty(record: Record<string, unknown>, name: string): string | undefined {
  const value = record[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function parseItemSummary(value: unknown): ItemSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = nonEmpty(value, 'id');
  const key = nonEmpty(value, 'key');
  if (id === undefined || key === undefined) {
    return undefined;
  }
  const uiName = value['uiName'];
  return { id, uiName: typeof uiName === 'string' ? uiName : '', key };
}

export function parseComponentEntry(value: unknown): ComponentEntry | undefined {
  if (!isRecord(value) || !('value' in value)) {
    return undefined;
  }
  const id = nonEmpty(value, 'id');
  const componentKey = nonEmpty(value, 'componentKey');
  if (id === undefined || componentKey === undefined) {
    return undefined;
  }
  return { id, componentKey, value: value['value'] };
}

export function parseItemPage(value: unknown): Page<ItemSummary> | undefined {
  return parsePage(value, parseItemSummary);
}

export function parseComponentPage(value: unknown): Page<ComponentEntry> | undefined {
  return parsePage(value, parseComponentEntry);
}
