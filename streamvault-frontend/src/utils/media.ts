// Shared media helpers that do not require API class loading.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const PROXY_ALLOWED_HOSTS = [
  'image.tmdb.org',
  'media-amazon.com',
  'm.media-amazon.com',
  'imdb.com',
  'media-imdb.com',
  'ia.media-imdb.com',
  'wikimedia.org',
  'upload.wikimedia.org',
  'myanimelist.net',
  'cdn.myanimelist.net',
  'cdn.jikan.moe',
  'img.anili.st',
  's4.anilist.co',
  'img.youtube.com',
  'deadline.com',
  'variety.com',
  'hollywoodreporter.com',
  'animenewsnetwork.com',
  'hindustantimes.com',
  'bollywoodhungama.com',
  'indianexpress.com',
];

function buildProxyImageUrl(url: string): string {
  return `${API_BASE}/api/img/proxy?url=${encodeURIComponent(url)}`;
}

function shouldBypassProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'cdn.myanimelist.net'
      || hostname === 'myanimelist.net'
      || hostname === 'img.anili.st'
      || hostname === 's4.anilist.co';
  } catch {
    return false;
  }
}

function isProxyAllowedHost(hostname: string): boolean {
  return PROXY_ALLOWED_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

function normalizeRemoteUrl(input: string): string {
  let url = input.trim();
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    return input;
  }
}

export const PLACEHOLDER_POSTER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513">
    <rect width="342" height="513" fill="#1a1a2e"/>
    <text x="171" y="240" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="18">No Poster</text>
    <text x="171" y="270" text-anchor="middle" fill="#444" font-family="sans-serif" font-size="14">Available</text>
  </svg>`
)}`;

export function getImageUrl(path: string | undefined, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string {
  if (!path) return PLACEHOLDER_POSTER;
  const normalizedPath = path.trim();
  if (!normalizedPath) return PLACEHOLDER_POSTER;
  if (normalizedPath.startsWith('data:')) return normalizedPath;
  if (normalizedPath.startsWith('/api/')) return normalizedPath;

  const isAbsolute = /^https?:\/\//i.test(normalizedPath) || normalizedPath.startsWith('//');
  if (isAbsolute) {
    const remoteUrl = normalizeRemoteUrl(normalizedPath);
    try {
      const hostname = new URL(remoteUrl).hostname.toLowerCase();
      if (shouldBypassProxy(remoteUrl)) {
        return remoteUrl;
      }
      if (isProxyAllowedHost(hostname)) {
        return buildProxyImageUrl(remoteUrl);
      }
      return remoteUrl;
    } catch {
      return remoteUrl;
    }
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(normalizedPath)) {
    return getImageUrl(`https://${normalizedPath}`, size);
  }

  const sizeMap = { small: 'w185', medium: 'w342', large: 'w780', original: 'original' };
  return buildProxyImageUrl(`${TMDB_IMAGE_BASE}/${sizeMap[size]}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`);
}

export function formatRating(rating: number | undefined): string {
  if (rating === undefined || rating === null) return 'N/A';
  return rating.toFixed(1);
}

export function formatGenres(genres: string | string[] | undefined): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres;
  return genres.split(',').map((genre: string) => genre.trim()).filter(Boolean);
}

export function getContentTypeLabel(type: string, source?: string): string {
  if (source === 'jikan') return 'Anime';
  const labels: Record<string, string> = { movie: 'Movie', tv: 'TV Show', anime: 'Anime' };
  return labels[type] ?? type;
}

export function formatYear(dateOrYear: string | number | undefined): string {
  if (!dateOrYear) return '';
  if (typeof dateOrYear === 'number') return dateOrYear.toString();
  const year = new Date(dateOrYear).getFullYear();
  return Number.isNaN(year) ? '' : year.toString();
}

export function formatEpisodes(episodes: number | undefined, seasons: number | undefined): string {
  if (seasons) return `${seasons} Season${seasons > 1 ? 's' : ''}`;
  if (episodes) return `${episodes} Episode${episodes > 1 ? 's' : ''}`;
  return '';
}

export function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}