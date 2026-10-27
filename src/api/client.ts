// The one module that talks to the Vulpes asset API. It is the only place that
// sets `If-Match`, and it never sends a replacement without a valid ETag.

import { parseJsonText } from '../json';
import { fileNameForKey } from '../link/display-name';
import { problemFromResponse, type ApiFailure } from '../problem';
import { parseRevisionPage, type RevisionSummary } from '../revisions/dto';
import { parseAssetPage, parseAssetSummary, parseProjectPage, type AssetSummary, type Page, type ProjectSummary } from './dto';
import { parseComponentEntry, parseComponentPage, parseItemPage, type ComponentEntry, type ItemSummary } from '../items/item-dto';
import { parseEntityTag, type FetchLike, type HttpRequest, type MultipartBody } from './http';

export type ApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ApiFailure };

/** The content of a model and the version it had when it was read. */
export interface VersionedText {
  readonly text: string;
  readonly etag: string;
}

export interface StoredModel {
  readonly asset: AssetSummary;
  readonly etag: string;
}

export interface VulpesClientOptions {
  readonly baseUrl: string;
  readonly fetch: FetchLike;
  /** Returns the bearer token, or nothing. Omitted until sign-in exists. */
  readonly token?: () => string | undefined;
}

export interface VulpesClient {
  listProjects(page: number, size: number): Promise<ApiResult<Page<ProjectSummary>>>;
  listModels(projectId: string, page: number, size: number): Promise<ApiResult<Page<AssetSummary>>>;
  readModel(projectId: string, assetId: string): Promise<ApiResult<VersionedText>>;
  createModel(projectId: string, key: string, text: string): Promise<ApiResult<StoredModel>>;
  /** A replacement with an optional comment, stored with the revision. An empty comment is not sent. */
  replaceModel(projectId: string, assetId: string, ifMatch: string, key: string, text: string, comment?: string): Promise<ApiResult<StoredModel>>;
  listRevisions(projectId: string, assetId: string, page: number, size: number): Promise<ApiResult<Page<RevisionSummary>>>;
  readRevision(projectId: string, assetId: string, revisionId: string): Promise<ApiResult<VersionedText>>;
  /** Restores a revision over the asset. Returns the ETag of the new version. A weak or missing ETag is refused. */
  restoreRevision(projectId: string, assetId: string, revisionId: string, ifMatch: string): Promise<ApiResult<{ readonly etag: string }>>;
  listItems(projectId: string, page: number, size: number): Promise<ApiResult<Page<ItemSummary>>>;
  listComponents(itemId: string, page: number, size: number): Promise<ApiResult<Page<ComponentEntry>>>;
  createComponent(itemId: string, componentKey: string, value: string): Promise<ApiResult<ComponentEntry>>;
  updateComponent(itemId: string, componentId: string, componentKey: string, value: string): Promise<ApiResult<ComponentEntry>>;
}

type Exchange =
  | { readonly kind: 'response'; readonly status: number; readonly etag: string | undefined; readonly text: string }
  | { readonly kind: 'unreachable'; readonly message: string };

const MODEL_CONTENT_TYPE = 'application/json';

const JSON_CONTENT_TYPE = 'application/json';

function componentOf(result: { readonly text: string }): ComponentEntry | undefined {
  return parseComponentEntry(parseJsonText(result.text));
}

export function createVulpesClient(options: VulpesClientOptions): VulpesClient {
  const root = options.baseUrl.replace(/\/+$/u, '');

  const authorization = (): Record<string, string> => {
    const token = options.token?.();
    return token === undefined || token === '' ? {} : { Authorization: `Bearer ${token}` };
  };

  const exchange = async (request: HttpRequest): Promise<Exchange> => {
    try {
      const response = await options.fetch(request);
      const body = await response.text();
      return { kind: 'response', status: response.status, etag: parseEntityTag(response.headers.get('ETag')), text: body };
    } catch (error: unknown) {
      return { kind: 'unreachable', message: error instanceof Error ? error.message : 'unknown network error' };
    }
  };

  // Sends one request. `accept` reads a 2xx body and returns undefined when it does not fit.
  const send = async <T>(request: HttpRequest, accept: (result: Extract<Exchange, { kind: 'response' }>) => T | undefined): Promise<ApiResult<T>> => {
    const result = await exchange(request);
    if (result.kind === 'unreachable') {
      return { ok: false, failure: { kind: 'unreachable', message: result.message } };
    }
    if (result.status < 200 || result.status > 299) {
      const problem = problemFromResponse(result.status, parseJsonText(result.text), result.etag);
      return { ok: false, failure: { kind: 'problem', problem } };
    }
    const value = accept(result);
    return value === undefined
      ? { ok: false, failure: { kind: 'unexpected', status: result.status } }
      : { ok: true, value };
  };

  // Older backends send no ETag on create and replace; the body's SHA-1 is then the strong ETag.
  const storedModel = (result: Extract<Exchange, { kind: 'response' }>): StoredModel | undefined => {
    const asset = parseAssetSummary(parseJsonText(result.text));
    if (asset === undefined) {
      return undefined;
    }
    const etag = result.etag ?? parseEntityTag(`"${asset.sha1}"`);
    return etag === undefined ? undefined : { asset, etag };
  };

  const modelBody = (key: string, text: string, withKey: boolean, comment: string | undefined): MultipartBody => ({
    fields: {
      ...(withKey ? { key } : {}),
      ...(comment === undefined || comment === '' ? {} : { comment }),
    },
    file: { name: fileNameForKey(key), contentType: MODEL_CONTENT_TYPE, text },
  });

  return {
    listProjects: (page, size) =>
      send({ method: 'GET', url: `${root}/project/?page=${String(page)}&size=${String(size)}`, headers: authorization() }, (result) =>
        parseProjectPage(parseJsonText(result.text)),
      ),

    listModels: (projectId, page, size) =>
      send(
        {
          method: 'GET',
          url: `${root}/project/${encodeURIComponent(projectId)}/asset/?kind=BBMODEL&page=${String(page)}&size=${String(size)}`,
          headers: authorization(),
        },
        (result) => parseAssetPage(parseJsonText(result.text)),
      ),

    readModel: (projectId, assetId) =>
      send(
        {
          method: 'GET',
          url: `${root}/project/${encodeURIComponent(projectId)}/asset/${encodeURIComponent(assetId)}/content`,
          headers: authorization(),
        },
        (result) => (result.etag === undefined ? undefined : { text: result.text, etag: result.etag }),
      ),

    createModel: (projectId, key, text) =>
      send(
        {
          method: 'POST',
          url: `${root}/project/${encodeURIComponent(projectId)}/asset/`,
          headers: authorization(),
          body: modelBody(key, text, true, undefined),
        },
        storedModel,
      ),

    replaceModel: (projectId, assetId, ifMatch, key, text, comment) => {
      // A replacement without a valid ETag would be unconditional on the backend, so it is never sent.
      if (parseEntityTag(ifMatch) === undefined) {
        return Promise.resolve({ ok: false, failure: { kind: 'refused' } });
      }
      return send(
        {
          method: 'POST',
          url: `${root}/project/${encodeURIComponent(projectId)}/asset/${encodeURIComponent(assetId)}/content`,
          headers: { ...authorization(), 'If-Match': ifMatch },
          body: modelBody(key, text, false, comment),
        },
        storedModel,
      );
    },

    listItems: (projectId, page, size) =>
      send(
        {
          method: 'GET',
          url: `${root}/project/${encodeURIComponent(projectId)}/item/?page=${String(page)}&size=${String(size)}`,
          headers: authorization(),
        },
        (result) => parseItemPage(parseJsonText(result.text)),
      ),

    listComponents: (itemId, page, size) =>
      send(
        {
          method: 'GET',
          url: `${root}/item/${encodeURIComponent(itemId)}/components?page=${String(page)}&size=${String(size)}`,
          headers: authorization(),
        },
        (result) => parseComponentPage(parseJsonText(result.text)),
      ),

    createComponent: (itemId, componentKey, value) =>
      send(
        {
          method: 'PUT',
          url: `${root}/item/${encodeURIComponent(itemId)}/component`,
          headers: { ...authorization(), 'Content-Type': JSON_CONTENT_TYPE },
          json: JSON.stringify({ componentKey, value }),
        },
        componentOf,
      ),

    updateComponent: (itemId, componentId, componentKey, value) =>
      send(
        {
          method: 'POST',
          url: `${root}/item/${encodeURIComponent(itemId)}/component`,
          headers: { ...authorization(), 'Content-Type': JSON_CONTENT_TYPE },
          json: JSON.stringify({ id: componentId, componentKey, value }),
        },
        componentOf,
      ),
    listRevisions: (projectId, assetId, page, size) =>
      send(
        {
          method: 'GET',
          url: `${root}/project/${encodeURIComponent(projectId)}/asset/${encodeURIComponent(assetId)}/revision?page=${String(page)}&size=${String(size)}`,
          headers: authorization(),
        },
        (result) => parseRevisionPage(parseJsonText(result.text)),
      ),

    readRevision: (projectId, assetId, revisionId) =>
      send(
        {
          method: 'GET',
          url: `${root}/project/${encodeURIComponent(projectId)}/asset/${encodeURIComponent(assetId)}/revision/${encodeURIComponent(revisionId)}/content`,
          headers: authorization(),
        },
        (result) => (result.etag === undefined ? undefined : { text: result.text, etag: result.etag }),
      ),

    restoreRevision: (projectId, assetId, revisionId, ifMatch) => {
      // Like a replacement, a restore without a valid ETag would be unconditional on the backend.
      if (parseEntityTag(ifMatch) === undefined) {
        return Promise.resolve({ ok: false, failure: { kind: 'refused' } });
      }
      return send(
        {
          method: 'POST',
          url: `${root}/project/${encodeURIComponent(projectId)}/asset/${encodeURIComponent(assetId)}/revision/${encodeURIComponent(revisionId)}/restore`,
          headers: { ...authorization(), 'If-Match': ifMatch },
        },
        (result) => (result.etag === undefined ? undefined : { etag: result.etag }),
      );
    },
  };
}
