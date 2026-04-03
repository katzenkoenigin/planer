import type { UpcomingCategory } from './components/UpcomingModal';

export type Cat = UpcomingCategory;

export interface PositionedSticker {
  src: string;
  x: number;
  y: number;
}

export interface CalendarItem {
  text: string;
  done: boolean;
  time?: string;
  reminder?: boolean;
  doneAt?: string;
  tag?: 'todo' | 'positive';
}

export interface CalendarReminder {
  icon: string;
  tooltip: string;
  color: string;
}

export interface CalendarCell {
  date: string;
  isoDate?: string;
  items: CalendarItem[];
  stickers: PositionedSticker[];
  reminders: CalendarReminder[];
}

export type GlobalView = 'weeks' | '3m' | '6m' | '12m' | 'watchlist';

export type YearFilters = {
  categories: Record<Cat, boolean>;
  showTodos: boolean;
  showPositives: boolean;
};

export interface MonthData {
  year: number;
  month: number;
  label: string;
  days: { ymd: string; d: number }[];
}
