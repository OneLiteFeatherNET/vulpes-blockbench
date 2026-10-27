const PROBLEM_TYPE_PATTERN = /^urn:vulpes:problem:([a-z][a-z0-9-]*)$/u;

/**
 * Returns the slug of a Vulpes problem type such as `urn:vulpes:problem:key-taken`,
 * or `undefined` when the type is not a Vulpes problem type.
 */
export function problemSlugOf(type: string): string | undefined {
  return PROBLEM_TYPE_PATTERN.exec(type)?.[1];
}
