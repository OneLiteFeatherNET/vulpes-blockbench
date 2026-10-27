// The two fixed environment profiles. A profile holds only its id and its base
// URL. The sign-in change adds its issuer and client id to this record.

export const PROFILE_IDS = ['dev', 'prod'] as const;

export type ProfileId = (typeof PROFILE_IDS)[number];

export function isProfileId(value: unknown): value is ProfileId {
  return PROFILE_IDS.some((id) => id === value);
}

export interface EnvironmentProfile {
  readonly id: ProfileId;
  readonly baseUrl: string;
}

export interface EnvironmentSnapshot {
  readonly active: ProfileId;
  readonly baseUrls: Readonly<Record<ProfileId, string>>;
}

export const DEFAULT_DEV_BASE_URL = 'http://localhost:8085';

// Production has no default URL on purpose: it is entered by the designer.
export const DEFAULT_PROD_BASE_URL = '';

export function defaultSnapshot(): EnvironmentSnapshot {
  return {
    active: 'dev',
    baseUrls: { dev: DEFAULT_DEV_BASE_URL, prod: DEFAULT_PROD_BASE_URL },
  };
}

/** Only a switch into `prod` from another profile asks the designer first. */
export function requiresConfirmation(from: ProfileId, to: ProfileId): boolean {
  return to === 'prod' && from !== 'prod';
}

/** The label of the "Vulpes" menu, which shows the active environment. */
export function environmentLabel(active: ProfileId): string {
  return active === 'prod' ? 'Vulpes (Prod)' : 'Vulpes (Dev)';
}
