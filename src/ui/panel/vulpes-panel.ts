// Temporary stub until the real sidebar panel lands. It keeps the branch compiling;
// the real file replaces it at merge. The type keeps the contract of the host.

import type { VulpesPanelHost } from './host';

export const createVulpesPanel: (host: VulpesPanelHost) => { dispose(): void } = () => ({ dispose: () => undefined });
