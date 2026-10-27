import { isRecord } from '../json';

/** The Blockbench format id of a parsed model. Models without a known format open as `free`. */
export function formatIdOf(model: unknown): string {
  if (!isRecord(model)) {
    return 'free';
  }
  const meta = model['meta'];
  if (!isRecord(meta) || typeof meta['model_format'] !== 'string') {
    return 'free';
  }
  return meta['model_format'];
}
