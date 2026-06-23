using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using StreamVault.Api.Models;

namespace StreamVault.Api.Data;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string? DisplayName { get; set; }
}

public sealed class ApplicationDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Content> Contents => Set<Content>();
    public DbSet<UserContentStatus> UserContentStatuses => Set<UserContentStatus>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Content
        b.Entity<Content>(e =>
        {
            e.HasIndex(x => new { x.ExternalId, x.Source }).IsUnique();
            e.Property(x => x.Type).HasConversion<string>();
        });

        // UserContentStatus
        b.Entity<UserContentStatus>(e =>
        {
            e.HasKey(x => new { x.UserId, x.ContentId });
            e.Property(x => x.Status).HasConversion<string>();
            e.HasOne(x => x.Content)
             .WithMany(c => c.UserStatuses)
             .HasForeignKey(x => x.ContentId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}