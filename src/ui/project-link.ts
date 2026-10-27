// The remote reference of a project. It is a Property with export: false, so the
// reference lives on the project in memory and is never part of the model JSON.

import { isRemoteReference, type RemoteReference } from '../remote/reference';

const PROPERTY_NAME = 'vulpes_remote';

let property: Property | undefined;

export function registerLinkProperty(): void {
  property = new Property(ModelProject, 'object', PROPERTY_NAME, { export: false });
}

export function unregisterLinkProperty(): void {
  property?.delete();
  property = undefined;
}

/** The reference of a project, or undefined when the project is not linked. */
export function linkOf(project: BlockbenchProject): RemoteReference | undefined {
  const stored: unknown = project.vulpes_remote;
  return isRemoteReference(stored) ? stored : undefined;
}

export function setLink(project: BlockbenchProject, reference: RemoteReference): void {
  project.vulpes_remote = reference;
}
