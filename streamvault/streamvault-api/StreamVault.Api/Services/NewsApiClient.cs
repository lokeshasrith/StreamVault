using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Microsoft.Extensions.Caching.Memory;

namespace StreamVault.Api.Services;

/// <summary>
/// Aggregates entertainment news from public, keyless RSS feeds.
/// Replaces RapidAPI/web-search usage for /api/discover/news.
/// </summary>
public sealed class NewsApiClient
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<NewsApiClient> _logger;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(20);

    private sealed record FeedSource(string Url, string Source, string Category);

    private enum NewsMixGroup
    {
        India,
        Hollywood,
        OtherCountries,
        Anime
    }

    private static readonly FeedSource[] FeedSources =
    [
        new("https://variety.com/feed/", "Variety", "Entertainment"),
        new("https://deadline.com/feed/", "Deadline", "Entertainment"),
        new("https://www.hollywoodreporter.com/feed/", "The Hollywood Reporter", "Entertainment"),
        new("https://www.animenewsnetwork.com/all/rss.xml", "Anime News Network", "Anime"),
        new("https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml", "Hindustan Times", "India"),
        new("https://www.bollywoodhungama.com/feed/", "Bollywood Hungama", "India"),
        new("https://indianexpress.com/section/entertainment/feed/", "The Indian Express", "India")
    ];

    private static readonly HashSet<string> TrustedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "variety.com",
        "deadline.com",
        "hollywoodreporter.com",
        "animenewsnetwork.com",
        "hindustantimes.com",
        "bollywoodhungama.com",
        "indianexpress.com"
    };

    public NewsApiClient(
        IHttpClientFactory factory,
        IMemoryCache cache,
        ILogger<NewsApiClient> logger)
    {
        _http = factory.CreateClient("news");
        _cache = cache;
        _logger = logger;
    }

    public sealed class NewsItem
    {
        public string? Title { get; set; }
        public string? Url { get; set; }
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public string? Source { get; set; }
        public string? PublishedAt { get; set; }
        public string? Category { get; set; }
    }

    public async Task<List<NewsItem>> GetEntertainmentNewsAsync(CancellationToken ct = default)
    {
        const string cacheKey = "entertainment_news_api_v2";
        if (_cache.TryGetValue(cacheKey, out List<NewsItem>? cached) && cached != null)
            return cached;

        var tasks = FeedSources.Select(source => FetchFeedAsync(source, ct));
        var batches = await Task.WhenAll(tasks);

        var merged = batches
            .SelectMany(x => x)
            .Where(n => !string.IsNullOrWhiteSpace(n.Title) && !string.IsNullOrWhiteSpace(n.Url))
            .Where(IsTrustedEntertainmentItem)
            .GroupBy(n => NormalizeUrl(n.Url!))
            .Select(g => g.OrderByDescending(x => ParsePublishedAt(x.PublishedAt)).First())
            .ToList();

        merged = BuildBalancedMix(merged, limit: 30)
            .ToList();

        if (merged.Count == 0)
            merged = GetLocalEntertainmentNews();

        _cache.Set(cacheKey, merged, CacheDuration);
        return merged;
    }

    private async Task<List<NewsItem>> FetchFeedAsync(FeedSource source, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, source.Url);
            request.Headers.UserAgent.ParseAdd("StreamVault-NewsBot/1.0");
            request.Headers.Accept.ParseAdd("application/rss+xml, application/xml;q=0.9, text/xml;q=0.8");

            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("News feed {Source} returned {StatusCode}", source.Source, response.StatusCode);
                return [];
            }

            var xml = await response.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(xml))
                return [];

            var doc = XDocument.Parse(xml, LoadOptions.None);
            var rssItems = ParseRssItems(doc, source);
            if (rssItems.Count > 0)
                return rssItems;

            return ParseAtomEntries(doc, source);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch news feed {Source}", source.Source);
            return [];
        }
    }

    private static List<NewsItem> ParseRssItems(XDocument doc, FeedSource source)
    {
        var mediaNs = XNamespace.Get("http://search.yahoo.com/mrss/");
        var contentNs = XNamespace.Get("http://purl.org/rss/1.0/modules/content/");
        var list = new List<NewsItem>();

        foreach (var item in doc.Descendants("item"))
        {
            var title = NormalizeWhitespace(WebUtility.HtmlDecode(item.Element("title")?.Value ?? string.Empty));
            var link = NormalizeLink(item.Element("link")?.Value ?? item.Element("guid")?.Value);
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(link))
                continue;

            var descriptionHtml = item.Element("description")?.Value
                ?? item.Element(contentNs + "encoded")?.Value
                ?? string.Empty;

            var snippet = BuildSnippet(descriptionHtml);
            var category = InferCategory($"{title} {snippet}", source.Category);
            var imageUrl = ExtractImageUrl(item, mediaNs, descriptionHtml);

            list.Add(new NewsItem
            {
                Title = title,
                Url = link,
                Description = snippet,
                Source = source.Source,
                PublishedAt = NormalizePublishedAt(item.Element("pubDate")?.Value),
                Category = category,
                ImageUrl = imageUrl
            });
        }

        return list;
    }

    private static List<NewsItem> ParseAtomEntries(XDocument doc, FeedSource source)
    {
        var atomNs = XNamespace.Get("http://www.w3.org/2005/Atom");
        var entries = doc.Descendants(atomNs + "entry");
        var list = new List<NewsItem>();

        foreach (var entry in entries)
        {
            var title = NormalizeWhitespace(WebUtility.HtmlDecode(entry.Element(atomNs + "title")?.Value ?? string.Empty));
            var link = NormalizeLink(entry.Elements(atomNs + "link")
                .Select(x => x.Attribute("href")?.Value)
                .FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)));
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(link))
                continue;

            var summary = entry.Element(atomNs + "summary")?.Value
                ?? entry.Element(atomNs + "content")?.Value
                ?? string.Empty;

            var snippet = BuildSnippet(summary);
            var category = InferCategory($"{title} {snippet}", source.Category);

            list.Add(new NewsItem
            {
                Title = title,
                Url = link,
                Description = snippet,
                Source = source.Source,
                PublishedAt = NormalizePublishedAt(entry.Element(atomNs + "updated")?.Value ?? entry.Element(atomNs + "published")?.Value),
                Category = category,
                ImageUrl = null
            });
        }

        return list;
    }

    private static string? ExtractImageUrl(XElement item, XNamespace mediaNs, string descriptionHtml)
    {
        var mediaContent = item.Elements(mediaNs + "content")
            .Select(e => e.Attribute("url")?.Value)
            .FirstOrDefault(IsImageLink);
        if (!string.IsNullOrWhiteSpace(mediaContent))
            return NormalizeLink(mediaContent);

        var mediaThumb = item.Elements(mediaNs + "thumbnail")
            .Select(e => e.Attribute("url")?.Value)
            .FirstOrDefault(IsImageLink);
        if (!string.IsNullOrWhiteSpace(mediaThumb))
            return NormalizeLink(mediaThumb);

        var imgMatch = Regex.Match(descriptionHtml ?? string.Empty, "<img[^>]+src=[\"'](?<url>[^\"']+)[\"']", RegexOptions.IgnoreCase);
        if (imgMatch.Success)
        {
            var url = imgMatch.Groups["url"].Value;
            if (IsImageLink(url))
                return NormalizeLink(url);
        }

        return null;
    }

    private static bool IsImageLink(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return false;

        return url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("//", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeLink(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return string.Empty;

        var value = WebUtility.HtmlDecode(raw.Trim());
        if (value.StartsWith("//", StringComparison.Ordinal))
            value = "https:" + value;

        return Uri.TryCreate(value, UriKind.Absolute, out var uri)
            ? uri.ToString()
            : string.Empty;
    }

    private static string NormalizeUrl(string rawUrl)
    {
        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uri))
            return rawUrl.Trim();

        return uri.GetLeftPart(UriPartial.Path).TrimEnd('/').ToLowerInvariant();
    }

    private static bool IsTrustedEntertainmentItem(NewsItem item)
    {
        if (string.IsNullOrWhiteSpace(item.Url))
            return false;

        if (!Uri.TryCreate(item.Url, UriKind.Absolute, out var uri))
            return false;

        var host = uri.Host;
        var isTrusted = TrustedHosts.Contains(host) || TrustedHosts.Any(h => host.EndsWith($".{h}", StringComparison.OrdinalIgnoreCase));
        if (!isTrusted)
            return false;

        var source = item.Source ?? string.Empty;
        var category = item.Category ?? string.Empty;
        if (category.Contains("Anime", StringComparison.OrdinalIgnoreCase)
            || source.Contains("Anime News Network", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var text = $"{item.Title} {item.Description}".ToLowerInvariant();
        return text.Contains("movie")
            || text.Contains("film")
            || text.Contains("tv")
            || text.Contains("series")
            || text.Contains("show")
            || text.Contains("stream")
            || text.Contains("anime")
            || text.Contains("box office")
            || text.Contains("trailer")
            || text.Contains("review")
            || text.Contains("hollywood")
            || text.Contains("bollywood")
            || text.Contains("india")
            || text.Contains("indian")
            || text.Contains("hindi")
            || text.Contains("south indian")
            || text.Contains("tollywood")
            || text.Contains("kollywood")
            || text.Contains("mollywood")
            || text.Contains("punjabi")
            || text.Contains("mumbai")
            || text.Contains("delhi");
    }

    private static List<NewsItem> BuildBalancedMix(List<NewsItem> items, int limit)
    {
        var sorted = items
            .OrderByDescending(x => ParsePublishedAt(x.PublishedAt))
            .ToList();

        var grouped = sorted
            .GroupBy(GetMixGroup)
            .ToDictionary(g => g.Key, g => new Queue<NewsItem>(g));

        var targetPerGroup = new Dictionary<NewsMixGroup, int>
        {
            [NewsMixGroup.India] = 6,
            [NewsMixGroup.Hollywood] = 8,
            [NewsMixGroup.OtherCountries] = 6,
            [NewsMixGroup.Anime] = 6,
        };

        var orderedGroups = new[]
        {
            NewsMixGroup.India,
            NewsMixGroup.Hollywood,
            NewsMixGroup.OtherCountries,
            NewsMixGroup.Anime,
        };

        var selected = new List<NewsItem>(limit);
        var selectedUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var group in orderedGroups)
        {
            if (!grouped.TryGetValue(group, out var queue))
                continue;

            var target = targetPerGroup[group];
            while (target > 0 && queue.Count > 0 && selected.Count < limit)
            {
                var item = queue.Dequeue();
                if (item.Url is null || !selectedUrls.Add(item.Url))
                    continue;

                selected.Add(item);
                target--;
            }
        }

        foreach (var item in sorted)
        {
            if (selected.Count >= limit)
                break;

            if (item.Url is null || !selectedUrls.Add(item.Url))
                continue;

            selected.Add(item);
        }

        return selected
            .OrderByDescending(x => ParsePublishedAt(x.PublishedAt))
            .Take(limit)
            .ToList();
    }

    private static NewsMixGroup GetMixGroup(NewsItem item)
    {
        var text = $"{item.Title} {item.Description}".ToLowerInvariant();
        var source = (item.Source ?? string.Empty).ToLowerInvariant();
        var category = (item.Category ?? string.Empty).ToLowerInvariant();

        if (category.Contains("anime") || source.Contains("anime news network") || text.Contains("anime") || text.Contains("manga"))
            return NewsMixGroup.Anime;

        if (source.Contains("hindustan times")
            || source.Contains("bollywood hungama")
            || source.Contains("indian express")
            || category.Contains("india")
            || text.Contains("india")
            || text.Contains("indian")
            || text.Contains("bollywood")
            || text.Contains("tollywood")
            || text.Contains("kollywood")
            || text.Contains("mollywood")
            || text.Contains("hindi"))
        {
            return NewsMixGroup.India;
        }

        if (HasOtherCountriesSignal(text))
            return NewsMixGroup.OtherCountries;

        return NewsMixGroup.Hollywood;
    }

    private static bool HasOtherCountriesSignal(string text)
    {
        return text.Contains("korea")
            || text.Contains("korean")
            || text.Contains("japan")
            || text.Contains("japanese")
            || text.Contains("france")
            || text.Contains("french")
            || text.Contains("germany")
            || text.Contains("german")
            || text.Contains("italy")
            || text.Contains("italian")
            || text.Contains("spain")
            || text.Contains("spanish")
            || text.Contains("mexico")
            || text.Contains("brazil")
            || text.Contains("turkey")
            || text.Contains("thailand")
            || text.Contains("indonesia")
            || text.Contains("australia")
            || text.Contains("uk")
            || text.Contains("british")
            || text.Contains("canada")
            || text.Contains("canadian");
    }

    private static string BuildSnippet(string html)
    {
        var decoded = WebUtility.HtmlDecode(html ?? string.Empty);
        var plain = Regex.Replace(decoded, "<[^>]+>", " ");
        plain = NormalizeWhitespace(plain);

        if (plain.Length > 220)
            return plain[..217] + "...";

        return plain;
    }

    private static string NormalizeWhitespace(string value)
    {
        return Regex.Replace(value ?? string.Empty, "\\s+", " ").Trim();
    }

    private static string NormalizePublishedAt(string? raw)
    {
        var parsed = ParsePublishedAt(raw);
        return parsed == DateTimeOffset.MinValue
            ? DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
            : parsed.ToString("O", CultureInfo.InvariantCulture);
    }

    private static DateTimeOffset ParsePublishedAt(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return DateTimeOffset.MinValue;

        return DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto)
            ? dto.ToUniversalTime()
            : DateTimeOffset.MinValue;
    }

    private static string InferCategory(string text, string defaultCategory)
    {
        var value = text.ToLowerInvariant();

        if (value.Contains("anime") || value.Contains("manga")) return "Anime";
        if (value.Contains("india") || value.Contains("indian") || value.Contains("bollywood") || value.Contains("hindi") || value.Contains("tollywood") || value.Contains("kollywood") || value.Contains("mollywood")) return "India";
        if (value.Contains("box office")) return "Box Office";
        if (value.Contains("netflix") || value.Contains("disney") || value.Contains("prime video") || value.Contains("streaming")) return "Streaming";
        if (value.Contains("tv") || value.Contains("series") || value.Contains("episode")) return "TV Shows";
        if (value.Contains("trailer") || value.Contains("teaser")) return "Trailers";
        if (value.Contains("review") || value.Contains("rating")) return "Reviews";
        if (value.Contains("movie") || value.Contains("film") || value.Contains("cinema")) return "Movies";

        return defaultCategory;
    }

    private static List<NewsItem> GetLocalEntertainmentNews()
    {
        var now = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
        return
        [
            new() { Title = "Variety Entertainment", Url = "https://variety.com/", Description = "Latest headlines from Variety.", Source = "Variety", Category = "Entertainment", PublishedAt = now },
            new() { Title = "Deadline Hollywood", Url = "https://deadline.com/", Description = "Latest film and TV industry headlines.", Source = "Deadline", Category = "Entertainment", PublishedAt = now },
            new() { Title = "The Hollywood Reporter", Url = "https://www.hollywoodreporter.com/", Description = "Breaking entertainment and media news.", Source = "The Hollywood Reporter", Category = "Entertainment", PublishedAt = now },
            new() { Title = "Anime News Network", Url = "https://www.animenewsnetwork.com/", Description = "Latest anime and manga updates.", Source = "Anime News Network", Category = "Anime", PublishedAt = now },
            new() { Title = "Hindustan Times Entertainment", Url = "https://www.hindustantimes.com/entertainment", Description = "Latest Indian entertainment headlines.", Source = "Hindustan Times", Category = "India", PublishedAt = now },
            new() { Title = "Bollywood Hungama", Url = "https://www.bollywoodhungama.com/", Description = "Indian entertainment, celebrity, and film coverage.", Source = "Bollywood Hungama", Category = "India", PublishedAt = now },
            new() { Title = "The Indian Express Entertainment", Url = "https://indianexpress.com/section/entertainment/", Description = "Indian film, TV, and culture coverage.", Source = "The Indian Express", Category = "India", PublishedAt = now }
        ];
    }
}
