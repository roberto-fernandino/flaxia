import type { Field, FieldType } from "@/lib/engine/types";

export const FIELD_TYPE_HIGHLIGHT_COLORS: Record<FieldType | "unknown", string> =
  {
    string: "rgba(59, 130, 246, 0.45)",
    numbers: "rgba(139, 92, 246, 0.45)",
    currency: "rgba(16, 185, 129, 0.45)",
    datetime: "rgba(245, 158, 11, 0.45)",
    table: "rgba(236, 72, 153, 0.45)",
    unknown: "rgba(107, 114, 128, 0.4)",
  };

export const DEFAULT_FIELD_HIGHLIGHT_COLOR =
  FIELD_TYPE_HIGHLIGHT_COLORS.unknown;

export function getFieldTypeHighlightColor(fieldType?: FieldType): string {
  if (!fieldType) return FIELD_TYPE_HIGHLIGHT_COLORS.unknown;
  return FIELD_TYPE_HIGHLIGHT_COLORS[fieldType] ?? FIELD_TYPE_HIGHLIGHT_COLORS.unknown;
}

/**
 * Mapa `chave de exibição -> cor de destaque`.
 *
 * Aceita tanto chaves de campo escalar quanto chaves compostas de célula
 * (`campo[linha].coluna`), que recebem a cor do **tipo da coluna** — é o que dá
 * sentido visual a colunas tipadas dentro de uma tabela.
 */
export function buildFieldColorsMap(
  fields: Field[] | undefined,
  resultKeys: string[] = [],
): Record<string, string> {
  const typeByKey = new Map<string, FieldType | undefined>();
  const columnTypesByField = new Map<string, Map<string, FieldType | undefined>>();

  for (const field of fields ?? []) {
    typeByKey.set(field.fieldName, field.fieldType);
    if (field.fieldType === "table") {
      columnTypesByField.set(
        field.fieldName,
        new Map((field.columns ?? []).map((c) => [c.columnName, c.columnType])),
      );
    }
  }

  const keys =
    resultKeys.length > 0 ? resultKeys : (fields ?? []).map((f) => f.fieldName);

  const colors: Record<string, string> = {};
  for (const key of keys) {
    const cell = /^(.+)\[(\d+)\]\.(.+)$/.exec(key);
    const columnTypes = cell ? columnTypesByField.get(cell[1]) : undefined;
    colors[key] = columnTypes
      ? getFieldTypeHighlightColor(columnTypes.get(cell![3]))
      : getFieldTypeHighlightColor(typeByKey.get(key));
  }
  return colors;
}
