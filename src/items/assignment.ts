// Assigns the key of a linked model to an item. It reads the components of the item,
// plans the write, asks the designer before a replacement and sends the one write.
// Items carry no ETag, so the write is unconditional and the last write wins.

import type { VulpesClient } from '../api/client';
import type { ApiFailure } from '../problem';
import { listAllComponents } from './item-list';
import { ITEM_MODEL_COMPONENT, planAssignment } from './item-plan';

export interface AssignmentRequest {
  readonly itemId: string;
  readonly modelKey: string;
  /** Asks the designer to replace `previous`. Resolves true only when the designer confirms. */
  readonly confirmReplace: (previous: string) => Promise<boolean>;
}

export type AssignmentOutcome =
  | { readonly kind: 'assigned'; readonly mode: 'created' | 'replaced' }
  | { readonly kind: 'already-assigned' }
  | { readonly kind: 'declined' }
  | { readonly kind: 'failed'; readonly failure: ApiFailure };

export async function assignModelToItem(client: VulpesClient, request: AssignmentRequest): Promise<AssignmentOutcome> {
  const read = await listAllComponents(client, request.itemId);
  if (!read.ok) {
    return { kind: 'failed', failure: read.failure };
  }
  const plan = planAssignment(read.value, request.modelKey);
  switch (plan.kind) {
    case 'already-assigned':
      return { kind: 'already-assigned' };
    case 'create': {
      const written = await client.createComponent(request.itemId, ITEM_MODEL_COMPONENT, request.modelKey);
      return written.ok ? { kind: 'assigned', mode: 'created' } : { kind: 'failed', failure: written.failure };
    }
    case 'replace': {
      const confirmed = await request.confirmReplace(plan.previous);
      if (!confirmed) {
        return { kind: 'declined' };
      }
      const written = await client.updateComponent(request.itemId, plan.componentId, ITEM_MODEL_COMPONENT, request.modelKey);
      return written.ok ? { kind: 'assigned', mode: 'replaced' } : { kind: 'failed', failure: written.failure };
    }
  }
}
