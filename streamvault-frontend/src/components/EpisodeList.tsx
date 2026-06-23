import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Star, Clock, Film, AlertTriangle, RotateCcw, Loader2, CheckCircle, Filter, Play, X } from 'lucide-react';
import { discoverApi, getImageUrl, type TvSeasonDetail, type TvEpisode, type AnimeEpisode, type AnimeEpisodeDetail } from '../api/discoverApi';

interface EpisodeListProps {
  contentType: 'tv' | 'anime';
  contentId: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  posterUrl?: string;
}

export default function EpisodeList({ contentType, contentId, totalSeasons, totalEpisodes, posterUrl }: EpisodeListProps) {
  const [activeSeason, setActiveSeason] = useState(1);
  const [seasonData, setSeasonData] = useState<TvSeasonDetail | null>(null);
  const [animeEpisodes, setAnimeEpisodes] = useState<AnimeEpisode[]>([]);
  const [animePage, setAnimePage] = useState(1);
  const [animeHasMore, setAnimeHasMore] = useState(false);
  const [animeLastPage, setAnimeLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedEp, setExpandedEp] = useState<number | null>(null);
  // Cache for lazy-loaded anime episode details (synopsis, duration)
  const [animeDetails, setAnimeDetails] = useState<Record<number, AnimeEpisodeDetail>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  // TMDB episode screenshots keyed by episode number
  const [screenshots, setScreenshots] = useState<Record<number, string>>({});
  // Episode type filter: 'all' | 'canon' | 'filler' | 'recap'
  const [epFilter, setEpFilter] = useState<'all' | 'canon' | 'filler' | 'recap'>('all');
  // Season trailer modal
  const [showSeasonTrailer, setShowSeasonTrailer] = useState(false);

  const fetchTvSeason = useCallback(async (season: number) => {
    setLoading(true);
    try {
      const data = await discoverApi.getTvSeason(contentId, season);
      setSeasonData(data);
    } catch (err) {
      console.error('Failed to fetch TV season:', err);
      setSeasonData(null);
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  const fetchAnimeEpisodes = useCallback(async (page: number, append = false) => {
    setLoading(true);
    try {
      const data = await discoverApi.getAnimeEpisodes(contentId, page);
      setAnimeEpisodes(prev => append ? [...prev, ...(data.episodes ?? [])] : (data.episodes ?? []));
      setAnimeHasMore(data.pagination?.hasNextPage ?? false);
      setAnimeLastPage(data.pagination?.lastPage ?? 1);
      setAnimePage(page);
    } catch (err) {
      console.error('Failed to fetch anime episodes:', err);
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    if (contentType === 'tv') {
      fetchTvSeason(activeSeason);
    } else {
      fetchAnimeEpisodes(1);
      // Fetch TMDB screenshots in parallel
      discoverApi.getAnimeScreenshots(contentId, 1).then(data => {
        const map: Record<number, string> = {};
        data.screenshots?.forEach(s => {
          if (s.stillPath) map[s.episodeNumber] = s.stillPath;
        });
        setScreenshots(map);
      }).catch((err) => {
        console.warn('Failed to fetch anime screenshots:', err);
      });
    }
  }, [contentType, contentId, fetchTvSeason, fetchAnimeEpisodes, activeSeason]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const ratingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-400';
    if (rating >= 6) return 'text-yellow-400';
    if (rating >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  // ─── TV Season Tabs ─────────────────────────────────────────────────────
  const renderSeasonTabs = () => {
    if (contentType !== 'tv' || !totalSeasons) return null;
    const seasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);

    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-6">
        {seasons.map(s => (
          <button
            key={s}
            onClick={() => { setActiveSeason(s); setExpandedEp(null); }}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
              activeSeason === s
                ? 'bg-white text-black'
                : 'bg-[#1C1E24] text-[#808080] hover:bg-[#25272E] border border-[#2A2D35]'
            }`}
          >
            Season {s}
          </button>
        ))}
      </div>
    );
  };

  // ─── Anime Page Navigation ──────────────────────────────────────────────
  const renderAnimePageNav = () => {
    if (contentType !== 'anime' || animeLastPage <= 1) return null;
    const pages = Array.from({ length: animeLastPage }, (_, i) => i + 1);

    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-6">
        {pages.map(p => (
          <button
            key={p}
            onClick={() => { fetchAnimeEpisodes(p); setExpandedEp(null); }}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
              animePage === p
                ? 'bg-white text-black'
                : 'bg-[#1C1E24] text-[#808080] hover:bg-[#25272E] border border-[#2A2D35]'
            }`}
          >
            Ep {(p - 1) * 100 + 1}–{Math.min(p * 100, totalEpisodes ?? p * 100)}
          </button>
        ))}
      </div>
    );
  };

  // ─── TV Episode Card ────────────────────────────────────────────────────
  const renderTvEpisode = (ep: TvEpisode) => {
    const isExpanded = expandedEp === ep.episodeNumber;
    const thumbnailUrl = ep.stillPath ? getImageUrl(ep.stillPath, 'large') : undefined;

    return (
      <motion.div
        key={`tv-${activeSeason}-${ep.episodeNumber}`}
        layout
        className="bg-[#16181D] border border-[#2A2D35] rounded-lg overflow-hidden hover:border-[#808080]/30 transition-colors"
      >
        <button
          onClick={() => setExpandedEp(isExpanded ? null : ep.episodeNumber)}
          className="w-full text-left p-3 sm:p-4 flex items-start gap-3 sm:gap-4 cursor-pointer"
        >
          {/* Episode thumbnail — hidden on mobile */}
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={ep.name}
              className="hidden sm:block w-28 h-16 sm:w-40 sm:h-24 object-cover rounded-lg flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="hidden sm:flex w-28 h-16 sm:w-40 sm:h-24 bg-[#1C1E24] rounded-lg items-center justify-center flex-shrink-0">
              <Film className="w-6 h-6 sm:w-8 sm:h-8 text-[#808080]/30" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[#00A8E1] font-bold text-sm">E{ep.episodeNumber}</span>
              <h4 className="text-white font-semibold truncate">{ep.name || `Episode ${ep.episodeNumber}`}</h4>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-[#808080]">
              {ep.voteAverage > 0 && (
                <span className={`flex items-center gap-1 ${ratingColor(ep.voteAverage)}`}>
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {ep.voteAverage.toFixed(1)}
                  {ep.voteCount > 0 && <span className="text-[#808080]/50">({ep.voteCount})</span>}
                </span>
              )}
              {ep.airDate && <span>{formatDate(ep.airDate)}</span>}
              {ep.runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {ep.runtime}m
                </span>
              )}
            </div>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#808080] flex-shrink-0 mt-1" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#808080] flex-shrink-0 mt-1" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && ep.overview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0">
                <div className="border-t border-[#2A2D35] pt-3">
                  <p className="text-[#808080] text-sm leading-relaxed">{ep.overview}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ─── Anime Episode Card (TV-style with lazy-loaded synopsis) ──────────
  const handleAnimeExpand = async (epNum: number) => {
    if (expandedEp === epNum) {
      setExpandedEp(null);
      return;
    }
    setExpandedEp(epNum);
    // Lazy-load episode detail if not cached
    if (!animeDetails[epNum]) {
      setDetailLoading(epNum);
      try {
        const detail = await discoverApi.getAnimeEpisodeDetail(contentId, epNum);
        setAnimeDetails(prev => ({ ...prev, [epNum]: detail }));
      } catch (err) {
        console.error('Failed to fetch anime episode detail:', err);
      } finally {
        setDetailLoading(null);
      }
    }
  };

  const renderAnimeEpisode = (ep: AnimeEpisode) => {
    const isExpanded = expandedEp === ep.episodeNumber;
    const detail = animeDetails[ep.episodeNumber];
    const isDetailLoading = detailLoading === ep.episodeNumber;
    const duration = detail?.duration;
    const thumbUrl = screenshots[ep.episodeNumber];
    const thumbnailUrl = thumbUrl ? getImageUrl(thumbUrl, 'large') : undefined;
    const fallbackPoster = posterUrl ? getImageUrl(posterUrl, 'medium') : undefined;

    return (
      <motion.div
        key={`anime-${ep.episodeNumber}`}
        layout
        className={`bg-[#16181D] border rounded-lg overflow-hidden transition-colors ${
          ep.filler
            ? 'border-orange-500/30 bg-orange-500/5'
            : ep.recap
              ? 'border-blue-500/30 bg-blue-500/5'
              : 'border-[#2A2D35] hover:border-[#808080]/30'
        }`}
      >
        <button
          onClick={() => handleAnimeExpand(ep.episodeNumber)}
          className="w-full text-left p-3 sm:p-4 flex items-start gap-3 sm:gap-4 cursor-pointer"
        >
          {/* Episode thumbnail — hidden on mobile, TMDB screenshot, poster fallback, or number */}
          {thumbnailUrl ? (
            <div className="hidden sm:block w-28 h-16 sm:w-40 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={thumbnailUrl}
                alt={`Episode ${ep.episodeNumber}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : fallbackPoster ? (
            <div className="hidden sm:block w-28 h-16 sm:w-40 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 relative">
              <img
                src={fallbackPoster}
                alt={`Episode ${ep.episodeNumber}`}
                className="w-full h-full object-cover blur-[2px] brightness-50"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-lg sm:text-2xl drop-shadow-lg">E{ep.episodeNumber}</span>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex w-28 h-16 sm:w-40 sm:h-24 rounded-lg bg-white/5 flex-col items-center justify-center flex-shrink-0 border border-white/10">
              <span className="text-white/70 font-bold text-lg sm:text-2xl">{ep.episodeNumber}</span>
              <span className="text-[#808080]/60 text-xs mt-1">Episode</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="text-purple-400 font-bold text-sm">E{ep.episodeNumber}</span>
              <h4 className="text-white font-semibold truncate">{ep.name || `Episode ${ep.episodeNumber}`}</h4>
              {ep.filler && (
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3" /> Filler
                </span>
              )}
              {ep.recap && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1 font-medium">
                  <RotateCcw className="w-3 h-3" /> Recap
                </span>
              )}
              {!ep.filler && !ep.recap && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1 font-medium">
                  <CheckCircle className="w-3 h-3" /> Canon
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-[#808080]">
              {ep.score != null && ep.score > 0 && (
                <span className={`flex items-center gap-1 ${ratingColor(ep.score)}`}>
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {ep.score.toFixed(1)}
                </span>
              )}
              {ep.airDate && <span>{formatDate(ep.airDate)}</span>}
              {duration != null && duration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.round(duration / 60)}m
                </span>
              )}
            </div>

          </div>

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#808080] flex-shrink-0 mt-1" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#808080] flex-shrink-0 mt-1" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0">
                <div className="border-t border-[#2A2D35] pt-3">
                  {isDetailLoading ? (
                    <div className="flex items-center gap-2 text-[#808080] text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading synopsis...
                    </div>
                  ) : detail?.synopsis ? (
                    <p className="text-[#808080] text-sm leading-relaxed">{detail.synopsis}</p>
                  ) : (
                    <p className="text-[#808080]/50 text-sm italic">No synopsis available for this episode.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading && (contentType === 'tv' ? !seasonData : animeEpisodes.length === 0)) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-[#16181D] border border-[#2A2D35] rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-40 h-24 bg-[#1C1E24] rounded-lg" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-[#1C1E24] rounded w-3/4" />
                <div className="h-3 bg-[#1C1E24] rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const tvEpisodes = seasonData?.episodes ?? [];
  const episodes = contentType === 'tv' ? tvEpisodes : animeEpisodes;

  if (episodes.length === 0 && !loading) {
    return (
      <div className="text-center py-12 bg-[#16181D] border border-[#2A2D35] rounded-lg">
        <Film className="w-12 h-12 text-[#808080]/30 mx-auto mb-3" />
        <p className="text-[#808080]">No episode data available</p>
      </div>
    );
  }

  return (
    <div className="episode-list">
      {/* Season tabs (TV) or page nav (Anime) */}
      {renderSeasonTabs()}
      {renderAnimePageNav()}

      {/* Season overview for TV */}
      {contentType === 'tv' && seasonData?.overview && (
        <p className="text-[#808080] text-sm mb-6 leading-relaxed">
          {seasonData.overview}
        </p>
      )}

      {/* Season trailer button */}
      {contentType === 'tv' && seasonData?.trailerUrl && (
        <button
          onClick={() => setShowSeasonTrailer(true)}
          className="mb-6 px-5 py-2.5 rounded-md bg-[#1C1E24] text-[#E5E5E5] font-medium hover:bg-[#25272E] transition-colors flex items-center gap-2 text-sm cursor-pointer border border-[#2A2D35]"
        >
          <Play className="w-4 h-4" />
          Season {activeSeason} Trailer
        </button>
      )}

      {/* Anime Filler/Canon Summary & Filter */}
      {contentType === 'anime' && animeEpisodes.length > 0 && (() => {
        const total = animeEpisodes.length;
        const fillerCount = animeEpisodes.filter(e => e.filler).length;
        const recapCount = animeEpisodes.filter(e => e.recap).length;
        const canonCount = total - fillerCount - recapCount;
        const fillerPct = Math.round((fillerCount / total) * 100);
        const recapPct = Math.round((recapCount / total) * 100);
        const canonPct = 100 - fillerPct - recapPct;

        return (
          <div className="mb-6 space-y-3">
            {/* Visual bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-[#1C1E24]">
              {canonPct > 0 && <div className="bg-green-500" style={{ width: `${canonPct}%` }} />}
              {fillerPct > 0 && <div className="bg-orange-500" style={{ width: `${fillerPct}%` }} />}
              {recapPct > 0 && <div className="bg-blue-500" style={{ width: `${recapPct}%` }} />}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-green-400">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                Canon: {canonCount} ({canonPct}%)
              </span>
              {fillerCount > 0 && (
                <span className="flex items-center gap-1.5 text-orange-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  Filler: {fillerCount} ({fillerPct}%)
                </span>
              )}
              {recapCount > 0 && (
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Recap: {recapCount} ({recapPct}%)
                </span>
              )}
            </div>

            {/* Filter buttons */}
            {(fillerCount > 0 || recapCount > 0) && (
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#808080]" />
                {(['all', 'canon', 'filler', 'recap'] as const)
                  .filter(f => f === 'all' || (f === 'filler' && fillerCount > 0) || (f === 'canon' && canonCount > 0) || (f === 'recap' && recapCount > 0))
                  .map(f => (
                    <button
                      key={f}
                      onClick={() => setEpFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        epFilter === f
                          ? f === 'canon' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
                            : f === 'filler' ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40'
                            : f === 'recap' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
                            : 'bg-[#25272E] text-white ring-1 ring-[#808080]/40'
                          : 'bg-[#1C1E24] text-[#808080] hover:bg-[#25272E]'
                      }`}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Episode count badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#808080] text-sm">
          {contentType === 'tv'
            ? `${tvEpisodes.length} Episode${tvEpisodes.length !== 1 ? 's' : ''}`
            : `${animeEpisodes.length} Episode${animeEpisodes.length !== 1 ? 's' : ''} loaded`
          }
          {contentType === 'tv' && seasonData?.airDate && (
            <span className="ml-2 text-[#808080]/60">• Aired {formatDate(seasonData.airDate)}</span>
          )}
        </span>

        {/* Average rating for season / anime page */}
        {contentType === 'tv' && tvEpisodes.length > 0 && (() => {
          const rated = tvEpisodes.filter(e => e.voteAverage > 0);
          if (rated.length === 0) return null;
          const avg = rated.reduce((sum, e) => sum + e.voteAverage, 0) / rated.length;
          return (
            <span className={`flex items-center gap-1 text-sm ${ratingColor(avg)}`}>
              <Star className="w-4 h-4 fill-current" />
              Season Avg: {avg.toFixed(1)}
            </span>
          );
        })()}
        {contentType === 'anime' && animeEpisodes.length > 0 && (() => {
          const rated = animeEpisodes.filter(e => e.score != null && e.score > 0);
          if (rated.length === 0) return null;
          const avg = rated.reduce((sum, e) => sum + (e.score ?? 0), 0) / rated.length;
          return (
            <span className={`flex items-center gap-1 text-sm ${ratingColor(avg)}`}>
              <Star className="w-4 h-4 fill-current" />
              Avg Score: {avg.toFixed(1)}
            </span>
          );
        })()}
      </div>

      {/* Episode list */}
      <div className="space-y-3">
        {contentType === 'tv'
          ? tvEpisodes.map(ep => renderTvEpisode(ep))
          : animeEpisodes
              .filter(ep => {
                if (epFilter === 'all') return true;
                if (epFilter === 'canon') return !ep.filler && !ep.recap;
                if (epFilter === 'filler') return ep.filler;
                if (epFilter === 'recap') return ep.recap;
                return true;
              })
              .map(ep => renderAnimeEpisode(ep))
        }
      </div>

      {/* Load more for anime */}
      {contentType === 'anime' && animeHasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchAnimeEpisodes(animePage + 1, true)}
            disabled={loading}
            className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/15 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Loading...' : 'Load More Episodes'}
          </button>
        </div>
      )}

      {/* Season Trailer Modal */}
      <AnimatePresence>
        {showSeasonTrailer && seasonData?.trailerUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-2 sm:p-8"
            onClick={() => setShowSeasonTrailer(false)}
          >
            <div className="w-full max-w-6xl flex items-center justify-end mb-2 sm:mb-4 px-1">
              <button
                onClick={() => setShowSeasonTrailer(false)}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <span className="text-sm">Close</span>
                <X className="w-7 h-7" />
              </button>
            </div>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full max-w-6xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={seasonData.trailerUrl}
                title={`Season ${activeSeason} Trailer`}
                className="w-full h-full rounded-lg sm:rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
