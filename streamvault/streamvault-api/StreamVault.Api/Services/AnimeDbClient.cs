using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace StreamVault.Api.Services;

/// <summary>
/// Client for anime data using the free Jikan API (api.jikan.moe/v4).
/// Replaces previous RapidAPI anime-db.p.rapidapi.com approach.
/// No API key needed. Rate-limited to ~3 req/s.
/// </summary>
public sealed class AnimeDbClient
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AnimeDbClient> _logger;
    private const string BaseUrl = "https://api.jikan.moe/v4";

    public AnimeDbClient(
        IHttpClientFactory factory,
        IMemoryCache cache,
        ILogger<AnimeDbClient> logger)
    {
        _http = factory.CreateClient("animedb");
        _cache = cache;
        _logger = logger;
    }

    public async Task<object?> SearchAsync(string query, int page = 1, int size = 10,
        string? genres = null, string sortBy = "ranking", string sortOrder = "asc",
        CancellationToken ct = default)
    {
        var cacheKey = $"animedb:search:{query}:{page}:{genres}";
        if (_cache.TryGetValue(cacheKey, out object? cached)) return cached;

        try
        {
            var url = $"{BaseUrl}/anime?page={page}&limit={size}&q={Uri.EscapeDataString(query)}&order_by=score&sort=desc";
            if (!string.IsNullOrEmpty(genres))
                url += $"&genres={Uri.EscapeDataString(genres)}";

            var payload = await _http.GetFromJsonAsync<object>(url, ct);
            _cache.Set(cacheKey, payload, TimeSpan.FromMinutes(10));
            return payload;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AnimeDB SearchAsync failed");
            return null;
        }
    }

    public async Task<object?> GetByIdAsync(string animeId, CancellationToken ct = default)
    {
        var cacheKey = $"animedb:id:{animeId}";
        if (_cache.TryGetValue(cacheKey, out object? cached)) return cached;

        try
        {
            var url = $"{BaseUrl}/anime/{Uri.EscapeDataString(animeId)}/full";
            var payload = await _http.GetFromJsonAsync<object>(url, ct);
            _cache.Set(cacheKey, payload, TimeSpan.FromMinutes(30));
            return payload;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AnimeDB GetByIdAsync failed");
            return null;
        }
    }

    /// <summary>Get top-ranked anime from Jikan sorted by score.</summary>
    public async Task<object?> GetTopRankedAsync(int page = 1, int size = 20,
        string? genres = null, string? type = null, CancellationToken ct = default)
    {
        var cacheKey = $"animedb:top:{page}:{size}:{genres}:{type}";
        if (_cache.TryGetValue(cacheKey, out object? cached)) return cached;

        try
        {
            var url = $"{BaseUrl}/top/anime?page={page}&limit={size}";
            if (!string.IsNullOrEmpty(type))
                url += $"&type={Uri.EscapeDataString(type.ToLower())}";
            if (!string.IsNullOrEmpty(genres))
                url += $"&filter=bypopularity";

            var payload = await _http.GetFromJsonAsync<object>(url, ct);
            _cache.Set(cacheKey, payload, TimeSpan.FromHours(1));
            return payload;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AnimeDB GetTopRankedAsync failed");
            return null;
        }
    }
}
