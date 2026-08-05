import { useState, useEffect, useRef } from 'react';
import {
  Newspaper,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Flame,
  TrendingUp,
  Clapperboard,
  Tv,
  Sparkles,
  Globe,
  Radio,
  BadgeDollarSign,
  MessageSquare
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NewsItem } from '../api/discoverApi';
import { getImageUrl } from '../utils/media';

/* ─── Category config ───────────────────────────────────────────────────── */
const CAT: Record<string, { gradient: string; accent: string; icon: LucideIcon }> = {
  Movies:      { gradient: 'from-red-600/90 to-orange-600/80',   accent: '#ef4444', icon: Clapperboard },
  'TV Shows':  { gradient: 'from-blue-600/90 to-cyan-600/80',    accent: '#3b82f6', icon: Tv },
  Anime:       { gradient: 'from-purple-600/90 to-pink-600/80',  accent: '#a855f7', icon: Sparkles },
  Bollywood:   { gradient: 'from-amber-600/90 to-yellow-600/80', accent: '#f59e0b', icon: Sparkles },
  India:       { gradient: 'from-orange-600/90 to-emerald-600/80', accent: '#fb923c', icon: Globe },
  Streaming:   { gradient: 'from-green-600/90 to-emerald-600/80',accent: '#22c55e', icon: Radio },
  'Box Office':{ gradient: 'from-yellow-600/90 to-amber-600/80', accent: '#eab308', icon: BadgeDollarSign },
  Trailers:    { gradient: 'from-pink-600/90 to-rose-600/80',    accent: '#ec4899', icon: Clapperboard },
  Reviews:     { gradient: 'from-cyan-600/90 to-teal-600/80',    accent: '#06b6d4', icon: MessageSquare },
};
const DEFAULT_CAT = { gradient: 'from-gray-600/90 to-gray-500/80', accent: '#6b7280', icon: Newspaper };
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

function groupByCategory(items: NewsItem[]): Array<{ category: string; items: NewsItem[] }> {
  const grouped = new Map<string, NewsItem[]>();
  for (const item of items) {
    const key = item.category || 'Entertainment';
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  return [...grouped.entries()]
    .map(([category, groupedItems]) => ({ category, items: groupedItems }))
    .sort((a, b) => b.items.length - a.items.length);
}

/* ─── Racing Ticker ─────────────────────────────────────────────────────── */
function RacingTicker({ items }: { items: NewsItem[] }) {
  return (
    <div className="news-ticker relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#11151c]/88 px-4 py-3 racing-border-top">
      <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-black/35 to-red-900/20" />
      <div className="relative flex items-center gap-4">
        <div className="flex-shrink-0 flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-red-600 to-red-500 px-3 py-1.5 text-[10px] font-black tracking-wider text-white shadow-lg shadow-red-500/20 sm:text-xs">
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

  const go = (d: -1 | 1) => {
    clearRotationTimer();
    setIdx(p => (p + d + safeItems.length) % safeItems.length);
  };
  if (!safeItems.length) return null;

  const safeIdx = idx >= 0 && idx < safeItems.length ? idx : 0;
  const item = safeItems[safeIdx];
  if (!item) return null;

  const cat = getCat(item.category ?? '');
  const CatIcon = cat.icon;
  const img = getNewsImage(item);

  return (
    <div className="news-hero-glow relative min-h-[220px] overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0e1218] sm:min-h-[320px]">
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
              className="ml-1 inline-flex items-center gap-1 rounded-[10px] px-2.5 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: `${cat.accent}33`, color: cat.accent }}
            >
              <CatIcon className="h-3 w-3" />
              {item.category}
            </span>
          </div>
          <h3 className="mb-2 line-clamp-2 text-xl font-black leading-tight text-white drop-shadow-lg sm:text-2xl lg:text-3xl">{item.title}</h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold uppercase tracking-wider text-white/60">{item.source}</span>
            <span className="rounded-[10px] border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/75">
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
          <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-[12px] border border-white/10 bg-black/40 p-2 text-white/56 transition-all hover:bg-black/70 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[12px] border border-white/10 bg-black/40 p-2 text-white/56 transition-all hover:bg-black/70 hover:text-white">
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
  const CatIcon = cat.icon;
  const img = getNewsImage(item);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="news-card-3d group relative block overflow-hidden rounded-[22px] border border-white/[0.05] bg-[#12161d] transition-transform duration-300 hover:-translate-y-1"
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
            <div className="absolute inset-0 flex items-center justify-center"><CatIcon className="h-14 w-14 opacity-30" /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1014] via-transparent to-transparent" />
          </div>
        )}

        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[10px] text-[10px] font-bold backdrop-blur-md"
            style={{ backgroundColor: cat.accent + '44', color: 'white' }}>
            <CatIcon className="h-3 w-3" /> {item.category}
          </span>
        </div>

        <div className="absolute top-3 right-3 rounded-[10px] border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/75 backdrop-blur-md">
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

function HeadlineCard({ item, index }: { item: NewsItem; index: number }) {
  const cat = getCat(item.category ?? 'Entertainment');
  const CatIcon = cat.icon;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-[22px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(22,25,31,0.96),rgba(15,17,22,0.96))] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/12"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/72">
          <CatIcon className="h-3 w-3" style={{ color: cat.accent }} />
          {item.category}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38">0{index + 1}</span>
      </div>
      <h3 className="line-clamp-3 text-base font-semibold leading-snug text-[#F7F1E8] transition-colors group-hover:text-white">
        {item.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/36 transition-colors group-hover:text-white/52">
        {item.snippet}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-white/28">
        <span>{item.source}</span>
        <span className="inline-flex items-center gap-1 text-white/44 group-hover:text-white/62">
          {formatPublishedAgo(item.publishedAt)} <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </a>
  );
}

function CategoryShelf({ category, items }: { category: string; items: NewsItem[] }) {
  const cat = getCat(category);
  const CatIcon = cat.icon;

  return (
    <div className="rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,19,25,0.96),rgba(12,14,19,0.96))] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <span className="premium-kicker">Category Focus</span>
          <h3 className="mt-2 flex items-center gap-2 text-lg font-semibold text-[#F7F1E8]">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <CatIcon className="h-4 w-4" style={{ color: cat.accent }} />
            </span>
            {category}
          </h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/48">
          {items.length} stories
        </span>
      </div>

      <div className="space-y-3">
        {items.slice(0, 3).map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-[18px] border border-white/[0.05] bg-white/[0.03] p-3.5 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.05]"
          >
            <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-[#F7F1E8] group-hover:text-white">
              {item.title}
            </h4>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-white/28">
              <span>{item.source}</span>
              <span className="inline-flex items-center gap-1 text-white/42 group-hover:text-white/60">
                Read <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
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
  const headlineItems = sortedNews.slice(1, 5);
  const featureItems = sortedNews.slice(5, 11);
  const categoryShelves = groupByCategory(sortedNews.slice(6)).slice(0, 3);

  if (isLoading) {
    return (
      <div className="premium-panel space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <div className="h-10 shimmer rounded-2xl" />
        <div className="h-[320px] shimmer rounded-[28px]" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-64 shimmer rounded-[24px]" />)}
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-40 shimmer rounded-[24px]" />)}
          </div>
        </div>
      </div>
    );
  }

  if (validNews.length === 0) return null;

  return (
    <section className="news-section max-w-6xl mx-auto premium-panel px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span className="premium-kicker">Editorial Feed</span>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3">
              <Newspaper className="w-5 h-5 text-[#F7F1E8]" />
            </div>
            <div>
              <h2 className="section-heading text-xl sm:text-3xl text-[#F7F1E8] tracking-tight">
                Entertainment Dispatch
              </h2>
              <p className="mt-1 text-sm text-[#98A2B3]">
                A sharper editorial mix of anime, movies, TV, streaming, and India-focused coverage.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/46 sm:text-xs">
          <span className="rounded-full border border-[#ff6b3d]/18 bg-[#ff6b3d]/12 px-3 py-1 font-bold text-[#FFD48C]">Live Wire</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-bold">Anime</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-bold">Movies</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-bold">Streaming</span>
        </div>
      </div>

      <RacingTicker items={validNews.slice(0, 10)} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)] xl:gap-5">
        {spotlightItems.length > 0 && <HeroSpotlight items={spotlightItems} />}

        <div className="space-y-4">
          {headlineItems.map((item, index) => (
            <HeadlineCard key={item.url} item={item} index={index} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.82fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/48">Feature Stack</h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{featureItems.length} stories</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featureItems.map((item) => <NewsCard key={item.url} item={item} />)}
          </div>
        </div>

        <div className="space-y-4">
          {categoryShelves.map((group) => (
            <CategoryShelf key={group.category} category={group.category} items={group.items} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <TrendingUp className="w-4 h-4 text-white/20" />
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.15em]">Hot Topics</span>
        {['Marvel', 'Netflix', 'Anime2026', 'BoxOffice', 'Bollywood', 'Disney+'].map(tag => (
          <span key={tag}
            className="text-[10px] px-2.5 py-0.5 rounded-[10px] bg-white/[0.03] text-white/30 hover:text-white/60 border border-white/[0.04] hover:border-white/[0.1] transition-all cursor-default">
            #{tag}
          </span>
        ))}
      </div>
    </section>
  );
}
