import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Captura guiada com o mesmo scanner do web (Tungsten/Kofax HTML5 SDK +
 * detecção de página em `public/scanner/` do frontend). A página roda num
 * WebView e devolve o JPEG aceito como data URL via `ReactNativeWebView`.
 */
const FRONTEND_URL = (process.env.EXPO_PUBLIC_FRONTEND_URL ?? 'https://flaxia.com.br').replace(/\/$/, '');
const SCANNER_URL = `${FRONTEND_URL}/scanner/index.html?lang=pt`;
const SCANNER_ORIGIN = new URL(FRONTEND_URL).origin;

export type ScannedFile = { name: string; uri: string; mimeType: string; size?: number };
type Outcome = { file?: ScannedFile; error?: string };

let present: ((resolve: (outcome: Outcome) => void) => void) | null = null;

/** Abre o scanner. Resolve sem arquivo quando o usuário fecha sem capturar. */
export async function scanDocument(): Promise<Outcome> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { error: 'Permissão de câmera negada.' };
  if (!present) return { error: 'Scanner indisponível.' };
  const open = present;
  return new Promise((resolve) => open(resolve));
}

function saveDataUrl(dataUrl: string): ScannedFile {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const name = `scan-${Date.now()}.jpg`;
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  return { name, uri: file.uri, mimeType: 'image/jpeg', size: file.size ?? undefined };
}

/** Montado uma vez na raiz do app; atende chamadas de `scanDocument()`. */
export function DocumentScannerHost() {
  const [resolver, setResolver] = useState<((outcome: Outcome) => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    present = (resolve) => { setLoading(true); setLoadError(false); setResolver(() => resolve); };
    return () => { present = null; };
  }, []);

  const finish = (outcome: Outcome) => { resolver?.(outcome); setResolver(null); };

  const onMessage = (event: WebViewMessageEvent) => {
    if (new URL(event.nativeEvent.url).origin !== SCANNER_ORIGIN) return;
    let message: { type?: string; dataUrl?: unknown };
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (message.type === 'flaxia-scan-close') return finish({});
    if (message.type !== 'flaxia-scan' || typeof message.dataUrl !== 'string' || !message.dataUrl.startsWith('data:image/jpeg;base64,')) return;
    try { finish({ file: saveDataUrl(message.dataUrl) }); } catch { finish({ error: 'Não foi possível salvar o documento digitalizado.' }); }
  };

  return (
    <Modal visible={resolver != null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => finish({})}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>Digitalizar documento</Text>
          <Pressable onPress={() => finish({})} accessibilityRole="button" hitSlop={12} style={s.close}>
            <Text style={s.closeText}>Fechar</Text>
          </Pressable>
        </View>
        {resolver != null && (
          <WebView
            source={{ uri: SCANNER_URL }}
            style={s.web}
            originWhitelist={[SCANNER_ORIGIN]}
            onShouldStartLoadWithRequest={(request) => request.url.startsWith(SCANNER_ORIGIN) || request.url.startsWith('blob:') || request.url.startsWith('data:')}
            onMessage={onMessage}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setLoadError(true); }}
            onHttpError={() => { setLoading(false); setLoadError(true); }}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            allowFileAccess={false}
            setSupportMultipleWindows={false}
          />
        )}
        {loading && !loadError && <View style={s.overlay}><ActivityIndicator color="#fff" /></View>}
        {loadError && (
          <View style={s.overlay}>
            <Text style={s.errorText}>Não foi possível abrir o scanner. Verifique sua conexão.</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  title: { color: '#fff', fontSize: 17, fontWeight: '600' },
  close: { paddingHorizontal: 12, paddingVertical: 6 },
  closeText: { color: '#fff', fontSize: 16 },
  web: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 44, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#fff', textAlign: 'center' },
});
