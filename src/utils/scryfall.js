/**
 * Import carte da Scryfall.
 *
 * Flusso: parseCardList(testo) -> [{qty, name}] -> fetchScryfallImages()
 * interroga l'endpoint /cards/collection (batch da 75), scarica le immagini
 * PNG come Blob e le impacchetta in File pronti per la pipeline esistente
 * (handleImagesAdded -> object URL -> preview/cache/PDF).
 */

const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
const CHUNK = 75;          // max identifiers per richiesta (limite Scryfall)
const IMG_CONCURRENCY = 8; // fetch immagini in parallelo

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'carta';
}

/**
 * Parsa il testo incollato. Una carta per riga.
 * Accetta "1x Nome", "1 Nome", "Nome". Quantità limitata a 3 cifre per non
 * confondere carte che iniziano con un numero (es. "1996 World Champion").
 * Rimuove eventuale coda set/collector tipo "(C21) 263 *F*".
 * @returns {{qty:number, name:string}[]}
 */
export function parseCardList(text) {
  const out = [];
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let qty = 1;
    let name = line;
    let m = line.match(/^(\d{1,3})\s*[xX]\s*(.+)$/);
    if (!m) m = line.match(/^(\d{1,3})\s+(.+)$/);
    if (m) {
      qty = parseInt(m[1], 10) || 1;
      name = m[2];
    }
    name = name.trim().replace(/\s+\([0-9A-Za-z]{2,6}\)(?:\s+\S+)*$/, '').trim();
    if (name) out.push({ qty, name });
  }
  return out;
}

/**
 * Immagini PNG di una carta: 1 normalmente, 2 per le doppia-faccia vere
 * (transform / modal_dfc), dove ogni faccia ha la propria immagine.
 * @returns {{url:string, name:string}[]}
 */
export function imageFaces(card) {
  if (card.image_uris?.png) return [{ url: card.image_uris.png, name: card.name }];
  if (Array.isArray(card.card_faces)) {
    const withImg = card.card_faces.filter((f) => f.image_uris?.png || f.image_uris?.large);
    if (withImg.length) {
      return withImg.map((f) => ({ url: f.image_uris.png || f.image_uris.large, name: f.name }));
    }
  }
  if (card.image_uris?.large) return [{ url: card.image_uris.large, name: card.name }];
  return [];
}

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
 * Scarica le immagini delle carte richieste.
 * @param {{qty:number, name:string}[]} entries
 * @param {(done:number, total:number)=>void} [onProgress]
 * @returns {Promise<{files: {file: File, bleedMode: string}[], notFound: string[]}>}
 */
export async function fetchScryfallImages(entries, onProgress) {
  // Aggrega le quantità per nome, preservando l'ordine di inserimento.
  const byName = new Map();
  for (const { qty, name } of entries) {
    if (!name) continue;
    const key = name.toLowerCase();
    if (byName.has(key)) byName.get(key).qty += qty || 1;
    else byName.set(key, { name, qty: qty || 1 });
  }
  const list = [...byName.values()];
  if (!list.length) return { files: [], notFound: [] };

  // 1) Risolvi le carte via /cards/collection (batch da 75).
  const identifiers = list.map((e) => ({ name: e.name }));
  const cardByKey = new Map(); // nome(lower) [+ nome faccia anteriore] -> card
  const notFound = [];
  const parts = chunk(identifiers, CHUNK);
  for (let p = 0; p < parts.length; p++) {
    const res = await fetch(COLLECTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: parts[p] }),
    });
    if (!res.ok) throw new Error(`Scryfall ha risposto ${res.status}`);
    const json = await res.json();
    for (const card of json.data || []) {
      cardByKey.set(card.name.toLowerCase(), card);
      const front = card.card_faces?.[0]?.name;
      if (front) cardByKey.set(front.toLowerCase(), card); // match nome faccia (DFC)
    }
    for (const nf of json.not_found || []) notFound.push(nf.name);
    if (p < parts.length - 1) await sleep(100); // gentile con l'API
  }

  // 2) Costruisci i task immagine nell'ordine della lista.
  const tasks = []; // { url, name, qty, bleedMode }
  for (const entry of list) {
    const card = cardByKey.get(entry.name.toLowerCase());
    if (!card) continue; // già in notFound
    // full-art / borderless → mirror; altrimenti edge-stretch (bordo nero)
    const bleedMode = card.full_art || card.border_color === 'borderless' ? 'mirror' : 'stretch';
    for (const face of imageFaces(card)) {
      tasks.push({ url: face.url, name: face.name, qty: entry.qty, bleedMode });
    }
  }

  // 3) Scarica i Blob (concorrenza limitata) ed espandi in File per quantità.
  let done = 0;
  const blobs = await mapLimit(tasks, IMG_CONCURRENCY, async (t) => {
    let blob = null;
    try {
      const res = await fetch(t.url);
      if (res.ok) blob = await res.blob();
    } catch {
      blob = null;
    }
    done++;
    onProgress?.(done, tasks.length);
    return blob;
  });

  const files = [];
  tasks.forEach((t, i) => {
    const blob = blobs[i];
    if (!blob) {
      notFound.push(t.name);
      return;
    }
    for (let k = 0; k < t.qty; k++) {
      files.push({
        file: new File([blob], `${sanitizeName(t.name)}.png`, { type: 'image/png' }),
        bleedMode: t.bleedMode,
      });
    }
  });

  return { files, notFound };
}
