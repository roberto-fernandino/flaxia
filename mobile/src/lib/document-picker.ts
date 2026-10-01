import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

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
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { Alert.alert('Permissão necessária', 'Permita acesso à câmera para fotografar um documento.'); return resolve(undefined); }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
        if (!result.canceled) { const item = result.assets[0]; resolve({ uri: item.uri, name: `camera-${Date.now()}.jpg`, mimeType: mime(item.mimeType || 'image/jpeg') }); } else resolve(undefined);
      } },
    ]);
  });
}

export async function pickDocuments(): Promise<PickedDocument[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  return result.assets.map((item) => ({ uri: item.uri, name: item.name, mimeType: mime(item.mimeType) }));
}
