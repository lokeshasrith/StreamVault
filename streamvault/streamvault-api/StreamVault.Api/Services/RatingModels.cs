namespace StreamVault.Api.Services;

/// <summary>
/// Shared DTO for IMDb rating values.
/// Kept separate from provider clients so implementations can be swapped.
/// </summary>
public sealed class ImdbRatingResult
{
    public string ImdbId { get; set; } = string.Empty;
    public double Rating { get; set; }
    public long VoteCount { get; set; }
}

/// <summary>
/// Shared DTO for Metacritic metascore values.
/// </summary>
public sealed class MetascoreResult
{
    public string ImdbId { get; set; } = string.Empty;
    public int Metascore { get; set; }
}
