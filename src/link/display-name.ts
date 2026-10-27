// The file name of a model key. Blockbench takes the project name from it, so the
// name never contains the vulpes:// path.

/** The last segment of the key, with .bbmodel. An empty last segment becomes "model". */
export function fileNameForKey(key: string): string {
  const segment = key.split(/[/:]/u).pop() ?? '';
  return `${segment === '' ? 'model' : segment}.bbmodel`;
}
