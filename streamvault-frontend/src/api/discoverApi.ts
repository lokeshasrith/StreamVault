import { get } from "./http";

// Use the deployed API origin in production and the Vite proxy in local development.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

// Updated ContentItem interface to match backend
export interface ContentItem {
  externalId: string;
  title: string;
  originalTitle?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  genres: string[];
  source: 'tmdb' | 'jikan' | 'imdb' | 'library';
  type: 'movie' | 'tv' | 'anime';
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath?: string;
  idSource?: string;
}

export interface ContentDetails extends ContentItem {
  runtime?: number;
  budget?: number;
  revenue?: number;
  cast?: CastMember[];
  director?: string;
  writers?: string[];
  trailerUrl?: string;
  seasons?: number;
  episodes?: number;
  status?: string;
  tagline?: string;
  originalLanguage?: string;
  duration?: string;
  rating?: string;
  studios?: string[];
  producers?: string[];
  licensors?: string[];
  themes?: string[];
  demographics?: string[];
  sourceMaterial?: string;
  season?: string;
  broadcast?: string;
  imdbId?: string;
  malRanking?: number;
}

export interface AnimeReviewItem {
  author: string;
  review: string;
  score: number;
  publishedAt?: string;
  isSpoiler: boolean;
  isPreliminary: boolean;
  reactions: number;
}

export interface ExternalRatings {
  imdb?: { rating: number; votes: number; imdbId: string } | null;
  metacritic?: { metascore: number; imdbId: string } | null;
}

export type ContentType = 'all' | 'movie' | 'tv' | 'anime';

// ─── Person types ────────────────────────────────────────────────────────────

export interface PersonCredit {
  id: number;
  title: string;
  character?: string;
  jobs?: string[];
  mediaType: string;
  releaseDate: string;
  posterPath?: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  isUpcoming?: boolean;
  isHit?: boolean;
  isFlop?: boolean;
  year?: number;
}

export interface PersonNewsItem {
  title: string;
  url: string;
  snippet: string;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  age?: number;
  placeOfBirth?: string;
  profilePath?: string;
  knownFor?: string;
  gender?: string;
  alsoKnownAs?: string[];
  imdbId?: string;
  totalMovies: number;
  totalTvShows: number;
  totalCredits: number;
  movieHits: number;
  movieFlops: number;
  averageRating?: number;
  highestRatedMovie?: { title: string; voteAverage: number; year?: number };
  lowestRatedMovie?: { title: string; voteAverage: number; year?: number };
  height?: string;
  awards?: string[];
  trivia?: string[];
  latestNews?: PersonNewsItem[];
  previousMovies: PersonCredit[];
  upcomingMovies: PersonCredit[];
  hits: PersonCredit[];
  flops: PersonCredit[];
  crewCredits: PersonCredit[];
}

export interface PersonSearchItem {
  id: number;
  name: string;
  knownForDepartment?: string;
  profilePath?: string;
  popularity: number;
  biography?: string;
  placeOfBirth?: string;
  knownFor?: string[];
}

export interface RecommendationSeedItem {
  externalId: string;
  title: string;
  type: string;
  genres: string[];
}

export interface LikedRecommendationsResponse {
  items: ContentItem[];
  basedOn?: RecommendationSeedItem[];
  reason?: string;
}

// ─── Episode types ───────────────────────────────────────────────────────────

export interface TvEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  airDate?: string;
  voteAverage: number;
  voteCount: number;
  runtime?: number;
  stillPath?: string;
}

export interface TvSeasonDetail {
  seasonNumber: number;
  name: string;
  overview?: string;
  airDate?: string;
  posterPath?: string;
  trailerUrl?: string;
  episodes: TvEpisode[];
}

export interface AnimeEpisode {
  episodeNumber: number;
  name: string;
  titleJapanese?: string;
  airDate?: string;
  score?: number;
  filler: boolean;
  recap: boolean;
}

export interface AnimeEpisodeDetail {
  episodeNumber: number;
  name: string;
  titleJapanese?: string;
  synopsis?: string;
  duration?: number;
  airDate?: string;
  filler: boolean;
  recap: boolean;
}

export interface AnimeEpisodesResponse {
  episodes: AnimeEpisode[];
  pagination?: {
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
  };
}

export interface SearchParams {
  query: string;
  type?: ContentType;
  genre?: string;
  page?: number;
  pageSize?: number;
}

export interface ApiResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Watch Providers types ───────────────────────────────────────────────────

export interface WatchProvider {
  id: number;
  name: string;
  logoUrl?: string;
}

export interface WatchProviders {
  streaming: WatchProvider[];
  free?: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  link?: string;
}

// ─── Similar content types ───────────────────────────────────────────────────

export interface SimilarItem {
  externalId: string;
  title: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  source: string;
  type: string;
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function buildProxyImageUrl(url: string): string {
  return `${API_BASE}/api/img/proxy?url=${encodeURIComponent(url)}`;
}

function shouldBypassProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'cdn.myanimelist.net' || hostname === 'myanimelist.net';
  } catch {
    return false;
  }
}

export const PLACEHOLDER_POSTER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513">
    <rect width="342" height="513" fill="#1a1a2e"/>
    <text x="171" y="240" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="18">No Poster</text>
    <text x="171" y="270" text-anchor="middle" fill="#444" font-family="sans-serif" font-size="14">Available</text>
  </svg>`
)}`;

export function getImageUrl(path: string | undefined, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string {
  if (!path) return PLACEHOLDER_POSTER;
  if (path.startsWith('data:')) return path;
  if (path.startsWith('/api/')) return path;

  // Route remote images through the backend so embedded browsers do not block them.
  if (path.startsWith('http')) {
    if (shouldBypassProxy(path)) {
      return path;
    }
    return buildProxyImageUrl(path);
  }

  const sizeMap = { small: 'w185', medium: 'w342', large: 'w780', original: 'original' };
  return buildProxyImageUrl(`${TMDB_IMAGE_BASE}/${sizeMap[size]}${path}`);
}

export function formatRating(rating: number | undefined): string {
  if (rating === undefined || rating === null) return 'N/A';
  return rating.toFixed(1);
}

export function formatGenres(genres: string | string[] | undefined): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres;
  return genres.split(',').map((g: string) => g.trim()).filter(Boolean);
}

export function getContentTypeLabel(type: string, source?: string): string {
  if (source === 'jikan') return 'Anime';
  const labels: Record<string, string> = { movie: 'Movie', tv: 'TV Show', anime: 'Anime' };
  return labels[type] ?? type;
}

export function formatYear(dateOrYear: string | number | undefined): string {
  if (!dateOrYear) return '';
  if (typeof dateOrYear === 'number') return dateOrYear.toString();
  const year = new Date(dateOrYear).getFullYear();
  return isNaN(year) ? '' : year.toString();
}

export function formatEpisodes(episodes: number | undefined, seasons: number | undefined): string {
  if (seasons) return `${seasons} Season${seasons > 1 ? 's' : ''}`;
  if (episodes) return `${episodes} Episode${episodes > 1 ? 's' : ''}`;
  return '';
}

export function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

const FALLBACK_MOVIE_QUERIES = [
  'Dune Part Two',
  'Oppenheimer',
  'Inception',
  'Interstellar',
  'The Dark Knight',
  'Mad Max Fury Road',
  'Avengers Endgame',
  'Spider Man Across the Spider Verse',
];

const FALLBACK_TV_QUERIES = [
  'Breaking Bad',
  'Game of Thrones',
  'The Last of Us',
  'Stranger Things',
  'Severance',
  'The Bear',
  'Dark',
  'Sherlock',
];

const FALLBACK_ANIME_QUERIES = [
  'Attack on Titan',
  'Demon Slayer',
  'Jujutsu Kaisen',
  'One Piece',
  'Naruto Shippuden',
  'Death Note',
  'Steins Gate',
  'Fullmetal Alchemist Brotherhood',
];

const STATIC_FALLBACK_MOVIES: ContentItem[] = [
  {
    externalId: '693134',
    title: 'Dune: Part Two',
    overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2024-03-01',
    voteAverage: 8.6,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Science Fiction', 'Adventure'],
    source: 'tmdb',
    type: 'movie',
  },
  {
    externalId: '872585',
    title: 'Oppenheimer',
    overview: 'The story of J. Robert Oppenheimer and the creation of the atomic bomb during World War II.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2023-07-21',
    voteAverage: 8.4,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Drama', 'History'],
    source: 'tmdb',
    type: 'movie',
  },
  {
    externalId: '27205',
    title: 'Inception',
    overview: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2010-07-16',
    voteAverage: 8.8,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Action', 'Science Fiction'],
    source: 'tmdb',
    type: 'movie',
  },
  {
    externalId: '157336',
    title: 'Interstellar',
    overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity’s survival.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2014-11-07',
    voteAverage: 8.7,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Adventure', 'Drama'],
    source: 'tmdb',
    type: 'movie',
  },
];

const STATIC_FALLBACK_TV: ContentItem[] = [
  {
    externalId: '1396',
    title: 'Breaking Bad',
    overview: 'A high school chemistry teacher turned meth producer partners with a former student.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2008-01-20',
    voteAverage: 9.5,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Drama', 'Crime'],
    source: 'tmdb',
    type: 'tv',
  },
  {
    externalId: '1399',
    title: 'Game of Thrones',
    overview: 'Noble families vie for control of the Iron Throne while an ancient enemy returns.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2011-04-17',
    voteAverage: 8.9,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Fantasy', 'Drama'],
    source: 'tmdb',
    type: 'tv',
  },
  {
    externalId: '100088',
    title: 'The Last of Us',
    overview: 'A hardened survivor escorts a teenage girl across a ravaged America.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2023-01-15',
    voteAverage: 8.8,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Drama', 'Sci-Fi & Fantasy'],
    source: 'tmdb',
    type: 'tv',
  },
  {
    externalId: '66732',
    title: 'Stranger Things',
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments and supernatural forces.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2016-07-15',
    voteAverage: 8.6,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Drama', 'Mystery'],
    source: 'tmdb',
    type: 'tv',
  },
];

const STATIC_FALLBACK_ANIME: ContentItem[] = [
  {
    externalId: '16498',
    title: 'Attack on Titan',
    overview: 'Humans fight for survival behind enormous walls against terrifying titans.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2013-04-07',
    voteAverage: 9.0,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Action', 'Drama'],
    source: 'jikan',
    type: 'anime',
  },
  {
    externalId: '52991',
    title: 'Frieren: Beyond Journey\'s End',
    overview: 'An elven mage reflects on legacy, time, and friendship after the hero\'s journey ends.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2023-09-29',
    voteAverage: 9.2,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Adventure', 'Drama'],
    source: 'jikan',
    type: 'anime',
  },
  {
    externalId: '5114',
    title: 'Fullmetal Alchemist: Brotherhood',
    overview: 'Two brothers pay a terrible price for alchemy and set out to restore what they lost.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2009-04-05',
    voteAverage: 9.1,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Action', 'Fantasy'],
    source: 'jikan',
    type: 'anime',
  },
  {
    externalId: '9253',
    title: 'Steins;Gate',
    overview: 'A self-proclaimed mad scientist and friends discover a method of sending messages through time.',
    posterPath: undefined,
    backdropPath: undefined,
    releaseDate: '2011-04-06',
    voteAverage: 9.0,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: ['Sci-Fi', 'Thriller'],
    source: 'jikan',
    type: 'anime',
  },
];

// ─── Main API class ───────────────────────────────────────────────────────────

class DiscoverAPI {
  private async getSeededFallback(type: 'movie' | 'tv' | 'anime', page: number = 1): Promise<ContentItem[]> {
    const staticSeeds = type === 'movie'
      ? STATIC_FALLBACK_MOVIES
      : type === 'tv'
        ? STATIC_FALLBACK_TV
        : STATIC_FALLBACK_ANIME;
    if (staticSeeds.length > 0) {
      const pageSize = 4;
      return staticSeeds.slice((page - 1) * pageSize, page * pageSize);
    }

    const seeds = type === 'movie'
      ? FALLBACK_MOVIE_QUERIES
      : type === 'tv'
        ? FALLBACK_TV_QUERIES
        : FALLBACK_ANIME_QUERIES;
    const pageSize = 4;
    const pageSeeds = seeds.slice((page - 1) * pageSize, page * pageSize);
    if (pageSeeds.length === 0) return [];

    const results = await Promise.allSettled(
      pageSeeds.map((query) => this.search({ query, type, page: 1, pageSize: 8 }))
    );

    return results
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .filter((item) => item.type === type)
      .filter((item, index, all) => all.findIndex((candidate) => `${candidate.source}:${candidate.externalId}` === `${item.source}:${item.externalId}`) === index)
      .slice(0, 20);
  }

  private async withDiscoverFallback(items: ContentItem[], type: ContentType, page: number): Promise<ContentItem[]> {
    if (type === 'movie' || type === 'tv' || type === 'anime') {
      return items.length > 0 ? items : this.getSeededFallback(type, page);
    }

    if (type === 'all') {
      const hasMovie = items.some((item) => item.type === 'movie');
      const hasTv = items.some((item) => item.type === 'tv');
      const hasAnime = items.some((item) => item.type === 'anime');
      if (hasMovie && hasTv && hasAnime) return items;

      const [movieFallback, tvFallback, animeFallback] = await Promise.all([
        hasMovie ? Promise.resolve([]) : this.getSeededFallback('movie', page),
        hasTv ? Promise.resolve([]) : this.getSeededFallback('tv', page),
        hasAnime ? Promise.resolve([]) : this.getSeededFallback('anime', page),
      ]);

      return [...items, ...movieFallback, ...tvFallback, ...animeFallback].slice(0, 36);
    }

    return items;
  }

  // Search across all content types
  async search(params: SearchParams): Promise<ContentItem[]> {
    const searchParams = new URLSearchParams();
    searchParams.append('query', params.query);
    
    if (params.type && params.type !== 'all') {
      searchParams.append('type', params.type);
    }
    if (params.genre) {
      searchParams.append('genre', params.genre);
    }
    if (params.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params.pageSize) {
      searchParams.append('pageSize', params.pageSize.toString());
    }

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/search?${searchParams}`);
    return response.items;
  }

  // Get trending content
  async getTrending(type: ContentType = 'all', page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    if (type !== 'all') params.append('type', type);

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/trending?${params}`);
    return this.withDiscoverFallback(response.items, type, page);
  }

  // Get trending in India
  async getTrendingIndia(type?: 'movie' | 'tv', page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    if (type) params.append('type', type);

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/trending/india?${params}`);
    return response.items;
  }

  // Get content by original language (e.g. hi, te, ta, ml, kn)
  async getByLanguage(lang: string, type?: 'movie' | 'tv', page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    if (type) params.append('type', type);

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/by-language/${lang}?${params}`);
    return response.items;
  }

  // Get popular in India
  async getPopularIndia(type?: 'movie' | 'tv', page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    if (type) params.append('type', type);

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/popular/india?${params}`);
    return response.items;
  }

  // Get popular content
  async getPopular(type: ContentType = 'all', page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    if (type !== 'all') params.append('type', type);

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/popular?${params}`);
    return this.withDiscoverFallback(response.items, type, page);
  }

  // Get top-rated content
  async getTopRated(type: ContentType = 'all', page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    if (type !== 'all') params.append('type', type);

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/top-rated?${params}`);
    return this.withDiscoverFallback(response.items, type, page);
  }

  // Get content details
  async getContentDetails(type: string, id: string): Promise<ContentDetails> {
    try {
      return await get<ContentDetails>(`/api/discover/details/${type}/${id}`);
    } catch (error) {
      const isImdbId = /^tt\d+$/i.test(id);
      const isMovieOrTv = type === 'movie' || type === 'tv';
      const message = error instanceof Error ? error.message : '';

      // Compatibility fallback for deployments where /details/movie|tv/tt... does not resolve yet.
      if (isImdbId && isMovieOrTv && message.includes('(404)')) {
        return get<ContentDetails>(`/api/discover/details/imdb/${id}`);
      }

      throw error;
    }
  }

  // Get real-time ratings from IMDb and Rotten Tomatoes
  async getRatings(title: string, year?: number, imdbId?: string): Promise<ExternalRatings> {
    const params = new URLSearchParams({ title });
    if (year) params.append('year', year.toString());
    if (imdbId) params.append('imdbId', imdbId);
    return get<ExternalRatings>(`/api/discover/ratings?${params}`);
  }

  // Get genres
  async getGenres(type: ContentType): Promise<string[]> {
    if (type === 'all') {
      const [movieGenres, tvGenres, animeGenres] = await Promise.all([
        this.getGenres('movie'),
        this.getGenres('tv'),
        this.getGenres('anime')
      ]);
      return [...new Set([...movieGenres, ...tvGenres, ...animeGenres])].sort();
    }
    
    const response = await get<{ type: string; genres: string[] }>(`/api/discover/genres/${type}`);
    return response.genres;
  }

  // Get recommendations (if user is authenticated)
  async getRecommendations(type?: ContentType, page: number = 1, token?: string): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    if (type && type !== 'all') params.append('type', type);

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/recommendations?${params}`, token);
    return response.items;
  }

  async getRecommendationsFromLiked(token: string, limit: number = 30): Promise<LikedRecommendationsResponse> {
    return get<LikedRecommendationsResponse>(`/api/discover/recommendations/liked?limit=${limit}`, token);
  }

  async searchPeople(query: string, page: number = 1, pageSize: number = 12, indianOnly = false): Promise<PersonSearchItem[]> {
    const params = new URLSearchParams({
      query,
      page: page.toString(),
      pageSize: pageSize.toString(),
      indianOnly: indianOnly ? 'true' : 'false'
    });

    const response = await get<ApiResponse<PersonSearchItem>>(`/api/discover/search/people?${params}`);
    return response.items;
  }

  // Browse content by genre (uses TMDB discover + Jikan genre filter)
  async browseByGenre(genre: string, type?: ContentType, page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ genre });
    if (type && type !== 'all') params.append('type', type);
    if (page > 1) params.append('page', page.toString());

    const response = await get<ApiResponse<ContentItem>>(`/api/discover/browse?${params}`);
    return response.items;
  }

  // Get TV season with episode details
  async getTvSeason(tvId: string, seasonNumber: number): Promise<TvSeasonDetail> {
    return get<TvSeasonDetail>(`/api/discover/tv/${tvId}/season/${seasonNumber}`);
  }

  // Get anime episodes (paginated — Jikan returns 100 per page)
  async getAnimeEpisodes(malId: string, page: number = 1): Promise<AnimeEpisodesResponse> {
    return get<AnimeEpisodesResponse>(`/api/discover/anime/${malId}/episodes?page=${page}`);
  }

  // Get single anime episode detail (includes synopsis)
  async getAnimeEpisodeDetail(malId: string, episode: number): Promise<AnimeEpisodeDetail> {
    return get<AnimeEpisodeDetail>(`/api/discover/anime/${malId}/episodes/${episode}`);
  }

  // Get TMDB episode screenshots for anime (cross-referenced via title search)
  async getAnimeScreenshots(malId: string, season: number = 1): Promise<{ screenshots: { episodeNumber: number; stillPath: string | null }[] }> {
    return get<{ screenshots: { episodeNumber: number; stillPath: string | null }[] }>(`/api/discover/anime/${malId}/screenshots?season=${season}`);
  }

  // Get top-ranked anime from AnimeDB (supplementary source)
  async getTopRankedAnime(page: number = 1, size: number = 20, genres?: string): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (genres) params.append('genres', genres);
    const resp = await get<{ items: ContentItem[] }>(`/api/discover/anime/top-ranked?${params}`);
    return resp.items ?? [];
  }

  // Get upcoming anime releases (future/next-season titles)
  async getUpcomingAnime(page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    const resp = await get<{ items: ContentItem[] }>(`/api/discover/anime/upcoming?${params}`);
    return resp.items ?? [];
  }

  async getNowAiringAnime(page: number = 1): Promise<ContentItem[]> {
    const params = new URLSearchParams({ page: page.toString() });
    const resp = await get<{ items: ContentItem[] }>(`/api/discover/anime/now-airing?${params}`);
    return resp.items ?? [];
  }

  async getAnimeNews(id: string): Promise<NewsItem[]> {
    const resp = await get<{ items: NewsItem[] }>(`/api/discover/anime/${id}/news`);
    return resp.items ?? [];
  }

  async getAnimeReviews(id: string, page: number = 1): Promise<AnimeReviewItem[]> {
    const resp = await get<{ items: AnimeReviewItem[] }>(`/api/discover/anime/${id}/reviews?page=${page}`);
    return resp.items ?? [];
  }

  // Get person (actor/director) full details with filmography
  async getPersonDetails(personId: number | string, source?: string): Promise<PersonDetails> {
    const params = source ? `?source=${source}` : '';
    return get<PersonDetails>(`/api/discover/person/${personId}${params}`);
  }

  // Get watch providers (streaming, rent, buy)
  async getWatchProviders(type: string, id: string, country?: string): Promise<WatchProviders> {
    const params = country ? `?country=${country}` : '';
    return get<WatchProviders>(`/api/discover/${type}/${id}/watch-providers${params}`);
  }

  // Get similar/recommended content
  async getSimilar(type: string, id: string): Promise<SimilarItem[]> {
    const resp = await get<{ items: SimilarItem[] }>(`/api/discover/${type}/${id}/similar`);
    return resp.items ?? [];
  }

  // Get entertainment news
  async getNews(): Promise<NewsItem[]> {
    const resp = await get<{ items: NewsItem[] }>(`/api/discover/news`);
    return resp.items ?? [];
  }
}

export interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
  category: string;
  imageUrl?: string;
  publishedAt?: string;
}

// Export the real API — all data comes from live backend endpoints
export const discoverApi = new DiscoverAPI();