// Compte à rebours French Days Soöruz — GIF généré à chaque ouverture d'email.
// Zéro dépendance npm : glyphes pré-rendus (glyphs.mjs) + encodeur GIF maison.
import { inflateSync } from "node:zlib";
import { W, H, PALETTE, LAYOUT, GLYPHS, LAYERS } from "./glyphs.mjs";

// ⚠️ Date de fin (heure de Paris, +02:00 en septembre). Surchargeable pour tester : ?end=2026-09-28T23:59:59%2B02:00
const END = "2026-09-28T23:59:59+02:00";

const SECONDS = 60;      // durée du GIF
const BLINK = false;     // true = deux-points qui clignotent (GIF ~300 Ko au lieu de ~65 Ko)

export const config = { path: "/countdown.gif" };

// Décodage des bitmaps une seule fois par instance
const unpack = (b64) => new Uint8Array(inflateSync(Buffer.from(b64, "base64")));
const G = Object.fromEntries(Object.entries(GLYPHS).map(([k, v]) => [k, unpack(v)]));
const L = { live: unpack(LAYERS.live), ended: unpack(LAYERS.ended) };

export default async (req) => {
  const url = new URL(req.url);
  const end = Date.parse(url.searchParams.get("end") || END);
  const remaining = Number.isFinite(end) ? Math.floor((end - Date.now()) / 1000) : 0;

  // Frames générées à la volée (pas 60+ bitmaps en mémoire)
  function* frames() {
    if (remaining <= 0) return yield { pixels: render(L.ended, 0, true), delay: 0 };
    const step = BLINK ? 2 : 1;
    for (let i = 0; i < SECONDS * step; i++) {
      const t = Math.max(0, remaining - Math.floor(i / step));
      const colonOn = !BLINK || i % 2 === 0 || t === 0; // frame 0 toujours complète (Outlook n'affiche qu'elle)
      yield { pixels: render(t === 0 ? L.ended : L.live, t, colonOn), delay: 100 / step };
      if (t === 0) return;
    }
  }

  return new Response(encodeGif(frames()), {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
};

function render(layer, t, colonOn) {
  const px = layer.slice();
  t = Math.min(t, 99 * 3600 + 59 * 60 + 59); // plus de 99 h restantes → 99:59:59 figé
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const digits = `${pad(h)}${pad(m)}${pad(s)}`;
  for (let i = 0; i < 6; i++) blit(px, G[digits[i]], LAYOUT.digitX[i], LAYOUT.cellW);
  if (colonOn) LAYOUT.colonX.forEach((x) => blit(px, G[":"], x, LAYOUT.colonW));
  return px;
}

const pad = (n) => String(n).padStart(2, "0");

function blit(dst, src, x, w) {
  for (let y = 0; y < LAYOUT.cellH; y++) {
    const row = (LAYOUT.cellY + y) * W + x;
    for (let k = 0; k < w; k++) {
      const v = src[y * w + k];
      if (v > dst[row + k]) dst[row + k] = v;
    }
  }
}

// ---------------- Encodeur GIF89a ----------------
// Frame 0 pleine taille, puis uniquement le rectangle qui change (disposal "do not dispose")
// → le GIF reste léger malgré 120 frames.
function encodeGif(frames) {
  const out = [];
  const u16 = (n) => out.push(n & 0xff, (n >> 8) & 0xff);
  const bits = Math.ceil(Math.log2(PALETTE.length / 3)); // 16 couleurs → 4

  out.push(...Buffer.from("GIF89a"));
  u16(W); u16(H);
  out.push(0xf0 | (bits - 1), 0, 0, ...PALETTE); // table de couleurs globale
  // Pas d'extension NETSCAPE : lecture unique (sinon le compteur "remonterait le temps" en boucle)

  let prev = null;
  for (const { pixels, delay } of frames) {
    let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
    if (prev) {
      [x0, y0, x1, y1] = [W, H, -1, -1];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (pixels[i] !== prev[i]) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) [x0, y0, x1, y1] = [0, 0, 0, 0];
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const sub = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) sub.set(pixels.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + w), y * w);

    out.push(0x21, 0xf9, 4, 0x04); u16(delay); out.push(0, 0);       // Graphic Control Extension
    out.push(0x2c); u16(x0); u16(y0); u16(w); u16(h); out.push(0);   // Image Descriptor
    out.push(bits);
    const data = lzw(sub, bits);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0);
    prev = pixels;
  }
  out.push(0x3b);
  return new Uint8Array(out);
}

// Compression LZW à taille de code variable (spec GIF)
function lzw(indices, minCodeSize) {
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let size = minCodeSize + 1, next = eoi + 1;
  let table = new Map();
  const bytes = [];
  let acc = 0, nbits = 0;
  const emit = (code) => {
    acc |= code << nbits; nbits += size;
    while (nbits >= 8) { bytes.push(acc & 0xff); acc >>>= 8; nbits -= 8; }
  };

  emit(clear);
  let cur = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (cur << 8) | k;
    const hit = table.get(key);
    if (hit !== undefined) { cur = hit; continue; }
    emit(cur);
    if (next === 4096) {
      emit(clear);
      table = new Map(); size = minCodeSize + 1; next = eoi + 1;
    } else {
      if (next >= 1 << size) size++; // le décodeur bascule sur le code SUIVANT
      table.set(key, next++);
    }
    cur = k;
  }
  emit(cur);
  emit(eoi);
  if (nbits > 0) bytes.push(acc & 0xff);
  return bytes;
}
