import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, Sheet, useProjectColors } from '@/components/projects/ui';

type ClassOption = { documentId: string; displayName: string };

/**
 * Classe do documento na primeira tela da validação — porta mobile do seletor de
 * `ProcessResultWorkspace` (web): lista só as classes do mesmo projeto; salvar não
 * reprocessa, os valores extraídos são mantidos.
 */
export function DocumentClassControl({
  classes,
  currentDocumentId,
  disabled,
  saving,
  onSave,
}: {
  classes: ClassOption[];
  currentDocumentId: string;
  disabled?: boolean;
  saving?: boolean;
  onSave: (documentId: string) => Promise<boolean>;
}) {
  const c = useProjectColors();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentDocumentId);
  useEffect(() => setSelected(currentDocumentId), [currentDocumentId]);

  const current = classes.find((d) => d.documentId === currentDocumentId);
  const canChange = !disabled && classes.length > 1;
  const close = () => {
    setOpen(false);
    setSelected(currentDocumentId);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Classe do documento"
        disabled={!canChange}
        onPress={() => setOpen(true)}
        style={[s.row, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={{ flex: 1 }}>
          <ThemedText style={{ fontSize: 11, fontWeight: '600', color: c.textMuted }}>Classe do documento</ThemedText>
          <ThemedText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{current?.displayName ?? '—'}</ThemedText>
        </View>
        {canChange && <ThemedText style={{ fontSize: 13, fontWeight: '600', color: c.dark ? '#a5b4fc' : '#4f46e5' }}>Trocar ▾</ThemedText>}
      </Pressable>

      <Sheet
        visible={open}
        title="Classe do documento"
        subtitle="Trocar a classe não reprocessa a extração; os valores atuais são mantidos."
        onClose={close}
        closeDisabled={saving}
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="secondary" label="Cancelar" disabled={saving} onPress={close} style={{ flex: 1 }} />
            <Button
              label={saving ? 'Salvando classe…' : 'Salvar classe'}
              loading={saving}
              disabled={selected === currentDocumentId}
              onPress={() => void onSave(selected).then((ok) => ok && setOpen(false))}
              style={{ flex: 1 }}
            />
          </View>
        }>
        <View style={{ gap: 8 }}>
          {classes.map((d) => {
            const active = d.documentId === selected;
            return (
              <Pressable
                key={d.documentId}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                disabled={saving}
                onPress={() => setSelected(d.documentId)}
                style={[s.option, { borderColor: active ? '#4f46e5' : c.border, backgroundColor: active ? c.selectedBg : c.surface }]}>
                <View style={[s.radio, { borderColor: active ? '#4f46e5' : c.textMuted }]}>{active && <View style={s.radioDot} />}</View>
                <ThemedText style={{ flex: 1, fontSize: 14, color: c.text, fontWeight: active ? '700' : '500' }}>{d.displayName}</ThemedText>
                {d.documentId === currentDocumentId && <ThemedText style={{ fontSize: 11, color: c.textMuted }}>atual</ThemedText>}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4f46e5' },
});
