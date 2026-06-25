import React, { useRef, memo } from "react";
import { useInView } from "react-intersection-observer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ContentCard, { ContentCardSkeleton } from "./ContentCard";
import type { ContentItem } from "../api/discoverApi";

interface ContentCarouselProps {
  title: string;
  contents: ContentItem[];
  isLoading?: boolean;
  size?: 'small' | 'medium' | 'large';
  showViewAll?: boolean;
  onViewAll?: () => void;
  onContentClick?: (content: ContentItem) => void;
  onAddToLibrary?: (content: ContentItem, status: string) => void;
  className?: string;
}

function ContentCarousel({
  title,
  contents,
  isLoading = false,
  size = 'medium',
  showViewAll = false,
  onViewAll,
  onContentClick,
  onAddToLibrary,
  className = ""
}: ContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    
    const scrollAmount = size === 'large' ? 320 : size === 'medium' ? 248 : 176;
    const currentScroll = scrollRef.current.scrollLeft;
    const targetScroll = direction === 'left' 
      ? currentScroll - scrollAmount * 2
      : currentScroll + scrollAmount * 2;
    
    scrollRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  const containerClasses = {
    small: "gap-2 sm:gap-3",
    medium: "gap-2.5 sm:gap-4",
    large: "gap-3 sm:gap-6"
  };

  const itemWidthClasses = {
    small: "w-[7.25rem] sm:w-32",
    medium: "w-[8.5rem] sm:w-44 md:w-48",
    large: "w-[9.5rem] sm:w-56 md:w-64"
  };

  return (
    <section className={`content-carousel relative group ${className}`}>
      {/* Section Header */}
      <div className="mb-3 flex items-end justify-between gap-4 sm:mb-6">
        <div className="space-y-1 sm:space-y-2">
          <span className="premium-kicker text-[9px] sm:text-[10px]">Curated Rail</span>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="section-heading text-lg sm:text-3xl text-[#F7F1E8]">
              {title}
            </h2>
            <span className="hidden sm:inline-flex premium-chip bg-white/[0.03] text-white/62">
              {isLoading ? 'Loading' : `${contents.length} titles`}
            </span>
          </div>
        </div>
        
        {showViewAll && onViewAll && (
          <button
            onClick={onViewAll}
            className="premium-chip bg-white/[0.03] text-white/62 transition-colors hover:text-white"
          >
            See All
          </button>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative rail-panel px-2.5 py-3 sm:px-4 sm:py-5">
        {/* Left Scroll Button */}
        <button
          className="hidden sm:block absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full border border-white/10 bg-[#090d13]/90 p-2.5 text-white/52 opacity-0 transition-all duration-300 hover:scale-110 hover:text-white group-hover:opacity-100 active:scale-90"
          onClick={() => scrollTo('left')}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Scroll Button */}
        <button
          className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full border border-white/10 bg-[#090d13]/90 p-2.5 text-white/52 opacity-0 transition-all duration-300 hover:scale-110 hover:text-white group-hover:opacity-100 active:scale-90"
          onClick={() => scrollTo('right')}
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className={`flex overflow-x-auto scrollbar-hide ${containerClasses[size]} pb-2 sm:pb-3`}
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          } as React.CSSProperties}
        >
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`flex-shrink-0 ${itemWidthClasses[size]}`}>
                <ContentCardSkeleton size={size} />
              </div>
            ))
          ) : contents.length > 0 ? (
            // Content cards
            contents.map((content) => (
              <div key={`${content.source}-${content.externalId}`} className={`flex-shrink-0 ${itemWidthClasses[size]}`}>
                <ContentCard
                  content={content}
                  size={size}
                  onClick={onContentClick}
                  onAddToLibrary={onAddToLibrary}
                />
              </div>
            ))
          ) : (
            // Empty state
            <div className="flex items-center justify-center w-full h-64 text-[#808080]">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">No content available</p>
                <p className="text-xs text-[#808080]/60">Check back later for updates</p>
              </div>
            </div>
          )}
        </div>

        {/* Fade edges for visual effect */}
        <div className="absolute left-0 top-0 bottom-0 hidden w-14 bg-gradient-to-r from-[#0b0f15] to-transparent pointer-events-none rounded-l-[28px] sm:block" />
        <div className="absolute right-0 top-0 bottom-0 hidden w-14 bg-gradient-to-l from-[#0b0f15] to-transparent pointer-events-none rounded-r-[28px] sm:block" />
      </div>
    </section>
  );
}

export default memo(ContentCarousel);

// Lazy-loaded carousel that only mounts when near the viewport
function LazyCarousel(props: ContentCarouselProps) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '200px' });
  return (
    <div ref={ref}>
      {inView ? <ContentCarousel {...props} /> : <div className="h-56 sm:h-72" />}
    </div>
  );
}

// Multi-section carousel for different content types
interface MultiCarouselProps {
  sections: {
    title: string;
    contents: ContentItem[];
    isLoading?: boolean;
  }[];
  size?: 'small' | 'medium' | 'large';
  eagerSectionTitles?: string[];
  onContentClick?: (content: ContentItem) => void;
  onAddToLibrary?: (content: ContentItem, status: string) => void;
  className?: string;
}

export function MultiContentCarousel({
  sections,
  size = 'medium',
  eagerSectionTitles = [],
  onContentClick,
  onAddToLibrary,
  className = ""
}: MultiCarouselProps) {
  const visibleSections = sections.filter((section) => section.isLoading || section.contents.length > 0);

  return (
    <div className={`space-y-6 sm:space-y-12 ${className}`}>
      {visibleSections.map((section) => (
        eagerSectionTitles.includes(section.title) ? (
          <ContentCarousel
            key={section.title}
            title={section.title}
            contents={section.contents}
            isLoading={section.isLoading}
            size={size}
            onContentClick={onContentClick}
            onAddToLibrary={onAddToLibrary}
          />
        ) : (
          <LazyCarousel
            key={section.title}
            title={section.title}
            contents={section.contents}
            isLoading={section.isLoading}
            size={size}
            onContentClick={onContentClick}
            onAddToLibrary={onAddToLibrary}
          />
        )
      ))}
    </div>
  );
}

// Horizontal scrolling genre tabs
interface GenreTabsProps {
  genres: string[];
  activeGenre?: string;
  onGenreChange?: (genre: string) => void;
  className?: string;
}

export function GenreTabs({
  genres,
  activeGenre,
  onGenreChange,
  className = ""
}: GenreTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 sm:pb-4"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {genres.map((genre) => (
          <button
            key={genre}
            className={`flex-shrink-0 rounded-full px-4 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
              activeGenre === genre
                ? 'bg-[linear-gradient(135deg,#ffe2a7_0%,#ffc562_52%,#ff8b5d_100%)] text-[#0b0d12] shadow-[0_12px_32px_rgba(255,149,87,0.16)]'
                : 'border border-white/10 bg-[#0d1118]/78 text-[#98a2b3] hover:bg-[#101620] hover:text-[#F7F1E8]'
            }`}
            onClick={() => onGenreChange?.(genre)}
          >
            {genre}
          </button>
        ))}
      </div>
      
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-4 hidden w-6 bg-gradient-to-r from-[#0F1014] to-transparent pointer-events-none sm:block" />
      <div className="absolute right-0 top-0 bottom-4 hidden w-6 bg-gradient-to-l from-[#0F1014] to-transparent pointer-events-none sm:block" />
    </div>
  );
}