import type { Field, FieldColumn } from "@/lib/engine/types";
import {
  confidenceKeyOf,
  isConfidenceKey,
} from "@/lib/engine/extractionResult";

/**
 * Ponte entre o resultado de extração aninhado (a fonte da verdade, que vai e
 * volta da API) e o mapa plano `Record<string, string>` que a UI de validação
 * usa para destaque OCR, cores de campo, o protocolo `postMessage` do popup e a
 * seleção de texto no PDF.
 *
 * Células de tabela viram chaves compostas `campo[linha].coluna`. Com isso o
 * `DocumentViewer` e o `ocrHighlightMatch` continuam trabalhando com um mapa
 * plano de strings, sem saber que tabelas existem.
 *
 * Colisão de chave é estruturalmente impossível: o backend passa todo
 * `field_name` e `column_name` por `to_snake_case`, que troca qualquer caractere
 * fora de `[a-z0-9]` por `_` — então um nome persistido nunca contém `[`, `]` ou
 * `.`. Ainda assim, o parse aqui é dirigido pelos metadados da classe, nunca por
 * formato de string: uma chave `foo[0].bar` injetada via `PUT /result` (que
 * aceita JSON sem tipo) onde `foo` não é tabela continua sendo tratada como
 * escalar.
 */

export type TableRow = Record<string, string>;

/** Uma célula endereçada dentro de uma tabela. */
export interface ParsedCompositeKey {
  fieldName: string;
  rowIndex: number;
  columnName: string;
}

export function isTableField(field: Field | undefined): boolean {
  return field?.fieldType === "table";
}

/** Índice `fieldName -> Field` restrito às tabelas da classe. */
function tableFieldsByName(fields: Field[] | undefined): Map<string, Field> {
  const map = new Map<string, Field>();
  for (const field of fields ?? []) {
    if (isTableField(field)) map.set(field.fieldName, field);
  }
  return map;
}

export function tableColumns(field: Field | undefined): FieldColumn[] {
  return field?.columns ?? [];
}

export function compositeKey(
  fieldName: string,
  rowIndex: number,
  columnName: string,
): string {
  return `${fieldName}[${rowIndex}].${columnName}`;
}

/**
 * Decompõe uma chave composta, ou devolve `null` se ela não endereça uma célula
 * de uma tabela declarada em `fields`.
 */
export function parseCompositeKey(
  key: string,
  fields: Field[] | undefined,
): ParsedCompositeKey | null {
  const match = /^(.+)\[(\d+)\]\.(.+)$/.exec(key);
  if (!match) return null;

  const [, fieldName, rawIndex, columnName] = match;
  const field = tableFieldsByName(fields).get(fieldName);
  if (!field) return null;

  // A coluna precisa existir no schema — protege contra lixo vindo da API.
  if (!tableColumns(field).some((c) => c.columnName === columnName)) return null;

  return { fieldName, rowIndex: Number(rawIndex), columnName };
}

/**
 * Chave do campo que "possui" uma chave de exibição: a própria chave para
 * escalares, ou o nome da tabela para uma célula. Usado para resolver seleção,
 * paginação e cor a partir de uma célula.
 */
export function owningFieldKey(
  key: string,
  fields: Field[] | undefined,
): string {
  return parseCompositeKey(key, fields)?.fieldName ?? key;
}

export function isCompositeKey(
  key: string,
  fields: Field[] | undefined,
): boolean {
  return parseCompositeKey(key, fields) !== null;
}

function cellToString(value: unknown): string {
  return value !== null && value !== undefined ? String(value) : "";
}

/**
 * Linhas de uma tabela dentro de um resultado, normalizadas para
 * `Record<string, string>` com uma entrada por coluna declarada.
 *
 * Fronteira única de leitura: `null`, chave ausente, valor de tipo inesperado e
 * linhas que não são objeto viram lista vazia / linha vazia, para que nenhum
 * componente precise ramificar nesses casos.
 */
export function tableRowsFromResult(
  result: Record<string, unknown> | null | undefined,
  field: Field,
): TableRow[] {
  const raw = result?.[field.fieldName];
  if (!Array.isArray(raw)) return [];

  const columns = tableColumns(field);
  return raw.map((row) => {
    const source = (row && typeof row === "object" ? row : {}) as Record<
      string,
      unknown
    >;
    const normalized: TableRow = {};
    for (const column of columns) {
      normalized[column.columnName] = cellToString(source[column.columnName]);
    }
    return normalized;
  });
}

/**
 * Linhas de uma tabela reconstruídas a partir do mapa PLANO de exibição (e não
 * do resultado aninhado) — é o que reflete as edições em andamento.
 *
 * Reindexa por posição: depois de remover uma linha os índices ficam com buraco.
 */
export function tableRowsFromDisplayValues(
  displayValues: Record<string, string>,
  field: Field,
  fields: Field[] | undefined,
): TableRow[] {
  const byIndex = new Map<number, TableRow>();
  for (const [key, value] of Object.entries(displayValues)) {
    const parsed = parseCompositeKey(key, fields);
    if (!parsed || parsed.fieldName !== field.fieldName) continue;
    const row = byIndex.get(parsed.rowIndex) ?? {};
    row[parsed.columnName] = value;
    byIndex.set(parsed.rowIndex, row);
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => {
      const complete: TableRow = {};
      for (const column of tableColumns(field)) {
        complete[column.columnName] = row[column.columnName] ?? "";
      }
      return complete;
    });
}

/** Linha nova, com todas as colunas declaradas vazias. */
export function emptyTableRow(field: Field): TableRow {
  const row: TableRow = {};
  for (const column of tableColumns(field)) {
    row[column.columnName] = "";
  }
  return row;
}

/**
 * `true` quando o valor guardado no resultado não bate com o tipo declarado na
 * classe — por exemplo classe diz tabela mas o resultado tem uma string (job
 * processado antes da tabela ser configurada). A UI cai num modo read-only.
 */
export function hasTableShapeMismatch(
  result: Record<string, unknown> | null | undefined,
  field: Field,
): boolean {
  const raw = result?.[field.fieldName];
  if (raw === null || raw === undefined) return false;
  return !Array.isArray(raw);
}

/**
 * Achata um resultado aninhado no mapa plano de exibição.
 * Chaves escalares viram `String(valor)`; tabelas viram uma entrada por célula.
 * `confidence` é sempre omitido.
 */
export function flattenResultToDisplayValues(
  result: Record<string, unknown> | null | undefined,
  fields: Field[] | undefined,
): Record<string, string> {
  if (!result || typeof result !== "object") return {};

  const tables = tableFieldsByName(fields);
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(result)) {
    if (isConfidenceKey(key)) continue;

    const field = tables.get(key);
    if (field && Array.isArray(value)) {
      const rows = tableRowsFromResult(result, field);
      rows.forEach((row, rowIndex) => {
        for (const column of tableColumns(field)) {
          flat[compositeKey(key, rowIndex, column.columnName)] =
            row[column.columnName] ?? "";
        }
      });
      continue;
    }

    // Escalar, ou tabela cujo valor gravado não é array (shape mismatch):
    // preserva o comportamento antigo de `String(v)` para não quebrar a tela.
    flat[key] = cellToString(value);
  }

  return flat;
}

/**
 * Reconstrói o resultado aninhado a partir do mapa plano de exibição.
 *
 * É o inverso de {@link flattenResultToDisplayValues} e o que corrige o bug
 * antigo de salvar o mapa plano direto, que destruía qualquer estrutura.
 *
 * `confidence` e chaves presentes no resultado original mas ausentes do mapa de
 * exibição (por exemplo removidas junto com uma linha) são preservadas ou
 * descartadas segundo a regra: metadados do resultado original sobrevivem,
 * células de tabela são reconstruídas somente a partir do mapa plano.
 */
export function rebuildResultFromDisplayValues(
  displayValues: Record<string, string>,
  originalResult: Record<string, unknown> | null | undefined,
  fields: Field[] | undefined,
): Record<string, unknown> {
  const tables = tableFieldsByName(fields);
  const rebuilt: Record<string, unknown> = {};

  // `confidence` não é editável e não aparece no mapa plano; vem do original.
  const originalConfidenceKey = confidenceKeyOf(originalResult);
  if (originalResult && originalConfidenceKey) {
    rebuilt[originalConfidenceKey] = originalResult[originalConfidenceKey];
  }

  // Agrupa as células por tabela e por linha.
  const rowsByField = new Map<string, Map<number, TableRow>>();
  for (const [key, value] of Object.entries(displayValues)) {
    const parsed = parseCompositeKey(key, fields);
    if (!parsed) {
      if (!isConfidenceKey(key)) rebuilt[key] = value;
      continue;
    }
    let rows = rowsByField.get(parsed.fieldName);
    if (!rows) {
      rows = new Map<number, TableRow>();
      rowsByField.set(parsed.fieldName, rows);
    }
    const row = rows.get(parsed.rowIndex) ?? {};
    row[parsed.columnName] = value;
    rows.set(parsed.rowIndex, row);
  }

  for (const [fieldName, field] of tables) {
    const rows = rowsByField.get(fieldName);
    if (!rows) {
      // Sem célula alguma no mapa plano. Distingue "tabela vazia" (que precisa
      // continuar existindo como []) de "tabela nunca extraída" (fora do result).
      const original = originalResult?.[fieldName];
      if (Array.isArray(original)) rebuilt[fieldName] = [];
      else if (original !== undefined) rebuilt[fieldName] = original;
      continue;
    }

    // Reindexa por posição: os índices podem ter buracos depois de uma remoção.
    const ordered = [...rows.entries()].sort(([a], [b]) => a - b);
    rebuilt[fieldName] = ordered.map(([, row]) => {
      const complete: TableRow = {};
      for (const column of tableColumns(field)) {
        complete[column.columnName] = row[column.columnName] ?? "";
      }
      return complete;
    });
  }

  return rebuilt;
}

/**
 * Substitui as linhas de uma tabela dentro do mapa plano de exibição.
 *
 * Operações estruturais (adicionar, remover, reordenar) precisam passar por
 * aqui: um merge `{...prev, [k]: v}` não consegue expressar remoção de chave, e
 * deixaria células órfãs de linhas apagadas — que ressuscitariam no save.
 */
export function replaceTableRowsInDisplayValues(
  displayValues: Record<string, string>,
  field: Field,
  rows: TableRow[],
): Record<string, string> {
  const next: Record<string, string> = {};

  // Descarta TODAS as células antigas desta tabela antes de reescrever.
  for (const [key, value] of Object.entries(displayValues)) {
    const match = /^(.+)\[(\d+)\]\.(.+)$/.exec(key);
    if (match && match[1] === field.fieldName) continue;
    next[key] = value;
  }

  rows.forEach((row, rowIndex) => {
    for (const column of tableColumns(field)) {
      next[compositeKey(field.fieldName, rowIndex, column.columnName)] =
        row[column.columnName] ?? "";
    }
  });

  return next;
}

/**
 * Remapeia a célula selecionada depois de uma operação estrutural.
 * Devolve `null` quando a linha selecionada deixou de existir — a seleção nunca
 * pode acabar apontando para outra célula.
 */
export function remapSelectedKeyAfterRowChange(
  selectedKey: string | null,
  fields: Field[] | undefined,
  fieldName: string,
  /** Nova posição de cada linha antiga; `null` quando a linha foi removida. */
  rowIndexMapping: (oldIndex: number) => number | null,
): string | null {
  if (!selectedKey) return null;
  const parsed = parseCompositeKey(selectedKey, fields);
  if (!parsed || parsed.fieldName !== fieldName) return selectedKey;

  const newIndex = rowIndexMapping(parsed.rowIndex);
  if (newIndex === null) return null;
  return compositeKey(fieldName, newIndex, parsed.columnName);
}
