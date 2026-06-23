# StreamVault Environment Setup Guide

## Quick Start

### Prerequisites
- .NET 8.0 SDK or later
- Node.js 18+ with npm
- SQLite (included with .NET)
- An IDE like VS Code or Visual Studio

### Development Setup

#### 1. Backend (StreamVault.Api)

```bash
# Navigate to backend directory
cd streamvault/streamvault-api/StreamVault.Api

# Restore NuGet packages
dotnet restore

# Apply database migrations (creates SQLite database)
dotnet ef database update

# Run the API server (listens on http://localhost:7166)
dotnet run --urls="http://localhost:7166"
```

#### 2. Frontend (Vue/React Application)

```bash
# Navigate to frontend directory
cd streamvault-frontend

# Install npm dependencies
npm install

# Start development server (listens on http://localhost:5203)
npm run dev
```

The frontend will automatically proxy API calls from `/api/*` to the backend on `http://localhost:7166`.

#### 3. TUI (Terminal User Interface)

```bash
# Navigate to TUI directory
cd streamvault/streamvault-api/StreamVault.Tui/StreamVault.Tui

# Run the TUI application
dotnet run
```

### Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
# - TMDB_API_KEY: Get from https://www.themoviedb.org/settings/api
# - YOUTUBE_API_KEY: Get from https://console.cloud.google.com
```

### Important Configuration Files

| File | Purpose |
|------|---------|
| `appsettings.json` | Production backend settings |
| `appsettings.Development.json` | Development-specific backend settings |
| `vite.config.ts` | Frontend build & proxy configuration |
| `.env.example` | Environment variable documentation |

### Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Backend (ASP.NET) | 7166 | http://localhost:7166 |
| Frontend (Vite) | 5203 | http://localhost:5203 |

### API Keys Setup

#### TMDB (Movies/TV)
1. Visit https://www.themoviedb.org/settings/api
2. Create an API key (free tier available)
3. Add to `.env`: `TMDB_API_KEY=your_key_here`

#### YouTube
1. Visit https://console.cloud.google.com
2. Create a new project
3. Enable YouTube Data API v3
4. Create an API key
5. Add to `.env`: `YOUTUBE_API_KEY=your_key_here`

### Database

#### SQLite (Development)
- Automatically created at `streamvault.db` in the working directory
- Migrations applied automatically on startup
- Contains: Users, Library entries, Content metadata

#### Resetting Database (Development)
```bash
# Delete the database file
rm streamvault.db

# Recreate it with migrations
dotnet ef database update
```

### Troubleshooting

#### Port Already in Use
```bash
# Find process on port 7166
netstat -ano | findstr :7166

# Kill the process
taskkill /PID <PID> /F

# Or change the port:
dotnet run --urls="http://localhost:7167"
```

#### CORS Errors
- Ensure backend is running on the correct port
- Check `vite.config.ts` proxy target matches backend URL
- Verify frontend is accessing via `/api/*` not absolute URL

#### API Key Not Working
- Double-check the key is copied correctly
- Verify the service API is enabled
- Check rate limits haven't been exceeded

#### Database Errors
- Run `dotnet ef migrations add <MigrationName>` if schema changes
- Run `dotnet ef database update` to apply migrations
- Delete `streamvault.db` to start fresh

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup instructions.

### Building for Production

#### Backend
```bash
dotnet build -c Release
dotnet publish -c Release -o ./publish
```

#### Frontend
```bash
npm run build
# Output in dist/ folder
```

### Development Tips

1. **Hot Reload**: Frontend automatically reloads on file changes via Vite
2. **Debugging**: Use VS Code with C# extension for backend debugging
3. **Database**: SQLite files can be inspected with SQLite Browser
4. **Logs**: Check browser DevTools (F12) for frontend errors
5. **API Testing**: Use the provided `.http` files in controllers for API testing

### Next Steps

1. Start the backend and frontend servers
2. Navigate to http://localhost:5203
3. Register a new account
4. Explore the discover page
5. Add items to your library
