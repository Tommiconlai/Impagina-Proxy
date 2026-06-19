/**
 * PDF Generator Utility — ImpaginaProxies
 *
 * Costanti: tutte le misure in mm, jsPDF usa 'mm' come unità.
 * Orientamento: auto-calcolato per massimizzare il numero di immagini.
 */

export const CARD_W = 63;   // mm
export const CARD_H = 88;   // mm
export const PAGE_MARGIN = 4; // mm

export const PAPER_FORMATS = {
  'A4': [210, 297],
  'A3': [297, 420],
  'A5': [148, 210],
  'Letter': [216, 279],
  'Legal': [216, 356],
};

/**
 * Calcola griglia per una combinazione larghezza/altezza pagina.
 */
function calcGrid(pw, ph, bleedMm) {
  const cellW = CARD_W + bleedMm * 2;
  const cellH = CARD_H + bleedMm * 2;
  const cols = Math.floor((pw - PAGE_MARGIN * 2) / cellW);
  const rows = Math.floor((ph - PAGE_MARGIN * 2) / cellH);
  return { cols: Math.max(0, cols), rows: Math.max(0, rows) };
}

/**
 * Restituisce info complete sulla griglia, scegliendo automaticamente
 * l'orientamento che permette più immagini per pagina.
 */
export function getGridInfo(formatKey, bleedMm) {
  const [fw, fh] = PAPER_FORMATS[formatKey];
  const cellW = CARD_W + bleedMm * 2;
  const cellH = CARD_H + bleedMm * 2;

  const portrait = calcGrid(fw, fh, bleedMm);
  const landscape = calcGrid(fh, fw, bleedMm);

  const useLandscape = (landscape.cols * landscape.rows) > (portrait.cols * portrait.rows);

  const pageW = useLandscape ? fh : fw;
  const pageH = useLandscape ? fw : fh;
  const { cols, rows } = useLandscape ? landscape : portrait;

  const offsetX = (pageW - cols * cellW) / 2;
  const offsetY = (pageH - rows * cellH) / 2;

  return {
    cols,
    rows,
    perPage: cols * rows,
    cellW,
    cellH,
    pageW,
    pageH,
    offsetX,
    offsetY,
    orientation: useLandscape ? 'landscape' : 'portrait',
  };
}

/**
 * Estensione (distanze [a, b] dal bordo trim) di un crocino che punta verso
 * l'esterno, limitata a `limit` perché non superi la mezzeria tra due carte
 * adiacenti (limit = bleed) o il bordo pagina (limit = bleed + offset).
 *
 * Risolve l'ambiguità con bleed piccolo: con lunghezza fissa il crocino di una
 * carta sconfinava oltre la mezzeria invadendo la carta vicina.
 *
 * @returns {{a:number,b:number}|null} null se non c'è spazio (es. bleed = 0 sui lati interni)
 */
export function cropMarkSpan(limit, gap, len) {
  if (limit <= 0) return null;
  if (gap + len <= limit) return { a: gap, b: gap + len }; // spazio pieno: crocino intero
  if (limit <= gap) return { a: 0, b: limit };             // spazio < gap: crocino corto dal bordo
  return { a: gap, b: limit };                              // accorcia il crocino fino alla mezzeria
}

/**
 * Disegna le linee di taglio (crop marks) per un'immagine nel PDF.
 * `limits` = estensione massima verso l'esterno per lato (left/right/up/down):
 * `bleed` sui bordi interni (mezzeria con la carta vicina), `bleed + offset`
 * sui bordi esterni (margine pagina).
 */
function drawCropMarks(doc, x, y, bleed, limits) {
  const markLength = 3;
  const gap = 0.5;

  const cx = x + bleed;
  const cy = y + bleed;
  const cw = CARD_W;
  const ch = CARD_H;

  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.15);

  const L = cropMarkSpan(limits.left, gap, markLength);
  const R = cropMarkSpan(limits.right, gap, markLength);
  const U = cropMarkSpan(limits.up, gap, markLength);
  const D = cropMarkSpan(limits.down, gap, markLength);

  // Orizzontali (escono dai bordi verticali del trim, verso sinistra/destra)
  if (L) {
    doc.line(cx - L.b, cy, cx - L.a, cy);
    doc.line(cx - L.b, cy + ch, cx - L.a, cy + ch);
  }
  if (R) {
    doc.line(cx + cw + R.a, cy, cx + cw + R.b, cy);
    doc.line(cx + cw + R.a, cy + ch, cx + cw + R.b, cy + ch);
  }
  // Verticali (escono dai bordi orizzontali del trim, verso alto/basso)
  if (U) {
    doc.line(cx, cy - U.b, cx, cy - U.a);
    doc.line(cx + cw, cy - U.b, cx + cw, cy - U.a);
  }
  if (D) {
    doc.line(cx, cy + ch + D.a, cx, cy + ch + D.b);
    doc.line(cx + cw, cy + ch + D.a, cx + cw, cy + ch + D.b);
  }
}

const MM_TO_PX = (dpi) => dpi / 25.4;

/**
 * Carica un File come HTMLImageElement.
 */
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Impossibile caricare ${file.name}`)); };
    img.src = url;
  });
}

/**
 * Ridimensiona e comprime un'immagine su canvas, restituendo un dataURL JPEG.
 * Questo è il cuore dell'ottimizzazione: invece di passare il file raw a jsPDF
 * (che lo tiene in memoria come stringa base64 intera), lo ridimensioniamo
 * alle dimensioni esatte della cella PDF e lo comprimiamo in JPEG 0.85.
 * Riduzione tipica: 5–10× per immagine.
 */
function compressImage(img, cellWmm, cellHmm, dpi, quality = 0.85) {
  const mmToPx = MM_TO_PX(dpi);
  const w = Math.round(cellWmm * mmToPx);
  const h = Math.round(cellHmm * mmToPx);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  // Copre tutta la cella mantenendo le proporzioni (object-fit: cover)
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  const sx = (w - sw) / 2;
  const sy = (h - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Genera e scarica il PDF.
 */
export async function generatePDF(files, formatKey, bleedMm, dpi = 600) {
  if (!files || files.length === 0) throw new Error('Nessuna immagine selezionata.');

  const { cols, rows, cellW, cellH, pageW, pageH, orientation, offsetX, offsetY } = getGridInfo(formatKey, bleedMm);

  if (cols === 0 || rows === 0) {
    throw new Error("Il formato carta è troppo piccolo per almeno un'immagine.");
  }

  // jsPDF caricato on-demand: tiene jspdf/html2canvas fuori dal bundle iniziale
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    unit: 'mm',
    format: [pageW, pageH],
    orientation,
    compress: true, // abilita la compressione nel PDF output
  });

  let imgIndex = 0;
  const perPage = cols * rows;

  while (imgIndex < files.length) {
    if (imgIndex > 0) doc.addPage([pageW, pageH], orientation);

    let posOnPage = 0;

    while (posOnPage < perPage && imgIndex < files.length) {
      const col = posOnPage % cols;
      const row = Math.floor(posOnPage / cols);
      const x = offsetX + col * cellW;
      const y = offsetY + row * cellH;

      // Carica, ridimensiona e comprimi prima di passare a jsPDF
      const imgEl = await loadImageElement(files[imgIndex]);
      const jpeg = compressImage(imgEl, cellW, cellH, dpi);
      doc.addImage(jpeg, 'JPEG', x, y, cellW, cellH);
      const limits = {
        left:  (col === 0 ? offsetX : 0) + bleedMm,
        right: (col === cols - 1 ? offsetX : 0) + bleedMm,
        up:    (row === 0 ? offsetY : 0) + bleedMm,
        down:  (row === rows - 1 ? offsetY : 0) + bleedMm,
      };
      drawCropMarks(doc, x, y, bleedMm, limits);

      posOnPage++;
      imgIndex++;
    }
  }

  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  doc.save(`proxies_${formatKey}_${ts}.pdf`);
}

