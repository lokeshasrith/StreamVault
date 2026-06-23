using Terminal.Gui;

namespace StreamVault.Tui;

public sealed class MainView : Window
{
    private readonly ApiClient _api;
    private readonly TabView _tabView;

    public MainView(ApiClient api)
    {
        _api = api;
        Title = "StreamVault TUI (Ctrl+Q to quit)";
        X = 0; Y = 0;
        Width = Dim.Fill();
        Height = Dim.Fill();

        // Status bar info
        var statusBar = new Label
        {
            Text = " [F1] Library  [F2] Discover  [F5] Refresh  [Ctrl+Q] Quit ",
            X = 0,
            Y = Pos.AnchorEnd(1),
            Width = Dim.Fill(),
            ColorScheme = Colors.ColorSchemes["Menu"]
        };

        _tabView = new TabView
        {
            X = 0,
            Y = 0,
            Width = Dim.Fill(),
            Height = Dim.Fill(2)
        };

        var libraryTab = new Tab { DisplayText = "Library", View = new LibraryView(_api) };
        var discoverTab = new Tab { DisplayText = "Discover", View = new DiscoverView(_api) };
        var statsTab = new Tab { DisplayText = "Stats", View = new StatsView(_api) };

        _tabView.AddTab(libraryTab, true);
        _tabView.AddTab(discoverTab, false);
        _tabView.AddTab(statsTab, false);

        Add(_tabView, statusBar);

        // Keyboard shortcuts
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == KeyCode.F1)
            {
                _tabView.SelectedTab = libraryTab;
                e.Handled = true;
            }
            else if (e.KeyCode == KeyCode.F2)
            {
                _tabView.SelectedTab = discoverTab;
                e.Handled = true;
            }
            else if (e.KeyCode == KeyCode.F5)
            {
                RefreshCurrentTab();
                e.Handled = true;
            }
        };
    }

    private void RefreshCurrentTab()
    {
        if (_tabView.SelectedTab?.View is LibraryView lib)
            lib.RefreshData();
        else if (_tabView.SelectedTab?.View is DiscoverView disc)
            disc.ClearResults();
    }
}
