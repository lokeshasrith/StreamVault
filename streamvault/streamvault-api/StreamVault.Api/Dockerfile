FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["StreamVault.Api.csproj", "."]
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/out

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/out .

# SQLite database lives in /data (mount a persistent disk on Render)
ENV ASPNETCORE_URLS=http://+:10000
ENV ConnectionStrings__Default="Data Source=/tmp/streamvault.db"

EXPOSE 10000
ENTRYPOINT ["dotnet", "StreamVault.Api.dll"]
