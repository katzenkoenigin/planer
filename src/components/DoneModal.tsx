import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Filter,
  CalendarCheck,
  Flame,
  Trophy,
  BarChart3,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  CheckCircle
} from 'lucide-react';

/* ---------- Types ---------- */
type CalendarItem = {
  text: string;
  done: boolean;
  time?: string;
  doneAt?: string; // ISO Zeitstempel, wenn abgehakt
};
type CalendarCell = {
  date: string;
  isoDate?: string; // YYYY-MM-DD
  items: CalendarItem[];
  stickers: any[];
  reminders: any[];
};
type DoneEntry = {
  id: string;        // stable id (iso + index)
  text: string;
  dateISO: string;   // Tag der Zelle
  time?: string;
  doneAt?: string;   // wann abgehakt
};
type AnyEntry = {
  id: string;
  dateISO: string;
  done: boolean;
  doneAt?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/* -------------------- LocalStorage Keys -------------------- */
const ARCHIVE_IDS_KEY = 'DONE_ARCHIVED_IDS_V1';
const HIDE_30_KEY = 'DONE_HIDE_30_V1';

/* -------------------- Date helpers -------------------- */
const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfDay = (d: Date) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};
const fmtDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });

/* -------------------- Collect from storage -------------------- */
function generateISOsFromKey(key: string, length: number): string[] | null {
  const m = /^KW_(\d{4}-\d{2}-\d{2})_(\d+)/.exec(key);
  if (!m) return null;
  const mondayISO = m[1];
  const monday = new Date(mondayISO + 'T00:00:00');
  if (isNaN(monday.getTime())) return null;
  return Array.from({ length }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function collectAllDoneFromLocalStorage(): DoneEntry[] {
  const out: DoneEntry[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('KW_')) continue;

    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const map = parsed as Record<string, CalendarCell>;
        for (const iso of Object.keys(map)) {
          const cell = map[iso];
          if (!cell || !Array.isArray(cell.items)) continue;
          cell.items.forEach((it, idx) => {
            if (it && it.done) {
              out.push({
                id: `${iso}#${idx}`,
                text: it.text,
                dateISO: iso,
                time: it.time,
                doneAt: it.doneAt,
              });
            }
          });
        }
        continue;
      }

      if (Array.isArray(parsed)) {
        const arr = parsed as CalendarCell[];
        const isos = generateISOsFromKey(k, arr.length);
        if (!isos) continue;
        for (let idx = 0; idx < arr.length; idx++) {
          const cell = arr[idx];
          const iso = isos[idx];
          if (!cell || !Array.isArray(cell.items)) continue;
          cell.items.forEach((it, jdx) => {
            if (it && it.done) {
              out.push({
                id: `${iso}#${jdx}`,
                text: it.text,
                dateISO: iso,
                time: it.time,
                doneAt: it.doneAt,
              });
            }
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  out.sort((a, b) => {
    const ad = a.doneAt ?? a.dateISO;
    const bd = b.doneAt ?? b.dateISO;
    return bd.localeCompare(ad);
  });
  return out;
}

function collectAllItemsFromLocalStorage(): AnyEntry[] {
  const out: AnyEntry[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('KW_')) continue;

    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const map = parsed as Record<string, CalendarCell>;
        for (const iso of Object.keys(map)) {
          const cell = map[iso];
          if (!cell || !Array.isArray(cell.items)) continue;
          cell.items.forEach((it, idx) => {
            out.push({
              id: `${iso}#${idx}`,
              dateISO: iso,
              done: !!it.done,
              doneAt: it.doneAt,
            });
          });
        }
        continue;
      }

      if (Array.isArray(parsed)) {
        const arr = parsed as CalendarCell[];
        const isos = generateISOsFromKey(k, arr.length);
        if (!isos) continue;
        for (let idx = 0; idx < arr.length; idx++) {
          const cell = arr[idx];
          const iso = isos[idx];
          if (!cell || !Array.isArray(cell.items)) continue;
          cell.items.forEach((it, jdx) => {
            out.push({
              id: `${iso}#${jdx}`,
              dateISO: iso,
              done: !!it.done,
              doneAt: it.doneAt,
            });
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  return out;
}

/* -------------------- Component -------------------- */
export default function DoneModal({ isOpen, onClose }: Props) {
  const [filter, setFilter] = useState<'week' | 'month' | 'all'>('week');
  const [entries, setEntries] = useState<DoneEntry[]>([]);
  const [allItems, setAllItems] = useState<AnyEntry[]>([]);

  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(ARCHIVE_IDS_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  const [hideOlderThan30, setHideOlderThan30] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(HIDE_30_KEY);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isOpen) {
      setEntries(collectAllDoneFromLocalStorage());
      setAllItems(collectAllItemsFromLocalStorage());
    }
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(ARCHIVE_IDS_KEY, JSON.stringify(Array.from(archivedIds)));
    } catch {}
  }, [archivedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(HIDE_30_KEY, hideOlderThan30 ? 'true' : 'false');
    } catch {}
  }, [hideOlderThan30]);

  const now = new Date();
  const monday = getMonday(now);
  const sunday = endOfDay(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const inWeek = (d: Date) => d >= monday && d <= sunday;
  const inMonth = (d: Date) => d >= monthStart && d <= monthEnd;

  const isOlderThan30 = (e: DoneEntry) => {
    const basis = e.doneAt ? new Date(e.doneAt) : new Date(e.dateISO + 'T00:00:00');
    const diff = now.getTime() - basis.getTime();
    return diff > 30 * 24 * 60 * 60 * 1000;
  };

  const filteredBase = useMemo(() => {
    const scope = entries.filter((e) => {
      const basis = e.doneAt ? new Date(e.doneAt) : new Date(e.dateISO + 'T00:00:00');
      return filter === 'week' ? inWeek(basis) : filter === 'month' ? inMonth(basis) : true;
    });
    const notArchived = scope.filter((e) => !archivedIds.has(e.id));
    return hideOlderThan30 ? notArchived.filter((e) => !isOlderThan30(e)) : notArchived;
  }, [entries, filter, archivedIds, hideOlderThan30]);

  const archivedList = useMemo(() => {
    const scope = entries.filter((e) => {
      const basis = e.doneAt ? new Date(e.doneAt) : new Date(e.dateISO + 'T00:00:00');
      return filter === 'week' ? inWeek(basis) : filter === 'month' ? inMonth(basis) : true;
    });
    return scope.filter((e) => archivedIds.has(e.id));
  }, [entries, filter, archivedIds]);

  const groupByDay = (list: DoneEntry[]) => {
    const map = new Map<string, DoneEntry[]>();
    for (const e of list) {
      if (!map.has(e.dateISO)) map.set(e.dateISO, []);
      map.get(e.dateISO)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const byDay = useMemo(() => groupByDay(filteredBase), [filteredBase]);
  const byDayArchived = useMemo(() => groupByDay(archivedList), [archivedList]);

  const countWeek = useMemo(
    () =>
      entries.filter((e) => {
        const d = e.doneAt ? new Date(e.doneAt) : new Date(e.dateISO + 'T00:00:00');
        return inWeek(d) && !archivedIds.has(e.id) && (!hideOlderThan30 || !isOlderThan30(e));
      }).length,
    [entries, archivedIds, hideOlderThan30]
  );
  const countMonth = useMemo(
    () =>
      entries.filter((e) => {
        const d = e.doneAt ? new Date(e.doneAt) : new Date(e.dateISO + 'T00:00:00');
        return inMonth(d) && !archivedIds.has(e.id) && (!hideOlderThan30 || !isOlderThan30(e));
      }).length,
    [entries, archivedIds, hideOlderThan30]
  );
  const completion = useMemo(() => {
    const allInScope = allItems.filter((it) => {
      const d = new Date(it.dateISO + 'T00:00:00');
      if (filter === 'week') return inWeek(d);
      if (filter === 'month') return inMonth(d);
      return true;
    });
    const visibleDoneIds = new Set(filteredBase.map((e) => e.id));
    const doneInScope = allInScope.filter((x) => visibleDoneIds.has(x.id)).length;
    const rate = allInScope.length ? Math.round((doneInScope / allInScope.length) * 100) : 0;
    return { total: allInScope.length, done: doneInScope, rate };
  }, [allItems, filteredBase, filter]);

  const topDay = useMemo(() => {
    if (!filteredBase.length) return null;
    const m = new Map<string, number>();
    for (const e of filteredBase) m.set(e.dateISO, (m.get(e.dateISO) ?? 0) + 1);
    let bestIso = '', best = -1;
    for (const [iso, v] of m.entries()) if (v > best) { best = v; bestIso = iso; }
    return { iso: bestIso, count: best };
  }, [filteredBase]);

  const countEligibleArchive = useMemo(
    () => entries.filter((e) => isOlderThan30(e) && !archivedIds.has(e.id)).length,
    [entries, archivedIds]
  );
  const archiveOlderThan30 = () => {
    if (countEligibleArchive === 0) return;
    const next = new Set(archivedIds);
    for (const e of entries) {
      if (isOlderThan30(e)) next.add(e.id);
    }
    setArchivedIds(next);
  };
  const unarchiveOne = (id: string) => {
    const next = new Set(archivedIds);
    next.delete(id);
    setArchivedIds(next);
  };

  const [showArchive, setShowArchive] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="w-[min(900px,92vw)] max-h-[86vh] overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2 font-semibold">
            <CalendarCheck size={20} className="text-emerald-600" />
            Erledigt
          </div>
          <button className="p-2 rounded hover:bg-black/5" aria-label="Schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Mini-Statistik */}
        <div className="px-5 py-3 border-b grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Flame className="text-emerald-600" size={18} />
            <div className="leading-tight">
              <div className="text-xs text-gray-500">Diese Woche</div>
              <div className="font-semibold">{countWeek} erledigt</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Trophy className="text-amber-600" size={18} />
            <div className="leading-tight">
              <div className="text-xs text-gray-500">Dieser Monat</div>
              <div className="font-semibold">{countMonth} erledigt</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <BarChart3 className="text-indigo-600" size={18} />
            <div className="leading-tight">
              <div className="text-xs text-gray-500">
                Erfolgsquote {filter === 'week' ? '(Woche)' : filter === 'month' ? '(Monat)' : '(Gesamt)'}
              </div>
              <div className="font-semibold">
                {completion.rate}% <span className="text-xs text-gray-500">({completion.done}/{completion.total})</span>
              </div>
            </div>
          </div>

          {/* Zeile mit 30-Tage/Archiv-Aktionen */}
          <div className="sm:col-span-3 flex flex-wrap items-center gap-2 mt-1">
            <button
              onClick={() => setHideOlderThan30((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-gray-50"
              title="Ältere als 30 Tage ausblenden / wieder anzeigen"
            >
              {hideOlderThan30 ? <EyeOff size={16} /> : <Eye size={16} />}
              {hideOlderThan30 ? 'Älter als 30 Tage ausblenden: AN' : 'Älter als 30 Tage ausblenden: AUS'}
            </button>

            <button
              onClick={archiveOlderThan30}
              disabled={countEligibleArchive === 0}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border ${countEligibleArchive ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
              title="Alle erledigten Einträge, die älter als 30 Tage sind, ins Archiv verschieben"
            >
              <Archive size={16} />
              {`>30 Tage archivieren (${countEligibleArchive})`}
            </button>

            <button
              onClick={() => setShowArchive((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-gray-50"
              title="Archivierte Einträge anzeigen/ausblenden"
            >
              <Archive size={16} />
              {showArchive ? 'Archiv ausblenden' : 'Archiv anzeigen'}
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="px-5 py-3 flex items-center gap-2 border-b">
          <Filter size={16} className="text-gray-500" />
          <div className="inline-flex rounded-lg overflow-hidden border">
            <button
              className={`px-3 py-1.5 text-sm ${filter === 'week' ? 'bg-emerald-100' : 'hover:bg-gray-50'}`}
              onClick={() => setFilter('week')}
            >
              Diese Woche
            </button>
            <button
              className={`px-3 py-1.5 text-sm border-l ${filter === 'month' ? 'bg-emerald-100' : 'hover:bg-gray-50'}`}
              onClick={() => setFilter('month')}
            >
              Dieser Monat
            </button>
            <button
              className={`px-3 py-1.5 text-sm border-l ${filter === 'all' ? 'bg-emerald-100' : 'hover:bg-gray-50'}`}
              onClick={() => setFilter('all')}
            >
              Alle
            </button>
          </div>
          <span className="ml-auto text-sm text-gray-500">{filteredBase.length} Einträge</span>
        </div>

        {/* Liste: Aktuelle (sichtbare) Einträge – mit grünen Häkchen */}
        <div className="p-5 max-h-[45vh] overflow-auto">
          {byDay.length === 0 ? (
            <div className="text-sm text-gray-500">Keine Einträge im gewählten Zeitraum (nach Filtern/Archiv).</div>
          ) : (
            <div className="space-y-6">
              {byDay.map(([iso, items]) => (
                <section key={iso}>
                  <h3 className="font-medium mb-2">{fmtDay(iso)}</h3>
                  <ul className="space-y-1">
                    {items.map((e) => (
                      <li key={e.id} className="text-sm flex items-center gap-2">
                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                        <span className="flex-1">
                          {e.text}
                          {e.time ? <span className="text-gray-500"> · {e.time}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Archiv-Bereich (optional) – unverändert */}
        {showArchive && (
          <div className="px-5 pb-5 max-h-[28vh] overflow-auto border-t">
            <h3 className="mt-4 mb-2 font-semibold flex items-center gap-2">
              <Archive size={16} /> Archivierte Einträge
              <span className="text-xs text-gray-500">({archivedList.length})</span>
            </h3>

            {byDayArchived.length === 0 ? (
              <div className="text-sm text-gray-500">Keine archivierten Einträge (im gewählten Filter).</div>
            ) : (
              <div className="space-y-6">
                {byDayArchived.map(([iso, items]) => (
                  <section key={`arch-${iso}`}>
                    <h4 className="font-medium mb-2">{fmtDay(iso)}</h4>
                    <ul className="space-y-1">
                      {items.map((e) => (
                        <li key={`arch-${e.id}`} className="text-sm flex items-center gap-2">
                          {/* Archiv-Listendarstellung bleibt bei Spiegelstrich/Plain-Text */}
                          <span className="flex-1">
                            • {e.text}
                            {e.time ? <span className="text-gray-500"> · {e.time}</span> : null}
                          </span>
                          <button
                            onClick={() => unarchiveOne(e.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border hover:bg-gray-50"
                            title="Aus Archiv wiederherstellen"
                          >
                            <ArchiveRestore size={14} /> Wiederherstellen
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
