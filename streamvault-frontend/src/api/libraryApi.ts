import { del, get, post } from "./http";

export type UpsertPayload = {
  externalId: string;
  source: string;           // e.g., "TMDB_MOVIE" | "TMDB_TV" | "MAL_ANIME" | "LOCAL_DEMO"
  type: "movie" | "tv" | "anime";
  title: string;
  year?: number;
  episodes?: number;
  seasons?: number;
  posterUrl?: string;
  backdropUrl?: string;
  rating?: number;
  synopsis?: string;
  budgetUSD?: number;
  revenueUSD?: number;
  genresCsv?: string;
  zonesCsv?: string;

  status: "watchlist" | "watching" | "completed" | "dropped" | "on_hold" | "liked";
  currentEpisode?: number;
  droppedAtEpisode?: number;
  userRating?: number;
  notes?: string;
};

// API response types
export type LibraryApiRow = {
  contentId: string;
  externalId: string;
  source: string;
  type: "movie" | "tv" | "anime";
  title: string;
  year?: number | null;
  episodes?: number | null;
  seasons?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: number | null;
  synopsis?: string | null;
  budgetUSD?: number | null;
  revenueUSD?: number | null;
  genresCsv?: string | null;
  zonesCsv?: string | null;
  status: "watchlist" | "watching" | "completed" | "dropped" | "on_hold" | "liked";
  currentEpisode?: number | null;
  droppedAtEpisode?: number | null;
  userRating?: number | null;
  notes?: string | null;
  updatedAt: string; // ISO string from API
};

export type LibraryApiResponse = LibraryApiRow[];

export async function getLibrary(
  token: string, 
  filters?: { status?: string; type?: string; zone?: string }
): Promise<LibraryApiResponse> {
  const q = new URLSearchParams(filters as Record<string, string>).toString();
  return get<LibraryApiResponse>(`/api/library${q ? `?${q}` : ""}`, token);
}

export async function upsertLibrary(token: string, payload: UpsertPayload): Promise<LibraryApiRow> {
  return post<LibraryApiRow>("/api/library", payload, token);
}

export async function upsertLibrarySimple(token: string, payload: UpsertPayload): Promise<void> {
  await post<unknown>("/api/library", payload, token);
}

export async function removeFromLibrary(token: string, contentId: string) {
  return del(`/api/library/${contentId}`, token);
}

// Activity feed types
export type ActivityItem = {
  contentId: string;
  externalId: string;
  source: string;
  type: string;
  title: string;
  year?: number | null;
  posterUrl?: string | null;
  rating?: number | null;
  status: string;
  currentEpisode?: number | null;
  userRating?: number | null;
  updatedAt: string;
};

export type LibraryStats = {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  avgRating: number;
  totalEpisodesWatched: number;
};

export async function getActivity(token: string, limit = 20): Promise<ActivityItem[]> {
  return get<ActivityItem[]>(`/api/library/activity?limit=${limit}`, token, { silent401: true });
}

export async function getLibraryStats(token: string): Promise<LibraryStats> {
  return get<LibraryStats>(`/api/library/stats`, token, { silent401: true });
}