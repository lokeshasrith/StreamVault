using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace StreamVault.Api.Services;

/// <summary>
/// Client for the OMDb API (omdbapi.com).
/// Provides IMDb rating, Metascore, and Rotten Tomatoes data.
/// </summary>
public sealed class OmdbClient
{
    private const string ApiKey = "trilogy";
    private const string BaseUrl = "https://www.omdbapi.com/";

    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<OmdbClient> _logger;

    public OmdbClient(
        IHttpClientFactory factory,
        IMemoryCache cache,
        ILogger<OmdbClient> logger)
    {
        _http = factory.CreateClient("omdb");
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Fetch ratings by IMDb ID.
    /// </summary>
    public async Task<OmdbRatings?> GetByImdbIdAsync(string imdbId, CancellationToken ct = default)
    {
        var cacheKey = $"omdb:{imdbId}";
        if (_cache.TryGetValue(cacheKey, out OmdbRatings? cached))
            return cached;

        try
        {
            var url = $"{BaseUrl}?i={Uri.EscapeDataString(imdbId)}&apikey={ApiKey}";
            var json = await _http.GetFromJsonAsync<JsonElement>(url, ct);

            var result = ParseResponse(json);
            if (result != null)
                _cache.Set(cacheKey, result, TimeSpan.FromHours(6));

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OMDb GetByImdbIdAsync failed for {ImdbId}", imdbId);
            return null;
        }
    }

    /// <summary>
    /// Fetch ratings by title (and optional year).
    /// </summary>
    public async Task<OmdbRatings?> SearchByTitleAsync(string title, int? year = null, CancellationToken ct = default)
    {
        var cacheKey = $"omdb:search:{title}:{year}";
        if (_cache.TryGetValue(cacheKey, out OmdbRatings? cached))
            return cached;

        try
        {
            var url = $"{BaseUrl}?t={Uri.EscapeDataString(title)}&apikey={ApiKey}";
            if (year.HasValue)
                url += $"&y={year}";

            var json = await _http.GetFromJsonAsync<JsonElement>(url, ct);

            var result = ParseResponse(json);
            if (result != null)
                _cache.Set(cacheKey, result, TimeSpan.FromHours(6));

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OMDb SearchByTitleAsync failed for {Title}", title);
            return null;
        }
    }

    /// <summary>
    /// Search for a title by name and return its IMDb ID.
    /// Replaces IMDb8 SearchImdbIdAsync.
    /// </summary>
    public async Task<string?> SearchImdbIdAsync(string title, int? year = null, CancellationToken ct = default)
    {
        var ratings = await SearchByTitleAsync(title, year, ct);
        return !string.IsNullOrEmpty(ratings?.ImdbId) ? ratings.ImdbId : null;
    }

    /// <summary>
    /// Get IMDb rating and Metascore by IMDb ID (replaces IMDb8).
    /// Returns a tuple compatible with previous IMDb8 interface.
    /// </summary>
    public async Task<(ImdbRatingResult? imdb, MetascoreResult? meta)> GetRatingAndMetascoreByIdAsync(string imdbId, CancellationToken ct = default)
    {
        var ratings = await GetByImdbIdAsync(imdbId, ct);
        if (ratings == null) return (null, null);

        ImdbRatingResult? imdbResult = null;
        if (ratings.ImdbRating > 0)
        {
            imdbResult = new ImdbRatingResult
            {
                ImdbId = ratings.ImdbId,
                Rating = ratings.ImdbRating.Value,
                VoteCount = ratings.ImdbVotes ?? 0
            };
        }

        MetascoreResult? metaResult = ratings.Metascore is > 0
            ? new MetascoreResult { ImdbId = ratings.ImdbId, Metascore = ratings.Metascore.Value }
            : null;

        return (imdbResult, metaResult);
    }

    private static OmdbRatings? ParseResponse(JsonElement json)
    {
        // Check for error response
        if (json.TryGetProperty("Response", out var resp) && resp.GetString() == "False")
            return null;

        var result = new OmdbRatings();

        if (json.TryGetProperty("imdbID", out var id))
            result.ImdbId = id.GetString() ?? "";

        // Metascore
        if (json.TryGetProperty("Metascore", out var ms))
        {
            var msStr = ms.GetString();
            if (int.TryParse(msStr, out var metascore) && metascore > 0)
                result.Metascore = metascore;
        }

        // IMDb rating
        if (json.TryGetProperty("imdbRating", out var ir))
        {
            var irStr = ir.GetString();
            if (double.TryParse(irStr, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var imdbRating) && imdbRating > 0)
                result.ImdbRating = imdbRating;
        }

        // IMDb votes
        if (json.TryGetProperty("imdbVotes", out var iv))
        {
            var ivStr = iv.GetString()?.Replace(",", "");
            if (long.TryParse(ivStr, out var votes))
                result.ImdbVotes = votes;
        }

        // Rotten Tomatoes from Ratings array
        if (json.TryGetProperty("Ratings", out var ratings) && ratings.ValueKind == JsonValueKind.Array)
        {
            foreach (var rating in ratings.EnumerateArray())
            {
                var source = rating.TryGetProperty("Source", out var s) ? s.GetString() : null;
                var value = rating.TryGetProperty("Value", out var v) ? v.GetString() : null;

                if (source == "Rotten Tomatoes" && value != null)
                {
                    var pctStr = value.Replace("%", "");
                    if (int.TryParse(pctStr, out var pct))
                        result.RottenTomatoesScore = pct;
                }
            }
        }

        return result;
    }
}

public class OmdbRatings
{
    public string ImdbId { get; set; } = "";
    public double? ImdbRating { get; set; }
    public long? ImdbVotes { get; set; }
    public int? Metascore { get; set; }
    public int? RottenTomatoesScore { get; set; }
}
