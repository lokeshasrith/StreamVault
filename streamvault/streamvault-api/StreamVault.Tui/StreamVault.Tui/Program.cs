using Terminal.Gui;

namespace StreamVault.Tui;

public static class Program
{
    private static ApiClient _api = null!;

    private static Toplevel GetTopOrThrow()
    {
        return Application.Top ?? throw new InvalidOperationException("Terminal.Gui top-level view is not initialized.");
    }

    public static void Main(string[] args)
    {
        var baseUrl = args.Length > 0 ? args[0] : "http://localhost:7166";
        _api = new ApiClient(baseUrl);

        Application.Init();

        ShowLoginView();

        Application.Shutdown();
    }

    public static void ShowLoginView()
    {
        var top = GetTopOrThrow();
        top.RemoveAll();
        var loginView = new LoginView(_api);
        loginView.OnLoginSuccess += () => ShowMainView();
        top.Add(loginView);
        Application.Run(top);
    }

    public static void ShowMainView()
    {
        var top = GetTopOrThrow();
        top.RemoveAll();
        var mainView = new MainView(_api);
        top.Add(mainView);
        Application.Run(top);
    }
}
