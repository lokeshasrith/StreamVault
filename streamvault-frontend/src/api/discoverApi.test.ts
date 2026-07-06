import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./http', () => ({
  get: vi.fn(),
}));

import { get } from './http';
import {
  discoverApi,
  formatYear,
  getImageUrl,
  getContentTypeLabel,
  PLACEHOLDER_POSTER,
} from './discoverApi';

const mockedGet = vi.mocked(get);

describe('discoverApi wrapper methods', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('builds search query with all optional params', async () => {
    mockedGet.mockResolvedValue({
      items: [{ externalId: '1', title: 'A' }],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    } as unknown);

    const items = await discoverApi.search({
      query: 'fight club',
      type: 'movie',
      genre: 'Drama',
      page: 2,
      pageSize: 12,
    });

    expect(items).toEqual([{ externalId: '1', title: 'A' }]);
    const calledPath = mockedGet.mock.calls[0]?.[0] as string;
    expect(calledPath).toContain('/api/discover/search?');
    expect(calledPath).toContain('query=fight+club');
    expect(calledPath).toContain('type=movie');
    expect(calledPath).toContain('genre=Drama');
    expect(calledPath).toContain('page=2');
    expect(calledPath).toContain('pageSize=12');
  });

  it('passes auth token for liked recommendations endpoint', async () => {
    mockedGet.mockResolvedValue({ items: [] } as unknown);

    await discoverApi.getRecommendationsFromLiked('jwt-token', 25);

    expect(mockedGet).toHaveBeenCalledWith('/api/discover/recommendations/liked?limit=25', 'jwt-token');
  });

  it('returns similar items and falls back to empty array', async () => {
    mockedGet.mockResolvedValueOnce({ items: [{ externalId: 'x' }] } as unknown);
    mockedGet.mockResolvedValueOnce({} as unknown);

    const withItems = await discoverApi.getSimilar('movie', '550');
    const withoutItems = await discoverApi.getSimilar('movie', '551');

    expect(withItems).toEqual([{ externalId: 'x' }]);
    expect(withoutItems).toEqual([]);
    expect(mockedGet).toHaveBeenNthCalledWith(1, '/api/discover/movie/550/similar');
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/api/discover/movie/551/similar');
  });

  it('builds watch provider path with country query', async () => {
    mockedGet.mockResolvedValue({ streaming: [], rent: [], buy: [] } as unknown);

    await discoverApi.getWatchProviders('movie', '550', 'US');

    expect(mockedGet).toHaveBeenCalledWith('/api/discover/movie/550/watch-providers?country=US');
  });
});

describe('discoverApi utility helpers', () => {
  it('returns placeholder for missing image paths', () => {
    expect(getImageUrl(undefined)).toBe(PLACEHOLDER_POSTER);
    expect(PLACEHOLDER_POSTER.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('uses direct URL for Amazon/IMDb images and proxies other remotes', () => {
    const amazonDirect = getImageUrl('https://m.media-amazon.com/images/M/demo.jpg');
    const proxiedTmdb = getImageUrl('https://image.tmdb.org/t/p/w500/abc.jpg');
    const proxied = getImageUrl('https://example.org/poster.jpg');

    expect(amazonDirect).toBe('https://m.media-amazon.com/images/M/demo.jpg');
    expect(proxiedTmdb).toContain('/api/img/proxy?url=');
    expect(proxied).toContain('/api/img/proxy?url=');
  });

  it('formats helper labels correctly', () => {
    expect(formatYear('1999-10-15')).toBe('1999');
    expect(getContentTypeLabel('tv')).toBe('TV Show');
    expect(getContentTypeLabel('movie', 'jikan')).toBe('Anime');
  });
});
