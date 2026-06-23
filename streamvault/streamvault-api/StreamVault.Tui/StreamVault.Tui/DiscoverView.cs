using System.Collections.ObjectModel;
using Terminal.Gui;

namespace StreamVault.Tui;

public sealed class DiscoverView : View
{
    private readonly ApiClient _api;
    private readonly TextField _searchField;
    private readonly ComboBox _typeFilter;
    private readonly ListView _resultsList;
    private readonly Label _infoLabel;
    private List<SearchItem> _results = new();

    private static readonly string[] Types = { "(All)", "movie", "tv", "anime" };

    public DiscoverView(ApiClient api)
    {
        _api = api;
        X = 0; Y = 0;
        Width = Dim.Fill();
        Height = Dim.Fill();

        // Search bar
        var searchLabel = new Label { Text = "Search:", X = 1, Y = 0 };
        _searchField = new TextField
        {
            X = 9, Y = 0,
            Width = 35
        };

        var typeLabel = new Label { Text = "Type:", X = 46, Y = 0 };
        _typeFilter = new ComboBox
        {
            X = 52, Y = 0, Width = 12, Height = 5,
            ReadOnly = true
        };
        _typeFilter.SetSource(new ObservableCollection<string>(Types));
        _typeFilter.SelectedItem = 0;

        var searchBtn = new Button { Text = "Go", X = 66, Y = 0 };
        searchBtn.Accepting += (_, _) => DoSearch();

        // Handle Enter key in search field
        _searchField.KeyDown += (_, e) =>
        {
            if (e.KeyCode == KeyCode.Enter)
            {
                DoSearch();
                e.Handled = true;
            }
        };

        // Results
        _resultsList = new ListView
        {
            X = 0, Y = 2,
            Width = Dim.Fill(),
            Height = Dim.Fill(4)
        };
        _resultsList.OpenSelectedItem += (_, _) => ShowResultDetails();

        _infoLabel = new Label
        {
            Text = "Enter a search query and press Enter or click Go",
            X = 0,
            Y = Pos.AnchorEnd(1),
            Width = Dim.Fill()
        };

        Add(searchLabel, _searchField, typeLabel, _typeFilter, searchBtn, _resultsList, _infoLabel);
    }

    public void ClearResults()
    {
        _results.Clear();
        _resultsList.SetSource(new ObservableCollection<string>());
        _infoLabel.Text = "Results cleared.";
    }

    private async void DoSearch()
    {
        var query = _searchField.Text ?? "";
        if (string.IsNullOrWhiteSpace(query))
        {
            _infoLabel.Text = "Please enter a search term.";
            return;
        }

        _infoLabel.Text = "Searching...";

        var type = _typeFilter.SelectedItem > 0 ? Types[_typeFilter.SelectedItem] : null;

        try
        {
            var result = await _api.SearchAsync(query, type);
            _results = result.Items;
            var display = new ObservableCollection<string>(_results.Select(FormatResult));
            _resultsList.SetSource(display);
            _infoLabel.Text = $"{_results.Count} results (total: {result.TotalCount}) | Enter to view details & add to library";
        }
        catch (Exception ex)
        {
            _infoLabel.Text = $"Error: {ex.Message}";
        }
    }

    private static string FormatResult(SearchItem item)
    {
        var type = item.Type.PadRight(5);
        var year = item.Year?.ToString() ?? "----";
        var rating = item.VoteAverage > 0 ? $"★{item.VoteAverage:F1}" : "  -  ";
        var genres = item.Genres.Length > 0 ? string.Join(", ", item.Genres.Take(3)) : "";
        return $" [{type}] {rating} | {year} | {item.Title}  {genres}";
    }

    private void ShowResultDetails()
    {
        if (_resultsList.SelectedItem < 0 || _resultsList.SelectedItem >= _results.Count) return;
        var item = _results[_resultsList.SelectedItem];

        var dialog = new Dialog
        {
            Title = item.Title,
            Width = 70,
            Height = 20
        };

        var overview = string.IsNullOrEmpty(item.Overview) ? "No overview available." : item.Overview;
        if (overview.Length > 300) overview = overview[..300] + "...";

        var details = $@"
  Title:     {item.Title}
  Type:      {item.Type}         Year: {item.Year?.ToString() ?? "N/A"}
  Rating:    ★ {item.VoteAverage:F1}/10
  Source:    {item.Source}
  Episodes:  {item.Episodes?.ToString() ?? "N/A"}
  Seasons:   {item.Seasons?.ToString() ?? "N/A"}
  Genres:    {string.Join(", ", item.Genres)}

  Overview:
  {overview}
";

        var textView = new TextView
        {
            X = 0, Y = 0,
            Width = Dim.Fill(),
            Height = Dim.Fill(3),
            Text = details,
            ReadOnly = true
        };

        var addBtn = new Button { Text = "Add to Library" };
        addBtn.Accepting += (_, _) =>
        {
            dialog.RequestStop();
            ShowAddToLibraryDialog(item);
        };

        var closeBtn = new Button { Text = "Close" };
        closeBtn.Accepting += (_, _) => dialog.RequestStop();

        dialog.Add(textView);
        dialog.AddButton(addBtn);
        dialog.AddButton(closeBtn);

        Application.Run(dialog);
    }

    private void ShowAddToLibraryDialog(SearchItem item)
    {
        var dialog = new Dialog
        {
            Title = $"Add to Library - {item.Title}",
            Width = 40,
            Height = 12
        };

        var label = new Label { Text = "Select watch status:", X = 1, Y = 1 };
        var statusList = new ListView
        {
            X = 1, Y = 2,
            Width = Dim.Fill(3),
            Height = 5
        };
        var statuses = new[] { "watchlist", "watching", "completed", "dropped", "on_hold" };
        statusList.SetSource(new ObservableCollection<string>(statuses));
        statusList.SelectedItem = 0;

        statusList.OpenSelectedItem += async (_, _) =>
        {
            var selectedStatus = statuses[statusList.SelectedItem];
            var req = new UpsertRequest
            {
                ExternalId = item.ExternalId,
                Source = item.Source,
                Type = item.Type,
                Title = item.Title,
                Year = item.Year,
                Episodes = item.Episodes,
                Seasons = item.Seasons,
                Rating = (decimal?)item.VoteAverage,
                Synopsis = item.Overview,
                GenresCsv = string.Join(",", item.Genres),
                Status = selectedStatus
            };

            var (ok, err) = await _api.UpsertLibraryAsync(req);
            if (ok)
            {
                MessageBox.Query("Success", $"'{item.Title}' added as '{selectedStatus}'!", "OK");
            }
            else
            {
                MessageBox.ErrorQuery("Error", err ?? "Failed to add", "OK");
            }
            dialog.RequestStop();
        };

        var cancelBtn = new Button { Text = "Cancel" };
        cancelBtn.Accepting += (_, _) => dialog.RequestStop();

        dialog.Add(label, statusList);
        dialog.AddButton(cancelBtn);
        Application.Run(dialog);
    }
}
