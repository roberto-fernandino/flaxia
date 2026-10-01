export const CONFIDENCE_FIELD_KEY = "confidence";

/**
 * `confidence` é metadado do resultado, não campo extraído. O modelo devolve a
 * chave com caixa variável (`confidence`, `Confidence`), então a comparação é
 * case-insensitive em todo lugar que esconde ou lê esse metadado.
 */
export function isConfidenceKey(key: string): boolean {
  return key.toLowerCase() === CONFIDENCE_FIELD_KEY;
}

/** Chave de confiança como veio no resultado (preserva a caixa original). */
export function confidenceKeyOf(
  result: Record<string, unknown> | null | undefined,
): string | null {
  if (!result) return null;
  return Object.keys(result).find(isConfidenceKey) ?? null;
}

export function parseExtractionConfidence(
  result: Record<string, unknown> | null | undefined,
): number | null {
  if (!result) return null;
  const key = confidenceKeyOf(result);
  if (!key) return null;
  const raw = result[key];
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 1) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw.trim());
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return null;
}

export function fieldEntriesWithoutConfidence(
  result: Record<string, unknown>,
): [string, unknown][] {
  return Object.entries(result).filter(([key]) => !isConfidenceKey(key));
}

export function formatConfidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
