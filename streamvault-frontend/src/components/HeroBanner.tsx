import { useState, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Play, Plus, Info, Star, Calendar, Clock, ChevronLeft, ChevronRight, Eye, Check, Pause, X } from "lucide-react";
import type { ContentItem } from "../api/discoverApi";
import { 
  getImageUrl, 
  formatRating, 
  formatGenres, 
  getContentTypeLabel,
  formatYear,
  truncateText 
} from "../api/discoverApi";

interface HeroBannerProps {
  contents: ContentItem[];
  autoPlay?: boolean;
  interval?: number; // milliseconds
  onContentClick?: (content: ContentItem) => void;
  onPlayTrailer?: (content: ContentItem) => void;
  onAddToLibrary?: (content: ContentItem, status: string) => void;
  onMoreInfo?: (content: ContentItem) => void;
  className?: string;
}

const HERO_STATUS_OPTIONS = [
  { value: 'watchlist', label: 'Plan to Watch', icon: Plus, color: 'text-purple-400' },
  { value: 'watching', label: 'Watching', icon: Eye, color: 'text-blue-400' },
  { value: 'completed', label: 'Completed', icon: Check, color: 'text-green-400' },
  { value: 'liked', label: 'Liked', icon: Star, color: 'text-pink-400' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, color: 'text-yellow-400' },
  { value: 'dropped', label: 'Dropped', icon: X, color: 'text-red-400' },
];

export default function HeroBanner({
  contents,
  autoPlay = true,
  interval = 5000,
  onContentClick,
  onPlayTrailer,
  onAddToLibrary,
  onMoreInfo,
  className = ""
}: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { ref: inViewRef, inView } = useInView({ threshold: 0.1 });

  const clearResumeTimer = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  // Close status menu on outside click
  useEffect(() => {
    if (!showStatusMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showStatusMenu]);

  // Close status menu on slide change
  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      prevIndexRef.current = currentIndex;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on slide change
      setShowStatusMenu(false);
    }
  }, [currentIndex]);

  const currentContent = contents[currentIndex];

  // Auto-advance slides (pauses when off-screen)
  useEffect(() => {
    if (!autoPlay || isPaused || !inView || contents.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % contents.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, isPaused, inView, contents.length, interval]);

  useEffect(() => clearResumeTimer, []);

  // Manual navigation
  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
      resumeTimerRef.current = null;
    }, interval);
  };

  if (!currentContent) {
    return (
      <div className={`relative h-[52vh] sm:h-[62vh] md:h-[85vh] lg:h-[90vh] bg-[#0F1014] ${className}`}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-4">
            <div className="shimmer w-48 sm:w-96 h-8 mx-auto mb-4 rounded"></div>
            <div className="shimmer w-32 sm:w-64 h-4 mx-auto rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const genres = formatGenres(currentContent.genres);
  const year = formatYear(currentContent.releaseDate);
  const episodeInfo = '';
  const heroImage = getImageUrl(currentContent.backdropPath || currentContent.posterPath, 'original');
  const posterImage = getImageUrl(currentContent.posterPath || currentContent.backdropPath, 'large');

  return (
    <div
      ref={inViewRef}
      className={`hero-banner relative h-[60vh] sm:h-[62vh] md:h-[76vh] lg:h-[80vh] overflow-hidden ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        clearResumeTimer();
        setIsPaused(false);
      }}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,188,95,0.14),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(90,211,255,0.18),transparent_24%)]" />
        <div 
          className="absolute inset-0 bg-cover bg-[center_top] bg-no-repeat opacity-24 transition-opacity duration-500"
          style={{
            backgroundImage: `url(${heroImage})`
          }}
        />
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-end pr-4 pointer-events-none sm:pr-8 lg:left-[50%] lg:pr-12 md:left-[44%]">
          <div className="hero-media-shell hidden h-[56%] w-[76%] transition-transform duration-500 md:block lg:h-[70%] lg:w-[72%]">
            <img
              src={heroImage}
              alt=""
              className="h-full w-full object-cover object-[72%_center] select-none"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06080d]/78 via-transparent to-[#5ad3ff]/[0.04]" />
            {currentContent.voteAverage > 0 && (
              <div className="absolute right-4 top-4 premium-chip border-[#ffc562]/30 bg-[#0b0e13]/78 text-[#ffd48c]">
                <Star className="h-3.5 w-3.5 fill-current" />
                {formatRating(currentContent.voteAverage)} Score
              </div>
            )}
            <div className="absolute bottom-4 left-4 hidden items-center gap-3 rounded-[24px] border border-white/10 bg-[#090d13]/90 px-3 py-3 lg:flex">
              <img src={posterImage} alt="" className="h-16 w-12 rounded-xl object-cover" draggable={false} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#FFD48C]">Featured Drop</p>
                <p className="max-w-[12rem] font-display text-sm font-bold text-white line-clamp-2">{currentContent.title}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gradient Overlays */}
        <div className="absolute inset-0 media-backdrop-scrim" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0F1014] to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="mx-auto w-full max-w-[1480px] px-4 sm:px-7 lg:px-8">
          <div className="max-w-md sm:max-w-xl lg:max-w-[38rem] px-0 py-4 sm:px-3 sm:py-6 md:px-0 md:py-7">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="premium-kicker">Tonight's Drop</span>
                <span className="premium-chip border-[#5ad3ff]/20 bg-[#091019]/72 text-[#dcf7ff]">
                  {getContentTypeLabel(currentContent.type)}
                </span>
              </div>

              {/* Content Type & Year */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                {year && (
                  <span className="premium-chip bg-[#0b0e13]/70 text-white/76">
                    <Calendar className="w-4 h-4" />
                    {year}
                  </span>
                )}
                {episodeInfo && (
                  <span className="premium-chip bg-[#0b0e13]/70 text-white/76">
                    <Clock className="w-4 h-4" />
                    {episodeInfo}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1
                className="hero-title section-heading font-bold text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl text-white mb-3 sm:mb-5 leading-[0.94] cursor-pointer hover:text-[#fff5e7] transition-colors"
                onClick={() => onContentClick?.(currentContent)}
              >
                {currentContent.title}
              </h1>

              {/* Rating & Genres */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-5 sm:mb-7">
                {currentContent.voteAverage > 0 && (
                  <div className="premium-chip border-[#ffc562]/30 bg-[#0b0e13]/78 text-[#ffd48c]">
                    <Star className="w-4 h-4 fill-current" />
                    <span>{formatRating(currentContent.voteAverage)}</span>
                  </div>
                )}
                
                {genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {genres.slice(0, 3).map((genre: string) => (
                      <span 
                        key={genre}
                        className="premium-chip bg-white/[0.04] text-white/76"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Synopsis */}
              {currentContent.overview && (
                <p className="hero-synopsis hidden sm:block max-w-xl text-sm md:text-base text-white/74 mb-7 md:mb-9 leading-relaxed">
                  {truncateText(currentContent.overview, 150)}
                </p>
              )}

              {/* Action Buttons */}
              <div className="hero-actions flex flex-wrap gap-2 sm:gap-3">
                {onPlayTrailer && (
                  <button
                    className="premium-button-primary inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all sm:w-auto sm:gap-2 sm:px-6 sm:py-3 sm:text-sm"
                    onClick={() => onPlayTrailer(currentContent)}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Trailer
                  </button>
                )}
                
                {onAddToLibrary && (
                  <div className="relative" ref={statusMenuRef}>
                    <button
                      className="premium-button-secondary inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer sm:w-auto sm:gap-2 sm:px-6 sm:py-3 sm:text-sm"
                      onClick={() => setShowStatusMenu(!showStatusMenu)}
                    >
                      <Plus className="w-4 h-4" />
                      My List
                    </button>
                    {showStatusMenu && (
                      <div className="absolute bottom-full left-0 mb-3 w-[min(92vw,260px)] premium-panel overflow-hidden shadow-xl shadow-black/40 z-50 sm:min-w-[200px]">
                        {HERO_STATUS_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          return (
                            <button
                              key={opt.value}
                              className="w-full px-4 py-3 text-left hover:bg-white/[0.04] transition-colors flex items-center gap-2.5 cursor-pointer"
                              onClick={() => {
                                onAddToLibrary(currentContent, opt.value);
                                setShowStatusMenu(false);
                              }}
                            >
                              <Icon className={`w-4 h-4 ${opt.color}`} />
                              <span className="text-[#E5E5E5] text-sm">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {onMoreInfo && (
                  <button
                    className="premium-button-secondary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
                    onClick={() => onMoreInfo(currentContent)}
                  >
                    <Info className="w-4 h-4" />
                    Details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Previous / Next Arrows */}
      {contents.length > 1 && (
        <>
          <button
            onClick={() => goToSlide((currentIndex - 1 + contents.length) % contents.length)}
            className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#090d13]/90 p-2 text-white/58 transition-all hover:text-white hover:border-[#ffc562]/24 hover:bg-[#0d1118] cursor-pointer sm:left-4 sm:block sm:p-3"
          >
            <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={() => goToSlide((currentIndex + 1) % contents.length)}
            className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#090d13]/90 p-2 text-white/58 transition-all hover:text-white hover:border-[#ffc562]/24 hover:bg-[#0d1118] cursor-pointer sm:right-4 sm:block sm:p-3"
          >
            <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Slide Indicators */}
      {contents.length > 1 && (
        <div className="hero-indicators absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:bottom-8">
          {contents.map((_, index) => (
            <button
              key={index}
              className={`rounded-full transition-all duration-500 cursor-pointer ${
                index === currentIndex ? 'w-10 h-1.5 bg-[linear-gradient(90deg,#ffe2a7,#ffc562,#5ad3ff)]' : 'w-2 h-2 bg-white/24 hover:bg-white/40'
              }`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}