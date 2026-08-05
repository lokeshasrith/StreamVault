import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Clock,
  Film,
  Tv,
  Sparkles,
  Star,
  Eye,
  Bookmark,
  CheckCircle,
  XCircle,
  PauseCircle,
  TrendingUp,
  BarChart3,
  Play,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getActivity, getLibraryStats, type ActivityItem, type LibraryStats } from '../api/libraryApi';
import { getImageUrl, PLACEHOLDER_POSTER } from '../utils/media';

const STATUS_ICONS: Record<string, { icon: typeof Eye; color: string; label: string }> = {
  watchlist: { icon: Bookmark, color: 'text-[#7ad8ff]', label: 'Added to Watchlist' },
  watching: { icon: Eye, color: 'text-[#5ad3ff]', label: 'Started Watching' },
  completed: { icon: CheckCircle, color: 'text-[#7ee4aa]', label: 'Completed' },
  dropped: { icon: XCircle, color: 'text-[#ff8c79]', label: 'Dropped' },
  on_hold: { icon: PauseCircle, color: 'text-[#ffd47e]', label: 'Put On Hold' },
};

const TYPE_ICONS: Record<string, typeof Film> = {
  movie: Film,
  tv: Tv,
  anime: Sparkles,
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityPage() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      try {
        const [activityData, statsData] = await Promise.all([
          getActivity(token, 30).catch(() => [] as ActivityItem[]),
          getLibraryStats(token).catch(() => ({ total: 0, byStatus: {}, byType: {}, avgRating: 0, totalEpisodesWatched: 0 }) as LibraryStats),
        ]);
        setActivity(activityData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load activity:', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token]);

  const goToContent = (item: ActivityItem) => {
    const type = item.type === 'anime' ? 'anime' : item.type === 'tv' ? 'tv' : 'movie';
    navigate(`/content/${type}/${item.externalId}`, { state: { from: `${location.pathname}${location.search}` } });
  };

  const completedCount = stats?.byStatus?.completed ?? 0;
  const totalItems = stats?.total ?? 0;
  const feedSubtitle = useMemo(() => {
    if (loading) return 'Loading updates';
    if (!activity.length) return 'No recent events yet';
    return `${activity.length} recent update${activity.length > 1 ? 's' : ''}`;
  }, [activity.length, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-[#ffc562]/30 border-t-[#ffc562] animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-shell activity-page mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-4 sm:gap-7 sm:px-5 sm:py-6 lg:px-8">
      <section className="premium-panel relative overflow-hidden rounded-[28px] px-4 py-5 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -left-20 top-[-120px] h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(90,211,255,0.25),transparent_70%)]" />
        <div className="pointer-events-none absolute -right-16 bottom-[-120px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,197,98,0.24),transparent_70%)]" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.19em] text-[#ffd9a7]">
              <Activity className="h-3.5 w-3.5 text-[#ffc562]" />
              Timeline
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">
              <Clock className="h-3.5 w-3.5 text-[#5ad3ff]" />
              {feedSubtitle}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[1.65rem] font-bold tracking-tight text-[#F7F1E8] sm:text-[2rem]">
              Your Streaming Pulse
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/62 sm:text-[0.95rem]">
              Follow what changed across your library, from planned watches to finished seasons, in a compact feed built for fast mobile scanning.
            </p>
          </div>
        </div>
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          <StatCard icon={BarChart3} label="Total Items" value={totalItems} accent="blue" />
          <StatCard icon={Star} label="Avg Rating" value={`${stats.avgRating}/10`} accent="gold" />
          <StatCard icon={Play} label="Episodes Watched" value={stats.totalEpisodesWatched} accent="green" />
          <StatCard icon={TrendingUp} label="Completed" value={completedCount} accent="amber" />
        </section>
      )}

      {stats && (
        <section className="premium-panel rounded-[26px] px-4 py-4 sm:px-6 sm:py-6 [animation:fadeSlideUp_420ms_ease-out]">
          <div className="mb-4 flex items-center gap-2.5">
            <BarChart3 className="h-4.5 w-4.5 text-[#5ad3ff]" />
            <h2 className="section-heading m-0 text-base sm:text-lg">Library Breakdown</h2>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
            {Object.entries(stats.byType).map(([type, count]) => {
              const Icon = TYPE_ICONS[type] ?? Film;
              return (
                <article
                  key={type}
                  className="rounded-2xl border border-white/[0.09] bg-white/[0.03] px-3.5 py-3 sm:px-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                      <Icon className="h-4.5 w-4.5 text-[#ffc562]" />
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none text-[#F7F1E8]">{count}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/53">
                        {type === 'tv' ? 'TV Shows' : type}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="premium-panel rounded-[26px] px-3.5 py-3.5 sm:px-6 sm:py-6 [animation:fadeSlideUp_520ms_ease-out]">
        <div className="mb-4 flex items-center justify-between gap-2.5 sm:mb-5">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4.5 w-4.5 text-[#7ee4aa]" />
            <h2 className="section-heading m-0 text-base sm:text-lg">Recent Activity</h2>
          </div>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.17em] text-white/52 sm:inline-block">
            latest first
          </span>
        </div>

        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-10 text-center">
            <p className="text-sm text-white/70">No activity yet.</p>
            <p className="text-xs text-white/45">Start adding titles to your library to build a timeline.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((item, idx) => {
              const statusInfo = STATUS_ICONS[item.status] ?? STATUS_ICONS.watchlist;
              const StatusIcon = statusInfo.icon;
              const TypeIcon = TYPE_ICONS[item.type] ?? Film;

              return (
                <button
                  key={`${item.contentId}-${idx}`}
                  type="button"
                  onClick={() => goToContent(item)}
                  className="group relative flex w-full items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2.5 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05] sm:gap-3.5 sm:px-3.5 sm:py-3"
                  style={{ animation: `fadeSlideUp 300ms ease-out ${Math.min(idx * 40, 260)}ms both` }}
                >
                  {idx < activity.length - 1 && (
                    <span className="pointer-events-none absolute left-[30px] top-[52px] hidden h-[calc(100%-18px)] w-px bg-white/[0.09] sm:block" />
                  )}

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.05]">
                    <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                  </span>

                  <span className="h-14 w-10 shrink-0 overflow-hidden rounded-[10px] border border-white/[0.1] sm:h-16 sm:w-11">
                    <img
                      src={item.posterUrl ? getImageUrl(item.posterUrl, 'small') : PLACEHOLDER_POSTER}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-semibold text-[#F7F1E8] transition-colors group-hover:text-[#ffd79c] sm:text-[0.95rem]">
                      {item.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className={statusInfo.color}>{statusInfo.label}</span>
                      {item.currentEpisode && <span className="text-white/45">• Ep. {item.currentEpisode}</span>}
                    </span>
                    <span className="mt-1 block text-[11px] text-white/45 sm:hidden">
                      {item.type.toUpperCase()} • {timeAgo(item.updatedAt)}
                    </span>
                  </span>

                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-white/55">
                      <TypeIcon className="h-3.5 w-3.5" />
                      {item.type}
                    </span>
                    <span className="mt-1 block text-xs text-white/46">{timeAgo(item.updatedAt)}</span>
                  </span>

                  <ArrowUpRight className="h-4 w-4 shrink-0 text-white/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/65" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Film;
  label: string;
  value: string | number;
  accent: 'blue' | 'gold' | 'green' | 'amber';
}) {
  const accentStyles: Record<'blue' | 'gold' | 'green' | 'amber', string> = {
    blue: 'from-[#5ad3ff]/28 to-[#5ad3ff]/6 text-[#7be4ff]',
    gold: 'from-[#ffc562]/28 to-[#ffc562]/8 text-[#ffd48a]',
    green: 'from-[#7ee4aa]/28 to-[#7ee4aa]/8 text-[#9af2bf]',
    amber: 'from-[#ff9c7c]/28 to-[#ff9c7c]/8 text-[#ffc3a9]',
  };

  return (
    <article className="premium-panel rounded-[22px] px-3 py-3.5 sm:px-4 sm:py-4 [animation:fadeSlideUp_380ms_ease-out]">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${accentStyles[accent]}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-xl font-bold leading-none text-[#F7F1E8] sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/50">{label}</p>
    </article>
  );
}
