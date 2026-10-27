// Guards for the revision bodies of the Vulpes asset API. The bodies are untrusted:
// each field is checked and a body that does not fit is rejected.

import { parsePage, type Page } from '../api/dto';
import { isRecord } from '../json';

export interface RevisionSummary {
  readonly id: string;
  readonly number: number;
  readonly sha1: string;
  readonly size: number;
  /** The comment of the save, or undefined when the save had none. */
  readonly comment: string | undefined;
  readonly creationDate: string;
  readonly current: boolean;
}

function text(record: Record<string, unknown>, name: string): string | undefined {
  const value = record[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Reads one revision. A comment of null or a missing comment both mean no comment. */
export function parseRevision(value: unknown): RevisionSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = text(value, 'id');
  const sha1 = text(value, 'sha1');
  const creationDate = text(value, 'creationDate');
  const number = value['number'];
  const size = value['size'];
  const current = value['current'];
  const rawComment = value['comment'];
  const commentOk = rawComment === undefined || rawComment === null || typeof rawComment === 'string';
  if (
    id === undefined ||
    sha1 === undefined ||
    creationDate === undefined ||
    typeof number !== 'number' ||
    !Number.isInteger(number) ||
    number < 1 ||
    typeof size !== 'number' ||
    typeof current !== 'boolean' ||
    !commentOk
  ) {
    return undefined;
  }
  const comment = typeof rawComment === 'string' && rawComment !== '' ? rawComment : undefined;
  return { id, number, sha1, size, comment, creationDate, current };
}

/** Reads one page of the `{ content, pageable, totalSize }` envelope. */
export function parseRevisionPage(value: unknown): Page<RevisionSummary> | undefined {
  return parsePage(value, parseRevision);
}
