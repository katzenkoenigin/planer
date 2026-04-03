import React from 'react';
import { Send } from 'lucide-react';
import { designConfigs, type DesignKey } from '../constants';
import { geocodeCity } from '../utils/weather';

interface SettingsPanelProps {
  design: DesignKey;
  setDesign: React.Dispatch<React.SetStateAction<DesignKey>>;
  discordUsers: string;
  setDiscordUsers: React.Dispatch<React.SetStateAction<string>>;
  botEndpoint: string;
  setBotEndpoint: (v: string) => void;
  botSecret: string;
  setBotSecret: (v: string) => void;
  dmUserIds: string;
  setDmUserIds: (v: string) => void;
  dmUserIdList: string[];
  weatherEnabled: boolean;
  setWeatherEnabled: (v: boolean) => void;
  weatherCity: string;
  setWeatherCity: (v: string) => void;
  setWeatherCoord: (c: { lat: number; lon: number } | null) => void;
  tmdbApiKey: string;
  setTmdbApiKey: (v: string) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const {
    design, setDesign,
    discordUsers, setDiscordUsers,
    botEndpoint, setBotEndpoint,
    botSecret, setBotSecret,
    dmUserIds, setDmUserIds,
    dmUserIdList,
    weatherEnabled, setWeatherEnabled,
    weatherCity, setWeatherCity,
    setWeatherCoord,
    tmdbApiKey, setTmdbApiKey,
    onClose,
  } = props;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 grid place-items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[min(92vw,720px)] max-h-[85vh] overflow-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Einstellungen</h3>
          <button onClick={onClose} className="px-2 py-1 text-sm rounded border bg-gray-50 hover:bg-gray-100">
            Schließen
          </button>
        </div>

        {/* Design */}
        <label className="block mb-2 font-semibold">Designauswahl:</label>
        <select
          value={design}
          onChange={(e) => setDesign(e.target.value as DesignKey)}
          className="w-full mb-4 border px-2 py-1 rounded"
        >
          {Object.keys(designConfigs).map((key) => (
            <option key={key} value={key}>{designConfigs[key as DesignKey].name}</option>
          ))}
        </select>

        {/* Discord Benutzername */}
        <label className="block mb-2 font-semibold">Discord-Benutzername(n) (optional):</label>
        <input
          type="text"
          value={discordUsers}
          onChange={(e) => setDiscordUsers(e.target.value)}
          placeholder="z. B. Katze#1234"
          className="w-full border px-2 py-1 rounded mb-3"
        />

        <hr className="my-3" />

        {/* Discord Bot */}
        <div className="text-sm font-semibold mb-2">Discord Bot (DM-Reminder)</div>
        <label className="block text-xs mb-1">Bot Endpoint URL</label>
        <input
          type="url"
          value={botEndpoint}
          onChange={(e) => setBotEndpoint(e.target.value)}
          placeholder="http://127.0.0.1:3000"
          className="w-full border px-2 py-1 rounded mb-2"
        />
        <label className="block text-xs mb-1">Shared Secret</label>
        <input
          type="password"
          value={botSecret}
          onChange={(e) => setBotSecret(e.target.value)}
          placeholder="geheimes Token"
          className="w-full border px-2 py-1 rounded mb-2"
        />
        <label className="block text-xs mb-1">Discord User IDs (kommagetrennt)</label>
        <input
          type="text"
          value={dmUserIds}
          onChange={(e) => setDmUserIds(e.target.value)}
          placeholder="1234567890,0987654321"
          className="w-full border px-2 py-1 rounded mb-3"
        />
        <button
          onClick={() => {
            if (!botEndpoint || !botSecret || dmUserIdList.length === 0) {
              alert('Bitte Endpoint/Secret/UserID setzen.');
              return;
            }
            fetch(`${botEndpoint.replace(/\/+$/, '')}/api/test`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: botSecret, userId: dmUserIdList[0], content: '✅ Test vom Aktivitätsplaner.' }),
            })
              .then(r => { if (!r.ok) throw new Error(); alert('Test-DM gesendet.'); })
              .catch(() => alert('Test-DM fehlgeschlagen.'));
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-indigo-100 hover:brightness-95"
        >
          <Send size={16} /> Test-DM
        </button>

        <hr className="my-3" />

        {/* Wetter */}
        <div className="text-sm font-semibold mb-2">Wetter</div>
        <label className="flex items-center gap-2 mb-2 text-sm">
          <input
            type="checkbox"
            checked={weatherEnabled}
            onChange={(e) => setWeatherEnabled(e.target.checked)}
          />
          Wetteranzeige im Planer aktivieren
        </label>
        <label className="block text-xs mb-1">Ort oder PLZ</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={weatherCity}
            onChange={(e) => setWeatherCity(e.target.value)}
            placeholder="z. B. Berlin oder 10115"
            className="flex-1 border px-2 py-1 rounded"
          />
          <button
            className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
            onClick={async () => {
              const g = await geocodeCity(weatherCity || 'Berlin');
              if (g) setWeatherCoord({ lat: g.lat, lon: g.lon });
              else alert('Ort/PLZ nicht gefunden.');
            }}
          >
            Übernehmen
          </button>
        </div>

        <hr className="my-3" />

        {/* TMDB / Watchlist */}
        <div className="text-sm font-semibold mb-2">Watchlist (TMDB)</div>
        <label className="block text-xs mb-1">TMDB API Key</label>
        <input
          type="password"
          value={tmdbApiKey}
          onChange={(e) => setTmdbApiKey(e.target.value)}
          placeholder="TMDB API Key hier eintragen"
          className="w-full border px-2 py-1 rounded"
        />
        <p className="text-[11px] text-gray-500 mt-1">
          Kostenlosen Key auf themoviedb.org erstellen. Die Watchlist nutzt Titel/Infos/Poster und Streaming-Anbieter (DE) von TMDB.
        </p>
      </div>
    </div>
  );
};

export default SettingsPanel;
