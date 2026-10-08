import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { Screen, Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { FileSource, PickedFile, pickProjectFile, readBase64 } from '@/components/projects/pick-file';
import { ClassifierSummary, errorMessage, projectsApi } from '@/lib/projects';

const SOURCES: { source: FileSource; label: string; icon: string }[] = [
  { source: 'camera', label: 'Câmera', icon: '📷' },
  { source: 'photos', label: 'Fotos', icon: '🖼️' },
  { source: 'files', label: 'Arquivos', icon: '📄' },
];

type Status = { kind: 'success' | 'error'; text: string };

export default function ProcessScreen() {
  const { token } = useAuth();
  const theme = useTheme();
  const [projects, setProjects] = useState<ClassifierSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectId, setProjectId] = useState<string>();
  const [selected, setSelected] = useState<PickedFile[]>([]);
  const [status, setStatus] = useState<Status>();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  useFocusEffect(useCallback(() => {
    setLoadingProjects(true);
    projectsApi.list(token)
      .then((r) => {
        const list = r.data ?? [];
        setProjects(list);
        setProjectId((current) => current && list.some((p) => p.classifierId === current) ? current : list.length === 1 ? list[0].classifierId : undefined);
      })
      .catch(() => undefined)
      .finally(() => setLoadingProjects(false));
  }, [token]));

  async function addFile(source: FileSource) {
    setStatus(undefined);
    const result = await pickProjectFile(source);
    if (result.error) setStatus({ kind: 'error', text: result.error });
    else if (result.file) { const file = result.file; setSelected((current) => [...current, file]); setSentTo(undefined); }
  }

  async function processFiles() {
    if (!selected.length || !projectId) return;
    setBusy(true); setStatus(undefined);
    const failed: PickedFile[] = [];
    for (const file of selected) {
      try {
        await projectsApi.upload(token, projectId, { base64Document: await readBase64(file), mimeType: file.mimeType, fileName: file.name });
      } catch (error) {
        failed.push(file);
        setStatus({ kind: 'error', text: errorMessage(error, `Falha ao enviar ${file.name}.`) });
      }
    }
    const sent = selected.length - failed.length;
    setSelected(failed);
    if (sent) {
      setSentTo(projectId);
      if (!failed.length) setStatus({ kind: 'success', text: `${sent} documento(s) enviado(s) para processamento.` });
    }
    setBusy(false);
  }

  const project = projects.find((p) => p.classifierId === projectId);
  const canSend = !!selected.length && !!projectId && !busy;

  return <Screen title="Processar documentos">
    <Card>
      <ThemedText type="smallBold">1. Projeto</ThemedText>
      {loadingProjects && !projects.length && <ThemedText style={styles.muted}>Carregando projetos...</ThemedText>}
      {!loadingProjects && !projects.length && <>
        <ThemedText style={styles.muted}>Nenhum projeto encontrado.</ThemedText>
        <Pressable onPress={() => router.push('/classifiers')} style={[styles.secondary, { borderColor: theme.border, backgroundColor: theme.secondary }]}><ThemedText style={styles.secondaryLabel}>Criar projeto</ThemedText></Pressable>
      </>}
      {projects.map((item) => {
        const active = item.classifierId === projectId;
        return <Pressable key={item.classifierId} onPress={() => setProjectId(item.classifierId)} style={[styles.option, { borderColor: active ? '#208AEF' : theme.border, backgroundColor: active ? theme.selected : theme.input }]}>
          <View style={[styles.radio, active && styles.radioActive]} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{item.name || 'Projeto'}</ThemedText>
            <ThemedText style={styles.muted}>{item.modelsCount} classe(s)</ThemedText>
          </View>
        </Pressable>;
      })}
    </Card>

    <Card>
      <ThemedText type="smallBold">2. Documentos</ThemedText>
      <ThemedText style={styles.muted}>PDF ou imagens (até 20 MB).</ThemedText>
      <View style={styles.sources}>
        {SOURCES.map(({ source, label, icon }) => <Pressable key={source} disabled={busy} onPress={() => addFile(source)} style={[styles.source, { borderColor: theme.border, backgroundColor: theme.input }]}>
          <ThemedText style={styles.sourceIcon}>{icon}</ThemedText>
          <ThemedText>{label}</ThemedText>
        </Pressable>)}
      </View>
      {selected.map((item, index) => <View key={`${item.uri}-${index}`} style={[styles.file, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText numberOfLines={1} style={styles.flex}>{item.name}</ThemedText>
        {!busy && <Pressable hitSlop={8} onPress={() => setSelected((current) => current.filter((_, i) => i !== index))}><ThemedText style={styles.remove}>✕</ThemedText></Pressable>}
      </View>)}
    </Card>

    {!!selected.length && <Pressable disabled={!canSend} onPress={processFiles} style={[styles.primary, !canSend && styles.disabled]}>
      <ThemedText style={styles.primaryText}>{busy ? 'Enviando...' : !projectId ? 'Selecione um projeto' : `Enviar para ${project?.name ?? 'projeto'}`}</ThemedText>
    </Pressable>}
    {status && <ThemedText style={{ color: status.kind === 'error' ? theme.danger : theme.success }}>{status.text}</ThemedText>}
    {sentTo && <Pressable onPress={() => router.push(`/classifiers/${sentTo}`)} style={[styles.secondary, { borderColor: theme.border, backgroundColor: theme.secondary }]}><ThemedText style={styles.secondaryLabel}>Abrir projeto</ThemedText></Pressable>}
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { opacity: 0.6, fontSize: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#94a3b8' },
  radioActive: { borderColor: '#208AEF', borderWidth: 6 },
  sources: { flexDirection: 'row', gap: 8, marginTop: 6 },
  source: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 10, borderWidth: 1 },
  sourceIcon: { fontSize: 24, lineHeight: 30 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  remove: { opacity: 0.6, fontWeight: '700' },
  secondary: { marginTop: 4, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center' },
  secondaryLabel: { fontWeight: '600' },
  primary: { padding: 14, borderRadius: 12, backgroundColor: '#208AEF', alignItems: 'center' },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
