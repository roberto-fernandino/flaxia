import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ClassDraft, ExportTarget } from '@/lib/projects';
import { FieldsEditor } from './fields-editor';
import { Button, Checkbox, Input, Sheet, palette, useProjectColors } from './ui';

const STEPS = ['Básico', 'Campos', 'Exportação', 'Revisão'] as const;
const EXPORT_TARGETS: { value: ExportTarget; label: string; description: string }[] = [
  { value: 'webhook', label: 'Webhook', description: 'Envia os resultados para os webhooks configurados' },
];

const emptyDraft = (): ClassDraft => ({ documentType: '', displayName: '', description: '', fields: [], exportTargets: [] });

export function ClassCreateWizard({ visible, onCancel, onSave, isSaving }: { visible: boolean; onCancel: () => void; onSave: (d: ClassDraft) => Promise<void>; isSaving: boolean }) {
  const c = useProjectColors();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ClassDraft>(emptyDraft);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      setDraft(emptyDraft());
    }
  }, [visible]);

  const canNext = step === 0 ? draft.displayName.trim().length > 0 && draft.documentType.trim().length > 0 : step === 1 ? draft.fields.length > 0 : true;

  const footer = (
    <>
      {step > 0 ? <Button variant="secondary" label="← Voltar" onPress={() => setStep((v) => v - 1)} /> : <Button variant="ghost" label="Cancelar" onPress={onCancel} />}
      <View style={{ flex: 1 }} />
      {step < STEPS.length - 1 ? (
        <Button label="Próximo →" disabled={!canNext} onPress={() => setStep((v) => v + 1)} />
      ) : (
        <Button variant="success" label={isSaving ? 'Salvando…' : '✓ Criar classe'} loading={isSaving} onPress={() => void onSave(draft)} />
      )}
    </>
  );

  return (
    <Sheet visible={visible} title="Nova classe" subtitle={`${STEPS[step]} · Etapa ${step + 1} de ${STEPS.length}`} onClose={onCancel} closeDisabled={isSaving} footer={footer}>
      <View style={s.stepper}>
        {STEPS.map((label, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <Fragment key={label}>
              <Pressable disabled={i >= step} onPress={() => setStep(i)} style={[s.step, { opacity: i > step ? 0.4 : 1 }]}>
                <View style={[s.dot, { borderColor: active ? palette.primary : done ? palette.success : c.border, backgroundColor: active ? palette.primary : done ? palette.success : 'transparent' }]}>
                  <ThemedText style={{ color: active || done ? '#fff' : c.textMuted, fontSize: 11, fontWeight: '700' }}>{done ? '✓' : i + 1}</ThemedText>
                </View>
                <ThemedText numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', color: active ? palette.primary : c.textMuted }}>{label}</ThemedText>
              </Pressable>
              {i < STEPS.length - 1 && <View style={[s.line, { backgroundColor: i < step ? palette.success : c.border }]} />}
            </Fragment>
          );
        })}
      </View>

      {step === 0 && (
        <>
          <Input
            label="Tipo do documento"
            value={draft.documentType}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="invoice_brazil"
            onChangeText={(value) => {
              const documentType = value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_+/g, '_');
              setDraft((d) => ({
                ...d,
                documentType,
                displayName: d.displayName || documentType.replace(/_/g, ' ').trim().replace(/\b\w/g, (ch) => ch.toUpperCase()),
              }));
            }}
          />
          <Input label="Nome de exibição" value={draft.displayName} placeholder="ex.: Nota Fiscal de Serviço" onChangeText={(v) => setDraft((d) => ({ ...d, displayName: v }))} />
          <Input label="Descrição" value={draft.description} multiline placeholder="Ajuda o classificador a reconhecer este tipo…" onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))} />
        </>
      )}

      {step === 1 && (
        <>
          <View style={s.rowBetween}>
            <ThemedText type="smallBold" style={{ color: c.text }}>Campos</ThemedText>
            <View style={[s.pill, { backgroundColor: c.surfaceAlt }]}><ThemedText style={{ fontSize: 11, color: c.textMuted }}>{draft.fields.length}</ThemedText></View>
          </View>
          <FieldsEditor fields={draft.fields} onChange={(fields) => setDraft((d) => ({ ...d, fields }))} />
        </>
      )}

      {step === 2 &&
        EXPORT_TARGETS.map((target) => (
          <Checkbox
            key={target.value}
            checked={draft.exportTargets.includes(target.value)}
            onPress={() =>
              setDraft((d) => ({
                ...d,
                exportTargets: d.exportTargets.includes(target.value) ? d.exportTargets.filter((t) => t !== target.value) : [...d.exportTargets, target.value],
              }))
            }>
            <ThemedText type="smallBold" style={{ color: c.text }}>{target.label}</ThemedText>
            <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{target.description}</ThemedText>
          </Checkbox>
        ))}

      {step === 3 && (
        <>
          <View style={[s.review, { borderColor: '#a7f3d0', backgroundColor: c.dark ? 'rgba(5,150,105,0.15)' : '#ecfdf5' }]}>
            <ThemedText type="smallBold" style={{ color: c.text }}>✓ {draft.displayName || '—'}</ThemedText>
            <ThemedText style={{ fontFamily: 'monospace', fontSize: 11, color: c.textMuted }}>{draft.documentType || '—'}</ThemedText>
            {!!draft.description && <ThemedText style={{ fontSize: 13, color: c.text }}>{draft.description}</ThemedText>}
          </View>
          <View style={[s.review, { borderColor: c.border }]}>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: c.textMuted }}>Campos</ThemedText>
            <ThemedText type="smallBold" style={{ color: c.text }}>{draft.fields.length} campos</ThemedText>
          </View>
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  line: { height: 1, width: 10, marginBottom: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  review: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
});
