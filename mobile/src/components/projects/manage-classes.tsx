import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import {
  ClassDocument,
  DocumentProcessMethod,
  ExportTarget,
  Field,
  fieldTypeOption,
  normalizeProcessMethod,
} from '@/lib/projects';
import { FieldsEditor } from './fields-editor';
import { Button, Checkbox, Input, Sheet, Toggle, palette, useProjectColors } from './ui';

const EXPORT_TARGETS: { value: ExportTarget; label: string; description: string }[] = [
  { value: 'webhook', label: 'Webhook', description: 'Envia os resultados para os webhooks configurados' },
];

export type ClassEdit = {
  displayName: string;
  description: string;
  isValidating: boolean;
  minValidationConfidence: number | null;
  documentProcessMethod: DocumentProcessMethod;
  prompt: string;
  exportTargets: ExportTarget[];
  fields: Field[];
};

const editFromDoc = (doc: ClassDocument): ClassEdit => ({
  displayName: doc.displayName,
  description: doc.description ?? '',
  isValidating: doc.isValidating ?? true,
  minValidationConfidence: doc.minValidationConfidence ?? null,
  documentProcessMethod: normalizeProcessMethod(doc.documentProcessMethod),
  prompt: doc.prompt ?? '',
  exportTargets: (doc.exportTargets ?? []).filter((t) => t !== 'db'),
  fields: [...(doc.fields ?? [])],
});

export function ManageClassesSheet({
  visible,
  onClose,
  linkedDocuments,
  availableDocuments,
  onAssign,
  onUnlink,
  onSaveClass,
  isSaving,
}: {
  visible: boolean;
  onClose: () => void;
  linkedDocuments: ClassDocument[];
  availableDocuments: ClassDocument[];
  onAssign: (documentId: string) => Promise<void>;
  onUnlink: (documentId: string) => Promise<void>;
  onSaveClass: (doc: ClassDocument, edit: ClassEdit) => Promise<boolean>;
  isSaving: boolean;
}) {
  const c = useProjectColors();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<ClassEdit | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) return;
    setExpandedId(null);
    setEditingId(null);
    setEdit(null);
    setShowAssign(false);
    setQuery('');
    setSelectedId(null);
    setConfirmRemoveId(null);
  }, [visible]);

  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableDocuments;
    return availableDocuments.filter((d) => [d.displayName, d.documentType, d.documentId].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [availableDocuments, query]);

  const startEdit = (doc: ClassDocument) => {
    setEditingId(doc.documentId);
    setEdit(editFromDoc(doc));
    setExpandedId(doc.documentId);
    setConfirmRemoveId(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };
  const patch = (p: Partial<ClassEdit>) => setEdit((e) => (e ? { ...e, ...p } : e));

  const assign = async () => {
    if (!selectedId || isSaving) return;
    try {
      await onAssign(selectedId);
      setShowAssign(false);
      setQuery('');
      setSelectedId(null);
    } catch {
      // mensagem de erro já exibida pelo workspace
    }
  };

  const unlink = async (documentId: string) => {
    try {
      await onUnlink(documentId);
      if (expandedId === documentId) {
        setExpandedId(null);
        cancelEdit();
      }
      setConfirmRemoveId(null);
    } catch {
      // mensagem de erro já exibida pelo workspace
    }
  };

  const save = async (doc: ClassDocument) => {
    if (!edit) return;
    if (await onSaveClass(doc, edit)) cancelEdit();
  };

  return (
    <Sheet
      visible={visible}
      title="Gerenciar classes do projeto"
      subtitle={`${linkedDocuments.length} classes vinculadas a este projeto`}
      onClose={onClose}
      closeDisabled={isSaving}
      footer={<Button variant="secondary" label="Fechar" disabled={isSaving} onPress={onClose} />}>
      <Button variant="secondary" small icon="🔗" label="Atribuir classe existente" disabled={isSaving} onPress={() => setShowAssign((v) => !v)} style={{ alignSelf: 'flex-start' }} />

      {showAssign && (
        <View style={[s.panel, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          <ThemedText style={{ fontSize: 13, color: c.textMuted }}>Selecione uma classe da sua biblioteca para vincular a este projeto.</ThemedText>
          {availableDocuments.length === 0 ? (
            <ThemedText style={[s.empty, { color: c.textMuted }]}>Nenhuma classe disponível. Todas as suas classes já estão vinculadas ou ainda não existem.</ThemedText>
          ) : (
            <>
              <Input value={query} onChangeText={setQuery} placeholder="Buscar classes…" autoCapitalize="none" />
              {filteredAvailable.map((doc) => {
                const selected = selectedId === doc.documentId;
                return (
                  <Pressable key={doc.documentId} onPress={() => setSelectedId(doc.documentId)} style={[s.option, { borderColor: selected ? palette.primary : c.border, backgroundColor: selected ? c.selectedBg : c.surface }]}>
                    <View style={[s.optionIcon, { backgroundColor: c.selectedBg }]}><ThemedText>📄</ThemedText></View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold" numberOfLines={1} style={{ color: c.text }}>{doc.displayName || 'Classe sem nome'}</ThemedText>
                      {!!doc.documentType && <ThemedText numberOfLines={1} style={{ fontSize: 12, color: c.textMuted }}>{doc.documentType}</ThemedText>}
                      <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{doc.fields?.length ?? 0} campos</ThemedText>
                    </View>
                    {selected && <ThemedText style={{ color: palette.primary, fontSize: 18 }}>✓</ThemedText>}
                  </Pressable>
                );
              })}
              {filteredAvailable.length === 0 && <ThemedText style={[s.empty, { color: c.textMuted }]}>Nenhuma classe corresponde à busca.</ThemedText>}
              <View style={s.actions}>
                <Button small variant="secondary" label="Cancelar" disabled={isSaving} onPress={() => { setShowAssign(false); setQuery(''); setSelectedId(null); }} />
                <Button small label="Atribuir" loading={isSaving} disabled={!selectedId} onPress={() => void assign()} />
              </View>
            </>
          )}
        </View>
      )}

      {linkedDocuments.length === 0 ? (
        <ThemedText style={[s.empty, { color: c.textMuted }]}>Nenhuma classe vinculada ainda. Use &quot;Atribuir classe existente&quot; acima ou crie uma no painel.</ThemedText>
      ) : (
        linkedDocuments.map((doc) => {
          const expanded = expandedId === doc.documentId;
          const editing = editingId === doc.documentId && edit;
          const fields = editing ? edit.fields : doc.fields ?? [];
          const method = editing ? edit.documentProcessMethod : normalizeProcessMethod(doc.documentProcessMethod);
          return (
            <View key={doc.documentId} style={[s.classCard, { borderColor: c.border }]}>
              <View style={s.classHeader}>
                <Pressable style={s.classTitle} onPress={() => { setConfirmRemoveId(null); setExpandedId(expanded ? null : doc.documentId); }}>
                  <ThemedText style={{ color: c.textMuted }}>{expanded ? '▾' : '▸'}</ThemedText>
                  <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1, color: c.text }}>{doc.displayName}</ThemedText>
                  <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{fields.length} campos</ThemedText>
                </Pressable>
                {!editing && (
                  <Pressable accessibilityLabel="Editar classe" disabled={isSaving} onPress={() => startEdit(doc)} hitSlop={8}><ThemedText style={{ fontSize: 16 }}>✏️</ThemedText></Pressable>
                )}
                <Pressable accessibilityLabel="Remover do projeto" disabled={isSaving} onPress={() => setConfirmRemoveId(confirmRemoveId === doc.documentId ? null : doc.documentId)} hitSlop={8}>
                  <ThemedText style={{ fontSize: 16 }}>🗑</ThemedText>
                </Pressable>
              </View>

              {confirmRemoveId === doc.documentId && (
                <View style={[s.confirm, { backgroundColor: c.dark ? 'rgba(220,38,38,0.15)' : palette.dangerSoft }]}>
                  <ThemedText style={{ fontSize: 13, color: c.dark ? '#fecaca' : '#991b1b' }}>Remover &quot;{doc.displayName}&quot; deste projeto? A classe permanecerá na sua biblioteca.</ThemedText>
                  <View style={s.actions}>
                    <Button small variant="danger" label="Remover" loading={isSaving} onPress={() => void unlink(doc.documentId)} />
                    <Button small variant="secondary" label="Cancelar" disabled={isSaving} onPress={() => setConfirmRemoveId(null)} />
                  </View>
                </View>
              )}

              {expanded && (
                <View style={[s.classBody, { borderColor: c.border }]}>
                  {editing ? (
                    <>
                      <Input label="Nome da classe" value={edit.displayName} onChangeText={(v) => patch({ displayName: v })} />
                      <Input label="Descrição" value={edit.description} multiline placeholder="Esta descrição ajuda nosso modelo a classificar este documento." onChangeText={(v) => patch({ description: v })} />
                      <View style={[s.panel, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
                        <View style={s.rowBetween}>
                          <View style={{ flex: 1 }}>
                            <ThemedText type="smallBold" style={{ color: c.text }}>Ativar validação</ThemedText>
                            <ThemedText style={{ fontSize: 11, color: c.textMuted }}>Quando ativado, a aba de Validação é exibida nos resultados do processamento para este tipo de documento.</ThemedText>
                          </View>
                          <Toggle value={edit.isValidating} onChange={(v) => patch({ isValidating: v })} label="Ativar validação" />
                        </View>
                        {edit.isValidating && (
                          <Input
                            label="Confiança mínima para pular validação"
                            hint="Documentos com confiança da extração maior ou igual a este valor (0–1) pulam a fila de validação. Deixe vazio para sempre exigir revisão."
                            keyboardType="decimal-pad"
                            placeholder="ex.: 0,9"
                            value={edit.minValidationConfidence != null ? String(edit.minValidationConfidence) : ''}
                            onChangeText={(v) => {
                              const trimmed = v.trim().replace(',', '.');
                              patch({ minValidationConfidence: trimmed === '' ? null : Math.min(1, Math.max(0, Number.parseFloat(trimmed) || 0)) });
                            }}
                          />
                        )}
                        <View style={{ gap: 6 }}>
                          <ThemedText type="smallBold" style={{ color: c.text }}>Método de processamento</ThemedText>
                          <View style={[s.segment, { borderColor: c.border }]}>
                            {[DocumentProcessMethod.Fields, DocumentProcessMethod.Prompt].map((m) => (
                              <Pressable key={m} onPress={() => patch({ documentProcessMethod: m })} style={[s.segmentItem, edit.documentProcessMethod === m && { backgroundColor: palette.primary }]}>
                                <ThemedText style={{ fontSize: 13, color: edit.documentProcessMethod === m ? '#fff' : c.text }}>{m === DocumentProcessMethod.Fields ? 'Campos' : 'Prompt'}</ThemedText>
                              </Pressable>
                            ))}
                          </View>
                          <ThemedText style={{ fontSize: 11, color: c.textMuted }}>Escolha se deseja definir um esquema de campos ou usar um único prompt.</ThemedText>
                        </View>
                        {edit.documentProcessMethod === DocumentProcessMethod.Prompt && (
                          <Input label="Prompt" multiline value={edit.prompt} placeholder="Escreva uma instrução clara sobre como extrair/estruturar as informações do documento." onChangeText={(v) => patch({ prompt: v })} style={{ minHeight: 120 }} />
                        )}
                        <ThemedText type="smallBold" style={{ color: c.text }}>Destinos de exportação adicionais</ThemedText>
                        {EXPORT_TARGETS.map((t) => (
                          <Checkbox key={t.value} checked={edit.exportTargets.includes(t.value)} onPress={() => patch({ exportTargets: edit.exportTargets.includes(t.value) ? edit.exportTargets.filter((x) => x !== t.value) : [...edit.exportTargets, t.value] })}>
                            <ThemedText type="smallBold" style={{ color: c.text }}>{t.label}</ThemedText>
                            <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{t.description}</ThemedText>
                          </Checkbox>
                        ))}
                      </View>
                      {edit.documentProcessMethod === DocumentProcessMethod.Fields && <FieldsEditor fields={edit.fields} onChange={(f) => patch({ fields: f })} showPrompts />}
                      <View style={s.actions}>
                        <Button variant="secondary" label="Cancelar" disabled={isSaving} onPress={cancelEdit} />
                        <Button label="Salvar" loading={isSaving} onPress={() => void save(doc)} />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={s.tags}>
                        <View style={[s.pill, { backgroundColor: c.surfaceAlt }]}><ThemedText style={{ fontSize: 11, color: c.textMuted }}>{doc.isValidating ?? true ? 'Ativar validação' : 'Validação desativada'}</ThemedText></View>
                        <View style={[s.pill, { backgroundColor: c.surfaceAlt }]}><ThemedText style={{ fontSize: 11, color: c.textMuted }}>{method === DocumentProcessMethod.Prompt ? 'Prompt' : 'Campos'}</ThemedText></View>
                      </View>
                      {fields.map((field, idx) => (
                        <View key={`${doc.documentId}-${idx}`} style={[s.fieldRow, { borderColor: c.border }]}>
                          <View style={s.rowBetween}>
                            <ThemedText style={{ fontSize: 13, color: c.text }}>{fieldTypeOption(field.fieldType).icon}  {field.displayName ?? field.fieldName}</ThemedText>
                            <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{fieldTypeOption(field.fieldType).label}</ThemedText>
                          </View>
                          {!!field.fieldPrompt && <ThemedText numberOfLines={2} style={{ fontSize: 11, color: c.textMuted }}>{field.fieldPrompt}</ThemedText>}
                        </View>
                      ))}
                      {method === DocumentProcessMethod.Prompt && !!doc.prompt && (
                        <View style={[s.fieldRow, { borderColor: c.border }]}>
                          <ThemedText style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: c.textMuted }}>Prompt</ThemedText>
                          <TextInput editable={false} multiline value={doc.prompt} style={{ fontSize: 13, color: c.text }} />
                        </View>
                      )}
                      <Button variant="secondary" label="Editar classe" disabled={isSaving} onPress={() => startEdit(doc)} style={{ alignSelf: 'flex-end' }} />
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  empty: { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
  optionIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  classCard: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  classHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10 },
  classTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirm: { padding: 12, gap: 8 },
  classBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  segment: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  segmentItem: { paddingHorizontal: 14, paddingVertical: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  fieldRow: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 4 },
});
