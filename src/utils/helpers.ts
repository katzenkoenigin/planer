import type { CalendarCell, MonthData } from '../types';
import type { UpcomingEvent } from '../components/UpcomingModal';
import type { UpcomingCategory } from '../components/UpcomingModal';
import { CAT_EMOJI } from '../constants';
import {
  ACTIVITIES_KEY, ACTIVITIES_LEGACY_KEYS,
  STICKERS_PRIMARY_KEY, STICKERS_LEGACY_KEYS,
  UPCOMING_KEYS,
} from '../constants';

// ============================
// Date Helpers
// ============================
export const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const fmtISO = (d: Date): string => d.toISOString().slice(0, 10);

export const formatLabelDE = (d: Date): string =>
  d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });

// ============================
// Storage Key Helpers
// ============================
export const getDateKey = (monday: Date): string => monday.toISOString().slice(0, 10);
export const storageKeyUnified = (monday: Date): string => `KW_${getDateKey(monday)}`;
export const storageKeyLegacy = (monday: Date, weeks: number): string => `KW_${getDateKey(monday)}_${weeks}`;
export const isValidWeek = (monday: Date): boolean => new Date(monday) >= new Date('2025-04-28T00:00:00');

export const generateDateInfos = (monday: Date, weeks: number) =>
  Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d, iso: d.toISOString().slice(0, 10), label: formatLabelDE(d) };
  });

// ============================
// Calendar Storage (CellMap)
// ============================
export type CellMap = Record<string, CalendarCell>;

export const readUnifiedMap = (monday: Date): CellMap | null => {
  const raw = localStorage.getItem(storageKeyUnified(monday));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as CellMap;
  } catch {}
  return null;
};

export const readAndMigrateLegacy = (monday: Date): CellMap | null => {
  const raw4 = localStorage.getItem(storageKeyLegacy(monday, 4));
  const raw2 = localStorage.getItem(storageKeyLegacy(monday, 2));
  if (!raw4 && !raw2) return null;
  let arr: CalendarCell[] | null = null;
  let lengthWeeks = 0;
  try {
    if (raw4) { const p = JSON.parse(raw4); if (Array.isArray(p)) { arr = p; lengthWeeks = 4; } }
    if (!arr && raw2) { const p = JSON.parse(raw2); if (Array.isArray(p)) { arr = p; lengthWeeks = 2; } }
  } catch {}
  if (!arr) return null;
  const dateInfos = generateDateInfos(monday, lengthWeeks);
  const map: CellMap = {};
  for (let i = 0; i < Math.min(arr.length, dateInfos.length); i++) {
    const iso = dateInfos[i].iso;
    const label = dateInfos[i].label;
    const legacy = arr[i];
    map[iso] = { date: label, isoDate: iso, items: legacy.items ?? [], stickers: legacy.stickers ?? [], reminders: legacy.reminders ?? [] };
  }
  localStorage.setItem(storageKeyUnified(monday), JSON.stringify(map));
  localStorage.removeItem(storageKeyLegacy(monday, 2));
  localStorage.removeItem(storageKeyLegacy(monday, 4));
  return map;
};

export const getStorageMap = (monday: Date): CellMap =>
  readUnifiedMap(monday) ?? readAndMigrateLegacy(monday) ?? {};

export const setStorageMap = (monday: Date, map: CellMap): void => {
  localStorage.setItem(storageKeyUnified(monday), JSON.stringify(map));
};

export const ensureAndSelectCells = (monday: Date, weeksToShow: number): CalendarCell[] => {
  const dateInfos = generateDateInfos(monday, weeksToShow);
  const map = getStorageMap(monday);
  const ordered = dateInfos.map((info) => {
    if (!map[info.iso]) {
      map[info.iso] = { date: info.label, isoDate: info.iso, items: [], stickers: [], reminders: [] };
    } else {
      map[info.iso].date ||= info.label;
      map[info.iso].isoDate ||= info.iso;
    }
    return map[info.iso];
  });
  setStorageMap(monday, map);
  return ordered;
};

export const mergeVisibleCellsIntoMap = (monday: Date, visibleCells: CalendarCell[]): void => {
  const map = getStorageMap(monday);
  for (const c of visibleCells) {
    const iso = c.isoDate;
    if (!iso) continue;
    map[iso] = { ...map[iso], ...c, isoDate: iso };
  }
  setStorageMap(monday, map);
};

export function itemsForDayAll(ymd: string): CalendarCell['items'] {
  try {
    const d = new Date(ymd + 'T00:00:00');
    const monday = getMonday(d);
    const map = getStorageMap(monday);
    const cell = map[ymd];
    return Array.isArray(cell?.items) ? cell!.items : [];
  } catch { return []; }
}

// ============================
// Month / Year View Helpers
// ============================
export function monthIndexOf(year: number, month0: number): number {
  return year * 12 + month0;
}

export function makeMonthsAbs(startIndex: number, count: number): MonthData[] {
  const out: MonthData[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const y = Math.floor(idx / 12);
    const m = ((idx % 12) + 12) % 12;
    const first = new Date(y, m, 1);
    const label = first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const days: { ymd: string; d: number }[] = [];
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const dt = new Date(y, m, d);
      days.push({ ymd: dt.toISOString().slice(0, 10), d });
    }
    out.push({ year: y, month: m, label, days });
  }
  return out;
}

export function clampYear(y: number): number {
  return Math.max(2024, y);
}

// ============================
// Event / Upcoming Helpers
// ============================
const OLD_TO_NEW: Record<NonNullable<UpcomingEvent['icon']>, UpcomingCategory> = {
  birthday:  'birthday',
  cinema:    'cinemaRelease',
  gaming:    'gaming',
  season:    'gameRelease',
  doctor:    'doctor',
  business:  'work',
  streaming: 'seriesRelease',
  other:     'other',
};

export const eventCategory = (ev: UpcomingEvent): UpcomingCategory =>
  (ev.category as UpcomingCategory | undefined) ?? (ev.icon ? OLD_TO_NEW[ev.icon] : 'other');

export const emojiForEvent = (ev: UpcomingEvent): string =>
  ev.iconOverride?.type === 'emoji' ? ev.iconOverride.value : CAT_EMOJI[ev.category ?? 'other'];

// ============================
// LocalStorage Init / Migration Functions
// ============================
export function getInitialActivities(): string[] {
  try {
    const primary = localStorage.getItem(ACTIVITIES_KEY);
    if (primary) { const arr = JSON.parse(primary); if (Array.isArray(arr)) return arr; }
    for (const k of ACTIVITIES_LEGACY_KEYS) {
      const raw = localStorage.getItem(k); if (!raw) continue;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.every((x: any) => typeof x === 'string')) {
          localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(arr));
          for (const kk of ACTIVITIES_LEGACY_KEYS) localStorage.removeItem(kk);
          return arr;
        }
      } catch {}
    }
  } catch {}
  return ['Fossilien suchen', 'Museum', 'Ins Kino gehen'];
}

export function migrateUpcoming(arr: any[]): UpcomingEvent[] {
  return (arr || []).map((e: any) => {
    if (e && typeof e === 'object') {
      if ('category' in e) return e as UpcomingEvent;
      if ('icon' in e) {
        const cat = OLD_TO_NEW[e.icon as NonNullable<UpcomingEvent['icon']>] ?? 'other';
        return {
          id: String(e.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
          title: String(e.title ?? 'Unbenannt'),
          dateISO: String(e.dateISO ?? e.date ?? new Date().toISOString().slice(0, 10)),
          reminderTime: e.reminderTime || undefined,
          category: cat,
          iconOverride: null,
        } as UpcomingEvent;
      }
    }
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(e?.title ?? 'Unbenannt'),
      dateISO: String(e?.dateISO ?? new Date().toISOString().slice(0, 10)),
      category: 'other',
      iconOverride: null,
    } as UpcomingEvent;
  });
}

export function getInitialUpcoming(): UpcomingEvent[] {
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
}

export function getInitialStickers(): string[] {
  try {
    const primary = localStorage.getItem(STICKERS_PRIMARY_KEY);
    if (primary) {
      const arr = JSON.parse(primary);
      if (Array.isArray(arr)) {
        for (const k of STICKERS_LEGACY_KEYS) localStorage.removeItem(k);
        return arr;
      }
    }
    for (const k of STICKERS_LEGACY_KEYS) {
      const raw = localStorage.getItem(k); if (!raw) continue;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.every((x: any) => typeof x === 'string')) {
          localStorage.setItem(STICKERS_PRIMARY_KEY, JSON.stringify(arr));
          for (const kk of STICKERS_LEGACY_KEYS) localStorage.removeItem(kk);
          return arr;
        }
      } catch {}
    }
  } catch {}
  return [];
}
