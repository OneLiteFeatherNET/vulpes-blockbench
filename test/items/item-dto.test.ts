import { describe, expect, it } from 'vitest';
import { parseComponentEntry, parseItemSummary } from '../../src/items/item-dto';

describe('parseItemSummary', () => {
  it('reads the id, name and key of a valid item', () => {
    expect(parseItemSummary({ id: 'i-1', uiName: 'Ruby', key: 'ruby', comment: '' }), 'the item').toEqual({
      id: 'i-1',
      uiName: 'Ruby',
      key: 'ruby',
    });
  });

  it('keeps an item without a name, with an empty name', () => {
    expect(parseItemSummary({ id: 'i-1', key: 'ruby' }), 'the item').toEqual({ id: 'i-1', uiName: '', key: 'ruby' });
  });

  it('rejects an item without a key', () => {
    expect(parseItemSummary({ id: 'i-1', uiName: 'Ruby' }), 'the item').toBeUndefined();
  });

  it('rejects a value that is not an object', () => {
    expect(parseItemSummary(['i-1']), 'the item').toBeUndefined();
  });
});

describe('parseComponentEntry', () => {
  it('keeps the value exactly as sent, including a JSON string', () => {
    expect(parseComponentEntry({ id: 'c-1', componentKey: 'minecraft:item_model', value: 'vulpes:item/ruby' }), 'the entry').toEqual({
      id: 'c-1',
      componentKey: 'minecraft:item_model',
      value: 'vulpes:item/ruby',
    });
  });

  it('accepts a component whose value is an object', () => {
    const entry = parseComponentEntry({ id: 'c-2', componentKey: 'minecraft:food', value: { nutrition: 4 } });
    expect(entry?.value, 'the value').toEqual({ nutrition: 4 });
  });

  it('rejects a component without a value', () => {
    expect(parseComponentEntry({ id: 'c-1', componentKey: 'minecraft:item_model' }), 'the entry').toBeUndefined();
  });

  it('rejects a component without an id', () => {
    expect(parseComponentEntry({ componentKey: 'minecraft:item_model', value: 'x' }), 'the entry').toBeUndefined();
  });
});
