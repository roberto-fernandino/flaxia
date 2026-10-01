import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import {
  Field,
  TableRow,
  fieldTypeOption,
  isUnclassifiedDocument,
  scalarValuesFromResult,
  tableRowsFromResult,
} from '@/lib/projects';
import { ClassCreateWizard } from './class-wizard';
import { AutoCreateClassSheet } from './flow-modals';
import { ManageClassesSheet } from './manage-classes';
import { Button, palette, useProjectColors } from './ui';
import type { ProjectWorkspace } from './use-workspace';

function TableFieldCard({ field, rows, onRowsChange, readOnly }: { field: Field; rows: TableRow[]; onRowsChange: (rows: TableRow[]) => void; readOnly: boolean }) {
  const c = useProjectColors();
  const columns = field.columns ?? [];
  const emptyRow = () => Object.fromEntries(columns.map((col) => [col.columnName, ''])) as TableRow;
  return (
    <View style={[s.fieldCard, { borderColor: c.border }]}>
      <View style={s.rowBetween}>
        <ThemedText style={[s.fieldLabel, { color: c.text }]}>▦  {field.displayName ?? field.fieldName}</ThemedText>
        <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{rows.length} linhas</ThemedText>
      </View>
      {rows.length === 0 && <ThemedText style={{ fontSize: 12, color: c.textMuted, fontStyle: 'italic' }}>Nenhuma linha extraída.</ThemedText>}
      {rows.map((row, ri) => (
        <View key={ri} style={[s.tableRow, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          <View style={s.rowBetween}>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: c.textMuted }}>Linha {ri + 1}</ThemedText>
            {!readOnly && (
              <Pressable onPress={() => onRowsChange(rows.filter((_, i) => i !== ri))} hitSlop={8} accessibilityLabel="Remover linha">
                <ThemedText style={{ color: palette.danger, fontSize: 12 }}>✕ Remover</ThemedText>
              </Pressable>
            )}
          </View>
          {columns.map((col) => (
            <View key={col.columnName} style={{ gap: 2 }}>
              <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{col.displayName ?? col.columnName}</ThemedText>
              <TextInput
                editable={!readOnly}
                value={row[col.columnName] ?? ''}
                onChangeText={(v) => onRowsChange(rows.map((r, i) => (i === ri ? { ...r, [col.columnName]: v } : r)))}
                placeholder="—"
                placeholderTextColor={c.textMuted}
                style={[s.valueInput, { borderColor: c.border, color: c.text, backgroundColor: c.inputBg }]}
              />
            </View>
          ))}
        </View>
      ))}
      {!readOnly && columns.length > 0 && <Button small variant="secondary" label="+ Adicionar linha" onPress={() => onRowsChange([...rows, emptyRow()])} style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

export function SchemaPanel({ ws }: { ws: ProjectWorkspace }) {
  const c = useProjectColors();
  const [showWizard, setShowWizard] = useState(false);
  const [showAutoCreate, setShowAutoCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const doc = ws.selectedDocument;
  const isSaving = !!ws.busy.classes;
  const isFlowActive = ws.flow.phase !== 'idle';

  const selectedIsUnclassified = doc ? isUnclassifiedDocument(doc) : true;
  const activeClass = useMemo(() => {
    if (!doc?.documentId || selectedIsUnclassified) return null;
    return ws.linkedDocuments.find((d) => d.documentId === doc.documentId) ?? null;
  }, [doc, selectedIsUnclassified, ws.linkedDocuments]);
  const fields = useMemo(() => activeClass?.fields ?? [], [activeClass]);
  const isExtracting = !selectedIsUnclassified && (doc?.jobStatus === 'processing' || doc?.classificationStatus === 'processing');
  const readOnly = !doc?.processingJobId;

  const original = useMemo(() => (selectedIsUnclassified ? {} : scalarValuesFromResult(ws.originalResult, fields)), [ws.originalResult, fields, selectedIsUnclassified]);
  const originalTables = useMemo(
    () => Object.fromEntries(fields.filter((f) => f.fieldType === 'table').map((f) => [f.fieldName, selectedIsUnclassified ? [] : tableRowsFromResult(ws.originalResult, f)])) as Record<string, TableRow[]>,
    [ws.originalResult, fields, selectedIsUnclassified],
  );

  // Edição local, como no workspace web: troca de documento descarta alterações.
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [tables, setTables] = useState<Record<string, TableRow[]> | null>(null);
  useEffect(() => {
    setValues(null);
    setTables(null);
    setSelectedKey(null);
  }, [doc?.projectDocumentId, doc?.processingJobId]);

  const displayValues = values ?? original;
  const displayTables = tables ?? originalTables;

  const onCreateClass = async (draft: Parameters<typeof ws.createClass>[0]) => {
    if (await ws.createClass(draft)) setShowWizard(false);
  };

  let body: ReactNode;
  if (!doc && !ws.isEarlyFlow) body = <ThemedText style={[s.empty, { color: c.textMuted }]}>Selecione um documento na aba Documentos primeiro</ThemedText>;
  else if (ws.isEarlyFlow)
    body = (
      <View style={{ gap: 10, paddingVertical: 12 }}>
        {[0.66, 1, 1].map((w, i) => <View key={i} style={[s.shimmer, { width: `${w * 100}%`, height: i === 0 ? 16 : 40, backgroundColor: c.border }]} />)}
        <ThemedText style={{ textAlign: 'center', fontSize: 12, color: palette.primary }}>{ws.flowHint}</ThemedText>
      </View>
    );
  else if (selectedIsUnclassified) body = <ThemedText style={[s.empty, { color: c.textMuted }]}>Este documento não está classificado. Selecione um documento classificado ou atribua uma classe para ver os campos.</ThemedText>;
  else if (!activeClass) body = <ThemedText style={[s.empty, { color: c.textMuted }]}>A classe deste documento não foi encontrada no projeto.</ThemedText>;
  else
    body = (
      <>
        <ThemedText style={{ fontSize: 12, fontWeight: '600', color: c.textMuted }}>{activeClass.displayName}</ThemedText>
        {isExtracting && <ThemedText style={{ fontSize: 12, color: palette.primary }}>Extraindo valores dos campos…</ThemedText>}
        {fields.length === 0 ? (
          <ThemedText style={[s.empty, { color: c.textMuted }]}>Esta classe não possui campos definidos.</ThemedText>
        ) : (
          fields.map((field, idx) => {
            const key = field.fieldName;
            if (field.fieldType === 'table') {
              return (
                <TableFieldCard
                  key={`${activeClass.documentId}-${key}-${idx}`}
                  field={field}
                  rows={displayTables[key] ?? []}
                  readOnly={readOnly}
                  onRowsChange={(rows) => setTables((prev) => ({ ...(prev ?? originalTables), [key]: rows }))}
                />
              );
            }
            const value = displayValues[key] ?? '';
            const modified = value !== (original[key] ?? '');
            const selected = selectedKey === key;
            const pending = isExtracting && !value.trim();
            return (
              <View key={`${activeClass.documentId}-${key}-${idx}`} style={[s.fieldCard, { borderColor: selected ? palette.primary : c.border, backgroundColor: selected ? c.selectedBg : 'transparent' }]}>
                <View style={s.labelRow}>
                  <ThemedText style={{ color: palette.primary, fontSize: 12 }}>{fieldTypeOption(field.fieldType).icon}</ThemedText>
                  <ThemedText style={[s.fieldLabel, { color: c.text }]}>{field.displayName ?? field.fieldName}</ThemedText>
                  {modified && <ThemedText style={{ fontSize: 10, color: palette.primary }}>(modificado)</ThemedText>}
                </View>
                {pending ? (
                  <View style={[s.shimmer, { height: 18, width: '75%', backgroundColor: c.border }]} />
                ) : (
                  <TextInput
                    editable={!readOnly}
                    multiline
                    value={value}
                    placeholder="—"
                    placeholderTextColor={c.textMuted}
                    onFocus={() => setSelectedKey(key)}
                    onBlur={() => setSelectedKey((k) => (k === key ? null : k))}
                    onChangeText={(v) => setValues((prev) => ({ ...(prev ?? original), [key]: v }))}
                    style={[s.valueInput, { borderColor: selected ? palette.primary : c.border, color: c.text, backgroundColor: c.inputBg, opacity: readOnly ? 0.7 : 1 }]}
                  />
                )}
                {selected && !readOnly && <ThemedText style={{ fontSize: 10, color: palette.primary }}>Edite o valor diretamente aqui.</ThemedText>}
              </View>
            );
          })
        )}
      </>
    );

  return (
    <>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 2 }}>
          <ThemedText style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.primary }}>Classe</ThemedText>
          <ThemedText type="smallBold" style={{ color: c.text }}>Validação</ThemedText>
          <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{ws.linkedDocuments.length} classes</ThemedText>
        </View>
        <View style={[s.aiHint, { backgroundColor: c.selectedBg }]}>
          <ThemedText style={{ fontSize: 12, lineHeight: 17, color: c.dark ? '#c7d2fe' : '#4338ca' }}>
            ✨ Recomendado: crie com IA a partir de um documento de exemplo. A classe já vem configurada para ajudar o modelo classificador a classificar e extrair este tipo de documento com mais precisão.
          </ThemedText>
        </View>
        <Button icon="✨" label="Criar com IA (recomendado)" disabled={isSaving || isFlowActive} onPress={() => setShowAutoCreate(true)} />
        <View style={s.buttons}>
          <Button variant="secondary" small icon="+" label="Criar manualmente" onPress={() => setShowWizard(true)} style={{ flex: 1 }} />
          <Button variant="secondary" small icon="⚙︎" label="Gerenciar classes" disabled={isSaving} onPress={() => setShowManage(true)} style={{ flex: 1 }} />
        </View>
        <View style={[s.divider, { backgroundColor: c.border }]} />
        {body}
      </ScrollView>

      <ClassCreateWizard visible={showWizard} onCancel={() => setShowWizard(false)} onSave={onCreateClass} isSaving={isSaving} />
      <AutoCreateClassSheet visible={showAutoCreate} onClose={() => setShowAutoCreate(false)} onStartFlow={ws.startAutoCreateFlow} disabled={isFlowActive} onError={(m) => ws.notify('error', m)} />
      <ManageClassesSheet
        visible={showManage}
        onClose={() => setShowManage(false)}
        linkedDocuments={ws.linkedDocuments}
        availableDocuments={ws.availableDocuments}
        onAssign={ws.assignExistingClass}
        onUnlink={ws.unlinkClass}
        onSaveClass={ws.saveClass}
        isSaving={isSaving}
      />
    </>
  );
}

const s = StyleSheet.create({
  content: { padding: 12, gap: 10, paddingBottom: 120 },
  aiHint: { borderRadius: 10, padding: 10 },
  buttons: { flexDirection: 'row', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 13 },
  shimmer: { borderRadius: 6, alignSelf: 'center', opacity: 0.6 },
  fieldCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  valueInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tableRow: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6 },
});
