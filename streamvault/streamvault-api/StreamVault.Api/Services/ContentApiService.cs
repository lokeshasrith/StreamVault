using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using StreamVault.Api.Models;

namespace StreamVault.Api.Services;

public interface IContentApiService
{
    Task<List<Content>> SearchMoviesAsync(string query, int page = 1);
    Task<List<Content>> SearchTvShowsAsync(string query, int page = 1);
    Task<List<Content>> SearchAnimeAsync(string query, int page = 1);
    Task<Content?> GetMovieDetailsAsync(string tmdbId);
    Task<Content?> GetTvShowDetailsAsync(string tmdbId);
    Task<Content?> GetAnimeDetailsAsync(string malId);
    Task<List<Content>> GetTrendingMoviesAsync(int page = 1, string? region = null);
    Task<List<Content>> GetTrendingTvShowsAsync(int page = 1, string? region = null);
    Task<List<Content>> GetTrendingAnimeAsync(int page = 1);
    Task<List<Content>> GetPopularMoviesAsync(int page = 1, string? region = null);
    Task<List<Content>> GetPopularTvShowsAsync(int page = 1, string? region = null);
    Task<List<Content>> GetPopularAnimeAsync(int page = 1);
    Task<List<Content>> GetTopRatedMoviesAsync(int page = 1, string? region = null);
    Task<List<Content>> GetTopRatedTvShowsAsync(int page = 1, string? region = null);
    Task<List<Content>> GetTopRatedAnimeAsync(int page = 1);
    Task<List<Content>> GetUpcomingAnimeAsync(int page = 1);
    Task<TmdbMovieDetails?> GetMovieDetailsRawAsync(string tmdbId);
    Task<TmdbTvDetails?> GetTvDetailsRawAsync(string tmdbId);
    Task<JikanAnime?> GetAnimeDetailsRawAsync(string malId);
    Task<List<Content>> DiscoverMoviesByGenreAsync(string genre, int page = 1);
    Task<List<Content>> DiscoverTvByGenreAsync(string genre, int page = 1);
    Task<List<Content>> DiscoverAnimeByGenreAsync(string genre, int page = 1);
    Task<TmdbSeasonDetails?> GetTvSeasonAsync(string tmdbId, int seasonNumber);
    Task<JikanEpisodesResponse?> GetAnimeEpisodesAsync(string malId, int page = 1);
    Task<JikanEpisodeDetail?> GetAnimeEpisodeDetailAsync(string malId, int episode);
    Task<JikanCharactersResponse?> GetAnimeCharactersAsync(string malId);
    Task<TmdbSeasonDetails?> FindAnimeTmdbSeasonAsync(string animeTitle, int seasonNumber);
    Task<(string? Poster, string? Backdrop)?> FindAnimeTmdbMatchAsync(string animeTitle);
    Task<(string tmdbId, string mediaType)?> FindByImdbIdAsync(string imdbId);
    Task<List<Content>> DiscoverMoviesByCountryAsync(string countryCode, int page = 1);
    Task<List<Content>> DiscoverTvByCountryAsync(string countryCode, int page = 1);
    Task<List<Content>> DiscoverMoviesByCountryRecentAsync(string countryCode, int page = 1);
    Task<List<Content>> DiscoverTvByCountryRecentAsync(string countryCode, int page = 1);
    Task<List<Content>> DiscoverMoviesByLanguageAsync(string langCode, int page = 1);
    Task<List<Content>> DiscoverTvByLanguageAsync(string langCode, int page = 1);
    Task<List<Content>> DiscoverMoviesByLanguageRecentAsync(string langCode, int page = 1);
    Task<List<Content>> DiscoverTvByLanguageRecentAsync(string langCode, int page = 1);
    Task<TmdbPersonDetails?> GetPersonDetailsAsync(string personId);
    Task<JikanPersonFull?> GetJikanPersonDetailsAsync(string malPersonId);
    Task<List<Content>> SearchPersonMoviesAsync(string query, int page = 1);
    Task<List<TmdbPersonSearchResult>> SearchPeopleAsync(string query, int page = 1);
    Task<TmdbWatchProvidersResponse?> GetMovieWatchProvidersAsync(string tmdbId);
    Task<TmdbWatchProvidersResponse?> GetTvWatchProvidersAsync(string tmdbId);
    Task<TmdbRecommendationsResponse?> GetMovieRecommendationsAsync(string tmdbId);
    Task<TmdbRecommendationsResponse?> GetTvRecommendationsAsync(string tmdbId);
    Task<JikanRecommendationsResponse?> GetAnimeRecommendationsAsync(string malId);
}

public class ContentApiService : IContentApiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly IMemoryCache _cache;
    private readonly ImdbApiClient _imdbApi;
    private readonly string _tmdbApiKey;
    private readonly string _tmdbBaseUrl = "https://api.themoviedb.org/3";
    private readonly string _jikanBaseUrl = "https://api.jikan.moe/v4";
    private static readonly TimeSpan JikanCacheDuration = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan TmdbCacheDuration = TimeSpan.FromMinutes(5);
    private static readonly SemaphoreSlim _jikanThrottle = new(1, 1);
    private static readonly SemaphoreSlim _tmdbThrottle = new(8, 8); // Max 8 concurrent TMDB requests

    private static readonly (string Title, int? Year)[] FallbackTrendingMovies =
    {
        ("Dune: Part Two", 2024),
        ("Oppenheimer", 2023),
        ("Spider-Man: Across the Spider-Verse", 2023),
        ("The Dark Knight", 2008),
        ("Inception", 2010),
        ("Mad Max: Fury Road", 2015),
        ("Interstellar", 2014),
        ("Avengers: Endgame", 2019)
    };

    private static readonly (string Title, int? Year)[] FallbackTrendingTv =
    {
        ("Breaking Bad", 2008),
        ("Game of Thrones", 2011),
        ("Stranger Things", 2016),
        ("The Last of Us", 2023),
        ("Severance", 2022),
        ("The Bear", 2022),
        ("Dark", 2017),
        ("Sherlock", 2010)
    };

    private bool HasTmdbApiKey =>
        !string.IsNullOrWhiteSpace(_tmdbApiKey) &&
        !_tmdbApiKey.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase);

    private static string ResolveTmdbApiKey(IConfiguration config)
    {
        static string Clean(string? key) => (key ?? string.Empty).Trim().Trim('"', '\'');

        // Preferred legacy path used by this service
        var key = Clean(config["ExternalApis:TmdbApiKey"]);
        if (!string.IsNullOrWhiteSpace(key)) return key;

        // Explicit environment variable style for ExternalApis section
        key = Clean(config["ExternalApis__TmdbApiKey"]);
        if (!string.IsNullOrWhiteSpace(key)) return key;

        // New options path (supports key rotation in user-secrets)
        var rotated = config.GetSection("Tmdb:ApiKeys").Get<string[]>()
            ?.FirstOrDefault(k => !string.IsNullOrWhiteSpace(k));
        if (!string.IsNullOrWhiteSpace(rotated)) return Clean(rotated);

        key = Clean(config["Tmdb:ApiKey"]);
        if (!string.IsNullOrWhiteSpace(key)) return key;

        // Explicit environment variable style for Tmdb section
        key = Clean(config["Tmdb__ApiKey"]);
        if (!string.IsNullOrWhiteSpace(key)) return key;

        // Optional direct environment variable fallback
        key = Clean(config["TMDB_API_KEY"]);
        if (!string.IsNullOrWhiteSpace(key)) return key;

        return string.Empty;
    }

    public ContentApiService(IHttpClientFactory httpClientFactory, IConfiguration config, IMemoryCache cache, ImdbApiClient imdbApi)
    {
        _httpClient = httpClientFactory.CreateClient();
        _config = config;
        _cache = cache;
        _imdbApi = imdbApi;
        _tmdbApiKey = ResolveTmdbApiKey(_config);
    }

    private async Task<List<Content>> BuildImdbFallbackAsync((string Title, int? Year)[] seeds, ContentType type, int page = 1)
    {
        const int pageSize = 8;
        var pageSeeds = seeds.Skip((page - 1) * pageSize).Take(pageSize).ToArray();
        if (pageSeeds.Length == 0) return new List<Content>();

        var results = new List<Content>();

        foreach (var (title, year) in pageSeeds)
        {
            var matches = await _imdbApi.SearchAsync(title);
            var best = matches.FirstOrDefault(c =>
                    c.Type == type &&
                    (year == null || c.Year == year || c.Title.Equals(title, StringComparison.OrdinalIgnoreCase)))
                ?? matches.FirstOrDefault(c => c.Type == type)
                ?? matches.FirstOrDefault();

            if (best is null) continue;

            best.Type = type;
            if (best.Year is null) best.Year = year;
            results.Add(best);
        }

        var deduped = results
            .GroupBy(c => $"{c.Source}:{c.ExternalId}")
            .Select(g => g.First())
            .ToList();

        if (deduped.Count > 0)
            return deduped;

        var omdb = await BuildOmdbSeedFallbackAsync(seeds, type, page);
        if (omdb.Count > 0)
            return omdb;

        // Final safety net so movie/tv rails are never empty in production.
        return BuildStaticSeedFallback(seeds, type, page);
    }

    private async Task<List<Content>> BuildOmdbSeedFallbackAsync((string Title, int? Year)[] seeds, ContentType type, int page = 1)
    {
        const int pageSize = 8;
        var pageSeeds = seeds.Skip((page - 1) * pageSize).Take(pageSize).ToArray();
        if (pageSeeds.Length == 0) return new List<Content>();

        var results = new List<Content>();

        foreach (var (title, year) in pageSeeds)
        {
            try
            {
                var omdbUrl = $"https://www.omdbapi.com/?t={Uri.EscapeDataString(title)}&apikey=trilogy";
                if (year.HasValue) omdbUrl += $"&y={year.Value}";

                var json = await _httpClient.GetStringAsync(omdbUrl);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (!root.TryGetProperty("Response", out var responseProp) || responseProp.GetString() != "True")
                    continue;

                var poster = root.TryGetProperty("Poster", out var posterProp) ? posterProp.GetString() : null;
                if (string.IsNullOrWhiteSpace(poster) || poster.Equals("N/A", StringComparison.OrdinalIgnoreCase))
                    continue;

                var imdbId = root.TryGetProperty("imdbID", out var idProp) ? idProp.GetString() : null;
                var ratingStr = root.TryGetProperty("imdbRating", out var ratingProp) ? ratingProp.GetString() : null;
                var genres = root.TryGetProperty("Genre", out var genreProp) ? genreProp.GetString() : null;
                var plot = root.TryGetProperty("Plot", out var plotProp) ? plotProp.GetString() : null;
                var yearStr = root.TryGetProperty("Year", out var yearProp) ? yearProp.GetString() : null;

                int? parsedYear = year;
                if (!parsedYear.HasValue && !string.IsNullOrWhiteSpace(yearStr))
                {
                    var firstYear = yearStr.Replace("–", "-").Split('-').FirstOrDefault()?.Trim();
                    if (int.TryParse(firstYear, out var parsed)) parsedYear = parsed;
                }

                decimal? rating = null;
                if (!string.IsNullOrWhiteSpace(ratingStr) &&
                    decimal.TryParse(ratingStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedRating))
                {
                    rating = parsedRating;
                }

                results.Add(new Content
                {
                    ExternalId = string.IsNullOrWhiteSpace(imdbId) ? $"omdb-{type}-{title}" : imdbId,
                    Source = "IMDB",
                    Type = type,
                    Title = title,
                    Year = parsedYear,
                    PosterUrl = poster,
                    BackdropUrl = poster,
                    Rating = rating,
                    GenresCsv = genres,
                    Synopsis = plot
                });
            }
            catch
            {
                // Ignore per-title OMDb failures and continue with other seeds.
            }
        }

        return results
            .GroupBy(c => $"{c.Source}:{c.ExternalId}")
            .Select(g => g.First())
            .ToList();
    }

    private static List<Content> BuildStaticSeedFallback((string Title, int? Year)[] seeds, ContentType type, int page = 1)
    {
        const int pageSize = 8;
        return seeds
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select((seed, idx) => new Content
            {
                ExternalId = $"fallback-{type}-{page}-{idx}",
                Source = type == ContentType.movie ? "TMDB_MOVIE" : "TMDB_TV",
                Type = type,
                Title = seed.Title,
                Year = seed.Year,
                Synopsis = "Curated fallback while upstream movie/TV providers are unavailable.",
                GenresCsv = type == ContentType.movie ? "Drama, Action" : "Drama, Mystery"
            })
            .ToList();
    }

    private async Task<string> GetJikanCachedAsync(string url)
    {
        if (_cache.TryGetValue($"jikan:{url}", out string? cached) && cached != null)
            return cached;

        await _jikanThrottle.WaitAsync();
        try
        {
            // Double-check after acquiring lock
            if (_cache.TryGetValue($"jikan:{url}", out cached) && cached != null)
                return cached;

            var result = await _httpClient.GetStringAsync(url);
            _cache.Set($"jikan:{url}", result, JikanCacheDuration);
            // Jikan rate limit: ~3 req/s - add delay between calls
            await Task.Delay(350);
            return result;
        }
        finally
        {
            _jikanThrottle.Release();
        }
    }

    /// <summary>Throttled + cached TMDB GET to stay under the 40 req/10s rate limit.</summary>
    private async Task<string> GetTmdbCachedAsync(string url)
    {
        if (_cache.TryGetValue($"tmdb:{url}", out string? cached) && cached != null)
            return cached;

        await _tmdbThrottle.WaitAsync();
        try
        {
            if (_cache.TryGetValue($"tmdb:{url}", out cached) && cached != null)
                return cached;

            var result = await _httpClient.GetStringAsync(url);
            _cache.Set($"tmdb:{url}", result, TmdbCacheDuration);
            return result;
        }
        finally
        {
            _tmdbThrottle.Release();
        }
    }

    // Extract trailing year from query (e.g. "The Avengers 2012" → query="The Avengers", year=2012)
    private static (string cleanQuery, int? year) ExtractYear(string query)
    {
        var match = System.Text.RegularExpressions.Regex.Match(query.Trim(), @"^(.+?)\s+((?:19|20)\d{2})\s*$");
        if (match.Success && int.TryParse(match.Groups[2].Value, out var y))
            return (match.Groups[1].Value.Trim(), y);
        return (query, null);
    }

    public async Task<List<Content>> SearchMoviesAsync(string query, int page = 1)
    {
        try
        {
            var (cleanQuery, year) = ExtractYear(query);
            var url = $"{_tmdbBaseUrl}/search/movie?api_key={_tmdbApiKey}&query={Uri.EscapeDataString(cleanQuery)}&page={page}";
            if (year.HasValue) url += $"&year={year.Value}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            
            return tmdbResponse?.Results?.Select(item => MapTmdbMovieToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error searching movies: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> SearchTvShowsAsync(string query, int page = 1)
    {
        try
        {
            var (cleanQuery, year) = ExtractYear(query);
            var url = $"{_tmdbBaseUrl}/search/tv?api_key={_tmdbApiKey}&query={Uri.EscapeDataString(cleanQuery)}&page={page}";
            if (year.HasValue) url += $"&first_air_date_year={year.Value}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            
            return tmdbResponse?.Results?.Select(item => MapTmdbTvToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error searching TV shows: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> SearchAnimeAsync(string query, int page = 1)
    {
        try
        {
            var (cleanQuery, _) = ExtractYear(query);
            var url = $"{_jikanBaseUrl}/anime?q={Uri.EscapeDataString(cleanQuery)}&page={page}&limit=20";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanSearchResponse>(response, JsonOptions());
            
            return jikanResponse?.Data?.Select(item => MapJikanAnimeToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error searching anime: {ex.Message}");
            return new List<Content>();
        }
    }

    /// <summary>Search for a person by name and return their movie/TV credits as Content items.</summary>
    public async Task<List<Content>> SearchPersonMoviesAsync(string query, int page = 1)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/search/person?api_key={_tmdbApiKey}&query={Uri.EscapeDataString(query)}&page={page}";
            var response = await GetTmdbCachedAsync(url);
            var searchResponse = JsonSerializer.Deserialize<TmdbPersonSearchResponse>(response, JsonOptions());

            var topPerson = searchResponse?.Results?.FirstOrDefault();
            if (topPerson == null) return new List<Content>();

            // Fetch person's full credits
            var creditsUrl = $"{_tmdbBaseUrl}/person/{topPerson.Id}/combined_credits?api_key={_tmdbApiKey}";
            var creditsJson = await GetTmdbCachedAsync(creditsUrl);
            var credits = JsonSerializer.Deserialize<TmdbCombinedCredits>(creditsJson, JsonOptions());

            var results = new List<Content>();

            if (credits?.Cast != null)
            {
                foreach (var c in credits.Cast
                    .Where(c => c.VoteCount > 5)
                    .OrderByDescending(c => c.Popularity)
                    .Take(20))
                {
                    var isMovie = c.MediaType == "movie";
                    var dateStr = isMovie ? c.ReleaseDate : c.FirstAirDate;
                    results.Add(new Content
                    {
                        ExternalId = c.Id.ToString(),
                        Source = isMovie ? "TMDB_MOVIE" : "TMDB_TV",
                        Type = isMovie ? ContentType.movie : ContentType.tv,
                        Title = c.Title ?? c.Name ?? "",
                        Year = DateTime.TryParse(dateStr, out var d) ? d.Year : null,
                        PosterUrl = !string.IsNullOrEmpty(c.PosterPath) ? $"https://image.tmdb.org/t/p/w500{c.PosterPath}" : null,
                        Rating = c.VoteAverage > 0 ? (decimal)c.VoteAverage : null,
                        Synopsis = c.Overview
                    });
                }
            }

            return results;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error searching person movies: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<TmdbPersonSearchResult>> SearchPeopleAsync(string query, int page = 1)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/search/person?api_key={_tmdbApiKey}&query={Uri.EscapeDataString(query)}&page={page}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbPersonSearchResponse>(response, JsonOptions());

            return tmdbResponse?.Results?
                .Where(p => !string.IsNullOrWhiteSpace(p.Name))
                .OrderByDescending(p => p.Popularity)
                .ToList() ?? new List<TmdbPersonSearchResult>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error searching people: {ex.Message}");
            return new List<TmdbPersonSearchResult>();
        }
    }

    public async Task<Content?> GetMovieDetailsAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/movie/{tmdbId}?api_key={_tmdbApiKey}&append_to_response=credits,videos";
            var response = await GetTmdbCachedAsync(url);
            var movie = JsonSerializer.Deserialize<TmdbMovieDetails>(response, JsonOptions());
            
            return movie != null ? MapTmdbMovieDetailsToContent(movie) : null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting movie details: {ex.Message}");
            return null;
        }
    }

    public async Task<Content?> GetTvShowDetailsAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/tv/{tmdbId}?api_key={_tmdbApiKey}&append_to_response=credits,videos";
            var response = await GetTmdbCachedAsync(url);
            var tvShow = JsonSerializer.Deserialize<TmdbTvDetails>(response, JsonOptions());
            
            return tvShow != null ? MapTmdbTvDetailsToContent(tvShow) : null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting TV show details: {ex.Message}");
            return null;
        }
    }

    public async Task<Content?> GetAnimeDetailsAsync(string malId)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/anime/{malId}/full";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanAnimeDetailsResponse>(response, JsonOptions());
            
            return jikanResponse?.Data != null ? MapJikanAnimeDetailsToContent(jikanResponse.Data) : null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting anime details: {ex.Message}");
            return null;
        }
    }

    public async Task<TmdbMovieDetails?> GetMovieDetailsRawAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/movie/{tmdbId}?api_key={_tmdbApiKey}&append_to_response=credits,videos";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbMovieDetails>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting raw movie details: {ex.Message}");
            return null;
        }
    }

    public async Task<TmdbTvDetails?> GetTvDetailsRawAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/tv/{tmdbId}?api_key={_tmdbApiKey}&append_to_response=credits,videos";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbTvDetails>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting raw TV details: {ex.Message}");
            return null;
        }
    }

    public async Task<JikanAnime?> GetAnimeDetailsRawAsync(string malId)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/anime/{malId}/full";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanAnimeDetailsResponse>(response, JsonOptions());
            return jikanResponse?.Data;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting raw anime details: {ex.Message}");
            return null;
        }
    }

    public async Task<List<Content>> GetTrendingMoviesAsync(int page = 1, string? region = null)
    {
        if (!HasTmdbApiKey)
            return await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);

        try
        {
            var url = $"{_tmdbBaseUrl}/trending/movie/week?api_key={_tmdbApiKey}&page={page}";
            if (!string.IsNullOrEmpty(region)) url += $"&region={region}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            
            var mapped = tmdbResponse?.Results?.Select(MapTmdbMovieToContent).ToList() ?? new List<Content>();
            return mapped.Count > 0
                ? mapped
                : await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting trending movies: {ex.Message}");
            return await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);
        }
    }

    public async Task<List<Content>> GetTrendingTvShowsAsync(int page = 1, string? region = null)
    {
        if (!HasTmdbApiKey)
            return await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);

        try
        {
            var url = $"{_tmdbBaseUrl}/trending/tv/week?api_key={_tmdbApiKey}&page={page}";
            if (!string.IsNullOrEmpty(region)) url += $"&region={region}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            
            var mapped = tmdbResponse?.Results?.Select(MapTmdbTvToContent).ToList() ?? new List<Content>();
            return mapped.Count > 0
                ? mapped
                : await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting trending TV shows: {ex.Message}");
            return await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);
        }
    }

    public async Task<List<Content>> GetTrendingAnimeAsync(int page = 1)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/top/anime?page={page}&limit=20";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanSearchResponse>(response, JsonOptions());
            
            return jikanResponse?.Data?.Select(item => MapJikanAnimeToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting trending anime: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> GetPopularMoviesAsync(int page = 1, string? region = null)
    {
        if (!HasTmdbApiKey)
            return await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);

        try
        {
            var url = $"{_tmdbBaseUrl}/movie/popular?api_key={_tmdbApiKey}&page={page}";
            if (!string.IsNullOrEmpty(region)) url += $"&region={region}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            
            var mapped = tmdbResponse?.Results?.Select(MapTmdbMovieToContent).ToList() ?? new List<Content>();
            return mapped.Count > 0
                ? mapped
                : await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting popular movies: {ex.Message}");
            return await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);
        }
    }

    public async Task<List<Content>> GetPopularTvShowsAsync(int page = 1, string? region = null)
    {
        if (!HasTmdbApiKey)
            return await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);

        try
        {
            var url = $"{_tmdbBaseUrl}/tv/popular?api_key={_tmdbApiKey}&page={page}";
            if (!string.IsNullOrEmpty(region)) url += $"&region={region}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            
            var mapped = tmdbResponse?.Results?.Select(MapTmdbTvToContent).ToList() ?? new List<Content>();
            return mapped.Count > 0
                ? mapped
                : await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting popular TV shows: {ex.Message}");
            return await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);
        }
    }

    public async Task<List<Content>> GetPopularAnimeAsync(int page = 1)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/top/anime?filter=bypopularity&page={page}&limit=20";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanSearchResponse>(response, JsonOptions());
            
            return jikanResponse?.Data?.Select(item => MapJikanAnimeToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting popular anime: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> GetTopRatedMoviesAsync(int page = 1, string? region = null)
    {
        if (!HasTmdbApiKey)
            return await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);

        try
        {
            var url = $"{_tmdbBaseUrl}/movie/top_rated?api_key={_tmdbApiKey}&page={page}";
            if (!string.IsNullOrEmpty(region)) url += $"&region={region}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            
            var mapped = tmdbResponse?.Results?.Select(MapTmdbMovieToContent).ToList() ?? new List<Content>();
            return mapped.Count > 0
                ? mapped
                : await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting top rated movies: {ex.Message}");
            return await BuildImdbFallbackAsync(FallbackTrendingMovies, ContentType.movie, page);
        }
    }

    public async Task<List<Content>> GetTopRatedTvShowsAsync(int page = 1, string? region = null)
    {
        if (!HasTmdbApiKey)
            return await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);

        try
        {
            var url = $"{_tmdbBaseUrl}/tv/top_rated?api_key={_tmdbApiKey}&page={page}";
            if (!string.IsNullOrEmpty(region)) url += $"&region={region}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            
            var mapped = tmdbResponse?.Results?.Select(MapTmdbTvToContent).ToList() ?? new List<Content>();
            return mapped.Count > 0
                ? mapped
                : await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting top rated TV shows: {ex.Message}");
            return await BuildImdbFallbackAsync(FallbackTrendingTv, ContentType.tv, page);
        }
    }

    public async Task<List<Content>> GetTopRatedAnimeAsync(int page = 1)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/top/anime?page={page}&limit=20";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanSearchResponse>(response, JsonOptions());
            
            return jikanResponse?.Data?.Select(item => MapJikanAnimeToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting top rated anime: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> GetUpcomingAnimeAsync(int page = 1)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/seasons/upcoming?page={page}&limit=20";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanSearchResponse>(response, JsonOptions());

            return jikanResponse?.Data?
                .Select(item =>
                {
                    var mapped = MapJikanAnimeToContent(item);
                    mapped.GenresCsv = string.IsNullOrWhiteSpace(mapped.GenresCsv)
                        ? "Upcoming"
                        : $"{mapped.GenresCsv},Upcoming";
                    return mapped;
                })
                .ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting upcoming anime: {ex.Message}");
            return new List<Content>();
        }
    }

    // Mapping methods
    private static Content MapTmdbMovieToContent(TmdbMovie movie) => new()
    {
        ExternalId = movie.Id.ToString(),
        Source = "TMDB_MOVIE",
        Type = ContentType.movie,
        Title = movie.Title ?? "",
        Year = ParseYear(movie.ReleaseDate),
        PosterUrl = !string.IsNullOrEmpty(movie.PosterPath) ? $"https://image.tmdb.org/t/p/w500{movie.PosterPath}" : null,
        BackdropUrl = !string.IsNullOrEmpty(movie.BackdropPath) ? $"https://image.tmdb.org/t/p/original{movie.BackdropPath}" : null,
        Rating = movie.VoteAverage != 0 ? (decimal)movie.VoteAverage : null,
        Synopsis = movie.Overview,
        GenresCsv = movie.GenreIds != null ? string.Join(",", movie.GenreIds.Select(id => GetTmdbGenreName(id)).Where(g => !string.IsNullOrEmpty(g))) : null
    };

    private static Content MapTmdbTvToContent(TmdbTvShow tv) => new()
    {
        ExternalId = tv.Id.ToString(),
        Source = "TMDB_TV",
        Type = ContentType.tv,
        Title = tv.Name ?? "",
        Year = ParseYear(tv.FirstAirDate),
        PosterUrl = !string.IsNullOrEmpty(tv.PosterPath) ? $"https://image.tmdb.org/t/p/w500{tv.PosterPath}" : null,
        BackdropUrl = !string.IsNullOrEmpty(tv.BackdropPath) ? $"https://image.tmdb.org/t/p/original{tv.BackdropPath}" : null,
        Rating = tv.VoteAverage != 0 ? (decimal)tv.VoteAverage : null,
        Synopsis = tv.Overview,
        GenresCsv = tv.GenreIds != null ? string.Join(",", tv.GenreIds.Select(id => GetTmdbGenreName(id)).Where(g => !string.IsNullOrEmpty(g))) : null
    };

    /// <summary>Rewrite myanimelist.net image URLs to use cdn.myanimelist.net for reliable access.</summary>
    private static string? ToCdnUrl(string? url) =>
        string.IsNullOrEmpty(url) ? url : url.Replace("://myanimelist.net/", "://cdn.myanimelist.net/");

    private static Content MapJikanAnimeToContent(JikanAnime anime) => new()
    {
        ExternalId = anime.MalId.ToString(),
        Source = "MAL_ANIME",
        Type = ContentType.anime,
        Title = anime.TitleEnglish ?? anime.Title ?? "",
        Year = anime.Year,
        Episodes = anime.Episodes,
        PosterUrl = ToCdnUrl(
            anime.Images?.Webp?.LargeImageUrl
            ?? anime.Images?.Jpg?.LargeImageUrl
            ?? anime.Images?.Webp?.ImageUrl
            ?? anime.Images?.Jpg?.ImageUrl
        ),
        BackdropUrl = ToCdnUrl(
            anime.Images?.Webp?.LargeImageUrl
            ?? anime.Images?.Jpg?.LargeImageUrl
            ?? anime.Images?.Webp?.ImageUrl
            ?? anime.Images?.Jpg?.ImageUrl
        ),
        Rating = anime.Score is > 0 ? (decimal)anime.Score.Value : null,
        Synopsis = anime.Synopsis,
        GenresCsv = anime.Genres != null ? string.Join(",", anime.Genres.Select(g => g.Name).Where(g => !string.IsNullOrEmpty(g))) : null
    };

    private static Content MapTmdbMovieDetailsToContent(TmdbMovieDetails movie) => new()
    {
        ExternalId = movie.Id.ToString(),
        Source = "TMDB_MOVIE",
        Type = ContentType.movie,
        Title = movie.Title ?? "",
        Year = ParseYear(movie.ReleaseDate),
        PosterUrl = !string.IsNullOrEmpty(movie.PosterPath) ? $"https://image.tmdb.org/t/p/w500{movie.PosterPath}" : null,
        BackdropUrl = !string.IsNullOrEmpty(movie.BackdropPath) ? $"https://image.tmdb.org/t/p/original{movie.BackdropPath}" : null,
        Rating = movie.VoteAverage != 0 ? (decimal)movie.VoteAverage : null,
        Synopsis = movie.Overview,
        BudgetUSD = movie.Budget > 0 ? movie.Budget : null,
        RevenueUSD = movie.Revenue > 0 ? movie.Revenue : null,
        GenresCsv = movie.Genres != null ? string.Join(",", movie.Genres.Select(g => g.Name).Where(g => !string.IsNullOrEmpty(g))) : null
    };

    private static Content MapTmdbTvDetailsToContent(TmdbTvDetails tv) => new()
    {
        ExternalId = tv.Id.ToString(),
        Source = "TMDB_TV",
        Type = ContentType.tv,
        Title = tv.Name ?? "",
        Year = ParseYear(tv.FirstAirDate),
        Episodes = tv.NumberOfEpisodes,
        Seasons = tv.NumberOfSeasons,
        PosterUrl = !string.IsNullOrEmpty(tv.PosterPath) ? $"https://image.tmdb.org/t/p/w500{tv.PosterPath}" : null,
        BackdropUrl = !string.IsNullOrEmpty(tv.BackdropPath) ? $"https://image.tmdb.org/t/p/original{tv.BackdropPath}" : null,
        Rating = tv.VoteAverage != 0 ? (decimal)tv.VoteAverage : null,
        Synopsis = tv.Overview,
        GenresCsv = tv.Genres != null ? string.Join(",", tv.Genres.Select(g => g.Name).Where(g => !string.IsNullOrEmpty(g))) : null
    };

    private static Content MapJikanAnimeDetailsToContent(JikanAnime anime) => new()
    {
        ExternalId = anime.MalId.ToString(),
        Source = "MAL_ANIME",
        Type = ContentType.anime,
        Title = anime.Title ?? "",
        Year = anime.Year,
        Episodes = anime.Episodes,
        PosterUrl = ToCdnUrl(
            anime.Images?.Webp?.LargeImageUrl
            ?? anime.Images?.Jpg?.LargeImageUrl
            ?? anime.Images?.Webp?.ImageUrl
            ?? anime.Images?.Jpg?.ImageUrl
        ),
        BackdropUrl = ToCdnUrl(
            anime.Images?.Webp?.LargeImageUrl
            ?? anime.Images?.Jpg?.LargeImageUrl
            ?? anime.Images?.Webp?.ImageUrl
            ?? anime.Images?.Jpg?.ImageUrl
        ),
        Rating = anime.Score is > 0 ? (decimal)anime.Score.Value : null,
        Synopsis = anime.Synopsis,
        GenresCsv = anime.Genres != null ? string.Join(",", anime.Genres.Select(g => g.Name).Where(g => !string.IsNullOrEmpty(g))) : null
    };

    private static string GetTmdbGenreName(int genreId) => genreId switch
    {
        28 => "Action",
        12 => "Adventure", 
        16 => "Animation",
        35 => "Comedy",
        80 => "Crime",
        99 => "Documentary",
        18 => "Drama",
        10751 => "Family",
        14 => "Fantasy",
        36 => "History",
        27 => "Horror",
        10402 => "Music",
        9648 => "Mystery",
        10749 => "Romance",
        878 => "Science Fiction",
        10770 => "TV Movie",
        53 => "Thriller",
        10752 => "War",
        37 => "Western",
        _ => ""
    };

    private static int? ParseYear(string? dateStr) =>
        DateTime.TryParse(dateStr, out var d) ? d.Year : null;

    private static readonly Dictionary<string, int> TmdbGenreNameToId = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Action"] = 28, ["Adventure"] = 12, ["Animation"] = 16, ["Comedy"] = 35,
        ["Crime"] = 80, ["Documentary"] = 99, ["Drama"] = 18, ["Family"] = 10751,
        ["Fantasy"] = 14, ["History"] = 36, ["Horror"] = 27, ["Music"] = 10402,
        ["Mystery"] = 9648, ["Romance"] = 10749, ["Science Fiction"] = 878,
        ["TV Movie"] = 10770, ["Thriller"] = 53, ["War"] = 10752, ["Western"] = 37,
        // TV-specific genres
        ["Action & Adventure"] = 10759, ["Kids"] = 10762, ["News"] = 10763,
        ["Reality"] = 10764, ["Sci-Fi & Fantasy"] = 10765, ["Soap"] = 10766,
        ["Talk"] = 10767, ["War & Politics"] = 10768
    };

    private static readonly Dictionary<string, int> JikanGenreNameToId = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Action"] = 1, ["Adventure"] = 2, ["Comedy"] = 4, ["Drama"] = 8,
        ["Fantasy"] = 10, ["Horror"] = 14, ["Mystery"] = 7, ["Romance"] = 22,
        ["Sci-Fi"] = 24, ["Thriller"] = 41, ["Sports"] = 30, ["Supernatural"] = 37,
        ["Slice of Life"] = 36, ["Music"] = 19, ["Ecchi"] = 9,
        ["Award Winning"] = 46, ["Suspense"] = 41, ["Avant Garde"] = 5,
        ["Boys Love"] = 28, ["Girls Love"] = 26, ["Gourmet"] = 47,
        // Demographic / theme genres exposed in the genre list
        ["Isekai"] = 62, ["Mecha"] = 18, ["School"] = 23,
        ["Seinen"] = 42, ["Shojo"] = 25, ["Shonen"] = 27
    };

    public async Task<TmdbSeasonDetails?> GetTvSeasonAsync(string tmdbId, int seasonNumber)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/tv/{tmdbId}/season/{seasonNumber}?api_key={_tmdbApiKey}&append_to_response=videos";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbSeasonDetails>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting TV season details: {ex.Message}");
            return null;
        }
    }

    public async Task<JikanEpisodesResponse?> GetAnimeEpisodesAsync(string malId, int page = 1)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/anime/{malId}/episodes?page={page}";
            var response = await GetJikanCachedAsync(url);
            return JsonSerializer.Deserialize<JikanEpisodesResponse>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting anime episodes: {ex.Message}");
            return null;
        }
    }

    public async Task<JikanEpisodeDetail?> GetAnimeEpisodeDetailAsync(string malId, int episode)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/anime/{malId}/episodes/{episode}";
            var response = await GetJikanCachedAsync(url);
            var parsed = JsonSerializer.Deserialize<JikanEpisodeDetailResponse>(response, JsonOptions());
            return parsed?.Data;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting anime episode detail: {ex.Message}");
            return null;
        }
    }

    public async Task<JikanCharactersResponse?> GetAnimeCharactersAsync(string malId)
    {
        try
        {
            var url = $"{_jikanBaseUrl}/anime/{malId}/characters";
            var response = await GetJikanCachedAsync(url);
            return JsonSerializer.Deserialize<JikanCharactersResponse>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting anime characters: {ex.Message}");
            return null;
        }
    }

    private async Task<int?> FindAnimeTmdbTvIdAsync(string animeTitle)
    {
        var cacheKey = $"anime-tmdb-tvid:{animeTitle}";
        if (_cache.TryGetValue(cacheKey, out int? cachedId))
            return cachedId;

        var searchUrl = $"{_tmdbBaseUrl}/search/tv?api_key={_tmdbApiKey}&query={Uri.EscapeDataString(animeTitle)}&page=1";
        var searchResponse = await GetTmdbCachedAsync(searchUrl);
        var searchResult = JsonSerializer.Deserialize<TmdbTvSearchResponse>(searchResponse, JsonOptions());
        var tvId = searchResult?.Results?.FirstOrDefault()?.Id;
        _cache.Set(cacheKey, tvId, TimeSpan.FromHours(6));
        return tvId;
    }

    public async Task<(string? Poster, string? Backdrop)?> FindAnimeTmdbMatchAsync(string animeTitle)
    {
        var cacheKey = $"anime-tmdb-match:{animeTitle}";
        if (_cache.TryGetValue(cacheKey, out (string? Poster, string? Backdrop) cached))
            return cached;

        try
        {
            var tvId = await FindAnimeTmdbTvIdAsync(animeTitle);
            if (tvId == null) return null;

            var url = $"{_tmdbBaseUrl}/tv/{tvId}?api_key={_tmdbApiKey}";
            var response = await GetTmdbCachedAsync(url);
            var tv = JsonSerializer.Deserialize<TmdbTvDetails>(response, JsonOptions());
            if (tv == null) return null;

            var poster = !string.IsNullOrEmpty(tv.PosterPath) ? $"https://image.tmdb.org/t/p/w780{tv.PosterPath}" : null;
            var backdrop = !string.IsNullOrEmpty(tv.BackdropPath) ? $"https://image.tmdb.org/t/p/original{tv.BackdropPath}" : null;

            var result = (poster, backdrop);
            _cache.Set(cacheKey, result, TimeSpan.FromHours(6));
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error finding anime TMDB match: {ex.Message}");
            return null;
        }
    }

    public async Task<TmdbSeasonDetails?> FindAnimeTmdbSeasonAsync(string animeTitle, int seasonNumber)
    {
        var cacheKey = $"anime-tmdb-season:{animeTitle}:{seasonNumber}";
        if (_cache.TryGetValue(cacheKey, out TmdbSeasonDetails? cached))
            return cached;

        try
        {
            var tvId = await FindAnimeTmdbTvIdAsync(animeTitle);
            if (tvId == null) return null;

            // Fetch the season episodes (with still_path screenshots)
            var seasonUrl = $"{_tmdbBaseUrl}/tv/{tvId}/season/{seasonNumber}?api_key={_tmdbApiKey}";
            var seasonResponse = await GetTmdbCachedAsync(seasonUrl);
            var season = JsonSerializer.Deserialize<TmdbSeasonDetails>(seasonResponse, JsonOptions());

            if (season != null)
                _cache.Set(cacheKey, season, TimeSpan.FromHours(6));

            return season;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error finding anime on TMDB: {ex.Message}");
            return null;
        }
    }

    public async Task<List<Content>> DiscoverMoviesByGenreAsync(string genre, int page = 1)
    {
        if (!TmdbGenreNameToId.TryGetValue(genre, out var genreId))
            return new List<Content>();
        try
        {
            var url = $"{_tmdbBaseUrl}/discover/movie?api_key={_tmdbApiKey}&with_genres={genreId}&sort_by=popularity.desc&page={page}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbMovieToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering movies by genre: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> DiscoverTvByGenreAsync(string genre, int page = 1)
    {
        if (!TmdbGenreNameToId.TryGetValue(genre, out var genreId))
            return new List<Content>();
        try
        {
            var url = $"{_tmdbBaseUrl}/discover/tv?api_key={_tmdbApiKey}&with_genres={genreId}&sort_by=popularity.desc&page={page}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbTvToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering TV by genre: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> DiscoverAnimeByGenreAsync(string genre, int page = 1)
    {
        if (!JikanGenreNameToId.TryGetValue(genre, out var genreId))
            return new List<Content>();
        try
        {
            var url = $"{_jikanBaseUrl}/anime?genres={genreId}&order_by=popularity&sort=asc&page={page}&limit=25";
            var response = await GetJikanCachedAsync(url);
            var jikanResponse = JsonSerializer.Deserialize<JikanSearchResponse>(response, JsonOptions());
            return jikanResponse?.Data?.Select(item => MapJikanAnimeToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering anime by genre: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<(string tmdbId, string mediaType)?> FindByImdbIdAsync(string imdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/find/{Uri.EscapeDataString(imdbId)}?api_key={_tmdbApiKey}&external_source=imdb_id";
            var response = await GetTmdbCachedAsync(url);
            using var doc = System.Text.Json.JsonDocument.Parse(response);
            var root = doc.RootElement;

            // Check movie_results first
            if (root.TryGetProperty("movie_results", out var movies) && movies.GetArrayLength() > 0)
            {
                var first = movies[0];
                if (first.TryGetProperty("id", out var idProp))
                    return (idProp.GetInt32().ToString(), "movie");
            }
            // Then TV results
            if (root.TryGetProperty("tv_results", out var tvs) && tvs.GetArrayLength() > 0)
            {
                var first = tvs[0];
                if (first.TryGetProperty("id", out var idProp))
                    return (idProp.GetInt32().ToString(), "tv");
            }
            return null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error finding TMDB by IMDb ID: {ex.Message}");
            return null;
        }
    }

    public async Task<List<Content>> DiscoverMoviesByCountryAsync(string countryCode, int page = 1)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/discover/movie?api_key={_tmdbApiKey}&with_origin_country={countryCode}&sort_by=popularity.desc&page={page}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbMovieToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering movies for {countryCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> DiscoverTvByCountryAsync(string countryCode, int page = 1)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/discover/tv?api_key={_tmdbApiKey}&with_origin_country={countryCode}&sort_by=popularity.desc&page={page}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbTvToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering TV for {countryCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    /// <summary>Recent popular movies from a country (released in last 6 months).</summary>
    public async Task<List<Content>> DiscoverMoviesByCountryRecentAsync(string countryCode, int page = 1)
    {
        try
        {
            var minDate = DateTime.UtcNow.AddMonths(-6).ToString("yyyy-MM-dd");
            var maxDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var url = $"{_tmdbBaseUrl}/discover/movie?api_key={_tmdbApiKey}&with_origin_country={countryCode}&sort_by=popularity.desc&page={page}&primary_release_date.gte={minDate}&primary_release_date.lte={maxDate}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbMovieToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering recent movies for {countryCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    /// <summary>Recent popular TV from a country (aired in last 6 months).</summary>
    public async Task<List<Content>> DiscoverTvByCountryRecentAsync(string countryCode, int page = 1)
    {
        try
        {
            var minDate = DateTime.UtcNow.AddMonths(-6).ToString("yyyy-MM-dd");
            var maxDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var url = $"{_tmdbBaseUrl}/discover/tv?api_key={_tmdbApiKey}&with_origin_country={countryCode}&sort_by=popularity.desc&page={page}&first_air_date.gte={minDate}&first_air_date.lte={maxDate}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbTvToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering recent TV for {countryCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> DiscoverMoviesByLanguageAsync(string langCode, int page = 1)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/discover/movie?api_key={_tmdbApiKey}&with_original_language={langCode}&sort_by=popularity.desc&page={page}&vote_count.gte=10";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbMovieToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering movies for language {langCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<List<Content>> DiscoverTvByLanguageAsync(string langCode, int page = 1)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/discover/tv?api_key={_tmdbApiKey}&with_original_language={langCode}&sort_by=popularity.desc&page={page}&vote_count.gte=10";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbTvToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering TV for language {langCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    /// <summary>Recent popular movies in a given language (last 6 months).</summary>
    public async Task<List<Content>> DiscoverMoviesByLanguageRecentAsync(string langCode, int page = 1)
    {
        try
        {
            var minDate = DateTime.UtcNow.AddMonths(-6).ToString("yyyy-MM-dd");
            var maxDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var url = $"{_tmdbBaseUrl}/discover/movie?api_key={_tmdbApiKey}&with_original_language={langCode}&sort_by=popularity.desc&page={page}&primary_release_date.gte={minDate}&primary_release_date.lte={maxDate}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbMovieToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering recent movies for language {langCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    /// <summary>Recent popular TV in a given language (last 6 months).</summary>
    public async Task<List<Content>> DiscoverTvByLanguageRecentAsync(string langCode, int page = 1)
    {
        try
        {
            var minDate = DateTime.UtcNow.AddMonths(-6).ToString("yyyy-MM-dd");
            var maxDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var url = $"{_tmdbBaseUrl}/discover/tv?api_key={_tmdbApiKey}&with_original_language={langCode}&sort_by=popularity.desc&page={page}&first_air_date.gte={minDate}&first_air_date.lte={maxDate}";
            var response = await GetTmdbCachedAsync(url);
            var tmdbResponse = JsonSerializer.Deserialize<TmdbTvSearchResponse>(response, JsonOptions());
            return tmdbResponse?.Results?.Select(item => MapTmdbTvToContent(item)).ToList() ?? new List<Content>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error discovering recent TV for language {langCode}: {ex.Message}");
            return new List<Content>();
        }
    }

    public async Task<TmdbPersonDetails?> GetPersonDetailsAsync(string personId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/person/{personId}?api_key={_tmdbApiKey}&append_to_response=combined_credits";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbPersonDetails>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting person details for {personId}: {ex.Message}");
            return null;
        }
    }

    public async Task<JikanPersonFull?> GetJikanPersonDetailsAsync(string malPersonId)
    {
        try
        {
            var url = $"https://api.jikan.moe/v4/people/{malPersonId}/full";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JikanPersonFullResponse>(json, JsonOptions());
            return result?.Data;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting Jikan person details for {malPersonId}: {ex.Message}");
            return null;
        }
    }

    private static JsonSerializerOptions JsonOptions() => new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    // ─── Watch Providers & Recommendations ────────────────────────────────────

    public async Task<TmdbWatchProvidersResponse?> GetMovieWatchProvidersAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/movie/{tmdbId}/watch/providers?api_key={_tmdbApiKey}";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbWatchProvidersResponse>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting movie watch providers for {tmdbId}: {ex.Message}");
            return null;
        }
    }

    public async Task<TmdbWatchProvidersResponse?> GetTvWatchProvidersAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/tv/{tmdbId}/watch/providers?api_key={_tmdbApiKey}";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbWatchProvidersResponse>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting TV watch providers for {tmdbId}: {ex.Message}");
            return null;
        }
    }

    public async Task<TmdbRecommendationsResponse?> GetMovieRecommendationsAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/movie/{tmdbId}/recommendations?api_key={_tmdbApiKey}";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbRecommendationsResponse>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting movie recommendations for {tmdbId}: {ex.Message}");
            return null;
        }
    }

    public async Task<TmdbRecommendationsResponse?> GetTvRecommendationsAsync(string tmdbId)
    {
        try
        {
            var url = $"{_tmdbBaseUrl}/tv/{tmdbId}/recommendations?api_key={_tmdbApiKey}";
            var response = await GetTmdbCachedAsync(url);
            return JsonSerializer.Deserialize<TmdbRecommendationsResponse>(response, JsonOptions());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting TV recommendations for {tmdbId}: {ex.Message}");
            return null;
        }
    }

    public async Task<JikanRecommendationsResponse?> GetAnimeRecommendationsAsync(string malId)
    {
        try
        {
            await _jikanThrottle.WaitAsync();
            try
            {
                var cacheKey = $"jikan_recs_{malId}";
                if (_cache.TryGetValue(cacheKey, out JikanRecommendationsResponse? cached))
                    return cached;

                var url = $"{_jikanBaseUrl}/anime/{malId}/recommendations";
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();
                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<JikanRecommendationsResponse>(json, JsonOptions());
                if (result != null)
                    _cache.Set(cacheKey, result, JikanCacheDuration);
                return result;
            }
            finally
            {
                await Task.Delay(350); // Jikan rate-limit
                _jikanThrottle.Release();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting anime recommendations for {malId}: {ex.Message}");
            return null;
        }
    }
}