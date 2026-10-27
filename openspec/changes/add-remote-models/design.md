# Design

## Context

The backend contract is the existing project asset API of Vulpes-Backend, which the web UI (Stelaris) also uses. A `.bbmodel` is a `BBMODEL` asset. The plugin needs no API of its own. The backend change `add-asset-replace-precondition` adds one thing: an opt-in `If-Match` on content replacement.

The endpoints this change calls:
- `GET /project/` lists projects (`Page` of `ProjectModelDTO`, with `id`, `displayName`, `key`).
- `GET /project/{projectId}/asset/?kind=BBMODEL&page&size` lists the models of a project (`Page` of `ResponseAssetDTO`, with `id`, `key`, `fileName`, `sha1`, `size`, `modificationDate`).
- `GET /project/{projectId}/asset/{id}/content` returns the raw `.bbmodel` bytes with `ETag: "<sha1>"`.
- Pages are `{ "content": [...], "pageable": {...}, "totalSize": n }`. A list for a project that does not exist answers `200` with an empty page, not `404`.
- `POST /project/{projectId}/asset/` takes multipart fields `file` (a file name ending in `.bbmodel`) and `key`. It returns `201`, the asset as JSON and `ETag`. It sends no `Location` header, so the id comes from the body.
- `POST /project/{projectId}/asset/{id}/content` takes multipart `file` and an optional `If-Match: "<sha1>"`. It returns `200`, the asset and a new `ETag`. A mismatch returns `412` with `ETag` set to the current value. The body carries no current ETag.

The ETag is the SHA-1 of the stored bytes in quotes. The backend compares `If-Match` exactly, so `W/` values never match, and `*` matches any existing asset.

### Error body (verified in Vulpes-Backend)

Every error is an RFC 9457 problem with `Content-Type: application/problem+json`:

```json
{
  "type": "https://vulpes.onelitefeather.net/errors/asset-precondition-failed",
  "title": "Asset precondition failed",
  "status": 412,
  "detail": "...",
  "instance": "/project/{projectId}/asset/{id}/content",
  "code": "ASSET_PRECONDITION_FAILED",
  "traceId": "32 hex characters",
  "errors": [{ "field": "key", "code": "ASSET_KEY_INVALID", "message": "..." }]
}
```

- The `type` is `https://vulpes.onelitefeather.net/errors/<code in kebab-case>`. It is not a `urn:vulpes:problem:` URN.
- The plugin branches on `code`, the enum name. `errors` is omitted unless `code` is `VALIDATION_FAILED`. Each violation carries a `code` of its own (`ASSET_KEY_INVALID`, `ASSET_UNSUPPORTED_TYPE`, `ASSET_INVALID_CONTENT`, or a bean validation name) and a `field` of `key` or `file`.

## Goals / Non-Goals

**Goals:**
- Open a model from Vulpes as a normal Blockbench project.
- Save a new model, and save an existing one with Ctrl+S, without the designer typing an ID.
- Never overwrite a newer version in Vulpes without the designer's explicit choice.
- Keep the local project usable when a save fails.

**Non-Goals:**
- Sign-in, token refresh and sign-out. The plugin only accepts a token provider as a seam.
- Models linked to items, fonts or advancements, and the usages lookup.
- Texture uploads, a texture library, or extracting textures in the plugin.
- Offline editing with a sync queue. Failed saves are retried by the designer.
- Web Blockbench and the official plugin store.

## Spike: Save routing and codec round trip

Ctrl+S and File > Save must write to Vulpes for a remote project. Candidates to check:
- `Blockbench.on('save_project')`, to see whether a listener can take over the save.
- A custom `Codec` with `write`, `overwrite` and `export`, attached to the remote project.
- `Project.save_path`, which the plugin could set to a marker that the save code recognizes.

The codec round trip is also verified: `Codecs.project.compile()` must produce the `.bbmodel` JSON, and `Codecs.project.load()` or `parse` must rebuild the project from that JSON without losing data.

The spike also checks where the remote reference survives: autosave, Save As to a local file, and a restart of Blockbench. Each task after the spike depends on its result. If the spike shows that the save cannot be routed, the design is revised before the save tasks start.

The spike also checks the network path from the Blockbench renderer, using the backend as it is, with its localhost-only CORS policy:
- The `ETag` response header is readable, both on `200`/`201` and on the `412` error response.
- The `Authorization` and `If-Match` request headers pass the preflight, and the `Content-Type` of multipart requests is not blocked.
- The renderer origin is recorded. If the origin is not a localhost origin and the request is blocked, the backend change that allows the origin is made before task 2. It is tracked in Vulpes-Backend, not here.

### Spike outcome

_To be filled in by the spike._

## Decisions

### One API client, one error type
A single module wraps the calls. It returns either the parsed result or a `VulpesProblem` with `status`, `code` (the problem `code`, or `undefined`), `detail`, `violations` and `etag` (the `ETag` header of the response, used for `412`). No other module reads a response body or a header directly. The client is the only place that sets `If-Match`.

### Requests carry an optional token
Requests go through one function that adds `Authorization: Bearer <token>` when a token provider is configured and omits the header otherwise. The provider is a parameter, not a global. Today no provider exists, and the backend has no authentication, so the plugin runs in dev mode without sign-in. `add-device-login` will supply the provider later.

### The remote reference lives on the project
The reference holds the backend URL, the project id, the asset id, the key and the last known ETag. It is written on open, on a successful create, and on every successful save. The storage place is set by the spike outcome. The reference is never written into the `.bbmodel` JSON that is sent to Vulpes.

### ETag is opaque
The plugin stores the `ETag` value exactly as the backend returns it, including the quotes, and sends it back unchanged. It never computes the SHA-1 itself.

### Save existing
Ctrl+S sends `POST .../asset/{id}/content` with `If-Match` set to the stored ETag. On `200`, the new ETag from the response header replaces the stored one. On `412`, the conflict dialog opens. On any other error, the local project and the stored ETag stay as they were. The plugin never sends a replacement without an ETag. The backend treats a request without `If-Match` as unconditional, so the client refuses to send one.

### Conflict choices
- **Overwrite**: send the replacement with `If-Match` set to the `ETag` header of the `412` response, without a `GET` first. The header is already quoted, so the plugin sends it exactly as received. If this request gets `412` again, the conflict dialog opens again, and nothing else is sent.
- **Load latest**: fetch `GET .../content`, replace the content of the local project and store the `ETag` of that response. The dialog asks for confirmation, because local changes are lost.
- **Save as copy**: ask for a new key and create a new asset with `POST .../asset/`. On `201`, the reference points to the new asset. The original asset in Vulpes is not changed.

### Save new
The designer picks a project and enters the key. The plugin sends the compiled JSON as multipart `file`, named after the last segment of the key with `.bbmodel` appended (for example `ruby.bbmodel` for `vulpes:item/ruby`), and the key as multipart `key`. On `201`, the reference is stored with the `id` and the `ETag` from the response. The plugin does not validate the key grammar beyond "not empty". The backend's `ASSET_KEY_INVALID` message is shown as it is, because the backend owns the grammar.

Textures embedded in the `.bbmodel` are extracted by the backend into assets with derived keys. The plugin uploads nothing else.

### Error messages
Messages are chosen by `code`, not by the URN slug, which does not exist in this backend.

| Condition | Message |
|---|---|
| `PROJECT_NOT_FOUND` | The project no longer exists in Vulpes. Pick another project. |
| `RESOURCE_NOT_FOUND` on a read or save | The model was deleted in Vulpes. Use "Save as copy" to keep your work. |
| `VALIDATION_FAILED`, violation on `key` | Show the violation message next to the key field. |
| `VALIDATION_FAILED`, violation on `file` | Vulpes rejected the model file. Show the violation message. |
| `RESOURCE_CONFLICT` on create | A model or texture with this key already exists. Choose another key. If an earlier save may have succeeded, open the model from Vulpes instead. |
| `ASSET_PRECONDITION_FAILED` (412) | The model changed in Vulpes. Open the conflict dialog. |
| HTTP `413` (no code of its own) | The model is larger than 8 MB. Reduce the embedded textures. |
| `INVALID_REQUEST`, `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE` | Show the `detail`. These mean a plugin bug. |
| `INTERNAL_ERROR` | Vulpes failed. Show the `traceId`, so support can find the log line. |
| HTTP `401` | Sign in again. The backend emits no `401` yet; the row applies once authentication exists. |

An unknown `code`, or a body that is not Problem Details, shows the HTTP status and the `title` or `detail` if present. The mapping is a table in code, and each row has a test.

### Network access
Requests run with `fetch` in the Blockbench renderer. Using Node modules through `requireNativeModule` instead is rejected. Designers would have to accept a permission prompt for the plugin, and calls outside `fetch` cannot be tested with the fake `fetch` that the client uses.

If the spike shows that CORS blocks the renderer origin, the fix is a backend change that allows that origin for the request headers `Authorization` and `If-Match`. The backend currently allows only `localhost` and `127.0.0.1`. The plugin does not work around it.

### Local export stays local
File > Export and Save As to a file do not contact Vulpes. The designer is asked whether the project should stay linked to the remote model. The default is to keep the link.

## Contract notes

1. **CORS and headers**: checked with curl against a running backend. Localhost origins pass the preflight for `authorization`, `if-match` and `content-type`, and the response exposes `ETag`. An `Origin` of `null` or `file://` gets `403` on the preflight and on a plain `GET`. If the Blockbench renderer sends such an origin, it is blocked until the backend allows that origin. The change is in Vulpes-Backend, and the spike records the origin that is used.
2. **ETag source**: resolved. The ETag is the SHA-1 of the stored bytes, the same value as `sha1` in the asset body. The plugin still treats it as opaque.
3. **Key grammar**: the backend rule is `namespace:path` in lowercase without a file extension. The plugin does not duplicate it.
4. **Retry after lost POST**: if the network fails after the backend stored the asset, a retry of "Save to Vulpes" gets `RESOURCE_CONFLICT`. The message explains this and tells the designer to open the model instead.
5. **Missing codes**: the backend has no code for `403`, a timeout or `413`. `413` falls back to the HTTP status, as in the table above.
6. **Page size**: the plugin uses `size=50`. The `Page` envelope is `content`, `pageable` and `totalSize`, verified against the backend.
7. **Conflict vs. not found on replace**: a replacement of an asset that does not exist, or that belongs to another project, returns `RESOURCE_NOT_FOUND`, the same as a deleted model.
8. **Overwrite is not a merge**: the backend has no diff. The designer chooses the whole version each time.

## Risks / Trade-offs

- **The save cannot be routed through Ctrl+S**: the spike shows it and the design is revised before the save tasks. The user is informed before that happens.
- **The reference is lost on restart**: the designer sees "not linked to Vulpes" and must save as a new model or reopen. Accepted until the spike shows how the project state survives.
- **Large models**: the 8 MB limit is enforced by the backend. A local check is not added, so the message comes from the `413` response.
- **No authentication yet**: any client that can reach the backend can read and overwrite assets. This is accepted for development only, until the shared backend auth change lands.

## Open Questions

- Does Save As to a file unlink the remote model, or does it keep the link? The default is to keep it.
- Where is the reference kept across a restart, if the spike shows that project state is not saved?

## Future work

Not part of this change. A diff view in the conflict dialog would compare the local model with the current Vulpes version and show which elements, groups, textures and animations differ. With that view the designer can choose between Overwrite, Load latest and Save as copy knowingly. It gets its own change later.
