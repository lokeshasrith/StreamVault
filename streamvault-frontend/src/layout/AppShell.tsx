import React from "react";
import { NavLink, Outlet, useNavigate, useSearchParams, useLocation, useParams, Navigate } from "react-router-dom";
import { Search, LogOut, Compass, Bookmark, Eye, CheckCircle, XCircle, PauseCircle, Activity, Film, Tv, Sparkles, Star, X, Clock, Trash2, Menu, Library, Heart, Download } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { discoverApi, type ContentItem, getImageUrl, formatRating, getContentTypeLabel, formatYear, PLACEHOLDER_POSTER } from "../api/discoverApi";
import StreamVaultLogo from "../components/StreamVaultLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

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

const MOBILE_NAV = [
  { to: "/", label: "Discover", icon: Compass, end: true },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/library/watchlist", label: "Library", icon: Library },
];

const TYPE_ICON: Record<string, React.ElementType> = { movie: Film, tv: Tv, anime: Sparkles };

const mobileMenuVariants: Variants = {
  hidden: { opacity: 0, y: -16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.035, delayChildren: 0.03 },
  },
  exit: { opacity: 0, y: -12, scale: 0.985, transition: { duration: 0.16 } },
};

const mobileMenuItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } },
};

export default function AppShell() {
  const { logout, userKey } = useAuth();
  const { userKey: routeUserKey } = useParams<{ userKey: string }>();
  const activeUserKey = userKey ?? "";
  const isMismatchedRouteUser = !!activeUserKey && routeUserKey !== activeUserKey;

  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") || "");
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<ContentItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const committedQuery = React.useRef<string>("");

  const recentSearchesKey = React.useMemo(() => {
    if (!activeUserKey) return null;
    return `sv_recent_searches_${activeUserKey}`;
  }, [activeUserKey]);

  const [recentSearches, setRecentSearches] = React.useState<string[]>(() => {
    if (!recentSearchesKey) return [];
    try { return JSON.parse(localStorage.getItem(recentSearchesKey) || "[]"); }
    catch { return []; }
  });

  React.useEffect(() => {
    if (!recentSearchesKey) return;
    localStorage.setItem(recentSearchesKey, JSON.stringify(recentSearches));
  }, [recentSearches, recentSearchesKey]);

  React.useEffect(() => {
    if (!recentSearchesKey) {
      setRecentSearches([]);
      return;
    }
    try { setRecentSearches(JSON.parse(localStorage.getItem(recentSearchesKey) || "[]")); }
    catch { setRecentSearches([]); }
  }, [recentSearchesKey]);

  const addRecentSearch = React.useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      return [trimmed, ...filtered].slice(0, 10);
    });
  }, []);

  const removeRecentSearch = React.useCallback((value: string) => {
    setRecentSearches((prev) => prev.filter((item) => item !== value));
  }, []);

  const clearAllRecentSearches = React.useCallback(() => {
    setRecentSearches([]);
  }, []);

  const showRecentSearches = searchFocused && query.trim().length < 2 && recentSearches.length > 0 && !showDropdown;

  React.useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setSuggestionsLoading(false);
      return;
    }

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

  const commitSearch = (value: string) => {
    setShowDropdown(false);
    setSuggestions([]);
    committedQuery.current = value.trim();
    if (value.trim()) addRecentSearch(value.trim());
    window.dispatchEvent(new CustomEvent("sv:search", { detail: value }));
  };

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToContent = (item: ContentItem) => {
    const type = item.type === "anime" ? "anime" : item.type === "tv" ? "tv" : "movie";
    nav(`/content/${type}/${item.externalId}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
    setShowDropdown(false);
    if (query.trim()) addRecentSearch(query.trim());
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter" && query.trim()) commitSearch(query);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
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
  const [installPrompt, setInstallPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallHint, setShowIosInstallHint] = React.useState(false);
  const [installHintDismissed, setInstallHintDismissed] = React.useState(false);

  const isIos = React.useMemo(() => /iphone|ipad|ipod/i.test(navigator.userAgent), []);
  const isStandalone = React.useMemo(() => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true, []);

  React.useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
      setShowIosInstallHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleAddToHomeScreen = React.useCallback(async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setMobileMenuOpen(false);
      return;
    }

    if (isIos && !isStandalone) {
      setShowIosInstallHint(true);
    }
  }, [installPrompt, isIos, isStandalone]);

  React.useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!mobileSearchOpen && !mobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileSearchOpen, mobileMenuOpen]);

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
      <header className="mobile-top-header fixed top-0 left-0 right-0 z-50 px-1 pt-1 sm:px-4 sm:pt-3 md:px-6">
        <div className="app-header-shell mx-auto max-w-[1580px] premium-panel nav-sheen overflow-visible px-2 py-2 sm:px-4 md:px-5 md:py-3">
          <div className="flex items-center gap-2 sm:gap-4 md:hidden">
            <button onClick={() => { setQuery(""); nav(withUserRoot("/")); }} className="group flex flex-shrink-0 items-center gap-2 rounded-[18px] border border-white/8 bg-white/[0.02] px-2.5 py-1.5 cursor-pointer">
              <StreamVaultLogo size={34} compact />
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-[#FFD48C]/72">StreamVault</span>
                <span className="text-[11px] text-white/50">Pocket Picks</span>
              </div>
            </button>
            <div className="flex-1" />
            <button className="app-header-action md:hidden" onClick={() => { setMobileMenuOpen(false); setMobileSearchOpen(true); }}>
              <Search className="h-[1.125rem] w-[1.125rem]" />
            </button>
            <button className="app-header-action md:hidden" onClick={() => { setMobileSearchOpen(false); setMobileMenuOpen((prev) => !prev); }}>
              <Menu className="h-[1.125rem] w-[1.125rem]" />
            </button>
          </div>

          <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4 lg:gap-5">
            <button
              onClick={() => { setQuery(""); nav(withUserRoot("/")); }}
              className="app-brand-block flex items-center rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-3 py-2.5 text-left transition-all duration-300 hover:border-[#ffc562]/22 hover:bg-white/[0.04]"
            >
              <StreamVaultLogo size={46} />
            </button>

            <nav className="app-nav-deck scrollbar-soft flex min-w-0 items-center justify-center gap-1.5 rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(13,16,22,0.82),rgba(8,11,17,0.78))] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] overflow-x-auto">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={`${activeUserKey}-desktop-${to}`}
                  to={withUserRoot(to)}
                  end={end}
                  className={({ isActive }) =>
                    `app-nav-link flex items-center gap-2 rounded-[20px] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "border border-[#ffc562]/24 bg-[linear-gradient(135deg,rgba(255,197,98,0.22),rgba(255,107,61,0.12))] text-[#fff7e8] shadow-[0_14px_30px_rgba(255,149,87,0.12)]"
                        : "border border-transparent text-white/44 hover:text-white hover:bg-white/[0.045]"
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="app-header-tools flex items-center gap-2 lg:gap-3">
              <div ref={dropdownRef} className={`relative transition-all duration-300 ${searchFocused ? "w-[25rem]" : "w-[17rem]"}`}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5AD3FF]/70 z-10" />
                <input
                  ref={inputRef}
                  className="app-header-search w-full rounded-[22px] border border-white/10 bg-white/[0.03] py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/24 outline-none transition-all focus:border-[#5AD3FF]/30 focus:bg-white/[0.05]"
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
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${idx === activeIndex ? "bg-white/10" : "hover:bg-white/5"}`}
                                  onMouseDown={(e) => { e.preventDefault(); goToContent(item); }}
                                  onMouseEnter={() => setActiveIndex(idx)}
                                >
                                  <div className="w-10 h-14 rounded overflow-hidden flex-shrink-0 bg-white/5">
                                    <img
                                      src={getImageUrl(item.posterPath, "small")}
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
                          </div>
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
                          <div key={term} className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors group">
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

              <NavLink
                to={withUserRoot("/status")}
                className={({ isActive }) =>
                  `app-header-action hidden md:flex ${isActive ? "border-[#5AD3FF]/35 bg-[#5AD3FF]/10 text-[#dff8ff]" : "border-white/10 bg-white/[0.03] text-white/46 hover:text-white"}`
                }
                title="API Status"
              >
                <Activity className="w-4 h-4" />
              </NavLink>

              <button
                onClick={() => { logout(); nav("/auth"); }}
                className="app-header-action hidden md:flex text-white/42 hover:text-[#ff9a67]"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              variants={mobileMenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mx-auto mt-1.5 w-[calc(100%-0.5rem)] max-w-[1480px] overflow-hidden premium-panel md:hidden"
            >
              <div className="mobile-menu-sheet space-y-1.5 px-3 py-3">
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <motion.div key={`${activeUserKey}-mobile-${to}`} variants={mobileMenuItemVariants}>
                    <NavLink
                      to={withUserRoot(to)}
                      end={end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `mobile-nav-link flex items-center gap-3 rounded-[20px] px-3 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition-all ${
                          isActive
                            ? "border border-[#ffc562]/20 bg-[linear-gradient(135deg,rgba(255,197,98,0.2),rgba(255,107,61,0.14))] text-white shadow-[0_12px_30px_rgba(255,149,87,0.14)]"
                            : "border border-white/[0.04] bg-white/[0.02] text-[#c0c7d4]"
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </NavLink>
                  </motion.div>
                ))}
                <motion.button
                  variants={mobileMenuItemVariants}
                  onClick={() => { logout(); nav("/auth"); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 rounded-[20px] border border-white/[0.04] bg-white/[0.02] px-3 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#ff9a67] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </motion.button>

                {!isStandalone && (installPrompt || isIos) && !installHintDismissed && (
                  <motion.button
                    variants={mobileMenuItemVariants}
                    onClick={() => { void handleAddToHomeScreen(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 rounded-[20px] border border-[#5ad3ff]/20 bg-[#5ad3ff]/[0.08] px-3 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#7dd3fc] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Add to Home Screen
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {showIosInstallHint && !isStandalone && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            className="fixed bottom-20 left-3 right-3 z-[70] md:hidden premium-panel p-3"
          >
            <p className="text-sm text-white/85">
              On iPhone/iPad: open Safari Share menu and choose <span className="font-semibold text-[#ffd48c]">Add to Home Screen</span>.
            </p>
            <div className="mt-2 flex items-center justify-end gap-2">
              <button className="premium-chip bg-white/[0.03] text-white/70" onClick={() => setShowIosInstallHint(false)}>
                Close
              </button>
              <button className="premium-chip bg-[#5ad3ff]/15 text-[#dff8ff]" onClick={() => { setInstallHintDismissed(true); setShowIosInstallHint(false); }}>
                Don't show again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#05070b]/92 backdrop-blur-md md:hidden"
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mx-2 mt-2 flex h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,13,19,0.98)_0%,rgba(6,8,13,0.96)_100%)] shadow-[0_28px_60px_rgba(0,0,0,0.34)]"
            >
            <div className="mobile-search-header flex items-center gap-2 border-b border-white/[0.06] px-3 py-3">
              <Search className="w-4 h-4 text-[#5AD3FF]/70 flex-shrink-0" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-[0.95rem] text-white placeholder:text-white/24 focus:outline-none"
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
              <button className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/40 hover:text-white cursor-pointer" onClick={() => { setMobileSearchOpen(false); }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-1 pb-3">
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
                        className="mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-[22px] border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-left transition-colors cursor-pointer hover:bg-white/5"
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
                    className="mx-2 mt-2 w-[calc(100%-1rem)] rounded-[20px] border border-white/[0.06] px-4 py-3 text-center text-sm text-white/40 cursor-pointer"
                    onClick={() => { commitSearch(query); setMobileSearchOpen(false); }}
                  >
                    View all results for &ldquo;{query}&rdquo;
                  </button>
                </div>
              ) : query.trim().length < 2 && recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Recent</span>
                    <button className="text-[11px] text-white/20 hover:text-[#E50914] cursor-pointer" onClick={() => clearAllRecentSearches()}>
                      Clear All
                    </button>
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      className="mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-[20px] border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-left transition-colors cursor-pointer hover:bg-white/5"
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
          </motion.div>
        )}
      </AnimatePresence>

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

      <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.45rem)' }}>
        <div className="mx-auto flex max-w-[32rem] items-center justify-between gap-1 rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(11,15,21,0.94),rgba(8,11,16,0.92))] px-1.5 pt-1.5 pb-1.5 shadow-[0_-10px_32px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={`${activeUserKey}-${to}`}
              to={withUserRoot(to)}
              end={end}
              className={({ isActive }) =>
                `flex-1 min-w-0 flex flex-col items-center gap-1 rounded-[18px] px-1 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] transition-all active:scale-[0.96] ${
                  isActive ? "text-[#fff0cf] bg-[linear-gradient(135deg,rgba(255,197,98,0.18),rgba(255,107,61,0.1))] border border-[#ffc562]/18" : "text-[#9ca3af] border border-transparent"
                }`
              }
            >
              <Icon className="h-[1.05rem] w-[1.05rem]" />
              <span className="max-w-full truncate">{label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => { logout(); nav("/auth"); }}
            className="flex-1 min-w-0 flex flex-col items-center gap-1 rounded-[18px] px-1 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af] border border-transparent active:scale-[0.96] cursor-pointer"
          >
            <LogOut className="h-[1.05rem] w-[1.05rem]" />
            <span className="max-w-full truncate">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
