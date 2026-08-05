import { useEffect, useState, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Library, Search, Plus, Grid3X3, List, Star, Clock, Calendar, Eye, Film, Tv, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ContentCard from "../components/ContentCard";
import { GenreTabs } from "../components/ContentCarousel";
import type { LibraryEntry } from "../types.ts";
import { transformApiResponse } from "../types.ts";
import { getLibrary, upsertLibrary, removeFromLibrary } from "../api/libraryApi";
import type { UpsertPayload } from "../api/libraryApi";
import type { LibraryApiRow } from "../api/libraryApi";
import { useAuth } from "../auth/AuthContext";
import type { ContentItem } from "../api/discoverApi";

const STATUS_MAP = {
  all: "All",
  watchlist: "Plan to Watch",
  watching: "Watching", 
  completed: "Completed",
  dropped: "Dropped",
  "on-hold": "On-Hold",
  liked: "Liked"
};

const STATUS_COLORS: Record<string, { text: string; bg: string; icon: LucideIcon }> = {
  "All": {
    text: "text-slate-300",
    bg: "bg-slate-500/10",
    icon: Library
  },
  "Plan to Watch": { 
    text: "text-purple-400", 
    bg: "bg-purple-500/10", 
    icon: Plus 
  },
  "Watching": { 
    text: "text-blue-400", 
    bg: "bg-blue-500/10", 
    icon: Eye 
  },
  "Completed": { 
    text: "text-emerald-400", 
    bg: "bg-emerald-500/10", 
    icon: Star 
  },
  "Dropped": { 
    text: "text-red-400", 
    bg: "bg-red-500/10", 
    icon: Clock 
  },
  "On-Hold": { 
    text: "text-amber-400", 
    bg: "bg-amber-500/10", 
    icon: Calendar 
  },
  "Liked": {
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    icon: Star
  }
};

const SORT_OPTIONS = [
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'rating', label: 'Rating' },
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'lastUpdated', label: 'Last Updated' }
];

const VIEW_MODES = [
  { value: 'grid', label: 'Grid', icon: Grid3X3 },
  { value: 'list', label: 'List', icon: List }
];

export default function LibraryPage() {
  const location = useLocation();
  const { status } = useParams<{ status: string }>();
  const navigate = useNavigate();
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredLibrary, setFilteredLibrary] = useState<LibraryEntry[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const { token, userKey } = useAuth();
  
  const currentStatusKey = status || "watchlist";
  const currentStatus = STATUS_MAP[currentStatusKey as keyof typeof STATUS_MAP] || "Plan to Watch";
  const statusTitle = currentStatusKey.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const statusConfig = STATUS_COLORS[currentStatus];
  const matchesCurrentStatus = (entry: LibraryEntry) =>
    currentStatusKey === "all" || entry.status === currentStatusKey;

  // Load library
  useEffect(() => {
    async function loadLibrary() {
      if (!token) return;
      try {
        const apiLib: LibraryApiRow[] = await getLibrary(token);
        const lib = apiLib.map((entry: LibraryApiRow) => transformApiResponse(entry));
        setLibrary(lib);
        
      } catch (error) {
        console.warn("Failed to load library:", error);
        setLibrary([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadLibrary();
  }, [token]);

  // Filter and sort library entries
  useEffect(() => {
    let filtered = library.filter(matchesCurrentStatus);

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(entry => entry.type === selectedType);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title?.toLowerCase().includes(query) ||
        entry.originalTitle?.toLowerCase().includes(query) ||
        entry.genre?.toLowerCase().includes(query)
      );
    }

    // Apply genre filter — match individual genres, not substring
    if (selectedGenre) {
      filtered = filtered.filter(entry => {
        const entryGenres = entry.genre?.split(',').map(g => g.trim().toLowerCase()) || [];
        return entryGenres.includes(selectedGenre.toLowerCase());
      });
    }

    // Sort entries
    filtered.sort((a, b) => {
      let aVal: string | number = a[sortBy as keyof LibraryEntry] as string | number;
      let bVal: string | number = b[sortBy as keyof LibraryEntry] as string | number;
      
      if (sortBy === 'title') {
        aVal = (a.title || a.originalTitle || '').toLowerCase();
        bVal = (b.title || b.originalTitle || '').toLowerCase();
      } else if (sortBy === 'rating') {
        aVal = a.score || 0;
        bVal = b.score || 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredLibrary(filtered);

    // Extract genres only from entries in the current status tab (and type)
    let statusEntries = library.filter(matchesCurrentStatus);
    if (selectedType !== 'all') {
      statusEntries = statusEntries.filter(entry => entry.type === selectedType);
    }
    const allGenres = statusEntries
      .filter(entry => entry.genre)
      .flatMap(entry => entry.genre?.split(',').map(g => g.trim()) || []);
    const uniqueGenres = [...new Set(allGenres)].filter(Boolean).sort();
    setGenres(uniqueGenres);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, currentStatusKey, searchQuery, selectedGenre, selectedType, sortBy, sortOrder]);

  // Handle search queries via custom event
  useEffect(() => {
    function handleSearch(e: Event) {
      const query = (e as CustomEvent).detail || "";
      setSearchQuery(query);
    }

    window.addEventListener("sv:search", handleSearch);
    return () => window.removeEventListener("sv:search", handleSearch);
  }, []);

  const updateLibrary = useCallback(async (entry: LibraryEntry) => {
    if (!token) return;
    
    try {
      // Determine the correct source based on the content type
      const sourceMap: Record<string, string> = {
        movie: 'TMDB_MOVIE',
        tv: 'TMDB_TV',
        anime: 'MAL_ANIME',
      };
      const payload: UpsertPayload = {
        externalId: entry.id,
        source: entry.source || sourceMap[entry.type || 'movie'] || 'TMDB_MOVIE',
        type: (entry.type as UpsertPayload['type']) || "movie",
        title: entry.title,
        year: entry.year,
        episodes: entry.episodes,
        seasons: entry.seasons,
        posterUrl: entry.posterUrl,
        backdropUrl: entry.backdropUrl,
        genresCsv: entry.genre,
        status: (entry.status.replace("-", "_") as UpsertPayload['status']),
        userRating: entry.score ?? undefined,
        notes: entry.notes
      };
      const updated = await upsertLibrary(token, payload);
      const updatedEntry = transformApiResponse(updated);
      
      setLibrary(prev => {
        const filtered = prev.filter(e => e.id !== updatedEntry.id);
        return [...filtered, updatedEntry];
      });
    } catch (error) {
      console.warn("Failed to update library entry:", error);
    }
  }, [token]);

  const removeEntry = useCallback(async (contentId: string) => {
    if (!token || !contentId) return;
    
    try {
      await removeFromLibrary(token, contentId);
      setLibrary(prev => prev.filter(e => e.contentId !== contentId));
    } catch (error) {
      console.warn("Failed to remove library entry:", error);
    }
  }, [token]);

  // Convert LibraryEntry to ContentItem for ContentCard
  const libraryToContentItem = (entry: LibraryEntry): ContentItem => ({
    externalId: entry.id,
    title: entry.title || entry.originalTitle || 'Unknown Title',
    originalTitle: entry.originalTitle,
    overview: entry.notes || '',
    posterPath: entry.posterUrl || entry.backdropUrl || '',
    backdropPath: entry.backdropUrl || entry.posterUrl || '',
    releaseDate: entry.year?.toString() || '',
    voteAverage: entry.score || 0,
    voteCount: 0,
    popularity: 0,
    genreIds: [],
    genres: entry.genre ? entry.genre.split(',').map(g => g.trim()) : [],
    source: 'library' as const,
    type: (entry.type as ContentItem['type']) || 'movie'
  });

  const handleContentClick = (content: ContentItem) => {
    // Determine content type and navigate to details
    let contentType = 'movie';
    if (content.type === 'anime') contentType = 'anime';
    else if (content.type === 'tv') contentType = 'tv';
    
    navigate(`/content/${contentType}/${content.externalId}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  const handleStatusChange = useCallback((entry: LibraryEntry, newStatus: string) => {
    const updated = { ...entry, status: newStatus.replace('_', '-') };
    updateLibrary(updated);
  }, [updateLibrary]);

  const handleRemove = useCallback((contentId: string) => {
    removeEntry(contentId);
  }, [removeEntry]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1014] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#FFC562]"></div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFD48C]/72">Loading Library</p>
        </div>
      </div>
    );
  }

  const Icon = statusConfig.icon;

  return (
    <div className="library-page page-shell min-h-screen bg-[#0F1014]">
      <div className="mx-auto w-full max-w-[1480px] px-3 sm:px-6 py-3 sm:py-8 stagger-rise">
        <div className="space-y-6 sm:space-y-8">
          {/* Header Section */}
          <div>
            <div className="library-hero-panel p-4 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="premium-kicker">Collection Room</span>
                <span className="premium-chip border-white/10 bg-white/[0.04] text-white/68">{currentStatus}</span>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className={`${statusConfig.bg} ${statusConfig.text} rounded-[18px] border border-white/10 p-2.5 shadow-[0_14px_30px_rgba(0,0,0,0.2)] sm:p-3`}>
                  <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h1 className="section-heading text-[1.45rem] sm:text-4xl text-[#FFF7EA] tracking-tight">
                    {statusTitle}
                  </h1>
                  <p className="text-[#C8BCA9]/62 text-sm mt-1">
                    {filteredLibrary.length} {filteredLibrary.length === 1 ? 'title' : 'titles'}
                  </p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-5 md:gap-6">
                {Object.entries(STATUS_MAP).map(([key, statusValue]) => {
                  const count = library.filter(e => e.status === key).length;
                  const config = STATUS_COLORS[statusValue];
                  const StatusIcon = config.icon;
                  
                  return (
                    <div
                      key={key}
                      onClick={() => navigate(userKey ? `/app/${userKey}/library/${key}` : '/auth')}
                      className={`library-status-card ${config.bg} rounded-[20px] border border-white/10 p-2.5 sm:p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:brightness-125 ${
                        currentStatusKey === key ? 'ring-1 ring-[#FFC562]/28 shadow-[0_14px_32px_rgba(255,149,87,0.12)]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <StatusIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.text}`} />
                        <div>
                          <p className="text-lg sm:text-2xl font-bold text-white">{count}</p>
                          <p className={`library-status-label text-xs sm:text-sm ${config.text}`}>
                            {statusValue}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filters and Controls */}
          <div>
            <div className="library-filter-panel p-3 sm:p-6">
              {/* Type Filter Tabs */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { value: 'all', label: 'All', icon: Library },
                  { value: 'movie', label: 'Movies', icon: Film },
                  { value: 'tv', label: 'TV', icon: Tv },
                  { value: 'anime', label: 'Anime', icon: Sparkles },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  const count = library.filter(e => matchesCurrentStatus(e) && (tab.value === 'all' || e.type === tab.value)).length;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => { setSelectedType(tab.value); setSelectedGenre(''); }}
                      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                        selectedType === tab.value
                          ? 'bg-[linear-gradient(135deg,#ffd7a0_0%,#ffb45f_52%,#ff7f56_100%)] text-[#0b0d12] shadow-[0_12px_32px_rgba(255,149,87,0.2)]'
                          : 'bg-[#1C1E24] text-[#AAB2C0] hover:text-[#E5E5E5] hover:bg-[#25272E] border border-white/10'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {tab.label}
                      <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full ${
                        selectedType === tab.value ? 'bg-black/20' : 'bg-[#2A2D35]'
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-6">
                {/* Search */}
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-[#808080]" />
                    <input
                      type="text"
                      placeholder="Search your library..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-[20px] border border-white/10 bg-[#1C1E24] py-2.5 pl-10 pr-4 text-sm text-[#E5E5E5] placeholder-[#808080]/60 transition-all focus:border-[#5AD3FF]/30 focus:ring-1 focus:ring-[#5AD3FF]/20 focus:outline-none sm:py-3 sm:text-base"
                    />
                  </div>
                </div>

                {/* Sort Options */}
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:gap-3">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-[18px] border border-white/10 bg-[#1C1E24] px-3 py-2 text-sm text-[#E5E5E5] focus:border-[#5AD3FF]/30 focus:outline-none sm:flex-none"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        Sort by {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="h-10 rounded-[18px] border border-white/10 bg-[#1C1E24] px-3 py-2 text-sm text-[#E5E5E5] transition-all hover:bg-[#25272E]"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>

                  {/* View Mode Toggle */}
                  <div className="flex h-10 rounded-[18px] border border-white/10 bg-[#1C1E24] p-1">
                    {VIEW_MODES.map(mode => {
                      const ModeIcon = mode.icon;
                      return (
                        <button
                          key={mode.value}
                          onClick={() => setViewMode(mode.value as 'grid' | 'list')}
                          className={`p-2 rounded-md text-sm transition-all ${
                            viewMode === mode.value
                              ? 'bg-[linear-gradient(135deg,#ffd7a0_0%,#ffb45f_52%,#ff7f56_100%)] text-[#0b0d12]'
                              : 'text-[#808080] hover:text-[#E5E5E5]'
                          }`}
                        >
                          <ModeIcon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Genre Filter */}
              {genres.length > 0 && (
                <div className="mt-4">
                  <GenreTabs
                    genres={genres}
                    activeGenre={selectedGenre}
                    onGenreChange={(genre) => setSelectedGenre(selectedGenre === genre ? '' : genre)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Content Grid/List */}
          <div>
            {filteredLibrary.length > 0 ? (
              <div className={`grid gap-2 sm:gap-4 md:gap-6 ${
                viewMode === 'grid' 
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
                  : 'grid-cols-1 lg:grid-cols-2'
              }`}>
                {filteredLibrary.map((entry) => (
                  <ContentCard
                    key={entry.id}
                    content={libraryToContentItem(entry)}
                    size="medium"
                    onClick={handleContentClick}
                    currentStatus={(currentStatusKey === 'all' ? entry.status : currentStatusKey).replace('-', '_')}
                    onStatusChange={(newStatus) => handleStatusChange(entry, newStatus)}
                    onRemove={() => handleRemove(entry.contentId!)}
                  />
                ))}
              </div>
            ) : (
              <div className="library-empty-state py-16 text-center">
                <Library className="mx-auto mb-4 h-16 w-16 text-[#2A2D35]" />
                <h3 className="mb-2 text-lg font-medium text-[#E5E5E5]">No content found</h3>
                <p className="text-sm text-[#808080]">
                  {searchQuery || selectedGenre 
                    ? 'Try adjusting your search or filters'
                    : `Your ${statusTitle.toLowerCase()} is empty`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}