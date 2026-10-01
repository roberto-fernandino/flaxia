import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { MAX_UPLOAD_BYTES, SUPPORTED_MIME_TYPES } from '@/lib/projects';

export type PickedFile = { name: string; uri: string; mimeType: string; size?: number };

function mimeFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

function validate(file: PickedFile): string | undefined {
  if (!SUPPORTED_MIME_TYPES.some((t) => file.mimeType.toLowerCase().includes(t.split('/')[1]))) return 'Tipo de arquivo não suportado';
  if (file.size != null && file.size > MAX_UPLOAD_BYTES) return `Envio excede o limite de ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`;
}

export type FileSource = 'files' | 'photos' | 'camera';

/** Seleciona um único documento (arquivos, fotos ou câmera), com as mesmas validações do web. */
export async function pickProjectFile(source: FileSource): Promise<{ file?: PickedFile; error?: string }> {
  let file: PickedFile | undefined;
  if (source === 'photos') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { error: 'Permissão de acesso às fotos negada.' };
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return {};
    const asset = result.assets[0];
    const name = asset.fileName ?? `foto-${Date.now()}.jpg`;
    file = { name, uri: asset.uri, mimeType: asset.mimeType ?? mimeFromName(name), size: asset.fileSize };
  } else if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: 'Permissão de câmera negada.' };
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return {};
    const asset = result.assets[0];
    const name = asset.fileName ?? `foto-${Date.now()}.jpg`;
    file = { name, uri: asset.uri, mimeType: asset.mimeType ?? mimeFromName(name), size: asset.fileSize };
  } else {
    const result = await DocumentPicker.getDocumentAsync({ type: SUPPORTED_MIME_TYPES, multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return {};
    const asset = result.assets[0];
    file = { name: asset.name, uri: asset.uri, mimeType: asset.mimeType ?? mimeFromName(asset.name), size: asset.size };
  }
  const error = validate(file);
  return error ? { error } : { file };
}

export const readBase64 = (file: PickedFile) => new File(file.uri).base64();
