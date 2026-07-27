import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ContentCard from '../components/ContentCard';
import { discoverApi, type ContentItem } from '../api/discoverApi';
import { upsertLibrary, type UpsertPayload } from '../api/libraryApi';
import { useAuth } from '../auth/AuthContext';

type AnimeFeed = 'now' | 'upcoming' | 'top' | 'popular';

function normalizeGenre(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export default function AnimeExplorePage() {
  const { token, userKey } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const appRoot = userKey ? `/app/${userKey}` : '/auth';

  const [activeFeed, setActiveFeed] = useState<AnimeFeed>('now');
  const [animeItems, setAnimeItems] = useState<ContentItem[]>([]);
  const [currentPage, setCurrentPage] = useState(2);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [genres, setGenres] = useState<string[]>([]);
  const [activeGenre, setActiveGenre] = useState('all');
  const [genreBoostLoading, setGenreBoostLoading] = useState(false);

  const [addedToast, setAddedToast] = useState<string | null>(null);

  const mergeUnique = useCallback((items: ContentItem[]) => (
    items.filter((item, index, all) => (
      all.findIndex((candidate) => `${candidate.source}:${candidate.externalId}` === `${item.source}:${item.externalId}`) === index
    ))
  ), []);

  const fetchFeedPage = useCallback(async (feed: AnimeFeed, page: number): Promise<ContentItem[]> => {
    switch (feed) {
      case 'now':
        return discoverApi.getNowAiringAnime(page);
      case 'upcoming':
        return discoverApi.getUpcomingAnime(page);
      case 'top':
        return discoverApi.getTopRankedAnime(page, 20);
      case 'popular':
      default:
        return discoverApi.getPopular('anime', page);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const animeGenres = await discoverApi.getGenres('anime');
        if (!cancelled) setGenres(animeGenres);
      } catch {
        if (!cancelled) setGenres([]);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setActiveGenre('all');
      try {
        const [p1, p2] = await Promise.all([
          fetchFeedPage(activeFeed, 1),
          fetchFeedPage(activeFeed, 2),
        ]);

        if (cancelled) return;
        const merged = mergeUnique([...p1, ...p2]);
        setAnimeItems(merged);
        setCurrentPage(2);
        setHasMore(merged.length >= 40);
      } catch {
        if (cancelled) return;
        setAnimeItems([]);
        setCurrentPage(1);
        setHasMore(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [activeFeed, fetchFeedPage, mergeUnique]);

  const filteredItems = useMemo(() => {
    if (activeGenre === 'all') return animeItems;
    const needle = normalizeGenre(activeGenre);
    return animeItems.filter((item) => (
      (item.genres ?? []).some((genre) => normalizeGenre(genre) === needle)
    ));
  }, [activeGenre, animeItems]);

  useEffect(() => {
    if (activeGenre === 'all') return;
    if (filteredItems.length > 0) return;

    let cancelled = false;
    const boost = async () => {
      setGenreBoostLoading(true);
      try {
        const [g1, g2] = await Promise.all([
          discoverApi.browseByGenre(activeGenre, 'anime', 1),
          discoverApi.browseByGenre(activeGenre, 'anime', 2),
        ]);

        if (cancelled) return;
        setAnimeItems((prev) => mergeUnique([...prev, ...g1, ...g2]));
      } catch {
        // Ignore boost failures; UI keeps graceful empty state.
      } finally {
        if (!cancelled) setGenreBoostLoading(false);
      }
    };

    void boost();
    return () => { cancelled = true; };
  }, [activeGenre, filteredItems.length, mergeUnique]);

  const loadMore = useCallback(async () => {
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const next = await fetchFeedPage(activeFeed, nextPage);
      if (next.length === 0) {
        setHasMore(false);
      } else {
        setAnimeItems((prev) => mergeUnique([...prev, ...next]));
        setCurrentPage(nextPage);
        if (next.length < 20) setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [activeFeed, currentPage, fetchFeedPage, mergeUnique]);

  const handleContentClick = useCallback((content: ContentItem) => {
    const contentType = content.type === 'anime' || content.source === 'jikan' ? 'anime' : content.type === 'tv' ? 'tv' : 'movie';
    navigate(`/content/${contentType}/${content.externalId}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  }, [location.pathname, location.search, navigate]);

  const handleAddToLibrary = useCallback(async (content: ContentItem, status: string) => {
    if (!token) {
      navigate('/auth');
      return;
    }

    try {
      const payload: UpsertPayload = {
        externalId: String(content.externalId),
        source:
          content.source === 'jikan'
            ? 'MAL_ANIME'
            : content.source === 'imdb'
              ? `IMDB_${content.type.toUpperCase()}`
              : `TMDB_${content.type.toUpperCase()}`,
        type: content.type,
        title: content.title,
        posterUrl: content.posterPath ?? content.backdropPath ?? undefined,
        backdropUrl: content.backdropPath ?? undefined,
        rating: content.voteAverage,
        synopsis: content.overview,
        genresCsv: content.genres?.join(', '),
        status: status as UpsertPayload['status'],
      };

      await upsertLibrary(token, payload);
      setAddedToast(`"${content.title}" added to ${status.replace('_', ' ')}`);
      setTimeout(() => setAddedToast(null), 3000);
    } catch (error: unknown) {
      setAddedToast(`Error: ${error instanceof Error ? error.message : 'Failed to add'}`);
      setTimeout(() => setAddedToast(null), 4000);
    }
  }, [navigate, token]);

  return (
    <div className="anime-explorer-page page-shell min-h-screen bg-[#0F1014] pt-12 sm:pt-16 md:pt-20 pb-24 md:pb-12">
      <div className="mx-auto max-w-[1640px] px-4 sm:px-6 lg:px-10 py-6 sm:py-10 lg:py-12">
        <section className="premium-panel px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10 space-y-6 sm:space-y-8 lg:space-y-10">
          <div className="flex flex-col gap-5 sm:gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <span className="premium-kicker">Anime Explorer</span>
              <h1 className="section-heading mt-2 text-2xl sm:text-4xl text-[#F7F1E8]">Discover Anime Deeply</h1>
              <p className="mt-2 text-sm sm:text-base text-[#98A2B3] max-w-2xl">
                Dedicated anime page with feed tabs, broader spacing, genre drill-down, and continuous loading.
              </p>
              <button
                onClick={() => navigate(appRoot)}
                className="mt-5 premium-chip bg-white/[0.03] text-[#A7B0BE] hover:text-[#F7F1E8]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Discover
              </button>
            </div>

            <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-hide pb-1">
              {[
                { key: 'now', label: 'Now Airing' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'top', label: 'Top' },
                { key: 'popular', label: 'By Popularity' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFeed(tab.key as AnimeFeed)}
                  className={`premium-chip whitespace-nowrap ${activeFeed === tab.key ? 'bg-[#ffc562] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-5 sm:pt-6">
            <div className="flex flex-wrap gap-2.5 sm:gap-3 md:gap-3.5">
              <button
                onClick={() => setActiveGenre('all')}
                className={`premium-chip whitespace-nowrap ${activeGenre === 'all' ? 'bg-[#ffc562] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
              >
                All Genres
              </button>
              {genres.map((genre) => (
                <button
                  key={`anime-explore-genre-${genre}`}
                  onClick={() => setActiveGenre(genre)}
                  className={`premium-chip whitespace-nowrap ${activeGenre === genre ? 'bg-[#ffc562] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-14">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#808080] mx-auto mb-4"></div>
              <p className="text-[#98A2B3]">Loading anime explorer...</p>
            </div>
          ) : (
            <>
              {genreBoostLoading && activeGenre !== 'all' && (
                <p className="text-center text-xs text-[#98A2B3]">Finding more titles for {activeGenre}...</p>
              )}

              {filteredItems.length > 0 ? (
                <div className="pt-1 sm:pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3.5 gap-y-4.5 sm:gap-x-4.5 sm:gap-y-5.5 lg:gap-x-5.5 lg:gap-y-6">
                  {filteredItems.map((content) => (
                    <ContentCard
                      key={`anime-explorer-${content.source}-${content.externalId}`}
                      content={content}
                      size="medium"
                      onClick={handleContentClick}
                      onAddToLibrary={handleAddToLibrary}
                    />
                  ))}
                </div>
                </div>
              ) : (
                <div className="text-center py-16 text-[#98A2B3]">
                  <Sparkles className="mx-auto mb-3 h-7 w-7 text-[#ffc562]" />
                  <p>No anime found for this genre yet.</p>
                </div>
              )}

              {hasMore && (
                <div className="text-center pt-5 sm:pt-8">
                  <button
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="premium-button-secondary px-7 py-3 text-[#F7F1E8] disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'View More Anime'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-20 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-[22px] premium-panel px-4 py-3 text-[#E5E5E5] md:bottom-6 sm:px-5"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium break-words">{addedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
