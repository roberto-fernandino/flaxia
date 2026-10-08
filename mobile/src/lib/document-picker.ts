import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { scanDocument } from '@/components/document-scanner';

export type PickedDocument = { uri: string; name: string; mimeType: string };

const mime = (value?: string | null) => value || 'application/pdf';

export async function pickDocument(): Promise<PickedDocument | undefined> {
  return new Promise((resolve) => {
    Alert.alert('Adicionar documento', 'Escolha a origem', [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(undefined) },
      { text: 'Arquivos', onPress: async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
        if (!result.canceled) { const item = result.assets[0]; resolve({ uri: item.uri, name: item.name, mimeType: mime(item.mimeType) }); } else resolve(undefined);
      } },
      { text: 'Fotos', onPress: async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { Alert.alert('Permissão necessária', 'Permita acesso às Fotos para escolher um documento.'); return resolve(undefined); }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
        if (!result.canceled) { const item = result.assets[0]; resolve({ uri: item.uri, name: item.fileName || `foto-${Date.now()}.jpg`, mimeType: mime(item.mimeType || 'image/jpeg') }); } else resolve(undefined);
      } },
      { text: 'Câmera', onPress: async () => {
        const scanned = await scanDocument();
        if (scanned.error) Alert.alert('Não foi possível digitalizar', scanned.error);
        resolve(scanned.file && { uri: scanned.file.uri, name: scanned.file.name, mimeType: scanned.file.mimeType });
      } },
    ]);
  });
}

export async function pickDocuments(): Promise<PickedDocument[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  return result.assets.map((item) => ({ uri: item.uri, name: item.name, mimeType: mime(item.mimeType) }));
}
