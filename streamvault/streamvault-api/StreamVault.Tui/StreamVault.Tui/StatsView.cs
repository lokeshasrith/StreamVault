using System.Collections.ObjectModel;
using Terminal.Gui;

namespace StreamVault.Tui;

public sealed class StatsView : View
{
    private readonly ApiClient _api;
    private readonly TextView _statsText;

    public StatsView(ApiClient api)
    {
        _api = api;
        X = 0; Y = 0;
        Width = Dim.Fill();
        Height = Dim.Fill();

        var title = new Label
        {
            Text = "Library Statistics",
            X = Pos.Center(),
            Y = 0
        };

        _statsText = new TextView
        {
            X = 1, Y = 2,
            Width = Dim.Fill(3),
            Height = Dim.Fill(4),
            ReadOnly = true,
            Text = "Loading stats..."
        };

        var refreshBtn = new Button { Text = "Refresh Stats", X = Pos.Center(), Y = Pos.AnchorEnd(1) };
        refreshBtn.Accepting += (_, _) => LoadStats();

        Add(title, _statsText, refreshBtn);
        Initialized += (_, _) => LoadStats();
    }

    private async void LoadStats()
    {
        try
        {
            var all = await _api.GetLibraryAsync();

            var total = all.Count;
            var movies = all.Count(i => i.Type == "movie");
            var tvShows = all.Count(i => i.Type == "tv");
            var anime = all.Count(i => i.Type == "anime");

            var watchlist = all.Count(i => i.Status == "watchlist");
            var watching = all.Count(i => i.Status == "watching");
            var completed = all.Count(i => i.Status == "completed");
            var dropped = all.Count(i => i.Status == "dropped");
            var onHold = all.Count(i => i.Status == "on_hold");

            var avgRating = all.Where(i => i.UserRating.HasValue)
                              .Select(i => i.UserRating!.Value)
                              .DefaultIfEmpty(0)
                              .Average();

            var topRated = all.Where(i => i.UserRating.HasValue)
                             .OrderByDescending(i => i.UserRating)
                             .Take(5)
                             .ToList();

            var recentlyUpdated = all.OrderByDescending(i => i.UpdatedAt)
                                     .Take(5)
                                     .ToList();

            var stats = $@"
  ===== STREAMVAULT LIBRARY STATISTICS =====

  Total Items: {total}

  By Type:
    Movies:  {movies}   TV Shows: {tvShows}   Anime: {anime}

  By Status:
    Watchlist: {watchlist}  Watching: {watching}
    Completed: {completed}  Dropped:  {dropped}
    On Hold:   {onHold}

  Average User Rating: {avgRating:F1}/10

  Top Rated (Your Ratings):
  {string.Join("\n  ", topRated.Select((t, i) => $"  {i + 1}. {t.Title} - {t.UserRating:F1}/10"))}

  Recently Updated:
  {string.Join("\n  ", recentlyUpdated.Select(r => $"  - {r.Title} ({r.Status}) - {r.UpdatedAt:MMM dd}"))}
";

            _statsText.Text = stats;
        }
        catch (Exception ex)
        {
            _statsText.Text = $"Error loading stats: {ex.Message}\n\nMake sure the API is running.";
        }
    }
}
