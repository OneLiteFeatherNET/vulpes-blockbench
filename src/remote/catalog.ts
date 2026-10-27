// Reads the lists the dialogs show, one page after another. The page size and the
// stop rules are here, so the dialogs only call these functions.

import type { ApiResult, VulpesClient } from '../api/client';
import type { ProjectSummary } from '../api/dto';
import { appendPage, MODEL_PAGE_SIZE, type ModelList } from './model-list';

const PROJECT_PAGE_SIZE = 50;

/** Reads every project. Stops at an empty page, so a backend that never runs out cannot loop forever. */
export async function listAllProjects(client: VulpesClient): Promise<ApiResult<ProjectSummary[]>> {
  const items: ProjectSummary[] = [];
  let page = 0;
  let done = false;
  while (!done) {
    const result = await client.listProjects(page, PROJECT_PAGE_SIZE);
    if (!result.ok) {
      return { ok: false, failure: result.failure };
    }
    items.push(...result.value.items);
    page += 1;
    done = result.value.items.length === 0 || items.length >= result.value.totalSize;
  }
  return { ok: true, value: items };
}

/** Adds the page after the last one loaded. A failure leaves the caller's list unchanged. */
export async function loadNextModelPage(
  client: VulpesClient,
  projectId: string,
  list: ModelList,
): Promise<ApiResult<ModelList>> {
  const result = await client.listModels(projectId, list.nextPage, MODEL_PAGE_SIZE);
  return result.ok ? { ok: true, value: appendPage(list, result.value) } : { ok: false, failure: result.failure };
}
