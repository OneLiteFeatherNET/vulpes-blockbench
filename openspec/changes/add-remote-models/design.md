# Design

## Context

`add-device-login` gives the plugin a signed-in state and one function, `authorizedFetch`, that adds the bearer token to a request. This change uses that function for every call to Vulpes.

The backend contract is `/blockbench/v1`, a Blockbench-facing API separate from the web UI API. All errors are RFC 9457 Problem Details with `type` set to `urn:vulpes:problem:<slug>`. Models are raw `.bbmodel` JSON, and the `ETag` of a model is its SHA-1 in quotes.

The endpoints are:
- `GET /projects`, and `GET /projects/{projectId}/models?page&size`
- `GET /projects/{projectId}/models/{modelId}`, which returns the JSON with an `ETag`
- `POST /projects/{projectId}/models?key=…`, which returns `201`, `Location` and `ETag`
- `PUT /projects/{projectId}/models/{modelId}` with `If-Match`, which returns `200` and a new `ETag`, or `412` with `currentEtag`

## Goals / Non-Goals

**Goals:**
- Open a model from Vulpes as a normal Blockbench project.
- Save a new model, and save an existing one with Ctrl+S, without the designer typing an ID.
- Never overwrite a newer version in Vulpes without the designer's explicit choice.
- Keep the local project usable when a save fails.

**Non-Goals:**
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

The spike also checks whether `fetch` from the Blockbench renderer to the Vulpes backend is blocked by CORS, and whether the response headers `ETag` and `Location` are readable. If either check fails, the fallback in "Network access" applies, and the backend change is in place before the save tasks start.

### Spike outcome

_To be filled in by the spike._

## Decisions

### One API client, one error type
A single module wraps the six calls. It returns either the parsed result or a `VulpesProblem` with `slug`, `status`, `detail` and, for `412`, `currentEtag`. No other module reads a response body or a header directly. The client is the only place that sets `If-Match`.

### The remote reference lives on the project
The reference holds the backend URL, the project id, the model id, the key and the last known ETag. It is written on open, on a successful create, and on every successful save. The storage place is set by the spike outcome. The reference is never written into the `.bbmodel` JSON that is sent to Vulpes.

### ETag is opaque
The plugin stores the `ETag` value exactly as the backend returns it, including the quotes, and sends it back unchanged. It never computes the SHA-1 itself. This avoids mismatches when the backend stores the JSON in a different form than the plugin serializes it.

### Save existing
Ctrl+S sends `PUT` with `If-Match` set to the stored ETag. On `200`, the new ETag replaces the stored one. On `412`, the conflict dialog opens. On any other error, the local project and the stored ETag stay as they were.

### Conflict choices
- **Overwrite**: send `PUT` with `If-Match` set to `currentEtag` from the 412 body, without a `GET` first. The backend returns `currentEtag` already quoted, so the plugin sends it exactly as received. If this `PUT` gets `412` again, the conflict dialog opens again, and nothing else is sent.
- **Load latest**: fetch the model, replace the content of the local project and update the stored ETag. The dialog asks for confirmation, because local changes are lost.
- **Save as copy**: ask for a new key and create a new model with `POST`. On `201`, the reference points to the new model. The old model in Vulpes is not changed.

### Save new
The designer picks a project and enters the key. The plugin sends the compiled JSON with the key as a query parameter, URL-encoded. On `201`, the reference is stored with the model id from `Location` and the ETag. The plugin does not validate the key grammar beyond "not empty". The backend's `invalid-key` detail is shown as it is, because the backend owns the grammar.

### Error messages
Each slug maps to one message the designer can act on:

| Slug | Message |
|---|---|
| `project-not-found` | The project no longer exists in Vulpes. Pick another project. |
| `model-not-found` | The model was deleted in Vulpes. Use "Save as copy" to keep your work. |
| `invalid-key` | Show the backend detail. The key is not a valid resource location. |
| `key-taken` | A model with this key already exists. Choose another key. |
| `invalid-model` | Vulpes rejected the model file. Show the backend detail. |
| `precondition-required` | The save did not send a version. This is a plugin bug. Report it. |
| `precondition-failed` | The model changed in Vulpes. Open the conflict dialog. |
| `payload-too-large` | The model is larger than 8 MB. Reduce the embedded textures. |
| `unauthorized` | Sign in again. |

An unknown slug, or a body that is not Problem Details, shows the HTTP status and the `title` or `detail` if present. The mapping is a table in code, and each row has a test.

### Authentication
Every call goes through `authorizedFetch`. A `401` that survives the one retry in `add-device-login` leads to the signed-out state and the message "Sign in again".

### Network failures keep local work
A request that gets no response, or a timeout, shows "Vulpes cannot be reached". It changes nothing locally. The designer can save again later.

### Network access
Requests run with `fetch` in the Blockbench renderer, through `authorizedFetch`. Using Node modules through `requireNativeModule` instead is rejected. Designers would have to accept a permission prompt for the plugin, and calls outside `fetch` cannot be tested with the fake `fetch` that the client uses.

If the spike shows that CORS blocks the requests, or that `ETag` or `Location` cannot be read, the fallback is decided and is a backend change: the backend allows the Blockbench origin (the origin the spike records) for the request headers `Authorization`, `If-Match` and `Content-Type`, and exposes the response headers `ETag` and `Location`. The change is tracked outside this repository. The plugin does not work around it.

### Local export stays local
File > Export and Save As to a file do not contact Vulpes. The designer is asked whether the project should stay linked to the remote model. The default is to keep the link.

## Contract notes

These points are not settled by the contract. Point 1 is decided (see "Network access"). The others are raised for the backend owner:

1. **CORS and headers**: decided. The backend allows the Blockbench origin for `Authorization`, `If-Match` and `Content-Type`, and exposes `ETag` and `Location`, if the spike shows that this is needed. This is a backend change, tracked outside this repository.
2. **ETag source**: the contract does not say which bytes the SHA-1 covers. The plugin only needs the value to round-trip, so this does not block the plugin, but a mismatch after a save would surface as a permanent conflict.
3. **Key grammar**: `invalid-key` is listed, but the grammar of a resource location is not. Client-side checks would duplicate the backend rule.
4. **Retry after lost POST**: if the network fails after the backend stored the model, a retry of "Save to Vulpes" gets `key-taken`. The message must explain this, and it must tell the designer to open the model instead.
5. **Missing slugs**: no slug covers `403` (no access to the project), `5xx` or a timeout. The table above falls back to the generic message for these.
6. **Page size**: the maximum `size` is not stated. The plugin uses `size=50`.

## Risks / Trade-offs

- **The save cannot be routed through Ctrl+S**: the spike shows it and the design is revised before the save tasks. The user is informed before that happens.
- **The reference is lost on restart**: the designer sees "not linked to Vulpes" and must save as a new model or reopen. Accepted until the spike shows how the project state survives.
- **Large models**: the 8 MB limit is enforced by the backend. A local check is not added, so the message comes from the 413 response.

## Open Questions

- Does Save As to a file unlink the remote model, or does it keep the link? The default is to keep it.
- Where is the reference kept across a restart, if the spike shows that project state is not saved?

## Future work

Not part of this change. A diff view in the conflict dialog would compare the local model with the current Vulpes version and show which elements, groups, textures and animations differ. With that view the designer can choose between Overwrite, Load latest and Save as copy knowingly. It gets its own change later.
