using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using StreamVault.Api.Config;

namespace StreamVault.Api.Services;

/// <summary>
/// Client for YouTube trailer lookup.
/// Strategy: TMDB videos (free, no quota) → YouTube Data API v3 (free 10K/day) → Invidious (free, no key).
/// Replaces previous RapidAPI yt-api.p.rapidapi.com approach.
/// </summary>
public sealed class YouTubeClient
{
    private readonly HttpClient _http;
    private readonly TmdbOptions _tmdbOpt;
    private readonly IMemoryCache _cache;
    private readonly ILogger<YouTubeClient> _logger;
    private readonly string? _youtubeApiKey;

    public YouTubeClient(
        IHttpClientFactory factory,
        IOptions<TmdbOptions> tmdbOpt,
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<YouTubeClient> logger)
    {
        _http = factory.CreateClient("youtube");
        _tmdbOpt = tmdbOpt.Value;
        _cache = cache;
        _logger = logger;
        _youtubeApiKey = configuration["YouTube:ApiKey"];
    }

    /// <summary>
    /// Search YouTube for a trailer and return the first video ID, or null.
    /// </summary>
    public async Task<string?> FindTrailerAsync(string title, string contentType, CancellationToken ct = default)
    {
        var cacheKey = $"yt:trailer:{title}:{contentType}";
        if (_cache.TryGetValue(cacheKey, out string? cached)) return cached;

        // Strategy 1: Use TMDB videos endpoint (no extra quota cost)
        var tmdbTrailer = await FindTrailerViaTmdbAsync(title, contentType, ct);
        if (!string.IsNullOrEmpty(tmdbTrailer))
        {
            _cache.Set(cacheKey, tmdbTrailer, TimeSpan.FromHours(12));
            return tmdbTrailer;
        }

        // Strategy 2: YouTube Data API v3 (free tier, 10K units/day)
        if (!string.IsNullOrEmpty(_youtubeApiKey))
        {
            var ytResult = await SearchYouTubeV3Async(title, contentType, ct);
            if (!string.IsNullOrEmpty(ytResult))
            {
                _cache.Set(cacheKey, ytResult, TimeSpan.FromHours(12));
                return ytResult;
            }
        }

        // Strategy 3: Invidious public API (no key needed)
        var invResult = await SearchInvidiousAsync(title, contentType, ct);
        if (!string.IsNullOrEmpty(invResult))
        {
            _cache.Set(cacheKey, invResult, TimeSpan.FromHours(6));
            return invResult;
        }

        return null;
    }

    private async Task<string?> FindTrailerViaTmdbAsync(string title, string contentType, CancellationToken ct)
    {
        try
        {
            var apiKey = _tmdbOpt.ApiKey;
            var baseUrl = "https://api.themoviedb.org/3";
            var searchType = contentType.Contains("anime") ? "tv" : (contentType.Contains("tv") ? "tv" : "movie");

            var searchUrl = $"{baseUrl}/search/{searchType}?api_key={apiKey}&query={Uri.EscapeDataString(title)}&page=1";
            var searchJson = await _http.GetFromJsonAsync<JsonElement>(searchUrl, ct);

            if (!searchJson.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
                return null;

            var tmdbId = results[0].TryGetProperty("id", out var idProp) ? idProp.GetInt32() : 0;
            if (tmdbId == 0) return null;

            var videosUrl = $"{baseUrl}/{searchType}/{tmdbId}/videos?api_key={apiKey}";
            var videosJson = await _http.GetFromJsonAsync<JsonElement>(videosUrl, ct);

            if (!videosJson.TryGetProperty("results", out var videos) || videos.GetArrayLength() == 0)
                return null;

            string? trailerId = null;
            string? teaserId = null;
            string? anyId = null;

            foreach (var video in videos.EnumerateArray())
            {
                var site = video.TryGetProperty("site", out var s) ? s.GetString() : "";
                if (site != "YouTube") continue;

                var type = video.TryGetProperty("type", out var t) ? t.GetString() : "";
                var key = video.TryGetProperty("key", out var k) ? k.GetString() : null;
                var official = video.TryGetProperty("official", out var o) && o.GetBoolean();

                if (string.IsNullOrEmpty(key)) continue;

                if (type == "Trailer" && official) return key;
                if (type == "Trailer") trailerId ??= key;
                else if (type == "Teaser") teaserId ??= key;
                else anyId ??= key;
            }

            return trailerId ?? teaserId ?? anyId;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "TMDB trailer lookup failed for {Title}", title);
            return null;
        }
    }

    private async Task<string?> SearchYouTubeV3Async(string title, string contentType, CancellationToken ct)
    {
        try
        {
            var query = $"{title} {contentType} official trailer";
            var url = $"https://www.googleapis.com/youtube/v3/search?part=snippet&q={Uri.EscapeDataString(query)}&type=video&maxResults=1&key={_youtubeApiKey}";

            var json = await _http.GetFromJsonAsync<JsonElement>(url, ct);

            if (json.TryGetProperty("items", out var items) && items.GetArrayLength() > 0)
            {
                var first = items[0];
                if (first.TryGetProperty("id", out var id) &&
                    id.TryGetProperty("videoId", out var videoId))
                {
                    return videoId.GetString();
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "YouTube v3 search failed for {Title}", title);
            return null;
        }
    }

    private async Task<string?> SearchInvidiousAsync(string title, string contentType, CancellationToken ct)
    {
        try
        {
            var query = $"{title} {contentType} official trailer";
            var url = $"https://vid.puffyan.us/api/v1/search?q={Uri.EscapeDataString(query)}&type=video";

            var json = await _http.GetFromJsonAsync<JsonElement>(url, ct);

            if (json.ValueKind == JsonValueKind.Array && json.GetArrayLength() > 0)
            {
                var first = json[0];
                if (first.TryGetProperty("videoId", out var videoId))
                    return videoId.GetString();
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Invidious search failed for {Title}", title);
            return null;
        }
    }
}
