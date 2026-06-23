namespace StreamVault.Api.Models;

public enum ContentType { movie, tv, anime }

public sealed class Content
{
    public Guid ContentId { get; set; } = Guid.NewGuid();
    public string ExternalId { get; set; } = default!;   // TMDB/MAL/local key
    public string Source { get; set; } = default!;       // e.g., TMDB_MOVIE | TMDB_TV | MAL_ANIME | LOCAL_DEMO
    public ContentType Type { get; set; }
    public string Title { get; set; } = default!;
    public int? Year { get; set; }
    public int? Episodes { get; set; }
    public int? Seasons { get; set; }
    public string? PosterUrl { get; set; }
    public string? BackdropUrl { get; set; }
    public decimal? Rating { get; set; }
    public string? Synopsis { get; set; }
    public long? BudgetUSD { get; set; }
    public long? RevenueUSD { get; set; }
    public string? GenresCsv { get; set; }
    public string? ZonesCsv { get; set; }
    public DateTime LastRefreshedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserContentStatus> UserStatuses { get; set; } = new List<UserContentStatus>();
}