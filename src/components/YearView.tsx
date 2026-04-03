import React from 'react';
import type { MonthData } from '../types';
import type { UpcomingEvent } from './UpcomingModal';
import { emojiForEvent } from '../utils/helpers';

interface YearViewProps {
  monthsForView: MonthData[];
  todayISO: string;
  curY: number;
  curM: number;
  getDayEvents: (iso: string) => UpcomingEvent[];
}

const YearView: React.FC<YearViewProps> = ({ monthsForView, todayISO, curY, curM, getDayEvents }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {monthsForView.map((m) => {
        const isCurrentMonth = m.year === curY && m.month === curM;
        return (
          <div key={`${m.year}-${m.month}`} className="border rounded-lg bg-white">
            {/* Monatskopf */}
            <div className={`px-3 py-2 border-b font-semibold ${isCurrentMonth ? 'bg-rose-100 shadow-sm' : 'bg-gray-50'}`}>
              {m.label}
            </div>

            {/* Monatstage */}
            <div className="p-3 grid grid-cols-7 gap-1 text-xs">
              {/* Wochentagsköpfe */}
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
                <div key={w} className="text-center text-[11px] text-gray-500">{w}</div>
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
                    className={`min-h-[72px] border rounded p-1 ${isToday ? 'ring-2 ring-rose-300 shadow-sm' : 'border-gray-200'}`}
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

export default YearView;
