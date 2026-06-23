import { useState, useEffect, useRef } from 'react';
import { Newspaper, ExternalLink, ChevronLeft, ChevronRight, Flame, TrendingUp } from 'lucide-react';
import { getImageUrl, type NewsItem } from '../api/discoverApi';

/* ─── Category config ───────────────────────────────────────────────────── */
const CAT: Record<string, { gradient: string; accent: string; icon: string }> = {
  Movies:      { gradient: 'from-red-600/90 to-orange-600/80',   accent: '#ef4444', icon: '🎬' },
  'TV Shows':  { gradient: 'from-blue-600/90 to-cyan-600/80',    accent: '#3b82f6', icon: '📺' },
  Anime:       { gradient: 'from-purple-600/90 to-pink-600/80',  accent: '#a855f7', icon: '⚡' },
  Bollywood:   { gradient: 'from-amber-600/90 to-yellow-600/80', accent: '#f59e0b', icon: '🌟' },
  India:       { gradient: 'from-orange-600/90 to-emerald-600/80', accent: '#fb923c', icon: '🪷' },
  Streaming:   { gradient: 'from-green-600/90 to-emerald-600/80',accent: '#22c55e', icon: '📡' },
  'Box Office':{ gradient: 'from-yellow-600/90 to-amber-600/80', accent: '#eab308', icon: '💰' },
  Trailers:    { gradient: 'from-pink-600/90 to-rose-600/80',    accent: '#ec4899', icon: '🎥' },
  Reviews:     { gradient: 'from-cyan-600/90 to-teal-600/80',    accent: '#06b6d4', icon: '⭐' },
};
const DEFAULT_CAT = { gradient: 'from-gray-600/90 to-gray-500/80', accent: '#6b7280', icon: '📰' };
const getCat = (c: string) => CAT[c] ?? DEFAULT_CAT;

function getNewsImage(item: NewsItem): string | null {
  if (item.imageUrl) {
    return getImageUrl(item.imageUrl, 'original');
  }
  return null;
}

function formatPublishedAgo(isoDate?: string): string {
  if (!isoDate) return 'Recent';

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Recent';

  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── Racing Ticker ─────────────────────────────────────────────────────── */
function RacingTicker({ items }: { items: NewsItem[] }) {
  return (
    <div className="news-ticker relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#11151c]/88 px-4 py-3 racing-border-top">
      <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-black/35 to-red-900/20" />
      <div className="relative flex items-center gap-4">
        <div className="flex-shrink-0 flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-red-600 to-red-500 px-3 py-1.5 text-[10px] font-black tracking-wider text-white shadow-lg shadow-red-500/20 sm:text-xs">
          <Flame className="w-3 h-3" />
          NEWSWIRE
        </div>
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max items-center gap-6 pr-4">
            {items.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-xs text-white/70 transition-colors hover:text-white sm:text-sm"
              >
                <Flame className="w-3 h-3 text-red-400" />
                <span className="font-medium">{item.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero Spotlight (full-width with backdrop) ─────────────────────────── */
function HeroSpotlight({ items }: { items: NewsItem[] }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safeItems = items.filter((item): item is NewsItem => Boolean(item?.url && item?.title));

  const clearRotationTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (safeItems.length <= 1) {
      clearRotationTimer();
      return undefined;
    }

    timerRef.current = setInterval(() => setIdx((p) => (p + 1) % safeItems.length), 8000);
    return clearRotationTimer;
  }, [safeItems.length]);

  useEffect(() => {
    setIdx((prev) => (prev < safeItems.length ? prev : 0));
  }, [safeItems.length]);

  const go = (d: -1 | 1) => {
    clearRotationTimer();
    setIdx(p => (p + d + safeItems.length) % safeItems.length);
  };
  if (!safeItems.length) return null;

  const safeIdx = idx >= 0 && idx < safeItems.length ? idx : 0;
  const item = safeItems[safeIdx];
  if (!item) return null;

  const cat = getCat(item.category ?? '');
  const img = getNewsImage(item);

  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0e1218] sm:min-h-[320px]">
      {img ? (
        <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient}`} />
      )}
      <div className="absolute inset-0 media-backdrop-scrim" />
      <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${cat.accent}, transparent)` }} />

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex h-full min-h-[220px] flex-col justify-end p-4 sm:min-h-[320px] sm:p-8"
      >
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-yellow-400">
              <Newspaper className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400/90 sm:text-xs">Spotlight</span>
            <span
              className="ml-1 inline-flex items-center gap-1 rounded-sm px-2.5 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: `${cat.accent}33`, color: cat.accent }}
            >
              {cat.icon} {item.category}
            </span>
          </div>
          <h3 className="mb-2 line-clamp-2 text-xl font-black leading-tight text-white drop-shadow-lg sm:text-2xl lg:text-3xl">{item.title}</h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold uppercase tracking-wider text-white/60">{item.source}</span>
            <span className="rounded-sm border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/75">
              {formatPublishedAgo(item.publishedAt)}
            </span>
            <span className="flex items-center gap-1 text-white/56 transition-colors hover:text-white/80">
              Read article <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        </div>
      </a>

      {safeItems.length > 1 && (
        <>
          <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/56 transition-all hover:bg-black/70 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/56 transition-all hover:bg-black/70 hover:text-white">
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      <div className="absolute bottom-2 right-4 flex gap-1.5">
        {safeItems.map((_, i) => (
          <button
            key={i}
            onClick={() => { clearRotationTimer(); setIdx(i); }}
            className="relative h-1 overflow-hidden rounded-full transition-all duration-300"
            style={{ width: i === idx ? 28 : 8 }}
          >
            <div className="absolute inset-0 rounded-full bg-white/20" />
            {i === idx && <div className="absolute inset-0 rounded-full" style={{ background: cat.accent }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── News Card with image ──────────────────────────────────────────────── */
function NewsCard({ item }: { item: NewsItem }) {
  const cat = getCat(item.category ?? 'Entertainment');
  const img = getNewsImage(item);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-[22px] border border-white/[0.05] bg-[#12161d] transition-transform duration-300 hover:-translate-y-1"
    >

      <div className="relative h-32 sm:h-44 overflow-hidden">
        {img ? (
          <>
            <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1014] via-[#0F1014]/40 to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${cat.gradient} relative`}>
            <div className="absolute inset-0 news-pattern opacity-20" />
            <div className="absolute inset-0 flex items-center justify-center"><span className="text-5xl opacity-30">{cat.icon}</span></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1014] via-transparent to-transparent" />
          </div>
        )}

        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold backdrop-blur-md"
            style={{ backgroundColor: cat.accent + '44', color: 'white' }}>
            {cat.icon} {item.category}
          </span>
        </div>

        <div className="absolute top-3 right-3 rounded-sm border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/75 backdrop-blur-md">
          {formatPublishedAgo(item.publishedAt)}
        </div>

        <div className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500"
          style={{ background: `linear-gradient(90deg, ${cat.accent}, transparent)` }} />
      </div>

      <div className="relative rounded-b-[22px] border-x border-b border-white/[0.04] bg-[#16181D]/95 p-4">
        <h3 className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors line-clamp-2 mb-1.5 leading-snug">{item.title}</h3>
        <p className="text-xs text-white/35 group-hover:text-white/50 transition-colors line-clamp-2 mb-3 leading-relaxed">{item.snippet}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/25 font-medium uppercase tracking-wider">{item.source}</span>
          <span className="flex items-center gap-1 text-[10px] text-white/25 transition-colors group-hover:text-white/50">
            Read <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
        <div className="absolute inset-0 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ boxShadow: `inset 0 0 30px ${cat.accent}11` }} />
      </div>
    </a>
  );
}

/* ─── Main NewsSection ──────────────────────────────────────────────────── */
export default function NewsSection({ news, isLoading }: { news: NewsItem[]; isLoading: boolean }) {
  const validNews = news.filter((item): item is NewsItem => Boolean(item?.url && item?.title));
  const sortedNews = [...validNews].sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
  const spotlightItems = sortedNews.slice(0, 5);
  const gridItems = sortedNews.slice(5);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 shimmer rounded" />
        <div className="h-[300px] shimmer rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 shimmer rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (validNews.length === 0) return null;

  return (
    <div className="space-y-6 news-section">
      <RacingTicker items={validNews.slice(0, 10)} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="relative p-2.5 rounded-lg bg-[#0F1014] border border-white/10">
              <Newspaper className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              Entertainment News
              <span className="rounded-sm border border-red-500/20 bg-red-600/20 px-2 py-0.5 text-[10px] font-black text-red-400">LIVE</span>
            </h2>
            <p className="text-[11px] text-white/30 tracking-wide">Movies • TV • Anime • Streaming</p>
          </div>
        </div>

        <div className="rounded-sm border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/55 sm:text-xs">
          Unified Feed
        </div>
      </div>

      {spotlightItems.length > 0 && <HeroSpotlight items={spotlightItems} />}

      {gridItems.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {gridItems.map((item) => <NewsCard key={item.url} item={item} />)}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <TrendingUp className="w-4 h-4 text-white/20" />
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.15em]">Hot Topics</span>
        {['Marvel', 'Netflix', 'Anime2026', 'BoxOffice', 'Bollywood', 'Disney+'].map(tag => (
          <span key={tag}
            className="text-[10px] px-2.5 py-0.5 rounded-sm bg-white/[0.03] text-white/30 hover:text-white/60 border border-white/[0.04] hover:border-white/[0.1] transition-all cursor-default">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}
