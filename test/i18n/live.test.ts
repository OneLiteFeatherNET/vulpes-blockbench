import { describe, expect, it } from 'vitest';
import { liveTranslations } from '../../src/i18n/live';

function placeholdersOf(text: string): string[] {
  return [...new Set(text.match(/%\d+/gu) ?? [])].sort();
}

describe('liveTranslations', () => {
  it('has the same keys in English and German', () => {
    expect(Object.keys(liveTranslations.de).sort(), 'the German keys').toEqual(Object.keys(liveTranslations.en).sort());
  });

  it('prefixes every key with vulpes.live.', () => {
    for (const key of Object.keys(liveTranslations.en)) {
      expect(key.startsWith('vulpes.live.'), key).toBe(true);
    }
  });

  it('has no empty value in either language', () => {
    for (const table of [liveTranslations.en, liveTranslations.de]) {
      for (const [key, value] of Object.entries(table)) {
        expect(value.trim(), `value of ${key}`).not.toBe('');
      }
    }
  });

  it('uses the same placeholders in English and German for every key', () => {
    for (const key of Object.keys(liveTranslations.en)) {
      expect(placeholdersOf(liveTranslations.de[key] ?? ''), `placeholders of ${key}`).toEqual(placeholdersOf(liveTranslations.en[key] ?? ''));
    }
  });
});
