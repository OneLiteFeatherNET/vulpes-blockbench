import { describe, expect, it } from 'vitest';
import { itemTranslations } from '../../src/i18n/items';

function placeholdersOf(text: string): string[] {
  return [...new Set(text.match(/%\d+/gu) ?? [])].sort();
}

describe('itemTranslations', () => {
  it('has the same keys in English and German', () => {
    expect(Object.keys(itemTranslations.de).sort(), 'the German keys').toEqual(Object.keys(itemTranslations.en).sort());
  });

  it('prefixes every key with vulpes.items.', () => {
    for (const key of Object.keys(itemTranslations.en)) {
      expect(key.startsWith('vulpes.items.'), key).toBe(true);
    }
  });

  it('has no empty value in either language', () => {
    for (const table of [itemTranslations.en, itemTranslations.de]) {
      for (const [key, value] of Object.entries(table)) {
        expect(value, `value of ${key}`).not.toBe('');
      }
    }
  });

  it('uses the same placeholders in English and German for every key', () => {
    for (const key of Object.keys(itemTranslations.en)) {
      expect(placeholdersOf(itemTranslations.de[key] ?? ''), `placeholders of ${key}`).toEqual(placeholdersOf(itemTranslations.en[key] ?? ''));
    }
  });
});
