// ============================
// SECTION 1: Imports
// ============================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings, Save, Download, Filter, Check, Clock, AlarmClock,
  ChevronLeft, ChevronRight, Droplet, DropletOff, HandCoins, Trash2,
} from 'lucide-react';

import { useLocalStorageState } from './hooks/useLocalStorageState';
import type { GlobalView, CalendarCell, YearFilters } from './types';
import {
  designConfigs, type DesignKey,
  TODO_KEY, ACTIVITIES_KEY, STICKERS_PRIMARY_KEY, SHOPPING_KEY,
  DISCORD_WEBHOOK_KEY, BOT_ENDPOINT_KEY, BOT_SECRET_KEY, DM_USER_IDS_KEY,
  YEAR_FILTERS_KEY, UPCOMING_KEYS, WEATHER_CACHE_KEY, WEATHER_CITY_KEY,
  WEATHER_COORD_KEY, WEATHER_ENABLED_KEY, TMDB_API_KEY_KEY, DESIGN_KEY,
  CAT_LABEL, CAT_EMOJI, type Cat,
} from './constants';
import {
  getMonday, addDays, fmtISO, getDateKey,
  ensureAndSelectCells, mergeVisibleCellsIntoMap, getStorageMap,
  isValidWeek, generateDateInfos,
  monthIndexOf, makeMonthsAbs, clampYear,
  emojiForEvent, eventCategory,
  getInitialActivities, getInitialUpcoming, getInitialStickers,
} from './utils/helpers';
import { geocodeCity, fetchForecast, type WeatherByDate } from './utils/weather';

import UpcomingModal from './components/UpcomingModal';
import type { UpcomingEvent } from './components/UpcomingModal';
import ShoppingListModal from './components/ShoppingListModal';
import DoneModal from './components/DoneModal';
import OffersModal from './components/OffersModal';
import WatchlistView from './components/WatchlistView';
import WeatherBadge from './components/WeatherBadge';
import YearView from './components/YearView';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';


// ============================
// SECTION 2: App-Komponente
// ============================
const App: React.FC = () => {

  // --- View & Navigation ---
  const [mode, setMode] = useState<GlobalView>('weeks');
  const [weeks, setWeeks] = useState(2);
  const [startMonday, setStartMonday] = useState(getMonday(new Date()));

  // --- Kalender-Zellen ---
  const [cells, setCells] = useState<CalendarCell[]>([]);
  const [dragItem, setDragItem] = useState<any>(null);
  const [dragType, setDragType] = useState<'text' | 'sticker' | 'reminder' | null>(null);
  const [draggingSticker, setDraggingSticker] = useState<{ cellIndex: number; stickerIndex: number } | null>(null);

  // --- Sidebar-Listen ---
  const [todoList, setTodoList] = useState<string[]>(['Einkaufen', 'Zahnarzt anrufen', 'Kitty füttern']);
  const [newTodo, setNewTodo] = useState('');
  const [activityList, setActivityList] = useLocalStorageState<string[]>(ACTIVITIES_KEY, getInitialActivities);
  const [newActivity, setNewActivity] = useState('');

  // --- Einklapp-States Sidebar ---
  const [todoCollapsed, setTodoCollapsed] = useState(true);
  const [activitiesCollapsed, setActivitiesCollapsed] = useState(true);
  const [remindersCollapsed, setRemindersCollapsed] = useState(true);
  const [upcomingCollapsed, setUpcomingCollapsed] = useState(true);
  const [shoppingCollapsed, setShoppingCollapsed] = useState(true);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [stickersCollapsed, setStickersCollapsed] = useState(true);

  // --- Discord ---
  const [discordUsers, setDiscordUsers] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useLocalStorageState<string>(DISCORD_WEBHOOK_KEY, '');
  const [botEndpoint, setBotEndpoint] = useLocalStorageState<string>(BOT_ENDPOINT_KEY, '');
  const [botSecret, setBotSecret] = useLocalStorageState<string>(BOT_SECRET_KEY, '');
  const [dmUserIds, setDmUserIds] = useLocalStorageState<string>(DM_USER_IDS_KEY, '');
  const dmUserIdList = useMemo(() => dmUserIds.split(',').map(s => s.trim()).filter(Boolean), [dmUserIds]);

  // --- Design & Settings ---
  const [design, setDesign] = useLocalStorageState<DesignKey>(DESIGN_KEY, 'hearty');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- Time Picker ---
  const [timePickerOpen, setTimePickerOpen] = useState<{ i: number; j: number } | null>(null);
  const timePickerRef = useRef<HTMLInputElement | null>(null);

  // --- Modals ---
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);

  // --- Filter (Monats-/Jahresansicht) ---
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null);

  // --- Wetter ---
  const [weatherCity, setWeatherCity] = useLocalStorageState<string>(WEATHER_CITY_KEY, 'Berlin');
  const [weatherCoord, setWeatherCoord] = useLocalStorageState<{ lat: number; lon: number } | null>(WEATHER_COORD_KEY, null);
  const [weatherByDate, setWeatherByDate] = useState<WeatherByDate>({});
  const [weatherEnabled, setWeatherEnabled] = useLocalStorageState<boolean>(WEATHER_ENABLED_KEY, true);

  // --- TMDB ---
  const [tmdbApiKey, setTmdbApiKey] = useLocalStorageState<string>(TMDB_API_KEY_KEY, '');

  // --- Upcoming / Sticker / Shopping ---
  const [upcoming, setUpcoming] = useLocalStorageState<UpcomingEvent[]>(UPCOMING_KEYS[0], getInitialUpcoming);
  const [customStickers, setCustomStickers] = useLocalStorageState<string[]>(STICKERS_PRIMARY_KEY, getInitialStickers);
  const [shoppingList, setShoppingList] = useLocalStorageState<string[]>(SHOPPING_KEY, []);

  // --- Jahr-/Monatsfilter ---
  const [yearFilters, setYearFilters] = useLocalStorageState<YearFilters>(YEAR_FILTERS_KEY, () => ({
    categories: {
      birthday: true, doctor: true, important: true, holiday: true, work: true,
      gameRelease: true, gaming: true, cinemaRelease: true, seriesRelease: true, other: true,
    },
    showTodos: false,
    showPositives: false,
  }));

  // --- Jahres-/Monatsnavigation ---
  const now = new Date();
  const [year12, setYear12] = useState<number>(now.getFullYear());
  const [hyYear, setHyYear] = useState<number>(now.getFullYear());
  const [hyHalf, setHyHalf] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2);
  const [m3StartYear, setM3StartYear] = useState<number>(now.getFullYear());
  const [m3StartMonth0, setM3StartMonth0] = useState<number>(now.getMonth());


  // ============================
  // SECTION 3: Effects
  // ============================
  useEffect(() => {
    if (!isValidWeek(startMonday)) { setCells([]); return; }
    setCells(ensureAndSelectCells(startMonday, weeks));
  }, [startMonday, weeks]);

  useEffect(() => { mergeVisibleCellsIntoMap(startMonday, cells); }, [cells]); // eslint-disable-line

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) setTimePickerOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    try { const raw = localStorage.getItem(TODO_KEY); if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setTodoList(p); } } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(TODO_KEY, JSON.stringify(todoList)); } catch {}
  }, [todoList]);

  // Wetter: Koordinaten ermitteln
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

  // Wetter: Forecast laden
  const twoWeekStart = getMonday(new Date());
  const twoWeekEnd = addDays(twoWeekStart, 13);
  const twoWeekStartISO = fmtISO(twoWeekStart);
  const twoWeekEndISO = fmtISO(twoWeekEnd);

  const twoWeekSet = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < 14; i++) s.add(fmtISO(addDays(twoWeekStart, i)));
    return s;
  }, [twoWeekStartISO]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      if (!weatherEnabled || !weatherCoord) return;
      try {
        const byDate = await fetchForecast(weatherCoord.lat, weatherCoord.lon, twoWeekStartISO, twoWeekEndISO);
        setWeatherByDate(byDate);
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
          byDate, expires: Date.now() + 3 * 60 * 60 * 1000, lat: weatherCoord.lat, lon: weatherCoord.lon,
        }));
      } catch {}
    })();
  }, [weatherEnabled, weatherCoord, twoWeekStartISO, twoWeekEndISO]); // eslint-disable-line


  // ============================
  // SECTION 4: Berechnete Werte
  // ============================
  const currentDesign = designConfigs[design];
  const VIEWPORT_OFFSET = 170;
  const gridHeight = `calc(100vh - ${VIEWPORT_OFFSET}px)`;
  const todayISO = new Date().toISOString().slice(0, 10);
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const curY = new Date().getFullYear();
  const curM = new Date().getMonth();
  const canScrollMonths = mode === '3m' || mode === '6m' || mode === '12m';

  const monthsForView = useMemo(() => {
    if (mode === '12m') return makeMonthsAbs(monthIndexOf(year12, 0), 12);
    if (mode === '6m')  return makeMonthsAbs(monthIndexOf(hyYear, hyHalf === 1 ? 0 : 6), 6);
    if (mode === '3m')  return makeMonthsAbs(monthIndexOf(m3StartYear, m3StartMonth0), 3);
    return [];
  }, [mode, year12, hyYear, hyHalf, m3StartYear, m3StartMonth0]);

  const eventsByIso = useMemo(() => {
    const map: Record<string, UpcomingEvent[]> = {};
    for (const ev of upcoming) { if (!map[ev.dateISO]) map[ev.dateISO] = []; map[ev.dateISO].push(ev); }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.reminderTime || '').localeCompare(b.reminderTime || ''));
    return map;
  }, [upcoming]);

  const next10 = useMemo(
    () => upcoming.slice().sort((a, b) => (a.dateISO + (a.reminderTime ?? '')).localeCompare(b.dateISO + (b.reminderTime ?? ''))).slice(0, 10),
    [upcoming]
  );

  const getDayEvents = (iso: string) => {
    const list = (eventsByIso[iso] ?? []).filter(ev => yearFilters.categories[eventCategory(ev)]);
    list.sort((a, b) => (a.reminderTime ?? '').localeCompare(b.reminderTime ?? ''));
    return list;
  };


  // ============================
  // SECTION 5: Navigation
  // ============================
  function prevPeriod() {
    if (mode === 'weeks') { const d = new Date(startMonday); d.setDate(d.getDate() - weeks * 7); setStartMonday(d); return; }
    if (mode === '12m') { setYear12(y => clampYear(y - 1)); return; }
    if (mode === '6m') {
      setHyYear((y) => {
        let ny = y; let nh = hyHalf;
        if (hyHalf === 1) { if (y > 2024) { ny = y - 1; nh = 2; } }
        else { nh = 1; }
        setHyHalf(nh); return clampYear(ny);
      }); return;
    }
    if (mode === '3m') {
      const idx = monthIndexOf(m3StartYear, m3StartMonth0) - 1;
      const ny = Math.max(2024, Math.floor(idx / 12));
      const nm = idx - ny * 12;
      if (monthIndexOf(ny, nm) < monthIndexOf(2024, 0)) return;
      setM3StartYear(ny); setM3StartMonth0(nm); return;
    }
  }

  function nextPeriod() {
    if (mode === 'weeks') { const d = new Date(startMonday); d.setDate(d.getDate() + weeks * 7); setStartMonday(d); return; }
    if (mode === '12m') { setYear12(y => y + 1); return; }
    if (mode === '6m')  { if (hyHalf === 1) { setHyHalf(2); } else { setHyHalf(1); setHyYear(y => y + 1); } return; }
    if (mode === '3m')  { const idx = monthIndexOf(m3StartYear, m3StartMonth0) + 1; setM3StartYear(Math.floor(idx / 12)); setM3StartMonth0(((idx % 12) + 12) % 12); return; }
  }


  // ============================
  // SECTION 6: Filter-Popup Position
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
    window.addEventListener('resize', recalcFilterPos);
    window.addEventListener('scroll', recalcFilterPos, true);
    return () => {
      window.removeEventListener('resize', recalcFilterPos);
      window.removeEventListener('scroll', recalcFilterPos, true);
    };
  }, [filterOpen]);


  // ============================
  // SECTION 7: Export
  // ============================
  function handleExport() {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        view: { mode, weeks, startMonday: getDateKey(startMonday) },
        cellsMap: getStorageMap(startMonday),
        todoList, activityList, shoppingList, upcoming,
        stickers: customStickers, design, yearFilters,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `aktivitaetsplaner-${getDateKey(startMonday)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert('Export fehlgeschlagen.'); }
  }


  // ============================
  // SECTION 8: Render
  // ============================
  return (
    <div className="h-screen flex flex-col pl-5 relative" style={{ backgroundColor: currentDesign.backgroundColor }}>

      {/* Header */}
      <header className="grid grid-cols-3 items-center px-4 h-[70px] pt-[10px] mb-2 relative">
        <div className="flex items-center gap-3">
          <img src={currentDesign.headerImage} alt="Header" className="h-full" />
        </div>

        <div className="flex justify-center items-center gap-2 relative">
          <button
            onClick={mode === 'watchlist' ? undefined : (canScrollMonths ? prevPeriod : () => { const d = new Date(startMonday); d.setDate(d.getDate() - weeks * 7); setStartMonday(d); })}
            className={`p-1 rounded ${mode === 'watchlist' ? 'opacity-30 cursor-default bg-gray-100' : 'bg-white'}`}
          >
            <ChevronLeft size={18} />
          </button>

          <button onClick={() => { setMode('weeks'); setWeeks(2); }} className={`px-3 py-1 rounded ${mode === 'weeks' && weeks === 2 ? '' : 'bg-white'}`} style={{ backgroundColor: mode === 'weeks' && weeks === 2 ? designConfigs[design].week2Color : undefined }}>2 Wochen</button>
          <button onClick={() => { setMode('weeks'); setWeeks(4); }} className={`px-3 py-1 rounded ${mode === 'weeks' && weeks === 4 ? '' : 'bg-white'}`} style={{ backgroundColor: mode === 'weeks' && weeks === 4 ? designConfigs[design].week4Color : undefined }}>4 Wochen</button>
          <button onClick={() => setMode('3m')}  className={`px-3 py-1 rounded ${mode === '3m'  ? '' : 'bg-white'}`} style={{ backgroundColor: mode === '3m'  ? designConfigs[design].week2Color : undefined }}>3 Monate</button>
          <button onClick={() => setMode('6m')}  className={`px-3 py-1 rounded ${mode === '6m'  ? '' : 'bg-white'}`} style={{ backgroundColor: mode === '6m'  ? designConfigs[design].week2Color : undefined }}>6 Monate</button>
          <button onClick={() => setMode('12m')} className={`px-3 py-1 rounded ${mode === '12m' ? '' : 'bg-white'}`} style={{ backgroundColor: mode === '12m' ? designConfigs[design].week4Color : undefined }}>Jahr</button>

          <button
            onClick={mode === 'watchlist' ? undefined : (canScrollMonths ? nextPeriod : () => { const d = new Date(startMonday); d.setDate(d.getDate() + weeks * 7); setStartMonday(d); })}
            className={`p-1 rounded ${mode === 'watchlist' ? 'opacity-30 cursor-default bg-gray-100' : 'bg-white'}`}
          >
            <ChevronRight size={18} />
          </button>

          {(mode !== 'weeks' && mode !== 'watchlist') && (
            <button
              ref={filterBtnRef}
              onClick={() => setFilterOpen(v => !v)}
              className="p-2 rounded border bg-white ml-[50px]"
              style={{ color: designConfigs[design].week2Color, borderColor: designConfigs[design].week2Color }}
              title="Filter"
            >
              <Filter size={18} />
            </button>
          )}
        </div>

        <div className="flex justify-end items-center gap-2">
          <button onClick={() => mergeVisibleCellsIntoMap(startMonday, cells)} className="p-2 rounded bg-white" title="Speichern"><Save size={18} /></button>
          <button onClick={handleExport} className="p-2 rounded bg-white" title="Exportieren"><Download size={18} /></button>
          <button onClick={() => setSettingsOpen(o => !o)} className="p-2 rounded bg-white" title="Einstellungen"><Settings size={18} /></button>
        </div>
      </header>


      {/* Filter-Popup */}
      {filterOpen && filterPos && createPortal(
        <div className="fixed inset-0 z-[120]" onClick={() => setFilterOpen(false)}>
          <div
            className="absolute w-[620px] bg-white rounded-lg shadow-lg border p-3"
            style={{ top: filterPos.top, left: Math.max(filterPos.left, 8) }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold" style={{ color: designConfigs[design].week2Color }}>Filter</div>
              <button className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setFilterOpen(false)}>Schließen</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(CAT_LABEL) as Cat[]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={yearFilters.categories[k]}
                    onChange={e => setYearFilters((old: any) => ({ ...old, categories: { ...old.categories, [k]: e.target.checked } }))}
                  />
                  <span>{CAT_EMOJI[k]} {CAT_LABEL[k]}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={yearFilters.showTodos} onChange={e => setYearFilters((old: any) => ({ ...old, showTodos: e.target.checked }))} />
                To-Dos (aus Tageskästen)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={yearFilters.showPositives} onChange={e => setYearFilters((old: any) => ({ ...old, showPositives: e.target.checked }))} />
                Positive Aktivitäten (aus Tageskästen)
              </label>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Main Content */}
      <main className="flex flex-grow overflow-hidden">
        <div className="flex-grow overflow-auto p-4">

          {/* Watchlist */}
          {mode === 'watchlist' ? (
            <WatchlistView tmdbApiKey={tmdbApiKey} onRequestOpenSettings={() => setSettingsOpen(true)} />

          /* Wochen-Ansicht */
          ) : mode === 'weeks' ? (
            <div className={`grid grid-cols-7 ${weeks === 2 ? 'grid-rows-2' : 'grid-rows-4'} gap-2.5`} style={{ height: gridHeight }}>
              {cells.map((cell, i) => {
                const todaysEvents = cell.isoDate ? (eventsByIso[cell.isoDate] || []) : [];
                return (
                  <div
                    key={cell.isoDate ?? i}
                    className="relative p-2 rounded text-sm bg-white group h-full"
                    style={{ boxShadow: cell.date === today ? `0 0 10px 3px ${designConfigs[design].week2Color}` : '0 0 0 1px rgba(0,0,0,0.1)' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const bounds = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - bounds.left) / bounds.width) * 100;
                      const y = ((e.clientY - bounds.top) / bounds.height) * 100;
                      const updated = [...cells];

                      if (dragType === 'sticker' && dragItem) updated[i].stickers.push({ src: dragItem, x, y });
                      if (dragType === 'text' && dragItem) {
                        let text = ''; let tag: 'todo' | 'positive' | undefined;
                        if (typeof dragItem === 'string') text = dragItem;
                        else if (dragItem && typeof dragItem.text === 'string') { text = dragItem.text; tag = dragItem.tag; }
                        if (text) updated[i].items.push({ text, done: false, tag });
                      }
                      if (dragType === 'reminder' && dragItem) updated[i].reminders.push(dragItem);
                      if (draggingSticker) {
                        const sticker = updated[draggingSticker.cellIndex].stickers[draggingSticker.stickerIndex];
                        updated[draggingSticker.cellIndex].stickers.splice(draggingSticker.stickerIndex, 1);
                        updated[i].stickers.push({ ...sticker, x, y });
                      }
                      setCells(updated); setDragItem(null); setDragType(null); setDraggingSticker(null);
                    }}
                  >
                    {/* Zellen-Header */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-base capitalize pl-1">{cell.date}</div>
                      <div className="pr-1">
                        <WeatherBadge iso={cell.isoDate} weatherEnabled={weatherEnabled} twoWeekSet={twoWeekSet} weatherByDate={weatherByDate} />
                      </div>
                    </div>

                    {/* Einträge */}
                    <div className="flex flex-col min-h-0">
                      <div className="flex-1 min-h-0">
                        {cell.items.map((item, j) => (
                          <div
                            key={j}
                            className={`group/item flex items-center justify-between py-1 px-2 rounded mb-1 ${item.done ? 'line-through text-gray-400' : ''}`}
                            onDoubleClick={() => { const updated = [...cells]; updated[i].items.splice(j, 1); setCells(updated); }}
                          >
                            <span className="break-words flex-grow">{item.text}</span>
                            {timePickerOpen?.i === i && timePickerOpen?.j === j ? (
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
                                onClick={() => {
                                  const updated = [...cells];
                                  const it = updated[i].items[j];
                                  it.done = !it.done;
                                  it.doneAt = it.done ? new Date().toISOString() : undefined;
                                  setCells(updated);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Neue Zeile eingeben */}
                      <div className="mt-1">
                        <input
                          type="text"
                          className="w-full text-sm border border-transparent hover:border-gray-300 rounded px-2 py-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const v = (e.target as HTMLInputElement).value.trim();
                              if (v) { const u = [...cells]; u[i].items.push({ text: v, done: false }); setCells(u); (e.target as HTMLInputElement).value = ''; }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Events (Upcoming) unten links */}
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

                    {/* Reminder unten rechts */}
                    {cell.reminders.length > 0 && (
                      <div className="absolute bottom-1 right-1 flex gap-1">
                        {cell.reminders.map((rem, rIndex) => (
                          <div key={rIndex} title={rem.tooltip} className="w-6 h-6 flex items-center justify-center"
                               onDoubleClick={() => { const updated = [...cells]; updated[i].reminders.splice(rIndex, 1); setCells(updated); }}>
                            {rem.icon === 'droplet'    && <Droplet    size={16} color={rem.color} />}
                            {rem.icon === 'dropletoff' && <DropletOff size={16} color={rem.color} />}
                            {rem.icon === 'handcoins'  && <HandCoins  size={16} color={rem.color} />}
                            {rem.icon.startsWith('trash') && <Trash2 size={16} color={rem.color} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sticker */}
                    {cell.stickers.map((sticker, sIndex) => (
                      <img key={sIndex} src={sticker.src} alt="Sticker" className="absolute w-20 h-20 cursor-move"
                           style={{ left: `${sticker.x}%`, top: `${sticker.y}%`, transform: 'translate(-50%, -50%)' }}
                           draggable onDragStart={() => setDraggingSticker({ cellIndex: i, stickerIndex: sIndex })}
                           onDoubleClick={() => { const u = [...cells]; u[i].stickers.splice(sIndex, 1); setCells(u); }} />
                    ))}
                  </div>
                );
              })}
            </div>

          /* Monats-/Jahresansicht */
          ) : (
            <YearView
              monthsForView={monthsForView}
              todayISO={todayISO}
              curY={curY}
              curM={curM}
              getDayEvents={getDayEvents}
            />
          )}
        </div>

        {/* Sidebar */}
        <Sidebar
          onGoToPlaner={() => { setMode('weeks'); setWeeks(2); }}
          onGoToWatchlist={() => setMode('watchlist')}
          setDragItem={setDragItem}
          setDragType={setDragType}
          todoList={todoList}
          setTodoList={setTodoList}
          newTodo={newTodo}
          setNewTodo={setNewTodo}
          todoCollapsed={todoCollapsed}
          setTodoCollapsed={setTodoCollapsed}
          activityList={Array.isArray(activityList) ? activityList : []}
          setActivityList={setActivityList}
          newActivity={newActivity}
          setNewActivity={setNewActivity}
          activitiesCollapsed={activitiesCollapsed}
          setActivitiesCollapsed={setActivitiesCollapsed}
          remindersCollapsed={remindersCollapsed}
          setRemindersCollapsed={setRemindersCollapsed}
          upcomingCollapsed={upcomingCollapsed}
          setUpcomingCollapsed={setUpcomingCollapsed}
          upcoming={upcoming}
          next10={next10}
          setUpcomingOpen={setUpcomingOpen}
          doneCollapsed={doneCollapsed}
          setDoneCollapsed={setDoneCollapsed}
          setDoneOpen={setDoneOpen}
          stickersCollapsed={stickersCollapsed}
          setStickersCollapsed={setStickersCollapsed}
          customStickers={Array.isArray(customStickers) ? customStickers : []}
          setCustomStickers={setCustomStickers}
          shoppingCollapsed={shoppingCollapsed}
          setShoppingCollapsed={setShoppingCollapsed}
          shoppingList={Array.isArray(shoppingList) ? shoppingList : []}
          setShoppingOpen={setShoppingOpen}
          setOffersOpen={setOffersOpen}
        />
      </main>


      {/* Settings Panel */}
      {settingsOpen && (
        <SettingsPanel
          design={design}
          setDesign={setDesign}
          discordUsers={discordUsers}
          setDiscordUsers={setDiscordUsers}
          botEndpoint={botEndpoint}
          setBotEndpoint={setBotEndpoint}
          botSecret={botSecret}
          setBotSecret={setBotSecret}
          dmUserIds={dmUserIds}
          setDmUserIds={setDmUserIds}
          dmUserIdList={dmUserIdList}
          weatherEnabled={weatherEnabled}
          setWeatherEnabled={setWeatherEnabled}
          weatherCity={weatherCity}
          setWeatherCity={setWeatherCity}
          setWeatherCoord={setWeatherCoord}
          tmdbApiKey={tmdbApiKey}
          setTmdbApiKey={setTmdbApiKey}
          onClose={() => setSettingsOpen(false)}
        />
      )}


      {/* Modals */}
      {upcomingOpen && (
        <UpcomingModal
          isOpen={true}
          onClose={() => setUpcomingOpen(false)}
          events={upcoming}
          onAdd={async (ev) => setUpcoming(prev => [...prev, ev])}
          onDelete={async (id) => setUpcoming(prev => prev.filter(x => x.id !== id))}
          onSaveAll={(list: UpcomingEvent[]) => setUpcoming(list)}
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
      {doneOpen && <DoneModal isOpen={doneOpen} onClose={() => setDoneOpen(false)} />}

    </div>
  );
};

export default App;
