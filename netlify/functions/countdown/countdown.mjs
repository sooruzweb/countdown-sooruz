// Compte à rebours French Days Soöruz — GIF généré à chaque ouverture d'email.
// Fichier autonome : bitmaps de la police Soöruz embarqués (ASSETS en bas), géométrie calculée ici.
// glyphs.mjs n'est plus utilisé.
import { inflateSync } from "node:zlib";

// ⚠️ Date de fin (heure de Paris, +02:00 en septembre). Test : ?end=2026-09-28T23:59:59%2B02:00
const END = "2026-09-28T23:59:59+02:00";

// ---------------- Réglages ----------------
const W = 1200, H = 360;          // retina, affiché en 600x180 (ne pas changer sans modifier le snippet Brevo)
const SECONDS = 60;               // durée du GIF
const BLINK = false;              // true = deux-points qui clignotent (GIF plus lourd)

const DIGIT_GAP = 2;              // espace entre les 2 chiffres d'un même bloc
const COLON_PAD = 56;             // espace de chaque côté des " : "
const LABEL_GAP = 40;             // espace entre bas des chiffres et haut des labels
const LABEL_OPACITY = 0.5;        // labels discrets

const BG = [0x00, 0x00, 0x00];    // fond
const WHITE = [0xff, 0xff, 0xff]; // chiffres
const YELLOW = [0xff, 0xdd, 0x00];// deux-points + labels
// ------------------------------------------

export const config = { path: "/countdown.gif" };

// Double palette 32 couleurs : index 0–15 = rampe noir → blanc, 16–31 = rampe noir → jaune.
// Chaque bitmap stocke un niveau d'anticrénelage 0–15, converti en index selon sa couleur.
const LEVELS = 16;
const RAMP = { white: 0, yellow: LEVELS };
const PALETTE = [];
for (const color of [WHITE, YELLOW]) {
  for (let i = 0; i < LEVELS; i++) {
    const t = i / (LEVELS - 1);
    for (let c = 0; c < 3; c++) PALETTE.push(Math.round(BG[c] + (color[c] - BG[c]) * t));
  }
}
const levelOf = (idx) => idx % LEVELS; // niveau d'un pixel déjà posé, quelle que soit sa rampe

const ASSETS = assets(); // déclaration de fonction hoistée, données en bas du fichier

// Décodage des bitmaps (une fois par instance). Chaque bitmap = boîte d'encre serrée.
const bmp = ({ w, h, d }) => ({ w, h, px: new Uint8Array(inflateSync(Buffer.from(d, "base64"))) });
const DIGITS = Object.fromEntries(Object.entries(ASSETS.digits).map(([k, v]) => [k, bmp(v)]));
const COLON = bmp(ASSETS.colon);
const LABELS = ASSETS.labels.map(bmp);

// ---------------- Géométrie ----------------
// Largeur de cellule fixe = chiffre le plus large → le bloc ne bouge pas quand les chiffres changent.
const CELL_W = Math.max(...Object.values(DIGITS).map((g) => g.w));
const DIGIT_H = DIGITS["0"].h;                       // tous les chiffres partagent la même bande verticale
const LABEL_H = LABELS[0].h;
const PAIR_W = CELL_W * 2 + DIGIT_GAP;
const COLON_ZONE = COLON_PAD * 2 + COLON.w;

// Centrage horizontal : largeur totale = 3 blocs + 2 zones de séparateur
const BLOCK_W = PAIR_W * 3 + COLON_ZONE * 2;
const X0 = Math.round((W - BLOCK_W) / 2);

// Centrage vertical : chiffres + écart + labels
const BLOCK_H = DIGIT_H + LABEL_GAP + LABEL_H;
const Y0 = Math.round((H - BLOCK_H) / 2);
const DIGIT_Y = Y0;
const LABEL_Y = Y0 + DIGIT_H + LABEL_GAP;

const PAIR_X = [0, 1, 2].map((i) => X0 + i * (PAIR_W + COLON_ZONE));
const CELL_X = PAIR_X.flatMap((x) => [x, x + CELL_W + DIGIT_GAP]);

// Deux-points centrés dans leur zone et sur la hauteur des chiffres (dans la police ils sont posés sur la ligne de base)
const COLON_X = [0, 1].map((i) => PAIR_X[i] + PAIR_W + COLON_PAD);
const COLON_Y = DIGIT_Y + Math.round((DIGIT_H - COLON.h) / 2);

// Labels centrés sous le centre exact de chaque bloc
const LABEL_X = LABELS.map((l, i) => Math.round(PAIR_X[i] + PAIR_W / 2 - l.w / 2));

// Calque statique (labels) calculé une seule fois
const BASE = new Uint8Array(W * H);
LABELS.forEach((l, i) => blit(BASE, l, LABEL_X[i], LABEL_Y, RAMP.yellow, LABEL_OPACITY));

// ---------------- Handler ----------------
export default async (req) => {
  const url = new URL(req.url);
  const end = Date.parse(url.searchParams.get("end") || END);
  const remaining = Number.isFinite(end) ? Math.floor((end - Date.now()) / 1000) : 0;

  function* frames() {
    if (remaining <= 0) return yield { pixels: render(0, true), delay: 0 };
    const step = BLINK ? 2 : 1;
    for (let i = 0; i < SECONDS * step; i++) {
      const t = Math.max(0, remaining - Math.floor(i / step));
      const colonOn = !BLINK || i % 2 === 0 || t === 0; // frame 0 complète (Outlook n'affiche qu'elle)
      yield { pixels: render(t, colonOn), delay: 100 / step };
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

function render(t, colonOn) {
  const px = BASE.slice();
  t = Math.min(t, 99 * 3600 + 59 * 60 + 59); // > 99 h → 99:59:59 figé
  const str = pad(Math.floor(t / 3600)) + pad(Math.floor((t % 3600) / 60)) + pad(t % 60);
  for (let i = 0; i < 6; i++) {
    const g = DIGITS[str[i]];
    blit(px, g, CELL_X[i] + Math.round((CELL_W - g.w) / 2), DIGIT_Y, RAMP.white, 1); // chiffre centré dans sa cellule
  }
  if (colonOn) COLON_X.forEach((x) => blit(px, COLON, x, COLON_Y, RAMP.yellow, 1));
  return px;
}

const pad = (n) => String(n).padStart(2, "0");

// Pose un bitmap : niveau × opacité → index dans la rampe de couleur voulue.
// Un pixel n'est écrasé que si le nouveau niveau est plus fort (bords anticrénelés propres).
function blit(dst, g, x, y, ramp, opacity) {
  for (let j = 0; j < g.h; j++) {
    const row = (y + j) * W + x;
    for (let k = 0; k < g.w; k++) {
      const v = Math.round(g.px[j * g.w + k] * opacity);
      if (v > 0 && v > levelOf(dst[row + k])) dst[row + k] = ramp + v;
    }
  }
}

// ---------------- Encodeur GIF89a ----------------
// Frame 0 pleine taille, puis uniquement le rectangle qui change (disposal "do not dispose").
function encodeGif(frames) {
  const out = [];
  const u16 = (n) => out.push(n & 0xff, (n >> 8) & 0xff);
  const bits = 5; // 32 couleurs (double palette)

  out.push(...Buffer.from("GIF89a"));
  u16(W); u16(H);
  out.push(0xf0 | (bits - 1), 0, 0, ...PALETTE);
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

    out.push(0x21, 0xf9, 4, 0x04); u16(delay); out.push(0, 0);      // Graphic Control Extension
    out.push(0x2c); u16(x0); u16(y0); u16(w); u16(h); out.push(0);  // Image Descriptor
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

// ---------------- Bitmaps police Soöruz (générés, ne pas éditer) ----------------
// Indices de palette 0–15, compressés zlib, base64. Boîtes d'encre serrées.
// digits : chiffres corps 190 px, bande verticale commune | colon : ":" | labels : corps 24 px, interlettrage 5 px
function assets() {
  return {"digits":{"0":{"w":126,"h":122,"d":"eNrtW0ly3DAMHIn7/v/fppyyHduTERoQQR6SPrumBRA74MeDxmFcSLlUECWnYM/HFBif2+Cj1+TvfsEZ6pCjF3/IuW3u4yZ6FCrA5DEDPQn4jzRmoQcuuWtjIqrZJPg7GOKbOqYjo9Zv+1BAxYzPDR00hN4PLTSzTXJIejs00a5Nz3RV9lEu/bwNZaQL9jzU4TeY+xe8sryzr2CvL9jrWIKwT++vdH/0Vex/c7s0lsE9m9w68tF2uPprpzcryZ/ifVrK/kP4s69l/x5y4lgMuzS3Xfk8WtC0HPwlYkGf8OS6W7FIK+AxPUamzYWprUjj5ReLdyOB9XtFFJsvgLhQYiie2YZmPN55noNAb99g1WeWfzxmtWMR/c7Enz4UMNrS6a0LZh8WVGjQEB0R3mHPbiTsDhOqYQ/EHjt15Hfpgs7LJm5kwO0HoiHhvM8iLxp1FI+o3gNGF6WD1gKYXZ2aX1iprgD6Ec+5LZ3jDf0n4vE6bfRudnr7AjKSGK8SZkGzs6TDBTk76U4+KUU6qMCKtHbk7KTLparITtoUve0ycnban5pasAHCTe3/2fewt/EPs/edHkeza0Yb2uqcYqStbWeWoWNdVMywmcwyWc5O/zaZYauYnC5YE9TvKFWVI9ADHqPm7sPRQxunZvLD0r2euKil5wcnPTfR6yLbAayiTq1nr8gOUFjR0+PajIxtZL0UMIgL0EhXaWr05k3AYC3qWPybQQFrQEm4A1ZsDepzRXYHrAgyc5o9M8a/y4RsJuL01P5hzMhncufEyJLrXaHIzUGZHGT/lC3QDilO9rbPghG7LwpzH/3zMQ/u/o5QO7hbZK6/oV0kfBPp2addNThrLmBdRM9mvnjR8hX0t0I9rGe3+04Pfkx/82r2sO/k5Clnl7Xsaee9zVPSyhtFXyv8X/J12mTwq29u2uorYmAKljeZ3Erdv6yP7Qp2c+9M5x78vQ5E5dHXxHuiMD9UD4oL1ZFp0le6HTzKNsk1ow46eVO58cR7ITc96jXOiuOcrP3EHD+4ibZf+budI0xSf5PtVg4/Qf56418jbbqlgJZubPN+K8CGIvqClsNN6o8v4P83rjOQwn8BD2tExg=="},"1":{"w":55,"h":122,"d":"eNrt1csSgyAMBVADIm/y/39bddqOrbSGu+iik7s/Y0iQpPJITtE7S5MohV9Tc3A0zra0vBiAbcnfv/mJreV6QtgKF4gxlxlizJEgxsVCjHnBGAeMccTY2cnYyQnZ+/mk7K2fYsYWY5Ugxglj7DB2KHOEHaYwxNhgLGHsObxBljD2ON0oCxhrBLH7VSltywDLOyOzx84+j478HptEzJ/eo7mKq3wJCSptnd1H4CttGvDYrnHXf2t3B+WxN+zZTuhwgvvWPdzkLzdllxnhXzBcZbcnU8R6sgBbWTKChPWk30pq8mVwTAX+HckEZuw2O4x5jAWMRYwljGWMFYzVn7KmTJkyZcqUKVOmTJkyZX/EuMtCuUi+AXi6+Zc="},"2":{"w":117,"h":122,"d":"eNrNmgtuxCAMRPkEws/4/rftbqW2atVtMDhMfYEnw8xgSIx5lm/aVXMK3pq/yvMtRSW67dBn1Wj3Qx/9nnY/9IENAChzsQAokwdAuQcAlDkgoD+pe6DdA6BMFgDlgoByREC7BUA5I6DsENCMgH7t6kbol4B3QisC+rm+O6Gfub8VmhDQioASAvqhpK1Q9gjogYR2lRIa1elUlnSqVoSANoF6tSoM+dQpEm0o4uFssXyiQfE2rSZjnZy4p+vIXZIN5zrRnW0ueheaLF18stnFJmkiefOSQepS3N9qEK3VFRlER7tCgyjEkdwgL+ZPQZ6Xvjg0SBud186L6/99BnlxeRppMpPKRDZ+ktrYWKnCFoPMKHfZIOLQtesGkZ7dKgYR9bkUrnP76VLXRvYL3Vp9JLeLCSWSOrJfnGZOfS8fCrqIoaC/meVq9kvqTxrpMmyLcpN5YATTZbY4clwX1WUdm+IV97OGwZkkbtSO8tNrL5LxXeXYbKfoXp82GeRb+K1rJ4oH97LHIIoqKmHqGrbQKJ2Tb0Juj0FUpNviysMXTRlk7Ynk2GKQxdWdMshSAvZJg/zUbr8tXBW2VByuf9SpOX1oxhFl5Qfwqjd9qEVDT97oV9/7NWMESrcwDf8/KDvA8nL17obSv3YP+J4Q0IqAFgT0REAPBBQhXzINAU0I6IGAGkJAEwLqEFCTEVCPgG5v9R1qOwCq914mgZqCgFoCQDH/8I391KMN3UmlOz9VjNwbPAGgxmYA1JijAaCPnW0A6PNzbbtZUv33x6Vw5tpuq/oGM4hNyw=="},"3":{"w":108,"h":122,"d":"eNrd20luwzAMQFHLGqzRvP9tmwbtogunFMR8IOYFHqyBGkz1bhWt5hTc9iLENs5eooOsp1cDZj2iJ856aJGzRNrOWXImzhIpoCXNcZZ0x1l/MAGxt1tSQUsO0JIAWsNx1u+cRqyfVmSsDloSQWuA1vPDKKuBlnjQyqA1QOvRiJx1gFYDreEE7DCLiFVlpc0konKGmUSa2uQsRtMuYgYRlOuKRbjz/3OLlbWNe1pkGypmmJnVuXFYhLJc1m5vlOHLVbRTlXuLcX5VncNMspDuGAZY585ZfeOsDFqBs07HWWXjLM9Zc5uNNSty1mSOD9xnLVlt4yzPWdOnhsCkp1VrOLC/CmjJDloVtCY/bM3KoDW1VK6uXxG06nbP/cZU/l21DtCa6bDVc8rMNsD3dlEJMHSDY98swre3rGIXUa1n89r1xtRAfBmH/YJ53WWgpWhEs7tKxd3XR1qKNvzIsZG5+aWZywnMUUb5UHN9KHtajyOrFhXyPxH5/yuDVuSsx/4Q7C7OSpz1vYuirArWHgTO6vesgSFre/wta7HIGjOwdi7fstYRrOEcXG1q37Ga287VEld3w9rv5qma9pG4NwjuXm8rzp6v34wYPoUpOfmXl59fhXESZA=="},"4":{"w":104,"h":122,"d":"eNrt2stu4zAMBVBatt4P/v/fTqZFNwViXYkM0YXvPjgQLZOxbKK9HKePudT2KzVH70gpxxVr57cZLV8KypVvjJ/0KFuViwDyvap47CtpMJ7uNy9LXFH+J+8syXdeTjuXF5N5J2Nx552dN7N0kcLg7SysKLIgA76TEovSbBjmaMNglQssTwa6pgLDY9oXjqHhzK9QVWGmWy7qMLOd4IaSM+k+TYvhZFG1V8pdj9ZjbjdCs3ESmzgXmzhHt3Eymzi6VXvrKFftrVPYxPHwz8PpvlJ3HLR9jgDPjyYYOt2RyAnrzI4DVm2cJHPAqgWSOeDQKSRzwKHze+AvO+DQ8SRz0lbVlh2wav2QOWj79CRzwKGTSeZcu1Vbc9CqXSRz9qu25Pj9qq046JPOSTIHHNWJZA44dBrJHCeqGu6AQyeSzBFWDXXQUe2EjrRqoAP2tUpCp0mrhjlgwwkkdJq4apBzyasGOVhj8yR0sD5dSOpAu2B6gDZ3skLVEAfZbfNzx6kDtTYnd5Bd3UnuRI1dADhZ2KhRB7tLozvuM3XQA91xn+kk1jzM+wtONXKKkZONnGjkeCNH7xWCwlzQcLKRcxk56ke77/5XJSPHGTkmO6GpvoWbPJdEI8fgXl16PhU75I2cj1+i9pG3fncnD8nIUfmgATpJObuNQ0eycV5LKjbOS8rDxHk1h1C6hfP1kWNIpbaOZ2w566mP8ziP8ziP8ziP83GnKzm53af8A18J8rI="},"5":{"w":113,"h":122,"d":"eNrtm+tuIzEIhcfjO77w/m9bqW12U00y9sRw0pWW35E+YQM+wGTbBra7kDKVumppG5txkVpnGaOhZ6FIsT4tn+M8idIGQBMai9sJUAN3AnSVGQg0mRkJtJWhQN8ZCozMUGBiLDAzFqjr3xEYGAt0jAWaBgYSY4GesUDTwcDEWODewUCIg3dAyA3eAwODgRUM3BkMjGhgAQNBMfq3t7BzP6+UFy1cSQqym5jNKJm4CVq5VAUFbJz23YgCx9oiifK2cVY4WeD4Cvf/wF9+hw2chjN5KHumE5WmiAJnammR9HHqtejZ231gZrICWqH3tffeCqVgR1zxRq3X5E+hGp1apxOmkg7u+ZlK0NOlz4SJovKmHXimXwf7SA7pKtNq0SMvDsewURbfGe0iF6NdbYZE9TnNgag+iSroQz1EjtUGHrJDf5ZhwbnBFZ2NxzZTm3jUm9oTFIJuZh7Fjeru6UnXYBL2FhX3hyfzkNBwuXjbAVdc2NwOljrwTL/dpIZIxR9MG6nKetrGPZaxPsSU6dRKaauXeNWMm1MNHt3big7S4nLUyI9EhCcU/uVa86JN9JpNFDjRiP3jwB19hwENbOC0SK/JGt3SJrd0mZRfX8XbhlWLkwrhW7dh9tx3QYoDZjTQg4G3xRkMWDYw0IOBf0QiChix35vc7VoT2EEQsKE/4XHv+ygKAqwGC/w5T0i4GoMChjfP9RKYh1+V6M67HHYZ9HBjnYDXpwssdkMCq1/pQq7jwlrbczE0ya32WVdeWgr7emM36VmlaMcDvLD8N6paKKfoJ1gfD+U5Vw=="},"6":{"w":116,"h":122,"d":"eNrFmwmW2zAMQ7VY+3b/207TNmnScRzIpjC8wH+WRIgEZaWg0NbFlEu9FkWhYVyqfUhE1xjQFxneLRrC3LIcEGNuZcjGR6aVJn5k6jgGmbm1wWau+Mhjpi6DzTRtsJm2DzZzIfIdcyXyDdOsRO4zdRt0Zhl0Zhx05jboTN35zDzoTDfozMVpssuMg840nc9Mg840g89MfCZlN/9jRgrypV+ZyM1eYvBnw52RoOq1Egr02gxKLMBE6ZscUgUMaQWRqkJMya9UFkJGSSS2tFUUiZ1a0ZXFdC/LfiYkCFaWiVwpRRYJZYqTRZrJ+0AikOI9CS8tkp2tzESOwdnDlVlUvbcS7EWxPRU1mn1fZm0llO1pgb9CNedU6Frh9a268IRyrxp+azS6Ize6v8MTnZLdkrEOPrSxmE93E4/5797vPOajKyMyH0UVk3nfUibyXm9QmX+bgc6Fmh9gph9gdsPVhMeOVjLzJgxs5i1HC5uZWabbqy4ENvNX9+zpzLB+vrGzoaazmY0vCjfNRZKlWYOE9RU7RFBRjVoY0CTcYwcXtmqQNi9ijVk3gm17AhvQKGiJFFBx8Q9tCBNTvyRnN1W4094kmeDQoWmpta34DClLuaRlwlKIQi5pnrFrEGgBjyPc32ctYQbHOb+mfZgjQa9V/OwouyW/vY3Y8awjjQVfJM0wmY3rEr3kuSUyA9uaehZuXsn5pNu0D01E73jvTkz0peW8q/l2TziiCFHt48R93LdfPlryblKGELt13OJLzTEndsd1+UJo1YoNPWp5VongYfMRiednacp8nPxbaUXqwGMDLbupDfNANkGTNaPPG3QQcsi6n3i5oKPAtvY0+YZD+3qVaNR82HgeW8MZ4h+sn//Xq7fsTwPvNsHm0X/aSk7BHfK+APQFaYM="},"7":{"w":109,"h":122,"d":"eNrt2wFuwjAMQFHSNGlSp/H9bzvQENM0thph/kQVX+CrxXppK7E2zxGpJcdw+mU29Z9Nlng31vQ103LgYqq9BC52zi1g7HwzIxjTnsGYaiVjupIxFTL2dW1E7Pa7ITHNZKxPYOy6JFDs80ZSsR7AmC5k7HJpWOzyq3GxRsY0krGFjAkZ6wGM6UzGMhkrZGwlYyL927zWkHCd6Y+J92b+MWmuu2A5zmZ9pnOYolxseuRJ/NkRy2HtNGl3GxO2HbeHR49ZLEe113bse+C3H6vhhPFqRcPXkeAVM3hevFrZ9HDlM8FwWqwUip4XZtgOv72X/ZabHslwYV4GB8Mny41D0Q8PA4p+R7QBRfXajllBqBoosAXFBKLYBooOKAYQxQyi2I6K4gqi2AeKb4aiDBQHigPFw6C4kCiSr8/zUVGcQBQLiOJGophAFIVEMYIoVhLFAKKYQRTbUVF0OzIreGRG8sgcKA4UB4r/jmIcKL4ZiicQxfmoKE4gigVEcSNRTCCKclQUK4liAFHMIIpv+R5xqk12/nDTHt6OD/AJdOM="},"8":{"w":110,"h":122,"d":"eNrdW8mWgjAQJCvZ8/9/Oz4c0dEBCu3Uwbrqo0i6U73QmaZtKONDzAVGjsEbNb0BZUNp/Q20EuxJRhvfYloZo8W5fOkfo3iMywlwLXzumEvnLoakjzaxdUG0/eXFLoy44/W5iyNvnQZd+wAURSTboFOlD0L+hy33YYjjvfER87OA9KEwfz2kjWWrimS0V9O5Phz3vVR1PFtZ2eZOwE2gVWOw3RbneycurnLYrgJmOwlmuGY9ItB8ZBEU5kYuWxl4bDNBIh+9kme2S8KniGa7GA4TkuSMNnoDl59cgh7jodMGVBDQWwfESSJSrCC+nQpiXKg2AuS2VExxAABRsjZIAhAYYJea1EYiJ7dhYipluGO6iq5NhK1pjA3JgIG/OLA7AJABy08YG6ATFdESqNWCyHtBdLICljNI5EpQntzmzQDwGwZmKEzOcMHRdgAnsJoZu/VUeGyFmLwucdLx2BwzV16CCS2hTKSi+0GSVKV5JK3sXtNEjp+sQdkTl3ZBoVkNTM4k+2rDHWWemI0udy7xlFAtRuP1uU4yjBOw5jaJwXbLEzVHuTTNavcykBVOr25Ji2+O5iM3P+HmJcRmkP3uHl7lsVUFCkndn1AAX9lATlKOJg+UhQxiPbTfMmV394BLYi0MpBAMgCSDXTXgSRHQLbmuWkqQ4Ah11fKxcQW7amQ26k6mCEm3UOspAuctip2A4JmnG+o8iSmXg/LkdOgoCkoTDRbfWpx3EbGnKGbsLtS85Iv7XEvdkYlmo40p/Fb6tK3UE7HsyMSy+97EoPhJPfNRRLA/k0nuT7OcPfmxWqRbQpnoesqkDMtFCB3K10oiDVcRznAodfB14zvoGLrNj64jpqOLJk5+72eislPtL8O8Iyf2M1BDS91GqODtB4mbFtXjV0k+vUWS3HQKH9yQie7NOznnb//Y3dLyB2p1fqU="},"9":{"w":116,"h":122,"d":"eNrFm+mSpSAMhUEWWRJ5/7ft29MzUy7Xa9Bw+vy26quQhQTQmFNZF+ZcKglUS56Ds+aZfKrcOrVQjtNdoEvdvP+i+Q7W1/ZMNfTa+JT4LY4dvrWp6Yij2EhuaqpOhIxNVUmATE1ZdBnCualrCWAr/2j+hJzbGH1wamijlM+Q09LgUGoDlaDO/Kt3NWlqg+WPzDqayYeS79twVbiZx9oAMPNVBbeltyCY29WdGkYBl5tvY5dAzFUYoZb2FUZ2UD8iMrQ0vKHc4IY6ILLx6P7gfH8RdV4U3HQiF3rmqSIOofp5+LBRTP2pulX64Udq6Yoi7qkfz/tx+v54UTCzBzqJmCQb6ap8caWxdj25yjrkKmJm4ewaxPVPjylc3SDxZxUP6dKm/prJVtVQEuWnFx/yCB1KTStZpPuiE9XbJGWK2rko21dq9O5a3on6nAzeP3/ywMGZbCyjma89o8AN9bDRYV398A6dsQ3uv3RPaGY2+MUtoOOE/eaILkUEnXpXTLChDDsg2jPdLzCxOcrow5MV0y3guAXHLsGPwzZNekYxi8FD8/ibpIu5HXMOt7tD84imYT//WIBTJ/0b9Fuz5WDqyQztMoNSZeNXn+qCSJX37016xDfC9qnoVtg+kqTfYGUz05MQuifRLBt1mbHh3cl4d8YGd6fsMFU3O0UHE4vVRMp6uAJ35qFHQCA1lzY93ce6FcTTzuqJmJ1uy4VEt1oEyAuFXQSBmGzwzIhnbptMjzcTw6RfeFnj8cyKfyh1uLkFMGf8gzAycOabO/HhzGDgzGTgzGLgTLJw5snd9EgmTwbNPH06Po55/gxoGDM/vOS/UX2iQTPJGTBzmRUeUHR68mqGV2eW6/9IdJmcJH+uKDKXEmTznhKTa/LiAdPRQ/X90/YF1FNo0A=="}},"colon":{"w":33,"h":90,"d":"eNrj4SEA+EfBKBgFgxLwEZJnIgQYRsEoGAVDE/CM1t2jYBQMUwAAY7lzfw=="},"labels":[{"w":119,"h":16,"d":"eNqNldu2xRAMRQkadf3/vz1uEU61Y6+nNA1TJHDeey2KoBheiiF9e5LrHlltaKablpxR3ioxJdFNvyEnWA6GlHNuf1QxMowQzKzU1wLVblPLRFZ3UhwDwuLG4TRpcUJcsWlg9RKR48BOmIyMXeeai/b5id0i0xm7jUtf2DUw2z5a5QPW5jMWFmx1WlDQJd6xQhWVEKXqSn33XXWLaDBIzsSTDxrhqpZmbJsXJekL276rHGNrY0TYRzesY0fckz9s8ldtS7qei3Y/OyNtm5yaAr5gzc9YtXYKLSUcarsV/D5jr19batuXizY9HrDbmcymhkQfgg8LttlhyC/Y/p/PraRko+Prou1VpOHzNGsXYlX960+dLKdzUSPYOS3spzHd3GM1ryBeVascj+e2Om89tFUsILr/BaeEcSlRMjR8OBV961qXcMS6Q2334lg+VcncAx4/routzfJ9xKpDJ2/t48WClQIwLNh11fMA7Rdf26Xr8RSY+My2VGVkley89OcgXVImrHTf2UYt0Nreg7IYOAnysiTkbgB0ITiqYXvhSgBdY8jvpsI5fLQGz2dNCfsDs/U3ng=="},{"w":142,"h":16,"d":"eNqdltu2hCAIhvOUZ3z/t90JaJjNmln7v0kJ9QtQO1SsUJM+ulSoANkdt86csx8dFUot57QnReZ0tQ224myFLDQmVD5ttkMLV61L64I+iaJ28zdNvLppjKv4Niu2A9PA1bbY6uNpmdyE/DKedPKkDoRRJ27k642f1kkTGkyasUJEe2uVaepCY3caXrm82LS0ge5omQn6s8ASnHDHBl2BY/KZ5mNsbHuhCTuNLfQaH4kDtdPgxLzgNxptjDmxAi6RX498NZql7njnYdOYdBOIAGnckqonjWPDN5ou032O5cOqViyR/XQbMDYGw0Q0aqnjjcZSquIPNHalcTInI1MRe6jix4YATFVBjiJT9aQ52fUfNKq+1I2RtoiTuyPhokTjZap2Gqqr/9DAC829jzHyFBuH8c9Io6XzToOuP9XNg6YXdauFNd1cKrULjxmiQW5LNFTnH2nI9UmDPvY+B19o+pByfBTOyBP0+EemkanaachV0uDZUoKPsJ6cDxrc4c6y2M2Mvp2HnaWCByrQJVUvNOhaxYfKzTIP7p3GtG/nc4tMMwteowuMVImbYdDMavTyMmMV9ZHmSC87PK9nceNUW7iRRarErWnGe3aNIgkMCFHAIA2Ivkr7TSpjU+0RLmm62UuJli/5S/RnYK+WG/8Tw9p/AqKVJajPVEryeqnLPo1fLNaHIcMbbRqCu77kD8fcP0I="},{"w":168,"h":16,"d":"eNqNVlmC7CAIdMdEpe9/2zcuCKbJzOOruyRFhc0YE65CdhkyFTRxo2ljPk/kzp4djYXaKtjxUD+1Exas0UhLd/midplBZ+DDVsklC7Dt2IXBrHgisMw6+dzP7xHATRgFb3FGY97UQTq7+FF0qqCpCtklPVk9wWXpxKWzSe9myf1WSJyUiU4GH7RPRTufoJCFRYOLlErf9eACXnV+qKOc9rJHOByqsyMzXB5w/gR7jBb9tJWKUa80vAbvLQhyP4QvnW14j6Ki5fJhIA2Wc1xZWGcH200MQSdJlkyk7mz+mYgsircizxdNs2meOtfgCLqh0z/idbrC/9uqG2IrUetE6k8QCdhboZ8H2dRe5NNNQNc5X2WtDFlheu+8hWGFRxvQSkiKzkuOlPSjsfUseuocOYAXneOQSlG0OZLYfc7aojvFtz90+u/kLp15PPIfOqu2NI5k/ZQ6lTZMJHSMa112v9c9yp6FZ92ncpve655EJRrF23s+3HULKxy07ncZHMEomkCZoyJ3kZU6B5TS+xx5pm7m1XpZWiCLeOq86MCLBCAs0InGulO38rWXZoTyqDuO5xM+rhVM4aT2W1lnPhcvJbFoez6/7/lt/tQ5C8ocjz0ff9vz5bwSPtp9FLR7U1zCe3mc4ndbWBqSesY+dd5G+0gg3/u8jw6Ze0wiat8hF37f5MBYS8dF0W9F3w5F8jsEs2jB6/d8tmDyNpCT49LG+RPO+I2yr40wH49iGQC5WDg+4YBZ3TErnk8WdWRlnfkfZ0NNOA=="}]};
}
