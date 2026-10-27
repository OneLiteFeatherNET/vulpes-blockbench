import { describe, expect, it } from 'vitest';
import { panelTranslations } from '../../src/i18n/panel';

describe('panelTranslations', () => {
  it('has the same keys in English and German', () => {
    const english = Object.keys(panelTranslations.en).sort();
    const german = Object.keys(panelTranslations.de).sort();
    expect(german).toEqual(english);
  });

  it('has no empty value in either language', () => {
    for (const table of [panelTranslations.en, panelTranslations.de]) {
      for (const [key, value] of Object.entries(table)) {
        expect(value, `value of ${key}`).not.toBe('');
      }
    }
  });

  it('prefixes every key with vulpes.panel.', () => {
    for (const key of Object.keys(panelTranslations.en)) {
      expect(key.startsWith('vulpes.panel.'), key).toBe(true);
    }
  });

  it('keeps the placeholders of linked_to in English and German', () => {
    expect(panelTranslations.en['vulpes.panel.linked_to']).toContain('%0');
    expect(panelTranslations.en['vulpes.panel.linked_to']).toContain('%1');
    expect(panelTranslations.de['vulpes.panel.linked_to']).toContain('%0');
    expect(panelTranslations.de['vulpes.panel.linked_to']).toContain('%1');
  });
});
