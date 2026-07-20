import React from "react";
import { NavLink, Outlet, useNavigate, useSearchParams, useLocation, useParams, Navigate } from "react-router-dom";
import { Search, LogOut, Compass, Bookmark, Eye, CheckCircle, XCircle, PauseCircle, Activity, Film, Tv, Sparkles, Star, X, Clock, Trash2, Menu, Library, Heart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { discoverApi, type ContentItem, getImageUrl, formatRating, getContentTypeLabel, formatYear, PLACEHOLDER_POSTER } from "../api/discoverApi";

const NAV_ITEMS = [
  { to: "/", label: "Discover", icon: Compass, end: true },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/library/watchlist", label: "Watchlist", icon: Bookmark },
  { to: "/library/watching", label: "Watching", icon: Eye },
  { to: "/library/completed", label: "Completed", icon: CheckCircle },
  { to: "/library/liked", label: "Liked", icon: Heart },
  { to: "/library/dropped", label: "Dropped", icon: XCircle },
  { to: "/library/on-hold", label: "On Hold", icon: PauseCircle },
];

/* Bottom nav items for mobile (subset) */
const MOBILE_NAV = [
  { to: "/", label: "Discover", icon: Compass, end: true },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/library/watchlist", label: "Library", icon: Library },
];

const TYPE_ICON: Record<string, React.ElementType> = { movie: Film, tv: Tv, anime: Sparkles };

export default function AppShell() {
  const { logout, userKey } = useAuth();
  const { userKey: routeUserKey } = useParams<{ userKey: string }>();
  const activeUserKey = userKey ?? "";
  const isMismatchedRouteUser = !!activeUserKey && routeUserKey !== activeUserKey;

  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get('q') || "");
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<ContentItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const committedQuery = React.useRef<string>("");

  // ── Recent Searches (per-user, localStorage) ──
  const recentSearchesKey = React.useMemo(() => {
    if (!activeUserKey) return null;
    return `sv_recent_searches_${activeUserKey}`;
  }, [activeUserKey]);

  const [recentSearches, setRecentSearches] = React.useState<string[]>(() => {
    if (!recentSearchesKey) return [];
    try { return JSON.parse(localStorage.getItem(recentSearchesKey) || "[]"); }
    catch { return []; }
  });

  // Sync recent searches to localStorage
  React.useEffect(() => {
    if (!recentSearchesKey) return;
    localStorage.setItem(recentSearchesKey, JSON.stringify(recentSearches));
  }, [recentSearches, recentSearchesKey]);

  // Re-load when key changes (login/logout)
  React.useEffect(() => {
    if (!recentSearchesKey) { setRecentSearches([]); return; }
    try { setRecentSearches(JSON.parse(localStorage.getItem(recentSearchesKey) || "[]")); }
    catch { setRecentSearches([]); }
  }, [recentSearchesKey]);

  const addRecentSearch = React.useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      return [trimmed, ...filtered].slice(0, 10); // Keep max 10
    });
  }, []);

  const removeRecentSearch = React.useCallback((q: string) => {
    setRecentSearches(prev => prev.filter(s => s !== q));
  }, []);

  const clearAllRecentSearches = React.useCallback(() => {
    setRecentSearches([]);
  }, []);

  const showRecentSearches = searchFocused && query.trim().length < 2 && recentSearches.length > 0 && !showDropdown;

  React.useEffect(() => {
    setQuery(searchParams.get('q') || "");
  }, [searchParams]);

  // Debounced live search for suggestions
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setSuggestionsLoading(false);
      return;
    }

    // Show dropdown immediately with loading state
    setShowDropdown(true);
    setSuggestionsLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await discoverApi.search({ query: query.trim(), pageSize: 8 });
        if (!controller.signal.aborted) {
          setSuggestions(results.slice(0, 8));
          setActiveIndex(-1);
          setSuggestionsLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsLoading(false);
        }
      }
    }, 300);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  // Dispatch search event for DiscoverPage full results (on Enter)
  const commitSearch = (q: string) => {
    setShowDropdown(false);
    setSuggestions([]);
    committedQuery.current = q.trim();
    if (q.trim()) addRecentSearch(q.trim());
    window.dispatchEvent(new CustomEvent("sv:search", { detail: q }));
  };

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Navigate to content detail
  const goToContent = (item: ContentItem) => {
    const t = item.type === 'anime' ? 'anime' : item.type === 'tv' ? 'tv' : 'movie';
    nav(`/content/${t}/${item.externalId}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
    setShowDropdown(false);
    if (query.trim()) addRecentSearch(query.trim());
    setQuery("");
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter" && query.trim()) commitSearch(query);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        goToContent(suggestions[activeIndex]);
      } else {
        commitSearch(query);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (!activeUserKey || isMismatchedRouteUser) {
    return <Navigate to={activeUserKey ? `/app/${activeUserKey}` : "/auth"} replace />;
  }

  const withUserRoot = (path: string): string => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (normalized === "/") {
      return `/app/${activeUserKey}`;
    }
    return `/app/${activeUserKey}${normalized}`;
  };

  const isDiscover = location.pathname === withUserRoot("/");

  return (
    <div className="app-shell-bg min-h-screen overflow-x-hidden text-[#F4EFE6]">
      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <header className="mobile-top-header fixed top-0 left-0 right-0 z-50 px-1.5 pt-1.5 sm:px-4 sm:pt-3 md:px-6">
        <div
          className="mx-auto max-w-[1480px] premium-panel nav-sheen px-2.5 py-2 sm:px-4 md:px-6 md:py-3 overflow-visible"
        >
          <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
            {/* Brand */}
            <button
              onClick={() => { setQuery(""); nav(withUserRoot("/")); }}
              className="flex items-center gap-2 sm:gap-3 flex-shrink-0 cursor-pointer group"
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#ffebbb_0%,#ffc562_52%,#ff8458_100%)] shadow-[0_16px_34px_rgba(255,149,87,0.25)] sm:h-10 sm:w-10">
                <span className="text-[#0b0d12] font-black text-[10px] sm:text-xs tracking-[0.14em]">SV</span>
                <span className="absolute inset-0 rounded-2xl border border-white/25" />
              </div>
              <div className="hidden sm:block text-left">
                <span className="block font-display text-sm font-bold tracking-[0.28em] text-[#FFD48C] uppercase">StreamVault</span>
                <span className="block text-[10px] text-white/36 tracking-[0.24em] uppercase">Cinema Index</span>
              </div>
            </button>

            {/* Desktop Navigation — hidden on mobile */}
            <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={`${activeUserKey}-desktop-${to}`}
                  to={withUserRoot(to)}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-[linear-gradient(135deg,rgba(255,197,98,0.18),rgba(255,107,61,0.12))] text-[#fff7e8] border border-[#ffc562]/25 shadow-[0_12px_30px_rgba(255,149,87,0.12)]"
                        : "text-white/48 hover:text-white hover:bg-white/[0.05] border border-transparent"
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Mobile Search Toggle */}
            <button
              className="md:hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition-colors hover:text-white cursor-pointer"
              onClick={() => setMobileSearchOpen(true)}
            >
              <Search className="w-5 h-5" />
            </button>

            <div ref={dropdownRef} className={`hidden md:block relative transition-all duration-300 ${searchFocused ? "w-[26rem]" : "w-[15rem]"}`}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5AD3FF]/70 z-10" />
              <input
                ref={inputRef}
                className="w-full rounded-full border border-white/10 bg-[#090d13]/92 py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/26 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all focus:outline-none focus:border-[#ffc562]/35 focus:bg-[#0b1017]/95"
                placeholder="Search movies, shows, anime…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); committedQuery.current = ""; }}
                onFocus={() => { setSearchFocused(true); if (suggestions.length > 0 && query.trim().length >= 2) setShowDropdown(true); }}
                onBlur={() => { setTimeout(() => setSearchFocused(false), 200); }}
                onKeyDown={handleKeyDown}
              />
              {query && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(""); setSuggestions([]); setShowDropdown(false); commitSearch(""); }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Search Suggestions Dropdown */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-3 left-0 right-0 premium-panel overflow-hidden z-[100]"
                  >
                    {suggestionsLoading && suggestions.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/40 mx-auto mb-2" />
                        <p className="text-[11px] text-white/40">Searching…</p>
                      </div>
                    ) : suggestions.length > 0 ? (
                      <>
                        <div className="max-h-[420px] overflow-y-auto">
                          {suggestions.map((item, idx) => {
                            const TypeIcon = TYPE_ICON[item.type] || Film;
                            const year = formatYear(item.releaseDate);
                            return (
                              <button
                                key={`${item.source}-${item.externalId}`}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                                  idx === activeIndex ? "bg-white/10" : "hover:bg-white/5"
                                }`}
                                onMouseDown={(e) => { e.preventDefault(); goToContent(item); }}
                                onMouseEnter={() => setActiveIndex(idx)}
                              >
                                {/* Poster Thumbnail */}
                                <div className="w-10 h-14 rounded overflow-hidden flex-shrink-0 bg-white/5">
                                  <img
                                    src={getImageUrl(item.posterPath, 'small')}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_POSTER; }}
                                  />
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-medium truncate">{item.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                                      <TypeIcon className="w-3 h-3" />
                                      {getContentTypeLabel(item.type)}
                                    </span>
                                    {year && <span className="text-[11px] text-white/30">{year}</span>}
                                    {item.voteAverage > 0 && (
                                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#F5C518]">
                                        <Star className="w-2.5 h-2.5 fill-current" />
                                        {formatRating(item.voteAverage)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {/* View all results footer */}
                        <button
                          className="w-full px-4 py-2.5 text-center text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors border-t border-white/[0.06] cursor-pointer"
                          onMouseDown={(e) => { e.preventDefault(); commitSearch(query); }}
                        >
                          View all results for &ldquo;{query}&rdquo;
                        </button>
                      </>
                    ) : query.trim().length >= 2 && !suggestionsLoading ? (
                      <div className="px-4 py-6 text-center text-white/40 text-sm">
                        No results for &ldquo;{query}&rdquo;
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent Searches Dropdown */}
              <AnimatePresence>
                {showRecentSearches && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-3 left-0 right-0 premium-panel overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                      <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Recent</span>
                      <button
                        className="text-[11px] text-white/20 hover:text-[#E50914] transition-colors cursor-pointer"
                        onMouseDown={(e) => { e.preventDefault(); clearAllRecentSearches(); }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto pb-1">
                      {recentSearches.map((term) => (
                        <div
                          key={term}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors group"
                        >
                          <Clock className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                          <button
                            className="flex-1 text-left text-sm text-white/50 hover:text-white truncate cursor-pointer"
                            onMouseDown={(e) => { e.preventDefault(); setQuery(term); commitSearch(term); }}
                          >
                            {term}
                          </button>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/20 hover:text-[#E50914] hover:bg-[#E50914]/10 transition-all cursor-pointer"
                            onMouseDown={(e) => { e.preventDefault(); removeRecentSearch(term); }}
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status + Logout */}
            <NavLink
              to={withUserRoot('/status')}
              className={({ isActive }) =>
                `hidden md:flex items-center justify-center rounded-2xl border px-3 py-2 transition-all ${isActive ? "border-[#5AD3FF]/35 bg-[#5AD3FF]/10 text-[#dff8ff]" : "border-white/10 bg-white/[0.03] text-white/46 hover:text-white"}`
              }
              title="API Status"
            >
              <Activity className="w-4 h-4" />
            </NavLink>

            {/* Mobile hamburger for full nav */}
            <button
              className="md:hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition-colors hover:text-white cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => { logout(); nav("/auth"); }}
              className="hidden md:flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-white/42 transition-all hover:text-[#ff9a67] cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile slide-down nav menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-auto mt-1.5 w-[calc(100%-0.75rem)] max-w-[1480px] overflow-hidden premium-panel md:hidden"
            >
              <div className="mobile-menu-sheet px-4 py-3 space-y-1">
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={`${activeUserKey}-mobile-${to}`}
                    to={withUserRoot(to)}
                    end={end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `mobile-nav-link flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold uppercase tracking-[0.12em] transition-all ${
                        isActive
                          ? "text-white bg-[linear-gradient(135deg,rgba(255,197,98,0.18),rgba(255,107,61,0.12))] border border-[#ffc562]/20"
                          : "text-[#9ca4b2] bg-white/[0.02]"
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </NavLink>
                ))}
                <button
                  onClick={() => { logout(); nav("/auth"); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold uppercase tracking-[0.12em] text-[#ff9a67] bg-white/[0.02] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Mobile Full-Screen Search Overlay ─────────────────────── */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#05070b]/98 md:hidden flex flex-col"
          >
            {/* Search header */}
            <div className="mobile-search-header flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-3">
              <Search className="w-5 h-5 text-[#5AD3FF]/70 flex-shrink-0" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-base text-white placeholder:text-white/24 focus:outline-none"
                placeholder="Search movies, shows, anime…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); committedQuery.current = ""; }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    commitSearch(query);
                    setMobileSearchOpen(false);
                  }
                }}
              />
              <button
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/40 hover:text-white cursor-pointer"
                onClick={() => { setMobileSearchOpen(false); }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile suggestions */}
            <div className="flex-1 overflow-y-auto">
              {suggestionsLoading && suggestions.length === 0 && query.trim().length >= 2 ? (
                <div className="px-4 py-12 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/40 mx-auto mb-3" />
                  <p className="text-sm text-white/40">Searching…</p>
                </div>
              ) : suggestions.length > 0 ? (
                <div>
                  {suggestions.map((item) => {
                    const TypeIcon = TYPE_ICON[item.type] || Film;
                    const year = formatYear(item.releaseDate);
                    return (
                      <button
                        key={`${item.source}-${item.externalId}`}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => { goToContent(item); setMobileSearchOpen(false); }}
                      >
                        <div className="w-10 h-14 rounded overflow-hidden flex-shrink-0 bg-white/5">
                          <img
                            src={getImageUrl(item.posterPath, 'small')}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_POSTER; }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                              <TypeIcon className="w-3 h-3" />
                              {getContentTypeLabel(item.type)}
                            </span>
                            {year && <span className="text-[11px] text-white/30">{year}</span>}
                            {item.voteAverage > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#F5C518]">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                {formatRating(item.voteAverage)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    className="w-full px-4 py-3 text-center text-sm text-white/40 border-t border-white/[0.06] cursor-pointer"
                    onClick={() => { commitSearch(query); setMobileSearchOpen(false); }}
                  >
                    View all results for &ldquo;{query}&rdquo;
                  </button>
                </div>
              ) : query.trim().length < 2 && recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Recent</span>
                    <button
                      className="text-[11px] text-white/20 hover:text-[#E50914] cursor-pointer"
                      onClick={() => clearAllRecentSearches()}
                    >
                      Clear All
                    </button>
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => { setQuery(term); commitSearch(term); setMobileSearchOpen(false); }}
                    >
                      <Clock className="w-4 h-4 text-white/20 flex-shrink-0" />
                      <span className="text-sm text-white/50">{term}</span>
                    </button>
                  ))}
                </div>
              ) : query.trim().length >= 2 && !suggestionsLoading ? (
                <div className="px-4 py-12 text-center text-white/40 text-sm">
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className={isDiscover ? "mobile-content-shell relative z-10" : "mobile-content-shell relative z-10 mx-auto max-w-[1480px] px-3 sm:px-4 md:px-6 pb-20 md:pb-8 pt-12 sm:pt-16 md:pt-20"}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${location.pathname}${location.search}`}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="app-stage"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Mobile Bottom Nav ──────────────────────────────────────── */}
      <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0b0f15]/95 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        <div className="flex items-center justify-between gap-1 px-1.5 pt-2 pb-1">
          {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
                key={`${activeUserKey}-${to}`}
                to={withUserRoot(to)}
              end={end}
              className={({ isActive }) =>
                `flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  isActive ? "text-[#ffc562]" : "text-[#6b7280]"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="max-w-full truncate">{label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => { logout(); nav("/auth"); }}
            className="flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="max-w-full truncate">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}