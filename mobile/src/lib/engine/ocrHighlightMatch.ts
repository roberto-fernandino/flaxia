import type { OcrWord } from "@/lib/engine/types";

export function normalizeOcrText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

const MIN_SUBSTRING_OVERLAP = 0.82;

function overlapRatio(shorter: string, longer: string): number {
  if (!shorter || !longer) return 0;
  return shorter.length / longer.length;
}

/** Strict token/word alignment — avoids "BRASIL" matching "BRASILEIRO(A)". */
function tokenMatch(wordText: string, token: string): boolean {
  if (!wordText || !token) return false;
  if (wordText === token) return true;

  if (wordText.includes(token)) {
    return (
      token.length >= 4 && overlapRatio(token, wordText) >= MIN_SUBSTRING_OVERLAP
    );
  }

  if (token.includes(wordText)) {
    return (
      wordText.length >= 4 &&
      overlapRatio(wordText, token) >= MIN_SUBSTRING_OVERLAP
    );
  }

  return false;
}

function meaningfulTokens(normalized: string, tokens: string[]): string[] {
  if (tokens.length <= 1) return tokens;
  const filtered = tokens.filter((token) => token.length >= 2);
  return filtered.length > 0 ? filtered : tokens;
}

/** Extra search strings for common date / numeric / label formats in OCR. */
export function getValueSearchVariants(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const ordered: string[] = [];

  const withoutParens = trimmed
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutParens) ordered.push(withoutParens);
  if (!ordered.includes(trimmed)) ordered.push(trimmed);

  const variants = new Set(ordered);

  const dateMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    for (const sep of ["/", "-", "."]) {
      variants.add(`${d}${sep}${m}${sep}${y}`);
    }
    variants.add(`${d}${m}${y}`);
    if (y.length === 4) {
      variants.add(`${d}${m}${y.slice(2)}`);
      variants.add(`${d}/${m}/${y.slice(2)}`);
    }
  }

  return [...variants];
}

interface MatchCandidate {
  words: OcrWord[];
  score: number;
}

function scoreCandidate(
  words: OcrWord[],
  startIndex: number,
  normalized: string,
  tokens: string[],
  normalizedWords: string[],
): number {
  if (words.length === 0) return 0;

  const joined = words
    .map((_, offset) => normalizedWords[startIndex + offset] ?? "")
    .join(" ")
    .trim();
  const joinedCompact = joined.replace(/\s+/g, "");
  const targetCompact = tokens.join("");

  if (joined === normalized || joinedCompact === targetCompact) {
    return 1000 + normalized.length;
  }

  if (words.length === 1) {
    const wordText = normalizedWords[startIndex] ?? "";
    const wordCompact = wordText.replace(/\s+/g, "");

    if (wordText === normalized || wordCompact === targetCompact) {
      return 950 + normalized.length;
    }

    if (
      tokens.length > 0 &&
      tokens.every((token) => wordText.includes(token)) &&
      wordCompact.length <= targetCompact.length + 6
    ) {
      return 880 + tokens.length * 10;
    }

    if (tokens.length === 1) {
      if (wordText === tokens[0]) return 900;
      if (tokenMatch(wordText, tokens[0])) {
        return 400 + overlapRatio(wordText, tokens[0]) * 100;
      }
    }
    return 0;
  }

  let strictHits = 0;
  for (let j = 0; j < tokens.length && startIndex + j < normalizedWords.length; j++) {
    if (tokenMatch(normalizedWords[startIndex + j], tokens[j])) strictHits += 1;
  }
  if (strictHits === tokens.length && words.length === tokens.length) {
    return 700 + strictHits * 10;
  }

  if (words.length === 1 && tokens.length > 1) {
    const wordText = normalizedWords[startIndex] ?? "";
    const wordCompact = wordText.replace(/\s+/g, "");
    if (
      wordCompact === targetCompact &&
      wordCompact.length <= targetCompact.length + 4
    ) {
      return 850;
    }
  }

  return strictHits > 0 ? strictHits * 50 : 0;
}

function findShortValueExact(
  normalized: string,
  words: OcrWord[],
  normalizedWords: string[],
): OcrWord[] {
  if (normalized.length > 2) return [];

  for (let i = 0; i < words.length; i++) {
    const wordText = normalizedWords[i];
    if (wordText === normalized) return [words[i]];
    const wordCompact = wordText.replace(/\s+/g, "");
    const targetCompact = normalized.replace(/\s+/g, "");
    if (wordCompact === targetCompact) return [words[i]];
  }
  return [];
}

function collectCandidates(
  normalized: string,
  tokens: string[],
  words: OcrWord[],
  normalizedWords: string[],
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  if (tokens.length === 0) return candidates;

  const short = findShortValueExact(normalized, words, normalizedWords);
  if (short.length > 0) {
    const idx = words.indexOf(short[0]);
    candidates.push({
      words: short,
      score: scoreCandidate(short, idx >= 0 ? idx : 0, normalized, tokens, normalizedWords),
    });
    return candidates;
  }

  const compactValue = tokens.join("");
  const maxWindow = Math.min(words.length, Math.max(tokens.length + 1, 8));

  for (let start = 0; start < words.length; start++) {
    for (let len = 1; len <= maxWindow && start + len <= words.length; len++) {
      const slice = words.slice(start, start + len);
      const score = scoreCandidate(
        slice,
        start,
        normalized,
        tokens,
        normalizedWords,
      );
      if (score > 0) candidates.push({ words: slice, score });
    }
  }

  return candidates;
}

function pickBestCandidate(candidates: MatchCandidate[]): OcrWord[] {
  if (candidates.length === 0) return [];
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best.score < 100) return [];
  return best.words;
}

function findWordsForSingleVariant(
  normalized: string,
  rawTokens: string[],
  words: OcrWord[],
  normalizedWords: string[],
): OcrWord[] {
  const tokens = meaningfulTokens(normalized, rawTokens);
  if (tokens.length === 0) return [];

  const short = findShortValueExact(normalized, words, normalizedWords);
  if (short.length > 0) return short;

  const candidates = collectCandidates(
    normalized,
    tokens,
    words,
    normalizedWords,
  );
  return pickBestCandidate(candidates);
}

/**
 * Maps an extracted field value to OCR word boxes for highlighting.
 */
export function findWordsForValue(value: string, words: OcrWord[]): OcrWord[] {
  if (!value.trim() || words.length === 0) return [];

  const normalizedWords = words.map((word) => normalizeOcrText(word.text));
  let best: OcrWord[] = [];
  let bestScore = 0;

  const fullNormalized = normalizeOcrText(value);

  for (const variant of getValueSearchVariants(value)) {
    const normalized = normalizeOcrText(variant);
    const tokens = meaningfulTokens(
      normalized,
      normalized.split(/\s+/).filter(Boolean),
    );
    let match = findWordsForSingleVariant(
      normalized,
      tokens,
      words,
      normalizedWords,
    );
    if (match.length === 0 && fullNormalized !== normalized) {
      const fullTokens = meaningfulTokens(
        fullNormalized,
        fullNormalized.split(/\s+/).filter(Boolean),
      );
      match = findWordsForSingleVariant(
        fullNormalized,
        fullTokens,
        words,
        normalizedWords,
      );
    }
    if (match.length === 0) continue;

    const startIndex = words.indexOf(match[0]);
    const score =
      startIndex >= 0
        ? scoreCandidate(
            match,
            startIndex,
            normalized,
            tokens,
            normalizedWords,
          )
        : 0;
    if (score > bestScore) {
      bestScore = score;
      best = match;
    }
  }

  return best;
}

/** Append "(A)" / similar suffix OCR tokens when the extracted value includes parentheses. */
export function extendMatchWithParentheticalSuffix(
  value: string,
  words: OcrWord[],
  match: OcrWord[],
): OcrWord[] {
  if (match.length === 0 || !value.includes("(")) return match;

  const last = match[match.length - 1];
  const lastIndex = words.indexOf(last);
  if (lastIndex < 0 || lastIndex + 1 >= words.length) return match;

  const next = words[lastIndex + 1];
  const nextText = next.text.trim();
  if (/^\(?[a-zA-Z]\)?$/.test(nextText) || nextText.startsWith("(")) {
    return [...match, next];
  }
  return match;
}
