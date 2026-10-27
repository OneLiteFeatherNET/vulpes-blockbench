// "Assign to item..." for a project linked to Vulpes: the File menu entry, and the
// dialog that picks the item. The requests go to the base URL of the link, never to the
// active environment. The decisions are in src/items; this file only shows them.

import type { VulpesClient } from '../api/client';
import type { ItemSummary } from '../items/item-dto';
import { assignModelToItem } from '../items/assignment';
import { listAllComponents, listAllItems, visibleItems } from '../items/item-list';
import { currentModelOf } from '../items/item-plan';
import { describeAssignmentFailure } from '../items/messages';
import type { LinkRecord } from '../link/link-state';
import { describeFailure } from '../problem';
import { confirmMessage, errorMessage, quickMessage } from './feedback';
import { linkOf } from './project-link';
import { clientFor, fieldText, messageText, runAction } from './remote-context';

interface AssignContext {
  readonly record: LinkRecord;
  readonly client: VulpesClient;
  readonly items: readonly ItemSummary[];
}

interface DialogState {
  readonly search: string;
  readonly itemId: string | undefined;
  /** The line that shows the current model of the selected item, once it was read. */
  readonly currentLine: string | undefined;
}

/** Adds the File menu entry. The returned function removes it again. */
export function registerAssignItemAction(): () => void {
  const action = new Action('vulpes_assign_item', {
    name: 'vulpes.items.action',
    description: 'vulpes.items.action.description',
    icon: 'link',
    category: 'file',
    click: () => {
      runAction(() => startAssignItem());
    },
  });
  MenuBar.addAction(action, 'file.#project');
  return () => {
    action.delete();
  };
}

function itemName(item: ItemSummary): string {
  return item.uiName !== '' ? item.uiName : item.key;
}

export async function startAssignItem(): Promise<void> {
  const project = Project;
  if (project === null || project === undefined) {
    errorMessage(tl('vulpes.items.no_model'));
    return;
  }
  const record = linkOf(project);
  if (record === undefined) {
    errorMessage(tl('vulpes.items.not_linked'));
    return;
  }
  const client = clientFor(record.baseUrl);
  const result = await listAllItems(client, record.projectId);
  if (!result.ok) {
    errorMessage(messageText(describeFailure(result.failure)));
    return;
  }
  if (result.value.length === 0) {
    errorMessage(tl('vulpes.items.no_items'));
    return;
  }
  showDialog({ record, client, items: result.value }, { search: '', itemId: undefined, currentLine: undefined });
}

function showDialog(context: AssignContext, state: DialogState): void {
  const visible = visibleItems(context.items, state.search);
  const options: Record<string, string> = {};
  for (const item of visible) {
    options[item.id] = `${itemName(item)} (${item.key})`;
  }
  const selected = visible.find((item) => item.id === state.itemId) ?? visible[0];
  const lines = [tl('vulpes.items.hint')];
  if (state.currentLine !== undefined) {
    lines.push(state.currentLine);
  }
  if (visible.length === 0) {
    lines.push(tl('vulpes.items.no_match'));
  }
  const dialog: Dialog = new Dialog('vulpes_assign_item', {
    title: 'vulpes.items.title',
    lines,
    form: {
      search: { label: tl('vulpes.items.field.search'), type: 'text', value: state.search },
      item: { label: tl('vulpes.items.field.item'), type: 'select', options, value: selected?.id ?? '' },
    },
    buttons: ['vulpes.items.assign.button', 'vulpes.items.refresh.button', 'dialog.cancel'],
    confirmIndex: 0,
    cancelIndex: 2,
    onConfirm(result) {
      const item = context.items.find((entry) => entry.id === fieldText(result, 'item'));
      if (item === undefined) {
        return false;
      }
      dialog.hide();
      runAction(() => assignTo(context, item));
      return false;
    },
    onButton(index) {
      // Refresh applies the search and reads the current model of the selected item. The dialog is shown again with the result.
      if (index !== 1) {
        return;
      }
      const form = dialog.getFormResult();
      const search = fieldText(form, 'search') ?? state.search;
      const itemId = fieldText(form, 'item');
      dialog.hide();
      runAction(() => refresh(context, search, itemId));
      return false;
    },
  });
  dialog.show();
}

async function refresh(context: AssignContext, search: string, itemId: string | undefined): Promise<void> {
  const visible = visibleItems(context.items, search);
  const selected = visible.find((item) => item.id === itemId) ?? visible[0];
  const currentLine = selected === undefined ? undefined : await currentLineOf(context, selected);
  showDialog(context, { search, itemId: selected?.id, currentLine });
}

async function currentLineOf(context: AssignContext, item: ItemSummary): Promise<string> {
  const read = await listAllComponents(context.client, item.id);
  if (!read.ok) {
    return messageText(describeAssignmentFailure(read.failure));
  }
  const model = currentModelOf(read.value);
  return model === undefined ? tl('vulpes.items.none') : tl('vulpes.items.current', [model]);
}

async function assignTo(context: AssignContext, item: ItemSummary): Promise<void> {
  const name = itemName(item);
  const key = context.record.key;
  const outcome = await assignModelToItem(context.client, {
    itemId: item.id,
    modelKey: key,
    confirmReplace: (previous) => askReplace(name, previous, key),
  });
  switch (outcome.kind) {
    case 'assigned':
      quickMessage(tl('vulpes.items.assigned', [name, key]));
      return;
    case 'already-assigned':
      quickMessage(tl('vulpes.items.already', [name, key]));
      return;
    case 'declined':
      return;
    case 'failed':
      errorMessage(messageText(describeAssignmentFailure(outcome.failure)));
      return;
  }
}

/** Resolves true only when the designer confirms the replacement. Any other way of closing the box counts as Cancel. */
function askReplace(name: string, previous: string, key: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmMessage(
      tl('vulpes.items.replace.title', [name]),
      tl('vulpes.items.replace.message', [name, previous, key]),
      tl('vulpes.items.replace.button'),
      () => {
        resolve(true);
      },
      () => {
        resolve(false);
      },
    );
  });
}
