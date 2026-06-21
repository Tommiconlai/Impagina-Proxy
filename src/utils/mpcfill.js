/**
 * Import da MPCFill (MakePlayingCards autofill) — file XML <order>.
 *
 * Ogni <card> ha <id> (file Google Drive), <slots> (posizioni; più slot = più
 * copie), <query> (nome carta) e <name> (filename con l'art). Le immagini sono
 * servite da lh3.googleusercontent.com/d/<id> che, a differenza di drive.google.com,
 * manda gli header CORS → fetch leggibile → blob non "tainted" → export PDF ok.
 * Le immagini MPC sono già al vivo (~3mm di abbondanza) → bleedMode 'full'.
 */

// w<N> = larghezza richiesta; lh3 non fa upscale, quindi 2000 = nativo o meno.
const driveImg = (id, w = 2000) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;

// API MPCFill (mpcfill.com): nessun header CORS → va via proxy (come i deck link).
// Le immagini invece arrivano da lh3 (CORS ok), quindi niente proxy per quelle.
const CORS_PROXY = 'https://corsproxy.io/?url=';
const px = (u) => CORS_PROXY + encodeURIComponent(u);
const MPC_API = 'https://mpcfill.com';

const stripExt = (s) => (s || '').replace(/\.[a-z0-9]+$/i, '').trim();

// Parse del testo XML → { cards: [{id, name, count}] }. fronts poi backs.
export function parseMpcXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML file.');

  const read = (section) =>
    Array.from(doc.querySelectorAll(`${section} > card`)).map((c) => {
      const id = c.querySelector('id')?.textContent?.trim();
      const slots = c.querySelector('slots')?.textContent?.trim() || '';
      // slot multipli ("0,1,2") = copie della stessa carta
      const count = slots ? slots.split(',').filter((s) => s.trim() !== '').length : 1;
      // il nome carta è <query>; fallback al filename senza estensione
      const name = (c.querySelector('query')?.textContent?.trim())
        || stripExt(c.querySelector('name')?.textContent) || 'card';
      return { id, name, count: Math.max(1, count) };
    }).filter((c) => c.id);

  const cards = [...read('fronts'), ...read('backs')];
  if (!cards.length) throw new Error('No cards found in the file.');
  return { cards };
}

// Esegue fn su items con al più `limit` richieste in parallelo (no flood su lh3).
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Scarica le immagini delle carte (1 fetch per carta, poi duplicata per le copie).
 * @returns {Promise<{files: {file:File, bleedMode:'full', name:string}[], notFound:string[]}>}
 */
export async function fetchMpcImages(cards, onProgress) {
  let done = 0;
  const total = cards.length;
  const fetched = await mapLimit(cards, 6, async (c) => {
    try {
      const res = await fetch(driveImg(c.id));
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('not an image');
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `${c.name}.${ext}`, { type: blob.type });
      return { ok: true, file, count: c.count };
    } catch {
      return { ok: false, name: c.name };
    } finally {
      onProgress?.(++done, total);
    }
  });

  const files = [];
  const notFound = [];
  for (const r of fetched) {
    if (!r.ok) { notFound.push(r.name); continue; }
    // stesso File per ogni copia: addItems crea un object URL distinto per item.
    // Niente `name`: l'art MPC è custom (no identità Scryfall) → esclusa da "Save list"
    // come gli upload manuali, invece di salvare un nome che al reload prende l'art sbagliata.
    for (let i = 0; i < r.count; i++) files.push({ file: r.file, bleedMode: 'full' });
  }
  return { files, notFound };
}

// ── Ricerca art su MPCFill (per il box "Change art") ───────────────────────────

// Tutte le sorgenti come tuple [pk, true] (lo schema vuole liste, non interi).
// Cache: l'elenco cambia di rado e serve a ogni ricerca.
let _sources = null;
async function allSourceTuples() {
  if (!_sources) {
    _sources = fetch(px(`${MPC_API}/2/sources/`))
      .then((r) => { if (!r.ok) throw new Error(`MPCFill sources responded ${r.status}`); return r.json(); })
      .then((j) => {
        // Un errore del proxy arriva come JSON valido (es. 403 {"error":…}) → r.json()
        // non lancia; senza questo controllo si cacherebbe [] per tutta la sessione.
        const tuples = Object.values(j.results || {}).map((s) => [s.pk, true]);
        if (!tuples.length) throw new Error('MPCFill returned no sources');
        return tuples;
      })
      .catch((e) => { _sources = null; throw e; });
  }
  return _sources;
}

/**
 * Cerca tutte le stampe di una carta nel database MPCFill.
 * @returns {Promise<{id,thumb,png,set,setName}[]>} forma compatibile con la griglia
 *   del box Change art (set = nome sorgente, png = lh3 ad alta risoluzione).
 */
export async function searchMpcPrints(name, limit = 90) {
  const sources = await allSourceTuples();
  const body = {
    searchSettings: {
      searchTypeSettings: { fuzzySearch: false, filterCardbacks: false },
      sourceSettings: { sources },
      filterSettings: { minimumDPI: 0, maximumDPI: 1500, maximumSize: 30, languages: [], includesTags: [], excludesTags: [] },
    },
    queries: [{ query: name.trim().toLowerCase(), cardType: 'CARD' }],
  };
  const r = await fetch(px(`${MPC_API}/2/editorSearch/`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`MPCFill responded ${r.status}`);
  const j = await r.json();
  const key = Object.keys(j.results || {})[0];
  const ids = (key && j.results[key].CARD) || [];
  if (!ids.length) return [];

  const top = ids.slice(0, limit);
  // Dettagli (nome sorgente per l'etichetta) — batch unico, opzionale.
  let details = {};
  try {
    const dr = await fetch(px(`${MPC_API}/2/cards/`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardIdentifiers: top }),
    });
    if (dr.ok) details = (await dr.json()).results || {};
  } catch { /* etichetta opzionale */ }

  return top.map((id) => {
    const d = details[id] || {};
    return { id, thumb: driveImg(id, 400), png: driveImg(id, 2000), set: d.sourceName || 'MPC', setName: d.name || name };
  });
}

export const MPC_PRINTS_LIMIT = 90;
