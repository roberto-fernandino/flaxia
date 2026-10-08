import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, palette, useProjectColors } from '@/components/projects/ui';
import { isConfidenceKey } from '@/lib/engine/extractionResult';
import {
  TableRow,
  compositeKey,
  emptyTableRow,
  hasTableShapeMismatch,
  isTableField,
  tableColumns,
  tableRowsFromDisplayValues,
} from '@/lib/engine/tableFieldValues';
import type { Field } from '@/lib/engine/types';

const FIELDS_PER_PAGE = 8;

function fuzzyMatch(text: string, query: string) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
  return qi === q.length;
}

const prettyKey = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

function TableFieldCard({
  field,
  rows,
  readOnly,
  selectedFieldKey,
  savedValues,
  values,
  fieldColors,
  onSelect,
  onRowsChange,
  label,
}: {
  field: Field;
  rows: TableRow[];
  readOnly: boolean;
  selectedFieldKey: string | null;
  savedValues: Record<string, string>;
  values: Record<string, string>;
  fieldColors: Record<string, string>;
  onSelect: (key: string) => void;
  onRowsChange: (rows: TableRow[], structural: boolean) => void;
  label: string;
}) {
  const c = useProjectColors();
  const columns = tableColumns(field);
  const [expanded, setExpanded] = useState(rows.length <= 5);
  const visible = expanded ? rows : rows.slice(0, 5);
  const move = (i: number, d: -1 | 1) => {
    const t = i + d;
    if (t < 0 || t >= rows.length) return;
    const next = [...rows];
    [next[i], next[t]] = [next[t], next[i]];
    onRowsChange(next, true);
  };
  return (
    <View style={[s.tableCard, { borderColor: c.border }]}>
      <View style={s.rowBetween}>
        <ThemedText style={[s.label, { color: c.text }]}>▦  {label}</ThemedText>
        <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{rows.length === 1 ? '1 linha' : `${rows.length} linhas`}</ThemedText>
      </View>
      {rows.length === 0 && <ThemedText style={{ fontSize: 12, color: c.textMuted, fontStyle: 'italic' }}>Nenhuma linha extraída</ThemedText>}
      {visible.map((row, ri) => (
        <View key={ri} style={[s.tableRow, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          <View style={s.rowBetween}>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: c.textMuted }}># {ri + 1}</ThemedText>
            {!readOnly && (
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable onPress={() => move(ri, -1)} disabled={ri === 0} hitSlop={6} accessibilityLabel="Mover linha para cima"><ThemedText style={{ color: c.textMuted, opacity: ri === 0 ? 0.3 : 1 }}>↑</ThemedText></Pressable>
                <Pressable onPress={() => move(ri, 1)} disabled={ri === rows.length - 1} hitSlop={6} accessibilityLabel="Mover linha para baixo"><ThemedText style={{ color: c.textMuted, opacity: ri === rows.length - 1 ? 0.3 : 1 }}>↓</ThemedText></Pressable>
                <Pressable onPress={() => onRowsChange(rows.filter((_, i) => i !== ri), true)} hitSlop={6} accessibilityLabel="Remover linha"><ThemedText style={{ color: palette.danger }}>✕</ThemedText></Pressable>
              </View>
            )}
          </View>
          {columns.map((col) => {
            const key = compositeKey(field.fieldName, ri, col.columnName);
            const selected = selectedFieldKey === key;
            const modified = (values[key] ?? '') !== (savedValues[key] ?? '');
            return (
              <View key={col.columnName} style={{ gap: 2 }}>
                <View style={s.labelRow}>
                  {fieldColors[key] && <View style={[s.dot, { backgroundColor: fieldColors[key] }]} />}
                  <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{col.displayName || col.columnName}</ThemedText>
                  {modified && <ThemedText style={{ fontSize: 10, color: '#0891b2' }}>(modificado)</ThemedText>}
                </View>
                {readOnly ? (
                  <Pressable onPress={() => onSelect(key)} style={[s.input, { justifyContent: 'center', borderColor: selected ? '#06b6d4' : c.border, backgroundColor: selected ? (c.dark ? 'rgba(8,145,178,0.2)' : '#ecfeff') : c.inputBg }]}>
                    <ThemedText style={{ fontSize: 14, color: c.text }}>{row[col.columnName] || '\u00A0'}</ThemedText>
                  </Pressable>
                ) : (
                <TextInput
                  value={row[col.columnName] ?? ''}
                  onFocus={() => onSelect(key)}
                  onChangeText={(v) => onRowsChange(rows.map((r, i) => (i === ri ? { ...r, [col.columnName]: v } : r)), false)}
                  placeholder="—"
                  placeholderTextColor={c.textMuted}
                  multiline
                  style={[s.input, { color: c.text, borderColor: selected ? '#06b6d4' : modified ? '#67e8f9' : c.border, backgroundColor: selected || modified ? (c.dark ? 'rgba(8,145,178,0.2)' : '#ecfeff') : c.inputBg }]}
                />
                )}
              </View>
            );
          })}
        </View>
      ))}
      {rows.length > 5 && (
        <Pressable onPress={() => setExpanded((v) => !v)}>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#0891b2' }}>{expanded ? 'Recolher' : `Ver todas as ${rows.length} linhas`}</ThemedText>
        </Pressable>
      )}
      {!readOnly && columns.length > 0 && (
        <Button small variant="secondary" label="+ Adicionar linha" onPress={() => onRowsChange([...rows, emptyTableRow(field)], true)} style={{ alignSelf: 'flex-start' }} />
      )}
    </View>
  );
}

export function ExtractedValuesPanel({
  originalResult,
  values,
  savedValues,
  documentFields,
  fieldColors,
  selectedFieldKey,
  readOnly,
  isSaving,
  onSelect,
  onChange,
  onTableRowsChange,
  onSave,
  onReset,
  onScrollTo,
}: {
  originalResult: Record<string, unknown> | null;
  values: Record<string, string>;
  savedValues: Record<string, string>;
  documentFields?: Field[];
  fieldColors: Record<string, string>;
  selectedFieldKey: string | null;
  readOnly: boolean;
  isSaving: boolean;
  onSelect: (key: string | null) => void;
  onChange: (key: string, value: string) => void;
  onTableRowsChange: (field: Field, rows: TableRow[], structural: boolean) => void;
  onSave: () => void;
  onReset: () => void;
  /** Rola o contêiner até o campo selecionado (y relativo ao painel). */
  onScrollTo?: (y: number) => void;
}) {
  const c = useProjectColors();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const fieldLabels = useMemo(() => Object.fromEntries((documentFields ?? []).filter((f) => f.displayName).map((f) => [f.fieldName, f.displayName!])), [documentFields]);
  const tableFields = useMemo(() => new Map((documentFields ?? []).filter(isTableField).map((f) => [f.fieldName, f])), [documentFields]);
  const tableRows = useMemo(() => {
    const m = new Map<string, TableRow[]>();
    for (const [name, field] of tableFields) m.set(name, tableRowsFromDisplayValues(values, field, documentFields));
    return m;
  }, [values, tableFields, documentFields]);

  const resultKeys = useMemo(() => (originalResult ? Object.keys(originalResult).filter((k) => !isConfidenceKey(k)) : []), [originalResult]);
  const orderedKeys = useMemo(() => {
    const ordered = [...(documentFields ?? [])].sort((a, b) => (a.fieldIndex ?? 0) - (b.fieldIndex ?? 0)).map((f) => f.fieldName);
    const set = new Set(resultKeys);
    const inOrder = ordered.filter((k) => set.has(k));
    const inOrderSet = new Set(inOrder);
    return [...inOrder, ...resultKeys.filter((k) => !inOrderSet.has(k))];
  }, [documentFields, resultKeys]);

  const filteredKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderedKeys;
    return orderedKeys.filter((key) => {
      if (fuzzyMatch((fieldLabels[key] || key.replace(/_/g, ' ')).toLowerCase(), q)) return true;
      const tf = tableFields.get(key);
      if (tf) {
        const hay = [...(tf.columns ?? []).map((col) => col.displayName || col.columnName), ...(tableRows.get(key) ?? []).flatMap((r) => Object.values(r))].join(' ').toLowerCase();
        return fuzzyMatch(hay, q);
      }
      return fuzzyMatch((values[key] ?? '').toLowerCase(), q);
    });
  }, [orderedKeys, query, fieldLabels, tableFields, tableRows, values]);

  const totalPages = Math.max(1, Math.ceil(filteredKeys.length / FIELDS_PER_PAGE));
  useEffect(() => setPage(1), [query, originalResult]);

  // Mantém o campo selecionado (ex.: tocado no documento) na página visível.
  useEffect(() => {
    if (!selectedFieldKey) return;
    const owner = /^(.+)\[\d+\]\..+$/.exec(selectedFieldKey)?.[1] ?? selectedFieldKey;
    const index = filteredKeys.indexOf(owner);
    if (index >= 0) setPage(Math.floor(index / FIELDS_PER_PAGE) + 1);
  }, [selectedFieldKey, filteredKeys]);

  const fieldY = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!selectedFieldKey || !onScrollTo) return;
    const owner = /^(.+)\[\d+\]\..+$/.exec(selectedFieldKey)?.[1] ?? selectedFieldKey;
    const t = setTimeout(() => {
      const y = fieldY.current[owner];
      if (y != null) onScrollTo(Math.max(0, y - 12));
    }, 80);
    return () => clearTimeout(t);
  }, [selectedFieldKey, page, onScrollTo]);

  const hasModifications = useMemo(() => {
    const keys = new Set([...Object.keys(values), ...Object.keys(savedValues)]);
    for (const k of keys) if ((values[k] ?? '') !== (savedValues[k] ?? '')) return true;
    return false;
  }, [values, savedValues]);

  if (!originalResult || resultKeys.length === 0) {
    return <ThemedText style={{ fontSize: 13, color: c.textMuted, padding: 12 }}>Nenhum valor extraído disponível</ThemedText>;
  }

  const currentKeys = filteredKeys.slice((page - 1) * FIELDS_PER_PAGE, page * FIELDS_PER_PAGE);

  return (
    <View style={[s.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={s.rowBetween}>
        <ThemedText style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Valores Extraídos</ThemedText>
        {readOnly ? (
          <View style={[s.tag, { backgroundColor: 'rgba(16,185,129,0.15)' }]}><ThemedText style={{ fontSize: 11, fontWeight: '700', color: c.dark ? '#a7f3d0' : '#065f46' }}>VALIDADO</ThemedText></View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {hasModifications && <Pressable onPress={onReset} hitSlop={6}><ThemedText style={{ fontSize: 13, color: '#0891b2' }}>Restaurar Original</ThemedText></Pressable>}
            <Pressable
              onPress={onSave}
              disabled={!hasModifications || isSaving}
              style={[s.save, hasModifications && !isSaving ? { backgroundColor: '#0891b2', borderColor: '#0891b2' } : { borderColor: c.border }]}>
              <ThemedText style={{ fontSize: 13, fontWeight: '600', color: hasModifications && !isSaving ? '#fff' : c.textMuted }}>{isSaving ? 'Salvando...' : 'Salvar'}</ThemedText>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[s.search, { borderColor: c.border, backgroundColor: c.inputBg }]}>
        <ThemedText style={{ color: c.textMuted }}>🔍</ThemedText>
        <TextInput value={query} onChangeText={setQuery} placeholder="Buscar campos..." placeholderTextColor={c.textMuted} autoCapitalize="none" style={{ flex: 1, color: c.text, fontSize: 14, paddingVertical: 8 }} />
        {!!query && <Pressable onPress={() => setQuery('')} hitSlop={8}><ThemedText style={{ color: c.textMuted }}>✕</ThemedText></Pressable>}
      </View>
      {!!query && filteredKeys.length === 0 && <ThemedText style={{ textAlign: 'center', fontSize: 13, color: c.textMuted, paddingVertical: 12 }}>Nenhum campo encontrado para &quot;{query}&quot;</ThemedText>}

      {currentKeys.map((key) => {
        const tf = tableFields.get(key);
        const label = fieldLabels[key] || prettyKey(key);
        if (tf) {
          if (hasTableShapeMismatch(originalResult, tf)) {
            return (
              <View key={key} style={[s.mismatch, { borderColor: c.dark ? '#92400e' : '#fcd34d', backgroundColor: c.dark ? 'rgba(120,53,15,0.35)' : '#fffbeb' }]}>
                <ThemedText style={[s.label, { color: c.text }]}>{label}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: c.dark ? '#fde68a' : '#92400e' }}>Este campo está configurado como tabela, mas o valor armazenado não é tabular. Exibindo o valor bruto.</ThemedText>
                <ThemedText selectable style={{ fontSize: 12, fontFamily: 'monospace', color: c.text }}>{String(originalResult[key] ?? '')}</ThemedText>
              </View>
            );
          }
          return (
            <View key={key} onLayout={(e) => { fieldY.current[key] = e.nativeEvent.layout.y; }}>
            <TableFieldCard
              field={tf}
              label={label}
              rows={tableRows.get(key) ?? []}
              readOnly={readOnly}
              selectedFieldKey={selectedFieldKey}
              values={values}
              savedValues={savedValues}
              fieldColors={fieldColors}
              onSelect={onSelect}
              onRowsChange={(rows, structural) => onTableRowsChange(tf, rows, structural)}
            />
            </View>
          );
        }
        const fieldType = documentFields?.find((f) => f.fieldName === key)?.fieldType;
        const modified = (values[key] ?? '') !== (savedValues[key] ?? '');
        const selected = selectedFieldKey === key;
        return (
          <View key={key} style={{ gap: 4 }} onLayout={(e) => { fieldY.current[key] = e.nativeEvent.layout.y; }}>
            <Pressable onPress={() => onSelect(selected ? null : key)} style={s.labelRow}>
              {fieldColors[key] && <View style={[s.dot, { backgroundColor: fieldColors[key] }]} />}
              <ThemedText style={[s.label, { color: c.text }]}>{label}</ThemedText>
              {modified && <ThemedText style={{ fontSize: 11, color: '#0891b2' }}>(modificado)</ThemedText>}
            </Pressable>
            {readOnly ? (
              <Pressable
                onPress={() => onSelect(selected ? null : key)}
                style={[s.input, { borderColor: selected ? '#06b6d4' : c.border, borderWidth: selected ? 2 : 1, backgroundColor: selected ? (c.dark ? 'rgba(8,145,178,0.3)' : '#ecfeff') : c.surfaceAlt, justifyContent: 'center' }]}>
                <ThemedText style={{ fontSize: 14, color: c.text }}>{values[key] || ' '}</ThemedText>
              </Pressable>
            ) : (
            <TextInput
              value={values[key] ?? ''}
              onFocus={() => onSelect(key)}
              onChangeText={(v) => onChange(key, v)}
              multiline={fieldType !== 'numbers' && fieldType !== 'currency'}
              keyboardType={fieldType === 'numbers' || fieldType === 'currency' ? 'decimal-pad' : 'default'}
              placeholderTextColor={c.textMuted}
              style={[
                s.input,
                { color: c.text },
                modified
                  ? { borderColor: '#67e8f9', backgroundColor: c.dark ? 'rgba(8,145,178,0.2)' : '#ecfeff' }
                  : selected
                    ? { borderColor: '#06b6d4', borderWidth: 2, backgroundColor: c.dark ? 'rgba(8,145,178,0.3)' : '#ecfeff' }
                    : readOnly
                      ? { borderColor: c.border, backgroundColor: c.surfaceAlt }
                      : { borderColor: c.border, backgroundColor: c.inputBg },
              ]}
            />
            )}
          </View>
        );
      })}

      {totalPages > 1 && (
        <View style={[s.pagination, { borderColor: c.border }]}>
          <Button small variant="secondary" label="Anterior" disabled={page === 1} onPress={() => setPage((p) => p - 1)} />
          <ThemedText style={{ fontSize: 13, color: c.text }}>
            Página {page} de {totalPages}{query ? ` (${filteredKeys.length} resultados)` : ''}
          </ThemedText>
          <Button small variant="secondary" label="Próximo" disabled={page === totalPages} onPress={() => setPage((p) => p + 1)} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, minHeight: 40 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  save: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
  tableCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  tableRow: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6 },
  mismatch: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
});
