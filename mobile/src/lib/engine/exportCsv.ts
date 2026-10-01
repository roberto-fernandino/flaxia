/** Portado de `app/process/result/utils/exportUtils.ts` (web), sem a parte XLSX. */
type Primitive = string | number | boolean | null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function toCellValue(value: unknown): Primitive {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "boolean") return value;
  if (value === undefined) return "";
  return JSON.stringify(value);
}

function escapeCsvCell(value: Primitive): string {
  const str = value === null ? "" : String(value);
  const mustQuote = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function flattenObjectToPathRows(
  obj: Record<string, unknown>,
  basePath = "",
): Array<[string, Primitive]> {
  const rows: Array<[string, Primitive]> = [];
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const value = obj[key];
    const nextPath = basePath ? `${basePath}.${key}` : key;

    if (isPlainObject(value)) {
      rows.push(...flattenObjectToPathRows(value, nextPath));
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        rows.push([nextPath, "[]"]);
        continue;
      }

      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const itemPath = `${nextPath}[${i}]`;
        if (isPlainObject(item)) {
          rows.push(...flattenObjectToPathRows(item, itemPath));
        } else {
          rows.push([itemPath, toCellValue(item)]);
        }
      }
      continue;
    }

    rows.push([nextPath, toCellValue(value)]);
  }
  return rows;
}

function normalizeToTable(
  data: unknown,
): { headers: string[]; rows: Primitive[][] } {
  if (Array.isArray(data)) {
    const allObjects = data.every((item) => isPlainObject(item));
    if (allObjects) {
      const keys = new Set<string>();
      for (const item of data as Record<string, unknown>[]) {
        for (const key of Object.keys(item)) keys.add(key);
      }
      const headers = Array.from(keys).sort((a, b) => a.localeCompare(b));
      const rows = (data as Record<string, unknown>[]).map((item) =>
        headers.map((h) => toCellValue(item[h])),
      );
      return { headers, rows };
    }

    return {
      headers: ["value"],
      rows: data.map((v) => [toCellValue(v)]),
    };
  }

  if (isPlainObject(data)) {
    const flattened = flattenObjectToPathRows(data);
    return {
      headers: ["path", "value"],
      rows: flattened.map(([path, value]) => [path, value]),
    };
  }

  return {
    headers: ["value"],
    rows: [[toCellValue(data)]],
  };
}

export function buildCsv(data: unknown): string {
  const { headers, rows } = normalizeToTable(data);
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(",");
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerLine, ...bodyLines].join("\n");
}
