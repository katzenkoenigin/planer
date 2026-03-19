// src/components/WatchlistView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Heart, Trash2, Plus,
  Film, Clapperboard, Info, Eye, TvMinimalPlay, Pause, RotateCcw
} from 'lucide-react';
import {
  TMDB_IMG,
  tmdbSearch,
  tmdbDetails,
  tmdbProviders,
  isAnimeTV,
  type TmdbType,
  trimSentences,
} from '../utils/tmdb';

type WatchTabs = 'movies' | 'series' | 'anime' | 'started' | 'rewatch' | 'watched' | 'favorites';

export type WatchItem = {
  id: string;            // "movie:123" | "tv:456"
  tmdbId: number;
  type: 'movie' | 'tv';
  isAnime?: boolean;
  title: string;
  year?: number;
  country?: string;
  genres: string[];
  overview?: string;
  poster?: string;
  runtime?: number;      // movie
  seasons?: number;      // tv
  episodes?: number;     // tv
  providers?: { name: string; logo?: string }[];
  rating?: number;       // 0..10
  ratingSource?: 'tmdb' | 'imdb';
  favorite?: boolean;
  started?: boolean;
  rewatch?: boolean;
  watched?: boolean;
  addedAt: string;
};

const WATCHLIST_KEY = 'WATCHLIST_V1';

/* =========================
   Provider-Normalisierung + Whitelist + eigene Logos (/public/Logos)
========================= */

const CANON = (s: string) => (s || '').trim().toLowerCase();

const PROVIDER_ALIASES_LOWER: Record<string, string> = {
  'disney+': 'disney plus',
  'apple tv plus': 'apple tv+',
  'paramount plus': 'paramount+',
  'paramount plus (de)': 'paramount+',
  'wow tv': 'wow',
  'wowtv': 'wow',
  'rtl plus': 'rtl+',
  'prime video': 'amazon prime video',
  'amazon prime': 'amazon prime video',
  'amazon freevee': 'freevee',
  'amazonfreevee': 'freevee',
  'amazon prime video channels': 'prime video channels',
  'prime video channels': 'prime video channels',
};

const WL: string[] = [
  'netflix',
  'amazon prime video',
  'prime video channels',
  'wow',
  'disney plus',
  'rtl+',
  'joyn',
  'mubi',
  'apple tv+',
  'crunchyroll',
  'paramount+',
  'ard',
  'zdf',
  'arte',
  'netzkino',
  'freevee',
  'hulu',
];
const WL_SET = new Set(WL);

const LOGO: Record<string, string> = {
  'netflix': '/Logos/netflix.svg',
  'amazon prime video': '/Logos/primevideo.svg',
  'prime video channels': '/Logos/primevideochannel.svg',
  'wow': '/Logos/wowtv.svg',
  'disney plus': '/Logos/disneyplus.svg',
  'rtl+': '/Logos/rtlplus.svg',
  'joyn': '/Logos/joyn.svg',
  'mubi': '/Logos/mubi.svg',
  'apple tv+': '/Logos/appletvplus.svg',
  'crunchyroll': '/Logos/crunchyroll.svg',
  'paramount+': '/Logos/paramountplus.svg',
  'ard': '/Logos/ard.svg',
  'zdf': '/Logos/zdf.svg',
  'arte': '/Logos/artetv.svg',
  'netzkino': '/Logos/netzkino.svg',
  'freevee': '/Logos/freevee.svg',
  'hulu': '/Logos/hulu.svg',
};

const ORDER = [
  'netflix','amazon prime video','prime video channels','disney plus','wow',
  'rtl+','joyn','apple tv+','paramount+','crunchyroll',
  'mubi','ard','zdf','arte','netzkino','freevee','hulu'
];

/** ErrorBoundary */
class WatchlistErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) { console.error('Watchlist crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 border rounded bg-rose-50 text-rose-900">
          <div className="font-semibold mb-1">Watchlist-Fehler</div>
          <div className="text-sm">Details: {String(this.state.error?.message || this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** LocalStorage-Array (selbstheilend) */
function useLocalStorageArray<T>(key: string) {
  const read = (): T[] => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) return parsed as T[];
      localStorage.setItem(key, JSON.stringify([]));
      return [];
    } catch {
      localStorage.setItem(key, JSON.stringify([]));
      return [];
    }
  };
  const [value, setValue] = useState<T[]>(read);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : [])); } catch {}
  }, [key, value]);

  const setSafe: React.Dispatch<React.SetStateAction<T[]>> = (updater) => {
    setValue(prev => {
      const base = Array.isArray(prev) ? prev : [];
      const next = typeof updater === 'function' ? (updater as any)(base) : updater;
      return Array.isArray(next) ? next : [];
    });
  };

  return [Array.isArray(value) ? value : [], setSafe] as const;
}

/* ===== Optionale Helfer für IMDb & werstreamt.es =====
   - IMDb via OMDb: speichere einen OMDb-API-Key in localStorage('OMDB_API_KEY'), dann ziehen wir x/10.
   - werstreamt.es/JustWatch: lokaler Proxy /api/wse liefert { providers: string[] } und wird gemerged.
*/
async function tryFetchImdbRating(tmdbApiKey: string, type: TmdbType, id: number): Promise<number | null> {
  try {
    const ext = await fetch(`https://api.themoviedb.org/3/${type}/${id}/external_ids?api_key=${tmdbApiKey}`).then(r=>r.json());
    const imdbId = ext?.imdb_id;
    const omdbKey = localStorage.getItem('OMDB_API_KEY');
    if (!imdbId || !omdbKey) return null;
    const omdb = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}`).then(r=>r.json());
    const ratingStr = omdb?.imdbRating;
    const val = Number(ratingStr);
    return Number.isFinite(val) ? val : null;
  } catch { return null; }
}

async function tryFetchWseProviders(type: TmdbType, tmdbId: number, title: string, year?: number) {
  try {
    const u = new URL('/api/wse', window.location.origin);
    u.searchParams.set('type', type === 'movie' ? 'movie' : 'tv');
    u.searchParams.set('tmdbId', String(tmdbId)); // optional
    u.searchParams.set('title', title);
    if (year) u.searchParams.set('year', String(year));
    const res = await fetch(u.toString(), { method: 'GET' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.providers) ? data.providers : [];
  } catch {
    return [];
  }
}

type Props = { tmdbApiKey: string; onRequestOpenSettings: () => void; };

export default function WatchlistView({ tmdbApiKey, onRequestOpenSettings }: Props) {
  return (
    <WatchlistErrorBoundary>
      <WatchlistInner tmdbApiKey={tmdbApiKey} onRequestOpenSettings={onRequestOpenSettings} />
    </WatchlistErrorBoundary>
  );
}

function WatchlistInner({ tmdbApiKey, onRequestOpenSettings }: Props) {
  const [tab, setTab] = useState<WatchTabs>('movies');
  const [items, setItems] = useLocalStorageArray<WatchItem>(WATCHLIST_KEY);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [genreFilter, setGenreFilter] = useState<string>('Alle');
  const [sortBy, setSortBy] = useState<'title' | 'year' | 'genre'>('title');
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const hasKey = !!tmdbApiKey;

  // einmalig sanieren
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) localStorage.setItem(WATCHLIST_KEY, JSON.stringify([]));
    } catch { localStorage.setItem(WATCHLIST_KEY, JSON.stringify([])); }
  }, []);

  const safeItems = Array.isArray(items) ? items : [];

  // Zähler – Basis-Tabs exklusiv (kein started/watched/rewatch)
  const counts = useMemo(() => {
    const base = (f: (i: WatchItem)=>boolean) => safeItems.filter(f).length;
    return {
      movies:    base(i => i.type==='movie' && !i.isAnime && !i.started && !i.watched && !i.rewatch),
      series:    base(i => i.type==='tv'    && !i.isAnime && !i.started && !i.watched && !i.rewatch),
      anime:     base(i => i.type==='tv'    &&  i.isAnime && !i.started && !i.watched && !i.rewatch),
      started:   base(i => i.started && !i.watched),
      rewatch:   base(i => !!i.rewatch),
      watched:   base(i => i.watched),
      favorites: base(i => i.favorite && !i.started && !i.watched && !i.rewatch),
    };
  }, [safeItems]);

  const genresAvailable = useMemo(() => {
    const baseClean = (arr: WatchItem[]) => arr.filter(i => !i.started && !i.watched && !i.rewatch);
    const pool =
      tab === 'movies'    ? baseClean(safeItems.filter(i => i.type === 'movie' && !i.isAnime))
    : tab === 'series'    ? baseClean(safeItems.filter(i => i.type === 'tv'    && !i.isAnime))
    : tab === 'anime'     ? baseClean(safeItems.filter(i => i.type === 'tv'    &&  i.isAnime))
    : tab === 'started'   ? safeItems.filter(i => i.started && !i.watched)
    : tab === 'rewatch'   ? safeItems.filter(i => i.rewatch)
    : tab === 'watched'   ? safeItems.filter(i => i.watched)
    :                        baseClean(safeItems.filter(i => i.favorite));
    const set = new Set<string>();
    pool.forEach(i => i.genres?.forEach(g => set.add(g)));
    return ['Alle', ...Array.from(set).sort()];
  }, [safeItems, tab]);

  async function runSearch() {
    if (!hasKey || !query.trim()) return;
    setSearching(true); setResults([]);
    try {
      const t: TmdbType = (tab === 'movies') ? 'movie' : 'tv';
      const raw = await tmdbSearch(tmdbApiKey, t, query.trim(), 'de-DE');
      setResults(Array.isArray(raw) ? raw.slice(0, 18) : []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addFromResult(r: any, forceAnime = false) {
    try {
      const type: TmdbType = (tab === 'movies') ? 'movie' : 'tv';
      const id: number = r.id;
      const details = await tmdbDetails(tmdbApiKey, type, id, 'de-DE');
      const providers = await tmdbProviders(tmdbApiKey, type, id, 'DE');

      const title = (details.title || details.name || r.title || r.name) as string;
      const yearStr = (details.release_date || details.first_air_date || '').slice(0, 4) || undefined;
      const year = yearStr ? Number(yearStr) : undefined;

      // optional werstreamt.es Merge (Titel+Jahr)
      const wse = await tryFetchWseProviders(type, id, title, year);

      const country = (details.origin_country?.[0] || details.production_countries?.[0]?.iso_3166_1) || undefined;
      const poster = TMDB_IMG(details.poster_path || r.poster_path, 'w342');
      const overview = trimSentences(details.overview || r.overview || '');
      const genres = (details.genres || []).map((g: any) => g.name).slice(0, 6);

      // Laufzeit / Staffeln
      let runtime: number | undefined;
      let seasons: number | undefined;
      let episodes: number | undefined;
      if (type === 'movie') runtime = details.runtime || undefined;
      else { seasons = details.number_of_seasons ?? undefined; episodes = details.number_of_episodes ?? undefined; }

      const anime = (type === 'tv') && (forceAnime || isAnimeTV(details));

      // Rating: zuerst IMDb (wenn OMDb-Key), sonst TMDB
      let rating: number | undefined;
      let ratingSource: 'tmdb' | 'imdb' = 'tmdb';
      const imdb = await tryFetchImdbRating(tmdbApiKey, type, id);
      if (imdb && Number.isFinite(imdb)) { rating = imdb; ratingSource = 'imdb'; }
      else if (typeof details.vote_average === 'number') { rating = Number(details.vote_average.toFixed(1)); }

      const item: WatchItem = {
        id: `${type}:${id}`,
        tmdbId: id,
        type,
        isAnime: anime || undefined,
        title,
        year,
        country,
        genres,
        overview,
        poster,
        runtime,
        seasons,
        episodes,
        providers: orderProviders(providers, wse),
        rating,
        ratingSource,
        favorite: false,
        started: false,
        rewatch: false,
        watched: false,
        addedAt: new Date().toISOString(),
      };

      setItems(prev => (Array.isArray(prev) && !prev.some(x => x.id === item.id)) ? [item, ...prev] : Array.isArray(prev) ? prev : [item]);
      setQuery(''); setResults([]);
    } catch (e) {
      console.error(e);
      alert('Hinzufügen fehlgeschlagen (TMDB).');
    }
  }

  function orderProviders(list: { name: string; logo?: string }[], wseNames: string[]) {
    const mergeNames = Array.isArray(wseNames) ? wseNames : [];
    const normalized = [
      ...(Array.isArray(list) ? list.map(p => ({ name: p.name, _canon: PROVIDER_ALIASES_LOWER[CANON(p.name)] || CANON(p.name) })) : []),
      ...mergeNames.map(n => ({ name: n, _canon: PROVIDER_ALIASES_LOWER[CANON(n)] || CANON(n) }))
    ]
      .filter(p => WL_SET.has(p._canon));

    const byCanon = new Map<string, { name: string; _canon: string }>();
    for (const p of normalized) if (!byCanon.has(p._canon)) byCanon.set(p._canon, p);
    const uniq = Array.from(byCanon.values());

    const pref = uniq.filter(p => ORDER.includes(p._canon))
      .sort((a, b) => ORDER.indexOf(a._canon) - ORDER.indexOf(b._canon));
    const others = uniq.filter(p => !ORDER.includes(p._canon))
      .sort((a, b) => a._canon.localeCompare(b._canon));

    return [...pref, ...others].slice(0, 8).map(p => ({
      name: p.name,
      logo: LOGO[p._canon] || undefined,
    }));
  }

  const currentList = useMemo(() => {
    const baseClean = (arr: WatchItem[]) => arr.filter(i => !i.started && !i.watched && !i.rewatch);
    let pool: WatchItem[] =
      tab === 'movies'    ? baseClean(safeItems.filter(i => i.type === 'movie' && !i.isAnime))
    : tab === 'series'    ? baseClean(safeItems.filter(i => i.type === 'tv'    && !i.isAnime))
    : tab === 'anime'     ? baseClean(safeItems.filter(i => i.type === 'tv'    &&  i.isAnime))
    : tab === 'started'   ? safeItems.filter(i => i.started && !i.watched)
    : tab === 'rewatch'   ? safeItems.filter(i => i.rewatch)
    : tab === 'watched'   ? safeItems.filter(i => i.watched)
    :                        baseClean(safeItems.filter(i => i.favorite));

    if (genreFilter !== 'Alle') pool = pool.filter(i => i.genres?.includes(genreFilter));
    if (sortBy === 'title') pool = pool.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'year')  pool = pool.slice().sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    if (sortBy === 'genre') pool = pool.slice().sort((a, b) => ((a.genres?.[0] || '').localeCompare(b.genres?.[0] || '')));
    return pool;
  }, [safeItems, tab, genreFilter, sortBy]);

  function toggleFav(id: string) {
    setItems(prev => (Array.isArray(prev)
      ? prev.map(it => it.id === id ? ({ ...it, favorite: !it.favorite }) : it)
      : []));
  }
  function toggleStarted(id: string) {
    setItems(prev => (Array.isArray(prev)
      ? prev.map(it => it.id === id ? ({ ...it, started: !it.started, ...(it.watched ? { watched: false } : {}) }) : it)
      : []));
  }
  function toggleRewatch(id: string) {
    setItems(prev => (Array.isArray(prev)
      ? prev.map(it => it.id === id ? ({ ...it, rewatch: !it.rewatch }) : it)
      : []));
  }
  function toggleWatched(id: string) {
    setItems(prev => (Array.isArray(prev)
      ? prev.map(it => it.id === id ? ({ ...it, watched: !it.watched, ...(it.watched ? {} : { started: false }) }) : it)
      : []));
  }
  function removeItem(id: string) {
    setItems(prev => (Array.isArray(prev) ? prev.filter(it => it.id !== id) : []));
  }

  // Tab-Buttons – Tab-Wechsel leert die Suchergebnisse
  const onTab = (key: WatchTabs) => { setTab(key); setResults([]); };

  const TabBtn = (key: WatchTabs, label: string, count: number, Icon: any) => (
    <button
      onClick={() => onTab(key)}
      className={`px-3 py-1.5 rounded border ${tab === key ? 'bg-pink-100 border-pink-300' : 'bg-white hover:bg-gray-50'} flex items-center gap-2`}
      title={label}
    >
      <Icon size={16} />
      <span className="font-medium">{label}</span>
      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{count}</span>
    </button>
  );

  const FavTabBtn = (count: number) => (
    <button
      onClick={() => onTab('favorites')}
      className={`px-2.5 py-1.5 rounded border ${tab === 'favorites' ? 'bg-pink-100 border-pink-300' : 'bg-white hover:bg-gray-50'} flex items-center gap-1`}
      title="Favoriten"
      aria-label="Favoriten"
    >
      <Heart size={16} className="text-black" />
      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{count}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Kopfzeile */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {TabBtn('movies', 'Filme', counts.movies, Film)}
          {TabBtn('series', 'Serien', counts.series, TvMinimalPlay)}
          {TabBtn('anime', 'Anime', counts.anime, Clapperboard)}
          {TabBtn('started', 'Unbeendet', counts.started, Pause)}
          {TabBtn('rewatch', 'Rewatch', counts.rewatch, RotateCcw)}
          {TabBtn('watched', 'Gesehen', counts.watched, Eye)}
          {FavTabBtn(counts.favorites)}
        </div>

        {!hasKey && (
          <button
            className="text-xs px-2 py-1 rounded bg-amber-100 border border-amber-300 text-amber-900"
            onClick={onRequestOpenSettings}
            title="TMDB API Key in den Einstellungen hinterlegen"
          >
            <Info size={14} className="inline mr-1" /> TMDB API Key fehlt – hier klicken
          </button>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Genre:</label>
          <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
            {genresAvailable.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <label className="text-sm text-gray-600 ml-3">Sortieren:</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
            <option value="title">Alphabetisch</option>
            <option value="year">Jahr</option>
            <option value="genre">Genre</option>
          </select>
        </div>
      </div>

      {/* Suche */}
      <div className="flex items-center gap-2 mb-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
          placeholder={tab === 'movies' ? 'Film suchen…' : 'Serie/Anime suchen…'}
          className="flex-1 border rounded px-3 py-2"
        />
        <button onClick={runSearch} disabled={!hasKey || searching} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 border">
          Suchen
        </button>
      </div>

      {/* SUCHERGEBNISSE – Kachel-Layout, gleichmäßige Ränder */}
      {results.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map(r => {
              const poster = TMDB_IMG(r.poster_path, 'w342');
              const title = r.title || r.name;
              const year = (r.release_date || r.first_air_date || '').slice(0, 4);
              return (
                <div
                  key={r.id}
                  className="relative rounded-xl bg-white border shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden"
                  onClick={() => addFromResult(r, tab === 'anime')}
                  title="Zur Watchlist hinzufügen"
                >
                  <div className="p-3 bg-white">
                    {poster
                      ? <img src={poster} alt={title} className="w-full h-auto rounded-md" />
                      : <div className="h-72 w-full grid place-items-center text-gray-400">kein Cover</div>}
                  </div>
                  <button
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1 border"
                    onClick={(e) => { e.stopPropagation(); addFromResult(r, tab === 'anime'); }}
                    title="Hinzufügen"
                  >
                    <Plus size={16} />
                  </button>
                  <div className="px-3 pb-3">
                    <div className="text-sm font-medium truncate">{title}</div>
                    <div className="text-xs text-gray-500">{year || '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LISTE – Karten mit Buttons unten bündig */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 overflow-auto">
        {currentList.map(item => {
          const inStartedTab = tab === 'started';
          const inRewatchTab = tab === 'rewatch';
          const inWatchedTab = tab === 'watched';
          return (
            <div key={item.id} className="border rounded bg-white p-2 flex gap-4 items-start">
              {/* Cover */}
              <div
                className="w-40 md:w-44 h-56 md:h-64 relative cursor-zoom-in flex-shrink-0"
                onClick={() => item.poster && setPreview({ url: item.poster!, title: item.title })}
                title="Cover vergrößern"
              >
                {item.poster
                  ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover rounded" />
                  : <div className="w-full h-full bg-gray-100 grid place-items-center text-gray-400 rounded">kein Cover</div>}
              </div>

              {/* Content → Grid (oben Info, Mitte Text, unten Buttons) */}
              <div className="min-w-0 flex-1 grid" style={{ gridTemplateRows: 'auto 1fr auto', minHeight: '16rem' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold leading-tight truncate">{item.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                      <span>{(item.year ?? '—')}{item.country ? ` · ${item.country}` : ''} · {item.type === 'movie'
                        ? (item.runtime ? `${item.runtime} Min.` : '—')
                        : ((item.seasons || item.episodes) ? `${item.seasons ?? '—'} Staffeln, ${item.episodes ?? '—'} Folgen` : '—')}</span>
                      {/* Bewertung */}
                      <span className="ml-2 text-[11px] text-gray-600">
                        {typeof item.rating === 'number' ? `★ ${item.rating.toFixed(1)}/10` : '★ —/10'}
                      </span>
                    </div>
                  </div>
                  <button
                    className="bg-white hover:bg-gray-50 rounded border p-1"
                    onClick={() => toggleFav(item.id)}
                    title={item.favorite ? 'Von Favoriten entfernen' : 'Zu Favoriten'}
                  >
                    <Heart
                      size={16}
                      className={item.favorite ? 'text-rose-600' : 'text-gray-600'}
                      {...(item.favorite ? { fill: 'currentColor' } : {})}
                    />
                  </button>
                </div>

                {/* Beschreibung */}
                <div
                  className="text-[11px] text-gray-600 mt-1"
                  style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  title={item.overview || ''}
                >
                  {item.overview || '—'}
                </div>

                {/* Genres + Provider mit Abstand */}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {item.genres?.slice(0, 4).map(g => (
                      <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border">{g}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {item.providers && item.providers.length > 0 ? (
                      item.providers.slice(0, 6).map(p => (
                        p.logo
                          ? <img key={p.name} src={p.logo} alt={p.name} title={p.name} className="h-10" />
                          : <span key={p.name} className="text-[10px] bg-gray-100 px-1 rounded border" title={p.name}>{p.name}</span>
                      ))
                    ) : <span className="text-[10px] text-gray-400">keine Streaming-Infos</span>}
                  </div>
                </div>

                {/* Aktionen unten */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!inWatchedTab && (
                      <>
                        {!inStartedTab && (
                          <button
                            className={`text-xs px-2 py-1 rounded border ${item.started && !item.watched ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:bg-gray-50'}`}
                            onClick={() => toggleStarted(item.id)}
                            title="Als angefangen/pausiert markieren"
                          >
                            <Pause size={14} className="inline mr-1" />
                            {item.started && !item.watched ? 'Unbeendet' : 'Angefangen'}
                          </button>
                        )}

                        <button
                          className={`text-xs px-2 py-1 rounded border ${item.rewatch ? 'bg-violet-50 border-violet-300' : 'bg-white hover:bg-gray-50'}`}
                          onClick={() => toggleRewatch(item.id)}
                          title="Nochmal ansehen"
                        >
                          <RotateCcw size={14} className="inline mr-1" />
                          {item.rewatch ? 'Rewatch' : 'Nochmal ansehen'}
                        </button>

                        <button
                          className={`text-xs px-2 py-1 rounded border ${item.watched ? 'bg-indigo-50 border-indigo-300' : 'bg-white hover:bg-gray-50'}`}
                          onClick={() => toggleWatched(item.id)}
                          title="Als gesehen markieren/entfernen"
                        >
                          <Eye size={14} className="inline mr-1" />
                          Gesehen
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    className="text-xs p-1 rounded border bg-white hover:bg-gray-50 text-rose-700 border-rose-300"
                    onClick={() => removeItem(item.id)}
                    title="Löschen"
                    aria-label="Eintrag löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {currentList.length === 0 && (
          <div className="text-sm text-gray-500">Noch keine Einträge.</div>
        )}
      </div>

      {/* Poster-Preview */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 z-[9999] grid place-items-center p-4" onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.title} className="max-h-[85vh] max-w-[85vw] object-contain rounded shadow-2xl" />
        </div>
      )}
    </div>
  );
}
