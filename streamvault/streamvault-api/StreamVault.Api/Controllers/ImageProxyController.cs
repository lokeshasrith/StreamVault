using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace StreamVault.Api.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/img")]
public sealed class ImageProxyController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ImageProxyController> _logger;
    
    private static readonly HashSet<string> AllowedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "image.tmdb.org",
        "myanimelist.net",
        "cdn.myanimelist.net",
        "cdn.jikan.moe",
        "img.youtube.com",
        "deadline.com",
        "variety.com",
        "hollywoodreporter.com",
        "animenewsnetwork.com",
        "hindustantimes.com",
        "bollywoodhungama.com",
        "indianexpress.com",
    };

    private static bool IsAllowedHost(string host)
    {
        if (AllowedHosts.Contains(host))
            return true;

        // Allow subdomains of trusted hosts (e.g., www.variety.com, images.deadline.com)
        foreach (var allowed in AllowedHosts)
        {
            if (host.EndsWith($".{allowed}", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    // 1x1 transparent PNG placeholder for failed image fetches
    private static readonly byte[] PlaceholderPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRKEFbGVjdA==");

    public ImageProxyController(IHttpClientFactory httpClientFactory, IMemoryCache cache, ILogger<ImageProxyController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>Proxy external images to avoid CORS/network issues in browsers.</summary>
    [HttpGet("proxy")]
    [ResponseCache(Duration = 86400)]
    public async Task<IActionResult> Proxy([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return BadRequest("url parameter is required");

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "https" && uri.Scheme != "http"))
            return BadRequest("Invalid URL");

        if (!IsAllowedHost(uri.Host))
            return BadRequest("Host not allowed");

        var cacheKey = $"imgproxy:{url}";
        if (_cache.TryGetValue(cacheKey, out (byte[] Data, string ContentType) cached))
            return File(cached.Data, cached.ContentType);

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            request.Headers.Referrer = null; // Don't send a referrer
            
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch image from {Url}: {StatusCode}", uri, response.StatusCode);
                return File(PlaceholderPng, "image/png");
            }

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var data = await response.Content.ReadAsByteArrayAsync();

            // Cache for 1 hour, max 2MB images
            if (data.Length < 2 * 1024 * 1024)
                _cache.Set(cacheKey, (data, contentType), TimeSpan.FromHours(1));

            return File(data, contentType);
        }
        catch (Exception ex)
        {
            // Log the error for debugging, but return placeholder to avoid broken images in UI
            _logger.LogError(ex, "Error fetching image from {Url}", uri);
            return File(PlaceholderPng, "image/png");
        }
    }
}
