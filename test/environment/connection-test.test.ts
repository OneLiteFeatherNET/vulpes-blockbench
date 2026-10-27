import { describe, expect, it } from 'vitest';
import { testConnection, type FetchLike } from '../../src/environment/connection-test';

function respondWith(status: number): { fetch: FetchLike; requested: string[] } {
  const requested: string[] = [];
  const fetch: FetchLike = (url) => {
    requested.push(url);
    return Promise.resolve({ status });
  };
  return { fetch, requested };
}

function failWith(error: Error): { fetch: FetchLike } {
  const fetch: FetchLike = () => Promise.reject(error);
  return { fetch };
}

describe('testConnection', () => {
  it('reports ok for a 2xx status', async () => {
    const { fetch } = respondWith(200);
    expect(await testConnection('http://localhost:8085', fetch)).toEqual({ kind: 'ok', status: 200 });
  });

  it('reports the status of a response that is not 2xx', async () => {
    const { fetch } = respondWith(404);
    expect(await testConnection('http://localhost:8085', fetch)).toEqual({
      kind: 'http-error',
      status: 404,
    });
  });

  it('reports a network error when fetch rejects', async () => {
    const { fetch } = failWith(new TypeError('Failed to fetch'));
    expect(await testConnection('http://localhost:8085', fetch)).toEqual({
      kind: 'network-error',
      message: 'Failed to fetch',
    });
  });

  it('requests the project list with size one under the base URL', async () => {
    const { fetch, requested } = respondWith(200);
    await testConnection('http://localhost:8085', fetch);
    expect(requested).toEqual(['http://localhost:8085/project/?size=1']);
  });

  it('does not add a second slash when the base URL ends with one', async () => {
    const { fetch, requested } = respondWith(200);
    await testConnection('http://localhost:8085/', fetch);
    expect(requested).toEqual(['http://localhost:8085/project/?size=1']);
  });
});
