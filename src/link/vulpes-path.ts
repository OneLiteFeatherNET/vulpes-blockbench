// The export path of a project opened from or saved to Vulpes: vulpes://<environment>/<projectId>/<assetId>.
// The path names the asset; the base URL and the ETag are held by the plugin, not by the path.

import { isProfileId, type ProfileId } from '../environment/profiles';

const SCHEME = 'vulpes://';

export interface VulpesPath {
  readonly environment: ProfileId;
  readonly projectId: string;
  readonly assetId: string;
}

/** Builds the path. Ids are percent-encoded, so a slash inside an id cannot split the path. */
export function buildVulpesPath(path: VulpesPath): string {
  return `${SCHEME}${path.environment}/${encodeURIComponent(path.projectId)}/${encodeURIComponent(path.assetId)}`;
}

/** Reads a path built by `buildVulpesPath`. Anything else, including a malformed escape, gives undefined. */
export function parseVulpesPath(raw: string): VulpesPath | undefined {
  if (!raw.startsWith(SCHEME)) {
    return undefined;
  }
  const [environment, projectPart, assetPart, extra] = raw.slice(SCHEME.length).split('/');
  if (extra !== undefined || !isProfileId(environment) || projectPart === undefined || assetPart === undefined) {
    return undefined;
  }
  const projectId = decodeId(projectPart);
  const assetId = decodeId(assetPart);
  if (projectId === undefined || assetId === undefined) {
    return undefined;
  }
  return { environment, projectId, assetId };
}

function decodeId(part: string): string | undefined {
  try {
    const id = decodeURIComponent(part);
    return id === '' ? undefined : id;
  } catch {
    return undefined;
  }
}
