import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Filter, ArrowLeft, Home, CheckCircle, Users, Globe2, Heart, Sparkles } from 'lucide-react';
import HeroBanner from '../components/HeroBanner';
import ContentCard from '../components/ContentCard';
import NewsSection from '../components/NewsSection';
import ContentCarousel, { MultiContentCarousel } from '../components/ContentCarousel';
import PersonProfileModal from '../components/PersonProfileModal';
import { 
  discoverApi, 
  type ContentItem, 
  type SearchParams,
  type ContentType,
  type NewsItem,
  type PersonSearchItem,
  type RecommendationSeedItem
} from '../api/discoverApi';
import { useAuth } from '../auth/AuthContext';
import { upsertLibrary, type UpsertPayload } from '../api/libraryApi';

export default function DiscoverPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, userKey } = useAuth();
  const appRoot = userKey ? `/app/${userKey}` : '/auth';
  const [searchParams, setSearchParams] = useSearchParams();
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchMode, setSearchMode] = useState<'content' | 'people'>('content');
  const [indianPeopleOnly, setIndianPeopleOnly] = useState(true);
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [personResults, setPersonResults] = useState<PersonSearchItem[]>([]);
  const [contentType, setContentType] = useState<ContentType>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [genreResults, setGenreResults] = useState<ContentItem[]>([]);
  const [isLoadingGenre, setIsLoadingGenre] = useState(false);
  const [genrePage, setGenrePage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreGenre, setHasMoreGenre] = useState(true);

  // Content sections data
  const [heroContent, setHeroContent] = useState<ContentItem[]>([]);
  const [trendingContent, setTrendingContent] = useState<ContentItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<ContentItem[]>([]);
  const [popularTVShows, setPopularTVShows] = useState<ContentItem[]>([]);
  const [popularAnime, setPopularAnime] = useState<ContentItem[]>([]);
  const [nowAiringAnime, setNowAiringAnime] = useState<ContentItem[]>([]);
  const [upcomingAnime, setUpcomingAnime] = useState<ContentItem[]>([]);
  const [topRankedAnime, setTopRankedAnime] = useState<ContentItem[]>([]);
  const [activeAnimeFeed, setActiveAnimeFeed] = useState<'now' | 'upcoming' | 'top' | 'popular'>('now');
  const [topRatedContent, setTopRatedContent] = useState<ContentItem[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [trendingIndia, setTrendingIndia] = useState<ContentItem[]>([]);
  const [hindiContent, setHindiContent] = useState<ContentItem[]>([]);
  const [teluguContent, setTeluguContent] = useState<ContentItem[]>([]);
  const [tamilContent, setTamilContent] = useState<ContentItem[]>([]);
  const [malayalamContent, setMalayalamContent] = useState<ContentItem[]>([]);
  const [kannadaContent, setKannadaContent] = useState<ContentItem[]>([]);
  const [recommendedContent, setRecommendedContent] = useState<ContentItem[]>([]);
  const [likedRecommendedContent, setLikedRecommendedContent] = useState<ContentItem[]>([]);
  const [likedRecommendationSeed, setLikedRecommendationSeed] = useState<RecommendationSeedItem[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    hero: true,
    trending: true,
    popular: true,
    topRated: true,
    topRankedAnime: true,
    genres: true,
    india: true,
    recommended: true,
    news: true
  });

  // Listen for search events from AppShell search bar
  useEffect(() => {
    const handler = (e: Event) => {
      setSearchQuery((e as CustomEvent<string>).detail);
    };
    window.addEventListener('sv:search', handler);
    return () => window.removeEventListener('sv:search', handler);
  }, []);

  // Sync search query to URL params so back navigation restores search
  useEffect(() => {
    if (searchQuery) {
      setSearchParams({ q: searchQuery }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [searchQuery, setSearchParams]);

  // Fetch initial data — batched to avoid TMDB rate limits
  useEffect(() => {
    let cancelled = false;

    const fetchDiscoverData = async () => {
      try {
        // Batch 1: Core content (trending + popular)
        const [trendingRes, moviesRes, tvRes, animeRes] = await Promise.allSettled([
          discoverApi.getTrending('all'),
          discoverApi.getPopular('movie'),
          discoverApi.getPopular('tv'),
          discoverApi.getPopular('anime'),
        ]);

        if (cancelled) return;

        if (trendingRes.status === 'fulfilled') {
          setHeroContent(trendingRes.value.slice(0, 5));
          setTrendingContent(trendingRes.value);
        }
        setLoadingStates(prev => ({ ...prev, hero: false, trending: false }));

        if (moviesRes.status === 'fulfilled') setPopularMovies(moviesRes.value);
        if (tvRes.status === 'fulfilled') setPopularTVShows(tvRes.value);
        if (animeRes.status === 'fulfilled') setPopularAnime(animeRes.value);
        setLoadingStates(prev => ({ ...prev, popular: false }));

        // Batch 2: Top rated + anime + genres
        const [topRatedRes, topAnimeRes, upcomingAnimeRes, nowAiringAnimeRes, movieGenresRes, tvGenresRes, animeGenresRes] = await Promise.allSettled([
          discoverApi.getTopRated('all'),
          discoverApi.getTopRankedAnime(1, 20),
          discoverApi.getUpcomingAnime(1),
          discoverApi.getNowAiringAnime(1),
          discoverApi.getGenres('movie'),
          discoverApi.getGenres('tv'),
          discoverApi.getGenres('anime'),
        ]);

        if (cancelled) return;

        if (topRatedRes.status === 'fulfilled') setTopRatedContent(topRatedRes.value);
        setLoadingStates(prev => ({ ...prev, topRated: false }));

        if (topAnimeRes.status === 'fulfilled') setTopRankedAnime(topAnimeRes.value);
        if (upcomingAnimeRes.status === 'fulfilled') setUpcomingAnime(upcomingAnimeRes.value);
        if (nowAiringAnimeRes.status === 'fulfilled') setNowAiringAnime(nowAiringAnimeRes.value);
        setLoadingStates(prev => ({ ...prev, topRankedAnime: false }));

        const movieGenres = movieGenresRes.status === 'fulfilled' ? movieGenresRes.value : [];
        const tvGenres = tvGenresRes.status === 'fulfilled' ? tvGenresRes.value : [];
        const animeGenres = animeGenresRes.status === 'fulfilled' ? animeGenresRes.value : [];
        const allGenres = [...new Set([...movieGenres, ...tvGenres, ...animeGenres])].sort();
        setGenres(allGenres);
        setLoadingStates(prev => ({ ...prev, genres: false }));

        // Batch 3: Indian/regional content
        const [trendingIndiaRes, hindiRes, teluguRes, tamilRes, malayalamRes, kannadaRes] = await Promise.allSettled([
          discoverApi.getTrendingIndia('movie'),
          discoverApi.getByLanguage('hi'),
          discoverApi.getByLanguage('te'),
          discoverApi.getByLanguage('ta'),
          discoverApi.getByLanguage('ml'),
          discoverApi.getByLanguage('kn'),
        ]);

        if (cancelled) return;

        if (trendingIndiaRes.status === 'fulfilled') setTrendingIndia(trendingIndiaRes.value);
        if (hindiRes.status === 'fulfilled') setHindiContent(hindiRes.value);
        if (teluguRes.status === 'fulfilled') setTeluguContent(teluguRes.value);
        if (tamilRes.status === 'fulfilled') setTamilContent(tamilRes.value);
        if (malayalamRes.status === 'fulfilled') setMalayalamContent(malayalamRes.value);
        if (kannadaRes.status === 'fulfilled') setKannadaContent(kannadaRes.value);
        setLoadingStates(prev => ({ ...prev, india: false }));

        // Batch 4: Personalized recommendations + News
        const [recsRes, newsRes] = await Promise.allSettled([
          discoverApi.getRecommendations(undefined, 1),
          discoverApi.getNews(),
        ]);

        const likedRecs = token
          ? await discoverApi.getRecommendationsFromLiked(token).catch(() => ({ items: [], basedOn: [] }))
          : { items: [], basedOn: [] as RecommendationSeedItem[] };

        if (cancelled) return;

        if (recsRes.status === 'fulfilled') setRecommendedContent(recsRes.value);
        if (newsRes.status === 'fulfilled') setNewsItems(newsRes.value);
        setLikedRecommendedContent(likedRecs.items ?? []);
        setLikedRecommendationSeed(likedRecs.basedOn ?? []);
        setLoadingStates(prev => ({ ...prev, recommended: false, news: false }));
      } catch (err) {
        console.error('DiscoverPage fetch error:', err);
        if (!cancelled) {
          setLoadingStates({ hero: false, trending: false, popular: false, topRated: false, topRankedAnime: false, genres: false, india: false, recommended: false, news: false });
        }
      }
    };

    fetchDiscoverData();

    return () => { cancelled = true; };
  }, [token]);

  // Handle search with abort controller
  useEffect(() => {
    const controller = new AbortController();

    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setPersonResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        if (searchMode === 'people') {
          const people = await discoverApi.searchPeople(searchQuery, 1, 12, indianPeopleOnly);
          if (!controller.signal.aborted) {
            setPersonResults(people);
            setSearchResults([]);
          }
        } else {
          const params: SearchParams = {
            query: searchQuery,
            type: contentType !== 'all' ? contentType : undefined,
          };
          const results = await discoverApi.search(params);
          if (!controller.signal.aborted) {
            const animeIntent = /\banime|manga|otaku|shounen|shonen|isekai|mecha|waifu|senpai\b/i.test(searchQuery);
            const ranked = [...results].sort((a, b) => {
              const aPoster = a.posterPath ? 1 : 0;
              const bPoster = b.posterPath ? 1 : 0;
              const aAnimeBoost = animeIntent && a.type === 'anime' ? 2 : 0;
              const bAnimeBoost = animeIntent && b.type === 'anime' ? 2 : 0;
              const aScore = aAnimeBoost + aPoster + (a.voteAverage > 0 ? 1 : 0);
              const bScore = bAnimeBoost + bPoster + (b.voteAverage > 0 ? 1 : 0);
              if (bScore !== aScore) return bScore - aScore;
              return (b.voteAverage || 0) - (a.voteAverage || 0);
            });

            setSearchResults(ranked);
            setPersonResults([]);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Search failed:', error);
          setSearchResults([]);
          setPersonResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    const timeoutId = setTimeout(performSearch, 350);
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [searchQuery, contentType, searchMode, indianPeopleOnly]);

  // Fetch content when genre is selected
  useEffect(() => {
    if (!selectedGenre) {
      setGenreResults([]);
      setGenrePage(1);
      setHasMoreGenre(true);
      return;
    }

    const fetchGenreContent = async () => {
      setIsLoadingGenre(true);
      setGenrePage(1);
      setHasMoreGenre(true);
      try {
        const results = await discoverApi.browseByGenre(
          selectedGenre,
          contentType !== 'all' ? contentType : undefined,
          1,
        );
        setGenreResults(results);
        if (results.length === 0) setHasMoreGenre(false);
      } catch (error) {
        console.error('Failed to fetch genre content:', error);
        setGenreResults([]);
      } finally {
        setIsLoadingGenre(false);
      }
    };

    fetchGenreContent();
  }, [selectedGenre, contentType]);

  const loadMoreGenre = async () => {
    const nextPage = genrePage + 1;
    setIsLoadingMore(true);
    try {
      const results = await discoverApi.browseByGenre(
        selectedGenre,
        contentType !== 'all' ? contentType : undefined,
        nextPage,
      );
      if (results.length === 0) {
        setHasMoreGenre(false);
      } else {
        setGenreResults(prev => [...prev, ...results]);
        setGenrePage(nextPage);
      }
    } catch (error) {
      console.error('Failed to load more genre content:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleContentClick = useCallback((content: ContentItem) => {
    let contentType = 'movie';
    
    if (content.source === 'jikan' || content.type === 'anime') {
      contentType = 'anime';
    } else if (content.type === 'tv') {
      contentType = 'tv';
    }
    
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
      const statusLabel = {
        watchlist: 'Plan to Watch',
        watching: 'Watching',
        completed: 'Completed',
        liked: 'Liked',
        on_hold: 'On Hold',
        dropped: 'Dropped',
      }[status] ?? status;
      setAddedToast(`"${content.title}" added to ${statusLabel}`);
      setTimeout(() => setAddedToast(null), 3000);
    } catch (error: unknown) {
      console.error('Failed to add to library:', error);
      setAddedToast(`Error: ${error instanceof Error ? error.message : 'Failed to add'}`);
      setTimeout(() => setAddedToast(null), 4000);
    }
  }, [token, navigate]);

  const carouselSections = useMemo(() => [
    ...(likedRecommendedContent.length > 0 ? [{
      title: "Because You Liked",
      contents: likedRecommendedContent,
      isLoading: loadingStates.recommended
    }] : []),
    {
      title: "Trending Now",
      contents: trendingContent,
      isLoading: loadingStates.trending
    },
    {
      title: "Popular Anime",
      contents: popularAnime,
      isLoading: loadingStates.popular
    },
    {
      title: "Upcoming Anime Releases",
      contents: upcomingAnime,
      isLoading: loadingStates.topRankedAnime
    },
    ...(topRankedAnime.length > 0 ? [{
      title: "Top Ranked Anime (AnimeDB)",
      contents: topRankedAnime,
      isLoading: loadingStates.topRankedAnime
    }] : []),
    ...(recommendedContent.length > 0 ? [{
      title: "Recommended For You",
      contents: recommendedContent,
      isLoading: loadingStates.recommended
    }] : []),
    {
      title: "Trending in India",
      contents: trendingIndia,
      isLoading: loadingStates.india
    },
    {
      title: "Popular Movies", 
      contents: popularMovies,
      isLoading: loadingStates.popular
    },
    {
      title: "Popular TV Shows",
      contents: popularTVShows, 
      isLoading: loadingStates.popular
    },
    {
      title: "🎬 Hindi (Bollywood)",
      contents: hindiContent,
      isLoading: loadingStates.india
    },
    {
      title: "🎬 Telugu (Tollywood)",
      contents: teluguContent,
      isLoading: loadingStates.india
    },
    {
      title: "🎬 Tamil (Kollywood)",
      contents: tamilContent,
      isLoading: loadingStates.india
    },
    {
      title: "🎬 Malayalam",
      contents: malayalamContent,
      isLoading: loadingStates.india
    },
    {
      title: "🎬 Kannada (Sandalwood)",
      contents: kannadaContent,
      isLoading: loadingStates.india
    },
    {
      title: "Top Rated",
      contents: topRatedContent,
      isLoading: loadingStates.topRated
    },
  ], [likedRecommendedContent, trendingContent, recommendedContent, trendingIndia, hindiContent, teluguContent, tamilContent, malayalamContent, kannadaContent, popularMovies, popularTVShows, popularAnime, upcomingAnime, topRatedContent, topRankedAnime, loadingStates]);

  const priorityCarouselSections = useMemo(
    () => carouselSections.filter((section) => (
      section.title === 'Popular Movies'
      || section.title === 'Popular TV Shows'
      || section.title === 'Trending Now'
      || section.title === 'Popular Anime'
      || section.title === 'Upcoming Anime Releases'
      || section.title === 'Top Ranked Anime (AnimeDB)'
    )),
    [carouselSections],
  );

  const secondaryCarouselSections = useMemo(
    () => carouselSections.filter((section) => !priorityCarouselSections.some((priority) => priority.title === section.title)),
    [carouselSections, priorityCarouselSections],
  );

  const animeHubSections = useMemo(() => ({
    now: nowAiringAnime,
    upcoming: upcomingAnime,
    top: topRankedAnime,
    popular: popularAnime,
  }), [nowAiringAnime, upcomingAnime, topRankedAnime, popularAnime]);

  return (
    <div className="discover-page page-shell min-h-screen bg-[#0F1014] pt-11 sm:pt-16 md:pt-20 pb-20 md:pb-8">


      {/* Hero Banner - show skeleton while loading, hidden when searching */}
      {!searchQuery && loadingStates.hero && (
        <HeroBanner
          contents={[]}
          className="mb-6 sm:mb-12"
        />
      )}
      {!searchQuery && heroContent.length > 0 && !loadingStates.hero && (
        <HeroBanner
          contents={heroContent}
          onContentClick={handleContentClick}
          onAddToLibrary={handleAddToLibrary}
          onMoreInfo={handleContentClick}
          className="mb-6 sm:mb-12"
        />
      )}

      <div className="mx-auto max-w-[1480px] px-3 sm:px-6 py-2 sm:py-8 space-y-5 sm:space-y-14 stagger-rise">
        <div className="space-y-4 sm:space-y-12">
          {/* Header & Search */}
          <div className="text-center">
            {!searchQuery && (
              <>
                <div className="mx-auto mb-3 max-w-6xl premium-panel px-3 py-3 sm:mb-6 sm:px-6 sm:py-5">
                  <div className="flex flex-col items-center justify-center gap-2 sm:gap-4">
                    <span className="premium-kicker">Curated Daily</span>
                    <h1 className="section-heading text-[1.95rem] sm:text-5xl md:text-6xl text-[#F7F1E8]">
                      Discover
                    </h1>
                    <p className="text-[#A8B2C1] text-xs sm:text-sm uppercase tracking-[0.22em]">
                      Streaming Intelligence Board
                    </p>
                  </div>
                </div>
                <p className="text-[#98A2B3] text-xs sm:text-base mb-3 sm:mb-8 max-w-3xl mx-auto leading-relaxed hidden sm:block">
                  A cinematic board of trending movies, TV, anime, and fast-moving headlines with a sharper, more premium streaming-portal feel.
                </p>

                {/* Content Type Filter */}
                <div className="max-w-5xl mx-auto">
                  <div className="premium-panel p-3.5 sm:p-5 lg:p-6 space-y-3 sm:space-y-4 overflow-hidden">
                    <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide flex-nowrap sm:flex-wrap justify-start sm:justify-center pb-1">
                      {(['all', 'movie', 'tv', 'anime'] as ContentType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => setContentType(type)}
                          className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-[0.14em] transition-all ${
                            contentType === type
                              ? 'bg-[linear-gradient(135deg,#ffd7a0_0%,#ffb45f_52%,#ff7f56_100%)] text-[#0b0d12] shadow-[0_12px_32px_rgba(255,149,87,0.2)]'
                              : 'border border-white/10 bg-[#0d1118]/78 text-[#98a2b3] hover:bg-[#111722] hover:text-[#F7F1E8]'
                          }`}
                        >
                          {type === 'all' ? 'All Content' : 
                           type === 'tv' ? 'TV Shows' : 
                           type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#98A2B3] sm:text-xs">
                      <span className="premium-chip bg-white/[0.03] text-[#F7F1E8]">
                        <Sparkles className="h-3.5 w-3.5 text-[#FFD48C]" />
                        Movies and TV are pinned below
                      </span>
                      {!loadingStates.genres && genres.length > 0 && (
                        <button
                          onClick={() => document.getElementById('discover-genre-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="premium-chip bg-white/[0.03] text-[#A7B0BE] hover:text-[#F7F1E8] transition-colors"
                        >
                          Browse all genres
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div>
              <div className="premium-panel mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide px-3 py-3 sm:gap-3 sm:px-5">
                <button
                  onClick={() => setSearchMode('content')}
                  className={`premium-chip ${searchMode === 'content' ? 'bg-[#ffc562] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
                >
                  <Search className="w-3.5 h-3.5" /> Content
                </button>
                <button
                  onClick={() => setSearchMode('people')}
                  className={`premium-chip ${searchMode === 'people' ? 'bg-[#ffc562] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
                >
                  <Users className="w-3.5 h-3.5" /> People
                </button>
                {searchMode === 'people' && (
                  <button
                    onClick={() => setIndianPeopleOnly(v => !v)}
                    className={`premium-chip ${indianPeopleOnly ? 'bg-[#ff8b5d] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
                  >
                    <Globe2 className="w-3.5 h-3.5" /> Indian Celebrities
                  </button>
                )}
              </div>

              {searchMode === 'content' && (
                <div className="premium-panel mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5 sm:px-5">
                  {(['all', 'movie', 'tv', 'anime'] as ContentType[]).map((type) => (
                    <button
                      key={`search-filter-${type}`}
                      onClick={() => setContentType(type)}
                      className={`premium-chip whitespace-nowrap ${contentType === type ? 'bg-[#ffc562] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
                    >
                      {type === 'all' ? 'All' : type === 'tv' ? 'TV' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {isSearching ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#808080] mx-auto mb-4"></div>
                  <p className="text-[#808080]">Searching {searchMode === 'people' ? 'people' : 'content'} for "{searchQuery}"...</p>
                </div>
              ) : searchMode === 'people' && personResults.length > 0 ? (
                <div>
                  <div className="premium-panel mb-6 flex flex-col items-start gap-3 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-5">
                    <button
                      onClick={() => { setSearchQuery(''); navigate(appRoot); }}
                      className="premium-button-secondary flex items-center gap-2 px-4 py-2.5 text-[#A7B0BE] hover:text-[#F7F1E8] transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <h2 className="section-heading text-xl sm:text-3xl text-[#F7F1E8] break-words">
                      People Results ({personResults.length})
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {personResults.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => setSelectedPersonId(person.id)}
                        className="premium-panel text-left p-4 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex gap-3">
                          <img
                            src={person.profilePath ?? 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22220%22%3E%3Crect width=%22150%22 height=%22220%22 fill=%22%231a1a2e%22/%3E%3C/svg%3E'}
                            alt={person.name}
                            className="w-16 h-24 object-cover rounded-md border border-white/10"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[#F7F1E8] font-semibold truncate">{person.name}</p>
                            {person.knownForDepartment && (
                              <p className="text-xs text-[#A7B0BE] mt-0.5">{person.knownForDepartment}</p>
                            )}
                            {person.placeOfBirth && (
                              <p className="text-[11px] text-[#808080] mt-1 truncate">{person.placeOfBirth}</p>
                            )}
                            {person.biography && (
                              <p className="text-xs text-[#808080] mt-2 line-clamp-3">{person.biography}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : searchMode === 'content' && searchResults.length > 0 ? (
                <div>
                  <div className="premium-panel mb-6 flex flex-col items-start gap-3 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-5">
                    <button
                      onClick={() => { setSearchQuery(''); navigate(appRoot); }}
                      className="premium-button-secondary flex items-center gap-2 px-4 py-2.5 text-[#A7B0BE] hover:text-[#F7F1E8] transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <h2 className="section-heading text-xl sm:text-3xl text-[#F7F1E8] break-words">
                      Search Results for "{searchQuery}" ({searchResults.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
                    {searchResults.map((content) => (
                      <ContentCard
                        key={`${content.source}-${content.externalId}`}
                        content={content}
                        size="medium"
                        onClick={handleContentClick}
                        onAddToLibrary={handleAddToLibrary}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-[#2A2D35] mx-auto mb-4" />
                  <p className="text-[#808080] text-lg">No results found for "{searchQuery}"</p>
                  <p className="text-[#808080]/60 text-sm mt-2">Try a different search term</p>
                  <button
                    onClick={() => { setSearchQuery(''); navigate(appRoot); }}
                    className="premium-button-secondary mt-4 inline-flex items-center gap-2 px-5 py-3 text-[#A7B0BE] hover:text-[#F7F1E8] transition-all cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    Back to Discover
                  </button>
                </div>
              )}
            </div>
          )}

          {!searchQuery && likedRecommendationSeed.length > 0 && (
            <div className="max-w-6xl mx-auto premium-panel px-4 py-4 sm:px-6 sm:py-5">
              <h3 className="text-sm sm:text-base font-semibold text-[#F7F1E8] flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-pink-400" /> Recommendation Seeds (From Liked)
              </h3>
              <div className="flex flex-wrap gap-2">
                {likedRecommendationSeed.slice(0, 10).map((seed) => (
                  <span key={`${seed.type}-${seed.externalId}`} className="premium-chip bg-white/[0.03] text-[#A7B0BE]">
                    {seed.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Genre Results */}
          {!searchQuery && selectedGenre && (
            <div>
              {isLoadingGenre ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#808080] mx-auto mb-4"></div>
                  <p className="text-[#808080]">Loading {selectedGenre} content...</p>
                </div>
              ) : genreResults.length > 0 ? (
                <div>
                  <div className="premium-panel mb-6 flex flex-col items-start justify-between gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-5 sm:py-5">
                    <h2 className="section-heading text-xl sm:text-3xl text-[#F7F1E8]">
                      {selectedGenre} ({genreResults.length})
                    </h2>
                    <button
                      onClick={() => setSelectedGenre('')}
                      className="premium-chip bg-white/[0.03] text-[#A7B0BE] hover:text-white transition-colors"
                    >
                      Clear filter
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
                    {genreResults.map((content) => (
                      <ContentCard
                        key={`${content.source}-${content.externalId}`}
                        content={content}
                        size="medium"
                        onClick={handleContentClick}
                        onAddToLibrary={handleAddToLibrary}
                      />
                    ))}
                  </div>
                  {hasMoreGenre && (
                    <div className="text-center mt-8">
                      <button
                        onClick={loadMoreGenre}
                        disabled={isLoadingMore}
                        className="premium-button-secondary px-6 py-3 text-[#F7F1E8] transition-all disabled:opacity-50"
                      >
                        {isLoadingMore ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Loading...
                          </span>
                        ) : (
                          'Load More'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[#808080] text-lg">No content found for "{selectedGenre}"</p>
                </div>
              )}
            </div>
          )}

          {/* Content Carousels */}
          {!searchQuery && !selectedGenre && (
            <>
              <div className="max-w-6xl mx-auto premium-panel px-4 py-4 sm:px-6 sm:py-6 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <span className="premium-kicker">Jikan Powered</span>
                    <h2 className="section-heading text-xl sm:text-4xl text-[#F7F1E8] mt-2">Anime Hub</h2>
                    <p className="text-[#98A2B3] text-xs sm:text-sm mt-1">Now airing, upcoming, top ranked, and by popularity from Jikan.</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {[
                      { key: 'now', label: 'Now Airing' },
                      { key: 'upcoming', label: 'Upcoming' },
                      { key: 'top', label: 'Top' },
                      { key: 'popular', label: 'By Popularity' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveAnimeFeed(tab.key as 'now' | 'upcoming' | 'top' | 'popular')}
                        className={`premium-chip whitespace-nowrap ${activeAnimeFeed === tab.key ? 'bg-[#ffc562] text-black' : 'bg-white/[0.03] text-[#A7B0BE]'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ContentCarousel
                  title={
                    activeAnimeFeed === 'now'
                      ? 'Now Airing Anime'
                      : activeAnimeFeed === 'upcoming'
                        ? 'Upcoming Anime Releases'
                        : activeAnimeFeed === 'top'
                          ? 'Top Ranked Anime'
                          : 'Popular Anime'
                  }
                  contents={animeHubSections[activeAnimeFeed]}
                  isLoading={loadingStates.popular || loadingStates.topRankedAnime}
                  size="medium"
                  onContentClick={handleContentClick}
                  onAddToLibrary={handleAddToLibrary}
                />
              </div>

              <div>
                <MultiContentCarousel
                  sections={priorityCarouselSections}
                  size="medium"
                  eagerSectionTitles={['Trending Now', 'Popular Movies', 'Popular TV Shows']}
                  onContentClick={handleContentClick}
                  onAddToLibrary={handleAddToLibrary}
                />
              </div>

              {/* Entertainment News Section */}
              {(loadingStates.news || newsItems.length > 0) && (
                <NewsSection news={newsItems} isLoading={loadingStates.news} />
              )}

              <div>
                <MultiContentCarousel
                  sections={secondaryCarouselSections}
                  size="medium"
                  onContentClick={handleContentClick}
                  onAddToLibrary={handleAddToLibrary}
                />
              </div>
            </>
          )}

          {/* Genre Browse Section */}
          {!searchQuery && !selectedGenre && !loadingStates.genres && (
            <div id="discover-genre-grid" className="max-w-6xl mx-auto premium-panel px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
              <h2 className="section-heading text-xl sm:text-4xl text-[#F7F1E8] mb-5 sm:mb-7 tracking-tight flex items-center gap-3">
                <Filter className="w-5 h-5 text-[#FFD48C]" />
                Browse by Genre
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    className="rounded-[14px] border border-white/10 bg-[#0d1118]/78 p-3 sm:p-4 text-center group hover:bg-[#121823] hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
                    onClick={() => setSelectedGenre(genre)}
                  >
                    <span className="text-[#98a2b3] text-sm font-semibold uppercase tracking-[0.16em] group-hover:text-[#F7F1E8] transition-colors">
                      {genre}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-20 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-[22px] premium-panel px-4 py-3 text-[#E5E5E5] md:bottom-6 md:max-w-[90vw] sm:px-5"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium break-words">{addedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <PersonProfileModal
        personId={selectedPersonId}
        onClose={() => setSelectedPersonId(null)}
        onMovieClick={(mediaType, creditId) => {
          setSelectedPersonId(null);
          const normalized = mediaType === 'tv' ? 'tv' : mediaType === 'anime' ? 'anime' : 'movie';
          navigate(`/content/${normalized}/${creditId}`, {
            state: { from: `${location.pathname}${location.search}` }
          });
        }}
      />
    </div>
  );
}