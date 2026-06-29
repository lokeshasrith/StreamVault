using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using StreamVault.Api.Data;
using StreamVault.Api.Services;
using StreamVault.Api.Models;

namespace StreamVault.Api.Controllers;

[ApiController]
[Route("api/discover")]
public sealed class DiscoverController : ControllerBase
{
    private sealed class NewsResponseItem
    {
        public string? title { get; set; }
        public string? url { get; set; }
        public string? snippet { get; set; }
        public string? source { get; set; }
        public string? category { get; set; }
        public string? imageUrl { get; set; }
        public string? publishedAt { get; set; }
    }

    private readonly IContentApiService _contentApiService;
    private readonly YouTubeClient _youtube;
    private readonly AnimeDbClient _animeDb;
    private readonly OmdbClient _omdb;
    private readonly WebSearchClient _webSearch;
    private readonly NewsApiClient _newsApi;
    private readonly ImdbApiClient _imdbApi;
    private readonly IMemoryCache _cache;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<DiscoverController> _logger;

    private static readonly (string Title, int? Year)[] IndianTrendingMovieSeeds =
    {
        ("Kalki 2898 AD", 2024),
        ("Stree 2", 2024),
        ("Fighter", 2024),
        ("Animal", 2023),
        ("Jawan", 2023),
        ("Pathaan", 2023),
        ("Leo", 2023),
        ("Salaar", 2023),
        ("12th Fail", 2023),
        ("Munjya", 2024),
        ("Laapataa Ladies", 2024),
        ("Crew", 2024),
        ("Kill", 2024),
        ("Article 370", 2024),
        ("Sita Ramam", 2022),
        ("K.G.F: Chapter 2", 2022),
    };

    public DiscoverController(
        IContentApiService contentApiService,
        YouTubeClient youtube,
        AnimeDbClient animeDb,
        OmdbClient omdb,
        WebSearchClient webSearch,
        NewsApiClient newsApi,
        ImdbApiClient imdbApi,
        IMemoryCache cache,
        ApplicationDbContext db,
        ILogger<DiscoverController> logger)
    {
        _contentApiService = contentApiService;
        _youtube = youtube;
        _animeDb = animeDb;
        _omdb = omdb;
        _webSearch = webSearch;
        _newsApi = newsApi;
        _imdbApi = imdbApi;
        _cache = cache;
        _db = db;
        _logger = logger;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out userId);
    }

    // Normalize title for fuzzy dedup: strip articles, punctuation, lowercase
    private static string NormalizeTitle(string title) =>
        System.Text.RegularExpressions.Regex.Replace(
            title.ToLowerInvariant(), @"^(the|a|an|marvel'?s?)\s+|\s*[:;,\-–—]\s*.*$|[''\""\.\!\?]", "").Trim();

    // Simple similarity check: are titles >70% overlapping in words?
    private static bool LevenshteinSimilar(string a, string b)
    {
        var wordsA = new HashSet<string>(a.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        var wordsB = new HashSet<string>(b.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (wordsA.Count == 0 || wordsB.Count == 0) return false;
        var intersect = wordsA.Intersect(wordsB).Count();
        var smaller = Math.Min(wordsA.Count, wordsB.Count);
        return (double)intersect / smaller >= 0.7;
    }

    private async Task<List<Content>> BuildIndianMovieFallbackAsync(int page, CancellationToken ct)
    {
        const int pageSize = 12;
        var pageSeeds = IndianTrendingMovieSeeds
            .Skip((Math.Max(page, 1) - 1) * pageSize)
            .Take(pageSize)
            .ToArray();

        if (pageSeeds.Length == 0)
            pageSeeds = IndianTrendingMovieSeeds.Take(pageSize).ToArray();

        var results = new List<Content>();

        foreach (var (title, year) in pageSeeds)
        {
            try
            {
                var query = year.HasValue ? $"{title} {year.Value}" : title;
                var matches = await _imdbApi.SearchAsync(query, ct);

                var best = matches.FirstOrDefault(c =>
                               c.Type == ContentType.movie &&
                               (year == null || c.Year == year || c.Title.Equals(title, StringComparison.OrdinalIgnoreCase)))
                           ?? matches.FirstOrDefault(c => c.Type == ContentType.movie)
                           ?? matches.FirstOrDefault();

                if (best is null) continue;

                best.Type = ContentType.movie;
                best.Source = "IMDB_MOVIE";
                if (best.Year is null) best.Year = year;
                results.Add(best);
            }
            catch
            {
                // Ignore per-title fallback errors.
            }
        }

        return results
            .Where(c => !string.IsNullOrWhiteSpace(c.ExternalId) && !string.IsNullOrWhiteSpace(c.Title))
            .GroupBy(c => $"{c.Source}:{c.ExternalId}")
            .Select(g => g.First())
            .ToList();
    }

    // Maps Content model to the shape the frontend ContentItem interface expects
    private static object MapToFrontend(Content c) => new
    {
        externalId = c.ExternalId,
        title = c.Title,
        overview = c.Synopsis ?? "",
        posterPath = c.PosterUrl,
        backdropPath = c.BackdropUrl,
        releaseDate = c.Year?.ToString() ?? "",
        voteAverage = (double)(c.Rating ?? 0m),
        voteCount = 0,
        popularity = 0.0,
        genreIds = Array.Empty<int>(),
        genres = c.GenresCsv?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? Array.Empty<string>(),
        source = c.Source switch
        {
            var s when s?.Contains("MAL", StringComparison.OrdinalIgnoreCase) == true => "jikan",
            "IMDB" => "imdb",
            _ => "tmdb"
        },
        type = c.Type.ToString(),
        year = c.Year,
        episodes = c.Episodes,
        seasons = c.Seasons
    };

    private static string? MapTmdbGenreName(int genreId) => genreId switch
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
        53 => "Thriller",
        10752 => "War",
        37 => "Western",
        10759 => "Action & Adventure",
        10762 => "Kids",
        10763 => "News",
        10764 => "Reality",
        10765 => "Sci-Fi & Fantasy",
        10766 => "Soap",
        10767 => "Talk",
        10768 => "War & Politics",
        _ => null
    };

    private object WrapItems(IEnumerable<Content> items) =>
        new { items = items.Select(MapToFrontend) };

    private object WrapItems(IReadOnlyCollection<Content> items, int totalCount) =>
        new { items = items.Select(MapToFrontend), totalCount, hasMore = totalCount > items.Count };

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string query, [FromQuery] string? type, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest("Query parameter is required");

        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        try
        {
            var results = new List<Content>();

            // Run searches in parallel for faster results
            var tasks = new List<Task<List<Content>>>();

            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.SearchMoviesAsync(query, page));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.SearchTvShowsAsync(query, page));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("anime", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.SearchAnimeAsync(query, page));

            // Also search for person (actor/director) and include their filmography
            tasks.Add(_contentApiService.SearchPersonMoviesAsync(query, page));

            // Also search the free IMDb API for additional results
            tasks.Add(_imdbApi.SearchAsync(query));

            var allResults = await Task.WhenAll(tasks);
            foreach (var r in allResults)
                results.AddRange(r);

            // Deduplicate by ExternalId+Source
            results = results
                .GroupBy(c => $"{c.Source}:{c.ExternalId}")
                .Select(g => g.First())
                .ToList();

            var totalCount = results.Count;
            // Strip trailing year for relevance matching
            var yearMatch = System.Text.RegularExpressions.Regex.Match(query.Trim(), @"^(.+?)\s+((?:19|20)\d{2})\s*$");
            var coreQuery = yearMatch.Success ? yearMatch.Groups[1].Value.Trim() : query.Trim();
            int? searchYear = yearMatch.Success ? int.Parse(yearMatch.Groups[2].Value) : null;

            // Filter out irrelevant results: title must contain at least one significant query word
            var queryWords = coreQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 2)
                .Select(w => w.ToLowerInvariant())
                .ToArray();

            if (queryWords.Length > 0)
            {
                results = results.Where(c =>
                {
                    var title = (c.Title ?? "").ToLowerInvariant();
                    // Require ANY significant query word to appear in the title
                    return queryWords.Any(w => title.Contains(w));
                }).ToList();
            }

            // When a year is specified, filter to only that year
            if (searchYear.HasValue)
            {
                results = results.Where(c => c.Year == searchYear.Value).ToList();
            }

            totalCount = results.Count;
            var paged = results
                               .OrderByDescending(c => {
                                   var title = c.Title ?? "";
                                   if (title.Equals(coreQuery, StringComparison.OrdinalIgnoreCase)) return 4;
                                   if (title.StartsWith(coreQuery, StringComparison.OrdinalIgnoreCase)) return 3;
                                   if (title.Contains(coreQuery, StringComparison.OrdinalIgnoreCase)) return 2;
                                   // Check if title contains all significant words from query
                                   var words = coreQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                                       .Where(w => w.Length > 2).ToArray();
                                   if (words.Length > 0 && words.All(w => title.Contains(w, StringComparison.OrdinalIgnoreCase))) return 1;
                                   return 0;
                               })
                               .ThenByDescending(c => c.Rating ?? 0)
                               .Skip((page - 1) * pageSize)
                               .Take(pageSize)
                               .ToList();

            return Ok(new
            {
                items = paged.Select(MapToFrontend),
                totalCount,
                page,
                pageSize,
                hasMore = page * pageSize < totalCount
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to search content" });
        }
    }

    [HttpGet("trending")]
    public async Task<IActionResult> GetTrending([FromQuery] string? type, [FromQuery] int page = 1, [FromQuery] string? region = null)
    {
        try
        {
            var tasks = new List<Task<List<Content>>>();

            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetTrendingMoviesAsync(page, region));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetTrendingTvShowsAsync(page, region));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("anime", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetTrendingAnimeAsync(page));

            var allResults = await Task.WhenAll(tasks);
            var results = allResults.SelectMany(r => r).ToList();

            return Ok(WrapItems(results));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch trending content" });
        }
    }

    /// <summary>Discover popular content by original language (e.g. hi, te, ta, ml, kn, bn, mr, ko, ja, es).</summary>
    [HttpGet("by-language/{lang}")]
    public async Task<IActionResult> GetByLanguage(string lang, [FromQuery] string? type, [FromQuery] int page = 1)
    {
        if (string.IsNullOrWhiteSpace(lang) || lang.Length > 5)
            return BadRequest("Invalid language code");

        try
        {
            var results = new List<Content>();
            var tasks = new List<Task<List<Content>>>();

            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.DiscoverMoviesByLanguageAsync(lang, page));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.DiscoverTvByLanguageAsync(lang, page));

            var allResults = await Task.WhenAll(tasks);
            foreach (var r in allResults)
                results.AddRange(r);

            // Sort by rating descending
            results = results
                .OrderByDescending(c => c.Rating ?? 0)
                .ToList();

            return Ok(WrapItems(results));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = $"Failed to fetch content for language: {lang}" });
        }
    }

    /// <summary>Trending in India — IMDb-first: broad IMDb searches for Indian content,
    /// supplemented by TMDB discover for recent Indian-origin &amp; Indian-language content.</summary>
    [HttpGet("trending/india")]
    public async Task<IActionResult> GetTrendingIndia([FromQuery] string? type, [FromQuery] int page = 1)
    {
        try
        {
            var existingIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var existingTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var results = new List<Content>();

            void MergeUnique(IEnumerable<Content> items)
            {
                foreach (var item in items)
                {
                    var id = item.ExternalId ?? "";
                    var normTitle = NormalizeTitle(item.Title ?? "");
                    if (!string.IsNullOrEmpty(id) && !existingIds.Add(id)) continue;
                    if (!string.IsNullOrEmpty(normTitle) && !existingTitles.Add(normTitle)) continue;
                    results.Add(item);
                }
            }

            var ct = HttpContext.RequestAborted;

            // ── Source 1 (PRIMARY): TMDB Discover — recent Indian-origin content (last 6 months) ──
            var discoverTasks = new List<Task<List<Content>>>();
            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                discoverTasks.Add(_contentApiService.DiscoverMoviesByCountryRecentAsync("IN", page));
            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                discoverTasks.Add(_contentApiService.DiscoverTvByCountryRecentAsync("IN", page));

            var discoverResults = await Task.WhenAll(discoverTasks);
            foreach (var r in discoverResults) MergeUnique(r);

            // ── Source 2: TMDB Discover by Indian languages (recent 6 months) ──
            var indianLangs = new[] { "hi", "te", "ta", "ml", "kn", "bn", "mr" };
            var langTasks = new List<Task<List<Content>>>();
            foreach (var lang in indianLangs)
            {
                if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                    langTasks.Add(_contentApiService.DiscoverMoviesByLanguageRecentAsync(lang, page));
                if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                    langTasks.Add(_contentApiService.DiscoverTvByLanguageRecentAsync(lang, page));
            }

            var langResults = await Task.WhenAll(langTasks);
            foreach (var r in langResults) MergeUnique(r);

            // If the "recent" window is sparse, broaden to non-recent India discover feeds.
            if (results.Count < 12)
            {
                var broadenedTasks = new List<Task<List<Content>>>();

                if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                    broadenedTasks.Add(_contentApiService.DiscoverMoviesByCountryAsync("IN", page));

                if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                    broadenedTasks.Add(_contentApiService.DiscoverTvByCountryAsync("IN", page));

                foreach (var lang in indianLangs)
                {
                    if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                        broadenedTasks.Add(_contentApiService.DiscoverMoviesByLanguageAsync(lang, page));

                    if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                        broadenedTasks.Add(_contentApiService.DiscoverTvByLanguageAsync(lang, page));
                }

                var broadenedResults = await Task.WhenAll(broadenedTasks);
                foreach (var r in broadenedResults) MergeUnique(r);
            }

            // Fallback: keep India rail strictly movie/TV (no anime injection).
            if (results.Count == 0)
            {
                if (string.IsNullOrWhiteSpace(type) || type.Equals("all", StringComparison.OrdinalIgnoreCase) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                {
                    var movieFallback = await _contentApiService.GetPopularMoviesAsync(page, region: "IN");
                    MergeUnique(movieFallback.Take(20));
                }

                if (string.IsNullOrWhiteSpace(type) || type.Equals("all", StringComparison.OrdinalIgnoreCase) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                {
                    var tvFallback = await _contentApiService.GetPopularTvShowsAsync(page, region: "IN");
                    MergeUnique(tvFallback.Take(20));
                }

                // Final fallback if provider/keys are down: seeded Indian movie set from IMDb.
                if (results.Count == 0)
                {
                    var imdbFallback = await BuildIndianMovieFallbackAsync(page, ct);
                    MergeUnique(imdbFallback);
                }
            }

            return Ok(WrapItems(results));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch trending India content" });
        }
    }

    /// <summary>Popular in India — movies + TV shows.</summary>
    [HttpGet("popular/india")]
    public async Task<IActionResult> GetPopularIndia([FromQuery] string? type, [FromQuery] int page = 1)
    {
        try
        {
            var tasks = new List<Task<List<Content>>>();

            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.DiscoverMoviesByCountryAsync("IN", page));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.DiscoverTvByCountryAsync("IN", page));

            var allResults = await Task.WhenAll(tasks);
            var results = allResults.SelectMany(r => r).ToList();

            return Ok(WrapItems(results));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch popular India content" });
        }
    }

    [HttpGet("popular")]
    public async Task<IActionResult> GetPopular([FromQuery] string? type, [FromQuery] int page = 1, [FromQuery] string? region = null)
    {
        try
        {
            var tasks = new List<Task<List<Content>>>();

            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetPopularMoviesAsync(page, region));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetPopularTvShowsAsync(page, region));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("anime", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetPopularAnimeAsync(page));

            var allResults = await Task.WhenAll(tasks);
            var results = allResults.SelectMany(r => r).ToList();

            return Ok(WrapItems(results));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch popular content" });
        }
    }

    [HttpGet("top-rated")]
    public async Task<IActionResult> GetTopRated([FromQuery] string? type, [FromQuery] int page = 1, [FromQuery] string? region = null)
    {
        try
        {
            var tasks = new List<Task<List<Content>>>();

            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetTopRatedMoviesAsync(page, region));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetTopRatedTvShowsAsync(page, region));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("anime", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.GetTopRatedAnimeAsync(page));

            var allResults = await Task.WhenAll(tasks);
            var results = allResults.SelectMany(r => r).ToList();

            return Ok(WrapItems(results));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch top rated content" });
        }
    }

    [HttpGet("browse")]
    public async Task<IActionResult> BrowseByGenre([FromQuery] string genre, [FromQuery] string? type, [FromQuery] int page = 1)
    {
        if (string.IsNullOrWhiteSpace(genre))
            return BadRequest("Genre parameter is required");

        try
        {
            var tasks = new List<Task<List<Content>>>();

            if (string.IsNullOrWhiteSpace(type) || type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.DiscoverMoviesByGenreAsync(genre, page));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.DiscoverTvByGenreAsync(genre, page));

            if (string.IsNullOrWhiteSpace(type) || type.Equals("anime", StringComparison.OrdinalIgnoreCase))
                tasks.Add(_contentApiService.DiscoverAnimeByGenreAsync(genre, page));

            var allResults = await Task.WhenAll(tasks);
            var results = allResults.SelectMany(r => r)
                             .OrderByDescending(c => c.Rating ?? 0)
                             .ThenBy(c => c.Title)
                             .ToList();

            return Ok(WrapItems(results));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to browse by genre" });
        }
    }

    [HttpGet("details/{source}/{id}")]
    public async Task<IActionResult> GetDetails(string source, string id)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(id))
            return BadRequest("Source and ID parameters are required");

        try
        {
            var src = source.ToUpperInvariant();

            // When frontend routes as /content/movie|tv/tt..., resolve IMDb IDs to TMDB first.
            if (id.StartsWith("tt", StringComparison.OrdinalIgnoreCase))
            {
                var match = await _contentApiService.FindByImdbIdAsync(id);
                if (match != null)
                {
                    if (src is "TMDB_TV" or "TV" or "IMDB_TV")
                        return await GetDetails("TV", match.Value.tmdbId);

                    if (src is "TMDB_MOVIE" or "MOVIE" or "IMDB_MOVIE")
                        return await GetDetails("MOVIE", match.Value.tmdbId);

                    var resolvedSource = match.Value.mediaType == "tv" ? "TV" : "MOVIE";
                    return await GetDetails(resolvedSource, match.Value.tmdbId);
                }
            }

            // IMDB source: resolve IMDb ID to TMDB, then redirect to the appropriate handler
            if ((src == "IMDB" || src == "IMDB_MOVIE" || src == "IMDB_TV") && id.StartsWith("tt", StringComparison.OrdinalIgnoreCase))
            {
                var match = await _contentApiService.FindByImdbIdAsync(id);
                if (match == null) return NotFound("Could not find this title on TMDB");
                // Recurse with the resolved TMDB source and ID
                var resolvedSource = match.Value.mediaType == "movie" ? "MOVIE" : "TV";
                return await GetDetails(resolvedSource, match.Value.tmdbId);
            }

            if (src is "TMDB_MOVIE" or "MOVIE")
            {
                var movie = await _contentApiService.GetMovieDetailsRawAsync(id);
                if (movie == null) return NotFound("Content not found");

                var trailer = movie.Videos?.Results?
                    .Where(v => v.Site == "YouTube" && v.Type == "Trailer")
                    .OrderByDescending(v => v.Official)
                    .FirstOrDefault();

                string? trailerUrl = trailer != null
                    ? $"https://www.youtube-nocookie.com/embed/{trailer.Key}?rel=0"
                    : null;

                // Fallback to YouTube search if TMDB has no trailer
                if (trailerUrl == null && !string.IsNullOrEmpty(movie.Title))
                {
                    var ytId = await _youtube.FindTrailerAsync(movie.Title, "movie", HttpContext.RequestAborted);
                    if (ytId != null) trailerUrl = $"https://www.youtube-nocookie.com/embed/{ytId}?rel=0";
                }

                var director = movie.Credits?.Crew?.FirstOrDefault(c => c.Job == "Director");
                var writers = movie.Credits?.Crew?
                    .Where(c => c.Department == "Writing")
                    .Select(c => c.Name)
                    .Distinct()
                    .Take(5)
                    .ToArray();

                // Fix: override status when release date is in the future
                var movieStatus = movie.Status;
                if (DateTime.TryParse(movie.ReleaseDate, out var movieRelease) && movieRelease > DateTime.UtcNow)
                    movieStatus = "Upcoming";

                return Ok(new
                {
                    externalId = movie.Id.ToString(),
                    title = movie.Title ?? "",
                    overview = movie.Overview ?? "",
                    posterPath = !string.IsNullOrEmpty(movie.PosterPath) ? $"https://image.tmdb.org/t/p/w500{movie.PosterPath}" : null,
                    backdropPath = !string.IsNullOrEmpty(movie.BackdropPath) ? $"https://image.tmdb.org/t/p/original{movie.BackdropPath}" : null,
                    releaseDate = movie.ReleaseDate ?? "",
                    voteAverage = movie.VoteAverage,
                    voteCount = movie.VoteCount,
                    genres = movie.Genres?.Select(g => g.Name).ToArray() ?? Array.Empty<string>(),
                    source = "tmdb",
                    type = "movie",
                    imdbId = movie.ImdbId,
                    runtime = movie.Runtime > 0 ? movie.Runtime : (int?)null,
                    budget = movie.Budget > 0 ? movie.Budget : (long?)null,
                    revenue = movie.Revenue > 0 ? movie.Revenue : (long?)null,
                    status = movieStatus,
                    tagline = movie.Tagline,
                    originalLanguage = movie.OriginalLanguage,
                    trailerUrl,
                    director = director?.Name,
                    writers = writers ?? Array.Empty<string>(),
                    cast = movie.Credits?.Cast?
                        .OrderBy(c => c.Order)
                        .Take(20)
                        .Select(c => new
                        {
                            id = c.Id,
                            name = c.Name,
                            character = c.Character,
                            profilePath = !string.IsNullOrEmpty(c.ProfilePath) ? $"https://image.tmdb.org/t/p/w185{c.ProfilePath}" : null
                        }).ToArray()
                });
            }

            if (src is "TMDB_TV" or "TV")
            {
                var tv = await _contentApiService.GetTvDetailsRawAsync(id);
                if (tv == null) return NotFound("Content not found");

                var trailer = tv.Videos?.Results?
                    .Where(v => v.Site == "YouTube" && v.Type == "Trailer")
                    .OrderByDescending(v => v.Official)
                    .FirstOrDefault();

                string? trailerUrl = trailer != null
                    ? $"https://www.youtube-nocookie.com/embed/{trailer.Key}?rel=0"
                    : null;

                if (trailerUrl == null && !string.IsNullOrEmpty(tv.Name))
                {
                    var ytId = await _youtube.FindTrailerAsync(tv.Name, "tv show", HttpContext.RequestAborted);
                    if (ytId != null) trailerUrl = $"https://www.youtube-nocookie.com/embed/{ytId}?rel=0";
                }

                var creators = tv.Credits?.Crew?
                    .Where(c => c.Job == "Executive Producer" || c.Department == "Writing")
                    .Select(c => c.Name)
                    .Distinct()
                    .Take(5)
                    .ToArray();

                // Fix: override status when first air date is in the future
                var tvStatus = tv.Status;
                if (DateTime.TryParse(tv.FirstAirDate, out var tvAirDate) && tvAirDate > DateTime.UtcNow)
                    tvStatus = "Upcoming";

                return Ok(new
                {
                    externalId = tv.Id.ToString(),
                    title = tv.Name ?? "",
                    overview = tv.Overview ?? "",
                    posterPath = !string.IsNullOrEmpty(tv.PosterPath) ? $"https://image.tmdb.org/t/p/w500{tv.PosterPath}" : null,
                    backdropPath = !string.IsNullOrEmpty(tv.BackdropPath) ? $"https://image.tmdb.org/t/p/original{tv.BackdropPath}" : null,
                    releaseDate = tv.FirstAirDate ?? "",
                    voteAverage = tv.VoteAverage,
                    voteCount = tv.VoteCount,
                    genres = tv.Genres?.Select(g => g.Name).ToArray() ?? Array.Empty<string>(),
                    source = "tmdb",
                    type = "tv",
                    episodes = tv.NumberOfEpisodes > 0 ? tv.NumberOfEpisodes : (int?)null,
                    seasons = tv.NumberOfSeasons > 0 ? tv.NumberOfSeasons : (int?)null,
                    runtime = tv.EpisodeRunTime?.FirstOrDefault(),
                    status = tvStatus,
                    tagline = tv.Tagline,
                    originalLanguage = tv.OriginalLanguage,
                    trailerUrl,
                    writers = creators ?? Array.Empty<string>(),
                    cast = tv.Credits?.Cast?
                        .OrderBy(c => c.Order)
                        .Take(20)
                        .Select(c => new
                        {
                            id = c.Id,
                            name = c.Name,
                            character = c.Character,
                            profilePath = !string.IsNullOrEmpty(c.ProfilePath) ? $"https://image.tmdb.org/t/p/w185{c.ProfilePath}" : null
                        }).ToArray()
                });
            }

            if (src is "MAL_ANIME" or "ANIME")
            {
                var anime = await _contentApiService.GetAnimeDetailsRawAsync(id);
                if (anime == null) return NotFound("Content not found");

                // Use Jikan's built-in trailer first, then fall back to YouTube search
                string? trailerUrl = null;
                if (!string.IsNullOrEmpty(anime.Trailer?.YoutubeId))
                {
                    trailerUrl = $"https://www.youtube-nocookie.com/embed/{anime.Trailer.YoutubeId}?rel=0";
                }
                else if (!string.IsNullOrEmpty(anime.Title))
                {
                    var ytId = await _youtube.FindTrailerAsync(anime.TitleEnglish ?? anime.Title, "anime", HttpContext.RequestAborted);
                    if (ytId != null) trailerUrl = $"https://www.youtube-nocookie.com/embed/{ytId}?rel=0";
                }

                // Fetch characters in parallel with other enrichment
                var charactersTask = _contentApiService.GetAnimeCharactersAsync(id);

                // Fetch AnimeDB ranking data in parallel (fire-and-forget style, don't block)
                int? animeDbRanking = null;
                string? animeDbImage = null;
                try
                {
                    var animeDbData = await _animeDb.GetByIdAsync(id, HttpContext.RequestAborted);
                    if (animeDbData is System.Text.Json.JsonElement je)
                    {
                        if (je.TryGetProperty("ranking", out var rankProp) && rankProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                            animeDbRanking = rankProp.GetInt32();
                        if (je.TryGetProperty("image", out var imgProp) && imgProp.ValueKind == System.Text.Json.JsonValueKind.String)
                            animeDbImage = imgProp.GetString();
                    }
                }
                catch { /* AnimeDB enrichment is optional */ }

                // Await characters
                var characters = await charactersTask;
                var animeCast = characters?.Data?
                    .Where(c => c.Role == "Main" || c.Role == "Supporting")
                    .OrderBy(c => c.Role == "Main" ? 0 : 1)
                    .Take(20)
                    .Select(c => {
                        var va = c.VoiceActors?.FirstOrDefault(v => v.Language == "Japanese");
                        // Use the voice actor's real photo; fall back to character art
                        var vaImage = va?.Person?.Images?.Jpg?.ImageUrl
                                   ?? va?.Person?.Images?.Webp?.ImageUrl;
                        var charImage = c.Character?.Images?.Webp?.SmallImageUrl
                                     ?? c.Character?.Images?.Jpg?.ImageUrl;
                        return new
                        {
                            id = va?.Person?.MalId ?? c.Character?.MalId ?? 0,
                            name = va?.Person?.Name ?? c.Character?.Name ?? "",
                            character = c.Character?.Name ?? "",
                            profilePath = vaImage ?? charImage,
                            idSource = "jikan"
                        };
                    }).ToArray() ?? Array.Empty<object>();

                // Try to find a higher-quality TMDB poster & widescreen backdrop
                string? tmdbPoster = null;
                string? tmdbBackdrop = null;
                try
                {
                    var animeTitle = anime.TitleEnglish ?? anime.Title ?? "";
                    if (!string.IsNullOrEmpty(animeTitle))
                    {
                        var tmdbMatch = await _contentApiService.FindAnimeTmdbMatchAsync(animeTitle);
                        if (tmdbMatch != null)
                        {
                            tmdbPoster = tmdbMatch.Value.Poster;
                            tmdbBackdrop = tmdbMatch.Value.Backdrop;
                        }
                    }
                }
                catch { /* TMDB enrichment is optional */ }

                // Prefer highest quality: TMDB > WebP > JPG
                var posterUrl = tmdbPoster
                             ?? anime.Images?.Webp?.LargeImageUrl
                             ?? anime.Images?.Jpg?.LargeImageUrl
                             ?? animeDbImage;
                var backdropUrl = tmdbBackdrop ?? posterUrl;

                // Fix: override status when air date is in the future
                var animeStatus = anime.Status;
                if (anime.Aired?.From != null && anime.Aired.From.Value > DateTime.UtcNow)
                    animeStatus = "Upcoming";
                else if (string.Equals(animeStatus, "Not yet aired", StringComparison.OrdinalIgnoreCase))
                    animeStatus = "Upcoming";

                return Ok(new
                {
                    externalId = anime.MalId.ToString(),
                    title = anime.Title ?? "",
                    overview = anime.Synopsis ?? "",
                    posterPath = posterUrl,
                    backdropPath = backdropUrl,
                    releaseDate = anime.Aired?.From?.ToString("yyyy-MM-dd") ?? anime.Year?.ToString() ?? "",
                    voteAverage = anime.Score ?? 0,
                    voteCount = anime.ScoredBy ?? 0,
                    genres = anime.Genres?.Select(g => g.Name).ToArray() ?? Array.Empty<string>(),
                    source = "jikan",
                    type = "anime",
                    episodes = anime.Episodes,
                    status = animeStatus,
                    originalLanguage = "Japanese",
                    duration = anime.Duration,
                    rating = anime.Rating,
                    studios = anime.Studios?.Select(s => s.Name).ToArray(),
                    malRanking = animeDbRanking,
                    trailerUrl,
                    cast = animeCast
                });
            }

            return NotFound("Invalid source type");
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch content details" });
        }
    }

    // ─── Watch Providers (where to stream/rent/buy) ──────────────────────────

    [HttpGet("{type}/{id}/watch-providers")]
    public async Task<IActionResult> GetWatchProviders(string type, string id, [FromQuery] string? country = "US")
    {
        try
        {
            TmdbWatchProvidersResponse? providers = null;

            if (type.Equals("movie", StringComparison.OrdinalIgnoreCase))
                providers = await _contentApiService.GetMovieWatchProvidersAsync(id);
            else if (type.Equals("tv", StringComparison.OrdinalIgnoreCase))
                providers = await _contentApiService.GetTvWatchProvidersAsync(id);
            else
                return Ok(new { streaming = Array.Empty<object>(), rent = Array.Empty<object>(), buy = Array.Empty<object>(), link = (string?)null });

            if (providers?.Results == null)
                return Ok(new { streaming = Array.Empty<object>(), rent = Array.Empty<object>(), buy = Array.Empty<object>(), link = (string?)null });

            // Try requested country, fallback to US, then any first available
            var countryCode = (country ?? "US").ToUpperInvariant();
            if (!providers.Results.TryGetValue(countryCode, out var data))
            {
                if (!providers.Results.TryGetValue("US", out data))
                    data = providers.Results.Values.FirstOrDefault();
            }

            if (data == null)
                return Ok(new { streaming = Array.Empty<object>(), rent = Array.Empty<object>(), buy = Array.Empty<object>(), link = (string?)null });

            object MapProvider(TmdbProvider p) => new
            {
                id = p.ProviderId,
                name = p.ProviderName,
                logoUrl = !string.IsNullOrEmpty(p.LogoPath) ? $"https://image.tmdb.org/t/p/w92{p.LogoPath}" : null
            };

            return Ok(new
            {
                streaming = data.Flatrate?.Select(MapProvider).ToArray() ?? Array.Empty<object>(),
                free = data.Free?.Select(MapProvider).ToArray() ?? Array.Empty<object>(),
                rent = data.Rent?.Select(MapProvider).ToArray() ?? Array.Empty<object>(),
                buy = data.Buy?.Select(MapProvider).ToArray() ?? Array.Empty<object>(),
                link = data.Link
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch watch providers" });
        }
    }

    // ─── Similar / Recommended content ───────────────────────────────────────

    [HttpGet("{type}/{id}/similar")]
    public async Task<IActionResult> GetSimilarContent(string type, string id)
    {
        try
        {
            if (type.Equals("movie", StringComparison.OrdinalIgnoreCase))
            {
                var recs = await _contentApiService.GetMovieRecommendationsAsync(id);
                var items = recs?.Results?.Take(12).Select(r => new
                {
                    externalId = r.Id.ToString(),
                    title = r.Title ?? r.Name ?? "",
                    overview = r.Overview ?? "",
                    posterPath = !string.IsNullOrEmpty(r.PosterPath) ? $"https://image.tmdb.org/t/p/w342{r.PosterPath}" : null,
                    backdropPath = !string.IsNullOrEmpty(r.BackdropPath) ? $"https://image.tmdb.org/t/p/w780{r.BackdropPath}" : null,
                    releaseDate = r.ReleaseDate ?? r.FirstAirDate ?? "",
                    voteAverage = r.VoteAverage,
                    voteCount = r.VoteCount,
                    source = "tmdb",
                    type = "movie"
                }).ToArray() ?? Array.Empty<object>();

                return Ok(new { items });
            }

            if (type.Equals("tv", StringComparison.OrdinalIgnoreCase))
            {
                var recs = await _contentApiService.GetTvRecommendationsAsync(id);
                var items = recs?.Results?.Take(12).Select(r => new
                {
                    externalId = r.Id.ToString(),
                    title = r.Name ?? r.Title ?? "",
                    overview = r.Overview ?? "",
                    posterPath = !string.IsNullOrEmpty(r.PosterPath) ? $"https://image.tmdb.org/t/p/w342{r.PosterPath}" : null,
                    backdropPath = !string.IsNullOrEmpty(r.BackdropPath) ? $"https://image.tmdb.org/t/p/w780{r.BackdropPath}" : null,
                    releaseDate = r.FirstAirDate ?? r.ReleaseDate ?? "",
                    voteAverage = r.VoteAverage,
                    voteCount = r.VoteCount,
                    source = "tmdb",
                    type = "tv"
                }).ToArray() ?? Array.Empty<object>();

                return Ok(new { items });
            }

            if (type.Equals("anime", StringComparison.OrdinalIgnoreCase))
            {
                var recs = await _contentApiService.GetAnimeRecommendationsAsync(id);
                var items = recs?.Data?.Take(12).Select(r => new
                {
                    externalId = r.Entry?.MalId.ToString() ?? "",
                    title = r.Entry?.Title ?? "",
                    overview = "",
                    posterPath = r.Entry?.Images?.Webp?.LargeImageUrl ?? r.Entry?.Images?.Jpg?.LargeImageUrl,
                    backdropPath = (string?)null,
                    releaseDate = "",
                    voteAverage = 0.0,
                    voteCount = r.Votes,
                    source = "jikan",
                    type = "anime"
                }).ToArray() ?? Array.Empty<object>();

                return Ok(new { items });
            }

            return Ok(new { items = Array.Empty<object>() });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch similar content" });
        }
    }

    /// <summary>Get episodes for a TV season from TMDB.</summary>
    [HttpGet("tv/{id}/season/{seasonNumber}")]
    public async Task<IActionResult> GetTvSeason(string id, int seasonNumber)
    {
        try
        {
            var season = await _contentApiService.GetTvSeasonAsync(id, seasonNumber);
            if (season == null) return NotFound("Season not found");

            // Extract best trailer from season videos
            var trailer = season.Videos?.Results?
                .Where(v => v.Site == "YouTube" && (v.Type == "Trailer" || v.Type == "Teaser"))
                .OrderByDescending(v => v.Type == "Trailer")
                .ThenByDescending(v => v.Official)
                .FirstOrDefault();
            var trailerUrl = trailer != null ? $"https://www.youtube-nocookie.com/embed/{trailer.Key}?rel=0" : (string?)null;

            // Fallback: search YouTube for season trailer if TMDB doesn't have one
            if (trailerUrl == null)
            {
                try
                {
                    var tvDetails = await _contentApiService.GetTvShowDetailsAsync(id);
                    var showName = tvDetails?.Title ?? "TV Show";
                    var ytId = await _youtube.FindTrailerAsync($"{showName} Season {seasonNumber}", "tv series");
                    if (ytId != null) trailerUrl = $"https://www.youtube-nocookie.com/embed/{ytId}?rel=0";
                }
                catch { /* YouTube search may fail */ }
            }

            return Ok(new
            {
                seasonNumber = season.SeasonNumber,
                name = season.Name,
                overview = season.Overview,
                airDate = season.AirDate,
                posterPath = !string.IsNullOrEmpty(season.PosterPath) ? $"https://image.tmdb.org/t/p/w300{season.PosterPath}" : null,
                trailerUrl,
                episodes = season.Episodes?.Select(e => new
                {
                    episodeNumber = e.EpisodeNumber,
                    name = e.Name,
                    overview = e.Overview,
                    airDate = e.AirDate,
                    voteAverage = e.VoteAverage,
                    voteCount = e.VoteCount,
                    runtime = e.Runtime,
                    stillPath = !string.IsNullOrEmpty(e.StillPath) ? $"https://image.tmdb.org/t/p/w300{e.StillPath}" : null
                }).ToArray()
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch TV season" });
        }
    }

    /// <summary>Get episodes for an anime from Jikan (MAL).</summary>
    [HttpGet("anime/{id}/episodes")]
    public async Task<IActionResult> GetAnimeEpisodes(string id, [FromQuery] int page = 1)
    {
        try
        {
            var result = await _contentApiService.GetAnimeEpisodesAsync(id, page);
            if (result == null) return NotFound("Episodes not found");

            return Ok(new
            {
                episodes = result.Data?.Select(e => new
                {
                    episodeNumber = e.MalId,
                    name = e.Title,
                    titleJapanese = e.TitleJapanese,
                    airDate = e.Aired,
                    score = e.Score.HasValue ? Math.Round(e.Score.Value * 2, 1) : (double?)null,
                    filler = e.Filler,
                    recap = e.Recap
                }).ToArray(),
                pagination = result.Pagination != null ? new
                {
                    currentPage = result.Pagination.CurrentPage,
                    lastPage = result.Pagination.LastVisiblePage,
                    hasNextPage = result.Pagination.HasNextPage
                } : null
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch anime episodes" });
        }
    }

    /// <summary>Get single anime episode detail (includes synopsis).</summary>
    [HttpGet("anime/{id}/episodes/{episode:int}")]
    public async Task<IActionResult> GetAnimeEpisodeDetail(string id, int episode)
    {
        try
        {
            var detail = await _contentApiService.GetAnimeEpisodeDetailAsync(id, episode);
            if (detail == null) return NotFound("Episode not found");

            return Ok(new
            {
                episodeNumber = detail.MalId,
                name = detail.Title,
                titleJapanese = detail.TitleJapanese,
                synopsis = detail.Synopsis,
                duration = detail.Duration,
                airDate = detail.Aired,
                filler = detail.Filler,
                recap = detail.Recap
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch episode detail" });
        }
    }

    /// <summary>Get TMDB episode screenshots for anime (searches TMDB TV by title).
    /// Fetches ALL seasons and maps TMDB per-season episode numbers to cumulative anime episode numbers.</summary>
    [HttpGet("anime/{id}/screenshots")]
    public async Task<IActionResult> GetAnimeScreenshots(string id, [FromQuery] int season = 1)
    {
        try
        {
            // First get the anime title from Jikan
            var anime = await _contentApiService.GetAnimeDetailsRawAsync(id);
            if (anime == null) return NotFound("Anime not found");

            var title = anime.TitleEnglish ?? anime.Title ?? "";
            if (string.IsNullOrEmpty(title)) return Ok(new { screenshots = Array.Empty<object>() });

            // Fetch all available TMDB seasons and build cumulative episode map
            var allScreenshots = new List<object>();
            int cumulativeEpisode = 0;

            // Try fetching seasons starting from 1 until we get a null/empty result
            for (int s = 1; ; s++)
            {
                var tmdbSeason = await _contentApiService.FindAnimeTmdbSeasonAsync(title, s);
                if (tmdbSeason?.Episodes == null || tmdbSeason.Episodes.Count == 0)
                    break;

                foreach (var e in tmdbSeason.Episodes.OrderBy(e => e.EpisodeNumber))
                {
                    cumulativeEpisode++;
                    allScreenshots.Add(new
                    {
                        episodeNumber = cumulativeEpisode,
                        stillPath = !string.IsNullOrEmpty(e.StillPath)
                            ? $"https://image.tmdb.org/t/p/w300{e.StillPath}"
                            : (string?)null
                    });
                }
            }

            return Ok(new { screenshots = allScreenshots });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch anime screenshots" });
        }
    }

    /// <summary>Get full details for a person (actor/director) from TMDB or Jikan, including filmography.</summary>
    [HttpGet("person/{id}")]
    public async Task<IActionResult> GetPersonDetails(string id, [FromQuery] string? source = null)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest("Person ID is required");

        // Jikan/MAL person (anime voice actors)
        if (string.Equals(source, "jikan", StringComparison.OrdinalIgnoreCase))
        {
            return await GetJikanPersonDetails(id);
        }

        try
        {
            var person = await _contentApiService.GetPersonDetailsAsync(id);
            if (person == null) return NotFound("Person not found");

            // Calculate age
            int? age = null;
            if (!string.IsNullOrEmpty(person.Birthday) && DateTime.TryParse(person.Birthday, out var bday))
            {
                var endDate = !string.IsNullOrEmpty(person.Deathday) && DateTime.TryParse(person.Deathday, out var dday) ? dday : DateTime.Today;
                age = endDate.Year - bday.Year;
                if (endDate < bday.AddYears(age.Value)) age--;
            }

            // Process filmography from combined credits
            var now = DateTime.Today;
            var castCredits = person.CombinedCredits?.Cast?
                .Where(c => !string.IsNullOrEmpty(c.Title ?? c.Name))
                .Select(c =>
                {
                    var dateStr = c.ReleaseDate ?? c.FirstAirDate;
                    DateTime? releaseDate = null;
                    if (!string.IsNullOrEmpty(dateStr) && DateTime.TryParse(dateStr, out var d)) releaseDate = d;

                    return new
                    {
                        id = c.Id,
                        title = c.Title ?? c.Name ?? "",
                        character = c.Character ?? "",
                        mediaType = c.MediaType ?? "movie",
                        releaseDate = dateStr ?? "",
                        posterPath = !string.IsNullOrEmpty(c.PosterPath) ? $"https://image.tmdb.org/t/p/w185{c.PosterPath}" : (string?)null,
                        voteAverage = Math.Round(c.VoteAverage, 1),
                        voteCount = c.VoteCount,
                        popularity = c.Popularity,
                        isUpcoming = releaseDate.HasValue && releaseDate.Value > now,
                        isHit = c.VoteAverage >= 7.0 && c.VoteCount >= 100,
                        isFlop = c.VoteAverage < 5.0 && c.VoteCount >= 50,
                        year = releaseDate?.Year
                    };
                })
                .OrderByDescending(c => c.releaseDate)
                .ToList() ?? [];

            var crewCredits = person.CombinedCredits?.Crew?
                .Where(c => !string.IsNullOrEmpty(c.Title ?? c.Name))
                .GroupBy(c => c.Id)
                .Select(g =>
                {
                    var c = g.First();
                    var dateStr = c.ReleaseDate ?? c.FirstAirDate;
                    return new
                    {
                        id = c.Id,
                        title = c.Title ?? c.Name ?? "",
                        jobs = g.Select(x => x.Job).Distinct().ToArray(),
                        mediaType = c.MediaType ?? "movie",
                        releaseDate = dateStr ?? "",
                        posterPath = !string.IsNullOrEmpty(c.PosterPath) ? $"https://image.tmdb.org/t/p/w185{c.PosterPath}" : (string?)null,
                        voteAverage = Math.Round(c.VoteAverage, 1),
                        voteCount = c.VoteCount,
                    };
                })
                .OrderByDescending(c => c.releaseDate)
                .ToList() ?? [];

            var previousMovies = castCredits.Where(c => !c.isUpcoming).ToList();
            var upcomingMovies = castCredits.Where(c => c.isUpcoming).ToList();
            var hits = castCredits.Where(c => c.isHit && !c.isUpcoming).ToList();
            var flops = castCredits.Where(c => c.isFlop && !c.isUpcoming).ToList();

            // Compute movie-specific stats (exclude TV shows from counts)
            var movieCredits = castCredits.Where(c => c.mediaType == "movie" && !c.isUpcoming).ToList();
            var tvCredits = castCredits.Where(c => c.mediaType == "tv" && !c.isUpcoming).ToList();
            var movieHits = movieCredits.Where(c => c.isHit).ToList();
            var movieFlops = movieCredits.Where(c => c.isFlop).ToList();
            var ratedMovies = movieCredits.Where(c => c.voteAverage > 0 && c.voteCount >= 10).ToList();
            var avgRating = ratedMovies.Count > 0 ? Math.Round(ratedMovies.Average(c => c.voteAverage), 1) : (double?)null;
            var highestRated = ratedMovies.OrderByDescending(c => c.voteAverage).FirstOrDefault();
            var lowestRated = ratedMovies.OrderBy(c => c.voteAverage).FirstOrDefault();

            // Enrich with web search data (height, awards, trivia, news)
            var webInfo = await _webSearch.GetPersonWebInfoAsync(person.Name ?? "");

            return Ok(new
            {
                id = person.Id,
                name = person.Name,
                biography = person.Biography,
                birthday = person.Birthday,
                deathday = person.Deathday,
                age,
                placeOfBirth = person.PlaceOfBirth,
                profilePath = !string.IsNullOrEmpty(person.ProfilePath) ? $"https://image.tmdb.org/t/p/w500{person.ProfilePath}" : null,
                knownFor = person.KnownForDepartment,
                gender = person.Gender switch { 1 => "Female", 2 => "Male", 3 => "Non-binary", _ => null },
                alsoKnownAs = person.AlsoKnownAs?.Take(5).ToArray(),
                imdbId = person.ImdbId,
                // Movie-specific stats
                totalMovies = movieCredits.Count,
                totalTvShows = tvCredits.Count,
                totalCredits = castCredits.Count + crewCredits.Count,
                movieHits = movieHits.Count,
                movieFlops = movieFlops.Count,
                averageRating = avgRating,
                highestRatedMovie = highestRated != null ? new { highestRated.title, highestRated.voteAverage, highestRated.year } : null,
                lowestRatedMovie = lowestRated != null ? new { lowestRated.title, lowestRated.voteAverage, lowestRated.year } : null,
                // Web search enrichment
                height = webInfo.Height,
                awards = webInfo.Awards,
                trivia = webInfo.Trivia,
                latestNews = webInfo.LatestNews,
                // Filmography
                previousMovies,
                upcomingMovies,
                hits,
                flops,
                crewCredits = crewCredits.Take(30).ToList()
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch person details" });
        }
    }

    private async Task<IActionResult> GetJikanPersonDetails(string malPersonId)
    {
        try
        {
            var person = await _contentApiService.GetJikanPersonDetailsAsync(malPersonId);
            if (person == null) return NotFound("Person not found");

            // Calculate age
            int? age = null;
            if (!string.IsNullOrEmpty(person.Birthday) && DateTime.TryParse(person.Birthday, out var bday))
            {
                age = DateTime.Today.Year - bday.Year;
                if (DateTime.Today < bday.AddYears(age.Value)) age--;
            }

            // Build voice role filmography
            var voiceRoles = person.Voices?
                .Where(v => v.Anime != null)
                .Select(v => new
                {
                    id = v.Anime!.MalId,
                    title = v.Anime.Title ?? "",
                    character = v.Character?.Name ?? "",
                    mediaType = "anime",
                    releaseDate = "",
                    posterPath = v.Anime.Images?.Jpg?.ImageUrl
                              ?? v.Anime.Images?.Webp?.ImageUrl,
                    voteAverage = 0.0,
                    voteCount = 0,
                    popularity = 0.0,
                    isUpcoming = false,
                    isHit = false,
                    isFlop = false,
                    year = (int?)null
                })
                .GroupBy(v => v.id)
                .Select(g => g.First())
                .ToList() ?? [];

            // Build staff roles
            var staffRoles = person.Anime?
                .Where(a => a.Anime != null)
                .Select(a => new
                {
                    id = a.Anime!.MalId,
                    title = a.Anime.Title ?? "",
                    jobs = new[] { a.Position ?? "Staff" },
                    mediaType = "anime",
                    releaseDate = "",
                    posterPath = a.Anime.Images?.Jpg?.ImageUrl
                              ?? a.Anime.Images?.Webp?.ImageUrl,
                    voteAverage = 0.0,
                    voteCount = 0,
                })
                .GroupBy(a => a.id)
                .Select(g => g.First())
                .ToList() ?? [];

            var profileImg = person.Images?.Jpg?.ImageUrl
                          ?? person.Images?.Webp?.ImageUrl;

            // Enrich with web search data
            var webInfo = await _webSearch.GetPersonWebInfoAsync(person.Name ?? "");

            return Ok(new
            {
                id = person.MalId,
                name = person.Name,
                biography = person.About,
                birthday = person.Birthday,
                deathday = (string?)null,
                age,
                placeOfBirth = (string?)null,
                profilePath = profileImg,
                knownFor = "Voice Acting",
                gender = (string?)null,
                alsoKnownAs = person.AlternateNames?.Take(5).ToArray(),
                imdbId = (string?)null,
                totalMovies = 0,
                totalTvShows = voiceRoles.Count,
                totalCredits = voiceRoles.Count + staffRoles.Count,
                movieHits = 0,
                movieFlops = 0,
                averageRating = (double?)null,
                highestRatedMovie = (object?)null,
                lowestRatedMovie = (object?)null,
                height = webInfo.Height,
                awards = webInfo.Awards,
                trivia = webInfo.Trivia,
                latestNews = webInfo.LatestNews,
                favorites = person.Favorites,
                previousMovies = voiceRoles,
                upcomingMovies = Array.Empty<object>(),
                hits = Array.Empty<object>(),
                flops = Array.Empty<object>(),
                crewCredits = staffRoles.Take(30).ToList()
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch person details" });
        }
    }

    [HttpGet("genres/{type}")]
    public IActionResult GetGenresByType(string type)
    {
        try
        {
            var genres = type.ToLowerInvariant() switch
            {
                "movie" => new[]
                {
                    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
                    "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
                    "Romance", "Science Fiction", "Thriller", "War", "Western"
                },
                "tv" => new[]
                {
                    "Action & Adventure", "Animation", "Comedy", "Crime", "Documentary",
                    "Drama", "Family", "Kids", "Mystery", "News", "Reality", "Sci-Fi & Fantasy",
                    "Soap", "Talk", "War & Politics", "Western"
                },
                "anime" => new[]
                {
                    "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror",
                    "Isekai", "Mecha", "Music", "Mystery", "Romance", "School", "Seinen",
                    "Shojo", "Shonen", "Slice of Life", "Sports", "Supernatural", "Thriller"
                },
                _ => Array.Empty<string>()
            };

            return Ok(new { type, genres });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch genres" });
        }
    }

    [HttpGet("recommendations")]
    public async Task<IActionResult> GetRecommendations([FromQuery] string? type, [FromQuery] int page = 1)
    {
        try
        {
            var trendingMovies = await _contentApiService.GetTrendingMoviesAsync(1);
            var popularMovies = await _contentApiService.GetPopularMoviesAsync(1);
            var trendingTv = await _contentApiService.GetTrendingTvShowsAsync(1);
            var trendingAnime = await _contentApiService.GetTrendingAnimeAsync(1);

            var recommendations = new List<Content>();
            recommendations.AddRange(trendingMovies.Take(5));
            recommendations.AddRange(popularMovies.Take(5));
            recommendations.AddRange(trendingTv.Take(5));
            recommendations.AddRange(trendingAnime.Take(5));

            var random = new Random();
            var shuffled = recommendations
                .GroupBy(x => x.ExternalId).Select(g => g.First()) // deduplicate
                .OrderBy(x => random.Next()).Take(20).ToList();

            return Ok(WrapItems(shuffled));
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch recommendations" });
        }
    }

    [Authorize]
    [HttpGet("recommendations/liked")]
    public async Task<IActionResult> GetRecommendationsFromLiked([FromQuery] int limit = 30)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { error = "Invalid user identity" });

        if (limit < 1) limit = 30;
        if (limit > 60) limit = 60;

        try
        {
            var likedRows = await _db.UserContentStatuses
                .Include(u => u.Content)
                .Where(u => u.UserId == currentUserId && u.Status == WatchStatus.liked)
                .OrderByDescending(u => u.UpdatedAt)
                .Take(12)
                .ToListAsync();

            if (likedRows.Count == 0)
            {
                return Ok(new
                {
                    items = Array.Empty<object>(),
                    reason = "no_liked_items"
                });
            }

            var genreBoost = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in likedRows)
            {
                var genres = (row.Content.GenresCsv ?? string.Empty)
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var g in genres)
                {
                    if (!string.IsNullOrWhiteSpace(g)) genreBoost.Add(g);
                }
            }

            var recs = new List<Content>();
            foreach (var row in likedRows)
            {
                if (row.Content.Type == ContentType.movie)
                {
                    var tmdbId = row.Content.ExternalId;
                    var movieRecs = await _contentApiService.GetMovieRecommendationsAsync(tmdbId);
                    if (movieRecs?.Results != null)
                    {
                        recs.AddRange(movieRecs.Results.Select(r => new Content
                        {
                            ExternalId = r.Id.ToString(),
                            Source = "TMDB_MOVIE",
                            Type = ContentType.movie,
                            Title = r.Title ?? r.Name ?? string.Empty,
                            Year = DateTime.TryParse(r.ReleaseDate, out var d) ? d.Year : (int?)null,
                            PosterUrl = !string.IsNullOrEmpty(r.PosterPath) ? $"https://image.tmdb.org/t/p/w500{r.PosterPath}" : null,
                            BackdropUrl = !string.IsNullOrEmpty(r.BackdropPath) ? $"https://image.tmdb.org/t/p/original{r.BackdropPath}" : null,
                            Rating = r.VoteAverage > 0 ? (decimal)r.VoteAverage : null,
                            Synopsis = r.Overview,
                            GenresCsv = r.GenreIds != null
                                ? string.Join(',', r.GenreIds.Select(MapTmdbGenreName).Where(g => !string.IsNullOrWhiteSpace(g)))
                                : null
                        }));
                    }
                }
                else if (row.Content.Type == ContentType.tv)
                {
                    var tmdbId = row.Content.ExternalId;
                    var tvRecs = await _contentApiService.GetTvRecommendationsAsync(tmdbId);
                    if (tvRecs?.Results != null)
                    {
                        recs.AddRange(tvRecs.Results.Select(r => new Content
                        {
                            ExternalId = r.Id.ToString(),
                            Source = "TMDB_TV",
                            Type = ContentType.tv,
                            Title = r.Name ?? r.Title ?? string.Empty,
                            Year = DateTime.TryParse(r.FirstAirDate, out var d) ? d.Year : (int?)null,
                            PosterUrl = !string.IsNullOrEmpty(r.PosterPath) ? $"https://image.tmdb.org/t/p/w500{r.PosterPath}" : null,
                            BackdropUrl = !string.IsNullOrEmpty(r.BackdropPath) ? $"https://image.tmdb.org/t/p/original{r.BackdropPath}" : null,
                            Rating = r.VoteAverage > 0 ? (decimal)r.VoteAverage : null,
                            Synopsis = r.Overview,
                            GenresCsv = r.GenreIds != null
                                ? string.Join(',', r.GenreIds.Select(MapTmdbGenreName).Where(g => !string.IsNullOrWhiteSpace(g)))
                                : null
                        }));
                    }
                }
                else if (row.Content.Type == ContentType.anime)
                {
                    var animeRecs = await _contentApiService.GetAnimeRecommendationsAsync(row.Content.ExternalId);
                    if (animeRecs?.Data != null)
                    {
                        recs.AddRange(animeRecs.Data.Select(a => new Content
                        {
                            ExternalId = a.Entry?.MalId.ToString() ?? string.Empty,
                            Source = "MAL_ANIME",
                            Type = ContentType.anime,
                            Title = a.Entry?.Title ?? string.Empty,
                            PosterUrl = a.Entry?.Images?.Webp?.LargeImageUrl ?? a.Entry?.Images?.Jpg?.LargeImageUrl,
                            BackdropUrl = a.Entry?.Images?.Webp?.LargeImageUrl ?? a.Entry?.Images?.Jpg?.LargeImageUrl,
                            Rating = null,
                            Synopsis = string.Empty
                        }));
                    }
                }
            }

            var likedIds = likedRows.Select(x => $"{x.Content.Source}:{x.Content.ExternalId}").ToHashSet(StringComparer.OrdinalIgnoreCase);

            var ranked = recs
                .Where(r => !string.IsNullOrWhiteSpace(r.ExternalId) && !likedIds.Contains($"{r.Source}:{r.ExternalId}"))
                .GroupBy(r => $"{r.Source}:{r.ExternalId}")
                .Select(g => g.First())
                .OrderByDescending(r =>
                {
                    var score = r.Rating ?? 0;
                    var genres = (r.GenresCsv ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    var overlap = genres.Count(g => genreBoost.Contains(g));
                    return score + overlap;
                })
                .Take(limit)
                .ToList();

            return Ok(new
            {
                items = ranked.Select(MapToFrontend),
                basedOn = likedRows.Select(r => new
                {
                    r.Content.ExternalId,
                    r.Content.Title,
                    Type = r.Content.Type.ToString(),
                    genres = (r.Content.GenresCsv ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Select(g => g.Trim())
                        .Where(g => !string.IsNullOrWhiteSpace(g))
                        .ToArray()
                })
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to fetch recommendations from liked list" });
        }
    }

    [HttpGet("search/people")]
    public async Task<IActionResult> SearchPeople(
        [FromQuery] string query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        [FromQuery] bool indianOnly = false)
    {
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest("Query parameter is required");

        if (pageSize < 1) pageSize = 12;
        if (pageSize > 25) pageSize = 25;

        try
        {
            var people = await _contentApiService.SearchPeopleAsync(query, page);
            var filtered = people;

            if (indianOnly)
            {
                var indiaKeywords = new[]
                {
                    "india", "indian", "mumbai", "bollywood", "tollywood", "kollywood", "hyderabad", "chennai", "kerala", "kannada", "hindi", "tamil", "telugu", "malayalam"
                };

                var detailsTasks = filtered.Take(25).Select(async p => new
                {
                    Person = p,
                    Details = await _contentApiService.GetPersonDetailsAsync(p.Id.ToString())
                });

                var details = await Task.WhenAll(detailsTasks);
                filtered = details
                    .Where(x =>
                    {
                        var place = x.Details?.PlaceOfBirth?.ToLowerInvariant() ?? string.Empty;
                        var bio = x.Details?.Biography?.ToLowerInvariant() ?? string.Empty;
                        return indiaKeywords.Any(k => place.Contains(k)) || indiaKeywords.Any(k => bio.Contains(k));
                    })
                    .Select(x => x.Person)
                    .ToList();
            }

            var top = filtered
                .OrderByDescending(p => p.Popularity)
                .Take(pageSize)
                .ToList();

            var enriched = await Task.WhenAll(top.Select(async p =>
            {
                var details = await _contentApiService.GetPersonDetailsAsync(p.Id.ToString());
                var bio = details?.Biography;
                if (!string.IsNullOrWhiteSpace(bio) && bio.Length > 320)
                    bio = bio[..320] + "...";

                return new
                {
                    id = p.Id,
                    name = p.Name ?? string.Empty,
                    knownForDepartment = p.KnownForDepartment,
                    profilePath = !string.IsNullOrEmpty(p.ProfilePath) ? $"https://image.tmdb.org/t/p/w342{p.ProfilePath}" : null,
                    popularity = p.Popularity,
                    biography = bio ?? string.Empty,
                    placeOfBirth = details?.PlaceOfBirth,
                    knownFor = p.KnownFor?.Select(k => k.Title ?? k.Name ?? string.Empty).Where(x => !string.IsNullOrWhiteSpace(x)).Take(4).ToArray() ?? Array.Empty<string>()
                };
            }));

            return Ok(new
            {
                items = enriched,
                totalCount = filtered.Count,
                page,
                pageSize,
                hasMore = filtered.Count > pageSize
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to search people" });
        }
    }

    /// <summary>
    /// Get top-ranked anime from Jikan (supplementary source).
    /// </summary>
    [HttpGet("anime/top-ranked")]
    public async Task<IActionResult> GetTopRankedAnime(
        [FromQuery] int page = 1,
        [FromQuery] int size = 20,
        [FromQuery] string? genres = null)
    {
        try
        {
            var data = await _animeDb.GetTopRankedAsync(page, size, genres, "TV", HttpContext.RequestAborted);
            if (data is not System.Text.Json.JsonElement je || !je.TryGetProperty("data", out var arr))
                return Ok(new { items = Array.Empty<object>() });

            var items = new List<object>();
            foreach (var a in arr.EnumerateArray())
            {
                var id = a.TryGetProperty("mal_id", out var malIdProp) && malIdProp.ValueKind == System.Text.Json.JsonValueKind.Number
                    ? malIdProp.GetInt32().ToString()
                    : (a.TryGetProperty("_id", out var idProp) && idProp.ValueKind == System.Text.Json.JsonValueKind.String
                        ? idProp.GetString()
                        : null);

                var title = a.TryGetProperty("title", out var titleProp) && titleProp.ValueKind == System.Text.Json.JsonValueKind.String
                    ? titleProp.GetString()
                    : "";

                string? image = null;
                if (a.TryGetProperty("images", out var imagesProp) && imagesProp.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    if (imagesProp.TryGetProperty("webp", out var webpProp) && webpProp.ValueKind == System.Text.Json.JsonValueKind.Object)
                    {
                        if (webpProp.TryGetProperty("large_image_url", out var largeWebp) && largeWebp.ValueKind == System.Text.Json.JsonValueKind.String)
                            image = largeWebp.GetString();
                        else if (webpProp.TryGetProperty("image_url", out var webp) && webp.ValueKind == System.Text.Json.JsonValueKind.String)
                            image = webp.GetString();
                    }

                    if (string.IsNullOrWhiteSpace(image) && imagesProp.TryGetProperty("jpg", out var jpgProp) && jpgProp.ValueKind == System.Text.Json.JsonValueKind.Object)
                    {
                        if (jpgProp.TryGetProperty("large_image_url", out var largeJpg) && largeJpg.ValueKind == System.Text.Json.JsonValueKind.String)
                            image = largeJpg.GetString();
                        else if (jpgProp.TryGetProperty("image_url", out var jpg) && jpg.ValueKind == System.Text.Json.JsonValueKind.String)
                            image = jpg.GetString();
                    }
                }

                if (string.IsNullOrWhiteSpace(image) && a.TryGetProperty("image", out var imgProp) && imgProp.ValueKind == System.Text.Json.JsonValueKind.String)
                    image = imgProp.GetString();

                var synopsis = a.TryGetProperty("synopsis", out var synProp) && synProp.ValueKind == System.Text.Json.JsonValueKind.String
                    ? synProp.GetString()
                    : "";

                var ranking = a.TryGetProperty("rank", out var rankProp) && rankProp.ValueKind == System.Text.Json.JsonValueKind.Number
                    ? rankProp.GetInt32()
                    : (a.TryGetProperty("ranking", out var rankingProp) && rankingProp.ValueKind == System.Text.Json.JsonValueKind.Number
                        ? rankingProp.GetInt32()
                        : (int?)null);

                var eps = a.TryGetProperty("episodes", out var epsProp) && epsProp.ValueKind == System.Text.Json.JsonValueKind.Number
                    ? epsProp.GetInt32()
                    : (int?)null;

                var score = a.TryGetProperty("score", out var scoreProp) && scoreProp.ValueKind == System.Text.Json.JsonValueKind.Number
                    ? scoreProp.GetDouble()
                    : 0.0;

                var scoredBy = a.TryGetProperty("scored_by", out var scoredByProp) && scoredByProp.ValueKind == System.Text.Json.JsonValueKind.Number
                    ? scoredByProp.GetInt32()
                    : 0;

                var genresArr = a.TryGetProperty("genres", out var gProp) && gProp.ValueKind == System.Text.Json.JsonValueKind.Array
                    ? gProp.EnumerateArray()
                        .Select(g =>
                        {
                            if (g.ValueKind == System.Text.Json.JsonValueKind.String) return g.GetString();
                            if (g.ValueKind == System.Text.Json.JsonValueKind.Object && g.TryGetProperty("name", out var nameProp) && nameProp.ValueKind == System.Text.Json.JsonValueKind.String)
                                return nameProp.GetString();
                            return null;
                        })
                        .Where(g => !string.IsNullOrWhiteSpace(g))
                        .Select(g => g!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray()
                    : Array.Empty<string>();

                items.Add(new
                {
                    externalId = id ?? "",
                    title = title ?? "",
                    overview = synopsis ?? "",
                    posterPath = image,
                    backdropPath = image,
                    releaseDate = "",
                    voteAverage = score,
                    voteCount = scoredBy,
                    popularity = ranking.HasValue ? 10000 - ranking.Value : 0.0,
                    genreIds = Array.Empty<int>(),
                    genres = genresArr,
                    source = "jikan",
                    type = "anime",
                    episodes = eps,
                    ranking
                });
            }

            return Ok(new { items });
        }
        catch (Exception)
        {
            return Ok(new { items = Array.Empty<object>() });
        }
    }

    /// <summary>
    /// Fetch real-time ratings from IMDb, Metacritic via imdb8 + OMDb.
    /// </summary>
    [HttpGet("ratings")]
    public async Task<IActionResult> GetRatings(
        [FromQuery] string title,
        [FromQuery] int? year,
        [FromQuery] string? imdbId,
        [FromQuery] string? source,
        [FromQuery] double? tmdbRating,
        [FromQuery] int? tmdbVotes)
    {
        if (string.IsNullOrWhiteSpace(title))
            return BadRequest("Title parameter is required");

        var ct = HttpContext.RequestAborted;

        // Step 1: Resolve IMDb id via OMDb (free, no RapidAPI needed)
        double? imdbRating = null;
        long? imdbVoteCount = null;
        var resolvedImdbId = imdbId;

        try
        {
            if (string.IsNullOrEmpty(resolvedImdbId))
                resolvedImdbId = await _omdb.SearchImdbIdAsync(title, year, ct);
        }
        catch { /* OMDb may be unavailable */ }

        // Step 2: Fetch Metacritic from OMDb (most reliable source)
        OmdbRatings? omdbRatings = null;
        try
        {
            omdbRatings = !string.IsNullOrEmpty(resolvedImdbId)
                ? await _omdb.GetByImdbIdAsync(resolvedImdbId, ct)
                : await _omdb.SearchByTitleAsync(title, year, ct);
        }
        catch { /* OMDb may be unavailable */ }

        // Use OMDb as IMDb fallback if still missing
        if (imdbRating == null && omdbRatings?.ImdbRating > 0)
        {
            resolvedImdbId = omdbRatings.ImdbId;
            imdbRating = omdbRatings.ImdbRating.Value;
            imdbVoteCount = omdbRatings.ImdbVotes ?? 0;
        }

        // Step 3: Fallback to imdb-api worker when OMDb misses IMDb rating.
        if (imdbRating == null)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(resolvedImdbId))
                {
                    var imdbTitle = await _imdbApi.GetTitleDetailsAsync(resolvedImdbId, ct);
                    if (imdbTitle?.Rating is > 0)
                        imdbRating = (double)imdbTitle.Rating.Value;
                }
                else
                {
                    var candidates = await _imdbApi.SearchAsync(title, ct);
                    var best = candidates
                        .Where(c => c.ExternalId.StartsWith("tt", StringComparison.OrdinalIgnoreCase))
                        .OrderByDescending(c =>
                            (year.HasValue && c.Year == year.Value ? 3 : 0) +
                            (c.Title.Equals(title, StringComparison.OrdinalIgnoreCase) ? 2 : 0) +
                            (c.Title.Contains(title, StringComparison.OrdinalIgnoreCase) ? 1 : 0))
                        .FirstOrDefault();

                    if (best != null)
                    {
                        resolvedImdbId = best.ExternalId;
                        var imdbTitle = await _imdbApi.GetTitleDetailsAsync(best.ExternalId, ct);
                        if (imdbTitle?.Rating is > 0)
                            imdbRating = (double)imdbTitle.Rating.Value;
                    }
                }
            }
            catch
            {
                // Optional fallback only.
            }
        }

        return Ok(new
        {
            imdb = imdbRating.HasValue ? new
            {
                rating = imdbRating.Value,
                votes = imdbVoteCount ?? 0,
                imdbId = resolvedImdbId
            } : null,
            metacritic = omdbRatings?.Metascore > 0 ? new
            {
                metascore = omdbRatings.Metascore.Value,
                imdbId = omdbRatings.ImdbId
            } : null
        });
    }

    // ─── Entertainment News ─────────────────────────────────────────────

    [HttpGet("news")]
    public async Task<IActionResult> GetEntertainmentNews(CancellationToken ct)
    {
        const string cacheKey = "entertainment_news_v2";
        if (_cache.TryGetValue(cacheKey, out object? cached))
            return Ok(cached);

        try
        {
            // Fetch real entertainment news from public keyless RSS/news feeds.
            var newsItems = await FetchEntertainmentNewsViaReflectionAsync(ct);

            if (newsItems.Count == 0)
            {
                var fallbackItems = await BuildFallbackEntertainmentNewsAsync();
                var fallbackResult = new { items = fallbackItems };
                if (fallbackItems.Count > 0)
                    _cache.Set(cacheKey, fallbackResult, TimeSpan.FromMinutes(15));
                return Ok(fallbackResult);
            }

            // Categorize news items
            var categorizedNews = newsItems;

            await PopulateHighResNewsImagesAsync(categorizedNews);

            var result = new { items = categorizedNews };
            if (categorizedNews.Count > 0)
                _cache.Set(cacheKey, result, TimeSpan.FromMinutes(60));
            
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching entertainment news");
            
            // Fallback to cached content if news APIs fail
            var fallbackItems = await BuildFallbackEntertainmentNewsAsync();
            var fallbackResult = new { items = fallbackItems };
            if (fallbackItems.Count > 0)
                _cache.Set(cacheKey, fallbackResult, TimeSpan.FromMinutes(15));
            
            return Ok(fallbackResult);
        }
    }

    private async Task<List<NewsResponseItem>> FetchEntertainmentNewsViaReflectionAsync(CancellationToken ct)
    {
        try
        {
            var newsItems = await _newsApi.GetEntertainmentNewsAsync(ct);
            var mappedItems = new List<NewsResponseItem>();

            foreach (var item in newsItems)
            {
                if (item == null || string.IsNullOrWhiteSpace(item.Title))
                    continue;

                mappedItems.Add(new NewsResponseItem
                {
                    title = item.Title,
                    url = item.Url,
                    snippet = item.Description,
                    source = item.Source,
                    category = string.IsNullOrWhiteSpace(item.Category)
                        ? CategorizeNewsItemFromContent(item.Title, item.Description)
                        : item.Category,
                    imageUrl = item.ImageUrl,
                    publishedAt = item.PublishedAt
                });
            }

            return mappedItems;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching entertainment news");
            return new List<NewsResponseItem>();
        }
    }

    private async Task PopulateHighResNewsImagesAsync(List<NewsResponseItem> items)
    {
        if (items.Count == 0)
            return;

        var categoryBackdrops = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var popularMovies = await _contentApiService.GetTrendingMoviesAsync(1);
            var movieBackdrops = popularMovies
                .Where(m => !string.IsNullOrWhiteSpace(m.BackdropUrl))
                .Select(m => m.BackdropUrl!)
                .Take(20)
                .ToList();

            var popularTv = await _contentApiService.GetTrendingTvShowsAsync(1);
            var tvBackdrops = popularTv
                .Where(t => !string.IsNullOrWhiteSpace(t.BackdropUrl))
                .Select(t => t.BackdropUrl!)
                .Take(20)
                .ToList();

            var trendingAnime = await _contentApiService.GetTrendingAnimeAsync(1);
            var animeImages = trendingAnime
                .Select(a => a.BackdropUrl ?? a.PosterUrl)
                .Where(url => !string.IsNullOrWhiteSpace(url))
                .Select(url => url!)
                .Take(20)
                .ToList();

            categoryBackdrops["Movies"] = movieBackdrops;
            categoryBackdrops["Box Office"] = movieBackdrops;
            categoryBackdrops["Trailers"] = movieBackdrops;
            categoryBackdrops["Reviews"] = movieBackdrops;
            categoryBackdrops["Bollywood"] = movieBackdrops;
            categoryBackdrops["India"] = movieBackdrops;

            categoryBackdrops["TV Shows"] = tvBackdrops;
            categoryBackdrops["Streaming"] = tvBackdrops;

            // Use anime posters/backdrops first so Anime tab stays visually relevant.
            categoryBackdrops["Anime"] = animeImages.Count > 0 ? animeImages : movieBackdrops;
            categoryBackdrops["Entertainment"] = movieBackdrops.Count > 0 ? movieBackdrops : tvBackdrops;
        }
        catch
        {
            return;
        }

        var counters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items)
        {
            if (!string.IsNullOrWhiteSpace(item.imageUrl) && !NeedsHighResFallback(item.imageUrl))
                continue;

            var category = string.IsNullOrWhiteSpace(item.category) ? "Entertainment" : item.category;
            if (!categoryBackdrops.TryGetValue(category, out var images) || images.Count == 0)
                continue;

            var idx = counters.TryGetValue(category, out var current) ? current : 0;
            item.imageUrl = images[idx % images.Count];
            counters[category] = idx + 1;
        }
    }

    private static bool NeedsHighResFallback(string imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
            return true;

        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri))
            return false;

        var host = uri.Host.ToLowerInvariant();
        if (host.Contains("news.google.com"))
            return true;

        var query = uri.Query.ToLowerInvariant();
        if (query.Contains("w=") || query.Contains("width=") || query.Contains("resize=") || query.Contains("fit="))
            return true;

        return false;
    }

    private string CategorizeNewsItemFromContent(string? title, string? description)
    {
        var text = $"{title} {description}".ToLowerInvariant();
        
        if (text.Contains("anime") || text.Contains("manga") || text.Contains("season") && text.Contains("episode"))
            return "Anime";
        if (text.Contains("movie") || text.Contains("film") || text.Contains("cinema"))
            return "Movies";
        if (text.Contains("tv show") || text.Contains("series") || text.Contains("episode"))
            return "TV Shows";
        if (text.Contains("box office") || text.Contains("weekend"))
            return "Box Office";
        if (text.Contains("netflix") || text.Contains("amazon") || text.Contains("disney") || text.Contains("hulu") || text.Contains("streaming"))
            return "Streaming";
        if (text.Contains("bollywood") || text.Contains("hindi"))
            return "Bollywood";
        if (text.Contains("trailer") || text.Contains("teaser"))
            return "Trailers";
        if (text.Contains("review") || text.Contains("rating"))
            return "Reviews";
        
        return "Entertainment";
    }

    private async Task<List<object>> BuildFallbackEntertainmentNewsAsync()
    {
        var fallbackItems = new List<object>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        async Task AddFallbackItems(Task<List<Content>> fetchTask, string category)
        {
            List<Content> items;
            try
            {
                items = await fetchTask;
            }
            catch
            {
                return;
            }

            foreach (var item in items.Where(item => !string.IsNullOrWhiteSpace(item.Title)).Take(8))
            {
                var key = $"{item.Type}:{item.ExternalId}";
                if (!seen.Add(key))
                    continue;

                fallbackItems.Add(new
                {
                    title = $"{item.Title} is trending now",
                    url = $"/content/{item.Type}/{item.ExternalId}",
                    snippet = string.IsNullOrWhiteSpace(item.Synopsis)
                        ? $"See why {item.Title} is one of the most talked-about {category.ToLowerInvariant()} picks right now."
                        : item.Synopsis,
                    source = MapNewsSource(item.Source),
                    category,
                    imageUrl = item.BackdropUrl ?? item.PosterUrl
                });
            }
        }

        await AddFallbackItems(_contentApiService.GetTrendingMoviesAsync(1), "Movies");
        await AddFallbackItems(_contentApiService.GetTrendingTvShowsAsync(1), "TV Shows");
        await AddFallbackItems(_contentApiService.GetTrendingAnimeAsync(1), "Anime");

        return fallbackItems.Take(24).ToList();
    }

    private static string MapNewsSource(string? source) =>
        source switch
        {
            var s when s?.Contains("MAL", StringComparison.OrdinalIgnoreCase) == true => "MyAnimeList",
            var s when s?.Contains("TMDB", StringComparison.OrdinalIgnoreCase) == true => "TMDB",
            _ => "StreamVault"
        };

    /// <summary>Try to find a TMDB backdrop for a keyword (movie/show title).</summary>
    private async Task<string?> FindTmdbBackdropAsync(string query, CancellationToken ct)
    {
        try
        {
            var results = await _contentApiService.SearchMoviesAsync(query, 1);
            var match = results.FirstOrDefault();
            if (match?.BackdropUrl != null) return match.BackdropUrl;

            var tvResults = await _contentApiService.SearchTvShowsAsync(query, 1);
            var tvMatch = tvResults.FirstOrDefault();
            return tvMatch?.BackdropUrl;
        }
        catch { return null; }
    }

    /// <summary>Extract a likely movie/show name from a news title.</summary>
    private static string? ExtractMediaName(string title)
    {
        // Remove common suffixes like "- YouTube", "| Fandango", "- Rotten Tomatoes"
        var cleaned = System.Text.RegularExpressions.Regex.Replace(
            title, @"\s*[\|\-–—]\s*(YouTube|Fandango|Wikipedia|Rotten Tomatoes|IMDb|Reddit|FirstShowing\.net|Time Out|Box Office Mojo).*$",
            "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();

        // Remove prefixes like "BEST UPCOMING MOVIES 2026 (Trailers)" — too generic
        if (cleaned.Length > 80 || cleaned.Split(' ').Length > 10) return null;

        // Remove year patterns and "list of" style titles
        if (cleaned.StartsWith("List of", StringComparison.OrdinalIgnoreCase)) return null;
        if (cleaned.StartsWith("Domestic", StringComparison.OrdinalIgnoreCase)) return null;
        if (cleaned.StartsWith("BEST UPCOMING", StringComparison.OrdinalIgnoreCase)) return null;
        if (cleaned.StartsWith("New Movies Out", StringComparison.OrdinalIgnoreCase)) return null;

        return cleaned.Length >= 3 ? cleaned : null;
    }

    private static string ExtractDomain(string url)
    {
        try
        {
            var uri = new Uri(url);
            return uri.Host.Replace("www.", "");
        }
        catch { return ""; }
    }

    private static string CategorizeNewsItem(string title)
    {
        var lower = title.ToLowerInvariant();
        if (lower.Contains("anime") || lower.Contains("manga")) return "Anime";
        if (lower.Contains("bollywood") || lower.Contains("hindi") || lower.Contains("tollywood")) return "Bollywood";
        if (lower.Contains("netflix") || lower.Contains("disney") || lower.Contains("amazon") || lower.Contains("hbo") || lower.Contains("streaming")) return "Streaming";
        if (lower.Contains("box office") || lower.Contains("gross") || lower.Contains("collection")) return "Box Office";
        if (lower.Contains("trailer") || lower.Contains("teaser")) return "Trailers";
        if (lower.Contains("review") || lower.Contains("rating")) return "Reviews";
        if (lower.Contains("tv") || lower.Contains("series") || lower.Contains("show")) return "TV Shows";
        return "Movies";
    }

    // ── IMDb API Endpoints (tuhinpal/imdb-api) ──

    /// <summary>
    /// Get detailed IMDb info for a title by IMDb ID (e.g. tt0848228).
    /// Includes rating, plot, genres, actors, directors, runtime.
    /// </summary>
    [HttpGet("imdb/{imdbId}")]
    public async Task<IActionResult> GetImdbDetails(string imdbId)
    {
        if (string.IsNullOrWhiteSpace(imdbId) || !imdbId.StartsWith("tt"))
            return BadRequest(new { error = "Invalid IMDb ID. Must start with 'tt'." });

        var details = await _imdbApi.GetTitleDetailsAsync(imdbId);
        if (details == null)
            return NotFound(new { error = "Title not found on IMDb." });

        return Ok(new
        {
            imdbId = details.ImdbId,
            title = details.Title,
            year = details.Year,
            rating = details.Rating,
            contentRating = details.ContentRating,
            plot = details.Plot,
            poster = details.Poster,
            runtime = details.Runtime,
            releaseDate = details.ReleaseDate,
            genres = details.Genres,
            actors = details.Actors,
            directors = details.Directors
        });
    }

    /// <summary>
    /// Get IMDb user reviews for a title by IMDb ID.
    /// </summary>
    [HttpGet("imdb/{imdbId}/reviews")]
    public async Task<IActionResult> GetImdbReviews(string imdbId)
    {
        if (string.IsNullOrWhiteSpace(imdbId) || !imdbId.StartsWith("tt"))
            return BadRequest(new { error = "Invalid IMDb ID. Must start with 'tt'." });

        var reviews = await _imdbApi.GetReviewsAsync(imdbId);
        return Ok(new { imdbId, reviews });
    }
}