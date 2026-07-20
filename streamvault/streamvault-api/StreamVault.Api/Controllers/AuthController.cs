using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using StreamVault.Api.Data;
using StreamVault.Api.Dtos;

namespace StreamVault.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _config;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        IConfiguration config)
    {
        _userManager = userManager;
        _config = config;
    }

    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var normalizedEmail = dto.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
            return BadRequest(new { error = "Email is required" });

        var normalizedDisplayName = string.IsNullOrWhiteSpace(dto.DisplayName)
            ? null
            : dto.DisplayName.Trim();

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = normalizedEmail,
            Email = normalizedEmail,
            DisplayName = normalizedDisplayName
        };
        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);
        return Ok(new { ok = true });
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var normalizedEmail = dto.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
            return Unauthorized(new { error = "Invalid email or password" });

        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user is null) return Unauthorized(new { error = "Invalid email or password" });

        if (await _userManager.IsLockedOutAsync(user))
            return Unauthorized(new { error = "Account temporarily locked. Please try again later." });

        var passwordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!passwordValid)
        {
            await _userManager.AccessFailedAsync(user);
            return Unauthorized(new { error = "Invalid email or password" });
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        var token = GenerateJwt(user);
        var userKey = GenerateUserKey(user.Id);
        return Ok(new
        {
            token,
            userKey,
            user = new
            {
                email = user.Email,
                displayName = user.DisplayName
            }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { error = "Invalid user identity" });

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Unauthorized(new { error = "User not found" });

        return Ok(new
        {
            userKey = GenerateUserKey(user.Id),
            email = user.Email,
            displayName = user.DisplayName
        });
    }

    private string GenerateJwt(ApplicationUser user)
    {
        var jwt = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresMinutes = int.TryParse(jwt["ExpiresMinutes"], out var parsedMinutes) && parsedMinutes > 0
            ? parsedMinutes
            : 120;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName!)
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GenerateUserKey(Guid userId)
    {
        var secret = _config.GetSection("Jwt")["Key"]!;
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(userId.ToString("N")));
        var base64Url = Base64UrlEncoder.Encode(hash);
        return base64Url[..16].ToLowerInvariant();
    }
}