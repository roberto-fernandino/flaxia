import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import {
  ColumnFieldType,
  FIELD_TYPE_OPTIONS,
  Field,
  FieldColumn,
  FieldType,
  defaultTableColumn,
  fieldTypeOption,
  newField,
  toSnakeCase,
  withFieldType,
} from '@/lib/projects';
import { palette, useProjectColors } from './ui';

function TypeChips<V extends string>({ options, value, onChange }: { options: { value: V; label: string; icon: string }[]; value: V; onChange: (v: V) => void }) {
  const c = useProjectColors();
  return (
    <View style={s.chips}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={[s.chip, { borderColor: active ? palette.primary : c.border, backgroundColor: active ? c.selectedBg : 'transparent' }]}>
            <ThemedText style={{ fontSize: 11, color: active ? palette.primary : c.textMuted, fontWeight: '600' }}>{opt.icon} {opt.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const COLUMN_TYPE_OPTIONS = FIELD_TYPE_OPTIONS.filter((o) => o.value !== 'table') as { value: ColumnFieldType; label: string; icon: string }[];

/** Editor das colunas de um campo tabela. A ordem do array é a ordem de exibição. */
export function ColumnEditor({ columns, onChange, showPrompts }: { columns: FieldColumn[]; onChange: (c: FieldColumn[]) => void; showPrompts?: boolean }) {
  const c = useProjectColors();
  const [typeIndex, setTypeIndex] = useState<number | null>(null);
  const [promptIndex, setPromptIndex] = useState<number | null>(null);
  const update = (i: number, patch: Partial<FieldColumn>) => onChange(columns.map((col, idx) => (idx === i ? { ...col, ...patch } : col)));
  const move = (i: number, d: -1 | 1) => {
    const t = i + d;
    if (t < 0 || t >= columns.length) return;
    const next = [...columns];
    [next[i], next[t]] = [next[t], next[i]];
    onChange(next);
  };
  return (
    <View style={[s.columns, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
      <View style={s.rowBetween}>
        <ThemedText style={[s.caption, { color: c.textMuted }]}>Colunas</ThemedText>
        <Pressable onPress={() => onChange([...columns, defaultTableColumn(columns.length)])} hitSlop={8}>
          <ThemedText style={{ color: '#0891b2', fontSize: 12, fontWeight: '600' }}>+ Adicionar coluna</ThemedText>
        </Pressable>
      </View>
      {columns.length === 0 && <ThemedText style={{ color: palette.warning, fontSize: 12 }}>Um campo de tabela precisa de pelo menos uma coluna.</ThemedText>}
      {columns.map((col, i) => (
        <View key={i} style={{ gap: 4 }}>
          <View style={s.row}>
            <TextInput
              value={col.displayName ?? col.columnName}
              onChangeText={(v) => update(i, { displayName: v, columnName: toSnakeCase(v) })}
              placeholder="Nome da coluna"
              placeholderTextColor={c.textMuted}
              style={[s.inlineInput, { borderColor: c.border, color: c.text, backgroundColor: c.inputBg }]}
            />
            <Pressable onPress={() => setTypeIndex(typeIndex === i ? null : i)} style={[s.typeBtn, { borderColor: c.border }]}>
              <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{fieldTypeOption(col.columnType).icon} {fieldTypeOption(col.columnType).label}</ThemedText>
            </Pressable>
            {showPrompts && (
              <Pressable onPress={() => setPromptIndex(promptIndex === i ? null : i)} style={[s.typeBtn, { borderColor: col.columnPrompt?.trim() ? palette.primary : c.border }]}>
                <ThemedText style={{ fontSize: 11, color: col.columnPrompt?.trim() ? palette.primary : c.textMuted }}>Prompt</ThemedText>
              </Pressable>
            )}
            <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6}><ThemedText style={{ color: c.textMuted, opacity: i === 0 ? 0.3 : 1 }}>↑</ThemedText></Pressable>
            <Pressable onPress={() => move(i, 1)} disabled={i === columns.length - 1} hitSlop={6}><ThemedText style={{ color: c.textMuted, opacity: i === columns.length - 1 ? 0.3 : 1 }}>↓</ThemedText></Pressable>
            <Pressable onPress={() => onChange(columns.filter((_, idx) => idx !== i))} hitSlop={6} accessibilityLabel="Remover coluna"><ThemedText style={{ color: palette.danger }}>✕</ThemedText></Pressable>
          </View>
          {typeIndex === i && <TypeChips options={COLUMN_TYPE_OPTIONS} value={col.columnType ?? 'string'} onChange={(v) => { update(i, { columnType: v }); setTypeIndex(null); }} />}
          {showPrompts && promptIndex === i && (
            <TextInput
              value={col.columnPrompt ?? ''}
              onChangeText={(v) => update(i, { columnPrompt: v })}
              multiline
              autoFocus
              placeholder="Instrução para a IA sobre esta coluna…"
              placeholderTextColor={c.textMuted}
              style={[s.promptInput, { borderColor: '#c7d2fe', color: c.text, backgroundColor: c.inputBg }]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

/** Lista editável de campos (nome, tipo, prompt opcional, colunas de tabela). */
export function FieldsEditor({ fields, onChange, showPrompts }: { fields: Field[]; onChange: (f: Field[]) => void; showPrompts?: boolean }) {
  const c = useProjectColors();
  const [typeIndex, setTypeIndex] = useState<number | null>(null);
  const [promptIndex, setPromptIndex] = useState<number | null>(null);
  const update = (i: number, next: Field) => onChange(fields.map((f, idx) => (idx === i ? next : f)));
  return (
    <View style={{ gap: 8 }}>
      {fields.map((field, i) => {
        const opt = fieldTypeOption(field.fieldType);
        return (
          <View key={i} style={[s.fieldCard, { borderColor: c.border, backgroundColor: c.surface }]}>
            <View style={s.row}>
              <ThemedText style={{ width: 18, textAlign: 'center', fontSize: 11, color: c.textMuted }}>{i + 1}</ThemedText>
              <TextInput
                value={field.displayName ?? field.fieldName}
                onChangeText={(v) => update(i, { ...field, displayName: v, fieldName: toSnakeCase(v) })}
                placeholderTextColor={c.textMuted}
                style={[s.inlineInput, { borderColor: c.border, color: c.text, backgroundColor: c.inputBg }]}
              />
              <Pressable onPress={() => { setPromptIndex(null); setTypeIndex(typeIndex === i ? null : i); }} style={[s.typeBtn, { borderColor: c.border }]}>
                <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{opt.icon} {opt.label}</ThemedText>
              </Pressable>
              {showPrompts && (
                <Pressable onPress={() => { setTypeIndex(null); setPromptIndex(promptIndex === i ? null : i); }} style={[s.typeBtn, { borderColor: promptIndex === i || field.fieldPrompt?.trim() ? palette.primary : c.border }]}>
                  <ThemedText style={{ fontSize: 11, color: promptIndex === i || field.fieldPrompt?.trim() ? palette.primary : c.textMuted }}>Prompt</ThemedText>
                </Pressable>
              )}
              <Pressable onPress={() => onChange(fields.filter((_, idx) => idx !== i))} hitSlop={8} accessibilityLabel="Remover campo">
                <ThemedText style={{ color: palette.danger, fontSize: 16 }}>🗑</ThemedText>
              </Pressable>
            </View>
            {typeIndex === i && <TypeChips<FieldType> options={FIELD_TYPE_OPTIONS} value={field.fieldType ?? 'string'} onChange={(v) => { update(i, withFieldType(field, v)); setTypeIndex(null); }} />}
            {showPrompts && promptIndex === i && (
              <TextInput
                value={field.fieldPrompt ?? ''}
                onChangeText={(v) => update(i, { ...field, fieldPrompt: v })}
                multiline
                autoFocus
                placeholder="Descreva exatamente que informação você deseja extrair para este campo. Ex.: 'Extrair o valor total incluindo impostos da nota fiscal'."
                placeholderTextColor={c.textMuted}
                style={[s.promptInput, { borderColor: '#c7d2fe', color: c.text, backgroundColor: c.inputBg }]}
              />
            )}
            {field.fieldType === 'table' && <ColumnEditor columns={field.columns ?? []} onChange={(columns) => update(i, { ...field, columns })} showPrompts={showPrompts} />}
          </View>
        );
      })}
      <Pressable onPress={() => onChange([...fields, newField(fields.length, showPrompts)])} style={[s.addField, { borderColor: c.border }]}>
        <ThemedText style={{ color: palette.primary, fontWeight: '600', fontSize: 13 }}>+ Adicionar campo</ThemedText>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  caption: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  columns: { marginTop: 4, gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 8 },
  inlineInput: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13 },
  typeBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 5 },
  promptInput: { borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 12, minHeight: 64, textAlignVertical: 'top' },
  fieldCard: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6 },
  addField: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
});
