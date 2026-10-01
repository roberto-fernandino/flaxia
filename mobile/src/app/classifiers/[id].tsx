import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DocumentsPanel } from '@/components/projects/documents-panel';
import { ExistingClassMatchModal } from '@/components/projects/flow-modals';
import { SchemaPanel } from '@/components/projects/schema-panel';
import { ToastBanner, palette, useProjectColors } from '@/components/projects/ui';
import { useProjectWorkspace } from '@/components/projects/use-workspace';
import { ViewerPanel } from '@/components/projects/viewer-panel';

type Tab = 'documents' | 'viewer' | 'schema';

/** Workspace do projeto — porta mobile de `ProjectWorkspace` (web). Os três painéis viram abas. */
export default function ProjectWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ws = useProjectWorkspace(String(id));
  const c = useProjectColors();
  const [tab, setTab] = useState<Tab>('documents');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/classifiers'));

  const confirmDeleteProject = () => {
    if (!ws.classifier) return;
    Alert.alert(
      'Excluir projeto',
      `Excluir o projeto "${ws.classifier.name}"? Todos os documentos dele serão removidos permanentemente. Isso não pode ser desfeito.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => { if (await ws.deleteProject()) router.replace('/classifiers'); } },
      ],
    );
  };

  const openDocument = (docId: string) => {
    ws.selectDocument(docId);
    setTab('viewer');
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'documents', label: `Documentos (${ws.documents.length})` },
    { key: 'viewer', label: 'Documento' },
    { key: 'schema', label: 'Classe' },
  ];

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={[s.header, { borderColor: c.border }]}>
          <Pressable onPress={goBack} hitSlop={10}>
            <ThemedText style={{ fontSize: 13, color: c.textMuted }}>← Projetos</ThemedText>
          </Pressable>
          <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: '700', color: c.text }}>{ws.classifier?.name ?? ''}</ThemedText>
          {ws.classifier && (
            <Pressable accessibilityLabel="Excluir projeto" disabled={!!ws.busy.deleteProject} onPress={confirmDeleteProject} hitSlop={10} style={{ opacity: ws.busy.deleteProject ? 0.4 : 1 }}>
              <ThemedText style={{ fontSize: 18 }}>🗑</ThemedText>
            </Pressable>
          )}
        </View>

        {!ws.classifier ? (
          <View style={s.center}>
            <ThemedText style={{ color: c.textMuted }}>{!ws.loaded ? 'Carregando workspace…' : ws.notFound ? 'Projeto não encontrado' : 'Falha ao carregar'}</ThemedText>
          </View>
        ) : (
          <>
            <View style={[s.tabs, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
              {tabs.map((t) => {
                const active = tab === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setTab(t.key)} style={[s.tab, active && { backgroundColor: c.surface, shadowOpacity: 0.08 }]}>
                    <ThemedText numberOfLines={1} style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? palette.primary : c.textMuted }}>{t.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ToastBanner toast={ws.toast} onDismiss={ws.dismissToast} />
            <View style={{ flex: 1 }}>
              {tab === 'documents' && <DocumentsPanel ws={ws} onOpenDocument={openDocument} />}
              {tab === 'viewer' && <ViewerPanel ws={ws} />}
              {tab === 'schema' && <SchemaPanel ws={ws} />}
            </View>
          </>
        )}
      </SafeAreaView>

      <ExistingClassMatchModal
        visible={!!ws.match}
        className={ws.match?.displayName ?? ''}
        isLinkedToProject={ws.match?.isLinkedToProject ?? false}
        advice={ws.match?.advice}
        usedInProjects={ws.match?.usedInProjects}
        onUseExisting={() => ws.resolveMatch('use_existing')}
        onCreateNew={() => ws.resolveMatch('create_new')}
        onCancel={() => ws.resolveMatch('cancel')}
      />
    </ThemedView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', margin: 12, padding: 3, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0 },
});
