import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, Trash2, PlusCircle } from 'lucide-react';

/* ================= Kategorien & Typen (kompatibel zur App) ================= */
export type UpcomingCategory =
  | 'birthday'
  | 'doctor'
  | 'important'
  | 'holiday'
  | 'work'
  | 'gameRelease'
  | 'gaming'
  | 'cinemaRelease'
  | 'seriesRelease'
  | 'other';

export interface UpcomingEvent {
  id: string;
  title: string;
  dateISO: string;        // YYYY-MM-DD
  reminderTime?: string;  // HH:mm
  /** neue Struktur */
  category?: UpcomingCategory;
  /** pro Eintrag frei wählbar (Emoji) */
  iconOverride?: { type: 'emoji'; value: string } | null;
  /** ältere Struktur (Kompatibilität) — evtl. noch im localStorage vorhanden */
  icon?: 'birthday'|'cinema'|'gaming'|'season'|'doctor'|'business'|'streaming'|'other';
  notes?: string;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  events: UpcomingEvent[];
  onAdd: (ev: UpcomingEvent) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSaveAll?: (list: UpcomingEvent[]) => void | Promise<void>;
};

/* ================= Standard-Emojis & Labels ================= */
const CAT_EMOJI: Record<UpcomingCategory, string> = {
  birthday:'🎂', doctor:'🩺', important:'📌', holiday:'🎉', work:'💼',
  gameRelease:'🕹️', gaming:'🎮', cinemaRelease:'🎬', seriesRelease:'📺', other:'⭐',
};
const CAT_LABEL: Record<UpcomingCategory, string> = {
  birthday:'Geburtstag', doctor:'Arzttermin', important:'Wichtiger Termin', holiday:'Feiertag', work:'Arbeit',
  gameRelease:'Game-Release', gaming:'Gaming', cinemaRelease:'Kino-Release', seriesRelease:'Serien-Release', other:'Sonstiges',
};

/* ===== Map: alte icon-Werte -> neue Kategorie (für Alt-Daten) ===== */
const OLD_TO_NEW: Record<NonNullable<UpcomingEvent['icon']>, UpcomingCategory> = {
  birthday:'birthday', cinema:'cinemaRelease', gaming:'gaming', season:'gameRelease',
  doctor:'doctor', business:'work', streaming:'seriesRelease', other:'other',
};
const getSafeCategory = (ev: UpcomingEvent): UpcomingCategory =>
  ev.category ?? (ev.icon ? (OLD_TO_NEW[ev.icon] ?? 'other') : 'other');

const displayIcon = (ev: UpcomingEvent) =>
  ev.iconOverride?.type === 'emoji' ? ev.iconOverride.value : CAT_EMOJI[getSafeCategory(ev)];

const fmtDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const sortKey = (e: UpcomingEvent) => `${e.dateISO}-${e.reminderTime ?? '99:99'}`;

/* ================= Deine Emoji-Palette ================= */
const EMOJI_PALETTE = [
  '🙂','💟','💘','❤️','🩷','🧡','💚','🩵','💜','🖤','🩶','🐈','🐈‍⬛','🐱','🐕','🐶','🐰','🦕','🦖','🐋','🦭','🐌','🦋',
  '💐','🌸','🪷','🌹','🥀','🌺','🌻','🌼','🌷','🌲','🌳','🍀','🍄','🍕','🍿','🍾','🍹','🍽️','🔪','🥢','🎃','👻','🎅','🎄',
  '✨','🎂','🎈','🎉','🎀','🎁','🎯','🎭','🏠','💈','🚆','🚗','🚨','🧳','🌙','☀️','⭐','🌟','🌈','❄️','☄️','🔥','💧',
  '👓','📣','🔔','🎵','☎️','💻','🖥️','🔮','🎮','👾','🤖','🎥','🎞️','🎬','📺','📼','🔎','🕯️','💡','📕','📓','📄',
  '💶','💸','✉️','📧','📨','📦','📫','🗳️','📮','💼','🖋️','📁','📅','📋','📌','📍','📎','🗑️','🔒','🔑','🔨','🗡️',
  '⚔️','🪚','🔧','🪛','⚖️','🔭','🦷','💊','💉','🩹','🩺','🛏️','🚽','🛁','🧼','🧽','🛒','💬','🏁'
];

/* ================= Popover: Emoji-Picker (per Eintrag) ================= */
function EmojiPopover({
  anchorEl, onPick, onClose,
}: { anchorEl: HTMLElement | null; onPick: (e: string) => void; onClose: () => void; }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && anchorEl && !anchorEl.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [anchorEl, onClose]);

  if (!anchorEl) return null;
  const r = anchorEl.getBoundingClientRect();
  const style: React.CSSProperties = { top: r.bottom + 6, left: Math.max(8, r.left - 260), position: 'fixed' };

  return (
    <div ref={ref} className="z-[210] bg-white border rounded-lg shadow-xl p-2 w-[520px]" style={style}>
      <div className="grid grid-cols-12 gap-1 text-xl">
        {EMOJI_PALETTE.map((e) => (
          <button key={e} type="button" className="h-8 w-8 rounded hover:bg-gray-100 text-center leading-8"
                  onClick={() => { onPick(e); onClose(); }} title={e}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= Modal ================= */
const UpcomingModal: React.FC<Props> = ({ isOpen, onClose, events, onAdd, onDelete, onSaveAll }) => {
  const [title, setTitle] = useState('');
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>('');
  const [category, setCategory] = useState<UpcomingCategory>('other');

  // Popover-State: welcher Eintrag hat gerade den Picker offen?
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!isOpen) return;
    (document.getElementById('up-title') as HTMLInputElement | null)?.focus();
  }, [isOpen]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () => (events || []).slice().sort((a,b)=>sortKey(a).localeCompare(sortKey(b)))
           .filter(e => (e.dateISO ?? '').localeCompare(todayISO) >= 0),
    [events, todayISO]
  );
  const archived = useMemo(
    () => (events || []).slice().sort((a,b)=>sortKey(b).localeCompare(sortKey(a)))
           .filter(e => (e.dateISO ?? '').localeCompare(todayISO) < 0),
    [events, todayISO]
  );

  const addEvent = async () => {
    const t = title.trim();
    if (!t) return;
    const ev: UpcomingEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: t,
      dateISO,
      reminderTime: time || undefined,
      category,           // neue Struktur
      iconOverride: null, // per Eintrag änderbar
    };
    await onAdd(ev);
    setTitle(''); setTime('');
  };

  const setEmojiFor = async (id: string, emoji: string) => {
    if (!onSaveAll) return;
    const next = (events || []).map(e => e.id === id ? { ...e, iconOverride: { type:'emoji', value: emoji } } : e);
    await onSaveAll(next);
  };

  const removeEvent = async (id: string) => { await onDelete(id); };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center">
      <div className="relative bg-white rounded-2xl shadow-2xl w-[780px] max-w-[96vw]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg">Demnächst</h2>
            <span className="text-gray-400 text-sm">({events?.length ?? 0})</span>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-200" aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        {/* Eingabezeile – FLEX (wrap) -> Button ragt nie raus */}
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="up-title"
              type="text"
              placeholder="Titel (z. B. Geburtstag Mama)"
              className="min-w-[220px] flex-1 border rounded px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addEvent(); }}
            />
            <select
              className="w-[160px] border rounded px-2 py-2 text-sm"
              value={category}
              onChange={(e)=> setCategory(e.target.value as UpcomingCategory)}
              title="Kategorie"
            >
              {(['birthday','doctor','important','holiday','work','gameRelease','gaming','cinemaRelease','seriesRelease','other'] as UpcomingCategory[])
                .map(k=>(<option key={k} value={k}>{CAT_EMOJI[k]} {CAT_LABEL[k]}</option>))}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-gray-500"><CalendarIcon size={16} /></span>
              <input type="date" className="border rounded px-2 py-2 text-sm" value={dateISO} onChange={(e)=>setDateISO(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500"><Clock size={16} /></span>
              <input type="time" className="border rounded px-2 py-2 text-sm" value={time} onChange={(e)=>setTime(e.target.value)} />
            </div>
            <button
              className="ml-auto shrink-0 inline-flex items-center gap-2 bg-pink-100 hover:bg-pink-200 text-pink-900 px-3 py-2 rounded-md text-sm font-medium"
              onClick={addEvent}
              title="Hinzufügen"
            >
              <PlusCircle size={16}/> Hinzufügen
            </button>
          </div>
        </div>

        {/* Listenbereich */}
        <div className="px-5 pb-5">
          {/* Kommende */}
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Kommende Termine <span className="text-gray-400">({upcoming.length})</span></h3>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 border rounded p-3">Noch keine kommenden Termine.</div>
            ) : (
              <ul className="divide-y border rounded bg-white">
                {upcoming.map(ev => {
                  const cat = getSafeCategory(ev);
                  return (
                    <li key={ev.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="h-9 w-9 rounded-md border grid place-items-center text-lg" title={`Kategorie: ${CAT_LABEL[cat]}`}>
                        {CAT_EMOJI[cat]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{displayIcon(ev)} {ev.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {fmtDay(ev.dateISO)} {ev.reminderTime ? `· ${ev.reminderTime}` : '· ganztägig'} · {CAT_LABEL[cat]}
                        </div>
                      </div>

                      <button
                        ref={(el)=>{ buttonRefs.current[ev.id] = el; }}
                        className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                        onClick={()=> setPickerForId(ev.id)}
                        title="Icon (Emoji) für diesen Eintrag ändern"
                      >
                        Icon ändern
                      </button>
                      <button className="p-2 rounded hover:bg-gray-100 text-gray-600" title="Löschen"
                              onClick={() => removeEvent(ev.id)}>
                        <Trash2 size={16}/>
                      </button>

                      {pickerForId === ev.id && (
                        <EmojiPopover
                          anchorEl={buttonRefs.current[ev.id] ?? null}
                          onPick={(emoji)=> setEmojiFor(ev.id, emoji)}
                          onClose={()=> setPickerForId(null)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Archiv */}
          <section>
            <div className="text-sm text-gray-600 mb-2">Archiv (vergangene)</div>
            {archived.length === 0 ? (
              <div className="text-sm text-gray-400">Keine vergangenen Termine.</div>
            ) : (
              <ul className="divide-y border rounded bg-white">
                {archived.map(ev => {
                  const cat = getSafeCategory(ev);
                  const key = `${ev.id}-arch`;
                  return (
                    <li key={key} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="h-9 w-9 rounded-md border grid place-items-center text-lg" title={`Kategorie: ${CAT_LABEL[cat]}`}>
                        {CAT_EMOJI[cat]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{displayIcon(ev)} {ev.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {fmtDay(ev.dateISO)} {ev.reminderTime ? `· ${ev.reminderTime}` : '· ganztägig'} · {CAT_LABEL[cat]}
                        </div>
                      </div>
                      <button
                        ref={(el)=>{ buttonRefs.current[key] = el; }}
                        className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                        onClick={()=> setPickerForId(key)}
                        title="Icon (Emoji) für diesen Eintrag ändern"
                      >
                        Icon ändern
                      </button>
                      <button className="p-2 rounded hover:bg-gray-100 text-gray-600" title="Löschen"
                              onClick={() => removeEvent(ev.id)}>
                        <Trash2 size={16}/>
                      </button>

                      {pickerForId === key && (
                        <EmojiPopover
                          anchorEl={buttonRefs.current[key] ?? null}
                          onPick={(emoji)=> setEmojiFor(ev.id, emoji)}
                          onClose={()=> setPickerForId(null)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default UpcomingModal;
