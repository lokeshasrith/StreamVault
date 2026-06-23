using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace StreamVault.Api.Services;

/// <summary>
/// Client for enriching person profiles using free APIs:
/// - Wikipedia API (free, no key) for bio data, height, awards, trivia
/// - TMDB person endpoint (already have key) for additional data
/// Replaces previous RapidAPI real-time-web-search.p.rapidapi.com approach.
/// </summary>
public sealed class WebSearchClient
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<WebSearchClient> _logger;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public WebSearchClient(
        IHttpClientFactory factory,
        IMemoryCache cache,
        ILogger<WebSearchClient> logger)
    {
        _http = factory.CreateClient("websearch");
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Search using Wikipedia API (free, no key required).
    /// Returns a list of search result snippets.
    /// </summary>
    public async Task<List<WebSearchResult>> SearchAsync(string query, int limit = 10, CancellationToken ct = default)
    {
        var cacheKey = $"websearch:{query}:{limit}";
        if (_cache.TryGetValue(cacheKey, out List<WebSearchResult>? cached) && cached != null)
            return cached;

        try
        {
            // Use Wikipedia's search API for general web info
            var url = $"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={Uri.EscapeDataString(query)}&srlimit={limit}&format=json&origin=*";
            var json = await _http.GetFromJsonAsync<JsonElement>(url, ct);

            var results = new List<WebSearchResult>();

            if (json.TryGetProperty("query", out var queryObj) &&
                queryObj.TryGetProperty("search", out var searchArr) &&
                searchArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in searchArr.EnumerateArray())
                {
                    var title = item.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                    var snippet = item.TryGetProperty("snippet", out var s) ? s.GetString() ?? "" : "";
                    // Strip HTML from Wikipedia snippets
                    snippet = System.Text.RegularExpressions.Regex.Replace(snippet, @"<[^>]+>", "");

                    results.Add(new WebSearchResult
                    {
                        Title = title,
                        Url = $"https://en.wikipedia.org/wiki/{Uri.EscapeDataString(title.Replace(' ', '_'))}",
                        Snippet = snippet,
                    });
                }
            }

            _cache.Set(cacheKey, results, CacheDuration);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WebSearch failed for query={Query}", query);
            return [];
        }
    }

    /// <summary>
    /// Get enriched person info from Wikipedia (free, no key).
    /// </summary>
    public async Task<PersonWebInfo> GetPersonWebInfoAsync(string personName, CancellationToken ct = default)
    {
        var cacheKey = $"websearch:person:{personName}";
        if (_cache.TryGetValue(cacheKey, out PersonWebInfo? cached) && cached != null)
            return cached;

        var info = new PersonWebInfo();

        try
        {
            // Get Wikipedia extract for the person
            var wikiExtract = await GetWikipediaExtractAsync(personName, ct);

            if (!string.IsNullOrEmpty(wikiExtract))
            {
                info.Height = ExtractHeightFromText(wikiExtract);
                info.Awards = ExtractAwardsFromText(wikiExtract);
                info.Trivia = ExtractTriviaFromText(wikiExtract, personName);
            }

            // If no height from extract, try the infobox approach
            if (string.IsNullOrEmpty(info.Height))
            {
                var infoboxHeight = await GetWikipediaInfoboxHeightAsync(personName, ct);
                if (!string.IsNullOrEmpty(infoboxHeight))
                    info.Height = infoboxHeight;
            }

            _cache.Set(cacheKey, info, CacheDuration);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get web info for {Person}", personName);
        }

        return info;
    }

    private async Task<string?> GetWikipediaExtractAsync(string personName, CancellationToken ct)
    {
        try
        {
            var url = $"https://en.wikipedia.org/w/api.php?action=query&titles={Uri.EscapeDataString(personName)}&prop=extracts&exintro=false&explaintext=true&exsectionformat=plain&format=json&origin=*";
            var json = await _http.GetFromJsonAsync<JsonElement>(url, ct);

            if (json.TryGetProperty("query", out var query) &&
                query.TryGetProperty("pages", out var pages))
            {
                foreach (var page in pages.EnumerateObject())
                {
                    if (page.Value.TryGetProperty("extract", out var extract))
                        return extract.GetString();
                }
            }
        }
        catch { /* ignore */ }
        return null;
    }

    private async Task<string?> GetWikipediaInfoboxHeightAsync(string personName, CancellationToken ct)
    {
        try
        {
            // Get raw wikitext to parse infobox height
            var url = $"https://en.wikipedia.org/w/api.php?action=parse&page={Uri.EscapeDataString(personName)}&prop=wikitext&section=0&format=json&origin=*";
            var json = await _http.GetFromJsonAsync<JsonElement>(url, ct);

            if (json.TryGetProperty("parse", out var parse) &&
                parse.TryGetProperty("wikitext", out var wikitext) &&
                wikitext.TryGetProperty("*", out var text))
            {
                var content = text.GetString() ?? "";
                // Match | height = {{convert|180|cm|...}} or | height = 5 ft 11 in or | height = 1.80 m
                var heightMatch = System.Text.RegularExpressions.Regex.Match(
                    content, @"\|\s*height\s*=\s*(.+?)(?:\n|\|)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (heightMatch.Success)
                {
                    var raw = heightMatch.Groups[1].Value.Trim();
                    // Parse {{convert|180|cm}} pattern
                    var convertMatch = System.Text.RegularExpressions.Regex.Match(raw, @"\{\{convert\|(\d+)\|cm");
                    if (convertMatch.Success)
                        return $"{convertMatch.Groups[1].Value} cm";

                    var ftMatch = System.Text.RegularExpressions.Regex.Match(raw, @"(\d)\s*(?:ft|')\s*(\d{1,2})");
                    if (ftMatch.Success)
                        return $"{ftMatch.Groups[1].Value}′{ftMatch.Groups[2].Value}″";

                    // Just return cleaned raw
                    raw = System.Text.RegularExpressions.Regex.Replace(raw, @"\{\{.*?\}\}", "").Trim();
                    if (raw.Length > 0 && raw.Length < 20)
                        return raw;
                }
            }
        }
        catch { /* ignore */ }
        return null;
    }

    private static string? ExtractHeightFromText(string text)
    {
        // Match patterns like "5'11"", "5 ft 11 in", "180 cm", "1.80 m"
        var ftInRegex = System.Text.RegularExpressions.Regex.Match(
            text, @"(\d)\s*[''′]\s*(\d{1,2})\s*[""″'']*");
        if (ftInRegex.Success)
            return $"{ftInRegex.Groups[1].Value}′{ftInRegex.Groups[2].Value}″";

        var ftWordRegex = System.Text.RegularExpressions.Regex.Match(
            text, @"(\d)\s*(?:ft|feet)\s*(\d{1,2})\s*(?:in|inch)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (ftWordRegex.Success)
            return $"{ftWordRegex.Groups[1].Value}′{ftWordRegex.Groups[2].Value}″";

        var cmRegex = System.Text.RegularExpressions.Regex.Match(
            text, @"(\d{2,3})\s*cm", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (cmRegex.Success)
        {
            var cm = int.Parse(cmRegex.Groups[1].Value);
            if (cm >= 140 && cm <= 220) return $"{cm} cm";
        }

        var mRegex = System.Text.RegularExpressions.Regex.Match(
            text, @"(1\.\d{2}|2\.\d{2})\s*m\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (mRegex.Success)
            return $"{mRegex.Groups[1].Value} m";

        return null;
    }

    private static List<string> ExtractAwardsFromText(string text)
    {
        var awards = new List<string>();
        var keywords = new[] { "Oscar", "Academy Award", "Golden Globe", "Emmy", "BAFTA", "SAG", "Cannes",
            "Tony", "Grammy", "Filmfare", "National Film Award", "Palme d'Or", "IIFA", "Screen Award" };

        var sentences = text.Split(new[] { '.', '!', ';' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var keyword in keywords)
        {
            var match = sentences.FirstOrDefault(s =>
                s.Contains(keyword, StringComparison.OrdinalIgnoreCase) &&
                !awards.Any(a => a.Contains(keyword, StringComparison.OrdinalIgnoreCase)));
            if (match != null)
            {
                var trimmed = match.Trim();
                if (trimmed.Length >= 20 && trimmed.Length <= 200)
                    awards.Add(trimmed);
            }
        }
        return awards.Take(5).ToList();
    }

    private static List<string> ExtractTriviaFromText(string text, string personName)
    {
        var sentences = text.Split('.', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => s.Length >= 30 && s.Length <= 300)
            .Where(s => !s.StartsWith("==") && !s.Contains("citation needed"))
            .Take(5)
            .ToList();

        return sentences.Take(3).ToList();
    }
}

// ─── Web Search Models ──────────────────────────────────────────────────────

public class WebSearchResult
{
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string Snippet { get; set; } = "";
}

public class PersonWebInfo
{
    public string? Height { get; set; }
    public List<string> Awards { get; set; } = [];
    public List<string> Trivia { get; set; } = [];
    public List<PersonNewsItem> LatestNews { get; set; } = [];
}

public class PersonNewsItem
{
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string Snippet { get; set; } = "";
}
