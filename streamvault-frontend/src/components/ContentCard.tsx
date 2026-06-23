import { useState, memo } from "react";
import { Star, Play, Plus, Check, Trash2, Eye, Pause, X, Bookmark } from "lucide-react";
import type { ContentItem } from "../api/discoverApi";
import { 
  getImageUrl, 
  formatRating, 
  formatGenres, 
  getContentTypeLabel,
  formatYear, 
  formatEpisodes,
  truncateText,
  PLACEHOLDER_POSTER 
} from "../api/discoverApi";

interface ContentCardProps {
  content: ContentItem;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
  inLibrary?: boolean;
  currentStatus?: string;
  onAddToLibrary?: (content: ContentItem, status: string) => void;
  onStatusChange?: (status: string) => void;
  onPlayTrailer?: (content: ContentItem) => void;
  onClick?: (content: ContentItem) => void;
  onRemove?: () => void;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'watchlist', label: 'Plan to Watch', icon: Plus, color: 'text-purple-400' },
  { value: 'watching', label: 'Watching', icon: Eye, color: 'text-blue-400' },
  { value: 'completed', label: 'Completed', icon: Check, color: 'text-green-400' },
  { value: 'liked', label: 'Liked', icon: Star, color: 'text-pink-400' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, color: 'text-yellow-400' },
  { value: 'dropped', label: 'Dropped', icon: X, color: 'text-red-400' },
];

function ContentCard({ 
  content, 
  size = 'medium',
  showDetails = true,
  inLibrary = false,
  currentStatus,
  onAddToLibrary,
  onStatusChange,
  onPlayTrailer,
  onClick,
  onRemove,
  className = ""
}: ContentCardProps) {
  const sizeClasses = {
    small: "w-24 h-36 sm:w-32 sm:h-48",
    medium: "w-full aspect-[2/3] sm:w-44 sm:h-66 md:w-48 md:h-72", 
    large: "w-full aspect-[2/3] sm:w-56 sm:h-84 md:w-64 md:h-96"
  };

  const genres = formatGenres(content.genres);
  const year = formatYear(content.releaseDate);
  const episodeInfo = formatEpisodes((content as ContentItem & { episodes?: number; seasons?: number }).episodes, (content as ContentItem & { episodes?: number; seasons?: number }).seasons);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  return (
    <div
      className={`content-card group relative ${sizeClasses[size]} ${className} cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-2 hover:scale-[1.02] ${showStatusMenu ? 'z-20' : ''}`}
    >
      {/* Poster Image */}
      <div className="relative w-full h-full overflow-hidden rounded-[24px]" onClick={() => { if (!showStatusMenu) onClick?.(content); }}>
        <img
          src={getImageUrl(content.posterPath, size === 'large' ? 'large' : 'medium')}
          alt={content.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover bg-white/5 transition-transform duration-500 group-hover:scale-[1.04]"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.dataset.fallback) {
              target.dataset.fallback = '1';
              target.src = PLACEHOLDER_POSTER;
            }
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[24px] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(90,211,255,0.08)_0%,transparent_18%,transparent_42%,rgba(4,5,8,0.28)_58%,rgba(4,5,8,0.9)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,197,98,0.16),transparent_68%)]" />
        {/* Always-visible title at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-[#040508] via-[#040508]/88 to-transparent rounded-b-[24px] pointer-events-none">
          <h3 className="font-display font-bold text-sm text-[#F7F1E8] line-clamp-2 leading-tight">{content.title}</h3>
        </div>
        
        {/* Overlay Gradient */}
        <div className={`absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,11,0.12),rgba(5,7,11,0.08)_40%,rgba(5,7,11,0.92)_100%)] transition-opacity duration-300 rounded-[24px] pointer-events-none ${showStatusMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
        
        {/* Content Type Badge */}
        <div className="absolute top-2 left-2">
          <span className="premium-chip border-white/10 bg-[#090d13]/78 text-[10px] text-white/76">
            {getContentTypeLabel(content.type, content.source)}
          </span>
        </div>

        {/* Rating Badge */}
        {content.voteAverage > 0 && (
          <div className="absolute top-2 right-2">
            <div className="premium-chip border-[#ffc562]/25 bg-[#090d13]/78 px-2 py-1 text-[#F5C518]">
              <Star className="w-2.5 h-2.5 fill-current" />
              <span className="text-[10px] font-medium">{formatRating(content.voteAverage)}</span>
            </div>
          </div>
        )}

        {/* Status Menu Overlay - rendered inside the card (for onAddToLibrary) */}
        {showStatusMenu && onAddToLibrary && !onStatusChange && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-[24px] bg-black/82"
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(false); }}
          >
            <div
              className="premium-panel w-[min(92vw,220px)] overflow-hidden sm:min-w-[180px] shadow-xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 text-left hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onAddToLibrary(content, opt.value);
                      setShowStatusMenu(false);
                    }}
                  >
                    <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${opt.color}`} />
                    <span className="text-[#E5E5E5] text-xs sm:text-sm">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Menu Overlay - rendered inside the card (for onStatusChange in library) */}
        {showStatusMenu && onStatusChange && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-[24px] bg-black/82"
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(false); }}
          >
            <div
              className="premium-panel w-[min(92vw,240px)] overflow-hidden sm:min-w-[180px] shadow-xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS
                .filter(opt => opt.value !== currentStatus)
                .map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      className="w-full px-4 py-3 text-left hover:bg-white/[0.04] transition-colors flex items-center gap-2.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onStatusChange(opt.value);
                        setShowStatusMenu(false);
                      }}
                    >
                      <Icon className={`w-4 h-4 ${opt.color}`} />
                      <span className="text-[#E5E5E5] text-sm">{opt.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Hover Actions */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 z-10 ${showStatusMenu ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 pointer-events-none'}`}
        >
          <div className={`flex gap-2 ${showStatusMenu ? '' : 'pointer-events-auto'}`}>
            {onPlayTrailer && (
              <button
                className="rounded-2xl border border-white/10 bg-[#090d13]/90 p-2.5 text-white shadow-[0_16px_36px_rgba(0,0,0,0.32)] transition-all hover:scale-110 hover:border-[#5ad3ff]/24 hover:bg-[#0e141d] active:scale-90"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onPlayTrailer(content);
                }}
              >
                <Play className="w-5 h-5" />
              </button>
            )}
            
            {onAddToLibrary && !onStatusChange && (
              <div className="relative">
                <button
                  className={`rounded-2xl border p-2.5 hover:scale-110 active:scale-90 transition-all ${inLibrary ? 'border-[#6de0a1]/30 bg-[#6de0a1]/16 text-[#6de0a1]' : 'border-white/10 bg-[#090d13]/78 text-white hover:border-[#ffc562]/24 hover:bg-[#0e141d]'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowStatusMenu(!showStatusMenu);
                  }}
                >
                  {inLibrary ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
            )}

            {onStatusChange && (
              <div className="relative">
                <button
                  className="rounded-2xl border border-[#5ad3ff]/25 bg-[#5ad3ff]/12 p-2.5 text-[#5ad3ff] hover:bg-[#5ad3ff]/20 hover:scale-110 active:scale-90 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowStatusMenu(!showStatusMenu);
                  }}
                >
                  <Bookmark className="w-5 h-5" />
                </button>
              </div>
            )}

            {onRemove && (
              <button
                className="rounded-2xl border border-[#ff7c61]/25 bg-[#ff7c61]/12 p-2.5 text-[#ff9a67] hover:bg-[#ff7c61]/20 hover:scale-110 active:scale-90 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove();
                }}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content Info - Only visible on hover for medium/large sizes or always for small */}
        {showDetails && (
          <div className={`absolute bottom-0 left-0 right-0 p-3 pt-9 sm:p-4 sm:pt-10 text-white bg-gradient-to-t from-black/90 via-black/60 to-transparent rounded-b-[24px] ${size === 'small' ? '' : 'translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'} transition-all duration-300`}>
            <h3 className="font-display font-bold text-sm mb-1.5 line-clamp-2 tracking-tight text-[#F7F1E8]">{content.title}</h3>
            
            {(year || episodeInfo) && (
              <div className="flex items-center gap-2 text-[11px] text-[#9aa4b4] mb-2">
                {year && <span>{year}</span>}
                {year && episodeInfo && <span>•</span>}
                {episodeInfo && <span>{episodeInfo}</span>}
              </div>
            )}

            {genres.length > 0 && size !== 'small' && (
              <div className="flex flex-wrap gap-1 mb-2">
                {genres.slice(0, 2).map((genre: string) => (
                  <span 
                    key={genre}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/72"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {content.overview && size === 'large' && (
              <p className="text-xs text-[#9aa4b4] line-clamp-3 leading-relaxed">
                {truncateText(content.overview, 120)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ContentCard);

// Skeleton loader for content cards
export function ContentCardSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const sizeClasses = {
    small: "w-28 h-42 sm:w-32 sm:h-48",
    medium: "w-full aspect-[2/3] sm:w-44 sm:h-66 md:w-48 md:h-72",
    large: "w-full aspect-[2/3] sm:w-56 sm:h-84 md:w-64 md:h-96"
  };

  return (
    <div className={`${sizeClasses[size]} shimmer rounded-lg`} />
  );
}

// Content grid component
interface ContentGridProps {
  contents: ContentItem[];
  isLoading?: boolean;
  size?: 'small' | 'medium' | 'large';
  onContentClick?: (content: ContentItem) => void;
  onAddToLibrary?: (content: ContentItem) => void;
  className?: string;
}

export function ContentGrid({
  contents,
  isLoading = false,
  size = 'medium',
  onContentClick,
  onAddToLibrary,
  className = ""
}: ContentGridProps) {
  if (isLoading) {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${className}`}>
        {Array.from({ length: 12 }, (_, i) => (
          <ContentCardSkeleton key={i} size={size} />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${className}`}>
      {contents.map((content) => (
        <ContentCard
          key={`${content.source}-${content.externalId}`}
          content={content}
          size={size}
          onClick={onContentClick}
          onAddToLibrary={onAddToLibrary}
        />
      ))}
    </div>
  );
}