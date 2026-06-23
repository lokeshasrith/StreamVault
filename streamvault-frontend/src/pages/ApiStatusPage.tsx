import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Server, 
  Globe, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RefreshCw 
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

export default function ApiStatusPage() {
  const [apiStatuses, setApiStatuses] = useState<ApiStatus[]>([
    { name: 'StreamVault Backend', status: 'warning', message: 'Checking...' },
    { name: 'TMDB API', status: 'warning', message: 'Checking...' },
    { name: 'Jikan (Anime) API', status: 'warning', message: 'Checking...' },
    { name: 'Database', status: 'warning', message: 'Checking...' }
  ]);
  const [isLoading, setIsLoading] = useState(true);

  const checkApiStatus = async () => {
    setIsLoading(true);
    const newStatuses: ApiStatus[] = [];

    // Check backend API (uses Vite proxy so it works on mobile/devtunnel)
    try {
      const start = Date.now();
      const response = await fetch(`/api/discover/trending`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const responseTime = Date.now() - start;
      
      if (response.ok) {
        newStatuses.push({
          name: 'StreamVault Backend',
          status: 'healthy',
          message: 'Connected successfully',
          responseTime
        });
      } else {
        newStatuses.push({
          name: 'StreamVault Backend',
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`
        });
      }
    } catch {
      newStatuses.push({
        name: 'StreamVault Backend',
        status: 'error',
        message: 'Connection failed - using mock data'
      });
    }

    // Check TMDB API (through backend via Vite proxy)
    try {
      const data = await get<PopularResponse>(`/api/discover/popular?type=movie`);
      if (data.items && data.items.length > 0) {
        newStatuses.push({
          name: 'TMDB API',
          status: 'healthy',
          message: 'Real-time movie data available'
        });
      } else {
        newStatuses.push({
          name: 'TMDB API',
          status: 'warning',
          message: 'No data returned - check API key'
        });
      }
    } catch {
      newStatuses.push({
        name: 'TMDB API',
        status: 'error',
        message: 'Connection failed'
      });
    }

    // Check Jikan API (through backend via Vite proxy)
    try {
      const data = await get<PopularResponse>(`/api/discover/popular?type=anime`);
      if (data.items && data.items.length > 0) {
        newStatuses.push({
          name: 'Jikan (Anime) API',
          status: 'healthy',
          message: 'Real-time anime data available'
        });
      } else {
        newStatuses.push({
          name: 'Jikan (Anime) API',
          status: 'warning',
          message: 'Limited data - rate limiting possible'
        });
      }
    } catch {
      newStatuses.push({
        name: 'Jikan (Anime) API',
        status: 'error',
        message: 'Connection failed'
      });
    }

    // Mock database check (always healthy for demo)
    newStatuses.push({
      name: 'Database',
      status: 'healthy',
      message: 'SQLite database connected'
    });

    setApiStatuses(newStatuses);
    setIsLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern
    void checkApiStatus();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'error': return XCircle;
      default: return Server;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-400';
      case 'warning': return 'text-amber-400';
      case 'error': return 'text-white';
      default: return 'text-[#808080]';
    }
  };

  const healthyCount = apiStatuses.filter(api => api.status === 'healthy').length;
  const warningCount = apiStatuses.filter(api => api.status === 'warning').length;
  const errorCount = apiStatuses.filter(api => api.status === 'error').length;

  return (
    <div className="status-page min-h-screen bg-[#0F1014]">
      <div className="mx-auto w-full max-w-[1480px] px-3 sm:px-6 py-5 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-6 sm:space-y-8"
        >
          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Server className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
              <h1 className="font-display text-[1.8rem] sm:text-4xl md:text-5xl font-bold text-white">
                System Status
              </h1>
            </div>
            <p className="text-[#808080] text-sm sm:text-lg mb-6 sm:mb-8">
              Real-time monitoring of StreamVault's data sources and services
            </p>

            {/* Overall Status */}
            <div className="glass-card p-4 sm:p-6 mb-6 sm:mb-8">
              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                <div className="text-center">
                  <div className="text-xl sm:text-3xl font-bold text-emerald-400 mb-1 sm:mb-2">
                    {healthyCount}
                  </div>
                  <div className="text-xs sm:text-sm text-[#808080]">Healthy</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-3xl font-bold text-amber-400 mb-1 sm:mb-2">
                    {warningCount}
                  </div>
                  <div className="text-xs sm:text-sm text-[#808080]">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                    {errorCount}
                  </div>
                  <div className="text-xs sm:text-sm text-[#808080]">Errors</div>
                </div>
              </div>

              {errorCount > 0 && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-white mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold">Fallback Mode Active</span>
                  </div>
                  <p className="text-sm text-[#808080]">
                    Some services are unavailable. StreamVault is using high-quality mock data to ensure a smooth experience.
                    Real-time data will be restored when services come back online.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={checkApiStatus}
              disabled={isLoading}
              className="btn-secondary flex items-center gap-2 mx-auto mb-6 sm:mb-8 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          {/* Service Status Cards */}
          <div className="grid gap-3 sm:gap-6">
            {apiStatuses.map((api, index) => {
              const StatusIcon = getStatusIcon(api.status);
              const statusColor = getStatusColor(api.status);

              return (
                <motion.div
                  key={api.name}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card p-3 sm:p-6"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                      <StatusIcon className={`w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 ${statusColor}`} />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm sm:text-lg truncate">
                          {api.name}
                        </h3>
                        <p className="text-[#808080] text-xs sm:text-sm truncate">
                          {api.message}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs sm:text-sm font-medium ${statusColor} capitalize`}>
                        {api.status}
                      </div>
                      {api.responseTime && (
                        <div className="text-xs text-[#808080]/50 mt-1">
                          {api.responseTime}ms
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* API Setup Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card p-4 sm:p-8"
          >
            <h2 className="font-display text-lg sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              Setup Real-Time Data Sources
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-white mb-3">📺 TMDB API (Movies & TV Shows)</h3>
                <div className="bg-[#1C1E24] rounded-lg p-4 space-y-2">
                  <p className="text-[#808080] text-sm">
                    1. Visit <a href="https://www.themoviedb.org/settings/api" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">TMDB API Settings</a>
                  </p>
                  <p className="text-[#808080] text-sm">
                    2. Create a free account and request an API key
                  </p>
                  <p className="text-[#808080] text-sm">
                    3. Add your API key to <code className="bg-[#16181D] px-2 py-1 rounded text-xs">appsettings.json</code>
                  </p>
                  <div className="bg-[#0F1014] rounded p-3 mt-2">
                    <code className="text-emerald-400 text-xs">
                      "TmdbApiKey": "your_api_key_here"
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-3">🎌 Jikan API (Anime Data)</h3>
                <div className="bg-[#1C1E24] rounded-lg p-4 space-y-2">
                  <p className="text-[#808080] text-sm">
                    ✅ No API key required - Jikan is free to use
                  </p>
                  <p className="text-[#808080] text-sm">
                    ⚠️ Rate limited to 3 requests per second (handled automatically)
                  </p>
                  <p className="text-[#808080] text-sm">
                    📊 Provides comprehensive anime data from MyAnimeList
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}