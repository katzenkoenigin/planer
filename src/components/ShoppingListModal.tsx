import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Plus, Copy, Send, Trash2, GripVertical, Edit2, Check, ChevronDown, ChevronRight, Settings as SettingsIcon, Star
} from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: string[];                     // flache Liste (Preview rechts)
  onChange: (items: string[]) => void; // wir pflegen die Flatten-Liste weiter
  discordWebhookUrl?: string;          // ungenutzt (wir senden per Bot)
  botEndpoint?: string;
  botSecret?: string;
  dmUserIds?: string[];
};

type Group = { id: string; name: string; items: string[] };

const GROUPS_KEY    = 'SHOPPING_GROUPS_V1';
const FLAT_KEY      = 'SHOPPING_LIST_V1';
const TEMPLATES_KEY = 'SHOPPING_TEMPLATES_V1';

const DEFAULT_TEMPLATES = [
  'Milch', 'Eier', 'Brot', 'Butter', 'Käse', 'Joghurt', 'Quark', 'Marmelade',
  'Tomaten', 'Gurken', 'Paprika', 'Salat', 'Äpfel', 'Bananen', 'Kartoffeln', 'Zwiebeln',
  'Nudeln', 'Reis', 'Haferflocken', 'Müsli',
  'Hähnchen', 'Hackfleisch', 'Tofu',
  'Wasser', 'Saft', 'Kaffee', 'Tee',
  'Toilettenpapier', 'Küchenrolle', 'Spülmittel', 'Waschmittel'
];

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ShoppingListModal({
  isOpen, onClose, items, onChange, botEndpoint, botSecret, dmUserIds
}: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [initialized, setInitialized] = useState(false); // verhindert Überschreiben beim Öffnen
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});
  const [dragItemPos, setDragItemPos] = useState<{ g: number; i: number } | null>(null); // Item DnD
  const [dragGroupIndex, setDragGroupIndex] = useState<number | null>(null);             // Group DnD
  const [sending, setSending] = useState(false);

  // Vorlagen (Schnell-Templates) + UI
  const [templates, setTemplates] = useState<string[]>(DEFAULT_TEMPLATES);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState('');

  const canUseBot = !!botEndpoint && !!botSecret && !!dmUserIds && dmUserIds.length > 0;

  /* ---------- Laden + Migration (nur einmal pro Öffnen) ---------- */
  useEffect(() => {
    if (!isOpen) return;
    try {
      // Gruppen laden/migrieren
      const raw = localStorage.getItem(GROUPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setGroups(parsed);
        } else {
          throw new Error('invalid groups JSON');
        }
      } else {
        // Migration von flacher Liste -> Gruppe "Allgemein"
        let flat: string[] = [];
        const flatRaw = localStorage.getItem(FLAT_KEY);
        if (flatRaw) {
          try { const arr = JSON.parse(flatRaw); if (Array.isArray(arr)) flat = arr; } catch {}
        } else if (Array.isArray(items)) {
          flat = items;
        }
        setGroups([{ id: newId(), name: 'Allgemein', items: flat }]);
      }

      // Vorlagen laden (oder defaults)
      const tRaw = localStorage.getItem(TEMPLATES_KEY);
      if (tRaw) {
        try {
          const arr = JSON.parse(tRaw);
          if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) {
            setTemplates(arr);
          } else {
            setTemplates(DEFAULT_TEMPLATES);
          }
        } catch {
          setTemplates(DEFAULT_TEMPLATES);
        }
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } finally {
      setInitialized(true);
    }
  }, [isOpen]); // eslint-disable-line

  /* ---------- Persist & Flatten für Sidebar-Preview ---------- */
  useEffect(() => {
    if (!initialized) return;
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); } catch {}
    const flat = groups.flatMap(g => g.items);
    onChange(flat);
  }, [groups, initialized]); // eslint-disable-line

  useEffect(() => {
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); } catch {}
  }, [templates]);

  /* ---------- Mutationen: Gruppen ---------- */
  const setGroupName = (id: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === id ? ({ ...g, name }) : g));
  };
  const addGroup = () => {
    const g: Group = { id: newId(), name: `Gruppe ${groups.length + 1}`, items: [] };
    setGroups(prev => [...prev, g]);
  };
  const deleteGroup = (idx: number) => {
    setGroups(prev => prev.filter((_, i) => i !== idx));
  };

  // Gruppen Drag & Drop (ganze Gruppen sortieren)
  const onGroupDragStart = (gIndex: number, e: React.DragEvent) => {
    setDragGroupIndex(gIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'group'); // Marker
  };
  const onGroupDragOver = (e: React.DragEvent) => {
    if (dragGroupIndex !== null) e.preventDefault(); // nur wenn wirklich Group-DnD
  };
  const onGroupDrop = (targetIndex: number) => {
    if (dragGroupIndex === null || dragGroupIndex === targetIndex) return;
    setGroups(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(dragGroupIndex, 1);
      const insertAt = dragGroupIndex < targetIndex ? targetIndex - 1 : targetIndex;
      copy.splice(Math.max(0, Math.min(insertAt, copy.length)), 0, moved);
      return copy;
    });
    setDragGroupIndex(null);
  };
  const onGroupDnDEnd = () => setDragGroupIndex(null);

  /* ---------- Mutationen: Items ---------- */
  const addItem = (gid: string, text: string) => {
    const v = text.trim();
    if (!v) return;
    setGroups(prev => prev.map(g => {
      if (g.id !== gid) return g;
      // Duplikate in Gruppe vermeiden
      if (g.items.some((x) => x.toLowerCase() === v.toLowerCase())) return g;
      return { ...g, items: [...g.items, v] };
    }));
    setNewItemInputs(prev => ({ ...prev, [gid]: '' }));
  };

  const deleteItem = (gIndex: number, iIndex: number) => {
    setGroups(prev => {
      const copy = prev.map(g => ({ ...g, items: [...g.items] }));
      copy[gIndex].items.splice(iIndex, 1);
      return copy;
    });
  };

  /* ---------- Drag & Drop: Items ---------- */
  const onItemDragStart = (g: number, i: number) => setDragItemPos({ g, i });
  const onItemDrop = (targetG: number, targetI: number | 'end') => {
    if (!dragItemPos) return;
    const srcG = dragItemPos.g, srcI = dragItemPos.i;
    setGroups(prev => {
      const copy = prev.map(g => ({ ...g, items: [...g.items] }));
      const item = copy[srcG].items[srcI];
      // Quelle entfernen
      copy[srcG].items.splice(srcI, 1);
      // Zielindex berechnen
      let insertAt: number;
      if (targetI === 'end') {
        insertAt = copy[targetG].items.length;
      } else {
        insertAt = targetG === srcG && srcI < targetI ? targetI - 1 : targetI;
        insertAt = Math.max(0, Math.min(insertAt, copy[targetG].items.length));
      }
      copy[targetG].items.splice(insertAt, 0, item);
      return copy;
    });
    setDragItemPos(null);
  };

  /* ---------- Templates / Vorlagen ---------- */
  const addTemplate = (t: string) => {
    const v = t.trim();
    if (!v) return;
    if (templates.some(x => x.toLowerCase() === v.toLowerCase())) return;
    setTemplates(prev => [...prev, v].sort((a,b)=>a.localeCompare(b,'de')));
    setNewTemplate('');
  };
  const deleteTemplateAt = (idx: number) => {
    setTemplates(prev => prev.filter((_,i)=>i!==idx));
  };
  const resetTemplates = () => setTemplates(DEFAULT_TEMPLATES);

  // Autocomplete pro Gruppe (einfach: live gefiltert, klickbar)
  const getSuggestions = (gid: string): string[] => {
    const typed = (newItemInputs[gid] ?? '').trim().toLowerCase();
    if (!typed) return [];
    const g = groups.find(x => x.id === gid);
    const exists = new Set((g?.items ?? []).map(x => x.toLowerCase()));
    const filtered = templates.filter(t => t.toLowerCase().includes(typed) && !exists.has(t.toLowerCase()));
    return filtered.slice(0, 8);
  };

  /* ---------- Utils ---------- */
  const formatForClipboard = (gs: Group[]) => {
    const chunks: string[] = [];
    chunks.push('🛒 Einkaufsliste');
    for (const g of gs) {
      if (!g.items.length) continue;
      chunks.push(`\n${g.name}:`);
      for (const it of g.items) {
        chunks.push(`• ${it}`);
      }
    }
    return chunks.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatForClipboard(groups));
      alert('Einkaufsliste in die Zwischenablage kopiert.');
    } catch {
      alert('Kopieren fehlgeschlagen.');
    }
  };

  const handleSendDM = async () => {
    if (!canUseBot) {
      alert('Bitte Bot Endpoint, Shared Secret und User IDs in den Einstellungen hinterlegen.');
      return;
    }
    const endpoint = (botEndpoint as string).replace(/\/+$/,'');
    const payload = {
      token: botSecret,
      userIds: dmUserIds,
      groups: groups.map(g => ({ name: g.name || 'Gruppe', items: g.items.filter(Boolean) })),
    };
    setSending(true);
    try {
      const res = await fetch(`${endpoint}/api/shopping/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { /* plain text */ }

      if (!res.ok) {
        if (res.status === 401) {
          alert('Senden fehlgeschlagen: Shared Secret stimmt nicht (401). Bitte Planner & Bot-`.env` abgleichen.');
        } else if (res.status === 404) {
          alert('Senden fehlgeschlagen: Route nicht gefunden (404). Bot neu gebaut/gestartet?');
        } else {
          alert(`Senden fehlgeschlagen (HTTP ${res.status}). Antwort: ${text}`);
        }
        return;
      }

      const sent = data?.sent ?? 'unbekannt';
      alert(`Gesendet: ${sent} Nachricht(en).`);
    } catch (e: any) {
      alert(`Senden fehlgeschlagen. Netzwerk/Endpoint prüfen. ${String(e?.message ?? e)}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="w-[min(960px,95vw)] max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-semibold">Einkaufsliste</div>
          <button className="p-2 rounded hover:bg-black/5" aria-label="Schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-b flex flex-wrap gap-2">
          <button onClick={addGroup} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-100 hover:brightness-95">
            <Plus size={16} /> Gruppe hinzufügen
          </button>
          <button onClick={handleCopy} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-gray-100 hover:brightness-95">
            <Copy size={16} /> Kopieren
          </button>
          <button
            onClick={handleSendDM}
            disabled={!canUseBot || sending}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${(!canUseBot || sending) ? 'bg-indigo-100/60 cursor-not-allowed' : 'bg-indigo-100 hover:brightness-95'}`}
            title="Als DM per Bot senden"
          >
            <Send size={16} /> {sending ? 'Sende…' : 'Senden (Discord)'}
          </button>

          {/* Vorlagen */}
          <button
            onClick={() => setTemplatesOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-amber-100 hover:brightness-95 ml-auto"
            title="Vorlagen/Favoriten bearbeiten"
          >
            <SettingsIcon size={16} /> Vorlagen bearbeiten
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-auto space-y-4">
          {groups.map((g, gIndex) => {
            const isCollapsed = collapsed[g.id] ?? false;
            const newVal = newItemInputs[g.id] ?? '';
            const editing = editingName === g.id;
            const suggestions = getSuggestions(g.id);

            return (
              <div
                key={g.id}
                className={`border rounded-lg ${dragGroupIndex === gIndex ? 'ring-2 ring-emerald-300' : ''}`}
                onDragOver={onGroupDragOver}
                onDrop={() => onGroupDrop(gIndex)}
                onDragEnd={onGroupDnDEnd}
              >
                {/* Gruppen-Header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
                  {/* Griff für Gruppen-Drag */}
                  <div
                    className="p-1 rounded hover:bg-white cursor-move"
                    draggable
                    onDragStart={(e)=>onGroupDragStart(gIndex, e)}
                    title="Gruppe verschieben"
                  >
                    <GripVertical size={16} className="text-gray-400" />
                  </div>

                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="border rounded px-2 py-1 text-sm"
                        value={g.name}
                        onChange={(e) => setGroupName(g.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(null); }}
                        autoFocus
                      />
                      <button className="p-1 rounded hover:bg-white" onClick={() => setEditingName(null)} title="Fertig">
                        <Check size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="font-medium">{g.name}</div>
                  )}

                  <button
                    className="p-1 rounded hover:bg-white ml-auto"
                    onClick={() => setCollapsed(prev => ({ ...prev, [g.id]: !isCollapsed }))}
                    title={isCollapsed ? 'Aufklappen' : 'Zuklappen'}
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <button className="p-1 rounded hover:bg-white" onClick={() => setEditingName(g.id)} title="Umbenennen">
                    <Edit2 size={16} />
                  </button>

                  {/* Löschen Gruppe */}
                  <button
                    className="p-1 rounded hover:bg-white"
                    title="Gruppe löschen"
                    onClick={() => { if (confirm(`Gruppe "${g.name}" wirklich löschen?`)) deleteGroup(gIndex); }}
                    onDoubleClick={(e) => { if (e.ctrlKey || e.metaKey) deleteGroup(gIndex); }}
                  >
                    <Trash2 size={16} className="text-gray-500" />
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="p-3" onDragOver={(e)=>e.preventDefault()}>
                    {/* Item-Eingabe + Autocomplete */}
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          className="border rounded px-2 py-1 text-sm flex-1"
                          placeholder="Neues Item…"
                          value={newVal}
                          onChange={(e) => setNewItemInputs(prev => ({ ...prev, [g.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') addItem(g.id, newVal); }}
                        />
                        {/* Aus Eingabe direkt zu Vorlagen hinzufügen */}
                        <button
                          className="px-2 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm inline-flex items-center gap-1"
                          title="Als Vorlage speichern"
                          onClick={() => { const v = (newItemInputs[g.id] ?? '').trim(); if (v) addTemplate(v); }}
                        >
                          <Star size={14}/> merken
                        </button>
                        <button className="px-3 py-1.5 rounded bg-emerald-100 hover:brightness-95" onClick={() => addItem(g.id, newVal)}>
                          Hinzufügen
                        </button>
                      </div>

                      {/* Autocomplete-Liste */}
                      {suggestions.length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
                          {suggestions.map((sug) => (
                            <li
                              key={sug}
                              className="px-2 py-1 text-sm hover:bg-emerald-50 cursor-pointer"
                              onMouseDown={(e)=>e.preventDefault()}
                              onClick={() => addItem(g.id, sug)}
                            >
                              {sug}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Favoriten (Vorlagen) – Schnell hinzufügen */}
                    {templates.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">Favoriten:</div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-auto pr-1">
                          {templates.map((tpl) => {
                            const exists = g.items.some((x)=>x.toLowerCase()===tpl.toLowerCase());
                            return (
                              <button
                                key={`${g.id}-fav-${tpl}`}
                                className={`px-2 py-1 rounded text-xs border ${exists ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-white hover:bg-emerald-50'}`}
                                onClick={() => { if (!exists) addItem(g.id, tpl); }}
                                title={exists ? 'Bereits in dieser Gruppe' : 'Hinzufügen'}
                              >
                                {tpl}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    {g.items.length === 0 ? (
                      <div className="text-sm text-gray-500 mt-3">Noch keine Einträge.</div>
                    ) : (
                      <ul className="space-y-1 mt-3"
                          onDrop={() => onItemDrop(gIndex, 'end')}>
                        {g.items.map((it, iIndex) => (
                          <li
                            key={`${g.id}-${iIndex}-${it}`}
                            className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1"
                            draggable
                            onDragStart={() => onItemDragStart(gIndex, iIndex)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => onItemDrop(gIndex, iIndex)}
                            onDoubleClick={(e) => { if (e.ctrlKey || e.metaKey) deleteItem(gIndex, iIndex); }}
                            title="Entfernen: STRG/Cmd + Doppelklick"
                          >
                            <GripVertical size={16} className="text-gray-400" />
                            <span className="flex-1 truncate">{it}</span>

                            {/* Löschen Item */}
                            <button
                              className="p-1 rounded hover:bg-white"
                              title="Eintrag löschen"
                              onClick={() => deleteItem(gIndex, iIndex)}
                            >
                              <Trash2 size={16} className="text-gray-500" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Dropzone ans Ende der Gruppenliste (optional) */}
          {groups.length > 0 && dragGroupIndex !== null && (
            <div
              className="border-2 border-dashed border-emerald-300 rounded p-3 text-center text-sm text-emerald-700"
              onDragOver={(e)=>e.preventDefault()}
              onDrop={()=>onGroupDrop(groups.length)}
            >
              Hier fallen lassen, um ans Ende zu verschieben
            </div>
          )}
        </div>
      </div>

      {/* Vorlagen-Manager (kleines Overlay) */}
      {templatesOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50" onMouseDown={()=>setTemplatesOpen(false)}>
          <div className="w-[min(560px,92vw)] max-h-[80vh] overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold flex items-center gap-2"><SettingsIcon size={16}/> Vorlagen bearbeiten</div>
              <button className="p-2 rounded hover:bg-black/5" onClick={()=>setTemplatesOpen(false)} aria-label="Schließen">
                <X size={18}/>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  className="border rounded px-2 py-1 text-sm flex-1"
                  placeholder="Vorlage hinzufügen… (Enter)"
                  value={newTemplate}
                  onChange={(e)=>setNewTemplate(e.target.value)}
                  onKeyDown={(e)=>{ if (e.key === 'Enter') addTemplate(newTemplate); }}
                />
                <button className="px-3 py-1.5 rounded bg-amber-100 hover:brightness-95" onClick={()=>addTemplate(newTemplate)}>
                  Hinzufügen
                </button>
                <button className="px-3 py-1.5 rounded bg-gray-100 hover:brightness-95" onClick={resetTemplates} title="Standard-Vorlagen wiederherstellen">
                  Zurücksetzen
                </button>
              </div>

              {templates.length === 0 ? (
                <div className="text-sm text-gray-500">Noch keine Vorlagen.</div>
              ) : (
                <ul className="max-h-[50vh] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templates.map((tpl, idx)=>(
                    <li key={`${tpl}-${idx}`} className="flex items-center gap-2 border rounded px-2 py-1">
                      <span className="flex-1 truncate">{tpl}</span>
                      <button className="p-1 rounded hover:bg-gray-50" title="Vorlage entfernen" onClick={()=>deleteTemplateAt(idx)}>
                        <Trash2 size={16} className="text-gray-500"/>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
