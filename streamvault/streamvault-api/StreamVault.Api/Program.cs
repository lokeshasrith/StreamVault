using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StreamVault.Api.Config;
using StreamVault.Api.Data;
using StreamVault.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// DbContext (SQLite)
builder.Services.AddDbContext<ApplicationDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("Default")));

// Identity (with GUID keys)
// Use IdentityCore (no cookie UI) + JWT as default scheme  
builder.Services
    .AddIdentityCore<ApplicationUser>(opt =>
    {
        opt.Password.RequiredLength = 8;
        opt.Password.RequireDigit = true;
        opt.Password.RequireNonAlphanumeric = true;
        opt.Password.RequireUppercase = true;
        opt.Password.RequireLowercase = false;
        opt.User.RequireUniqueEmail = true;   // keep this on
        opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        opt.Lockout.MaxFailedAccessAttempts = 5;
        opt.Lockout.AllowedForNewUsers = true;
    })
    .AddRoles<IdentityRole<Guid>>()  // optional roles support
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders(); // email reset tokens etc.

// JWT Auth (Bearer) - set as default scheme to prevent cookie redirects  
var jwt = builder.Configuration.GetSection("Jwt");
var jwtKey = jwt["Key"] ?? throw new InvalidOperationException("Jwt:Key is required.");
if (jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters long.");

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization();

// ── External API config (User-Secrets / env overrides appsettings) ────────
builder.Services.Configure<TmdbOptions>(builder.Configuration.GetSection("Tmdb"));

// Named HttpClients (BaseAddress set from options; keys injected at call time)
// In Development, bypass SSL validation to handle corporate proxy / self-signed certs
var isDev = builder.Environment.IsDevelopment();
void ConfigureSslBypass(IHttpClientBuilder b) { if (isDev) b.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator }); }

ConfigureSslBypass(builder.Services.AddHttpClient(""));  // default client used by ContentApiService
// RapidAPI-based clients (AnimeDB, YouTube share the same key)
ConfigureSslBypass(builder.Services.AddHttpClient("animedb"));
ConfigureSslBypass(builder.Services.AddHttpClient("youtube"));
ConfigureSslBypass(builder.Services.AddHttpClient("websearch"));
ConfigureSslBypass(builder.Services.AddHttpClient("omdb"));
ConfigureSslBypass(builder.Services.AddHttpClient("imdb-tuhin"));
// Public keyless entertainment news feeds (RSS)
ConfigureSslBypass(builder.Services.AddHttpClient("news"));

// In-memory cache (cuts external calls; respects TasteDive ~300 req/hour)
builder.Services.AddMemoryCache();

// App services
builder.Services.AddScoped<IContentApiService, ContentApiService>();
builder.Services.AddScoped<AnimeDbClient>();
builder.Services.AddScoped<YouTubeClient>();
builder.Services.AddScoped<OmdbClient>();
builder.Services.AddScoped<WebSearchClient>();
builder.Services.AddScoped<ImdbApiClient>();
builder.Services.AddScoped<NewsApiClient>();

// CORS Configuration
var allowedOrigins = (builder.Configuration["AllowedOrigins"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("spa", policy =>
        policy.SetIsOriginAllowed(origin =>
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
            // Allow localhost and any private-network IP for mobile dev access
            if (uri.Host == "localhost" && uri.Port >= 5000 && uri.Port <= 5300) return true;
            if (System.Net.IPAddress.TryParse(uri.Host, out _) && uri.Port >= 5000 && uri.Port <= 5300) return true;
            // Allow configured origins (e.g. GitHub Pages, Vercel, etc.)
            if (allowedOrigins.Any(o => string.Equals(o, origin, StringComparison.OrdinalIgnoreCase))) return true;
            return false;
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    static string GetPartitionKey(HttpContext ctx)
    {
        var userId = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(userId)) return $"user:{userId}";

        var ip = ctx.Connection.RemoteIpAddress?.ToString();
        return !string.IsNullOrWhiteSpace(ip) ? $"ip:{ip}" : "anon";
    }

    var apiPermitLimit = isDev ? 300 : 120;
    var apiQueueLimit = isDev ? 120 : 30;
    var authPermitLimit = isDev ? 20 : 10;

    options.AddPolicy("api", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: GetPartitionKey(ctx),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = apiPermitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = apiQueueLimit,
                AutoReplenishment = true
            }));

    options.AddPolicy("auth", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: GetPartitionKey(ctx),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = authPermitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var app = builder.Build();

app.UseCors("spa");
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication(); // must be before UseAuthorization
app.UseAuthorization();

app.MapControllers().RequireRateLimiting("api");

// Health check for Render / load balancers
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));

app.Run();
