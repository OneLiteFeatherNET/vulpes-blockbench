// Opens a model from Vulpes as a new Blockbench project and links it to its asset.

import { fileNameForKey } from '../link/display-name';
import type { LinkRecord } from '../link/link-state';
import { formatIdOf } from '../model/format';
import { emitVulpesChange } from './change-bus';
import { quickMessage } from './feedback';
import type { UserMessage } from '../problem';
import { attachLink } from './project-link';

/** Returns the message when Blockbench cannot open the model, and undefined on success. */
export function placeModel(model: Record<string, unknown>, record: LinkRecord): UserMessage | undefined {
  try {
    setupProject(formatIdOf(model));
    // The file name, never the vulpes:// path, becomes the project name.
    Codecs.project.parse(model, fileNameForKey(record.key));
  } catch (error: unknown) {
    return { key: 'vulpes.parse_failed', params: [error instanceof Error ? error.message : 'unknown error'] };
  }
  const opened = Project;
  if (opened === null || opened === undefined) {
    return { key: 'vulpes.not_opened', params: [] };
  }
  attachLink(opened, record);
  opened.saved = true;
  emitVulpesChange();
  quickMessage(tl('vulpes.opened', [record.key]));
  return undefined;
}
