// Adapts the renderer's fetch, FormData and Blob to the shapes the Vulpes client
// uses. The web globals come from the Node type package, which the project's
// type environment already includes; the DOM library stays off.

import type { FetchLike, HttpRequest, MultipartBody } from '../api/http';

function formDataOf(body: MultipartBody): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(body.fields)) {
    form.append(name, value);
  }
  form.append('file', new Blob([body.file.text], { type: body.file.contentType }), body.file.name);
  return form;
}

/**
 * The renderer's fetch, called as a plain function. Calling it as a property of
 * another object throws "Illegal invocation" in Electron, so it is wrapped here.
 */
export const rendererFetch: FetchLike = async (request: HttpRequest) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: { ...request.headers },
    ...(request.body === undefined ? {} : { body: formDataOf(request.body) }),
  });
  return {
    status: response.status,
    headers: response.headers,
    text: () => response.text(),
  };
};
