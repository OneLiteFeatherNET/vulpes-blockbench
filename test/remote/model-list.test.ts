import { describe, expect, it } from 'vitest';
import { appendPage, emptyModelList, hasMoreModels, MODEL_PAGE_SIZE } from '../../src/remote/model-list';
import type { AssetSummary } from '../../src/api/dto';

function asset(index: number): AssetSummary {
  return { id: `id-${String(index)}`, key: `vulpes:item/model-${String(index)}`, fileName: `model-${String(index)}.bbmodel`, size: 1, sha1: 'abc' };
}

function pageOf(from: number, count: number, totalSize: number): { items: AssetSummary[]; totalSize: number } {
  const items = Array.from({ length: count }, (_, offset) => asset(from + offset));
  return { items, totalSize };
}

describe('model list paging', () => {
  it('uses pages of 50 models', () => {
    expect(MODEL_PAGE_SIZE).toBe(50);
  });

  it('has no more models before the first page is loaded and when the project is empty', () => {
    expect(hasMoreModels(emptyModelList())).toBe(false);
  });

  it('asks for the second page while the first page does not hold every model', () => {
    const state = appendPage(emptyModelList(), pageOf(0, 50, 51));
    expect(hasMoreModels(state), 'more models').toBe(true);
    expect(state.nextPage, 'the next page index').toBe(1);
  });

  it('keeps the models of earlier pages when the next page is added', () => {
    const first = appendPage(emptyModelList(), pageOf(0, 50, 51));
    const second = appendPage(first, pageOf(50, 1, 51));
    expect(second.items.length, 'the number of models').toBe(51);
    expect(second.items[0]?.key, 'the first model').toBe('vulpes:item/model-0');
  });

  it('has no more models once every model is listed', () => {
    const first = appendPage(emptyModelList(), pageOf(0, 50, 51));
    const second = appendPage(first, pageOf(50, 1, 51));
    expect(hasMoreModels(second), 'more models').toBe(false);
  });
});
