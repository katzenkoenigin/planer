import type { Cat, CalendarReminder } from './types';

// ============================
// Reminder Icons
// ============================
export const reminderIcons: CalendarReminder[] = [
  { tooltip: 'Blaue Tonne rausstellen',   icon: 'trash-blue',   color: '#4969B6' },
  { tooltip: 'Gelbe Tonne rausstellen',   icon: 'trash-yellow', color: '#D1B93B' },
  { tooltip: 'Grüne Tonne rausstellen',   icon: 'trash-green',  color: '#619E5A' },
  { tooltip: 'Schwarze Tonne rausstellen',icon: 'trash-black',  color: '#212526' },
  { tooltip: 'Erdbeerwoche (Beginn)',      icon: 'droplet',      color: 'magenta' },
  { tooltip: 'Erdbeerwoche (Ende)',        icon: 'dropletoff',   color: 'cyan'    },
];

// ============================
// Design Configs
// ============================
export const designConfigs = {
  hearty: { name: 'Hearty', headerImage: '/Hearty rose.png',      backgroundColor: '#edcde2', week2Color: '#c67c9f', week4Color: '#bb9fe1' },
  doggo:  { name: 'Doggo',  headerImage: '/Doggo.png',            backgroundColor: '#fef8f2', week2Color: '#d3885f', week4Color: '#c67c9f' },
  purple: { name: 'Lila',   headerImage: '/Header_purple.png',    backgroundColor: '#d3cfff', week2Color: '#a78bfa', week4Color: '#bb9fe1' },
};
export type DesignKey = keyof typeof designConfigs;

// ============================
// LocalStorage Keys
// ============================
export const TODO_KEY               = 'SIDEBAR_TODO_V1';
export const ACTIVITIES_KEY         = 'SIDEBAR_ACTIVITIES_V1';
export const ACTIVITIES_LEGACY_KEYS = ['SIDEBAR_ACTIVITIES', 'PositiveActivities', 'ACTIVITIES'];
export const STICKERS_PRIMARY_KEY   = 'SIDEBAR_STICKERS_V1';
export const STICKERS_LEGACY_KEYS   = ['SIDEBAR_STICKERS', 'customStickers', 'STICKERS'];
export const SHOPPING_KEY           = 'SHOPPING_LIST_V1';
export const DISCORD_WEBHOOK_KEY    = 'DISCORD_WEBHOOK_URL';
export const BOT_ENDPOINT_KEY       = 'DISCORD_BOT_ENDPOINT';
export const BOT_SECRET_KEY         = 'DISCORD_BOT_SHARED_SECRET';
export const DM_USER_IDS_KEY        = 'DISCORD_DM_USER_IDS';
export const YEAR_FILTERS_KEY       = 'YEAR_VIEW_FILTERS_V2';
export const UPCOMING_KEYS          = ['UPCOMING_EVENTS_V2', 'UPCOMING_EVENTS_V1', 'upcomingEvents_v1'];
export const WEATHER_CACHE_KEY      = 'WEATHER_CACHE_V2';
export const WEATHER_CITY_KEY       = 'WEATHER_CITY_V1';
export const WEATHER_COORD_KEY      = 'WEATHER_COORD_V1';
export const WEATHER_ENABLED_KEY    = 'WEATHER_ENABLED_V1';
export const TMDB_API_KEY_KEY       = 'TMDB_API_KEY';
export const DESIGN_KEY             = 'PLANNER_DESIGN_V1';

// ============================
// Upcoming Category Labels & Emojis
// ============================
export const CAT_LABEL: Record<Cat, string> = {
  birthday:      'Geburtstag',
  doctor:        'Arzttermin',
  important:     'Wichtiger Termin',
  holiday:       'Feiertag',
  work:          'Arbeit',
  gameRelease:   'Game-Release',
  gaming:        'Gaming',
  cinemaRelease: 'Kino-Release',
  seriesRelease: 'Serien-Release',
  other:         'Sonstiges',
};

export const CAT_EMOJI: Record<Cat, string> = {
  birthday:      '🎂',
  doctor:        '🩺',
  important:     '📌',
  holiday:       '🎉',
  work:          '💼',
  gameRelease:   '🕹️',
  gaming:        '🎮',
  cinemaRelease: '🎬',
  seriesRelease: '📺',
  other:         '⭐',
};
