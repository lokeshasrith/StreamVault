using System.ComponentModel.DataAnnotations;

namespace StreamVault.Api.Dtos;

public sealed class RegisterDto
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = default!;

    [Required, StringLength(128, MinimumLength = 8)]
    public string Password { get; set; } = default!;

    [StringLength(100)]
    public string? DisplayName { get; set; }
}

public sealed class LoginDto
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = default!;

    [Required, StringLength(128)]
    public string Password { get; set; } = default!;
}