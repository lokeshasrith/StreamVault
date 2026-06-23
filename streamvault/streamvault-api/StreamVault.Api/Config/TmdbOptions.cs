namespace StreamVault.Api.Config;

public sealed class TmdbOptions
{
    public string ApiKey { get; set; } = default!;
    public string BaseUrl { get; set; } = "https://api.themoviedb.org/3";
    // Support multiple keys for rotation (ApiKeys[0] takes priority; falls back to ApiKey)
    public string[] ApiKeys { get; set; } = Array.Empty<string>();

    /// <summary>Returns the first non-empty key from ApiKeys[], or ApiKey.</summary>
    public string EffectiveKey =>
        ApiKeys.FirstOrDefault(k => !string.IsNullOrWhiteSpace(k)) ?? ApiKey;
}
