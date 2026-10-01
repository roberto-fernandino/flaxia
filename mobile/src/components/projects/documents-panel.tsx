import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ProjectDocument, classColor, isUnclassifiedDocument } from '@/lib/projects';
import { FileSource, pickProjectFile } from './pick-file';
import { Badge, Button, DocumentSkeleton, Input, palette, useProjectColors } from './ui';
import type { ProjectWorkspace } from './use-workspace';

const UNCLASSIFIED = 'Não classificado';

const STATUS: Record<string, { label: string; tone: 'gray' | 'amber' | 'green' | 'red' }> = {
  unclassified: { label: 'Não classificado', tone: 'gray' },
  processing: { label: 'Processando', tone: 'amber' },
  classified: { label: 'Classificado', tone: 'green' },
  failed: { label: 'Falhou', tone: 'red' },
};

export function statusOf(doc: ProjectDocument) {
  return STATUS[isUnclassifiedDocument(doc) ? 'unclassified' : doc.classificationStatus] ?? STATUS.unclassified;
}

/** Folha de origem (arquivos / fotos / câmera), equivalente ao MobileFileSourceSheet do web. */
export function chooseFileSource(onPick: (source: FileSource) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ options: ['Arquivos', 'Fotos', 'Câmera', 'Cancelar'], cancelButtonIndex: 3 }, (i) => {
      if (i === 0) onPick('files');
      if (i === 1) onPick('photos');
      if (i === 2) onPick('camera');
    });
    return;
  }
  Alert.alert('Enviar documento', undefined, [
    { text: 'Arquivos', onPress: () => onPick('files') },
    { text: 'Fotos', onPress: () => onPick('photos') },
    { text: 'Câmera', onPress: () => onPick('camera') },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}

export function DocumentsPanel({ ws, onOpenDocument }: { ws: ProjectWorkspace; onOpenDocument: (id: string) => void }) {
  const c = useProjectColors();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const flowDocId = ws.isEarlyFlow ? ws.flow.projectDocumentId : undefined;
  const isUploadBusy = ws.pendingUpload !== null;
  const flowDisabled = ws.flow.phase !== 'idle' || isUploadBusy;

  const visible = useMemo(() => ws.documents.filter((d) => d.projectDocumentId !== flowDocId), [ws.documents, flowDocId]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const map = new Map<string, ProjectDocument[]>();
    for (const doc of visible.filter((d) => d.fileName.toLowerCase().includes(q))) {
      const key = isUnclassifiedDocument(doc) || !doc.documentDisplayName ? UNCLASSIFIED : doc.documentDisplayName;
      map.set(key, [...(map.get(key) ?? []), doc]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === UNCLASSIFIED ? 1 : b === UNCLASSIFIED ? -1 : a.localeCompare(b)));
  }, [visible, search]);

  const upload = () =>
    chooseFileSource(async (source) => {
      const result = await pickProjectFile(source);
      if (result.error) ws.notify('error', result.error);
      else if (result.file) void ws.uploadDocument(result.file);
    });

  const confirmDelete = (doc: ProjectDocument) =>
    Alert.alert('Remover documento', `Remover "${doc.fileName}" deste projeto?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void ws.deleteDocument(doc) },
    ]);

  const openContextMenu = (doc: ProjectDocument) => {
    if (!isUnclassifiedDocument(doc) || flowDisabled) return;
    Alert.alert(doc.fileName, undefined, [
      { text: '✨ Criar classe com IA', onPress: () => ws.startAutoCreateFromExisting(doc.projectDocumentId, doc.fileName) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const count = visible.length + (ws.pendingUpload ? 1 : 0) + (ws.isEarlyFlow ? 1 : 0);

  return (
    <ScrollView
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await ws.refetchAll(); setRefreshing(false); }} />}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" style={{ color: c.text }}>Documentos</ThemedText>
          <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{count} documentos</ThemedText>
        </View>
        <Button small icon="⬆︎" label="Enviar documento" disabled={isUploadBusy || !!ws.busy.delete} onPress={upload} />
      </View>
      <Input value={search} onChangeText={setSearch} placeholder="🔍  Buscar documentos" autoCapitalize="none" />
      <ThemedText style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: c.textMuted }}>Agrupar por: Classe</ThemedText>

      {grouped.length === 0 && !ws.pendingUpload && !ws.isEarlyFlow ? (
        <ThemedText style={{ textAlign: 'center', paddingVertical: 24, color: c.textMuted }}>Envie documentos para começar.</ThemedText>
      ) : (
        <>
          {grouped.map(([className, docs]) => {
            const isCollapsed = collapsed.has(className);
            return (
              <View key={className} style={{ gap: 6 }}>
                <Pressable
                  onPress={() => setCollapsed((prev) => { const next = new Set(prev); if (next.has(className)) next.delete(className); else next.add(className); return next; })}
                  style={s.groupHeader}>
                  <ThemedText style={{ color: c.textMuted, width: 12 }}>{isCollapsed ? '▸' : '▾'}</ThemedText>
                  <View style={[s.swatch, { backgroundColor: classColor(className) }]} />
                  <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1, color: c.text }}>{className}</ThemedText>
                  <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{docs.length}</ThemedText>
                </Pressable>
                {!isCollapsed &&
                  docs.map((doc) => {
                    const selected = doc.projectDocumentId === ws.selectedDocumentId;
                    const status = statusOf(doc);
                    const unclassified = isUnclassifiedDocument(doc);
                    const classifying = !!ws.busy[`classify:${doc.projectDocumentId}`];
                    return (
                      <Pressable
                        key={doc.projectDocumentId}
                        onPress={() => onOpenDocument(doc.projectDocumentId)}
                        onLongPress={() => openContextMenu(doc)}
                        style={[s.item, { borderColor: selected ? palette.primary : c.border, backgroundColor: selected ? c.selectedBg : c.surface }]}>
                        <View style={{ flex: 1, gap: 6 }}>
                          <ThemedText numberOfLines={1} style={{ fontWeight: '600', color: c.text }}>{doc.fileName}</ThemedText>
                          <Badge label={status.label} tone={status.tone} />
                          <View style={s.itemActions}>
                            {doc.classificationStatus === 'classified' && (
                              <Pressable disabled={classifying} onPress={() => void ws.reclassify(doc.projectDocumentId)} hitSlop={6}>
                                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: palette.primary, opacity: classifying ? 0.5 : 1 }}>Reclassificar</ThemedText>
                              </Pressable>
                            )}
                            {ws.isStuck(doc) && (
                              <Pressable disabled={classifying} onPress={() => void ws.reclassify(doc.projectDocumentId, 'reprocess')} hitSlop={6}>
                                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: palette.warning, opacity: classifying ? 0.5 : 1 }}>↻ {classifying ? 'Reprocessando…' : 'Reprocessar'}</ThemedText>
                              </Pressable>
                            )}
                            {unclassified && !flowDisabled && (
                              <Pressable onPress={() => ws.startAutoCreateFromExisting(doc.projectDocumentId, doc.fileName)} hitSlop={6}>
                                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: palette.primary }}>✨ Criar classe com IA</ThemedText>
                              </Pressable>
                            )}
                          </View>
                        </View>
                        <Pressable accessibilityLabel="Remover" disabled={!!ws.busy.delete} onPress={() => confirmDelete(doc)} hitSlop={10} style={{ padding: 4, opacity: ws.busy.delete ? 0.4 : 1 }}>
                          <ThemedText style={{ fontSize: 16 }}>🗑</ThemedText>
                        </Pressable>
                      </Pressable>
                    );
                  })}
              </View>
            );
          })}
          {ws.pendingUpload && <DocumentSkeleton compact fileName={ws.pendingUpload} hint="Enviando…" />}
          {ws.isEarlyFlow && <DocumentSkeleton compact fileName={ws.flow.fileName} hint={ws.flowHint || 'Processando'} />}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 12, gap: 10, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});
