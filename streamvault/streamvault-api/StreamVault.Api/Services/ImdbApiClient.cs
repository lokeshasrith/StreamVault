using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using StreamVault.Api.Models;

namespace StreamVault.Api.Services;

/// <summary>
/// Client for the free tuhinpal/imdb-api (https://github.com/tuhinpal/imdb-api).
/// Hosted on Cloudflare Workers — no API key required.
/// Provides IMDb search, title details, and reviews.
/// </summary>
public sealed class ImdbApiClient
{
    private const string BaseUrl = "https://imdb-api.tprojects.workers.dev";

    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ImdbApiClient> _logger;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(15);

    public ImdbApiClient(
        IHttpClientFactory factory,
        IMemoryCache cache,
        ILogger<ImdbApiClient> logger)
    {
        _http = factory.CreateClient("imdb-tuhin");
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Search IMDb for titles matching the query.
    /// </summary>
    public async Task<List<Content>> SearchAsync(string query, CancellationToken ct = default)
    {
        var cacheKey = $"imdb-api:search:{query.ToLowerInvariant()}";
        if (_cache.TryGetValue(cacheKey, out List<Content>? cached) && cached != null)
            return cached;

        try
        {
            var url = $"{BaseUrl}/search?query={Uri.EscapeDataString(query)}";
            var response = await _http.GetAsync(url, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("imdb-api search failed for '{Query}': {Status}", query, response.StatusCode);
                return new List<Content>();
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);

            var results = new List<Content>();

            if (json.TryGetProperty("ok", out var ok) && ok.GetBoolean() &&
                json.TryGetProperty("results", out var resultsArr) &&
                resultsArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in resultsArr.EnumerateArray())
                {
                    var id = item.GetPropertyOrDefault("id", "");
                    var title = item.GetPropertyOrDefault("title", "");
                    var image = item.GetPropertyOrDefault("image", "");
                    var typeStr = item.GetPropertyOrDefault("type", "");
                    var yearStr = item.GetPropertyOrDefault("year", "");

                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(title))
                        continue;

                    int? year = int.TryParse(yearStr?.Replace("–", "").Trim().Split('-').FirstOrDefault(), out var y) ? y : null;

                    var contentType = typeStr switch
                    {
                        "movie" or "Movie" or "feature" => ContentType.movie,
                        "tvSeries" or "TV Series" or "TV series" or "TV Mini Series" => ContentType.tv,
                        _ when typeStr?.Contains("Series", StringComparison.OrdinalIgnoreCase) == true => ContentType.tv,
                        _ => ContentType.movie
                    };

                    results.Add(new Content
                    {
                        ExternalId = id,
                        Source = "IMDB",
                        Type = contentType,
                        Title = title,
                        Year = year,
                        PosterUrl = CleanImageUrl(image)
                    });
                }
            }

            _cache.Set(cacheKey, results, CacheDuration);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "imdb-api search error for '{Query}'", query);
            return new List<Content>();
        }
    }

    /// <summary>
    /// Get detailed info for a specific IMDb title by ID (e.g. "tt0848228").
    /// Returns enriched Content with rating, synopsis, genres, etc.
    /// </summary>
    public async Task<ImdbTitleDetails?> GetTitleDetailsAsync(string imdbId, CancellationToken ct = default)
    {
        var cacheKey = $"imdb-api:title:{imdbId}";
        if (_cache.TryGetValue(cacheKey, out ImdbTitleDetails? cached))
            return cached;

        try
        {
            var url = $"{BaseUrl}/title/{Uri.EscapeDataString(imdbId)}";
            var response = await _http.GetAsync(url, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("imdb-api title/{Id} returned {Status}", imdbId, response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);

            if (!json.TryGetProperty("ok", out var ok) || !ok.GetBoolean())
                return null;

            var result = new ImdbTitleDetails
            {
                ImdbId = imdbId,
                Title = json.GetPropertyOrDefault("title", ""),
                Year = ParseYear(json.GetPropertyOrDefault("year", "")),
                Rating = ParseDecimal(json.GetPropertyOrDefault("rating", "")),
                ContentRating = json.GetPropertyOrDefault("contentRating", ""),
                Plot = json.GetPropertyOrDefault("plot", ""),
                Poster = CleanImageUrl(json.GetPropertyOrDefault("image", "")),
                Runtime = json.GetPropertyOrDefault("runtime", ""),
                ReleaseDate = json.GetPropertyOrDefault("releaseDate", "")
            };

            // Parse genres
            if (json.TryGetProperty("genre", out var genreEl))
            {
                if (genreEl.ValueKind == JsonValueKind.Array)
                    result.Genres = genreEl.EnumerateArray().Select(g => g.GetString() ?? "").Where(g => g.Length > 0).ToList();
                else if (genreEl.ValueKind == JsonValueKind.String)
                    result.Genres = genreEl.GetString()?.Split(',', StringSplitOptions.TrimEntries).ToList() ?? new();
            }

            // Parse actors/directors
            if (json.TryGetProperty("actors", out var actors) && actors.ValueKind == JsonValueKind.Array)
                result.Actors = actors.EnumerateArray().Select(a => a.GetString() ?? "").Where(a => a.Length > 0).ToList();

            if (json.TryGetProperty("directors", out var directors) && directors.ValueKind == JsonValueKind.Array)
                result.Directors = directors.EnumerateArray().Select(d => d.GetString() ?? "").Where(d => d.Length > 0).ToList();

            _cache.Set(cacheKey, result, CacheDuration);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "imdb-api title error for '{Id}'", imdbId);
            return null;
        }
    }

    /// <summary>
    /// Get user reviews for an IMDb title.
    /// </summary>
    public async Task<List<ImdbReview>> GetReviewsAsync(string imdbId, CancellationToken ct = default)
    {
        var cacheKey = $"imdb-api:reviews:{imdbId}";
        if (_cache.TryGetValue(cacheKey, out List<ImdbReview>? cached) && cached != null)
            return cached;

        try
        {
            var url = $"{BaseUrl}/reviews/{Uri.EscapeDataString(imdbId)}";
            var response = await _http.GetAsync(url, ct);

            if (!response.IsSuccessStatusCode)
                return new List<ImdbReview>();

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);

            var reviews = new List<ImdbReview>();

            if (json.TryGetProperty("ok", out var ok) && ok.GetBoolean() &&
                json.TryGetProperty("reviews", out var reviewsArr) &&
                reviewsArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var r in reviewsArr.EnumerateArray())
                {
                    reviews.Add(new ImdbReview
                    {
                        Title = r.GetPropertyOrDefault("title", ""),
                        Content = r.GetPropertyOrDefault("content", ""),
                        Author = r.GetPropertyOrDefault("author", ""),
                        Rating = r.GetPropertyOrDefault("rating", ""),
                        Date = r.GetPropertyOrDefault("date", ""),
                        Helpful = r.GetPropertyOrDefault("helpful", "")
                    });
                }
            }

            _cache.Set(cacheKey, reviews, CacheDuration);
            return reviews;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "imdb-api reviews error for '{Id}'", imdbId);
            return new List<ImdbReview>();
        }
    }

    private static string CleanImageUrl(string url)
    {
        // The API sometimes returns Amazon image URLs with resize params — keep them as-is
        return string.IsNullOrWhiteSpace(url) ? "" : url;
    }

    private static int? ParseYear(string yearStr)
    {
        if (string.IsNullOrWhiteSpace(yearStr)) return null;
        // Handle "2012–2014" style ranges
        var first = yearStr.Replace("–", "-").Split('-').FirstOrDefault()?.Trim();
        return int.TryParse(first, out var y) ? y : null;
    }

    private static decimal? ParseDecimal(string val)
    {
        if (string.IsNullOrWhiteSpace(val)) return null;
        return decimal.TryParse(val, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : null;
    }
}

// ── Response Models ──

public sealed class ImdbTitleDetails
{
    public string ImdbId { get; set; } = "";
    public string Title { get; set; } = "";
    public int? Year { get; set; }
    public decimal? Rating { get; set; }
    public string ContentRating { get; set; } = "";
    public string Plot { get; set; } = "";
    public string Poster { get; set; } = "";
    public string Runtime { get; set; } = "";
    public string ReleaseDate { get; set; } = "";
    public List<string> Genres { get; set; } = new();
    public List<string> Actors { get; set; } = new();
    public List<string> Directors { get; set; } = new();
}

public sealed class ImdbReview
{
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string Author { get; set; } = "";
    public string Rating { get; set; } = "";
    public string Date { get; set; } = "";
    public string Helpful { get; set; } = "";
}

/// <summary>
/// Extension for safe JsonElement property access.
/// </summary>
internal static class JsonElementExtensions
{
    public static string GetPropertyOrDefault(this JsonElement el, string name, string defaultValue)
    {
        if (el.TryGetProperty(name, out var prop))
        {
            return prop.ValueKind switch
            {
                JsonValueKind.String => prop.GetString() ?? defaultValue,
                JsonValueKind.Number => prop.GetRawText(),
                _ => defaultValue
            };
        }
        return defaultValue;
    }
}
