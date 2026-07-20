import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Star, Film, Tv, TrendingUp, TrendingDown, Clock, ChevronDown, ChevronUp, ExternalLink, Award, Newspaper, Ruler, Sparkles } from 'lucide-react';
import { discoverApi, getImageUrl, type PersonDetails, type PersonCredit, type PersonNewsItem, PLACEHOLDER_POSTER } from '../api/discoverApi';

interface PersonProfileModalProps {
  personId: number | null;
  personSource?: string;
  onClose: () => void;
  onMovieClick?: (mediaType: string, id: number) => void;
}

function CreditCard({ credit, onClick }: { credit: PersonCredit; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-28 text-center group cursor-pointer snap-start"
    >
      <div className="w-28 h-40 rounded-lg overflow-hidden bg-[#1C1E24] mb-2 ring-1 ring-[#2A2D35] group-hover:ring-[#808080]/40 transition-all">
        {credit.posterPath ? (
          <img
            src={getImageUrl(credit.posterPath, 'small')}
            alt={credit.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_POSTER; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-[#808080]/30" />
          </div>
        )}
      </div>
      <p className="text-xs text-[#E5E5E5] font-medium truncate group-hover:text-white">{credit.title}</p>
      {credit.character && (
        <p className="text-[10px] text-[#808080] truncate">{credit.character}</p>
      )}
      <div className="flex items-center justify-center gap-1 mt-0.5">
        {credit.voteAverage > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/70">
            <Star className="w-2.5 h-2.5 fill-current" />
            {credit.voteAverage}
          </span>
        )}
        {credit.year && <span className="text-[10px] text-[#808080]/60">{credit.year}</span>}
      </div>
    </button>
  );
}

function FilmographySection({ title, icon: Icon, credits, iconColor, onMovieClick }: {
  title: string;
  icon: typeof Film;
  credits: PersonCredit[];
  iconColor: string;
  onMovieClick?: (mediaType: string, id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (credits.length === 0) return null;

  const visibleCredits = expanded ? credits : credits.slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#E5E5E5]">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          {title}
          <span className="text-[#808080]/60 font-normal">({credits.length})</span>
        </h3>
        {credits.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-[#808080] hover:text-[#E5E5E5] transition-colors cursor-pointer"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all</>}
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-px-1">
        {visibleCredits.map((credit) => (
          <CreditCard
            key={`${credit.id}-${credit.character || credit.title}`}
            credit={credit}
            onClick={() => onMovieClick?.(credit.mediaType, credit.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function PersonProfileModal({ personId, personSource, onClose, onMovieClick }: PersonProfileModalProps) {
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch result must be stored in state */
  useEffect(() => {
    if (!personId) return;

    let cancelled = false;
    setLoading(true);
    setBioExpanded(false);
    discoverApi.getPersonDetails(personId, personSource)
      .then((data) => { if (!cancelled) setPerson(data); })
      .catch(() => { if (!cancelled) setPerson(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; setPerson(null); };
  }, [personId, personSource]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!personId) return null;

  const bioTruncLen = 400;
  const bioText = person?.biography || '';
  const bioNeedsTruncation = bioText.length > bioTruncLen;
  const displayBio = bioExpanded ? bioText : bioText.slice(0, bioTruncLen) + (bioNeedsTruncation ? '…' : '');

  return (
    <AnimatePresence>
      {personId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="person-modal fixed inset-0 z-[60] flex items-end sm:items-start justify-center pt-0 sm:pt-16 pb-0 sm:pb-8 px-0 sm:px-4 overflow-y-auto"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-3xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[85vh] rounded-none sm:rounded-xl bg-[#0F1014] border border-[#2A2D35] shadow-2xl overflow-hidden mx-0 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-[max(env(safe-area-inset-top),0.75rem)] sm:top-4 right-3 sm:right-4 z-10 p-2 rounded-lg bg-[#1C1E24] hover:bg-[#25272E] text-[#808080] hover:text-[#E5E5E5] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#808080]" />
              </div>
            ) : person ? (
              <div className="p-3 sm:p-4 md:p-8 pt-[calc(1.75rem+env(safe-area-inset-top))] sm:pt-4 space-y-5 md:space-y-8 overflow-y-auto max-h-[calc(100dvh-0.5rem)] sm:max-h-[80vh] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-6">
                {/* Header: Photo + Info */}
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  <div className="flex-shrink-0 mx-auto md:mx-0">
                    <div className="w-28 h-40 md:w-40 md:h-56 rounded-xl overflow-hidden bg-[#1C1E24] ring-1 ring-[#2A2D35]">
                      {person.profilePath ? (
                        <img
                          src={getImageUrl(person.profilePath, 'medium')}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-12 h-12 text-[#808080]/30" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2 md:space-y-3 text-center md:text-left">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-white">{person.name}</h2>
                      {person.knownFor && (
                        <p className="text-sm text-[#808080] mt-0.5">{person.knownFor}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 md:gap-3 justify-center md:justify-start">
                      {person.age && (
                        <div className="flex items-center gap-1.5 text-xs md:text-sm text-[#808080]">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{person.age} years old</span>
                        </div>
                      )}
                      {person.birthday && (
                        <div className="flex items-center gap-1.5 text-xs md:text-sm text-[#808080]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Born {new Date(person.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                      {person.placeOfBirth && (
                        <div className="flex items-center gap-1.5 text-xs md:text-sm text-[#808080]">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{person.placeOfBirth}</span>
                        </div>
                      )}
                      {person.height && (
                        <div className="flex items-center gap-1.5 text-xs md:text-sm text-[#808080]">
                          <Ruler className="w-3.5 h-3.5" />
                          <span>{person.height}</span>
                        </div>
                      )}
                    </div>

                    {person.gender && (
                      <p className="text-xs text-[#808080]/60">{person.gender}</p>
                    )}

                    {person.deathday && (
                      <p className="text-xs text-red-400/60">Died: {new Date(person.deathday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    )}

                    {person.alsoKnownAs && person.alsoKnownAs.length > 0 && (
                      <p className="text-xs text-[#808080]/50">Also known as: {person.alsoKnownAs.join(', ')}</p>
                    )}

                    {person.imdbId && (
                      <a
                        href={`https://www.imdb.com/name/${person.imdbId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> IMDb Profile
                      </a>
                    )}

                    <div className="flex flex-wrap gap-4 pt-1 justify-center md:justify-start">
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">{person.totalMovies}</p>
                        <p className="text-[10px] text-[#808080]/60 uppercase">Movies</p>
                      </div>
                      {person.totalTvShows > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-[#E5E5E5]">{person.totalTvShows}</p>
                          <p className="text-[10px] text-[#808080]/60 uppercase">TV Shows</p>
                        </div>
                      )}

                    </div>

                    {/* Best & Worst */}
                    {(person.highestRatedMovie || person.lowestRatedMovie) && (
                      <div className="flex flex-wrap gap-3 pt-1 justify-center md:justify-start">
                        {person.highestRatedMovie && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400/70">
                            <TrendingUp className="w-3 h-3" />
                            <span>Best: {person.highestRatedMovie.title} ({person.highestRatedMovie.voteAverage})</span>
                          </div>
                        )}
                        {person.lowestRatedMovie && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400/60">
                            <TrendingDown className="w-3 h-3" />
                            <span>Worst: {person.lowestRatedMovie.title} ({person.lowestRatedMovie.voteAverage})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Biography */}
                {bioText && (
                  <div>
                    <h3 className="text-sm font-semibold text-[#808080] uppercase tracking-wider mb-2">Biography</h3>
                    <p className="text-sm text-[#E5E5E5]/80 leading-relaxed">
                      {displayBio}
                      {bioNeedsTruncation && (
                        <button
                          onClick={() => setBioExpanded(!bioExpanded)}
                          className="ml-1 text-[#E50914] hover:text-[#F5C518] text-sm cursor-pointer"
                        >
                          {bioExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </p>
                  </div>
                )}

                {/* Awards */}
                {person.awards && person.awards.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#808080] uppercase tracking-wider mb-3">
                      <Award className="w-4 h-4 text-amber-400" /> Awards & Recognition
                    </h3>
                    <div className="space-y-2">
                      {person.awards.map((award, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-[#E5E5E5]/70">
                          <Star className="w-3 h-3 mt-1 text-amber-400/50 flex-shrink-0 fill-current" />
                          <span>{award}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trivia */}
                {person.trivia && person.trivia.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#808080] uppercase tracking-wider mb-3">
                      <Sparkles className="w-4 h-4 text-[#E50914]" /> Did You Know?
                    </h3>
                    <div className="space-y-2">
                      {person.trivia.map((fact, i) => (
                        <p key={i} className="text-sm text-[#808080] leading-relaxed pl-4 border-l-2 border-[#2A2D35]">
                          {fact}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latest News */}
                {person.latestNews && person.latestNews.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#808080] uppercase tracking-wider mb-3">
                      <Newspaper className="w-4 h-4 text-blue-400" /> Latest News
                    </h3>
                    <div className="space-y-3">
                      {person.latestNews.map((news: PersonNewsItem, i: number) => (
                        <a
                          key={i}
                          href={news.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-lg bg-[#16181D] border border-[#2A2D35] hover:bg-[#1C1E24] transition-colors"
                        >
                          <p className="text-sm font-medium text-[#E5E5E5] mb-1">{news.title}</p>
                          <p className="text-xs text-[#808080] line-clamp-2">{news.snippet}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filmography Sections */}
                <div className="space-y-6">
                  <FilmographySection
                    title="Upcoming"
                    icon={Clock}
                    credits={person.upcomingMovies}
                    iconColor="text-blue-400"
                    onMovieClick={onMovieClick}
                  />

                  <FilmographySection
                    title="All Movies & Shows"
                    icon={Film}
                    credits={person.previousMovies}
                    iconColor="text-white/40"
                    onMovieClick={onMovieClick}
                  />
                  {person.crewCredits.length > 0 && (
                    <FilmographySection
                      title="Behind the Camera"
                      icon={Tv}
                      credits={person.crewCredits}
                      iconColor="text-purple-400"
                      onMovieClick={onMovieClick}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-32 text-white/30">
                Person not found
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
