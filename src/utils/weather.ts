// src/utils/weather.ts
export type WeatherDay = {
  tmax: number;
  tmin: number;
  code: number;
  windGustMax?: number;
  windSpeedMax?: number;
  precipSum?: number;
};

export type WeatherByDate = Record<string, WeatherDay>;

/** Deutscher Klartext für WMO weathercode (volle Beschreibung) */
export function weatherDescription(code: number): string {
  if (code === 0) return 'Sonnig';
  if (code === 1) return 'Überwiegend sonnig';
  if (code === 2) return 'Wechselnd bewölkt';
  if (code === 3) return 'Bewölkt';
  if (code === 45 || code === 48) return 'Nebel';
  if ([51, 53, 55].includes(code)) return 'Nieselregen';
  if ([56, 57].includes(code)) return 'Gefrierender Nieselregen';
  if ([61, 63, 65].includes(code)) return 'Regen';
  if ([66, 67].includes(code)) return 'Gefrierender Regen';
  if ([80, 81, 82].includes(code)) return 'Regenschauer';
  if ([71, 73, 75].includes(code)) return 'Schnee';
  if ([85, 86].includes(code)) return 'Schneeschauer';
  if (code === 95) return 'Gewitter';
  if (code === 96 || code === 99) return 'Gewitter mit Hagel';
  return 'Wetter';
}

/** Basis-Icon + -Titel (rechts, immer anzeigen).
 *  Wichtig: Gewitter & Nebel -> hier NICHT als Spezialicon,
 *  sondern auf "Regen" bzw. "Bewölkt" abbilden.
 */
export function baseWeatherIconTitle(code: number): { emoji: string; title: string } {
  if (code === 0) return { emoji: '☀️', title: 'Sonnig' };
  if (code === 1 || code === 2) return { emoji: '🌤️', title: 'Wolkig' };
  if (code === 3) return { emoji: '⛅', title: 'Bewölkt' };

  // Nebel (45/48) -> Basis als "Bewölkt"
  if (code === 45 || code === 48) return { emoji: '☁️', title: 'Bewölkt' };

  // Regen & Varianten
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { emoji: '🌧️', title: 'Regen' };
  }

  // Schnee
  if ([71, 73, 75, 85, 86].includes(code)) return { emoji: '🌨️', title: 'Schnee' };

  // Gewitter (95/96/99) -> Basis als "Regen"
  if ([95, 96, 99].includes(code)) return { emoji: '🌧️', title: 'Regen' };

  return { emoji: '🌡️', title: 'Wetter' };
}

/** Alert-Icons (links, nur bei Bedarf, max. 3) */
export function alertIcons(day: WeatherDay): { emoji: string; title: string }[] {
  const out: { emoji: string; title: string }[] = [];

  // Gewitter
  if ([95, 96, 99].includes(day.code)) out.push({ emoji: '⛈️', title: 'Gewitter' });

  // Nebel
  if ([45, 48].includes(day.code)) out.push({ emoji: '🌫️', title: 'Nebel' });

  // Glatteis
  const tmin = typeof day.tmin === 'number' ? day.tmin : 99;
  const precip = typeof day.precipSum === 'number' ? day.precipSum : 0;
  if ([66, 67, 56, 57].includes(day.code) || (tmin <= 0 && precip > 0)) {
    out.push({ emoji: '🧊', title: 'Glatteis' });
  }

  // Frost
  if (tmin <= -2) out.push({ emoji: '❄️', title: 'Frost' });

  // Wind/Sturm -> robust mit max(Gust, WindSpeed)
  const gust = typeof day.windGustMax === 'number' ? day.windGustMax : 0;
  const wind = typeof day.windSpeedMax === 'number' ? day.windSpeedMax : 0;
  const maxWind = Math.max(gust, wind);
  if (maxWind >= 75) out.push({ emoji: '🌪️', title: 'Sturm' });
  else if (maxWind >= 55) out.push({ emoji: '💨', title: 'Windböen' });

  return out.slice(0, 3);
}

/** Open-Meteo Geocoding – akzeptiert Stadt & meist auch PLZ */
export async function geocodeCity(
  name: string
): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=de&format=json`;
    const res = await fetch(url);
    const data: any = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return {
      lat: hit.latitude,
      lon: hit.longitude,
      label: `${hit.name}${hit.country ? ', ' + hit.country : ''}`,
    };
  } catch {
    return null;
  }
}

/** 2-Wochen-Vorhersage (täglich) */
export async function fetchForecast(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string
): Promise<WeatherByDate> {
  const daily =
    'weathercode,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${daily}&timezone=auto&start_date=${startISO}&end_date=${endISO}`;
  const res = await fetch(url);
  const data: any = await res.json();

  const days: string[] = data?.daily?.time ?? [];
  const tmax: number[] = data?.daily?.temperature_2m_max ?? [];
  const tmin: number[] = data?.daily?.temperature_2m_min ?? [];
  const code: number[] = data?.daily?.weathercode ?? [];
  const windSpeedMax: number[] = data?.daily?.wind_speed_10m_max ?? [];
  const windGustMax: number[] = data?.daily?.wind_gusts_10m_max ?? [];
  const precipSum: number[] = data?.daily?.precipitation_sum ?? [];

  const byDate: WeatherByDate = {};
  for (let i = 0; i < days.length; i++) {
    byDate[days[i]] = {
      tmax: Math.round(tmax[i]),
      tmin: Math.round(tmin[i]),
      code: code[i],
      windSpeedMax: windSpeedMax[i],
      windGustMax: windGustMax[i],
      precipSum: precipSum[i],
    };
  }
  return byDate;
}
