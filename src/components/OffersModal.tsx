import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Search, Send, Trash2, ExternalLink, Clock } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  botEndpoint?: string;
  botSecret?: string;
  dmUserIds?: string[];
};

type OfferItem = {
  provider: string;
  title: string;
  url: string;
  price?: string;
  shop?: string;
  validFrom?: string;
  validUntil?: string;
  imageUrl?: string;
  shopLogoUrl?: string;
};
type OfferResult = { query: string; items: OfferItem[]; error?: string };

const FAVORITES_KEY = 'OFFERS_FAVORITES_V3';
const RESULTS_KEY   = 'OFFERS_RESULTS_V3';
const AUTO_KEY      = 'OFFERS_AUTO_PREFS_V1';

function safeGet<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function safeSet<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    const existing = safeGet<T>(key);
    return (existing !== null ? existing : initialValue);
  });
  useEffect(() => { safeSet(key, state); }, [key, state]);
  return [state, setState] as const;
}

/* ---- Shop-Erkennung für Anzeige-Namen ---- */
const SHOP_CANON = [
  'REWE','EDEKA','LIDL','ALDI','KAUFLAND','NETTO','PENNY','GLOBUS','HIT','HOFFMANN','TRINKGUT'
] as const;
const DOMAIN_TO_SHOP: Record<string, string> = {
  'rewe.de': 'REWE',
  'edeka.de': 'EDEKA',
  'lidl.de': 'LIDL',
  'aldi-nord.de': 'ALDI',
  'aldi-sued.de': 'ALDI',
  'kaufland.de': 'KAUFLAND',
  'netto-online.de': 'NETTO',
  'penny.de': 'PENNY',
  'globus.de': 'GLOBUS',
  'hit.de': 'HIT',
  'getraenke-hoffmann.de': 'HOFFMANN',
  'trinkgut.de': 'TRINKGUT',
};
function deriveShopFromUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./,'').toLowerCase();
    for (const d of Object.keys(DOMAIN_TO_SHOP)) if (host.endsWith(d)) return DOMAIN_TO_SHOP[d];
    const parts = host.split('.');
    for (let i=0;i<parts.length-1;i++) {
      const cand = parts.slice(i).join('.');
      if (DOMAIN_TO_SHOP[cand]) return DOMAIN_TO_SHOP[cand];
    }
  } catch {}
  return undefined;
}
function inferShopFromText(t?: string): string | undefined {
  if (!t) return undefined;
  const up = t.toUpperCase();
  const aliases: [string, string][] = [
    ['ALDI SÜD','ALDI'], ['ALDI SUED','ALDI'], ['ALDI NORD','ALDI'],
    ['NETTO MARKEN','NETTO'], ['NETTO-MARKEN','NETTO'],
    ['GETRÄNKE HOFFMANN','HOFFMANN'], ['GETRAENKE HOFFMANN','HOFFMANN'],
  ];
  for (const name of SHOP_CANON) if (up.includes(name)) return name;
  for (const [needle, canon] of aliases) if (up.includes(needle)) return canon;
  return undefined;
}
function getDisplayShopName(item: OfferItem): string {
  return item.shop?.trim()
    || inferShopFromText(item.title) 
    || deriveShopFromUrl(item.url) 
    || ((item.provider || '').toLowerCase().includes('mydealz') ? 'Mydealz'
        : (item.provider || '').toLowerCase().includes('kaufda') ? 'KaufDA'
        : (item.provider || '').toLowerCase().includes('marktguru') ? 'Marktguru'
        : 'Quelle');
}

/* ---- Einheit (heuristisch aus Titel) ---- */
function detectUnitLabel(title: string): string | undefined {
  const t = title.toLowerCase();

  const pairs: [RegExp, string][] = [
    [/\b(kasten|kiste)\b/i, 'je Kasten'],
    [/\b(sixpack|6er\s*pack|6erpack)\b/i, 'je Sixpack'],
    [/\b(dosen?)\b/i, 'je Dose'],
    [/\b(flaschen?)\b/i, 'je Flasche'],
    [/\b(packung|pack)\b/i, 'je Packung'],
    [/\b(tray|träger)\b/i, 'je Tray'],
    [/\b(beutel)\b/i, 'je Beutel'],
    [/\b(gläser?)\b/i, 'je Glas'],
  ];
  for (const [re, label] of pairs) if (re.test(title)) return label;

  const vol = title.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(l|ml)\b/i);
  if (vol) {
    const amount = vol[1].replace('.', ',');
    const unit = vol[2].toUpperCase();
    return `je ${amount} ${unit}`;
  }
  // Notfalls: Hinweise wie „1,5l-Flasche“
  const volBottle = title.match(/(\d(?:[.,]\d{1,2})?)\s*l.*flasch/i);
  if (volBottle) return `je ${volBottle[1].replace('.', ',')} L`;

  return undefined;
}

/* ───────────────────────── Komponente ───────────────────────── */
export default function OffersModal({ isOpen, onClose, botEndpoint, botSecret, dmUserIds }: Props) {
  const [favorites, setFavorites] = usePersistentState<string[]>(FAVORITES_KEY, []);
  const [results, setResults]     = usePersistentState<OfferResult[]>(RESULTS_KEY, []);
  const [autoPrefs, setAutoPrefs] = usePersistentState<{enabled:boolean; time:string}>(AUTO_KEY, { enabled:false, time:'08:00' });

  const [newFav, setNewFav] = useState('');
  const [loading, setLoading] = useState(false);
  const triedBotOnOpen = useRef(false);

  const endpoint = (botEndpoint || '').replace(/\/+$/,'');
  const canUseBot = !!endpoint && !!botSecret && !!dmUserIds?.length;

  useEffect(() => {
    if (!isOpen) { triedBotOnOpen.current = false; return; }
    if (triedBotOnOpen.current) return;
    triedBotOnOpen.current = true;

    if (canUseBot && results.length === 0) {
      fetch(`${endpoint}/api/offers/auto-status?token=${encodeURIComponent(botSecret!)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.ok) return;
          setAutoPrefs(prev => ({
            enabled: typeof data.config?.enabled === 'boolean' ? data.config.enabled : prev.enabled,
            time: typeof data.config?.time === 'string' ? data.config.time : prev.time
          }));
          if (Array.isArray(data.state?.lastResults) && results.length === 0) {
            setResults(data.state.lastResults);
          }
        })
        .catch(() => void 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const addFavorite = () => {
    const v = newFav.trim();
    if (!v) return;
    if (favorites.some(f => f.toLowerCase() === v.toLowerCase())) return;
    setFavorites([...favorites, v]);
    setNewFav('');
  };
  const removeFavorite = (idx: number) => setFavorites(favorites.filter((_, i) => i !== idx));

  const safeJSON = (t: string) => { try { return JSON.parse(t); } catch { return null; } };
  const searchQueries = async (queries: string[]) => {
    if (!canUseBot) { alert('Bitte Bot Endpoint & Secret in den Einstellungen hinterlegen.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}/api/offers/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ token: botSecret, queries }),
      });
      const raw = await res.text(); const data = safeJSON(raw);
      if (!data) { alert(`Netzwerkfehler: keine JSON-Antwort (HTTP ${res.status}).`); return; }
      if (!res.ok || data.ok === false) { alert(`Suche fehlgeschlagen (HTTP ${res.status}): ${data?.error ?? 'Unbekannt'}`); return; }
      setResults((data.results as OfferResult[]) ?? []);
    } catch (e: any) {
      alert(`Netzwerkfehler: ${String(e?.message ?? e)}`);
    } finally {
      setLoading(false);
    }
  };
  const handleSearchAll = () => {
    if (favorites.length === 0) { alert('Bitte mindestens ein Lieblingsprodukt hinzufügen.'); return; }
    searchQueries(favorites);
  };

  const saveAutoConfig = async () => {
    if (!canUseBot) { alert('Bitte Bot-Settings (Endpoint/Secret/UserIDs) eintragen.'); return; }
    try {
      const res = await fetch(`${endpoint}/api/offers/auto-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: botSecret,
          enabled: autoPrefs.enabled,
          time: autoPrefs.time,
          queries: favorites,
          userIds: dmUserIds
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) { alert(`Speichern fehlgeschlagen (HTTP ${res.status}): ${data?.error ?? 'Unbekannt'}`); return; }
      alert('Auto-Check gespeichert.');
    } catch (e: any) {
      alert(`Netzwerkfehler: ${String(e?.message ?? e)}`);
    }
  };

  /* ----- DM-Text mit neuem Format (🛒, Pipes, Abstände, Einheit, Zeitraum) ----- */
  const summaryText = useMemo(() => {
    const lines: string[] = [];
    results.forEach((r, idx) => {
      lines.push(`🛒  ${r.query}`);
      lines.push(''); // 1 Leerzeile nach Überschrift

      if (r.error) {
        lines.push(`  • Fehler: ${r.error}`);
      } else if (!r.items || r.items.length === 0) {
        lines.push('  • Keine Treffer');
      } else {
        for (const it of r.items.slice(0, 5)) {
          const unit = detectUnitLabel(it.title);
          const pricePart = it.price ? ` – ${it.price}${unit ? ' ' + unit : ''}` : '';
          const shop = getDisplayShopName(it);
          const period = it.validFrom || it.validUntil
            ? ` | ${it.validFrom ? `gültig von ${it.validFrom}` : ''}${it.validFrom && it.validUntil ? ' ' : ''}${it.validUntil ? `gültig bis ${it.validUntil}` : ''}`.replace('von','').trim()
            : '';
          // wir wollen: Titel – Preis [Einheit] | SHOP | gültig …
          const periodClean = it.validFrom || it.validUntil
            ? ` | ${it.validFrom && it.validUntil ? `gültig von ${it.validFrom} bis ${it.validUntil}` : it.validUntil ? `gültig bis ${it.validUntil}` : `gültig ab ${it.validFrom}`}`
            : '';
          lines.push(`  • ${it.title}${pricePart} | ${shop}${periodClean}`);
        }
      }

      // 2 Leerzeilen zwischen Kategorien (nach jeder Kategorie 2 leere pushen, außer evtl. letzter – macht nix)
      lines.push('', '');
    });
    return lines.join('\n').trim();
  }, [results]);

  const handleSendDM = async () => {
    const endpointOk = (botEndpoint || '').replace(/\/+$/,'');
    if (!endpointOk || !botSecret || !dmUserIds?.length) { alert('Bitte Bot-Settings eintragen.'); return; }
    const text = summaryText || 'Keine Ergebnisse.';
    try {
      const res = await fetch(`${endpointOk}/api/offers/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ token: botSecret, userIds: dmUserIds, content: text }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) { alert(`Senden fehlgeschlagen (HTTP ${res.status}): ${data?.error ?? 'Unbekannt'}`); return; }
      alert(`Gesendet: ${data.sent} Nachricht(en).`);
    } catch (e: any) { alert(`Senden fehlgeschlagen: ${String(e?.message ?? e)}`); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="w-[min(980px,95vw)] max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-semibold">Angebote</div>
          <button className="p-2 rounded hover:bg-black/5" aria-label="Schließen" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-b space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder='Lieblingsprodukt (z. B. "Coca Cola Kasten")'
              value={newFav}
              onChange={(e) => setNewFav(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addFavorite(); }}
            />
            <button onClick={addFavorite} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-100 hover:brightness-95">
              <Plus size={16} /> Hinzufügen
            </button>

            <button onClick={handleSearchAll} disabled={loading} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${loading ? 'bg-gray-100 cursor-not-allowed' : 'bg-amber-100 hover:brightness-95'}`}>
              <Search size={16} /> {loading ? 'Suche…' : 'Alle prüfen'}
            </button>

            <button onClick={handleSendDM} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-indigo-100 hover:brightness-95">
              <Send size={16} /> Senden (Discord)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoPrefs.enabled}
                onChange={(e)=> setAutoPrefs(prev => ({ ...prev, enabled: e.target.checked })) }
              />
              Täglicher Auto-Check & DM
            </label>
            <div className="inline-flex items-center gap-2 text-sm">
              <Clock size={16} />
              <input
                type="time"
                value={autoPrefs.time}
                onChange={(e)=> setAutoPrefs(prev => ({ ...prev, time: e.target.value || '08:00' })) }
                className="border rounded px-2 py-1 text-sm"
              />
              <button
                onClick={saveAutoConfig}
                className="px-3 py-1.5 rounded bg-gray-200 hover:brightness-95"
                title="Beim Bot speichern"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>

        {/* Favoriten */}
        <div className="px-5 py-3 border-b">
          {favorites.length === 0 ? (
            <div className="text-sm text-gray-500">Noch keine Lieblingsprodukte gespeichert.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {favorites.map((f, idx) => (
                <span key={`${f}-${idx}`} className="inline-flex items-center gap-1 text-sm bg-gray-100 rounded px-2 py-1">
                  {f}
                  <button className="p-0.5 rounded hover:bg-white" title="Entfernen" onClick={() => removeFavorite(idx)}>
                    <Trash2 size={14}/>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ergebnisse */}
        <div className="p-5 max-h-[60vh] overflow-auto space-y-5">
          {results.length === 0 && <div className="text-sm text-gray-500">Noch keine Ergebnisse. Klicke auf „Alle prüfen“.</div>}

          {results.map((r) => (
            <div key={r.query} className="border rounded">
              <div className="px-3 py-2 border-b bg-gray-50 font-medium">🛒 {r.query}</div>

              {r.error ? (
                <div className="p-3 text-sm text-red-600">Fehler: {r.error}</div>
              ) : r.items.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">Keine Treffer.</div>
              ) : (
                <ul className="divide-y">
                  {r.items.slice(0, 8).map((it, i) => {
                    const shopName = getDisplayShopName(it);
                    const unit = detectUnitLabel(it.title);
                    return (
                      <li key={`${r.query}-${i}-${it.url}`} className="p-3 text-sm flex items-start gap-3">
                        {/* Thumb */}
                        {it.imageUrl ? (
                          <img src={it.imageUrl} alt="" className="w-[56px] h-[56px] object-cover rounded border bg-white" />
                        ) : (
                          <div className="w-[56px] h-[56px] rounded border flex items-center justify-center bg-gray-50 text-gray-400">🛒</div>
                        )}

                        {/* Text + Badges */}
                        <div className="flex-1 min-w-0">
                          <a href={it.url} target="_blank" rel="noreferrer" className="font-medium hover:underline block truncate">
                            {it.title}
                          </a>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                            {/* Preis + Einheit direkt dahinter */}
                            {it.price && <span className="text-emerald-700 font-semibold">{it.price}{unit ? ` ${unit}` : ''}</span>}

                            {/* Shop-Badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100">
                              {it.shopLogoUrl && <img src={it.shopLogoUrl} alt="" className="w-4 h-4 object-contain rounded-sm" />}
                              <span>{shopName}</span>
                            </span>

                            {/* Zeitraum – rechts daneben, leicht abgesetzt */}
                            {(it.validFrom || it.validUntil) && (
                              <span className="text-gray-500 ml-2">
                                {it.validFrom && it.validUntil
                                  ? `gültig von ${it.validFrom} bis ${it.validUntil}`
                                  : it.validUntil
                                    ? `gültig bis ${it.validUntil}`
                                    : `gültig ab ${it.validFrom}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Link */}
                        <a href={it.url} target="_blank" rel="noreferrer" title="Öffnen" className="ml-2 p-1 rounded hover:bg-gray-100">
                          <ExternalLink size={16}/>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
