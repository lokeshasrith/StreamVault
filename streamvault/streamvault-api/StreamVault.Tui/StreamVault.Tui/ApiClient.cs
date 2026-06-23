using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace StreamVault.Tui;

public sealed class ApiClient
{
    private readonly HttpClient _http;
    private string? _token;

    public ApiClient(string baseUrl = "http://localhost:7166")
    {
        _http = new HttpClient { BaseAddress = new Uri(baseUrl) };
    }

    public bool IsAuthenticated => !string.IsNullOrEmpty(_token);

    public async Task<(bool Success, string? Error)> LoginAsync(string email, string password)
    {
        var response = await _http.PostAsJsonAsync("api/auth/login", new { email, password });
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadFromJsonAsync<ErrorResponse>();
            return (false, err?.Error ?? "Login failed");
        }

        var result = await response.Content.ReadFromJsonAsync<LoginResponse>();
        _token = result?.Token;
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> RegisterAsync(string email, string password, string? displayName)
    {
        var response = await _http.PostAsJsonAsync("api/auth/register", new { email, password, displayName });
        if (!response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            return (false, content);
        }
        return (true, null);
    }

    public async Task<List<LibraryItem>> GetLibraryAsync(string? status = null, string? type = null)
    {
        var url = "api/library";
        var queryParts = new List<string>();
        if (!string.IsNullOrEmpty(status)) queryParts.Add($"status={status}");
        if (!string.IsNullOrEmpty(type)) queryParts.Add($"type={type}");
        if (queryParts.Count > 0) url += "?" + string.Join("&", queryParts);

        var response = await _http.GetAsync(url);
        if (!response.IsSuccessStatusCode) return new List<LibraryItem>();

        return await response.Content.ReadFromJsonAsync<List<LibraryItem>>() ?? new List<LibraryItem>();
    }

    public async Task<SearchResult> SearchAsync(string query, string? type = null, int page = 1)
    {
        var url = $"api/discover/search?query={Uri.EscapeDataString(query)}&page={page}";
        if (!string.IsNullOrEmpty(type)) url += $"&type={type}";

        var response = await _http.GetAsync(url);
        if (!response.IsSuccessStatusCode) return new SearchResult();

        return await response.Content.ReadFromJsonAsync<SearchResult>() ?? new SearchResult();
    }

    public async Task<(bool Success, string? Error)> UpsertLibraryAsync(UpsertRequest request)
    {
        var response = await _http.PostAsJsonAsync("api/library", request);
        if (!response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            return (false, content);
        }
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> RemoveFromLibraryAsync(string contentId)
    {
        var response = await _http.DeleteAsync($"api/library/{contentId}");
        if (!response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            return (false, content);
        }
        return (true, null);
    }
}

// --- Response/Request Models ---

public sealed class LoginResponse
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = "";
}

public sealed class ErrorResponse
{
    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public sealed class LibraryItem
{
    [JsonPropertyName("contentId")]
    public string ContentId { get; set; } = "";

    [JsonPropertyName("externalId")]
    public string ExternalId { get; set; } = "";

    [JsonPropertyName("source")]
    public string Source { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("year")]
    public int? Year { get; set; }

    [JsonPropertyName("episodes")]
    public int? Episodes { get; set; }

    [JsonPropertyName("seasons")]
    public int? Seasons { get; set; }

    [JsonPropertyName("rating")]
    public decimal? Rating { get; set; }

    [JsonPropertyName("synopsis")]
    public string? Synopsis { get; set; }

    [JsonPropertyName("genresCsv")]
    public string? GenresCsv { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("currentEpisode")]
    public int? CurrentEpisode { get; set; }

    [JsonPropertyName("userRating")]
    public decimal? UserRating { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}

public sealed class SearchResult
{
    [JsonPropertyName("items")]
    public List<SearchItem> Items { get; set; } = new();

    [JsonPropertyName("totalCount")]
    public int TotalCount { get; set; }

    [JsonPropertyName("hasMore")]
    public bool HasMore { get; set; }
}

public sealed class SearchItem
{
    [JsonPropertyName("externalId")]
    public string ExternalId { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("overview")]
    public string Overview { get; set; } = "";

    [JsonPropertyName("releaseDate")]
    public string ReleaseDate { get; set; } = "";

    [JsonPropertyName("voteAverage")]
    public double VoteAverage { get; set; }

    [JsonPropertyName("genres")]
    public string[] Genres { get; set; } = Array.Empty<string>();

    [JsonPropertyName("source")]
    public string Source { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("year")]
    public int? Year { get; set; }

    [JsonPropertyName("episodes")]
    public int? Episodes { get; set; }

    [JsonPropertyName("seasons")]
    public int? Seasons { get; set; }
}

public sealed class UpsertRequest
{
    [JsonPropertyName("externalId")]
    public string ExternalId { get; set; } = "";

    [JsonPropertyName("source")]
    public string Source { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("year")]
    public int? Year { get; set; }

    [JsonPropertyName("episodes")]
    public int? Episodes { get; set; }

    [JsonPropertyName("seasons")]
    public int? Seasons { get; set; }

    [JsonPropertyName("rating")]
    public decimal? Rating { get; set; }

    [JsonPropertyName("synopsis")]
    public string? Synopsis { get; set; }

    [JsonPropertyName("genresCsv")]
    public string? GenresCsv { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "watchlist";

    [JsonPropertyName("currentEpisode")]
    public int? CurrentEpisode { get; set; }

    [JsonPropertyName("userRating")]
    public decimal? UserRating { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}
