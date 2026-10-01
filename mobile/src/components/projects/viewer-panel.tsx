import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '@/auth/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { API_BASE_URL } from '@/lib/api';
import { ProjectDocument, errorMessage } from '@/lib/projects';
import { Button, DocumentSkeleton, palette, useProjectColors } from './ui';
import type { ProjectWorkspace } from './use-workspace';

const isPdf = (doc: ProjectDocument) => /pdf/i.test(doc.mimeType) || /\.pdf$/i.test(doc.fileName);

function fileUrlOf(doc: ProjectDocument) {
  return doc.processingJobId
    ? `${API_BASE_URL}/engine/processing_job/${doc.processingJobId}/document`
    : `${API_BASE_URL}/engine/project_documents/${doc.projectDocumentId}/file`;
}

/** Baixa o arquivo (com auth) para o cache local; reaproveitado no preview e no compartilhamento. */
async function downloadToCache(doc: ProjectDocument, token: string) {
  const ext = isPdf(doc) && !/\.pdf$/i.test(doc.fileName) ? '.pdf' : '';
  const destination = new File(Paths.cache, `${doc.projectDocumentId}-${doc.processingJobId ?? 'raw'}-${doc.fileName.replace(/[^\w.\-]+/g, '_')}${ext}`);
  if (destination.exists) return destination.uri;
  const downloaded = await File.createDownloadTask(fileUrlOf(doc), destination, { headers: { Authorization: `Bearer ${token}` } }).downloadAsync();
  if (!downloaded) throw new Error('Download interrompido.');
  return downloaded.uri;
}

export function ViewerPanel({ ws }: { ws: ProjectWorkspace }) {
  const c = useProjectColors();
  const { token } = useAuth();
  const doc = ws.selectedDocument;
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [sharing, setSharing] = useState(false);

  const skeleton = ws.isEarlyFlow ? { fileName: ws.flow.fileName, hint: ws.flowHint } : ws.pendingUpload ? { fileName: ws.pendingUpload, hint: undefined } : null;
  const title = skeleton?.fileName ?? doc?.fileName ?? 'Visualizador';
  const docKey = doc ? `${doc.projectDocumentId}:${doc.processingJobId ?? ''}` : null;

  useEffect(() => {
    setLocalUri(null);
    setFileError(false);
    if (!doc || !token || skeleton) return;
    let cancelled = false;
    setLoadingFile(true);
    downloadToCache(doc, token)
      .then((uri) => { if (!cancelled) setLocalUri(uri); })
      .catch(() => { if (!cancelled) setFileError(true); })
      .finally(() => { if (!cancelled) setLoadingFile(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, token, !!skeleton]);

  const shareDocument = async () => {
    if (!doc || !token) return;
    setSharing(true);
    try {
      const uri = localUri ?? (await downloadToCache(doc, token));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento não disponível neste dispositivo.');
      await Sharing.shareAsync(uri, { mimeType: doc.mimeType, UTI: isPdf(doc) ? 'com.adobe.pdf' : undefined, dialogTitle: doc.fileName });
    } catch (e) {
      ws.notify('error', errorMessage(e, 'Falha ao compartilhar documento.'));
    } finally {
      setSharing(false);
    }
  };

  const stuck = ws.isStuck(doc);
  const reprocessing = !!doc && !!ws.busy[`classify:${doc.projectDocumentId}`];
  const reprocessButton = doc && (
    <Button variant="warning" icon="↻" label={reprocessing ? 'Reprocessando…' : 'Reprocessar'} loading={reprocessing} onPress={() => void ws.reclassify(doc.projectDocumentId, 'reprocess')} style={{ alignSelf: 'center' }} />
  );

  let preview: ReactNode = null;
  if (doc) {
    if (loadingFile) {
      preview = (
        <View style={[s.frame, s.placeholder, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          <ActivityIndicator color={palette.primary} />
          <ThemedText style={{ fontSize: 12, color: c.textMuted }}>Carregando documento…</ThemedText>
        </View>
      );
    } else if (localUri && !isPdf(doc)) {
      preview = (
        <View style={[s.frame, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          <Image source={{ uri: localUri }} style={s.image} contentFit="contain" transition={150} />
        </View>
      );
    } else if (localUri && isPdf(doc) && Platform.OS === 'ios') {
      // WKWebView renderiza PDF local nativamente (páginas roláveis, zoom por pinça).
      preview = (
        <View style={[s.frame, s.pdf, { borderColor: c.border }]}>
          <WebView source={{ uri: localUri }} originWhitelist={['*']} allowFileAccess allowingReadAccessToURL={localUri} style={{ flex: 1, backgroundColor: c.surfaceAlt }} />
        </View>
      );
    } else {
      preview = (
        <View style={[s.frame, s.placeholder, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          <ThemedText style={{ fontSize: 44 }}>{isPdf(doc) ? '📄' : '🖼'}</ThemedText>
          <ThemedText numberOfLines={2} style={{ color: c.text, textAlign: 'center', fontWeight: '600' }}>{doc.fileName}</ThemedText>
          <ThemedText style={{ fontSize: 12, color: c.textMuted }}>
            {fileError ? 'Não foi possível carregar a pré-visualização.' : 'Pré-visualização indisponível — use Compartilhar para abrir.'}
          </ThemedText>
        </View>
      );
    }
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ThemedText type="smallBold" numberOfLines={2} style={{ color: c.text }}>{title}</ThemedText>
      {skeleton ? (
        <DocumentSkeleton fileName={skeleton.fileName} hint={skeleton.hint} />
      ) : !doc ? (
        <ThemedText style={[s.hint, { color: c.textMuted }]}>Envie um documento pela aba Documentos.</ThemedText>
      ) : (
        <>
          {preview}
          <Button variant="secondary" icon="⬆︎" label={sharing ? 'Preparando…' : 'Compartilhar documento'} loading={sharing} onPress={() => void shareDocument()} />
          {doc.classificationStatus === 'unclassified' && (
            <ThemedText style={[s.hint, { color: palette.warning }]}>Crie uma classe na aba Classe e classifique este documento.</ThemedText>
          )}
          {doc.classificationStatus === 'processing' && (
            <View style={{ gap: 8 }}>
              <ThemedText style={[s.hint, { color: palette.warning }]}>
                {stuck ? 'O processamento está demorando mais que o esperado. Você pode tentar novamente sem reenviar o arquivo.' : 'Classificação e extração em andamento…'}
              </ThemedText>
              {stuck && reprocessButton}
            </View>
          )}
          {doc.classificationStatus === 'failed' && stuck && reprocessButton}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 120 },
  hint: { textAlign: 'center', fontSize: 13 },
  frame: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 0.72 },
  pdf: { height: 520 },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 36, paddingHorizontal: 16 },
});
