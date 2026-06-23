using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StreamVault.Api.Data;
using StreamVault.Api.Dtos;
using StreamVault.Api.Models;

namespace StreamVault.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/library")]
public sealed class LibraryController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public LibraryController(ApplicationDbContext db) => _db = db;

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out userId);
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? status, [FromQuery] string? type, [FromQuery] string? zone)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { error = "Invalid user identity" });

        var q = _db.UserContentStatuses
                   .Include(u => u.Content)
                   .Where(u => u.UserId == currentUserId);

        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(u => u.Status.ToString() == status);
        if (!string.IsNullOrWhiteSpace(type))   q = q.Where(u => u.Content.Type.ToString() == type);
        if (!string.IsNullOrWhiteSpace(zone))   q = q.Where(u => ("," + (u.Content.ZonesCsv ?? "") + ",").Contains("," + zone + ","));

        var rows = await q.OrderByDescending(u => u.UpdatedAt)
                          .Select(u => new
                          {
                              u.ContentId,
                              u.Content.ExternalId,
                              u.Content.Source,
                              Type = u.Content.Type.ToString(),
                              u.Content.Title,
                              u.Content.Year,
                              u.Content.Episodes,
                              u.Content.Seasons,
                              u.Content.PosterUrl,
                              u.Content.BackdropUrl,
                              u.Content.Rating,
                              u.Content.Synopsis,
                              u.Content.BudgetUSD,
                              u.Content.RevenueUSD,
                              u.Content.GenresCsv,
                              u.Content.ZonesCsv,
                              Status = u.Status.ToString(),
                              u.CurrentEpisode,
                              u.DroppedAtEpisode,
                              u.UserRating,
                              u.Notes,
                              u.UpdatedAt
                          })
                          .ToListAsync();

        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertLibraryDto dto)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { error = "Invalid user identity" });

        // normalize type (case-insensitive to handle "movie", "Movie", "MOVIE" etc.)
        if (!Enum.TryParse<ContentType>(dto.Type, ignoreCase: true, out var typeParsed))
            return BadRequest(new { error = $"Invalid content type: {dto.Type}" });

        // ensure Content exists (create if missing, update metadata if found)
        var content = await _db.Contents
            .FirstOrDefaultAsync(c => c.ExternalId == dto.ExternalId && c.Source == dto.Source);

        if (content is null)
        {
            content = new Content
            {
                ExternalId = dto.ExternalId,
                Source = dto.Source,
                Type = typeParsed,
                Title = dto.Title,
                Year = dto.Year,
                Episodes = dto.Episodes,
                Seasons = dto.Seasons,
                PosterUrl = dto.PosterUrl,
                BackdropUrl = dto.BackdropUrl,
                Rating = dto.Rating,
                Synopsis = dto.Synopsis,
                BudgetUSD = dto.BudgetUSD,
                RevenueUSD = dto.RevenueUSD,
                GenresCsv = dto.GenresCsv,
                ZonesCsv = dto.ZonesCsv
            };
            _db.Contents.Add(content);
            await _db.SaveChangesAsync();
        }
        else
        {
            // Update metadata so poster/synopsis/rating stay fresh
            content.Title = dto.Title;
            content.Year = dto.Year ?? content.Year;
            content.Episodes = dto.Episodes ?? content.Episodes;
            content.Seasons = dto.Seasons ?? content.Seasons;
            content.PosterUrl = dto.PosterUrl ?? content.PosterUrl;
            content.BackdropUrl = dto.BackdropUrl ?? content.BackdropUrl;
            content.Rating = dto.Rating ?? content.Rating;
            content.Synopsis = dto.Synopsis ?? content.Synopsis;
            content.BudgetUSD = dto.BudgetUSD ?? content.BudgetUSD;
            content.RevenueUSD = dto.RevenueUSD ?? content.RevenueUSD;
            content.GenresCsv = dto.GenresCsv ?? content.GenresCsv;
            content.ZonesCsv = dto.ZonesCsv ?? content.ZonesCsv;
            content.LastRefreshedAt = DateTime.UtcNow;
        }

        // upsert user status (scoped by CurrentUserId)
        var row = await _db.UserContentStatuses
            .FindAsync(currentUserId, content.ContentId);

        if (row is null)
        {
            row = new UserContentStatus { UserId = currentUserId, ContentId = content.ContentId };
            _db.UserContentStatuses.Add(row);
        }

        row.Status = dto.Status;
        row.CurrentEpisode = dto.CurrentEpisode;
        row.DroppedAtEpisode = dto.DroppedAtEpisode;
        row.UserRating = dto.UserRating;
        row.Notes = dto.Notes;
        row.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Return the full row so the frontend can update its local state
        return Ok(new
        {
            content.ContentId,
            content.ExternalId,
            content.Source,
            Type = content.Type.ToString(),
            content.Title,
            content.Year,
            content.Episodes,
            content.Seasons,
            content.PosterUrl,
            content.BackdropUrl,
            content.Rating,
            content.Synopsis,
            content.BudgetUSD,
            content.RevenueUSD,
            content.GenresCsv,
            content.ZonesCsv,
            Status = row.Status.ToString(),
            row.CurrentEpisode,
            row.DroppedAtEpisode,
            row.UserRating,
            row.Notes,
            row.UpdatedAt
        });
    }

    [HttpDelete("{contentId:guid}")]
    public async Task<IActionResult> Remove(Guid contentId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { error = "Invalid user identity" });

        var row = await _db.UserContentStatuses.FindAsync(currentUserId, contentId);
        if (row is null) return NotFound();
        _db.UserContentStatuses.Remove(row);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Activity feed: returns the most recently updated library items (Watcharr-style history).
    /// </summary>
    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity([FromQuery] int limit = 20)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { error = "Invalid user identity" });

        if (limit < 1) limit = 20;
        if (limit > 50) limit = 50;

        var rows = await _db.UserContentStatuses
            .Include(u => u.Content)
            .Where(u => u.UserId == currentUserId)
            .OrderByDescending(u => u.UpdatedAt)
            .Take(limit)
            .Select(u => new
            {
                u.ContentId,
                u.Content.ExternalId,
                u.Content.Source,
                Type = u.Content.Type.ToString(),
                u.Content.Title,
                u.Content.Year,
                u.Content.PosterUrl,
                u.Content.Rating,
                Status = u.Status.ToString(),
                u.CurrentEpisode,
                u.UserRating,
                u.UpdatedAt
            })
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>
    /// Stats: returns summary stats for the current user's library.
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { error = "Invalid user identity" });

        var items = await _db.UserContentStatuses
            .Include(u => u.Content)
            .Where(u => u.UserId == currentUserId)
            .ToListAsync();

        var total = items.Count;
        var byStatus = items.GroupBy(i => i.Status.ToString())
            .ToDictionary(g => g.Key, g => g.Count());
        var byType = items.GroupBy(i => i.Content.Type.ToString())
            .ToDictionary(g => g.Key, g => g.Count());
        var avgRating = items.Where(i => i.UserRating.HasValue)
            .Select(i => i.UserRating!.Value)
            .DefaultIfEmpty(0)
            .Average();
        var totalEpisodesWatched = items.Where(i => i.CurrentEpisode.HasValue)
            .Sum(i => i.CurrentEpisode!.Value);

        return Ok(new
        {
            total,
            byStatus,
            byType,
            avgRating = Math.Round(avgRating, 1),
            totalEpisodesWatched
        });
    }
}