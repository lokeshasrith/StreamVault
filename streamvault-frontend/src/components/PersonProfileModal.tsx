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

function DetailPill({ icon: Icon, children }: { icon: typeof Film; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[#F4EFE6]/78 backdrop-blur-sm sm:text-sm">
      <Icon className="h-3.5 w-3.5 text-[#FFC562]" />
      <span>{children}</span>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-xl font-semibold text-[#FFF7EA] sm:text-2xl">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#FFD7A0]/62">{label}</p>
    </div>
  );
}

function CreditCard({ credit, onClick }: { credit: PersonCredit; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="person-credit-card group w-32 flex-shrink-0 cursor-pointer snap-start text-left"
    >
      <div className="mb-3 overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(17,21,29,0.96)_0%,rgba(9,12,18,0.9)_100%)] shadow-[0_18px_38px_rgba(0,0,0,0.28)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#FFC562]/40 group-hover:shadow-[0_24px_44px_rgba(0,0,0,0.34)]">
        {credit.posterPath ? (
          <img
            src={getImageUrl(credit.posterPath, 'small')}
            alt={credit.title}
            className="h-44 w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_POSTER; }}
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,197,98,0.12),transparent_48%),linear-gradient(180deg,rgba(20,25,34,0.96)_0%,rgba(9,12,18,0.9)_100%)]">
            <Film className="h-8 w-8 text-[#FFC562]/30" />
          </div>
        )}
      </div>
      <p className="truncate text-sm font-semibold text-[#F6EFE2] transition-colors group-hover:text-white">{credit.title}</p>
      {credit.character && (
        <p className="truncate text-[11px] text-[#C7B8A0]/76">{credit.character}</p>
      )}
      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#F4EFE6]/46">
        {credit.voteAverage > 0 && (
          <span className="inline-flex items-center gap-1 text-[#FFC562]/78">
            <Star className="h-2.5 w-2.5 fill-current" />
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
    <section className="space-y-4 rounded-[28px] border border-white/7 bg-[linear-gradient(180deg,rgba(15,19,27,0.84)_0%,rgba(8,11,17,0.72)_100%)] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#FFE2B0]/76">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
          <span className="font-normal text-[#F4EFE6]/36">({credits.length})</span>
        </h3>
        {credits.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-[#F4EFE6]/62 transition-colors hover:text-white"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all</>}
          </button>
        )}
      </div>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-px-1">
        {visibleCredits.map((credit) => (
          <CreditCard
            key={`${credit.id}-${credit.character || credit.title}`}
            credit={credit}
            onClick={() => onMovieClick?.(credit.mediaType, credit.id)}
          />
        ))}
      </div>
    </section>
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
          <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,122,74,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(90,211,255,0.14),transparent_26%),rgba(4,6,10,0.82)] backdrop-blur-md" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="premium-panel relative mx-0 h-[100dvh] w-full max-w-4xl overflow-hidden rounded-none border-white/10 sm:mx-4 sm:h-auto sm:max-h-[88vh] sm:rounded-[32px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(255,197,98,0.18),transparent_52%),radial-gradient(circle_at_top_right,rgba(90,211,255,0.12),transparent_44%)]" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-10 rounded-2xl border border-white/10 bg-black/30 p-2 text-[#F4EFE6]/58 backdrop-blur-sm transition-all hover:bg-black/45 hover:text-white sm:right-4 sm:top-4"
            >
              <X className="w-5 h-5" />
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#808080]" />
              </div>
            ) : person ? (
              <div className="max-h-[calc(100dvh-0.5rem)] space-y-6 overflow-y-auto p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1.75rem+env(safe-area-inset-top))] sm:max-h-[82vh] sm:p-5 sm:pb-6 sm:pt-5 md:space-y-8 md:p-8">
                {/* Header: Photo + Info */}
                <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,197,98,0.12)_0%,transparent_28%),linear-gradient(180deg,rgba(17,21,29,0.96)_0%,rgba(9,12,18,0.9)_100%)] p-4 shadow-[0_28px_60px_rgba(0,0,0,0.3)] sm:p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:gap-7">
                    <div className="mx-auto flex-shrink-0 md:mx-0">
                      <div className="hero-media-shell w-36 h-48 md:w-44 md:h-64 rounded-[26px]">
                      {person.profilePath ? (
                        <img
                          src={getImageUrl(person.profilePath, 'medium')}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,197,98,0.12),transparent_48%),linear-gradient(180deg,rgba(20,25,34,0.96)_0%,rgba(9,12,18,0.9)_100%)]">
                          <Film className="h-12 w-12 text-[#FFC562]/28" />
                        </div>
                      )}
                    </div>
                  </div>

                    <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
                      <div className="space-y-2">
                        <p className="premium-kicker justify-center md:justify-start">Spotlight Profile</p>
                        <div>
                          <h2 className="section-heading text-4xl text-[#FFF7EA] sm:text-5xl">{person.name}</h2>
                      {person.knownFor && (
                            <p className="mt-2 max-w-2xl text-sm text-[#F4EFE6]/66 sm:text-base">{person.knownFor}</p>
                      )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        {person.age && (
                          <DetailPill icon={Calendar}>{person.age} years old</DetailPill>
                        )}
                        {person.birthday && (
                          <DetailPill icon={Clock}>{new Date(person.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</DetailPill>
                        )}
                        {person.placeOfBirth && (
                          <DetailPill icon={MapPin}>{person.placeOfBirth}</DetailPill>
                        )}
                        {person.height && (
                          <DetailPill icon={Ruler}>{person.height}</DetailPill>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-center md:justify-start text-sm text-[#F4EFE6]/58">
                        {person.gender && (
                          <p>{person.gender}</p>
                        )}

                        {person.deathday && (
                          <p className="text-red-300/75">Died {new Date(person.deathday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        )}

                        {person.alsoKnownAs && person.alsoKnownAs.length > 0 && (
                          <p className="max-w-2xl">Also known as {person.alsoKnownAs.join(', ')}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                        <StatBlock label="Movies" value={person.totalMovies} />
                        {person.totalTvShows > 0 && (
                          <StatBlock label="TV Shows" value={person.totalTvShows} />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                        {person.highestRatedMovie && (
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-400/8 px-3 py-2 text-xs text-emerald-200/82 sm:text-sm">
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span>Best: {person.highestRatedMovie.title} ({person.highestRatedMovie.voteAverage})</span>
                          </div>
                        )}
                        {person.lowestRatedMovie && (
                          <div className="inline-flex items-center gap-2 rounded-full border border-red-400/16 bg-red-400/8 px-3 py-2 text-xs text-red-200/78 sm:text-sm">
                            <TrendingDown className="h-3.5 w-3.5" />
                            <span>Worst: {person.lowestRatedMovie.title} ({person.lowestRatedMovie.voteAverage})</span>
                          </div>
                        )}
                      </div>

                      {person.imdbId && (
                        <a
                          href={`https://www.imdb.com/name/${person.imdbId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-[#FFC562]/24 bg-[#FFC562]/10 px-4 py-2 text-sm font-medium text-[#FFE4B0] transition-colors hover:bg-[#FFC562]/16 hover:text-[#FFF4DD]"
                        >
                          <ExternalLink className="h-4 w-4" /> IMDb Profile
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Biography */}
                {bioText && (
                  <section className="rounded-[28px] border border-white/7 bg-[linear-gradient(180deg,rgba(14,18,25,0.84)_0%,rgba(8,11,17,0.72)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#FFD7A0]/70">Biography</h3>
                    <p className="max-w-3xl text-sm leading-7 text-[#F4EFE6]/80 sm:text-[15px]">
                      {displayBio}
                      {bioNeedsTruncation && (
                        <button
                          onClick={() => setBioExpanded(!bioExpanded)}
                          className="ml-2 cursor-pointer font-medium text-[#FFC562] transition-colors hover:text-[#FFF2D3]"
                        >
                          {bioExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </p>
                  </section>
                )}

                {/* Awards */}
                {person.awards && person.awards.length > 0 && (
                  <section className="rounded-[28px] border border-white/7 bg-[linear-gradient(180deg,rgba(14,18,25,0.82)_0%,rgba(8,11,17,0.7)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#FFD7A0]/70">
                      <Award className="w-4 h-4 text-amber-400" /> Awards & Recognition
                    </h3>
                    <div className="space-y-2">
                      {person.awards.map((award, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-3 text-sm text-[#F4EFE6]/72">
                          <Star className="mt-1 h-3 w-3 flex-shrink-0 fill-current text-amber-400/70" />
                          <span>{award}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Trivia */}
                {person.trivia && person.trivia.length > 0 && (
                  <section className="rounded-[28px] border border-white/7 bg-[linear-gradient(180deg,rgba(14,18,25,0.82)_0%,rgba(8,11,17,0.7)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#FFD7A0]/70">
                      <Sparkles className="w-4 h-4 text-[#FF8A5C]" /> Did You Know?
                    </h3>
                    <div className="space-y-2">
                      {person.trivia.map((fact, i) => (
                        <p key={i} className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm leading-7 text-[#F4EFE6]/70">
                          {fact}
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                {/* Latest News */}
                {person.latestNews && person.latestNews.length > 0 && (
                  <section className="rounded-[28px] border border-white/7 bg-[linear-gradient(180deg,rgba(14,18,25,0.82)_0%,rgba(8,11,17,0.7)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#FFD7A0]/70">
                      <Newspaper className="w-4 h-4 text-blue-400" /> Latest News
                    </h3>
                    <div className="space-y-3">
                      {person.latestNews.map((news: PersonNewsItem, i: number) => (
                        <a
                          key={i}
                          href={news.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(18,23,31,0.92)_0%,rgba(11,14,20,0.84)_100%)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5AD3FF]/34 hover:bg-[#1C1E24]"
                        >
                          <p className="mb-1 text-sm font-semibold text-[#F6EFE2]">{news.title}</p>
                          <p className="line-clamp-2 text-xs leading-6 text-[#F4EFE6]/56">{news.snippet}</p>
                        </a>
                      ))}
                    </div>
                  </section>
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
