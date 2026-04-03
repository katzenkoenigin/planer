import React from 'react';
import { baseWeatherIconTitle, alertIcons, type WeatherByDate } from '../utils/weather';

interface WeatherBadgeProps {
  iso?: string;
  weatherEnabled: boolean;
  twoWeekSet: Set<string>;
  weatherByDate: WeatherByDate;
}

const WeatherBadge: React.FC<WeatherBadgeProps> = ({ iso, weatherEnabled, twoWeekSet, weatherByDate }) => {
  if (!weatherEnabled) return null;
  if (!iso || !twoWeekSet.has(iso)) return null;
  const w = weatherByDate[iso];
  if (!w) return null;

  const base = baseWeatherIconTitle(w.code);
  const alerts = alertIcons(w).filter(a => a.emoji !== base.emoji);

  return (
    <div className="flex items-center gap-[4px] text-xs leading-none">
      {alerts.map((a, i) => (
        <span key={i} title={a.title} className="text-sm">{a.emoji}</span>
      ))}
      <span className="text-sm" title={base.title}>{base.emoji}</span>
      <span className="text-gray-300 mx-[2px]">|</span>
      <span className="text-rose-600 font-semibold">{w.tmax}°</span>
      <span className="text-gray-300 mx-[2px]">|</span>
      <span className="text-sky-600 font-semibold">{w.tmin}°</span>
    </div>
  );
};

export default WeatherBadge;
