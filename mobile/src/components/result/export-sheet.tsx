import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { View } from 'react-native';
import { Button, Sheet } from '@/components/projects/ui';
import { buildCsv } from '@/lib/engine/exportCsv';

async function shareText(content: string, filename: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

export function ExportSheet({
  visible,
  onClose,
  originalResult,
  modifiedResult,
  hasModifications,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  originalResult: unknown;
  modifiedResult: unknown;
  hasModifications: boolean;
  onError: (m: string) => void;
}) {
  const run = (fn: () => Promise<void>) => () => void fn().catch(() => onError('Falha ao exportar.'));
  const json = (data: unknown, name: string) => run(() => shareText(JSON.stringify(data, null, 2), name, 'application/json'));
  const csv = (data: unknown, name: string) => run(() => shareText(buildCsv(data), name, 'text/csv'));
  return (
    <Sheet visible={visible} title="Exportar Dados" onClose={onClose}>
      <View style={{ gap: 8 }}>
        <Button variant="secondary" icon="⬇︎" label="Exportar JSON Original" onPress={json(originalResult, 'extracted-data-original.json')} />
        <Button variant="secondary" icon="⬇︎" label="Exportar CSV Original" onPress={csv(originalResult, 'extracted-data-original.csv')} />
      </View>
      <View style={{ gap: 8, marginTop: 8 }}>
        <Button icon="⬇︎" label="Exportar JSON Modificado" disabled={!hasModifications} onPress={json(modifiedResult, 'extracted-data-modified.json')} style={{ backgroundColor: '#0891b2' }} />
        <Button icon="⬇︎" label="Exportar CSV Modificado" disabled={!hasModifications} onPress={csv(modifiedResult, 'extracted-data-modified.csv')} style={{ backgroundColor: '#0891b2' }} />
      </View>
    </Sheet>
  );
}
