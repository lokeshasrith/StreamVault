import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./http', () => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));

import { del, get, post } from './http';
import {
  getActivity,
  getLibrary,
  getLibraryStats,
  removeFromLibrary,
  upsertLibrary,
  upsertLibrarySimple,
  type UpsertPayload,
} from './libraryApi';

const mockedGet = vi.mocked(get);
const mockedPost = vi.mocked(post);
const mockedDel = vi.mocked(del);

const payload: UpsertPayload = {
  externalId: '550',
  source: 'TMDB_MOVIE',
  type: 'movie',
  title: 'Fight Club',
  status: 'watching',
};

describe('libraryApi wrappers', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedDel.mockReset();
  });

  it('builds getLibrary query string from filters', async () => {
    mockedGet.mockResolvedValue([] as unknown);

    await getLibrary('jwt', { status: 'watching', type: 'movie', zone: 'home' });

    expect(mockedGet).toHaveBeenCalledWith('/api/library?status=watching&type=movie&zone=home', 'jwt');
  });

  it('calls upsertLibrary with payload and token', async () => {
    mockedPost.mockResolvedValue({ contentId: 'abc' } as unknown);

    const result = await upsertLibrary('jwt', payload);

    expect(mockedPost).toHaveBeenCalledWith('/api/library', payload, 'jwt');
    expect(result).toEqual({ contentId: 'abc' });
  });

  it('calls upsertLibrarySimple and resolves void', async () => {
    mockedPost.mockResolvedValue({ ok: true } as unknown);

    await expect(upsertLibrarySimple('jwt', payload)).resolves.toBeUndefined();
    expect(mockedPost).toHaveBeenCalledWith('/api/library', payload, 'jwt');
  });

  it('calls removeFromLibrary with content id path', async () => {
    mockedDel.mockResolvedValue(undefined);

    await removeFromLibrary('jwt', 'content-1');

    expect(mockedDel).toHaveBeenCalledWith('/api/library/content-1', 'jwt');
  });

  it('calls getActivity with silent401 option', async () => {
    mockedGet.mockResolvedValue([] as unknown);

    await getActivity('jwt', 40);

    expect(mockedGet).toHaveBeenCalledWith('/api/library/activity?limit=40', 'jwt', { silent401: true });
  });

  it('calls getLibraryStats with silent401 option', async () => {
    mockedGet.mockResolvedValue({ total: 0 } as unknown);

    await getLibraryStats('jwt');

    expect(mockedGet).toHaveBeenCalledWith('/api/library/stats', 'jwt', { silent401: true });
  });
});
