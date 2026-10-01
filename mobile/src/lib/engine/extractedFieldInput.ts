import type { FieldType } from "@/lib/engine/types";

export type ExtractedInputType = "text" | "number" | "datetime-local";

export function extractedInputType(fieldType?: FieldType): ExtractedInputType {
  if (fieldType === "numbers" || fieldType === "currency") return "number";
  if (fieldType === "datetime") return "datetime-local";
  return "text";
}

function normalizeNumber(value: string): string {
  const compact = value.trim().replace(/[^\d,.-]/g, "");
  if (!compact) return "";
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  if (lastComma > lastDot) {
    return compact.replace(/\./g, "").replace(",", ".");
  }
  if (lastDot > lastComma && lastComma >= 0) {
    return compact.replace(/,/g, "");
  }
  return compact.replace(",", ".");
}

function normalizeDateTime(value: string): string {
  const trimmed = value.trim();
  const iso = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (iso) {
    const [, year, month, day, hour = "00", minute = "00", second] = iso;
    return `${year}-${month}-${day}T${hour}:${minute}${second ? `:${second}` : ""}`;
  }
  const localized = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[\s,]+(\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (localized) {
    const [, day, month, year, hour = "00", minute = "00", second] = localized;
    return `${year}-${month}-${day}T${hour}:${minute}${second ? `:${second}` : ""}`;
  }
  return "";
}

export function extractedEditorValue(
  value: string,
  fieldType?: FieldType,
): string {
  const inputType = extractedInputType(fieldType);
  if (inputType === "number") return normalizeNumber(value);
  if (inputType === "datetime-local") return normalizeDateTime(value);
  return value;
}
