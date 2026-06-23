using System.ComponentModel.DataAnnotations;
using StreamVault.Api.Models;

namespace StreamVault.Api.Dtos;

public sealed class UpsertLibraryDto
{
    [Required, StringLength(100)]
    public string ExternalId { get; set; } = default!;

    [Required, StringLength(50)]
    public string Source { get; set; } = default!;

    [Required, StringLength(20)]
    public string Type { get; set; } = default!;  // "movie"|"tv"|"anime"

    [Required, StringLength(500)]
    public string Title { get; set; } = default!;

    public int? Year { get; set; }
    public int? Episodes { get; set; }
    public int? Seasons { get; set; }

    [StringLength(2000)]
    public string? PosterUrl { get; set; }

    [StringLength(2000)]
    public string? BackdropUrl { get; set; }

    public decimal? Rating { get; set; }

    [StringLength(5000)]
    public string? Synopsis { get; set; }

    public long? BudgetUSD { get; set; }
    public long? RevenueUSD { get; set; }

    [StringLength(1000)]
    public string? GenresCsv { get; set; }

    [StringLength(1000)]
    public string? ZonesCsv { get; set; }

    public WatchStatus Status { get; set; }
    public int? CurrentEpisode { get; set; }
    public int? DroppedAtEpisode { get; set; }

    [Range(0, 10)]
    public decimal? UserRating { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}