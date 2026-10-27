// The three ways the plugin speaks to the designer: a quiet quick message for a
// success, a message box for an error or a question, and the conflict box.

export function quickMessage(text: string): void {
  Blockbench.showQuickMessage(text);
}

export function errorMessage(text: string): void {
  Blockbench.showMessageBox({ title: 'vulpes.error.title', message: text, icon: 'error', buttons: ['dialog.ok'], confirm: 0, cancel: 0 });
}

export interface ConflictActions {
  /** Undefined when the 412 response carried no ETag, because then nothing can be overwritten safely. */
  readonly overwrite: (() => void) | undefined;
  readonly loadLatest: () => void;
  readonly saveCopy: () => void;
}

/** The save prompt for a 412 response. Cancel is the default, so a stray Enter never overwrites. */
export function conflictMessage(actions: ConflictActions): void {
  const commands: Record<string, string> = {};
  if (actions.overwrite !== undefined) {
    commands['overwrite'] = 'vulpes.conflict.overwrite';
  }
  commands['load_latest'] = 'vulpes.conflict.load_latest';
  commands['save_copy'] = 'vulpes.conflict.save_copy';
  Blockbench.showMessageBox(
    { title: 'vulpes.conflict.title', message: 'vulpes.conflict.message', icon: 'save', commands, buttons: ['dialog.cancel'], confirm: 0, cancel: 0 },
    (command) => {
      if (command === 'overwrite') {
        actions.overwrite?.();
      } else if (command === 'load_latest') {
        actions.loadLatest();
      } else if (command === 'save_copy') {
        actions.saveCopy();
      }
    },
  );
}

/** Asks a question with a confirm button and Cancel. Closing the box in any other way counts as Cancel. */
export function confirmMessage(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  onCancel?: () => void,
): void {
  Blockbench.showMessageBox(
    { title, message, icon: 'help', buttons: [confirmLabel, 'dialog.cancel'], confirm: 0, cancel: 1 },
    (button) => {
      if (button === 0) {
        onConfirm();
      } else {
        onCancel?.();
      }
    },
  );
}
