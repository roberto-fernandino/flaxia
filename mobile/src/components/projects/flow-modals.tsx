import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { PickedFile, pickProjectFile } from './pick-file';
import { Button, Sheet, palette, useProjectColors } from './ui';

export function ExistingClassMatchModal({
  visible,
  className,
  isLinkedToProject,
  advice,
  usedInProjects,
  onUseExisting,
  onCreateNew,
  onCancel,
}: {
  visible: boolean;
  className: string;
  isLinkedToProject: boolean;
  advice?: string;
  usedInProjects?: string[];
  onUseExisting: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}) {
  const c = useProjectColors();
  const message = isLinkedToProject
    ? `Este documento parece ser "${className}", que já está vinculada a este projeto. Usar essa classe ou criar uma nova com IA?`
    : `Este documento parece ser "${className}", já usada na sua empresa (${(usedInProjects ?? []).join(', ') || '—'}). Reutilizar neste projeto ou criar uma nova classe com IA?`;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={[s.dialog, { backgroundColor: c.surface }]}>
          <ThemedText type="smallBold" style={{ fontSize: 17, color: c.text }}>Classe existente detectada</ThemedText>
          <ThemedText style={{ fontSize: 14, color: c.text }}>{message}</ThemedText>
          {!!advice && (
            <View style={[s.advice, { backgroundColor: c.selectedBg }]}>
              <ThemedText style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: palette.primary }}>✨ Recomendação da IA</ThemedText>
              <ThemedText style={{ fontSize: 13, color: c.text }}>{advice}</ThemedText>
            </View>
          )}
          <Button label="Usar classe existente" onPress={onUseExisting} />
          <Button variant="secondary" label="Criar nova classe com IA" onPress={onCreateNew} />
          <Button variant="ghost" label="Cancelar" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function AutoCreateClassSheet({ visible, onClose, onStartFlow, disabled, onError }: { visible: boolean; onClose: () => void; onStartFlow: (file: PickedFile) => void; disabled: boolean; onError: (m: string) => void }) {
  const c = useProjectColors();
  const [file, setFile] = useState<PickedFile | null>(null);
  useEffect(() => {
    if (!visible) setFile(null);
  }, [visible]);

  const pick = async (source: 'files' | 'camera') => {
    const result = await pickProjectFile(source);
    if (result.error) onError(result.error);
    else if (result.file) setFile(result.file);
  };

  return (
    <Sheet
      visible={visible}
      title="Criar classe com IA"
      subtitle="Recomendado: envie um documento de exemplo. A IA detecta os campos e configura a classe para ajudar o modelo classificador a fazer um trabalho melhor."
      onClose={onClose}
      closeDisabled={disabled}
      footer={<Button variant="secondary" label="Cancelar" disabled={disabled} onPress={onClose} />}>
      {!file ? (
        <View style={{ gap: 10 }}>
          <Pressable onPress={() => void pick('files')} style={[s.drop, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
            <ThemedText style={{ fontSize: 28 }}>📄</ThemedText>
            <ThemedText type="smallBold" style={{ color: c.text }}>Selecionar arquivo</ThemedText>
            <ThemedText style={{ fontSize: 12, color: c.textMuted }}>PDF, PNG, JPG, WEBP ou GIF</ThemedText>
          </Pressable>
          <Button variant="secondary" icon="📷" label="Tirar foto" onPress={() => void pick('camera')} />
        </View>
      ) : (
        <View style={[s.fileCard, { borderColor: c.border }]}>
          <ThemedText style={{ fontSize: 24 }}>{file.mimeType.includes('pdf') ? '📄' : '🖼'}</ThemedText>
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" numberOfLines={1} style={{ color: c.text }}>{file.name}</ThemedText>
            {file.size != null && <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{(file.size / 1024).toFixed(0)} KB</ThemedText>}
          </View>
          <Pressable onPress={() => setFile(null)} hitSlop={8} accessibilityLabel="Remover arquivo"><ThemedText style={{ color: palette.danger }}>✕</ThemedText></Pressable>
        </View>
      )}
      {file && (
        <Button
          icon="✨"
          label="Criar classe"
          disabled={disabled}
          onPress={() => {
            onStartFlow(file);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  dialog: { borderRadius: 16, padding: 20, gap: 12 },
  advice: { borderRadius: 10, padding: 12, gap: 4 },
  drop: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 32, alignItems: 'center', gap: 6 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, padding: 12 },
});
