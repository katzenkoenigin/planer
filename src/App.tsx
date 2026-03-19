// ============================
// SECTION 1: Imports
// ============================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings, Save, ListTodo, Sun, Star, ShoppingBasket, Award, Clock, AlarmClock, Sticker, Trash2, Bell,
  ChevronLeft, ChevronRight, Droplet, DropletOff, HandCoins, Download, Check, Send, Filter, Eye, Tv // <- Tv hinzugefügt
} from 'lucide-react';
import UpcomingModal from './components/UpcomingModal';
import type { UpcomingEvent, UpcomingCategory } from './components/UpcomingModal';
import ShoppingListModal from './components/ShoppingListModal';
import DoneModal from './components/DoneModal';
import OffersModal from './components/OffersModal';
import WatchlistView from './components/WatchlistView';

/* Wetter */
import {
  geocodeCity,
  fetchForecast,
  baseWeatherIconTitle,
  alertIcons,
  type WeatherByDate
} from './utils/weather';


// ============================
// SECTION 2: LocalStorage Hook & Types
// ============================
function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
      const parsed = JSON.parse(raw);
      const init = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
      if (Array.isArray(init)) return Array.isArray(parsed) ? (parsed as T) : init;
      if (typeof init === 'object' && init !== null) return parsed && typeof parsed === 'object' ? (parsed as T) : init;
      return (parsed as T) ?? init;
    } catch {
      return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    }
  };
  const [state, setState] = useState<T>(read);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState] as const;
}

interface PositionedSticker { src: string; x: number; y: number; }
interface CalendarItem { text: string; done: boolean; time?: string; reminder?: boolean; doneAt?: string; tag?: 'todo'|'positive'; }
interface CalendarReminder { icon: string; tooltip: string; color: string; }
interface CalendarCell { date: string; isoDate?: string; items: CalendarItem[]; stickers: PositionedSticker[]; reminders: CalendarReminder[]; }


// ============================
// SECTION 3: Design, Helpers, Keys
// ============================
const reminderIcons: CalendarReminder[] = [
  { tooltip: 'Blaue Tonne rausstellen', icon: 'trash-blue', color: '#4969B6' },
  { tooltip: 'Gelbe Tonne rausstellen', icon: 'trash-yellow', color: '#D1B93B' },
  { tooltip: 'Grüne Tonne rausstellen', icon: 'trash-green', color: '#619E5A' },
  { tooltip: 'Schwarze Tonne rausstellen', icon: 'trash-black', color: '#212526' },
  { tooltip: 'Erdbeerwoche (Beginn)', icon: 'droplet', color: 'magenta' },
  { tooltip: 'Erdbeerwoche (Ende)', icon: 'dropletoff', color: 'cyan' },
];

const designConfigs = {
  hearty: { name: 'Hearty', headerImage: '/Hearty rose.png', backgroundColor: '#edcde2', week2Color: '#c67c9f', week4Color: '#bb9fe1' },
  doggo:  { name: 'Doggo',  headerImage: '/Doggo.png',       backgroundColor: '#fef8f2', week2Color: '#d3885f', week4Color: '#c67c9f' },
  purple: { name: 'Lila',   headerImage: '/Header_purple.png', backgroundColor: '#d3cfff', week2Color: '#a78bfa', week4Color: '#bb9fe1' },
};
type DesignKey = keyof typeof designConfigs;


const getMonday = (date: Date): Date => { const d = new Date(date); const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day; d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtISO = (d: Date) => d.toISOString().slice(0,10);
const formatLabelDE = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });

const getDateKey = (monday: Date) => monday.toISOString().slice(0, 10);
const storageKeyUnified = (monday: Date) => `KW_${getDateKey(monday)}`;
const storageKeyLegacy = (monday: Date, weeks: number) => `KW_${getDateKey(monday)}_${weeks}`;
const isValidWeek = (monday: Date): boolean => new Date(monday) >= new Date('2025-04-28T00:00:00');
const generateDateInfos = (monday: Date, weeks: number) =>
  Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return { date: d, iso: d.toISOString().slice(0,10), label: formatLabelDE(d) }; });

const TODO_KEY = 'SIDEBAR_TODO_V1';
const ACTIVITIES_KEY = 'SIDEBAR_ACTIVITIES_V1';
const ACTIVITIES_LEGACY_KEYS = ['SIDEBAR_ACTIVITIES','PositiveActivities','ACTIVITIES'];
const STICKERS_PRIMARY_KEY = 'SIDEBAR_STICKERS_V1';
const STICKERS_LEGACY_KEYS = ['SIDEBAR_STICKERS','customStickers','STICKERS'];
const SHOPPING_KEY = 'SHOPPING_LIST_V1';
const DISCORD_WEBHOOK_KEY = 'DISCORD_WEBHOOK_URL';
const BOT_ENDPOINT_KEY = 'DISCORD_BOT_ENDPOINT';
const BOT_SECRET_KEY = 'DISCORD_BOT_SHARED_SECRET';
const DM_USER_IDS_KEY = 'DISCORD_DM_USER_IDS';
const YEAR_FILTERS_KEY = 'YEAR_VIEW_FILTERS_V2';
const UPCOMING_KEYS = ['UPCOMING_EVENTS_V2', 'UPCOMING_EVENTS_V1', 'upcomingEvents_v1'];

const WEATHER_CACHE_KEY = 'WEATHER_CACHE_V2';
const WEATHER_CITY_KEY  = 'WEATHER_CITY_V1';
const WEATHER_COORD_KEY = 'WEATHER_COORD_V1';
const WEATHER_ENABLED_KEY = 'WEATHER_ENABLED_V1';

const TMDB_API_KEY_KEY = 'TMDB_API_KEY';

const DESIGN_KEY = 'PLANNER_DESIGN_V1';


// ============================
// SECTION 4: Upcoming Kategorien
// ============================
export type Cat = UpcomingCategory;
const CAT_LABEL: Record<Cat,string> = {
  birthday:'Geburtstag', doctor:'Arzttermin', important:'Wichtiger Termin', holiday:'Feiertag', work:'Arbeit',
  gameRelease:'Game-Release', gaming:'Gaming', cinemaRelease:'Kino-Release', seriesRelease:'Serien-Release', other:'Sonstiges'
};
const CAT_EMOJI: Record<Cat,string> = {
  birthday:'🎂', doctor:'🩺', important:'📌', holiday:'🎉', work:'💼',
  gameRelease:'🕹️', gaming:'🎮', cinemaRelease:'🎬', seriesRelease:'📺', other:'⭐'
};
const emojiForEvent = (ev: UpcomingEvent) =>
  ev.iconOverride?.type === 'emoji' ? ev.iconOverride.value : CAT_EMOJI[ev.category ?? 'other'];


// ============================
// SECTION 5: App-Komponente – State & Migration
// ============================
type GlobalView = 'weeks' | '3m' | '6m' | '12m' | 'watchlist';

const App: React.FC = () => {
  const [mode, setMode] = useState<GlobalView>('weeks');
  const [weeks, setWeeks] = useState(2);
  const [startMonday, setStartMonday] = useState(getMonday(new Date()));
  const [cells, setCells] = useState<CalendarCell[]>([]);
  const [dragItem, setDragItem] = useState<any>(null);
  const [dragType, setDragType] = useState<'text'|'sticker'|'reminder'|null>(null);
  const [draggingSticker, setDraggingSticker] = useState<{ cellIndex: number; stickerIndex: number } | null>(null);

  const [todoList, setTodoList] = useState<string[]>(['Einkaufen', 'Zahnarzt anrufen', 'Kitty füttern']);
  const [newTodo, setNewTodo] = useState('');
  const [activityList, setActivityList] = useLocalStorageState<string[]>(ACTIVITIES_KEY, getInitialActivities);
  const [newActivity, setNewActivity] = useState('');

  const [todoCollapsed, setTodoCollapsed] = useState(true);
  const [activitiesCollapsed, setActivitiesCollapsed] = useState(true);
  const [remindersCollapsed, setRemindersCollapsed] = useState(true);
  const [upcomingCollapsed, setUpcomingCollapsed] = useState(true);
  const [shoppingCollapsed, setShoppingCollapsed] = useState(true);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [stickersCollapsed, setStickersCollapsed] = useState(true);

  const [discordUsers, setDiscordUsers] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useLocalStorageState<string>(DISCORD_WEBHOOK_KEY, '');
  const [botEndpoint, setBotEndpoint] = useLocalStorageState<string>(BOT_ENDPOINT_KEY, '');
  const [botSecret, setBotSecret] = useLocalStorageState<string>(BOT_SECRET_KEY, '');
  const [dmUserIds, setDmUserIds] = useLocalStorageState<string>(DM_USER_IDS_KEY, '');
  const dmUserIdList = useMemo(() => dmUserIds.split(',').map(s => s.trim()).filter(Boolean), [dmUserIds]);

  const [design, setDesign] = useLocalStorageState<DesignKey>(DESIGN_KEY, 'hearty');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [timePickerOpen, setTimePickerOpen] = useState<{ i: number; j: number } | null>(null);
  const timePickerRef = useRef<HTMLInputElement | null>(null);

  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const [filterPos, setFilterPos] = useState<{top:number;left:number} | null>(null);

  // Wetter
  const [weatherCity, setWeatherCity] = useLocalStorageState<string>(WEATHER_CITY_KEY, 'Berlin');
  const [weatherCoord, setWeatherCoord] = useLocalStorageState<{lat:number; lon:number} | null>(WEATHER_COORD_KEY, null);
  const [weatherByDate, setWeatherByDate] = useState<WeatherByDate>({});
  const [weatherEnabled, setWeatherEnabled] = useLocalStorageState<boolean>(WEATHER_ENABLED_KEY, true);

  // TMDB
  const [tmdbApiKey, setTmdbApiKey] = useLocalStorageState<string>(TMDB_API_KEY_KEY, '');


  // ============================
  // SECTION 6: Initial-Lader & Migrationen
  // ============================
  function getInitialActivities(): string[] {
    try {
      const primary = localStorage.getItem(ACTIVITIES_KEY);
      if (primary) { const arr = JSON.parse(primary); if (Array.isArray(arr)) return arr; }
      for (const k of ACTIVITIES_LEGACY_KEYS) {
        const raw = localStorage.getItem(k); if (!raw) continue;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.every((x:any)=>typeof x==='string')) {
            localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(arr));
            for (const kk of ACTIVITIES_LEGACY_KEYS) localStorage.removeItem(kk);
            return arr;
          }
        } catch {}
      }
    } catch {}
    return ['Fossilien suchen','Museum','Ins Kino gehen'];
  }

  const migrateUpcoming = (arr: any[]): UpcomingEvent[] => {
    const oldToNew: Record<string, UpcomingCategory> = {
      birthday:'birthday', cinema:'cinemaRelease', gaming:'gaming', season:'gameRelease',
      doctor:'doctor', business:'work', streaming:'seriesRelease', other:'other'
    };
    return (arr||[]).map((e:any) => {
      if (e && typeof e === 'object') {
        if ('category' in e) return e as UpcomingEvent;
        if ('icon' in e) {
          const cat = oldToNew[e.icon] ?? 'other';
          return {
            id: String(e.id ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
            title: String(e.title ?? 'Unbenannt'),
            dateISO: String(e.dateISO ?? e.date ?? new Date().toISOString().slice(0,10)),
            reminderTime: e.reminderTime || undefined,
            category: cat,
            iconOverride: null
          } as UpcomingEvent;
        }
      }
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        title: String(e?.title ?? 'Unbenannt'),
        dateISO: String(e?.dateISO ?? new Date().toISOString().slice(0,10)),
        category: 'other',
        iconOverride: null
      } as UpcomingEvent;
    });
  };

  const getInitialUpcoming = (): UpcomingEvent[] => {
    for (const key of UPCOMING_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const migrated = migrateUpcoming(parsed);
          localStorage.setItem(UPCOMING_KEYS[0], JSON.stringify(migrated));
          if (key !== UPCOMING_KEYS[0]) localStorage.removeItem(key);
          return migrated;
        }
      } catch {}
    }
    return [];
  };

  const [upcoming, setUpcoming] = useLocalStorageState<UpcomingEvent[]>(UPCOMING_KEYS[0], getInitialUpcoming);

  function getInitialStickers(): string[] {
    try {
      const primary = localStorage.getItem(STICKERS_PRIMARY_KEY);
      if (primary) { const arr = JSON.parse(primary); if (Array.isArray(arr)) { for (const k of STICKERS_LEGACY_KEYS) localStorage.removeItem(k); return arr; } }
      for (const k of STICKERS_LEGACY_KEYS) {
        const raw = localStorage.getItem(k); if (!raw) continue;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.every((x:any)=>typeof x==='string')) {
            localStorage.setItem(STICKERS_PRIMARY_KEY, JSON.stringify(arr));
            for (const kk of STICKERS_LEGACY_KEYS) localStorage.removeItem(kk);
            return arr;
          }
        } catch {}
      }
    } catch {}
    return [];
  }
  const [customStickers, setCustomStickers] = useLocalStorageState<string[]>(STICKERS_PRIMARY_KEY, getInitialStickers);
  const [shoppingList, setShoppingList] = useLocalStorageState<string[]>(SHOPPING_KEY, []);

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });

  type CellMap = Record<string, CalendarCell>;
  const readUnifiedMap = (monday: Date): CellMap | null => {
    const raw = localStorage.getItem(storageKeyUnified(monday)); if (!raw) return null;
    try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') return parsed as CellMap; } catch {}
    return null;
  };
  const readAndMigrateLegacy = (monday: Date): CellMap | null => {
    const raw4 = localStorage.getItem(storageKeyLegacy(monday, 4));
    const raw2 = localStorage.getItem(storageKeyLegacy(monday, 2));
    if (!raw4 && !raw2) return null;
    let arr: CalendarCell[] | null = null; let lengthWeeks = 0;
    try { if (raw4) { const p = JSON.parse(raw4); if (Array.isArray(p)) { arr = p; lengthWeeks = 4; } }
          if (!arr && raw2) { const p = JSON.parse(raw2); if (Array.isArray(p)) { arr = p; lengthWeeks = 2; } } } catch {}
    if (!arr) return null;
    const dateInfos = generateDateInfos(monday, lengthWeeks);
    const map: CellMap = {};
    for (let i = 0; i < Math.min(arr.length, dateInfos.length); i++) {
      const iso = dateInfos[i].iso; const label = dateInfos[i].label; const legacy = arr[i];
      map[iso] = { date: label, isoDate: iso, items: legacy.items ?? [], stickers: legacy.stickers ?? [], reminders: legacy.reminders ?? [] };
    }
    localStorage.setItem(storageKeyUnified(monday), JSON.stringify(map));
    localStorage.removeItem(storageKeyLegacy(monday, 2)); localStorage.removeItem(storageKeyLegacy(monday, 4));
    return map;
  };
  const getStorageMap = (monday: Date): CellMap => readUnifiedMap(monday) ?? readAndMigrateLegacy(monday) ?? {};
  const setStorageMap = (monday: Date, map: CellMap) => { localStorage.setItem(storageKeyUnified(monday), JSON.stringify(map)); };
  const ensureAndSelectCells = (monday: Date, weeksToShow: number): CalendarCell[] => {
    const dateInfos = generateDateInfos(monday, weeksToShow);
    const map = getStorageMap(monday);
    const ordered = dateInfos.map((info) => {
      if (!map[info.iso]) map[info.iso] = { date: info.label, isoDate: info.iso, items: [], stickers: [], reminders: [] };
      else { map[info.iso].date ||= info.label; map[info.iso].isoDate ||= info.iso; }
      return map[info.iso];
    });
    setStorageMap(monday, map);
    return ordered;
  };
  const mergeVisibleCellsIntoMap = (monday: Date, visibleCells: CalendarCell[]) => {
    const map = getStorageMap(monday);
    for (const c of visibleCells) { const iso = c.isoDate; if (!iso) continue; map[iso] = { ...map[iso], ...c, isoDate: iso }; }
    setStorageMap(monday, map);
  };

  useEffect(() => { if (!isValidWeek(startMonday)) { setCells([]); return; } setCells(ensureAndSelectCells(startMonday, weeks)); }, [startMonday, weeks]);
  useEffect(() => { mergeVisibleCellsIntoMap(startMonday, cells); }, [cells]); // eslint-disable-line

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) setTimePickerOpen(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { try { const raw = localStorage.getItem(TODO_KEY); if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setTodoList(p); } } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(TODO_KEY, JSON.stringify(todoList)); } catch {} }, [todoList]);


  // ============================
  // SECTION 7: Monats-/Jahres-Ansichten & Wetter
  // ============================
  type YearFilters = { categories: Record<Cat, boolean>; showTodos: boolean; showPositives: boolean; };
  const [yearFilters, setYearFilters] = useLocalStorageState<YearFilters>(YEAR_FILTERS_KEY, () => ({
    categories: {
      birthday:true, doctor:true, important:true, holiday:true, work:true,
      gameRelease:true, gaming:true, cinemaRelease:true, seriesRelease:true, other:true
    },
    showTodos: false, showPositives: false
  }));

  function monthIndexOf(year:number, month0:number){ return (year*12)+month0; }
  function makeMonthsAbs(startIndex:number, count:number) {
    const out: { year:number; month:number; label:string; days:{ ymd:string; d:number }[] }[] = [];
    for (let i=0;i<count;i++){
      const idx = startIndex + i;
      const y = Math.floor(idx/12);
      const m = ((idx%12)+12)%12;
      const first = new Date(y,m,1);
      const label = first.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
      const days: { ymd:string; d:number }[] = [];
      const last = new Date(y,m+1,0).getDate();
      for (let d=1; d<=last; d++){ const dt=new Date(y,m,d); days.push({ ymd: dt.toISOString().slice(0,10), d }); }
      out.push({ year:y, month:m, label, days });
    }
    return out;
  }
  function clampYear(y:number){ return Math.max(2024, y); }

  const now = new Date();
  const [year12, setYear12] = useState<number>(now.getFullYear());
  const [hyYear, setHyYear] = useState<number>(now.getFullYear());
  const [hyHalf, setHyHalf] = useState<1|2>(now.getMonth() < 6 ? 1 : 2);
  const [m3StartYear, setM3StartYear] = useState<number>(now.getFullYear());
  const [m3StartMonth0, setM3StartMonth0] = useState<number>(now.getMonth());

  const monthsForView = useMemo(() => {
    if (mode === '12m') return makeMonthsAbs(monthIndexOf(year12, 0), 12);
    if (mode === '6m')  return makeMonthsAbs(monthIndexOf(hyYear, hyHalf===1 ? 0 : 6), 6);
    if (mode === '3m')  return makeMonthsAbs(monthIndexOf(m3StartYear, m3StartMonth0), 3);
    return [];
  }, [mode, year12, hyYear, hyHalf, m3StartYear, m3StartMonth0]);

  function prevPeriod(){
    if (mode === 'weeks') { const d = new Date(startMonday); d.setDate(d.getDate() - weeks * 7); setStartMonday(d); return; }
    if (mode === '12m') { setYear12(y => clampYear(y-1)); return; }
    if (mode === '6m') {
      setHyYear((y)=>{ let ny=y; let nh=hyHalf;
        if (hyHalf===1){ if (y>2024){ ny=y-1; nh=2; } }
        else { nh=1; }
        setHyHalf(nh); return clampYear(ny);
      }); return;
    }
    if (mode === '3m') {
      const idx = monthIndexOf(m3StartYear, m3StartMonth0) - 1;
      const ny = Math.max(2024, Math.floor(idx/12));
      const nm = idx - ny*12;
      if (monthIndexOf(ny, nm) < monthIndexOf(2024, 0)) return;
      setM3StartYear(ny); setM3StartMonth0(nm); return;
    }
  }
  function nextPeriod(){
    if (mode === 'weeks') { const d = new Date(startMonday); d.setDate(d.getDate() + weeks * 7); setStartMonday(d); return; }
    if (mode === '12m') { setYear12(y => y+1); return; }
    if (mode === '6m')  { if (hyHalf===1){ setHyHalf(2); } else { setHyHalf(1); setHyYear(y=>y+1); } return; }
    if (mode === '3m')  { const idx = monthIndexOf(m3StartYear, m3StartMonth0) + 1; setM3StartYear(Math.floor(idx/12)); setM3StartMonth0(((idx%12)+12)%12); return; }
  }

  const currentDesign = designConfigs[design];
  const VIEWPORT_OFFSET = 170;
  const gridHeight = `calc(100vh - ${VIEWPORT_OFFSET}px)`;
  const todayISO = new Date().toISOString().slice(0,10);
  const curY = new Date().getFullYear();
  const curM = new Date().getMonth();

// ============================
// SECTION 14: YearView – Monats-/Jahresansichten (fix)
// ============================

// Alt->Neu Mapping für alte LocalStorage-Einträge (falls "icon" noch verwendet wird)
const OLD_TO_NEW: Record<NonNullable<UpcomingEvent['icon']>, Cat> = {
  birthday: 'birthday',
  cinema: 'cinemaRelease',
  gaming: 'gaming',
  season: 'gameRelease',
  doctor: 'doctor',
  business: 'work',
  streaming: 'seriesRelease',
  other: 'other',
};

const eventCategory = (ev: UpcomingEvent): Cat =>
  (ev.category as Cat | undefined) ?? (ev.icon ? OLD_TO_NEW[ev.icon] : 'other');

// Kleine Hilfsfunktion: Events für einen Tag holen + nach Filtern sortieren
const getDayEvents = (iso: string) => {
  const list = (eventsByIso[iso] ?? []).filter((ev) => yearFilters.categories[eventCategory(ev)]);
  list.sort((a, b) => (a.reminderTime ?? '').localeCompare(b.reminderTime ?? ''));
  return list;
};

/**
 * Grid für 3/6/12 Monate.
 * Nutzt monthsForView (aus SECTION 7), todayISO/curY/curM (oben berechnet) und emojiForEvent().
 */
const YearView: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {monthsForView.map((m) => {
        const isCurrentMonth = m.year === curY && m.month === curM;
        return (
          <div key={`${m.year}-${m.month}`} className="border rounded-lg bg-white">
            {/* Monatskopf */}
            <div
              className={`px-3 py-2 border-b font-semibold ${
                isCurrentMonth ? 'bg-rose-100 shadow-sm' : 'bg-gray-50'
              }`}
            >
              {m.label}
            </div>

            {/* Monatstage */}
            <div className="p-3 grid grid-cols-7 gap-1 text-xs">
              {/* Wochentagsköpfe */}
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
                <div key={w} className="text-center text-[11px] text-gray-500">
                  {w}
                </div>
              ))}

              {/* Leere Felder vor dem 1. (Mo=1) */}
              {(() => {
                const weekDay = new Date(m.year, m.month, 1).getDay() || 7;
                return Array.from({ length: weekDay - 1 }).map((_, i) => <div key={`blank-${i}`} />);
              })()}

              {/* Tage */}
              {m.days.map((d) => {
                const evs = getDayEvents(d.ymd);
                const isToday = d.ymd === todayISO;
                return (
                  <div
                    key={d.ymd}
                    className={`min-h-[72px] border rounded p-1 ${
                      isToday ? 'ring-2 ring-rose-300 shadow-sm' : 'border-gray-200'
                    }`}
                  >
                    <div className="text-right text-[11px] text-gray-500">{d.d}</div>
                    <div className="space-y-0.5 mt-1">
                      {evs.slice(0, 3).map((ev) => (
                        <div key={ev.id} className="truncate">
                          <span className="mr-1">{emojiForEvent(ev)}</span>
                          <span className="font-medium">{ev.title}</span>
                          {ev.reminderTime ? (
                            <span className="text-gray-500">{' | '}{ev.reminderTime}</span>
                          ) : null}
                        </div>
                      ))}
                      {evs.length > 3 && (
                        <div className="text-[11px] text-gray-500">+ {evs.length - 3} mehr…</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};


  const eventsByIso = useMemo(() => {
    const map: Record<string, UpcomingEvent[]> = {};
    for (const ev of upcoming) { if (!map[ev.dateISO]) map[ev.dateISO] = []; map[ev.dateISO].push(ev); }
    for (const k of Object.keys(map)) map[k].sort((a,b)=> (a.reminderTime||'').localeCompare(b.reminderTime||'')); 
    return map;
  }, [upcoming]);

  const next10 = useMemo(
    () => upcoming.slice().sort((a,b)=> (a.dateISO + (a.reminderTime??'')).localeCompare(b.dateISO + (b.reminderTime??''))).slice(0,10),
    [upcoming]
  );

  function itemsForDayAll(ymd: string): CalendarItem[] {
    try {
      const d = new Date(ymd + 'T00:00:00');
      const monday = getMonday(d);
      const map = getStorageMap(monday);
      const cell = map[ymd];
      return Array.isArray(cell?.items) ? cell!.items : [];
    } catch { return []; }
  }

  const canScrollMonths = mode==='3m' || mode==='6m' || mode==='12m';

  // Wetter – 2 Wochen Fenster
  const twoWeekStart = getMonday(new Date());
  const twoWeekEnd = addDays(twoWeekStart, 13);
  const twoWeekStartISO = fmtISO(twoWeekStart);
  const twoWeekEndISO = fmtISO(twoWeekEnd);
  const twoWeekSet = useMemo(() => {
    const s = new Set<string>();
    for (let i=0;i<14;i++){ s.add(fmtISO(addDays(twoWeekStart, i))); }
    return s;
  }, [twoWeekStartISO]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.expires && parsed.expires > Date.now() && parsed?.byDate) {
        setWeatherByDate(parsed.byDate as WeatherByDate);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!weatherEnabled) return;
    if (weatherCoord) return;
    const setFallback = async () => {
      const g = await geocodeCity(weatherCity || 'Berlin');
      setWeatherCoord(g ? { lat: g.lat, lon: g.lon } : { lat: 52.52, lon: 13.405 });
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => setWeatherCoord({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        setFallback,
        { enableHighAccuracy: false, timeout: 4000 }
      );
    } else {
      setFallback();
    }
  }, [weatherEnabled]); // eslint-disable-line
  useEffect(() => {
    (async () => {
      if (!weatherEnabled) return;
      if (!weatherCoord) return;
      try {
        const byDate = await fetchForecast(weatherCoord.lat, weatherCoord.lon, twoWeekStartISO, twoWeekEndISO);
        setWeatherByDate(byDate);
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
          byDate, expires: Date.now() + 3 * 60 * 60 * 1000, lat: weatherCoord.lat, lon: weatherCoord.lon
        }));
      } catch {}
    })();
  }, [weatherEnabled, weatherCoord, twoWeekStartISO, twoWeekEndISO]);

  function WeatherBadge({ iso }: { iso?: string }) {
    if (!weatherEnabled) return null;
    if (!iso || !twoWeekSet.has(iso)) return null;
    const w = weatherByDate[iso];
    if (!w) return null;

    const base = baseWeatherIconTitle(w.code);
    const alerts = alertIcons(w).filter(a=>a.emoji!==base.emoji);

    return (
      <div className="flex items-center gap-[4px] text-xs leading-none">
        {alerts.map((a, i) => (
          <span key={i} title={a.title} className="text-sm">
            {a.emoji}
          </span>
        ))}
        <span className="text-sm" title={base.title}>{base.emoji}</span>
        <span className="text-gray-300 mx-[2px]">|</span>
        <span className="text-rose-600 font-semibold">{w.tmax}°</span>
        <span className="text-gray-300 mx-[2px]">|</span>
        <span className="text-sky-600 font-semibold">{w.tmin}°</span>
      </div>
    );
  }


  // ============================
  // SECTION 8: Header (Navigation)
  // ============================
  const recalcFilterPos = () => {
    const el = filterBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFilterPos({ top: r.bottom + 8, left: r.right - 620 });
  };
  useEffect(() => {
    if (!filterOpen) return;
    recalcFilterPos();
    const onScrollOrResize = () => recalcFilterPos();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [filterOpen]);

  function handleExport() {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        view: { mode, weeks, startMonday: getDateKey(startMonday) },
        cellsMap: getStorageMap(startMonday),
        todoList,
        activityList,
        shoppingList,
        upcoming,
        stickers: customStickers,
        design,
        yearFilters,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aktivitaetsplaner-${getDateKey(startMonday)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Export fehlgeschlagen.');
    }
  }


  // ============================
  // SECTION 9: Render – Header
  // ============================
  return (
    <div className="h-screen flex flex-col pl-5 relative" style={{ backgroundColor: currentDesign.backgroundColor }}>
      <header className="grid grid-cols-3 items-center px-4 h-[70px] pt-[10px] mb-2 relative">
        <div className="flex items-center gap-3">
          <img src={currentDesign.headerImage} alt="Header" className="h-full" />
        </div>

        <div className="flex justify-center items-center gap-2 relative">
          <button onClick={mode==='watchlist' ? undefined : (canScrollMonths ? prevPeriod : () => { const d = new Date(startMonday); d.setDate(d.getDate() - weeks * 7); setStartMonday(d); })} className={`p-1 rounded ${mode==='watchlist' ? 'opacity-30 cursor-default bg-gray-100' : 'bg-white'}`}><ChevronLeft size={18} /></button>

          <button onClick={()=>{ setMode('weeks'); setWeeks(2); }} className={`px-3 py-1 rounded ${mode==='weeks' && weeks===2 ? '' : 'bg-white'}`} style={{ backgroundColor: mode==='weeks' && weeks===2 ? designConfigs[design].week2Color : undefined }}>2 Wochen</button>
          <button onClick={()=>{ setMode('weeks'); setWeeks(4); }} className={`px-3 py-1 rounded ${mode==='weeks' && weeks===4 ? '' : 'bg-white'}`} style={{ backgroundColor: mode==='weeks' && weeks===4 ? designConfigs[design].week4Color : undefined }}>4 Wochen</button>
          <button onClick={()=> setMode('3m')} className={`px-3 py-1 rounded ${mode==='3m' ? '' : 'bg-white'}`} style={{ backgroundColor: mode==='3m' ? designConfigs[design].week2Color : undefined }}>3 Monate</button>
          <button onClick={()=> setMode('6m')} className={`px-3 py-1 rounded ${mode==='6m' ? '' : 'bg-white'}`} style={{ backgroundColor: mode==='6m' ? designConfigs[design].week2Color : undefined }}>6 Monate</button>
          <button onClick={()=> setMode('12m')} className={`px-3 py-1 rounded ${mode==='12m' ? '' : 'bg-white'}`} style={{ backgroundColor: mode==='12m' ? designConfigs[design].week4Color : undefined }}>Jahr</button>

          <button onClick={mode==='watchlist' ? undefined : (canScrollMonths ? nextPeriod : () => { const d = new Date(startMonday); d.setDate(d.getDate() + weeks * 7); setStartMonday(d); })} className={`p-1 rounded ${mode==='watchlist' ? 'opacity-30 cursor-default bg-gray-100' : 'bg-white'}`}><ChevronRight size={18} /></button>

          {(mode!=='weeks' && mode!=='watchlist') && (
            <button
              ref={filterBtnRef}
              onClick={()=> setFilterOpen(v=>!v)}
              className="p-2 rounded border bg-white ml-[50px]"
              style={{ color: designConfigs[design].week2Color, borderColor: designConfigs[design].week2Color }}
              title="Filter"
            >
              <Filter size={18}/>
            </button>
          )}
        </div>

        <div className="flex justify-end items-center gap-2">
          <button onClick={() => mergeVisibleCellsIntoMap(startMonday, cells)} className="p-2 rounded bg-white" title="Speichern"><Save size={18} /></button>
          <button onClick={handleExport} className="p-2 rounded bg-white" title="Exportieren"><Download size={18} /></button>
          <button onClick={() => setSettingsOpen((o) => !o)} className="p-2 rounded bg-white" title="Einstellungen"><Settings size={18} /></button>
        </div>
      </header>


      {/* ============================
          SECTION 10: Filter-Popup (Monats-/Jahresansicht)
      ============================ */}
      {filterOpen && filterPos && createPortal(
        <div className="fixed inset-0 z-[120]" onClick={()=>setFilterOpen(false)}>
          <div
            className="absolute w-[620px] bg-white rounded-lg shadow-lg border p-3"
            style={{ top: filterPos.top, left: Math.max(filterPos.left, 8) }}
            onClick={e=>e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold" style={{ color: designConfigs[design].week2Color }}>Filter</div>
              <button className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200" onClick={()=>setFilterOpen(false)}>Schließen</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(CAT_LABEL) as Cat[]).map((k)=>(
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={yearFilters.categories[k]}
                    onChange={e => setYearFilters((old:any)=>({
                      ...old,
                      categories: { ...old.categories, [k]: e.target.checked }
                    }))}
                  />
                  <span>{CAT_EMOJI[k]} {CAT_LABEL[k]}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={yearFilters.showTodos}
                      onChange={e=> setYearFilters((old:any)=>({ ...old, showTodos: e.target.checked }))} />
                To-Dos (aus Tageskästen)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={yearFilters.showPositives}
                      onChange={e=> setYearFilters((old:any)=>({ ...old, showPositives: e.target.checked }))} />
                Positive Aktivitäten (aus Tageskästen)
              </label>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* ============================
          SECTION 11: Main-Content (links) – Kalender ODER Watchlist
      ============================ */}
      <main className="flex flex-grow overflow-hidden">
        <div className="flex-grow overflow-auto p-4">
          {mode==='watchlist' ? (
            <WatchlistView
              tmdbApiKey={tmdbApiKey}
              onRequestOpenSettings={()=>setSettingsOpen(true)}
            />
          ) : mode==='weeks' ? (
            <div className={`grid grid-cols-7 ${weeks===2 ? 'grid-rows-2' : 'grid-rows-4'} gap-2.5`} style={{ height: gridHeight }}>
              {cells.map((cell, i) => {
                const todaysEvents = cell.isoDate ? (eventsByIso[cell.isoDate] || []) : [];
                return (
                  <div
                    key={cell.isoDate ?? i}
                    className="relative p-2 rounded text-sm bg-white group h-full"
                    style={{ boxShadow: cell.date===today ? `0 0 10px 3px ${designConfigs[design].week2Color}` : '0 0 0 1px rgba(0,0,0,0.1)' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const bounds = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - bounds.left) / bounds.width) * 100;
                      const y = ((e.clientY - bounds.top) / bounds.height) * 100;
                      const updated = [...cells];

                      if (dragType === 'sticker' && dragItem) updated[i].stickers.push({ src: dragItem, x, y });

                      if (dragType === 'text' && dragItem) {
                        let text = ''; let tag: 'todo'|'positive'|undefined;
                        if (typeof dragItem === 'string') text = dragItem;
                        else if (dragItem && typeof dragItem.text === 'string') { text = dragItem.text; tag = dragItem.tag; }
                        if (text) updated[i].items.push({ text, done: false, tag });
                      }

                      if (dragType === 'reminder' && dragItem) updated[i].reminders.push(dragItem as CalendarReminder);

                      if (draggingSticker) {
                        const sticker = updated[draggingSticker.cellIndex].stickers[draggingSticker.stickerIndex];
                        updated[draggingSticker.cellIndex].stickers.splice(draggingSticker.stickerIndex, 1);
                        updated[i].stickers.push({ ...sticker, x, y });
                      }

                      setCells(updated); setDragItem(null); setDragType(null); setDraggingSticker(null);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-base capitalize pl-1">{cell.date}</div>
                      <div className="pr-1"><WeatherBadge iso={cell.isoDate} /></div>
                    </div>

                    <div className="flex flex-col min-h-0">
                      <div className="flex-1 min-h-0">
                        {cell.items.map((item, j) => (
                          <div
                            key={j}
                            className={`group/item flex items-center justify-between py-1 px-2 rounded mb-1 ${item.done ? 'line-through text-gray-400' : ''}`}
                            onDoubleClick={() => { const updated = [...cells]; updated[i].items.splice(j,1); setCells(updated); }}
                          >
                            <span className="break-words flex-grow">{item.text}</span>

                            {timePickerOpen?.i===i && timePickerOpen?.j===j ? (
                              <input
                                ref={timePickerRef}
                                type="time"
                                className="text-xs border rounded px-1 mr-2"
                                onBlur={(e) => { const updated = [...cells]; updated[i].items[j].time = (e.target as HTMLInputElement).value; setCells(updated); setTimePickerOpen(null); }}
                                autoFocus
                              />
                            ) : (item.time && <span className="text-gray-500 text-xs mr-2">{item.time}</span>)}

                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Clock size={16} className="cursor-pointer text-gray-400 hover:text-black" onClick={() => setTimePickerOpen({ i, j })} />
                              <AlarmClock size={16} className="text-gray-300" title="(Reminder folgt später)" />
                              <Check
                                size={16}
                                className={`cursor-pointer ${item.done ? 'text-emerald-500' : 'text-gray-300 hover:text-emerald-600'}`}
                                title={item.done ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
                                onClick={() => {
                                  const updated = [...cells];
                                  const it = updated[i].items[j];
                                  const nowISO = new Date().toISOString();
                                  it.done = !it.done;
                                  it.doneAt = it.done ? nowISO : undefined;
                                  setCells(updated);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-1">
                        <input
                          type="text"
                          className="w-full text-sm border border-transparent hover:border-gray-300 rounded px-2 py-1"
                          onKeyDown={(e) => {
                            if (e.key==='Enter') {
                              const v = (e.target as HTMLInputElement).value.trim();
                              if (v) { const u=[...cells]; u[i].items.push({ text:v, done:false }); setCells(u); (e.target as HTMLInputElement).value=''; }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {todaysEvents.length > 0 && (
                      <div className="absolute bottom-1 left-1 flex flex-wrap items-center gap-1">
                        {todaysEvents.map((ev) => (
                          <span key={ev.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-pink-50 border border-pink-200"
                                title={ev.title + (ev.reminderTime ? ` | ${ev.reminderTime}` : '')}>
                            <span aria-hidden className="text-base leading-none">{emojiForEvent(ev)}</span>
                            <span className="truncate max-w-[9rem]">{ev.title}{ev.reminderTime ? ' | ' + ev.reminderTime : ''}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {cell.reminders.length > 0 && (
                      <div className="absolute bottom-1 right-1 flex gap-1">
                        {cell.reminders.map((rem, rIndex) => (
                          <div key={rIndex} title={rem.tooltip} className="w-6 h-6 flex items-center justify-center"
                               onDoubleClick={() => { const updated=[...cells]; updated[i].reminders.splice(rIndex,1); setCells(updated); }}>
                            {rem.icon==='droplet' && <Droplet size={16} color={rem.color} />}
                            {rem.icon==='dropletoff' && <DropletOff size={16} color={rem.color} />}
                            {rem.icon==='handcoins' && <HandCoins size={16} color={rem.color} />}
                            {rem.icon.startsWith('trash') && <Trash2 size={16} color={rem.color} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {cell.stickers.map((sticker, sIndex) => (
                      <img key={sIndex} src={sticker.src} alt="Sticker" className="absolute w-20 h-20 cursor-move"
                           style={{ left: `${sticker.x}%`, top: `${sticker.y}%`, transform: 'translate(-50%, -50%)' }}
                           draggable onDragStart={() => setDraggingSticker({ cellIndex: i, stickerIndex: sIndex })}
                           onDoubleClick={() => { const u=[...cells]; u[i].stickers.splice(sIndex,1); setCells(u); }} />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <YearView/>
          )}
        </div>

{/* ============================
    SECTION 12: Sidebar (rechts)
============================ */}
<aside className="w-72 min-w-[18rem] max-w-[18rem] flex-shrink-0 overflow-auto pt-[12px] p-4 border-l bg-white mt-[17px]">
  
  {/* Planer-Link (zurück zu den Kalenderansichten) */}
<div className="flex items-center justify-between mb-6">
  <div
    role="button"
    onClick={() => { setMode('weeks'); setWeeks(2); }}
    className="flex items-center gap-2 cursor-pointer select-none"
    title="Zum Planer (Kalender) wechseln"
  >
    <h2 className="text-base font-bold flex items-center gap-2">
      {/* calendar icon (inline, schwarz) */}
      <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span>Planer</span>
    </h2>
  </div>
  {/* Platzhalter rechts für identisches Zeilenlayout */}
  <span className="w-5" />
</div>
<div className="h-4 shrink-0" />



  {/* To-Dos */}
  <div className="mt-0">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-bold flex items-center gap-2"><ListTodo size={18} /> To-Dos</h2>
      <button className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setTodoCollapsed((v)=>!v)} aria-label="To-Dos ein-/ausklappen">
        {todoCollapsed ? '+' : '−'}
      </button>
    </div>
    {!todoCollapsed && (
      <>
        <ul className="space-y-1 mt-2">
          {todoList.map((item,i)=>(
            <li key={i}
                className="py-[7px] px-[12px] rounded bg-gray-100 cursor-move"
                draggable
                onDragStart={()=>{
                  setDragItem({ text:item, tag:'todo' });
                  setDragType('text');
                }}
                onDoubleClick={(e)=>{ if(e.ctrlKey||e.metaKey){ const next=todoList.filter((_,idx)=>idx!==i); setTodoList(next); } }}
                title="Entfernen: STRG/Cmd + Doppelklick">
              {item}
            </li>
          ))}
        </ul>
        <input
          type="text"
          placeholder="Hinzufügen."
          className="w-full text-sm mt-2 border px-2 py-1 rounded"
          value={newTodo}
          onChange={(e)=>setNewTodo(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==='Enter'){ const v=newTodo.trim(); if(v){ setTodoList([...todoList,v]); } setNewTodo(''); } }}
        />
      </>
    )}
  </div>

  {/* Positive Aktivitäten */}
  <div className="mt-[44px]">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-bold flex items-center gap-2"><Sun size={18} /> Positive Aktivitäten</h2>
      <button className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setActivitiesCollapsed((v)=>!v)} aria-label="Positive Aktivitäten ein-/ausklappen">
        {activitiesCollapsed ? '+' : '−'}
      </button>
    </div>
    {!activitiesCollapsed && (
      <>
        <ul className="space-y-1 mt-2">
          {activityList.map((item,i)=>(
            <li key={i}
                className="py-[7px] px-[12px] rounded bg-gray-100 cursor-move"
                draggable
                onDragStart={()=>{ setDragItem({ text:item, tag:'positive' }); setDragType('text'); }}
                onDoubleClick={(e)=>{ if(e.ctrlKey||e.metaKey){ setActivityList(activityList.filter((_,idx)=>idx!==i)); } }}
                title="Entfernen: STRG/Cmd + Doppelklick">
              {item}
            </li>
          ))}
        </ul>
        <input
          type="text"
          placeholder="Hinzufügen."
          className="w-full text-sm mt-2 border px-2 py-1 rounded"
          value={newActivity}
          onChange={(e)=>setNewActivity(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==='Enter'){ const v=newActivity.trim(); if(v){ setActivityList([...(Array.isArray(activityList)?activityList:[]), v]); } setNewActivity(''); } }}
        />
      </>
    )}
  </div>

  {/* Reminder */}
  <div className="mt-[44px]">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-bold flex items-center gap-2"><Bell size={18} /> Reminder</h2>
      <button className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setRemindersCollapsed((v)=>!v)} aria-label="Reminder ein-/ausklappen">
        {remindersCollapsed ? '+' : '−'}
      </button>
    </div>
    {!remindersCollapsed && (
      <div className="mt-2">
        <div className="text-xs text-gray-500">Ziehe ein Icon in einen Tageskasten.</div>
        <div className="flex flex-wrap gap-2 mt-2">
          {reminderIcons.map((r, ri)=>(
            <div key={ri} className="w-6 h-6 grid place-items-center rounded bg-gray-100 cursor-move select-none"
                 draggable
                 onDragStart={()=>{ setDragItem(r); setDragType('reminder'); }}
                 title={r.tooltip}>
              {r.icon==='droplet' && <Droplet size={16} color={r.color} />}
              {r.icon==='dropletoff' && <DropletOff size={16} color={r.color} />}
              {r.icon==='handcoins' && <HandCoins size={16} color={r.color} />}
              {r.icon.startsWith('trash') && <Trash2 size={16} color={r.color} />}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>

  {/* Demnächst (Upcoming) – Vorschau + Button */}
  <div className="mt-[44px]">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-bold flex items-center gap-2"><Star size={18} /> Demnächst</h2>
      <button className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setUpcomingCollapsed((v)=>!v)} aria-label="Demnächst ein-/ausklappen">
        {upcomingCollapsed ? '+' : '−'}
      </button>
    </div>
    {!upcomingCollapsed && (
      <div className="mt-2">
        <div className="flex gap-2">
          <button onClick={() => setUpcomingOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#f9e2ca] hover:brightness-95">
            Demnächst-Liste öffnen ({upcoming.length})
          </button>
        </div>
        <ul className="mt-3 space-y-1 max-h-52 overflow-auto">
          {next10.length===0 && <li className="text-sm text-gray-500">Noch keine Einträge</li>}
          {next10.map((ev)=>(
            <li key={ev.id} className="text-sm flex items-center gap-2">
              <span className="text-base">{emojiForEvent(ev)}</span>
              <span className="truncate">{ev.title}</span>
              <span className="text-gray-500 ml-auto">
                {new Date(ev.dateISO+'T00:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}
                {ev.reminderTime ? ` · ${ev.reminderTime}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>

  {/* Erledigt */}
  <div className="mt-[44px]">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-bold flex items-center gap-2"><Award size={18} /> Erledigt</h2>
      <button className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setDoneCollapsed((v)=>!v)} aria-label="Erledigt ein-/ausklappen">
        {doneCollapsed ? '+' : '−'}
      </button>
    </div>
    {!doneCollapsed && (
      <div className="mt-2">
        <button onClick={() => setDoneOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-100 hover:brightness-95">
          Erledigt-Liste öffnen
        </button>
      </div>
    )}
  </div>

  {/* Sticker */}
  <div className="mt-[44px]">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-bold flex items-center gap-2"><Sticker size={18} /> Sticker</h2>
      <button className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setStickersCollapsed((v)=>!v)} aria-label="Sticker ein-/ausklappen">
        {stickersCollapsed ? '+' : '−'}
      </button>
    </div>
    {!stickersCollapsed && (
      <>
        <div className="flex flex-wrap gap-2 mt-2">
          {customStickers.map((src,i)=>(
            <img key={`${i}-${src.slice(0,15)}`} src={src} alt="Sticker" className="w-12 h-12 cursor-move"
                 draggable onDragStart={()=>{ setDragItem(src); setDragType('sticker'); }}
                 onDoubleClick={(e)=>{ if(e.ctrlKey||e.metaKey){ setCustomStickers(customStickers.filter((_,idx)=>idx!==i)); } }}
                 title="Sticker entfernen: STRG/Cmd + Doppelklick" />
          ))}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=> setCustomStickers((prev)=>[...prev, r.result as string]); r.readAsDataURL(f); }}
          className="mt-2 w-full text-transparent file:cursor-pointer file:rounded-full file:border-0 file:bg-violet-100 file:text-violet-700 file:px-3 file:py-1 file:text-sm file:font-semibold hover:file:bg-violet-200 file:transition file:duration-200 file:before:content-['+'] overflow-hidden"
        />
      </>
    )}
  </div>

  {/* Einkaufsliste – vorletzte Position, Icon orange */}
  <div className="mt-[44px]">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-bold flex items-center gap-2">
        <ShoppingBasket size={18} color="black" /> Einkaufsliste
      </h2>
      <button className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setShoppingCollapsed((v)=>!v)} aria-label="Einkaufsliste ein-/ausklappen">
        {shoppingCollapsed ? '+' : '−'}
      </button>
    </div>
    {!shoppingCollapsed && (
      <div className="mt-2">
        <div className="flex gap-2">
          <button onClick={() => setShoppingOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-100 hover:brightness-95">
            Einkaufsliste öffnen ({shoppingList.length})
          </button>
          <button onClick={() => setOffersOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-amber-100 hover:brightness-95">
            Angebote
          </button>
        </div>
        <ul className="mt-3 space-y-1 max-h-52 overflow-auto">
          {(!Array.isArray(shoppingList) || shoppingList.length === 0) && (
            <li className="text-sm text-gray-500">Noch keine Einträge</li>
          )}
          {Array.isArray(shoppingList) &&
            shoppingList.slice(0, 10).map((it, idx) => (
              <li key={idx} className="text-sm text-gray-700 truncate">– {it}</li>
            ))}
          {Array.isArray(shoppingList) && shoppingList.length > 10 && (
            <li className="text-xs text-gray-400">… {shoppingList.length - 10} weitere</li>
          )}
        </ul>
      </div>
    )}
  </div>

  {/* Watchlist – ganz unten, Icon in Pink/Magenta */}
<div className="mt-[44px]">
  <div
    role="button"
    onClick={() => setMode('watchlist')}
    className="flex items-center gap-2 cursor-pointer select-none"
    title="Zur Watchlist wechseln"
  >
    <h2 className="text-base font-bold flex items-center gap-2">
      {/* tv icon (inline, pink) */}
      <svg className="w-4 h-4 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>
      </svg>
      <span>Watchlist</span>
    </h2>
  </div>
</div>

</aside>
      </main>


 {/* ============================
    SECTION 13: Settings-Panel (zentriertes Overlay)
============================ */}
{settingsOpen && (
  <div
    className="fixed inset-0 z-[200] bg-black/40 grid place-items-center"
    role="dialog"
    aria-modal="true"
    onClick={() => setSettingsOpen(false)}
  >
    <div
      className="bg-white rounded-xl shadow-2xl w-[min(92vw,720px)] max-h-[85vh] overflow-auto p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Einstellungen</h3>
        <button
          onClick={() => setSettingsOpen(false)}
          className="px-2 py-1 text-sm rounded border bg-gray-50 hover:bg-gray-100"
        >
          Schließen
        </button>
      </div>

      <label className="block mb-2 font-semibold">Designauswahl:</label>
      <select value={design} onChange={(e)=>setDesign(e.target.value as DesignKey)} className="w-full mb-4 border px-2 py-1 rounded">
        {Object.keys(designConfigs).map((key)=>(
          <option key={key} value={key}>{designConfigs[key as DesignKey].name}</option>
        ))}
      </select>

      <label className="block mb-2 font-semibold">Discord-Benutzername(n) (optional):</label>
      <input type="text" value={discordUsers} onChange={(e)=>setDiscordUsers(e.target.value)} placeholder="z. B. Katze#1234" className="w-full border px-2 py-1 rounded mb-3" />

      <hr className="my-3" />

      <div className="text-sm font-semibold mb-2">Discord Bot (DM-Reminder)</div>
      <label className="block text-xs mb-1">Bot Endpoint URL</label>
      <input type="url" value={botEndpoint} onChange={(e)=>setBotEndpoint(e.target.value)} placeholder="http://127.0.0.1:3000" className="w-full border px-2 py-1 rounded mb-2" />
      <label className="block text-xs mb-1">Shared Secret</label>
      <input type="password" value={botSecret} onChange={(e)=>setBotSecret(e.target.value)} placeholder="geheimes Token" className="w-full border px-2 py-1 rounded mb-2" />
      <label className="block text-xs mb-1">Discord User IDs (kommagetrennt)</label>
      <input type="text" value={dmUserIds} onChange={(e)=>setDmUserIds(e.target.value)} placeholder="1234567890,0987654321" className="w-full border px-2 py-1 rounded mb-3" />
      <button onClick={()=> {
        if (!botEndpoint || !botSecret || dmUserIdList.length===0) { alert('Bitte Endpoint/Secret/UserID setzen.'); return; }
        fetch(`${botEndpoint.replace(/\/+$/,'')}/api/test`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: botSecret, userId: dmUserIdList[0], content: '✅ Test vom Aktivitätsplaner.' }) })
          .then(r=> { if(!r.ok) throw new Error(); alert('Test-DM gesendet.'); })
          .catch(()=> alert('Test-DM fehlgeschlagen.'));
      }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-indigo-100 hover:brightness-95"><Send size={16} /> Test-DM</button>

      <hr className="my-3" />

      <div className="text-sm font-semibold mb-2">Wetter</div>
      <label className="flex items-center gap-2 mb-2 text-sm">
        <input type="checkbox" checked={weatherEnabled} onChange={(e) => setWeatherEnabled(e.target.checked)} />
        Wetteranzeige im Planer aktivieren
      </label>
      <label className="block text-xs mb-1">Ort oder PLZ</label>
      <div className="flex gap-2">
        <input type="text" value={weatherCity} onChange={(e)=>setWeatherCity(e.target.value)} placeholder="z. B. Berlin oder 10115" className="flex-1 border px-2 py-1 rounded" />
        <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm" onClick={async ()=>{
          const g = await geocodeCity(weatherCity || 'Berlin');
          if (g) setWeatherCoord({ lat: g.lat, lon: g.lon });
          else alert('Ort/PLZ nicht gefunden.');
        }}>Übernehmen</button>
      </div>

      <hr className="my-3" />

      <div className="text-sm font-semibold mb-2">Watchlist (TMDB)</div>
      <label className="block text-xs mb-1">TMDB API Key</label>
      <input
        type="password"
        value={tmdbApiKey}
        onChange={(e)=>setTmdbApiKey(e.target.value)}
        placeholder="TMDB API Key hier eintragen"
        className="w-full border px-2 py-1 rounded"
      />
      <p className="text-[11px] text-gray-500 mt-1">Kostenlosen Key auf themoviedb.org erstellen. Die Watchlist nutzt Titel/Infos/Poster und Streaming-Anbieter (DE) von TMDB.</p>
    </div>
  </div>
)}


      {/* ============================
          SECTION 14: YearView-Komponente (inline)
      ============================ */}
      { /* Aus Platzgründen hier inline wie gehabt */ }
      { /* ... identisch wie in deiner funktionierenden Version (aus Performance-Gründen nicht dupliziert) */ }

      {/* ============================
          SECTION 15: Modals
      ============================ */}
      {upcomingOpen && (
        <UpcomingModal
          isOpen={true}
          onClose={() => setUpcomingOpen(false)}
          events={upcoming}
          onAdd={async (ev) => { setUpcoming((prev)=>[...prev, ev]); }}
          onDelete={async (id) => { setUpcoming((prev)=>prev.filter((x)=>x.id!==id)); }}
          onSaveAll={(list: UpcomingEvent[]) => { setUpcoming(list); }}
        />
      )}
      {shoppingOpen && (
        <ShoppingListModal
          isOpen={shoppingOpen}
          onClose={() => setShoppingOpen(false)}
          items={Array.isArray(shoppingList) ? shoppingList : []}
          onChange={setShoppingList}
          discordWebhookUrl={discordWebhookUrl}
          botEndpoint={botEndpoint}
          botSecret={botSecret}
          dmUserIds={dmUserIdList}
        />
      )}
      {offersOpen && (
        <OffersModal
          isOpen={offersOpen}
          onClose={() => setOffersOpen(false)}
          botEndpoint={botEndpoint}
          botSecret={botSecret}
          dmUserIds={dmUserIdList}
        />
      )}
      {doneOpen && (<DoneModal isOpen={doneOpen} onClose={() => setDoneOpen(false)} />)}
    </div>
  );
};


// ============================
// SECTION 16: YearView Definition (aus deiner stabilen Version)
// ============================
// (Hier ist die YearView-Funktion bereits oben inline verwendet. Wenn du möchtest,
// kann ich sie in eine eigene Datei auslagern – sag Bescheid.)


export default App;
