import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Activity, Clock, Film, Tv, Sparkles, Star, Eye, 
  Bookmark, CheckCircle, XCircle, PauseCircle, TrendingUp,
  BarChart3, Play
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getActivity, getLibraryStats, type ActivityItem, type LibraryStats } from '../api/libraryApi';
import { getImageUrl, PLACEHOLDER_POSTER } from '../api/discoverApi';

const STATUS_ICONS: Record<string, { icon: typeof Eye; color: string; label: string }> = {
  watchlist: { icon: Bookmark, color: 'text-purple-400', label: 'Added to Watchlist' },
  watching: { icon: Eye, color: 'text-blue-400', label: 'Started Watching' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', label: 'Completed' },
  dropped: { icon: XCircle, color: 'text-red-400', label: 'Dropped' },
  on_hold: { icon: PauseCircle, color: 'text-amber-400', label: 'Put On Hold' },
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
      } catch (e) {
        console.error('Failed to load activity:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const goToContent = (item: ActivityItem) => {
    const t = item.type === 'anime' ? 'anime' : item.type === 'tv' ? 'tv' : 'movie';
    navigate(`/content/${t}/${item.externalId}`, { state: { from: `${location.pathname}${location.search}` } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-sv-gold/40 border-t-sv-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="activity-page mx-auto max-w-7xl space-y-6 px-3 py-5 sm:space-y-8 sm:px-4 md:px-8 sm:py-6">
      {/* Header */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Activity className="w-6 h-6 text-sv-gold" />
        <h1 className="text-[1.7rem] md:text-3xl font-bold font-[family-name:var(--font-display)] tracking-tight">
          Activity
        </h1>
      </div>

      {/* Stats cards with glassmorphism styling */}
      {stats && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">
          <GlassStatCard
            icon={BarChart3}
            label="Total Items"
            value={stats.total}
            color="from-blue-500/20 to-cyan-500/10"
            borderColor="border-blue-500/20"
          />
          <GlassStatCard
            icon={Star}
            label="Avg Rating"
            value={`${stats.avgRating}/10`}
            color="from-amber-500/20 to-orange-500/10"
            borderColor="border-amber-500/20"
          />
          <GlassStatCard
            icon={Play}
            label="Episodes Watched"
            value={stats.totalEpisodesWatched}
            color="from-emerald-500/20 to-green-500/10"
            borderColor="border-emerald-500/20"
          />
          <GlassStatCard
            icon={TrendingUp}
            label="Completed"
            value={stats.byStatus?.completed ?? 0}
            color="from-purple-500/20 to-pink-500/10"
            borderColor="border-purple-500/20"
          />
        </div>
      )}

      {/* Type Breakdown - Glass Panel */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-activity-panel rounded-3xl p-4 sm:p-6"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sv-blue" />
            Library Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(stats.byType).map(([type, count]) => {
              const Icon = TYPE_ICONS[type] ?? Film;
              return (
                <div key={type} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-sv-gold" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-xs text-sv-muted capitalize">{type === 'tv' ? 'TV Shows' : type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Activity Feed - Watcharr-inspired timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-activity-panel rounded-3xl p-4 sm:p-6"
      >
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Clock className="w-5 h-5 text-sv-green" />
          Recent Activity
        </h2>

        {activity.length === 0 ? (
          <p className="text-sv-muted text-center py-8">No activity yet. Start adding content to your library!</p>
        ) : (
          <div className="space-y-1">
            {activity.map((item, idx) => {
              const statusInfo = STATUS_ICONS[item.status] ?? STATUS_ICONS.watchlist;
              const StatusIcon = statusInfo.icon;
              const TypeIcon = TYPE_ICONS[item.type] ?? Film;

              return (
                <motion.div
                  key={`${item.contentId}-${idx}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => goToContent(item)}
                  className="group relative flex items-center gap-3 rounded-2xl p-3 hover:bg-white/[0.04] cursor-pointer transition-all duration-200 sm:gap-4"
                >
                  {/* Timeline connector */}
                  {idx < activity.length - 1 && (
                    <div className="absolute left-[29px] top-[52px] w-[2px] h-[calc(100%-20px)] bg-white/[0.06]" />
                  )}

                  {/* Status indicator */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06] border border-white/[0.08] z-10`}>
                    <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                  </div>

                  {/* Poster */}
                  <div className="w-11 h-16 rounded-lg overflow-hidden shrink-0 border border-white/[0.08]">
                    <img
                      src={item.posterUrl ? getImageUrl(item.posterUrl, 'small') : PLACEHOLDER_POSTER}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-sv-gold transition-colors">
                      {item.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className={`text-xs ${statusInfo.color} max-w-[12rem] truncate sm:max-w-none`}>{statusInfo.label}</span>
                      {item.currentEpisode && (
                        <span className="text-xs text-sv-muted">• Ep. {item.currentEpisode}</span>
                      )}
                    </div>
                    <p className="sm:hidden text-[11px] text-sv-muted mt-1 capitalize">
                      {item.type} • {timeAgo(item.updatedAt)}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="flex items-center gap-1 text-xs text-sv-muted">
                      <TypeIcon className="w-3 h-3" />
                      <span className="capitalize">{item.type}</span>
                    </div>
                    <p className="text-xs text-sv-muted mt-0.5">{timeAgo(item.updatedAt)}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Glassmorphism stat card component
function GlassStatCard({ icon: Icon, label, value, color, borderColor }: {
  icon: typeof Film;
  label: string;
  value: string | number;
  color: string;
  borderColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-2xl border ${borderColor} p-3.5 sm:p-5 backdrop-blur-xl`}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      }}
    >
      {/* Glass gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-60`} />
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: 'rgba(6,8,13,0.4)' }} />
      
      {/* Content */}
      <div className="relative z-10">
        <Icon className="w-5 h-5 text-white/60 mb-2" />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-white/50 mt-1">{label}</p>
      </div>

      {/* Glass shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </motion.div>
  );
}
