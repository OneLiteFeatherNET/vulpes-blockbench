import { describe, expect, it } from 'vitest';
import { coreTranslations, type TranslationTables } from '../../src/i18n/core';
import { panelTranslations } from '../../src/i18n/panel';

const tables: TranslationTables = { en: { ...coreTranslations.en, ...panelTranslations.en }, de: { ...coreTranslations.de, ...panelTranslations.de } };

function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/%\d+/gu)].map((match) => match[0]).sort();
}

describe('translation tables', () => {
  it('give German a value for every English key', () => {
    const missing = Object.keys(tables.en).filter((key) => !(key in tables.de));
    expect(missing, 'the keys without German text').toEqual([]);
  });

  it('give English a value for every German key', () => {
    const missing = Object.keys(tables.de).filter((key) => !(key in tables.en));
    expect(missing, 'the keys without English text').toEqual([]);
  });

  it('have no empty value in either language', () => {
    const empty = [...Object.entries(tables.en), ...Object.entries(tables.de)].filter(([, text]) => text.trim() === '');
    expect(empty, 'the empty entries').toEqual([]);
  });

  it('keep the same placeholders in German as in English', () => {
    const changed = Object.keys(tables.en).filter(
      (key) => tables.de[key] !== undefined && placeholdersOf(tables.en[key] ?? '').join() !== placeholdersOf(tables.de[key]).join(),
    );
    expect(changed, 'the keys whose placeholders differ').toEqual([]);
  });
});
