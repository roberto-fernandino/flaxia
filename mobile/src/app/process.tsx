import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Screen, Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

type SelectedFile = { name: string; uri: string; mimeType?: string };
type Classifier = Record<string, unknown>;

export default function ProcessScreen() {
  const { token } = useAuth();
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [classifiers, setClassifiers] = useState<Classifier[]>([]);
  const [classifierId, setClassifierId] = useState<string>();
  const [useClassifier, setUseClassifier] = useState(true);

  useEffect(() => { apiRequest<Classifier[]>('/engine/classifiers', {}, token ?? undefined).then((r) => setClassifiers(r.data ?? [])).catch(() => undefined); }, [token]);

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled) setSelected(result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType })));
  }

  async function processFiles() {
    if (!selected.length) return;
    setBusy(true); setStatus(undefined);
    try {
      const files = await Promise.all(selected.map(async (item) => {
        const file = new File(item.uri);
        const type = item.mimeType?.split('/')[1] === 'jpg' ? 'jpeg' : item.mimeType?.split('/')[1] ?? 'pdf';
        return { documentType: type, base64Document: await file.base64(), fileName: item.name };
      }));
      const result = await apiRequest<{ processingJobBatchId?: string }>('/engine/process_documents', { method: 'POST', body: JSON.stringify({ isMultiple: files.length > 1, useClassifier, classifierId: useClassifier ? classifierId : undefined, files }) }, token ?? undefined);
      setStatus(result.message ?? 'Documentos enviados para processamento.'); setSelected([]);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao processar documentos.'); }
    finally { setBusy(false); }
  }

  return <Screen title="Processar documentos">
    <Card><ThemedText>Selecione PDF ou imagens para enviar ao mecanismo de processamento.</ThemedText><Pressable onPress={() => setUseClassifier((current) => !current)}><ThemedText>{useClassifier ? '☑' : '☐'} Usar classificador</ThemedText></Pressable>{useClassifier && classifiers.map((item, index) => { const id = String(item.classifier_id ?? item.classifierId ?? index); return <Pressable key={id} onPress={() => setClassifierId(id)}><ThemedText>{classifierId === id ? '◉' : '○'} {String(item.name ?? 'Classificador')}</ThemedText></Pressable>; })}
      <Pressable onPress={pickFiles} style={styles.secondary}><ThemedText>Selecionar arquivos</ThemedText></Pressable>
    </Card>
    {selected.map((item) => <View key={item.uri} style={styles.file}><ThemedText>{item.name}</ThemedText></View>)}
    {!!selected.length && <Pressable disabled={busy} onPress={processFiles} style={styles.primary}><ThemedText style={styles.primaryText}>{busy ? 'Enviando...' : 'Processar agora'}</ThemedText></Pressable>}
    {status && <ThemedText>{status}</ThemedText>}
  </Screen>;
}
const styles = StyleSheet.create({ secondary: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 10, alignItems: 'center' }, primary: { padding: 14, borderRadius: 12, backgroundColor: '#208AEF', alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, file: { padding: 12, borderRadius: 10, backgroundColor: '#e2e8f0' } });
