// Shared helpers of the Vulpes flows: the client for an origin, the origin of the active
// environment, the designer-facing text of a message, and the guard around each action.

import { createVulpesClient, type VulpesClient } from '../api/client';
import type { ProfileId } from '../environment/profiles';
import type { EnvironmentService } from '../environment/service';
import type { UserMessage } from '../problem';
import { errorMessage } from './feedback';
import { rendererFetch } from './fetch-adapter';

/** Where a flow sends its requests: the base URL and the environment it belongs to. */
export interface Origin {
  readonly baseUrl: string;
  readonly environment: ProfileId;
}

export function clientFor(baseUrl: string): VulpesClient {
  return createVulpesClient({ baseUrl, fetch: rendererFetch });
}

export function environmentName(id: ProfileId): string {
  return tl(id === 'prod' ? 'vulpes.env.prod' : 'vulpes.env.dev');
}

/** The origin of the active environment, or undefined when its URL is missing or invalid. */
export function originOf(service: EnvironmentService): Origin | undefined {
  const configured = service.configuredActiveProfile();
  return configured.ok ? { baseUrl: configured.baseUrl, environment: service.activeProfile().id } : undefined;
}

export function notConfigured(service: EnvironmentService): UserMessage {
  return { key: 'vulpes.not_configured', params: [environmentName(service.activeProfile().id)] };
}

/** The designer-facing text of a message, translated by Blockbench. */
export function messageText(message: UserMessage): string {
  return tl(message.key, [...message.params]);
}

/** Reads a text field of a dialog result. Blockbench returns untrusted values, so anything else is undefined. */
export function fieldText(result: Record<string, unknown>, name: string): string | undefined {
  const value = result[name];
  return typeof value === 'string' ? value : undefined;
}

/** Runs one designer action. An unexpected failure becomes a message box instead of an unhandled rejection. */
export function runAction(task: () => Promise<void>): void {
  task().catch((error: unknown) => {
    errorMessage(tl('vulpes.unexpected', [error instanceof Error ? error.message : 'unknown error']));
  });
}
