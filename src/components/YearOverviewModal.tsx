import React, { useEffect, useMemo, useState } from 'react';
import { X, Filter } from 'lucide-react';
import type { UpcomingEvent } from './UpcomingModal';

type Mode = '6m' | '12m';

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  upcoming: UpcomingEvent[];
};

const FILTER_KEY = 'YEARVIEW_FILTERS_V1';

type UpcomingIcon =
  | 'birthday'
  | 'cinema'
  | 'gaming'
  | 'season'
  | 'doctor'
  | 'business'
  | 'streaming'
  | 'other';

const ICON_LABEL: Record<UpcomingIcon, string> = {
  birthday: 'Geburtstag',
  cinema: 'Kino',
  gaming: 'Gaming',
  season: 'Gaming-Season',
  doctor: 'Arzt',
  business: 'Business',
  streaming: 'Streaming',
  other: 'Sonstiges',
};

const ICON_EMOJI: Record<UpcomingIcon, string> = {
  birthday: '🎂',
  cinema: '🎬',
  gaming: '🎮',
  season: '⚔️',
  doctor: '🩺',
  business: '📊',
  streaming: '📺',
  other: '⭐',
};

type Filters = {
  categories: Record<UpcomingIcon, boolean>;
  showTodos: boolean;     // Platzhalter für später
  showPositives: boolean; // Platzhalter für später
};

function usePersistentFilters(): [Filters, React.Dispatch<React.SetStateAction<Filters>>] {
  const def: Filters = {
    categories: {
      birthday: true, cinema: true, gaming: true, season: true,
      doctor: true, business: true, streaming: true, other: true,
    },
    showTodos: false,
    showPositives: false,
  };
  const [state, setState] = useState<Filters>(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (!raw) return def;
      const p = JSON.parse(raw);
      return { ...def, ...p, categories: { ...def.categories, ...(p?.categories ?? {}) } };
    } catch {
      return def;
    }
  });
  useEffect(() => { try { localStorage.setItem(FILTER_KEY, JSON.stringify(state)); } catch {} }, [state]);
  return [state, setState];
}

function monthMatrix(startIndex: number, count: number, year?: number) {
  const out: { year: number; month: number; label: string; days: { ymd: string; d: number }[] }[] = [];
  const base = new Date();
  const baseYear = year ?? base.getFullYear();
  for (let i = 0; i < count; i++) {
    let idx = startIndex + i;
    let y = baseYear + Math.floor(idx / 12);
    let m = ((idx % 12) + 12) % 12;
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

function monthIndexFromToday() {
  const t = new Date();
  return t.getFullYear() * 12 + t.getMonth();
}

export default function YearOverviewModal({ open, mode, onClose, upcoming }: Props) {
  const [filters, setFilters] = usePersistentFilters();

  // Monate vorbereiten
  const months = useMemo(() => {
    if (mode === '6m') {
      const start = monthIndexFromToday();
      return monthMatrix(start, 6);
    }
    const y = new Date().getFullYear();
    return monthMatrix(0, 12, y);
  }, [mode]);

  // Events gruppieren + nach Filtern
  const eventsByDay = useMemo(() => {
    const map: Record<string, UpcomingEvent[]> = {};
    for (const ev of upcoming) {
      if (!filters.categories[ev.icon as UpcomingIcon]) continue;
      if (!map[ev.dateISO]) map[ev.dateISO] = [];
      map[ev.dateISO].push(ev);
    }
    for (const iso of Object.keys(map)) {
      map[iso].sort((a, b) => (a.reminderTime ?? '').localeCompare(b.reminderTime ?? ''));
    }
    return map;
  }, [upcoming, filters.categories]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="w-[min(1100px,95vw)] max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-semibold">{mode === '6m' ? '6 Monate' : 'Jahresübersicht'}</div>
          <button className="p-2 rounded hover:bg-black/5" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>

        {/* Filter */}
        <div className="px-5 py-3 border-b">
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-2"><Filter size={16}/> Kategorien</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ICON_LABEL) as (keyof typeof ICON_LABEL)[]).map((key) => {
              const on = filters.categories[key];
              return (
                <button
                  key={key}
                  onClick={() => setFilters(prev => ({ ...prev, categories: { ...prev.categories, [key]: !on } }))}
                  className={`px-2 py-1 rounded border text-sm inline-flex items-center gap-1 ${on ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50'}`}
                >
                  <span>{ICON_EMOJI[key]}</span>
                  <span>{ICON_LABEL[key]}</span>
                </button>
              );
            })}
            {/* Platzhalter-Schalter (vorbereitet für später, bleiben aus) */}
            <label className="ml-3 inline-flex items-center gap-2 text-sm opacity-60 cursor-not-allowed">
              <input type="checkbox" checked={filters.showTodos} readOnly /> To-Do’s
            </label>
            <label className="inline-flex items-center gap-2 text-sm opacity-60 cursor-not-allowed">
              <input type="checkbox" checked={filters.showPositives} readOnly /> Positive Aktivitäten
            </label>
          </div>
        </div>

        {/* Grid */}
        <div className="p-5 overflow-auto max-h-[calc(92vh-150px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {months.map((m) => (
              <div key={m.label} className="border rounded-lg bg-white">
                <div className="px-3 py-2 border-b font-semibold bg-gray-50">{m.label}</div>
                <div className="p-3 grid grid-cols-7 gap-1 text-xs">
                  {/* Wochentagsköpfe */}
                  {['Mo','Di','Mi','Do','Fr','Sa','So'].map((w) => (
                    <div key={w} className="text-center text-[11px] text-gray-500">{w}</div>
                  ))}
                  {/* Leere Felder bis zum 1. Wochentag (Mo=1) */}
                  {(() => {
                    const weekDay = (new Date(m.year, m.month, 1).getDay() || 7);
                    const blanks = weekDay - 1;
                    return Array.from({ length: blanks }).map((_, i) => <div key={`blank-${i}`} />);
                  })()}
                  {/* Tage */}
                  {m.days.map(d => {
                    const evs = eventsByDay[d.ymd] ?? [];
                    const isToday = d.ymd === new Date().toISOString().slice(0,10);
                    return (
                      <div key={d.ymd} className={`min-h-[72px] border rounded p-1 ${isToday ? 'ring-2 ring-amber-400' : 'border-gray-200'}`}>
                        <div className="text-right text-[11px] text-gray-500">{d.d}</div>
                        <div className="space-y-0.5 mt-1">
                          {evs.slice(0,3).map(ev => (
                            <div key={ev.id} className="truncate">
                              <span className="mr-1">{ICON_EMOJI[ev.icon as UpcomingIcon]}</span>
                              <span className="font-medium">{ev.title}</span>
                              {ev.reminderTime ? <span className="text-gray-500"> {' | '} {ev.reminderTime}</span> : null}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
