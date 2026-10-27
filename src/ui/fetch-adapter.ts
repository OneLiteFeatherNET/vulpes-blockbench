// Adapts the renderer's fetch, FormData and Blob to the shapes the Vulpes client
// uses. The web globals come from the Node type package, which the project's
// type environment already includes; the DOM library stays off.

import type { HttpRequest, HttpResponse, MultipartBody } from '../api/http';
import type { LiveHttpMethod } from '../live/registration';

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
/** The methods of the Vulpes client (GET, POST, PUT) and of the registry (GET, PUT, DELETE). */
export interface RendererRequest extends Omit<HttpRequest, 'method'> {
  readonly method: HttpRequest['method'] | LiveHttpMethod;
}

export const rendererFetch = async (request: RendererRequest): Promise<HttpResponse> => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: { ...request.headers },
    ...(request.body === undefined ? {} : { body: formDataOf(request.body) }),
    ...(request.json === undefined ? {} : { body: request.json }),
  });
  return {
    status: response.status,
    headers: response.headers,
    text: () => response.text(),
  };
};
