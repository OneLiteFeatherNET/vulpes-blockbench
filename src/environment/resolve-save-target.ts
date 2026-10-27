import type { EnvironmentProfile, ProfileId } from './profiles';

/** The part of a remote project reference that the save needs. */
export interface SaveReference {
  readonly baseUrl: string;
}

export interface SaveTarget {
  /** The origin the save goes to: always the URL the project was opened from. */
  readonly baseUrl: string;
  /** True when the origin is the URL of the active environment. */
  readonly isActive: boolean;
  /** The profile whose URL matches the origin, or undefined when none matches. */
  readonly targetName: ProfileId | undefined;
}

/**
 * Decides where a save of a remote project goes. The save always goes to the
 * origin of the reference, never to the active environment. The result tells
 * the confirmation which environment it names.
 */
export function resolveSaveTarget(
  reference: SaveReference,
  activeProfile: EnvironmentProfile,
  profiles: readonly EnvironmentProfile[],
): SaveTarget {
  const isSet = reference.baseUrl !== '';
  const match = profiles.find((profile) => isSet && profile.baseUrl === reference.baseUrl);
  return {
    baseUrl: reference.baseUrl,
    isActive: isSet && activeProfile.baseUrl === reference.baseUrl,
    targetName: match?.id,
  };
}
