namespace StreamVault.Api.Models;

public enum WatchStatus { watchlist, watching, completed, dropped, on_hold, liked }

public sealed class UserContentStatus
{
    public Guid UserId { get; set; }      // <-- from Identity user (per-user isolation)
    public Guid ContentId { get; set; }

    public WatchStatus Status { get; set; }
    public int? CurrentEpisode { get; set; }
    public int? DroppedAtEpisode { get; set; }
    public decimal? UserRating { get; set; }
    public string? Notes { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Content Content { get; set; } = default!;
}