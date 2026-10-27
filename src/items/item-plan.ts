// What the assignment does with the components of one item. Pure: the caller reads the
// components and writes the answer.

import type { ComponentEntry } from './item-dto';

/** The data component that names the model an item is drawn with. */
export const ITEM_MODEL_COMPONENT = 'minecraft:item_model';

export type AssignmentPlan =
  | { readonly kind: 'already-assigned' }
  | { readonly kind: 'create' }
  /** The item uses another model. The designer confirms before the entry with `componentId` is changed. */
  | { readonly kind: 'replace'; readonly componentId: string; readonly previous: string };

/** A value as text for the designer. A string is shown as it is, anything else as JSON. */
export function describeValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function itemModelOf(components: readonly ComponentEntry[]): ComponentEntry | undefined {
  return components.find((component) => component.componentKey === ITEM_MODEL_COMPONENT);
}

/** The model the item uses now, or undefined when it has none. */
export function currentModelOf(components: readonly ComponentEntry[]): string | undefined {
  const entry = itemModelOf(components);
  return entry === undefined ? undefined : describeValue(entry.value);
}

export function planAssignment(components: readonly ComponentEntry[], modelKey: string): AssignmentPlan {
  const entry = itemModelOf(components);
  if (entry === undefined) {
    return { kind: 'create' };
  }
  if (entry.value === modelKey) {
    return { kind: 'already-assigned' };
  }
  return { kind: 'replace', componentId: entry.id, previous: describeValue(entry.value) };
}
