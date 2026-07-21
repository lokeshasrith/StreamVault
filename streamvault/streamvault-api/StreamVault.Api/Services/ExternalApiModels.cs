using System.Text.Json.Serialization;

namespace StreamVault.Api.Services;

// TMDB Response Models
public class TmdbSearchResponse
{
    public int Page { get; set; }
    public List<TmdbMovie>? Results { get; set; }
    public int TotalPages { get; set; }
    public int TotalResults { get; set; }
}

public class TmdbTvSearchResponse
{
    public int Page { get; set; }
    public List<TmdbTvShow>? Results { get; set; }
    public int TotalPages { get; set; }
    public int TotalResults { get; set; }
}

public class TmdbMovie
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string? Overview { get; set; }
    
    [JsonPropertyName("poster_path")]
    public string? PosterPath { get; set; }
    
    [JsonPropertyName("backdrop_path")]
    public string? BackdropPath { get; set; }
    
    [JsonPropertyName("release_date")]
    public string? ReleaseDate { get; set; }
    
    [JsonPropertyName("vote_average")]
    public double VoteAverage { get; set; }
    
    [JsonPropertyName("vote_count")]
    public int VoteCount { get; set; }
    
    [JsonPropertyName("genre_ids")]
    public List<int>? GenreIds { get; set; }
    
    public bool Adult { get; set; }
    
    [JsonPropertyName("original_language")]
    public string? OriginalLanguage { get; set; }
    
    [JsonPropertyName("original_title")]
    public string? OriginalTitle { get; set; }
}

public class TmdbTvShow
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Overview { get; set; }
    
    [JsonPropertyName("poster_path")]
    public string? PosterPath { get; set; }
    
    [JsonPropertyName("backdrop_path")]
    public string? BackdropPath { get; set; }
    
    [JsonPropertyName("first_air_date")]
    public string? FirstAirDate { get; set; }
    
    [JsonPropertyName("vote_average")]
    public double VoteAverage { get; set; }
    
    [JsonPropertyName("vote_count")]
    public int VoteCount { get; set; }
    
    [JsonPropertyName("genre_ids")]
    public List<int>? GenreIds { get; set; }
    
    [JsonPropertyName("original_language")]
    public string? OriginalLanguage { get; set; }
    
    [JsonPropertyName("original_name")]
    public string? OriginalName { get; set; }
}

public class TmdbMovieDetails : TmdbMovie
{
    public List<TmdbGenre>? Genres { get; set; }
    public int Runtime { get; set; }
    public long Budget { get; set; }
    public long Revenue { get; set; }
    public string? Status { get; set; }
    public string? Tagline { get; set; }
    public TmdbCredits? Credits { get; set; }
    public TmdbVideos? Videos { get; set; }
    
    [JsonPropertyName("imdb_id")]
    public string? ImdbId { get; set; }
}

public class TmdbTvDetails : TmdbTvShow
{
    public List<TmdbGenre>? Genres { get; set; }
    
    [JsonPropertyName("number_of_episodes")]
    public int NumberOfEpisodes { get; set; }
    
    [JsonPropertyName("number_of_seasons")]
    public int NumberOfSeasons { get; set; }
    
    public string? Status { get; set; }
    public string? Tagline { get; set; }
    public TmdbCredits? Credits { get; set; }
    public TmdbVideos? Videos { get; set; }
    
    [JsonPropertyName("last_air_date")]
    public string? LastAirDate { get; set; }
    
    [JsonPropertyName("episode_run_time")]
    public List<int>? EpisodeRunTime { get; set; }
}

public class TmdbGenre
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class TmdbCredits
{
    public List<TmdbCast>? Cast { get; set; }
    public List<TmdbCrew>? Crew { get; set; }
}

public class TmdbCast
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Character { get; set; } = "";
    
    [JsonPropertyName("profile_path")]
    public string? ProfilePath { get; set; }
    
    public int Order { get; set; }
}

public class TmdbCrew
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Job { get; set; } = "";
    public string Department { get; set; } = "";
    
    [JsonPropertyName("profile_path")]
    public string? ProfilePath { get; set; }
}

public class TmdbVideos  
{
    public List<TmdbVideo>? Results { get; set; }
}

public class TmdbVideo
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string Site { get; set; } = "";
    public string Type { get; set; } = "";
    public bool Official { get; set; }
}

// Jikan (MyAnimeList) Response Models
public class JikanSearchResponse
{
    public List<JikanAnime>? Data { get; set; }
    public JikanPagination? Pagination { get; set; }
}

public class JikanAnimeDetailsResponse
{
    public JikanAnime? Data { get; set; }
}

public class JikanAnime
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    
    public string? Title { get; set; }
    
    [JsonPropertyName("title_english")]
    public string? TitleEnglish { get; set; }
    
    [JsonPropertyName("title_japanese")]
    public string? TitleJapanese { get; set; }
    
    public string? Synopsis { get; set; }
    public int? Episodes { get; set; }
    public string? Status { get; set; }
    public int? Year { get; set; }
    public double? Score { get; set; }
    
    [JsonPropertyName("scored_by")]
    public int? ScoredBy { get; set; }
    
    public int? Rank { get; set; }
    public int? Popularity { get; set; }
    public JikanImages? Images { get; set; }
    public List<JikanGenre>? Genres { get; set; }
    public List<JikanStudio>? Studios { get; set; }
    
    [JsonPropertyName("aired")]
    public JikanAired? Aired { get; set; }
    
    public string? Duration { get; set; }
    public string? Rating { get; set; }
    public string? Source { get; set; }
    public string? Season { get; set; }
    public JikanTrailer? Trailer { get; set; }
    public JikanBroadcast? Broadcast { get; set; }
    public List<JikanNamedEntity>? Themes { get; set; }
    public List<JikanNamedEntity>? Demographics { get; set; }
    public List<JikanNamedEntity>? Licensors { get; set; }
    public List<JikanNamedEntity>? Producers { get; set; }
}

public class JikanBroadcast
{
    public string? Day { get; set; }
    public string? Time { get; set; }
    public string? Timezone { get; set; }
    public string? String { get; set; }
}

public class JikanNamedEntity
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    public string Name { get; set; } = "";
    public string? Type { get; set; }
    public string? Url { get; set; }
}

public class JikanTrailer
{
    [JsonPropertyName("youtube_id")]
    public string? YoutubeId { get; set; }
    public string? Url { get; set; }
}

public class JikanImages
{
    public JikanImageUrls? Jpg { get; set; }
    public JikanImageUrls? Webp { get; set; }
}

public class JikanImageUrls
{
    [JsonPropertyName("image_url")]
    public string? ImageUrl { get; set; }
    
    [JsonPropertyName("small_image_url")]
    public string? SmallImageUrl { get; set; }
    
    [JsonPropertyName("large_image_url")]
    public string? LargeImageUrl { get; set; }
}

public class JikanGenre
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
}

public class JikanStudio
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    
    public string Name { get; set; } = "";
}

public class JikanAired
{
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public JikanDateProp? Prop { get; set; }
}

public class JikanDateProp
{
    public JikanDate? From { get; set; }
    public JikanDate? To { get; set; }
}

public class JikanDate
{
    public int? Day { get; set; }
    public int? Month { get; set; }
    public int? Year { get; set; }
}

public class JikanPagination
{
    [JsonPropertyName("last_visible_page")]
    public int LastVisiblePage { get; set; }
    
    [JsonPropertyName("has_next_page")]
    public bool HasNextPage { get; set; }
    
    [JsonPropertyName("current_page")]
    public int CurrentPage { get; set; }
    
    public JikanPaginationItems? Items { get; set; }
}

public class JikanPaginationItems
{
    public int Count { get; set; }
    public int Total { get; set; }
    
    [JsonPropertyName("per_page")]
    public int PerPage { get; set; }
}

// ─── Jikan Characters ─────────────────────────────────────────────────────

public class JikanCharactersResponse
{
    public List<JikanCharacterEntry>? Data { get; set; }
}

public class JikanCharacterEntry
{
    public JikanCharacterInfo? Character { get; set; }
    public string? Role { get; set; }
    
    [JsonPropertyName("voice_actors")]
    public List<JikanVoiceActor>? VoiceActors { get; set; }
}

public class JikanCharacterInfo
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    public string? Name { get; set; }
    public JikanImages? Images { get; set; }
}

public class JikanVoiceActor
{
    public JikanPersonInfo? Person { get; set; }
    public string? Language { get; set; }
}

public class JikanPersonInfo
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    public string? Name { get; set; }
    public JikanImages? Images { get; set; }
}

// ─── Jikan Person Full Details ────────────────────────────────────────────

public class JikanPersonFullResponse
{
    public JikanPersonFull? Data { get; set; }
}

public class JikanPersonFull
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    public string? Name { get; set; }
    
    [JsonPropertyName("given_name")]
    public string? GivenName { get; set; }
    
    [JsonPropertyName("family_name")]
    public string? FamilyName { get; set; }
    
    [JsonPropertyName("alternate_names")]
    public List<string>? AlternateNames { get; set; }
    
    public string? Birthday { get; set; }
    public int? Favorites { get; set; }
    public string? About { get; set; }
    public JikanImages? Images { get; set; }
    
    public List<JikanPersonVoiceRole>? Voices { get; set; }
    public List<JikanPersonAnimeRole>? Anime { get; set; }
}

public class JikanPersonVoiceRole
{
    public string? Role { get; set; }
    public JikanPersonAnimeRef? Anime { get; set; }
    public JikanPersonCharacterRef? Character { get; set; }
}

public class JikanPersonAnimeRole
{
    public string? Position { get; set; }
    public JikanPersonAnimeRef? Anime { get; set; }
}

public class JikanPersonAnimeRef
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    public string? Title { get; set; }
    public JikanImages? Images { get; set; }
}

public class JikanPersonCharacterRef
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    public string? Name { get; set; }
    public JikanImages? Images { get; set; }
}

// ─── TMDB Season/Episode models ───────────────────────────────────────────

public class TmdbSeasonDetails
{
    public int Id { get; set; }
    
    [JsonPropertyName("season_number")]
    public int SeasonNumber { get; set; }
    
    public string? Name { get; set; }
    public string? Overview { get; set; }
    
    [JsonPropertyName("poster_path")]
    public string? PosterPath { get; set; }
    
    [JsonPropertyName("air_date")]
    public string? AirDate { get; set; }
    
    public List<TmdbEpisode>? Episodes { get; set; }
    
    public TmdbVideos? Videos { get; set; }
}

public class TmdbEpisode
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Overview { get; set; }
    
    [JsonPropertyName("episode_number")]
    public int EpisodeNumber { get; set; }
    
    [JsonPropertyName("season_number")]
    public int SeasonNumber { get; set; }
    
    [JsonPropertyName("air_date")]
    public string? AirDate { get; set; }
    
    [JsonPropertyName("vote_average")]
    public double VoteAverage { get; set; }
    
    [JsonPropertyName("vote_count")]
    public int VoteCount { get; set; }
    
    public int? Runtime { get; set; }
    
    [JsonPropertyName("still_path")]
    public string? StillPath { get; set; }
}

// ─── Jikan Episode models ─────────────────────────────────────────────────

public class JikanEpisodesResponse
{
    public List<JikanEpisode>? Data { get; set; }
    public JikanPagination? Pagination { get; set; }
}

public class JikanEpisode
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    
    public string? Title { get; set; }
    
    [JsonPropertyName("title_japanese")]
    public string? TitleJapanese { get; set; }
    
    [JsonPropertyName("title_romanji")]
    public string? TitleRomanji { get; set; }
    
    public string? Aired { get; set; }
    public double? Score { get; set; }
    public bool Filler { get; set; }
    public bool Recap { get; set; }
    
    [JsonPropertyName("forum_url")]
    public string? ForumUrl { get; set; }
}

public class JikanEpisodeDetailResponse
{
    public JikanEpisodeDetail? Data { get; set; }
}

public class JikanEpisodeDetail
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    
    public string? Title { get; set; }
    
    [JsonPropertyName("title_japanese")]
    public string? TitleJapanese { get; set; }
    
    [JsonPropertyName("title_romanji")]
    public string? TitleRomanji { get; set; }
    
    public int? Duration { get; set; }
    public string? Aired { get; set; }
    public bool Filler { get; set; }
    public bool Recap { get; set; }
    public string? Synopsis { get; set; }
}

// ─── TMDB Person Models ──────────────────────────────────────────────────────

public class TmdbPersonDetails
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Biography { get; set; }
    public string? Birthday { get; set; }
    public string? Deathday { get; set; }
    [JsonPropertyName("place_of_birth")]
    public string? PlaceOfBirth { get; set; }
    [JsonPropertyName("profile_path")]
    public string? ProfilePath { get; set; }
    [JsonPropertyName("known_for_department")]
    public string? KnownForDepartment { get; set; }
    public int Gender { get; set; }
    public double Popularity { get; set; }
    [JsonPropertyName("also_known_as")]
    public List<string>? AlsoKnownAs { get; set; }
    [JsonPropertyName("imdb_id")]
    public string? ImdbId { get; set; }
    public string? Homepage { get; set; }
    [JsonPropertyName("combined_credits")]
    public TmdbCombinedCredits? CombinedCredits { get; set; }
}

public class TmdbCombinedCredits
{
    public List<TmdbPersonCreditCast>? Cast { get; set; }
    public List<TmdbPersonCreditCrew>? Crew { get; set; }
}

public class TmdbPersonCreditCast
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string? Name { get; set; }
    [JsonPropertyName("media_type")]
    public string? MediaType { get; set; }
    public string? Character { get; set; }
    [JsonPropertyName("release_date")]
    public string? ReleaseDate { get; set; }
    [JsonPropertyName("first_air_date")]
    public string? FirstAirDate { get; set; }
    [JsonPropertyName("poster_path")]
    public string? PosterPath { get; set; }
    [JsonPropertyName("vote_average")]
    public double VoteAverage { get; set; }
    [JsonPropertyName("vote_count")]
    public int VoteCount { get; set; }
    public double Popularity { get; set; }
    public string? Overview { get; set; }
}

public class TmdbPersonCreditCrew
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string? Name { get; set; }
    [JsonPropertyName("media_type")]
    public string? MediaType { get; set; }
    public string? Job { get; set; }
    public string? Department { get; set; }
    [JsonPropertyName("release_date")]
    public string? ReleaseDate { get; set; }
    [JsonPropertyName("first_air_date")]
    public string? FirstAirDate { get; set; }
    [JsonPropertyName("poster_path")]
    public string? PosterPath { get; set; }
    [JsonPropertyName("vote_average")]
    public double VoteAverage { get; set; }
    [JsonPropertyName("vote_count")]
    public int VoteCount { get; set; }
    public double Popularity { get; set; }
}

// TMDB Person Search
public class TmdbPersonSearchResponse
{
    public List<TmdbPersonSearchResult>? Results { get; set; }
}

public class TmdbPersonSearchResult
{
    public int Id { get; set; }
    public string? Name { get; set; }
    [JsonPropertyName("known_for_department")]
    public string? KnownForDepartment { get; set; }
    [JsonPropertyName("profile_path")]
    public string? ProfilePath { get; set; }
    public double Popularity { get; set; }
    [JsonPropertyName("known_for")]
    public List<TmdbPersonKnownFor>? KnownFor { get; set; }
}

public class TmdbPersonKnownFor
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string? Name { get; set; }
    [JsonPropertyName("media_type")]
    public string? MediaType { get; set; }
    [JsonPropertyName("poster_path")]
    public string? PosterPath { get; set; }
    [JsonPropertyName("backdrop_path")]
    public string? BackdropPath { get; set; }
    [JsonPropertyName("release_date")]
    public string? ReleaseDate { get; set; }
    [JsonPropertyName("first_air_date")]
    public string? FirstAirDate { get; set; }
    [JsonPropertyName("vote_average")]
    public double VoteAverage { get; set; }
    [JsonPropertyName("vote_count")]
    public int VoteCount { get; set; }
    public double Popularity { get; set; }
    public string? Overview { get; set; }
    [JsonPropertyName("genre_ids")]
    public List<int>? GenreIds { get; set; }
}

// ─── TMDB Watch Providers ────────────────────────────────────────────────────

public class TmdbWatchProvidersResponse
{
    public int Id { get; set; }
    public Dictionary<string, TmdbCountryProviders>? Results { get; set; }
}

public class TmdbCountryProviders
{
    public string? Link { get; set; }
    public List<TmdbProvider>? Flatrate { get; set; }
    public List<TmdbProvider>? Rent { get; set; }
    public List<TmdbProvider>? Buy { get; set; }
    public List<TmdbProvider>? Free { get; set; }
}

public class TmdbProvider
{
    [JsonPropertyName("provider_id")]
    public int ProviderId { get; set; }
    [JsonPropertyName("provider_name")]
    public string ProviderName { get; set; } = "";
    [JsonPropertyName("logo_path")]
    public string? LogoPath { get; set; }
    [JsonPropertyName("display_priority")]
    public int DisplayPriority { get; set; }
}

// ─── TMDB Recommendations ────────────────────────────────────────────────────

public class TmdbRecommendationsResponse
{
    public int Page { get; set; }
    public List<TmdbRecommendation>? Results { get; set; }
    [JsonPropertyName("total_results")]
    public int TotalResults { get; set; }
}

public class TmdbRecommendation
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string? Name { get; set; }
    public string? Overview { get; set; }
    [JsonPropertyName("poster_path")]
    public string? PosterPath { get; set; }
    [JsonPropertyName("backdrop_path")]
    public string? BackdropPath { get; set; }
    [JsonPropertyName("release_date")]
    public string? ReleaseDate { get; set; }
    [JsonPropertyName("first_air_date")]
    public string? FirstAirDate { get; set; }
    [JsonPropertyName("vote_average")]
    public double VoteAverage { get; set; }
    [JsonPropertyName("vote_count")]
    public int VoteCount { get; set; }
    [JsonPropertyName("media_type")]
    public string? MediaType { get; set; }
    [JsonPropertyName("genre_ids")]
    public List<int>? GenreIds { get; set; }
}

// ─── Jikan Recommendations ──────────────────────────────────────────────────

public class JikanRecommendationsResponse
{
    public List<JikanRecommendationEntry>? Data { get; set; }
}

public class JikanRecommendationEntry
{
    public JikanRecommendationItem? Entry { get; set; }
    public int Votes { get; set; }
}

public class JikanRecommendationItem
{
    [JsonPropertyName("mal_id")]
    public int MalId { get; set; }
    public string? Title { get; set; }
    public string? Url { get; set; }
    public JikanImages? Images { get; set; }
}

public class JikanNewsResponse
{
    public List<JikanNewsItem>? Data { get; set; }
}

public class JikanNewsItem
{
    public string? Title { get; set; }
    public string? Url { get; set; }
    public string? Excerpt { get; set; }
    public string? Date { get; set; }
    public JikanUserRef? Author { get; set; }
}

public class JikanUserRef
{
    public string? Username { get; set; }
}

public class JikanReviewsResponse
{
    public List<JikanReviewItem>? Data { get; set; }
}

public class JikanReviewItem
{
    public JikanReviewUser? User { get; set; }
    public string? Review { get; set; }
    public int? Score { get; set; }
    public string? Date { get; set; }
    [JsonPropertyName("is_spoiler")]
    public bool IsSpoiler { get; set; }
    [JsonPropertyName("is_preliminary")]
    public bool IsPreliminary { get; set; }
    public JikanReactionSummary? Reactions { get; set; }
}

public class JikanReviewUser
{
    public string? Username { get; set; }
    public JikanImages? Images { get; set; }
}

public class JikanReactionSummary
{
    public int Overall { get; set; }
  }