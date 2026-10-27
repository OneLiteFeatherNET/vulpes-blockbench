// Shared helpers of the remote dialogs: clients for an origin, the configured
// base URL of the active environment, and the notice that names the save target.

import { createVulpesClient, type VulpesClient } from '../api/client';
import { PROFILE_IDS, type EnvironmentProfile } from '../environment/profiles';
import { resolveSaveTarget } from '../environment/resolve-save-target';
import type { EnvironmentService } from '../environment/service';
import type { RemoteReference } from '../remote/reference';
import type { UserMessage } from '../problem';
import { rendererFetch } from './fetch-adapter';
import { notify } from './notify';

/** Returns the service of the current Blockbench session. Each call reads the stored values again. */
export type ServiceProvider = () => EnvironmentService;

export function clientFor(baseUrl: string): VulpesClient {
  return createVulpesClient({ baseUrl, fetch: rendererFetch });
}

export function profilesOf(service: EnvironmentService): readonly EnvironmentProfile[] {
  const snapshot = service.snapshot();
  return PROFILE_IDS.map((id) => ({ id, baseUrl: snapshot.baseUrls[id] }));
}

/** The base URL of the active environment, or undefined after a notice that it is not configured. */
export function configuredBaseUrl(service: EnvironmentService): string | undefined {
  const configured = service.configuredActiveProfile();
  if (configured.ok) {
    return configured.baseUrl;
  }
  const name = service.activeProfile().id === 'prod' ? 'Prod' : 'Dev';
  notify(`${name} is not configured. Enter its URL in the Vulpes settings first.`);
  return undefined;
}

/** The success notice of a save. It names the origin, and says so when that is not the active environment. */
export function savedNotice(service: EnvironmentService, reference: RemoteReference): string {
  const target = resolveSaveTarget(reference, service.activeProfile(), profilesOf(service));
  const where = target.targetName ?? target.baseUrl;
  return target.isActive
    ? `Saved to Vulpes (${where}).`
    : `Saved to Vulpes (${where}), which is not the active environment (${service.activeProfile().id}).`;
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

/** Runs one user action. An unexpected failure becomes a notice instead of an unhandled rejection. */
export function runAction(task: () => Promise<void>): void {
  task().catch((error: unknown) => {
    notify(`Unexpected error: ${error instanceof Error ? error.message : 'unknown error'}`);
  });
}
