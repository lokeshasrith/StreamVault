# StreamVault API Startup Script
Set-Location $PSScriptRoot
Write-Host "Current directory: $(Get-Location)"
Write-Host "Project file exists: $(Test-Path "StreamVault.Api.csproj")"
Write-Host "Starting StreamVault API..."
dotnet run