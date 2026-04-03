import React from 'react';
import {
  ListTodo, Sun, Star, ShoppingBasket, Award, Bell, Sticker,
  Droplet, DropletOff, HandCoins, Trash2,
} from 'lucide-react';
import { reminderIcons } from '../constants';
import { emojiForEvent } from '../utils/helpers';
import type { UpcomingEvent } from './UpcomingModal';

interface SidebarProps {
  // Navigation
  onGoToPlaner: () => void;
  onGoToWatchlist: () => void;

  // Drag & Drop
  setDragItem: React.Dispatch<React.SetStateAction<any>>;
  setDragType: React.Dispatch<React.SetStateAction<'text' | 'sticker' | 'reminder' | null>>;

  // To-Dos
  todoList: string[];
  setTodoList: React.Dispatch<React.SetStateAction<string[]>>;
  newTodo: string;
  setNewTodo: React.Dispatch<React.SetStateAction<string>>;
  todoCollapsed: boolean;
  setTodoCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  // Positive Aktivitäten
  activityList: string[];
  setActivityList: React.Dispatch<React.SetStateAction<string[]>>;
  newActivity: string;
  setNewActivity: React.Dispatch<React.SetStateAction<string>>;
  activitiesCollapsed: boolean;
  setActivitiesCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  // Reminder
  remindersCollapsed: boolean;
  setRemindersCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  // Demnächst (Upcoming)
  upcomingCollapsed: boolean;
  setUpcomingCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  upcoming: UpcomingEvent[];
  next10: UpcomingEvent[];
  setUpcomingOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Erledigt
  doneCollapsed: boolean;
  setDoneCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setDoneOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Sticker
  stickersCollapsed: boolean;
  setStickersCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  customStickers: string[];
  setCustomStickers: React.Dispatch<React.SetStateAction<string[]>>;

  // Einkaufsliste
  shoppingCollapsed: boolean;
  setShoppingCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  shoppingList: string[];
  setShoppingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOffersOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const {
    onGoToPlaner, onGoToWatchlist,
    setDragItem, setDragType,
    todoList, setTodoList, newTodo, setNewTodo, todoCollapsed, setTodoCollapsed,
    activityList, setActivityList, newActivity, setNewActivity, activitiesCollapsed, setActivitiesCollapsed,
    remindersCollapsed, setRemindersCollapsed,
    upcomingCollapsed, setUpcomingCollapsed, upcoming, next10, setUpcomingOpen,
    doneCollapsed, setDoneCollapsed, setDoneOpen,
    stickersCollapsed, setStickersCollapsed, customStickers, setCustomStickers,
    shoppingCollapsed, setShoppingCollapsed, shoppingList, setShoppingOpen, setOffersOpen,
  } = props;

  return (
    <aside className="w-72 min-w-[18rem] max-w-[18rem] flex-shrink-0 overflow-auto pt-[12px] p-4 border-l bg-white mt-[17px]">

      {/* Planer-Link */}
      <div className="flex items-center justify-between mb-6">
        <div
          role="button"
          onClick={onGoToPlaner}
          className="flex items-center gap-2 cursor-pointer select-none"
          title="Zum Planer (Kalender) wechseln"
        >
          <h2 className="text-base font-bold flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Planer</span>
          </h2>
        </div>
        <span className="w-5" />
      </div>
      <div className="h-4 shrink-0" />

      {/* To-Dos */}
      <div className="mt-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold flex items-center gap-2"><ListTodo size={18} /> To-Dos</h2>
          <button
            className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => setTodoCollapsed(v => !v)}
          >
            {todoCollapsed ? '+' : '−'}
          </button>
        </div>
        {!todoCollapsed && (
          <>
            <ul className="space-y-1 mt-2">
              {todoList.map((item, i) => (
                <li
                  key={i}
                  className="py-[7px] px-[12px] rounded bg-gray-100 cursor-move"
                  draggable
                  onDragStart={() => { setDragItem({ text: item, tag: 'todo' }); setDragType('text'); }}
                  onDoubleClick={(e) => { if (e.ctrlKey || e.metaKey) setTodoList(todoList.filter((_, idx) => idx !== i)); }}
                  title="Entfernen: STRG/Cmd + Doppelklick"
                >
                  {item}
                </li>
              ))}
            </ul>
            <input
              type="text"
              placeholder="Hinzufügen."
              className="w-full text-sm mt-2 border px-2 py-1 rounded"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = newTodo.trim();
                  if (v) setTodoList([...todoList, v]);
                  setNewTodo('');
                }
              }}
            />
          </>
        )}
      </div>

      {/* Positive Aktivitäten */}
      <div className="mt-[44px]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold flex items-center gap-2"><Sun size={18} /> Positive Aktivitäten</h2>
          <button
            className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => setActivitiesCollapsed(v => !v)}
          >
            {activitiesCollapsed ? '+' : '−'}
          </button>
        </div>
        {!activitiesCollapsed && (
          <>
            <ul className="space-y-1 mt-2">
              {activityList.map((item, i) => (
                <li
                  key={i}
                  className="py-[7px] px-[12px] rounded bg-gray-100 cursor-move"
                  draggable
                  onDragStart={() => { setDragItem({ text: item, tag: 'positive' }); setDragType('text'); }}
                  onDoubleClick={(e) => { if (e.ctrlKey || e.metaKey) setActivityList(activityList.filter((_, idx) => idx !== i)); }}
                  title="Entfernen: STRG/Cmd + Doppelklick"
                >
                  {item}
                </li>
              ))}
            </ul>
            <input
              type="text"
              placeholder="Hinzufügen."
              className="w-full text-sm mt-2 border px-2 py-1 rounded"
              value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = newActivity.trim();
                  if (v) setActivityList([...(Array.isArray(activityList) ? activityList : []), v]);
                  setNewActivity('');
                }
              }}
            />
          </>
        )}
      </div>

      {/* Reminder */}
      <div className="mt-[44px]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold flex items-center gap-2"><Bell size={18} /> Reminder</h2>
          <button
            className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => setRemindersCollapsed(v => !v)}
          >
            {remindersCollapsed ? '+' : '−'}
          </button>
        </div>
        {!remindersCollapsed && (
          <div className="mt-2">
            <div className="text-xs text-gray-500">Ziehe ein Icon in einen Tageskasten.</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {reminderIcons.map((r, ri) => (
                <div
                  key={ri}
                  className="w-6 h-6 grid place-items-center rounded bg-gray-100 cursor-move select-none"
                  draggable
                  onDragStart={() => { setDragItem(r); setDragType('reminder'); }}
                  title={r.tooltip}
                >
                  {r.icon === 'droplet'    && <Droplet    size={16} color={r.color} />}
                  {r.icon === 'dropletoff' && <DropletOff size={16} color={r.color} />}
                  {r.icon === 'handcoins'  && <HandCoins  size={16} color={r.color} />}
                  {r.icon.startsWith('trash') && <Trash2 size={16} color={r.color} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Demnächst (Upcoming) */}
      <div className="mt-[44px]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold flex items-center gap-2"><Star size={18} /> Demnächst</h2>
          <button
            className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => setUpcomingCollapsed(v => !v)}
          >
            {upcomingCollapsed ? '+' : '−'}
          </button>
        </div>
        {!upcomingCollapsed && (
          <div className="mt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setUpcomingOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#f9e2ca] hover:brightness-95"
              >
                Demnächst-Liste öffnen ({upcoming.length})
              </button>
            </div>
            <ul className="mt-3 space-y-1 max-h-52 overflow-auto">
              {next10.length === 0 && <li className="text-sm text-gray-500">Noch keine Einträge</li>}
              {next10.map((ev) => (
                <li key={ev.id} className="text-sm flex items-center gap-2">
                  <span className="text-base">{emojiForEvent(ev)}</span>
                  <span className="truncate">{ev.title}</span>
                  <span className="text-gray-500 ml-auto">
                    {new Date(ev.dateISO + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
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
          <button
            className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => setDoneCollapsed(v => !v)}
          >
            {doneCollapsed ? '+' : '−'}
          </button>
        </div>
        {!doneCollapsed && (
          <div className="mt-2">
            <button
              onClick={() => setDoneOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-100 hover:brightness-95"
            >
              Erledigt-Liste öffnen
            </button>
          </div>
        )}
      </div>

      {/* Sticker */}
      <div className="mt-[44px]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold flex items-center gap-2"><Sticker size={18} /> Sticker</h2>
          <button
            className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => setStickersCollapsed(v => !v)}
          >
            {stickersCollapsed ? '+' : '−'}
          </button>
        </div>
        {!stickersCollapsed && (
          <>
            <div className="flex flex-wrap gap-2 mt-2">
              {customStickers.map((src, i) => (
                <img
                  key={`${i}-${src.slice(0, 15)}`}
                  src={src}
                  alt="Sticker"
                  className="w-12 h-12 cursor-move"
                  draggable
                  onDragStart={() => { setDragItem(src); setDragType('sticker'); }}
                  onDoubleClick={(e) => { if (e.ctrlKey || e.metaKey) setCustomStickers(customStickers.filter((_, idx) => idx !== i)); }}
                  title="Sticker entfernen: STRG/Cmd + Doppelklick"
                />
              ))}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setCustomStickers(prev => [...prev, r.result as string]);
                r.readAsDataURL(f);
              }}
              className="mt-2 w-full text-transparent file:cursor-pointer file:rounded-full file:border-0 file:bg-violet-100 file:text-violet-700 file:px-3 file:py-1 file:text-sm file:font-semibold hover:file:bg-violet-200 file:transition file:duration-200 overflow-hidden"
            />
          </>
        )}
      </div>

      {/* Einkaufsliste */}
      <div className="mt-[44px]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ShoppingBasket size={18} color="black" /> Einkaufsliste
          </h2>
          <button
            className="ml-auto px-2 py-0.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => setShoppingCollapsed(v => !v)}
          >
            {shoppingCollapsed ? '+' : '−'}
          </button>
        </div>
        {!shoppingCollapsed && (
          <div className="mt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setShoppingOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-100 hover:brightness-95"
              >
                Einkaufsliste öffnen ({shoppingList.length})
              </button>
              <button
                onClick={() => setOffersOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-amber-100 hover:brightness-95"
              >
                Angebote
              </button>
            </div>
            <ul className="mt-3 space-y-1 max-h-52 overflow-auto">
              {(!Array.isArray(shoppingList) || shoppingList.length === 0) && (
                <li className="text-sm text-gray-500">Noch keine Einträge</li>
              )}
              {Array.isArray(shoppingList) && shoppingList.slice(0, 10).map((it, idx) => (
                <li key={idx} className="text-sm text-gray-700 truncate">– {it}</li>
              ))}
              {Array.isArray(shoppingList) && shoppingList.length > 10 && (
                <li className="text-xs text-gray-400">… {shoppingList.length - 10} weitere</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Watchlist */}
      <div className="mt-[44px]">
        <div
          role="button"
          onClick={onGoToWatchlist}
          className="flex items-center gap-2 cursor-pointer select-none"
          title="Zur Watchlist wechseln"
        >
          <h2 className="text-base font-bold flex items-center gap-2">
            <svg className="w-4 h-4 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="15" rx="2"/>
              <polyline points="17 2 12 7 7 2"/>
            </svg>
            <span>Watchlist</span>
          </h2>
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;
