// src/utils/tmdb.ts
export type TmdbType = 'movie' | 'tv';

export const TMDB_IMG = (path?: string, size: 'w92'|'w154'|'w185'|'w342'|'w500'|'w780'|'original'='w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : '';

export function trimSentences(text: string, maxSentences = 3): string {
  if (!text) return '';
  const parts = text.split(/(?<=[.?!])\s+/).slice(0, maxSentences);
  return parts.join(' ');
}

export async function tmdbSearch(
  apiKey: string,
  type: TmdbType,
  query: string,
  language = 'de-DE'
): Promise<any[]> {
  const url = `https://api.themoviedb.org/3/search/${type}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&language=${language}&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('TMDB search failed');
  const data = await res.json();
  return data.results ?? [];
}

export async function tmdbDetails(
  apiKey: string,
  type: TmdbType,
  id: number,
  language = 'de-DE'
): Promise<any> {
  const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${encodeURIComponent(apiKey)}&language=${language}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('TMDB details failed');
  return await res.json();
}

export async function tmdbProviders(
  apiKey: string,
  type: TmdbType,
  id: number,
  country = 'DE'
): Promise<{name: string; logo?: string}[]> {
  const url = `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const de = data?.results?.[country];
  if (!de) return [];
  const list = de.flatrate || de.ads || de.free || [];
  return (list as any[]).map(p => ({
    name: p.provider_name,
    logo: TMDB_IMG(p.logo_path, 'w92')
  }));
}

/** Heuristik: ob TV-Show als „Anime“ gilt */
export function isAnimeTV(details: any): boolean {
  const origin = (details?.origin_country ?? []) as string[];
  const genres = (details?.genres ?? []) as { id:number; name:string }[];
  const names = genres.map(g => g.name.toLowerCase());
  return origin.includes('JP') || names.includes('animation') || names.includes('anime');
}
