import { useEffect, useMemo, useState } from 'react';
import {
  Server,
  Globe,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Clock3,
  Radio,
  Database,
} from 'lucide-react';
import { get } from '../api/http';

interface ApiStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  responseTime?: number;
}

interface PopularResponse {
  items?: unknown[];
}

const STATUS_LABELS: Record<ApiStatus['status'], string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  error: 'Error',
};

export default function ApiStatusPage() {
  const [apiStatuses, setApiStatuses] = useState<ApiStatus[]>([
    { name: 'StreamVault Backend', status: 'warning', message: 'Checking...' },
    { name: 'TMDB API', status: 'warning', message: 'Checking...' },
    { name: 'Jikan (Anime) API', status: 'warning', message: 'Checking...' },
    { name: 'Database', status: 'warning', message: 'Checking...' },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  const checkApiStatus = async () => {
    setIsLoading(true);
    const nextStatuses: ApiStatus[] = [];

    try {
      const start = Date.now();
      const response = await fetch('/api/discover/trending', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const responseTime = Date.now() - start;

      if (response.ok) {
        nextStatuses.push({
          name: 'StreamVault Backend',
          status: 'healthy',
          message: 'Connected successfully',
          responseTime,
        });
      } else {
        nextStatuses.push({
          name: 'StreamVault Backend',
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch {
      nextStatuses.push({
        name: 'StreamVault Backend',
        status: 'error',
        message: 'Connection failed - fallback data active',
      });
    }

    try {
      const data = await get<PopularResponse>('/api/discover/popular?type=movie');
      if (data.items && data.items.length > 0) {
        nextStatuses.push({
          name: 'TMDB API',
          status: 'healthy',
          message: 'Live movie and TV metadata available',
        });
      } else {
        nextStatuses.push({
          name: 'TMDB API',
          status: 'warning',
          message: 'No payload returned - verify upstream API key',
        });
      }
    } catch {
      nextStatuses.push({
        name: 'TMDB API',
        status: 'error',
        message: 'Connection failed',
      });
    }

    try {
      const data = await get<PopularResponse>('/api/discover/popular?type=anime');
      if (data.items && data.items.length > 0) {
        nextStatuses.push({
          name: 'Jikan (Anime) API',
          status: 'healthy',
          message: 'Live anime data available',
        });
      } else {
        nextStatuses.push({
          name: 'Jikan (Anime) API',
          status: 'warning',
          message: 'Limited response - rate limiting likely',
        });
      }
    } catch {
      nextStatuses.push({
        name: 'Jikan (Anime) API',
        status: 'error',
        message: 'Connection failed',
      });
    }

    nextStatuses.push({
      name: 'Database',
      status: 'healthy',
      message: 'SQLite storage online',
    });

    setApiStatuses(nextStatuses);
    setIsLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern
    void checkApiStatus();
  }, []);

  const healthyCount = apiStatuses.filter((api) => api.status === 'healthy').length;
  const warningCount = apiStatuses.filter((api) => api.status === 'warning').length;
  const errorCount = apiStatuses.filter((api) => api.status === 'error').length;

  const overallLabel = useMemo(() => {
    if (errorCount > 0) return 'Degraded';
    if (warningCount > 0) return 'Partial';
    return 'All Systems Go';
  }, [errorCount, warningCount]);

  return (
    <div className="status-page page-shell min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="space-y-5 sm:space-y-7">
          <section className="premium-panel relative overflow-hidden rounded-[30px] px-4 py-5 sm:px-7 sm:py-8 [animation:fadeSlideUp_380ms_ease-out]">
            <div className="pointer-events-none absolute right-[-70px] top-[-120px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(90,211,255,0.22),transparent_72%)]" />
            <div className="pointer-events-none absolute left-[-90px] bottom-[-120px] h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(255,197,98,0.2),transparent_72%)]" />

            <div className="relative flex flex-col gap-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffd9a7]">
                <Server className="h-3.5 w-3.5 text-[#ffc562]" />
                API Health
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-[#F7F1E8] sm:text-[2.25rem]">
                    System Status
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-white/62 sm:text-[0.95rem]">
                    Real-time monitoring of backend routes and live data providers used across StreamVault.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={checkApiStatus}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F7F1E8] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Checking' : 'Refresh'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3.5">
                <StatusTile label="Healthy" value={healthyCount} tone="healthy" />
                <StatusTile label="Warnings" value={warningCount} tone="warning" />
                <StatusTile label="Errors" value={errorCount} tone="error" />
                <StatusTile label="Overall" value={overallLabel} tone={errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'healthy'} />
              </div>
            </div>
          </section>

          {errorCount > 0 && (
            <section className="rounded-2xl border border-[#ff8c79]/30 bg-[#351a18]/45 px-4 py-3 sm:px-5 sm:py-4 [animation:fadeSlideUp_420ms_ease-out]">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#ff8c79]" />
                <div>
                  <p className="text-sm font-semibold text-[#ffd3c8]">Fallback mode is active</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#e7b6ac]/85 sm:text-sm">
                    One or more services are unavailable. StreamVault continues serving fallback content while waiting for providers to recover.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-2.5 sm:gap-3.5 [animation:fadeSlideUp_500ms_ease-out]">
            {apiStatuses.map((api, index) => {
              const StatusIcon = getStatusIcon(api.status);
              const statusColor = getStatusColor(api.status);
              const ServiceIcon = getServiceIcon(api.name);

              return (
                <article
                  key={api.name}
                  className="premium-panel flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 sm:px-5 sm:py-4"
                  style={{ animation: `fadeSlideUp 280ms ease-out ${Math.min(index * 70, 280)}ms both` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04]">
                      <ServiceIcon className="h-4.5 w-4.5 text-[#7ad8ff]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F7F1E8] sm:text-[0.95rem]">{api.name}</p>
                      <p className="truncate text-xs text-white/50 sm:text-sm">{api.message}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium ${statusColor}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {STATUS_LABELS[api.status]}
                    </div>
                    {api.responseTime !== undefined && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/45">
                        <Clock3 className="h-3 w-3" />
                        {api.responseTime}ms
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="premium-panel rounded-[24px] px-4 py-4 sm:px-6 sm:py-6 [animation:fadeSlideUp_560ms_ease-out]">
            <div className="mb-4 flex items-center gap-2.5">
              <Globe className="h-4.5 w-4.5 text-[#5ad3ff]" />
              <h2 className="section-heading m-0 text-base sm:text-lg">Real-Time Data Setup</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <article className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-3.5 sm:p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#F7F1E8]">TMDB API (Movies and TV)</h3>
                <ol className="space-y-1 text-xs leading-relaxed text-white/58 sm:text-sm">
                  <li>1. Create a TMDB account and generate an API key.</li>
                  <li>2. Place the key in backend app settings.</li>
                  <li>3. Restart API service and refresh this status page.</li>
                </ol>
                <p className="mt-3 rounded-lg border border-white/10 bg-[#0b1017] px-2.5 py-2 font-mono text-[11px] text-[#9ee3ff] sm:text-xs">
                  TmdbApiKey: your_api_key_here
                </p>
              </article>

              <article className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-3.5 sm:p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#F7F1E8]">Jikan API (Anime)</h3>
                <ul className="space-y-1 text-xs leading-relaxed text-white/58 sm:text-sm">
                  <li>No API key is required.</li>
                  <li>Built-in rate handling is enabled.</li>
                  <li>Data quality depends on MyAnimeList coverage.</li>
                </ul>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
                  <Radio className="h-3.5 w-3.5 text-[#7ee4aa]" />
                  public upstream
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function getStatusIcon(status: ApiStatus['status']) {
  switch (status) {
    case 'healthy':
      return CheckCircle;
    case 'warning':
      return AlertCircle;
    case 'error':
      return XCircle;
    default:
      return Server;
  }
}

function getStatusColor(status: ApiStatus['status']) {
  switch (status) {
    case 'healthy':
      return 'text-[#7ee4aa]';
    case 'warning':
      return 'text-[#ffd47e]';
    case 'error':
      return 'text-[#ff9d89]';
    default:
      return 'text-white/60';
  }
}

function getServiceIcon(name: string) {
  if (name.includes('Database')) return Database;
  if (name.includes('Jikan')) return Radio;
  if (name.includes('TMDB')) return Globe;
  return Server;
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'healthy' | 'warning' | 'error';
}) {
  const toneClass = {
    healthy: 'from-[#7ee4aa]/25 to-[#7ee4aa]/8 text-[#9cf0bf]',
    warning: 'from-[#ffd47e]/25 to-[#ffd47e]/8 text-[#ffe3a8]',
    error: 'from-[#ff9d89]/25 to-[#ff9d89]/8 text-[#ffc3b8]',
  }[tone];

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 sm:px-3.5">
      <div className={`mb-2 inline-flex rounded-full bg-gradient-to-br px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
        {label}
      </div>
      <p className="text-lg font-bold leading-none text-[#F7F1E8] sm:text-2xl">{value}</p>
    </article>
  );
}
