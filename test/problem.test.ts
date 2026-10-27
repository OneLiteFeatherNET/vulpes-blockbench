import { describe, expect, it } from 'vitest';
import { problemSlugOf } from '../src/problem';

describe('problemSlugOf', () => {
  it('returns the slug of a Vulpes problem type', () => {
    expect(problemSlugOf('urn:vulpes:problem:key-taken')).toBe('key-taken');
  });

  it('returns undefined for a problem type in another namespace', () => {
    expect(problemSlugOf('urn:other:problem:key-taken')).toBeUndefined();
  });

  it('returns undefined when the slug is empty', () => {
    expect(problemSlugOf('urn:vulpes:problem:')).toBeUndefined();
  });
});
