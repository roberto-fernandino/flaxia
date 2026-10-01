import type { OcrPage, OcrWord } from "@/lib/engine/types";

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeWord(raw: unknown): OcrWord | null {
  if (!raw || typeof raw !== "object") return null;
  const word = raw as Record<string, unknown>;
  const text = String(word.text ?? "").trim();
  if (!text) return null;
  return {
    text,
    x: asNumber(word.x),
    y: asNumber(word.y),
    w: asNumber(word.w ?? word.width),
    h: asNumber(word.h ?? word.height),
  };
}

function normalizePage(raw: unknown, index: number): OcrPage | null {
  if (!raw || typeof raw !== "object") return null;
  const page = raw as Record<string, unknown>;
  const words = Array.isArray(page.words)
    ? page.words.map(normalizeWord).filter((word): word is OcrWord => word != null)
    : [];
  return {
    pageNumber: asNumber(page.pageNumber ?? page.page_number, index + 1),
    width: asNumber(page.width),
    height: asNumber(page.height),
    words,
  };
}

/**
 * Aceita o formato camelCase da API, snake_case legado, JSON string, ou
 * `{ pages: [...] }`. Sem isso o overlay some em silêncio (`ocrData.length` fica
 * undefined) e o highlight "some".
 */
export function normalizeOcrPages(raw: unknown): OcrPage[] | null {
  let value = raw;
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    const pages = value
      .map((page, index) => normalizePage(page, index))
      .filter((page): page is OcrPage => page != null);
    return pages.length > 0 ? pages : null;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (Array.isArray(object.pages)) return normalizeOcrPages(object.pages);
    if (Array.isArray(object.ocrData)) return normalizeOcrPages(object.ocrData);
    if (Array.isArray(object.ocr_data)) return normalizeOcrPages(object.ocr_data);
  }
  return null;
}

export function wordExtent(words: OcrWord[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const word of words) {
    w = Math.max(w, word.x + word.w);
    h = Math.max(h, word.y + word.h);
  }
  return { w, h };
}

/**
 * Jobs antigos com parser quebrado gravaram (x,y,w,h) ≈ 0. O overlay vira
 * pontinhos na granita. Detecta pra disparar refresh_ocr.
 */
export function isDegenerateOcrGeometry(pages: OcrPage[] | null | undefined): boolean {
  if (!pages || pages.length === 0) return false;
  let words = 0;
  let usable = 0;
  for (const page of pages) {
    for (const word of page.words) {
      words += 1;
      if (word.w >= 2 && word.h >= 2 && (word.x > 0 || word.y > 0)) usable += 1;
    }
  }
  if (words === 0) return false;
  return usable / words < 0.15;
}

function nearlyEqual(a: number, b: number, rel = 0.08): boolean {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom <= rel;
}

function pageLooksLikeWordExtent(page: OcrPage, extent: { w: number; h: number }): boolean {
  return (
    page.width > 1 &&
    page.height > 1 &&
    extent.w > 1 &&
    extent.h > 1 &&
    nearlyEqual(page.width, extent.w, 0.12) &&
    nearlyEqual(page.height, extent.h, 0.12)
  );
}

/** Rotate axis-aligned box 90° CW inside a source of height `srcH`. */
function rotateBox90Cw(
  x: number,
  y: number,
  w: number,
  h: number,
  srcH: number,
): { x: number; y: number; w: number; h: number } {
  const corners: Array<[number, number]> = [
    [srcH - y, x],
    [srcH - y, x + w],
    [srcH - (y + h), x + w],
    [srcH - (y + h), x],
  ];
  const xs = corners.map(([cx]) => cx);
  const ys = corners.map(([, cy]) => cy);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const y1 = Math.min(...ys);
  const y2 = Math.max(...ys);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Rotate axis-aligned box 90° CCW inside a source of width `srcW`. */
function rotateBox90Ccw(
  x: number,
  y: number,
  w: number,
  h: number,
  srcW: number,
): { x: number; y: number; w: number; h: number } {
  const corners: Array<[number, number]> = [
    [y, srcW - x],
    [y + h, srcW - x],
    [y + h, srcW - (x + w)],
    [y, srcW - (x + w)],
  ];
  const xs = corners.map(([cx]) => cx);
  const ys = corners.map(([, cy]) => cy);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const y1 = Math.min(...ys);
  const y2 = Math.max(...ys);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Vision OCR uses the raw pixel buffer and ignores JPEG EXIF orientation.
 * Browsers apply EXIF for `naturalWidth`/`naturalHeight`. When those disagree
 * (page landscape vs photo portrait with swapped dims), remap boxes into the
 * space the `<img>` actually paints.
 */
export function alignOcrPageToImage(
  page: OcrPage,
  naturalSize?: { w: number; h: number } | null,
): OcrPage {
  if (!naturalSize || naturalSize.w <= 1 || naturalSize.h <= 1) return page;

  const extent = wordExtent(page.words);
  const pw = page.width > 1 ? page.width : extent.w;
  const ph = page.height > 1 ? page.height : extent.h;
  if (pw <= 1 || ph <= 1) return page;

  if (nearlyEqual(pw, naturalSize.w) && nearlyEqual(ph, naturalSize.h)) {
    return page.width > 1 && page.height > 1
      ? page
      : { ...page, width: naturalSize.w, height: naturalSize.h };
  }

  // EXIF 6-style: raw landscape, displayed portrait (dims swapped).
  const exif6 =
    pw >= ph &&
    naturalSize.w <= naturalSize.h &&
    nearlyEqual(pw, naturalSize.h) &&
    nearlyEqual(ph, naturalSize.w);
  if (exif6) {
    return {
      ...page,
      width: naturalSize.w,
      height: naturalSize.h,
      words: page.words.map((word) => ({
        ...word,
        ...rotateBox90Cw(word.x, word.y, word.w, word.h, ph),
      })),
    };
  }

  // EXIF 8-style: raw portrait, displayed landscape (dims swapped).
  const exif8 =
    pw <= ph &&
    naturalSize.w >= naturalSize.h &&
    nearlyEqual(pw, naturalSize.h) &&
    nearlyEqual(ph, naturalSize.w);
  if (exif8) {
    return {
      ...page,
      width: naturalSize.w,
      height: naturalSize.h,
      words: page.words.map((word) => ({
        ...word,
        ...rotateBox90Ccw(word.x, word.y, word.w, word.h, pw),
      })),
    };
  }

  // Same orientation, different resolution — uniform or anisotropic scale into
  // the photo. Skip when page dims are just the word extent (coords already
  // live in the image pixel grid).
  if (!pageLooksLikeWordExtent({ ...page, width: pw, height: ph }, extent)) {
    const sx = naturalSize.w / pw;
    const sy = naturalSize.h / ph;
    if (Number.isFinite(sx) && Number.isFinite(sy) && sx > 0 && sy > 0) {
      return {
        ...page,
        width: naturalSize.w,
        height: naturalSize.h,
        words: page.words.map((word) => ({
          ...word,
          x: word.x * sx,
          y: word.y * sy,
          w: word.w * sx,
          h: word.h * sy,
        })),
      };
    }
  }

  return {
    ...page,
    width: page.width > 1 ? page.width : naturalSize.w,
    height: page.height > 1 ? page.height : naturalSize.h,
  };
}

/**
 * Espaço em que os bounding boxes do OCR foram medidos (já alinhado à foto
 * quando `naturalSize` é passado).
 */
export function resolveOcrSpace(
  page: OcrPage,
  naturalSize?: { w: number; h: number } | null,
): { w: number; h: number } {
  const aligned = alignOcrPageToImage(page, naturalSize);
  const extent = wordExtent(aligned.words);

  if (naturalSize && naturalSize.w > 1 && naturalSize.h > 1) {
    // After alignOcrPageToImage, words live in the photo pixel grid whenever
    // we could reconcile page vs natural. Prefer the photo so scaleX/scaleY
    // match what the <img> actually paints.
    if (
      nearlyEqual(aligned.width, naturalSize.w) &&
      nearlyEqual(aligned.height, naturalSize.h)
    ) {
      return { w: naturalSize.w, h: naturalSize.h };
    }
    if (pageLooksLikeWordExtent(aligned, extent) || extent.w <= 1) {
      return { w: naturalSize.w, h: naturalSize.h };
    }
  }

  if (aligned.width > 1 && aligned.height > 1) {
    return { w: aligned.width, h: aligned.height };
  }

  if (extent.w > 1 && extent.h > 1) return extent;

  return {
    w: Math.max(aligned.width, naturalSize?.w ?? 0, extent.w, 1),
    h: Math.max(aligned.height, naturalSize?.h ?? 0, extent.h, 1),
  };
}

/** Words remapped into the same space as `resolveOcrSpace`. */
export function wordsForOverlay(
  page: OcrPage,
  naturalSize?: { w: number; h: number } | null,
): OcrWord[] {
  return alignOcrPageToImage(page, naturalSize).words;
}
