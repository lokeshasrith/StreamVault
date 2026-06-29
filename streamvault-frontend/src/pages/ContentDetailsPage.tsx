import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Play, 
  Plus, 
  Star, 
  Calendar, 
  Clock, 
  DollarSign,
  Users,
  Globe,
  Award,
  Bookmark,
  Check,
  Eye,
  Pause,
  X,
  ChevronLeft,
  ChevronRight,
  Tv,
  ExternalLink
} from 'lucide-react';
import { discoverApi, type ContentDetails, type ExternalRatings, type WatchProviders, type SimilarItem, type ContentType, getImageUrl } from '../api/discoverApi';
import { useAuth } from '../auth/AuthContext';
import { upsertLibrary, type UpsertPayload } from '../api/libraryApi';
import EpisodeList from '../components/EpisodeList';
import PersonProfileModal from '../components/PersonProfileModal';

const STATUS_OPTIONS = [
  { value: 'Plan to Watch', label: 'Plan to Watch', icon: Plus, color: 'purple-400' },
  { value: 'Watching', label: 'Watching', icon: Eye, color: 'blue-400' },
  { value: 'Completed', label: 'Completed', icon: Check, color: 'emerald-400' },
  { value: 'On Hold', label: 'On Hold', icon: Pause, color: 'amber-400' },
  { value: 'Dropped', label: 'Dropped', icon: X, color: 'red-400' }
];

const STATUS_COLOR_CLASSES: Record<string, string> = {
  'purple-400': 'text-purple-400',
  'blue-400': 'text-blue-400',
  'emerald-400': 'text-emerald-400',
  'amber-400': 'text-amber-400',
  'red-400': 'text-red-400',
};

const MAL_REWRITE_SUFFIX = /\s*\[Written by MAL Rewrite\]\s*$/i;

function sanitizeOverviewText(overview?: string): string {
  if (!overview) return '';
  return overview.replace(MAL_REWRITE_SUFFIX, '').replace(/\s{2,}/g, ' ').trim();
}

function formatCountLabel(count: number, singular: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : `${singular}s`}`;
}

function formatSeasonEpisodeLabel(seasons?: number, episodes?: number): string {
  const parts: string[] = [];
  if (seasons && seasons > 0) parts.push(formatCountLabel(seasons, 'Season'));
  if (episodes && episodes > 0) parts.push(formatCountLabel(episodes, 'Episode'));
  return parts.join(' · ');
}

function formatVoteLabel(votes?: number | null): string {
  if (!votes || votes <= 0) return 'No votes';
  return formatCountLabel(votes, 'vote');
}

function formatLanguageLabel(languageCode?: string): string {
  if (!languageCode) return '';
  try {
    const formatter = new Intl.DisplayNames(['en'], { type: 'language' });
    const normalizedCode = languageCode.toLowerCase();
    return formatter.of(normalizedCode) ?? normalizedCode.toUpperCase();
  } catch {
    return languageCode.toUpperCase();
  }
}

export default function ContentDetailsPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, userKey } = useAuth();
  const appRoot = userKey ? `/app/${userKey}` : '/auth';
  
  const [content, setContent] = useState<ContentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ratings, setRatings] = useState<ExternalRatings>({ imdb: null, metacritic: null });
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [userStatus, setUserStatus] = useState<string>('');
  const [showTrailer, setShowTrailer] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedPersonSource, setSelectedPersonSource] = useState<string | undefined>(undefined);
  const [watchProviders, setWatchProviders] = useState<WatchProviders | null>(null);
  const [similarContent, setSimilarContent] = useState<SimilarItem[]>([]);
  const [currentTrending, setCurrentTrending] = useState<SimilarItem[]>([]);
  const castScrollRef = useRef<HTMLDivElement>(null);
  const similarScrollRef = useRef<HTMLDivElement>(null);
  const trendingScrollRef = useRef<HTMLDivElement>(null);
  const fromPath = (location.state as { from?: string } | null)?.from;

  const handleBack = () => {
    if (fromPath && fromPath.startsWith('/app')) {
      navigate(fromPath);
      return;
    }

    if (typeof window !== 'undefined' && typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    navigate(appRoot, { replace: true });
  };

  useEffect(() => {
    const fetchContentDetails = async () => {
      if (!type || !id) return;
      
      setIsLoading(true);
      try {
        const details = await discoverApi.getContentDetails(type as 'movie' | 'tv' | 'anime', id);
        setContent(details);
      } catch (error) {
        console.error('Failed to fetch content details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContentDetails();
  }, [type, id]);

  useEffect(() => {
    setIsOverviewExpanded(false);
  }, [content?.externalId]);

  // Fetch real-time ratings from IMDb and Rotten Tomatoes (skip for anime â€” they use MAL scores)
  useEffect(() => {
    if (!content) return;
    if (type === 'anime') {
      setRatingsLoading(false);
      return;
    }

    const fetchRatings = async () => {
      setRatingsLoading(true);
      try {
        const parsedYear = content.releaseDate ? new Date(content.releaseDate).getFullYear() : undefined;
        const year = parsedYear !== undefined && !isNaN(parsedYear) ? parsedYear : undefined;
        const result = await discoverApi.getRatings(
          content.title,
          year,
          content.imdbId
        );
        setRatings(result);
      } catch (err) {
        console.warn('Failed to fetch external ratings:', err);
      } finally {
        setRatingsLoading(false);
      }
    };

    fetchRatings();
  }, [content, type]);

  // Fetch watch providers and similar content
  useEffect(() => {
    if (!content || !type || !id) return;

    const fetchExtras = async () => {
      try {
        const normalizedType: ContentType =
          type === 'movie' || type === 'tv' || type === 'anime' ? type : 'all';

        const [providersResult, similarResult, trendingResult] = await Promise.allSettled([
          type !== 'anime'
            ? discoverApi.getWatchProviders(type, id)
            : Promise.resolve(null),
          discoverApi.getSimilar(type, id),
          discoverApi.getTrending(normalizedType, 1),
        ]);

        const providers = providersResult.status === 'fulfilled' ? providersResult.value : null;
        const similar = similarResult.status === 'fulfilled' ? similarResult.value : [];
        const trending = trendingResult.status === 'fulfilled' ? trendingResult.value : [];

        const trendingItems: SimilarItem[] = trending
          .filter((item) => item.externalId !== id)
          .map((item) => ({
            externalId: item.externalId,
            title: item.title,
            overview: item.overview,
            posterPath: item.posterPath,
            backdropPath: item.backdropPath,
            releaseDate: item.releaseDate,
            voteAverage: item.voteAverage,
            voteCount: item.voteCount,
            source: item.source,
            type: item.type,
          }));

        const similarOrFallback = similar.length > 0
          ? similar
          : trendingItems.slice(0, 12);

        const similarIds = new Set(similarOrFallback.map((item) => item.externalId));
        const trendingRail = trendingItems
          .filter((item) => !similarIds.has(item.externalId))
          .slice(0, 12);

        setWatchProviders(providers);
        setSimilarContent(similarOrFallback);
        setCurrentTrending(trendingRail);
      } catch (err) {
        console.warn('Failed to fetch extras:', err);
      }
    };

    fetchExtras();
  }, [content, type, id]);

  const STATUS_MAP: Record<string, UpsertPayload['status']> = {
    'Plan to Watch': 'watchlist',
    'Watching': 'watching',
    'Completed': 'completed',
    'On Hold': 'on_hold',
    'Dropped': 'dropped',
  };

  const SOURCE_MAP: Record<string, string> = {
    movie: 'TMDB_MOVIE',
    tv: 'TMDB_TV',
    anime: 'MAL_ANIME',
  };

  const handleStatusChange = async (status: string) => {
    if (!content || !token || !type || !id) return;
    setShowStatusMenu(false);
    setUserStatus(status);

    try {
      const parsedYear = content.releaseDate ? new Date(content.releaseDate).getFullYear() : undefined;
      const year = parsedYear !== undefined && !isNaN(parsedYear) ? parsedYear : undefined;
      const payload: UpsertPayload = {
        externalId: content.externalId ?? id,
        source: SOURCE_MAP[type] ?? 'TMDB_MOVIE',
        type: type as UpsertPayload['type'],
        title: content.title,
        year,
        episodes: content.episodes,
        seasons: content.seasons,
        posterUrl: content.posterPath ? getImageUrl(content.posterPath, 'large') : undefined,
        backdropUrl: content.backdropPath ? getImageUrl(content.backdropPath, 'original') : undefined,
        rating: content.voteAverage,
        synopsis: sanitizeOverviewText(content.overview),
        budgetUSD: content.budget,
        revenueUSD: content.revenue,
        genresCsv: content.genres?.join(', '),
        status: STATUS_MAP[status] ?? 'watchlist',
      };

      await upsertLibrary(token, payload);
    } catch (err) {
      console.error('Failed to add to library:', err);
      setUserStatus('');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F1014] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#808080] mx-auto mb-4"></div>
          <p className="text-[#808080] text-xl">Loading content details...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-[#0F1014] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#E5E5E5] mb-4">Content not found</h2>
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-md bg-white text-black font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const seasonEpisodeLabel = formatSeasonEpisodeLabel(content.seasons, content.episodes);
  const cleanedOverview = sanitizeOverviewText(content.overview);
  const hasLongOverview = cleanedOverview.length > 420;
  const overviewClampClass = hasLongOverview && !isOverviewExpanded
    ? 'line-clamp-5 sm:line-clamp-6'
    : '';

  return (
    <div className="details-page min-h-screen bg-[#0F1014] overflow-x-hidden">
      {/* Hero Section with Backdrop */}
      <div className="relative min-h-[31rem] sm:min-h-[42rem] md:min-h-[75vh] lg:min-h-[80vh]">
        {content.backdropPath && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${getImageUrl(content.backdropPath, 'original')})` 
            }}
          />
        )}
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 media-backdrop-scrim pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0F1014] via-[#0F1014]/90 to-transparent pointer-events-none" />
        
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-md border border-[#2A2D35] bg-[#16181D]/80 px-2.5 py-2 transition-all hover:bg-[#16181D] cursor-pointer sm:top-8 sm:left-8 sm:px-4 sm:py-2.5"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
          <span className="hidden text-sm font-medium text-white sm:inline">Back</span>
        </button>

        {/* Content Info */}
        <div className="relative z-10 flex items-start pt-20 sm:pt-24 md:pt-28 lg:pt-28 pb-8 sm:pb-10 md:pb-14">
          <div className="mx-auto w-full max-w-[1480px] px-3 sm:px-6 md:px-8">
            <div className="grid max-w-6xl items-start gap-5 md:gap-12 lg:grid-cols-12">
              {/* Poster — hidden on mobile, shown on lg+ */}
              <div className="hidden lg:block lg:col-span-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <img
                    src={getImageUrl(content.posterPath, 'large')}
                    alt={content.title}
                    className="w-full max-w-sm mx-auto rounded-xl shadow-2xl"
                  />
                  <div className="absolute inset-0 bg-[#E5E5E5]/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                </motion.div>
              </div>

              {/* Info */}
              <div className="space-y-6 lg:col-span-9 lg:max-w-4xl">
                <div className="p-2 sm:p-5 md:p-7 lg:p-8">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h1 className="font-display text-[1.85rem] sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.5rem] font-bold text-white leading-[1.04] mb-3 sm:mb-4 md:mb-6 break-words">
                      {content.title}
                    </h1>
                    
                    {content.tagline && (
                      <p className="hidden sm:block text-white/72 text-lg italic mb-6">
                        "{content.tagline}"
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5 sm:gap-y-3 md:gap-x-6 mb-5 sm:mb-7">
                      {/* Show IMDb rating in hero when available (for movies/TV), MAL for anime */}
                      {type !== 'anime' && ratings.imdb ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-[#f5c518] text-black font-bold text-xs px-1.5 py-0.5 rounded">IMDb</span>
                          <span className="text-white font-semibold">
                            {ratings.imdb.rating.toFixed(1)}
                          </span>
                          <span className="text-white/72">
                            ({formatVoteLabel(ratings.imdb.votes)})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-400 fill-current" />
                          <span className="text-white font-semibold">
                            {content.voteAverage.toFixed(1)}
                          </span>
                          <span className="text-white/72">
                            ({formatVoteLabel(content.voteCount)})
                          </span>
                        </div>
                      )}

                      {content.releaseDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-blue-400" />
                          <span className="text-white/72">
                            {new Date(content.releaseDate).getFullYear()}
                          </span>
                        </div>
                      )}

                      {content.runtime && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-purple-400" />
                          <span className="text-white/72">
                            {formatRuntime(content.runtime)}
                          </span>
                        </div>
                      )}

                      {seasonEpisodeLabel && (
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-emerald-400" />
                          <span className="text-white/72">{seasonEpisodeLabel}</span>
                        </div>
                      )}
                    </div>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-5 sm:mb-7">
                      {content.genres?.map((genre) => (
                        <span
                          key={`genre-${genre}`}
                          className="px-2 sm:px-3 py-0.5 sm:py-1 bg-white/[0.04] border border-white/10 rounded text-xs sm:text-sm text-white/76"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="details-actions mb-5 flex flex-wrap gap-2 sm:gap-4 sm:mb-7">
                      {content.trailerUrl && (
                      <button
                        onClick={() => setShowTrailer(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 sm:w-auto sm:gap-3 sm:px-8 sm:py-4 sm:text-base"
                      >
                        <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                        Watch Trailer
                      </button>
                      )}

                      <div className="relative w-full sm:w-auto">
                        <button
                          onClick={() => setShowStatusMenu(!showStatusMenu)}
                          className="btn-secondary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm sm:w-auto sm:gap-3 sm:px-8 sm:py-4 sm:text-base"
                        >
                          <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
                          {userStatus || 'Add to List'}
                        </button>

                        <AnimatePresence>
                          {showStatusMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute left-0 right-auto top-full z-20 mt-2 w-[min(92vw,260px)] overflow-hidden rounded-lg border border-[#2A2D35] glass-card sm:min-w-[200px]"
                            >
                              {STATUS_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                return (
                                  <button
                                    key={option.value}
                                    onClick={() => handleStatusChange(option.value)}
                                    className="w-full px-4 py-3 text-left hover:bg-[#1C1E24] transition-colors flex items-center gap-3"
                                  >
                                    <Icon className={`w-4 h-4 ${STATUS_COLOR_CLASSES[option.color] ?? 'text-white'}`} />
                                    <span className="text-white">{option.label}</span>
                                  </button>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Synopsis */}
                    <div className="max-w-3xl">
                      <p className={`text-white/80 text-sm sm:text-base lg:text-lg leading-[1.65] ${overviewClampClass}`}>
                        {cleanedOverview}
                      </p>
                      {hasLongOverview && (
                        <button
                          onClick={() => setIsOverviewExpanded((prev) => !prev)}
                          className="mt-3 text-sm text-[#F5C518] hover:text-[#ffd86a] transition-colors"
                        >
                          {isOverviewExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      <div className="details-content mx-auto w-full max-w-[1480px] px-3 sm:px-6 md:px-8 pt-8 pb-20 sm:pt-16 sm:pb-16 space-y-8 sm:space-y-16">
        {/* Ratings Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-8">
            Ratings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 md:gap-8">
            {/* Anime: MAL Score (real-time from Jikan API) */}
            {type === 'anime' ? (
              <>
                {content.voteAverage > 0 && (
                <div className="bg-[#16181D] rounded-xl p-3 sm:p-6 md:p-8 flex flex-col items-center border border-[#2A2D35]">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#2e51a2] flex items-center justify-center mb-2 sm:mb-3 md:mb-4">
                    <span className="text-white font-extrabold text-[10px] sm:text-xs tracking-tight">MAL</span>
                  </div>
                  <span className="text-white text-lg sm:text-xl md:text-2xl font-bold">
                    {content.voteAverage.toFixed(1)}/10
                  </span>
                  {content.voteCount > 0 && (
                    <span className="text-[#808080] text-[10px] sm:text-xs mt-1">
                      {content.voteCount.toLocaleString()} votes
                    </span>
                  )}
                  <span className="text-[#808080] text-[10px] sm:text-sm mt-1">MyAnimeList</span>
                </div>
                )}
                {content.malRanking && (
                <div className="bg-[#16181D] rounded-xl p-3 sm:p-6 md:p-8 flex flex-col items-center border border-[#2A2D35]">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-500 flex items-center justify-center mb-2 sm:mb-3 md:mb-4">
                    <Award className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <span className="text-white text-lg sm:text-xl md:text-2xl font-bold">
                    #{content.malRanking}
                  </span>
                  <span className="text-[#808080] text-[10px] sm:text-sm mt-1">MAL Ranking</span>
                  <span className="text-[#808080]/60 text-[10px] sm:text-xs mt-0.5">via AnimeDB</span>
                </div>
                )}
              </>
            ) : (
              <>
                {/* IMDb Rating â€” PRIMARY (real-time from RapidAPI) */}
                <div className="bg-[#16181D] rounded-xl p-3 sm:p-6 md:p-10 flex flex-col items-center border border-[#2A2D35] ring-1 ring-[#f5c518]/30">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 rounded-full bg-[#f5c518] flex items-center justify-center mb-2 sm:mb-3 md:mb-4">
                    <span className="text-black font-extrabold text-[10px] sm:text-xs md:text-base tracking-tight">IMDb</span>
                  </div>
                  {ratingsLoading ? (
                    <div className="animate-pulse h-6 sm:h-8 w-12 sm:w-16 bg-[#1C1E24] rounded mb-1" />
                  ) : ratings.imdb ? (
                    <>
                      <span className="text-white text-lg sm:text-2xl md:text-3xl font-bold">
                        {ratings.imdb.rating.toFixed(1)}/10
                      </span>
                      <span className="text-[#808080] text-[10px] sm:text-xs mt-1">
                        {formatVoteLabel(ratings.imdb.votes)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#808080] text-sm sm:text-lg">N/A</span>
                  )}
                  <span className="text-[#808080] text-[10px] sm:text-sm mt-1">IMDb</span>
                </div>

                {/* TMDB Rating */}
                {content.voteAverage > 0 && (
                <div className="bg-[#16181D] rounded-xl p-3 sm:p-6 md:p-8 flex flex-col items-center border border-[#2A2D35]">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#01b4e4] flex items-center justify-center mb-2 sm:mb-3 md:mb-4">
                    <span className="text-white font-extrabold text-[10px] sm:text-xs tracking-tight">TMDB</span>
                  </div>
                  <span className="text-white text-lg sm:text-xl md:text-2xl font-bold">
                    {content.voteAverage.toFixed(1)}/10
                  </span>
                  {content.voteCount > 0 && (
                    <span className="text-[#808080] text-[10px] sm:text-xs mt-1">
                      {formatVoteLabel(content.voteCount)}
                    </span>
                  )}
                  <span className="text-[#808080] text-[10px] sm:text-sm mt-1">TMDB</span>
                </div>
                )}

                {/* Metacritic / Metascore */}
                <div className="bg-[#16181D] rounded-xl p-3 sm:p-6 md:p-8 flex flex-col items-center border border-[#2A2D35]">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#ffcc34] flex items-center justify-center mb-2 sm:mb-3 md:mb-4">
                    <span className="text-black font-extrabold text-base sm:text-xl">M</span>
                  </div>
                  {ratingsLoading ? (
                    <div className="animate-pulse h-6 sm:h-8 w-12 sm:w-16 bg-[#1C1E24] rounded mb-1" />
                  ) : ratings.metacritic ? (
                    <span className="text-white text-lg sm:text-xl md:text-2xl font-bold">
                      {ratings.metacritic.metascore}/100
                    </span>
                  ) : (
                    <span className="text-[#808080] text-sm sm:text-lg">N/A</span>
                  )}
                  <span className="text-[#808080] text-[10px] sm:text-sm mt-1">Metacritic</span>
                </div>
              </>
            )}
          </div>
        </motion.section>

        {/* Stats Section */}
        {(content.budget || content.revenue || content.status || content.originalLanguage) && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-8">
              Production Details
            </h2>
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {content.budget && (
                <div className="glass-card p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                    <h3 className="font-semibold text-white text-sm sm:text-base">Budget</h3>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-400">
                    {formatCurrency(content.budget)}
                  </p>
                </div>
              )}

              {content.revenue && (
                <div className="glass-card p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                    <h3 className="font-semibold text-white text-sm sm:text-base">Box Office</h3>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-amber-400">
                    {formatCurrency(content.revenue)}
                  </p>
                </div>
              )}

              {content.originalLanguage && (
                <div className="glass-card p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    <h3 className="font-semibold text-white text-sm sm:text-base">Language</h3>
                  </div>
                  <p className="text-base sm:text-lg text-[#808080]">
                    {formatLanguageLabel(content.originalLanguage)}
                  </p>
                </div>
              )}

              {content.status && (
                <div className="glass-card p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                    <h3 className="font-semibold text-white text-sm sm:text-base">Status</h3>
                  </div>
                  <p className="text-base sm:text-lg text-[#808080]">
                    {content.status}
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Cast Section */}
        {((content.cast && content.cast.length > 0) || content.director || (content.writers && content.writers.length > 0)) ? (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-8">
              Cast & Crew
            </h2>

            {/* Director & Writers */}
            {(content.director || (content.writers && content.writers.length > 0)) ? (
              <div className="flex flex-wrap gap-4 sm:gap-8 mb-6 sm:mb-8">
                {content.director && (
                  <div>
                    <h3 className="text-[#808080] text-xs sm:text-sm font-semibold uppercase mb-1">Director</h3>
                    <p className="text-white text-base sm:text-lg">{content.director}</p>
                  </div>
                )}
                {content.writers && content.writers.length > 0 && (
                  <div>
                    <h3 className="text-[#808080] text-xs sm:text-sm font-semibold uppercase mb-1">Writers</h3>
                    <p className="text-white text-base sm:text-lg">{content.writers.join(', ')}</p>
                  </div>
                )}
              </div>
            ) : null}
            
            {content.cast && content.cast.length > 0 && (
            <div className="relative group/cast">
              {/* Left Arrow */}
              <button
                onClick={() => castScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 transition-opacity hover:bg-white/20 cursor-pointer group-hover/cast:opacity-100 backdrop-blur-sm sm:-ml-3 sm:flex sm:h-10 sm:w-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {/* Right Arrow */}
              <button
                onClick={() => castScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 transition-opacity hover:bg-white/20 cursor-pointer group-hover/cast:opacity-100 backdrop-blur-sm sm:-mr-3 sm:flex sm:h-10 sm:w-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div ref={castScrollRef} className="flex gap-3 sm:gap-5 overflow-x-auto pb-4 scrollbar-hide">
              {content.cast.map((actor) => (
                <button
                  key={actor.id}
                  className={`flex-shrink-0 w-20 sm:w-24 md:w-28 text-center group ${actor.id > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => {
                    if (actor.id > 0) {
                      setSelectedPersonId(actor.id);
                      setSelectedPersonSource(actor.idSource);
                    }
                  }}
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-[#1C1E24] mb-2 sm:mb-3 flex items-center justify-center overflow-hidden ring-2 ring-transparent group-hover:ring-[#2A2D35] transition-all">
                    {actor.profilePath ? (
                      <img
                        src={getImageUrl(actor.profilePath, 'small')}
                        alt={actor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-10 h-10 text-[#808080]/30" />
                    )}
                  </div>
                  <h4 className="font-semibold text-white text-xs sm:text-sm mb-0.5 group-hover:text-violet-300 transition-colors truncate">
                    {actor.name}
                  </h4>
                  <p className="text-[10px] sm:text-xs text-[#808080] truncate">
                    {actor.character}
                  </p>
                </button>
              ))}
              </div>
            </div>
            )}
          </motion.section>
        ) : null}

        {/* Episodes Section â€” for TV shows and anime */}
        {(type === 'tv' || type === 'anime') && content.externalId && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-8">
              Episodes
            </h2>
            <EpisodeList
              contentType={type as 'tv' | 'anime'}
              contentId={content.externalId}
              totalSeasons={content.seasons}
              totalEpisodes={content.episodes}
              posterUrl={content.posterPath ?? undefined}
            />
          </motion.section>
        )}

        {/* Where to Watch Section */}
        {watchProviders && (watchProviders.streaming.length > 0 || (watchProviders.free && watchProviders.free.length > 0) || watchProviders.rent.length > 0 || watchProviders.buy.length > 0) && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
          >
            <div className="flex items-center gap-3 mb-4 sm:mb-8">
              <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white">
                Where to Watch
              </h2>
              {watchProviders.link && (
                <a
                  href={watchProviders.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#808080] hover:text-white transition-colors"
                  title="View on JustWatch"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="space-y-6">
              {/* Streaming (subscription) */}
              {watchProviders.streaming.length > 0 && (
                <div>
                  <h3 className="text-[#808080] text-xs sm:text-sm font-semibold uppercase mb-3 flex items-center gap-2">
                    <Tv className="w-4 h-4" /> Stream
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {watchProviders.streaming.map((p) => (
                      <div key={`streaming-${p.id}`} className="flex items-center gap-2 bg-[#16181D] border border-[#2A2D35] rounded-lg px-3 py-2">
                        {p.logoUrl && (
                          <img src={getImageUrl(p.logoUrl, 'small')} alt={p.name} className="w-7 h-7 rounded" />
                        )}
                        <span className="text-white text-sm">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Free */}
              {watchProviders.free && watchProviders.free.length > 0 && (
                <div>
                  <h3 className="text-[#808080] text-xs sm:text-sm font-semibold uppercase mb-3">Free</h3>
                  <div className="flex flex-wrap gap-3">
                    {watchProviders.free.map((p) => (
                      <div key={`free-${p.id}`} className="flex items-center gap-2 bg-[#16181D] border border-[#2A2D35] rounded-lg px-3 py-2">
                        {p.logoUrl && (
                          <img src={getImageUrl(p.logoUrl, 'small')} alt={p.name} className="w-7 h-7 rounded" />
                        )}
                        <span className="text-white text-sm">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rent */}
              {watchProviders.rent.length > 0 && (
                <div>
                  <h3 className="text-[#808080] text-xs sm:text-sm font-semibold uppercase mb-3">Rent</h3>
                  <div className="flex flex-wrap gap-3">
                    {watchProviders.rent.map((p) => (
                      <div key={`rent-${p.id}`} className="flex items-center gap-2 bg-[#16181D] border border-[#2A2D35] rounded-lg px-3 py-2">
                        {p.logoUrl && (
                          <img src={getImageUrl(p.logoUrl, 'small')} alt={p.name} className="w-7 h-7 rounded" />
                        )}
                        <span className="text-white text-sm">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buy */}
              {watchProviders.buy.length > 0 && (
                <div>
                  <h3 className="text-[#808080] text-xs sm:text-sm font-semibold uppercase mb-3">Buy</h3>
                  <div className="flex flex-wrap gap-3">
                    {watchProviders.buy.map((p) => (
                      <div key={`buy-${p.id}`} className="flex items-center gap-2 bg-[#16181D] border border-[#2A2D35] rounded-lg px-3 py-2">
                        {p.logoUrl && (
                          <img src={getImageUrl(p.logoUrl, 'small')} alt={p.name} className="w-7 h-7 rounded" />
                        )}
                        <span className="text-white text-sm">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Similar / Recommended Section */}
        {similarContent.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-8">
              You Might Also Like
            </h2>
            <div className="relative group/similar">
              <button
                onClick={() => similarScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 transition-opacity hover:bg-white/20 cursor-pointer group-hover/similar:opacity-100 backdrop-blur-sm sm:-ml-3 sm:flex sm:h-10 sm:w-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => similarScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 transition-opacity hover:bg-white/20 cursor-pointer group-hover/similar:opacity-100 backdrop-blur-sm sm:-mr-3 sm:flex sm:h-10 sm:w-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div ref={similarScrollRef} className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {similarContent.map((item) => (
                  <button
                    key={item.externalId}
                    className="flex-shrink-0 w-32 sm:w-40 md:w-44 group cursor-pointer text-left"
                    onClick={() => navigate(`/content/${item.type}/${item.externalId}`, { state: { from: `${location.pathname}${location.search}` } })}
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1C1E24] mb-2 ring-2 ring-transparent group-hover:ring-[#2A2D35] transition-all">
                      {item.posterPath ? (
                        <img
                          src={getImageUrl(item.posterPath, 'medium')}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Star className="w-8 h-8 text-[#808080]/30" />
                        </div>
                      )}
                    </div>
                    <h4 className="font-semibold text-white text-xs sm:text-sm truncate group-hover:text-violet-300 transition-colors">
                      {item.title}
                    </h4>
                    {item.voteAverage > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        <span className="text-[10px] sm:text-xs text-[#808080]">{item.voteAverage.toFixed(1)}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Current Trending Section */}
        {currentTrending.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
          >
            <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-8">
              Current Trending
            </h2>
            <div className="relative group/trending">
              <button
                onClick={() => trendingScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 transition-opacity hover:bg-white/20 cursor-pointer group-hover/trending:opacity-100 backdrop-blur-sm sm:-ml-3 sm:flex sm:h-10 sm:w-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => trendingScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 transition-opacity hover:bg-white/20 cursor-pointer group-hover/trending:opacity-100 backdrop-blur-sm sm:-mr-3 sm:flex sm:h-10 sm:w-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div ref={trendingScrollRef} className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {currentTrending.map((item) => (
                  <button
                    key={`trending-${item.externalId}`}
                    className="flex-shrink-0 w-32 sm:w-40 md:w-44 group cursor-pointer text-left"
                    onClick={() => navigate(`/content/${item.type}/${item.externalId}`, { state: { from: `${location.pathname}${location.search}` } })}
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1C1E24] mb-2 ring-2 ring-transparent group-hover:ring-[#2A2D35] transition-all">
                      {item.posterPath ? (
                        <img
                          src={getImageUrl(item.posterPath, 'medium')}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Star className="w-8 h-8 text-[#808080]/30" />
                        </div>
                      )}
                    </div>
                    <h4 className="font-semibold text-white text-xs sm:text-sm truncate group-hover:text-violet-300 transition-colors">
                      {item.title}
                    </h4>
                    {item.voteAverage > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        <span className="text-[10px] sm:text-xs text-[#808080]">{item.voteAverage.toFixed(1)}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black"
            onClick={() => setShowTrailer(false)}
          >
            {/* Top bar with back button */}
            <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-2.5 bg-black/90 border-b border-white/10 shrink-0">
              <button
                onClick={() => setShowTrailer(false)}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <span className="text-white/60 text-sm font-medium truncate mx-4">{content.title} — Trailer</span>
              <button
                onClick={() => setShowTrailer(false)}
                className="text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Video container — fills remaining space */}
            <div
              className="flex-1 flex items-center justify-center px-2 py-2 sm:px-4 sm:py-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full h-full max-w-[1280px] max-h-[calc(100vh-3.5rem)]" style={{ aspectRatio: '16/9' }}>
                {content.trailerUrl && (
                  <iframe
                    src={content.trailerUrl}
                    title="Trailer"
                    className="absolute inset-0 w-full h-full rounded-md"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Person Profile Modal */}
      <PersonProfileModal
        personId={selectedPersonId}
        personSource={selectedPersonSource}
        onClose={() => { setSelectedPersonId(null); setSelectedPersonSource(undefined); }}
        onMovieClick={(mediaType, creditId) => {
          setSelectedPersonId(null);
          setSelectedPersonSource(undefined);
          navigate(`/content/${mediaType}/${creditId}`, { state: { from: `${location.pathname}${location.search}` } });
        }}
      />
    </div>
  );
}