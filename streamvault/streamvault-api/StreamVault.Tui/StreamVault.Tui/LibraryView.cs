using System.Collections.ObjectModel;
using Terminal.Gui;

namespace StreamVault.Tui;

public sealed class LibraryView : View
{
    private readonly ApiClient _api;
    private readonly ListView _listView;
    private readonly Label _infoLabel;
    private readonly ComboBox _statusFilter;
    private readonly ComboBox _typeFilter;
    private List<LibraryItem> _items = new();

    private static readonly string[] Statuses = { "(All)", "watchlist", "watching", "completed", "liked", "dropped", "on_hold" };
    private static readonly string[] Types = { "(All)", "movie", "tv", "anime" };

    public LibraryView(ApiClient api)
    {
        _api = api;
        X = 0; Y = 0;
        Width = Dim.Fill();
        Height = Dim.Fill();

        // Filters row
        var statusLabel = new Label { Text = "Status:", X = 1, Y = 0 };
        _statusFilter = new ComboBox
        {
            X = 9, Y = 0, Width = 14, Height = 5,
            ReadOnly = true
        };
        _statusFilter.SetSource(new ObservableCollection<string>(Statuses));
        _statusFilter.SelectedItem = 0;
        _statusFilter.SelectedItemChanged += (_, _) => RefreshData();

        var typeLabel = new Label { Text = "Type:", X = 25, Y = 0 };
        _typeFilter = new ComboBox
        {
            X = 31, Y = 0, Width = 12, Height = 5,
            ReadOnly = true
        };
        _typeFilter.SetSource(new ObservableCollection<string>(Types));
        _typeFilter.SelectedItem = 0;
        _typeFilter.SelectedItemChanged += (_, _) => RefreshData();

        var refreshBtn = new Button { Text = "Refresh", X = 45, Y = 0 };
        refreshBtn.Accepting += (_, _) => RefreshData();

        // List
        _listView = new ListView
        {
            X = 0, Y = 2,
            Width = Dim.Fill(),
            Height = Dim.Fill(4)
        };
        _listView.OpenSelectedItem += (_, _) => ShowItemDetails();

        // Info bar
        _infoLabel = new Label
        {
            Text = "Loading library...",
            X = 0,
            Y = Pos.AnchorEnd(1),
            Width = Dim.Fill()
        };

        Add(statusLabel, _statusFilter, typeLabel, _typeFilter, refreshBtn, _listView, _infoLabel);

        // Load data on first display
        Initialized += (_, _) => RefreshData();
    }

    public async void RefreshData()
    {
        _infoLabel.Text = "Loading...";

        var status = _statusFilter.SelectedItem > 0 ? Statuses[_statusFilter.SelectedItem] : null;
        var type = _typeFilter.SelectedItem > 0 ? Types[_typeFilter.SelectedItem] : null;

        try
        {
            _items = await _api.GetLibraryAsync(status, type);
            var displayItems = new ObservableCollection<string>(_items.Select(FormatItem));
            _listView.SetSource(displayItems);
            _infoLabel.Text = $"{_items.Count} items | Press Enter for details | Arrows to navigate";
        }
        catch (Exception ex)
        {
            _infoLabel.Text = $"Error: {ex.Message}";
        }
    }

    private static string FormatItem(LibraryItem item)
    {
        var rating = item.Rating.HasValue ? $"★{item.Rating:F1}" : "  -  ";
        var year = item.Year?.ToString() ?? "----";
        var status = item.Status.PadRight(10);
        var type = item.Type.PadRight(5);
        var progress = item.CurrentEpisode.HasValue ? $"Ep.{item.CurrentEpisode}" : "";
        return $" [{type}] {status} | {rating} | {year} | {item.Title} {progress}";
    }

    private void ShowItemDetails()
    {
        if (_listView.SelectedItem < 0 || _listView.SelectedItem >= _items.Count) return;
        var item = _items[_listView.SelectedItem];

        var dialog = new Dialog
        {
            Title = item.Title,
            Width = 70,
            Height = 20
        };

        var details = $@"
  Title:    {item.Title}
  Type:     {item.Type}        Year: {item.Year?.ToString() ?? "N/A"}
  Rating:   {(item.Rating.HasValue ? $"★ {item.Rating:F1}/10" : "No rating")}
  Status:   {item.Status}
  Episodes: {item.Episodes?.ToString() ?? "N/A"}   Current: {item.CurrentEpisode?.ToString() ?? "-"}
  My Rating:{(item.UserRating.HasValue ? $" {item.UserRating:F1}/10" : " Not rated")}
  Genres:   {item.GenresCsv ?? "N/A"}

  Synopsis:
  {Truncate(item.Synopsis ?? "No synopsis available.", 200)}

  Notes: {item.Notes ?? "(none)"}
  Updated:  {item.UpdatedAt:yyyy-MM-dd HH:mm}
";

        var textView = new TextView
        {
            X = 0, Y = 0,
            Width = Dim.Fill(),
            Height = Dim.Fill(3),
            Text = details,
            ReadOnly = true
        };

        var changeStatusBtn = new Button { Text = "Change Status" };
        changeStatusBtn.Accepting += (_, _) =>
        {
            dialog.RequestStop();
            ShowChangeStatusDialog(item);
        };

        var removeBtn = new Button { Text = "Remove" };
        removeBtn.Accepting += async (_, _) =>
        {
            var confirm = MessageBox.Query("Remove", $"Remove '{item.Title}' from library?", "Yes", "No");
            if (confirm == 0)
            {
                var (ok, err) = await _api.RemoveFromLibraryAsync(item.ContentId);
                if (ok) RefreshData();
                else MessageBox.ErrorQuery("Error", err ?? "Failed to remove", "OK");
            }
            dialog.RequestStop();
        };

        var closeBtn = new Button { Text = "Close" };
        closeBtn.Accepting += (_, _) => dialog.RequestStop();

        dialog.Add(textView);
        dialog.AddButton(changeStatusBtn);
        dialog.AddButton(removeBtn);
        dialog.AddButton(closeBtn);

        Application.Run(dialog);
    }

    private void ShowChangeStatusDialog(LibraryItem item)
    {
        var dialog = new Dialog
        {
            Title = $"Change Status - {item.Title}",
            Width = 40,
            Height = 12
        };

        var statusList = new ListView
        {
            X = 1, Y = 1,
            Width = Dim.Fill(3),
            Height = 5
        };
        var statuses = new[] { "watchlist", "watching", "completed", "liked", "dropped", "on_hold" };
        statusList.SetSource(new ObservableCollection<string>(statuses));
        statusList.SelectedItem = Array.IndexOf(statuses, item.Status);

        statusList.OpenSelectedItem += async (_, _) =>
        {
            var newStatus = statuses[statusList.SelectedItem];
            var req = new UpsertRequest
            {
                ExternalId = item.ExternalId,
                Source = item.Source,
                Type = item.Type,
                Title = item.Title,
                Year = item.Year,
                Episodes = item.Episodes,
                Seasons = item.Seasons,
                Rating = item.Rating,
                Synopsis = item.Synopsis,
                GenresCsv = item.GenresCsv,
                Status = newStatus,
                CurrentEpisode = item.CurrentEpisode,
                UserRating = item.UserRating,
                Notes = item.Notes
            };

            var (ok, err) = await _api.UpsertLibraryAsync(req);
            if (ok)
            {
                dialog.RequestStop();
                RefreshData();
            }
            else
            {
                MessageBox.ErrorQuery("Error", err ?? "Failed to update", "OK");
            }
        };

        var cancelBtn = new Button { Text = "Cancel" };
        cancelBtn.Accepting += (_, _) => dialog.RequestStop();

        dialog.Add(statusList);
        dialog.AddButton(cancelBtn);
        Application.Run(dialog);
    }

    private static string Truncate(string text, int max) =>
        text.Length <= max ? text : text[..max] + "...";
}
