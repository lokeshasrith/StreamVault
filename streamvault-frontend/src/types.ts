import type { LibraryApiRow } from "./api/libraryApi.ts";

// Frontend Library Entry type
export interface LibraryEntry {
  id: string;
  contentId?: string; // API ContentId for removal operations
  source?: string;    // e.g. "TMDB_MOVIE" | "TMDB_TV" | "MAL_ANIME"
  title: string;
  originalTitle?: string;
  year?: number;
  genre?: string;
  type?: string;
  status: string;
  score?: number | null;
  episodes?: number;
  seasons?: number;
  runtime?: number;
  posterUrl?: string;
  backdropUrl?: string;
  notes?: string;
  dateAdded: string;
  dateModified: string;
}

// Convert API response to LibraryEntry
export function transformApiResponse(apiEntry: LibraryApiRow): LibraryEntry {
  return {
    id: apiEntry.externalId,
    contentId: apiEntry.contentId,
    source: apiEntry.source,
    title: apiEntry.title,
    originalTitle: apiEntry.title,
    year: apiEntry.year ?? undefined,
    genre: apiEntry.genresCsv ?? undefined,
    type: apiEntry.type,
    status: (apiEntry.status ?? "watchlist").replace("_", "-"),
    score: apiEntry.userRating ?? undefined,
    episodes: apiEntry.episodes ?? undefined,
    seasons: apiEntry.seasons ?? undefined,
    runtime: undefined,
    posterUrl: apiEntry.posterUrl ?? undefined,
    backdropUrl: apiEntry.backdropUrl ?? undefined,
    notes: apiEntry.notes ?? undefined,
    dateAdded: apiEntry.updatedAt,
    dateModified: apiEntry.updatedAt
  };
}