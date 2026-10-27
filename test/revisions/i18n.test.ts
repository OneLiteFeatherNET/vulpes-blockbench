import { describe, expect, it } from 'vitest';
import { revisionTranslations } from '../../src/i18n/revisions';

describe('revision translations', () => {
  it('give German a value for every English key', () => {
    const missing = Object.keys(revisionTranslations.en).filter((key) => !(key in revisionTranslations.de));
    expect(missing, 'the keys without German text').toEqual([]);
  });

  it('give English a value for every German key', () => {
    const missing = Object.keys(revisionTranslations.de).filter((key) => !(key in revisionTranslations.en));
    expect(missing, 'the keys without English text').toEqual([]);
  });
});
