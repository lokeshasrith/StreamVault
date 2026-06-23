using System.Collections.ObjectModel;
using Terminal.Gui;

namespace StreamVault.Tui;

public sealed class LoginView : Window
{
    private readonly ApiClient _api;
    private readonly TextField _emailField;
    private readonly TextField _passwordField;
    private readonly Label _statusLabel;

    public event Action? OnLoginSuccess;

    public LoginView(ApiClient api)
    {
        _api = api;
        Title = "StreamVault - Login (Ctrl+Q to quit)";
        X = 0; Y = 0;
        Width = Dim.Fill();
        Height = Dim.Fill();

        var banner = new Label
        {
            Text = @"
   _____ _                           _    __            _ _   
  / ____| |                         | |  / /           | | |  
 | (___ | |_ _ __ ___  __ _ _ __ ___| |/ /__ _ _   _| | |_ 
  \___ \| __| '__/ _ \/ _` | '_ ` _ |   / _` | | | | | __|
  ____) | |_| | |  __| (_| | | | | || |\ \ (_| | |_| | |_ 
 |_____/ \__|_|  \___|\__,_|_| |_| |_| \_\__,_|\__,_|\__|
                                                              
          Your Entertainment Hub - Terminal Client            
",
            X = Pos.Center(),
            Y = 1
        };

        var emailLabel = new Label { Text = "Email:", X = Pos.Center() - 20, Y = 11 };
        _emailField = new TextField
        {
            X = Pos.Center() - 20,
            Y = 12,
            Width = 40
        };

        var passwordLabel = new Label { Text = "Password:", X = Pos.Center() - 20, Y = 14 };
        _passwordField = new TextField
        {
            X = Pos.Center() - 20,
            Y = 15,
            Width = 40,
            Secret = true
        };

        var loginButton = new Button
        {
            Text = "Login",
            X = Pos.Center() - 12,
            Y = 17,
            IsDefault = true
        };
        loginButton.Accepting += (_, _) => DoLogin();

        var registerButton = new Button
        {
            Text = "Register",
            X = Pos.Center() + 2,
            Y = 17
        };
        registerButton.Accepting += (_, _) => DoRegister();

        _statusLabel = new Label
        {
            Text = "",
            X = Pos.Center() - 20,
            Y = 19,
            Width = 40
        };

        Add(banner, emailLabel, _emailField, passwordLabel, _passwordField, loginButton, registerButton, _statusLabel);
    }

    private async void DoLogin()
    {
        var email = _emailField.Text ?? "";
        var password = _passwordField.Text ?? "";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            _statusLabel.Text = "Please enter email and password.";
            return;
        }

        _statusLabel.Text = "Logging in...";

        var (success, error) = await _api.LoginAsync(email, password);
        if (success)
        {
            _statusLabel.Text = "Login successful!";
            Application.RequestStop();
            OnLoginSuccess?.Invoke();
        }
        else
        {
            _statusLabel.Text = $"Error: {error}";
        }
    }

    private async void DoRegister()
    {
        var email = _emailField.Text ?? "";
        var password = _passwordField.Text ?? "";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            _statusLabel.Text = "Please enter email and password.";
            return;
        }

        _statusLabel.Text = "Registering...";

        var (success, error) = await _api.RegisterAsync(email, password, null);
        if (success)
        {
            _statusLabel.Text = "Registered! Now logging in...";
            var (loginOk, loginErr) = await _api.LoginAsync(email, password);
            if (loginOk)
            {
                Application.RequestStop();
                OnLoginSuccess?.Invoke();
            }
            else
            {
                _statusLabel.Text = $"Registered but login failed: {loginErr}";
            }
        }
        else
        {
            _statusLabel.Text = $"Registration failed: {error}";
        }
    }
}
