// The name of a revision opened as a read-only project. Blockbench shows it as the project name.

export function snapshotName(key: string, revisionNumber: number): string {
  return `${key} @ r${String(revisionNumber)}`;
}
