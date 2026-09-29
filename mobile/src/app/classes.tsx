import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';

type Field = { name: string; description: string };
type DocumentClass = Record<string, unknown> & { fields?: Field[] };

export default function ClassesScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<DocumentClass[]>([]);
  const [selected, setSelected] = useState<DocumentClass | undefined>();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<Field[]>([{ name: '', description: '' }]);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const response = await apiRequest<DocumentClass[]>('/engine/documents', {}, token ?? undefined);
      setItems(response.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar classes.'); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function edit(item?: DocumentClass) {
    setEditing(true);
    setSelected(item);
    setName(String(item?.display_name ?? item?.displayName ?? item?.name ?? ''));
    setDescription(String(item?.description ?? ''));
    setFields(item?.fields?.length ? item.fields : [{ name: '', description: '' }]);
    setMessage(undefined);
  }

  function updateField(index: number, key: keyof Field, value: string) {
    setFields((current) => current.map((field, i) => i === index ? { ...field, [key]: value } : field));
  }

  async function save() {
    if (!name.trim()) { setMessage('Informe o nome da classe.'); return; }
    setSaving(true);
    try {
      const validFields = fields.filter((field) => field.name.trim()).map((field, index) => ({ name: field.name.trim(), description: field.description.trim(), fieldIndex: index }));
      const payload = { documentType: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'), displayName: name.trim(), description: description.trim(), fields: validFields, prompt: null, documentProcessMethod: 1, isValidating: true, exportEnabled: true, exportTargets: [] };
      if (selected) await apiRequest('/engine/update_document', { method: 'PUT', body: JSON.stringify({ ...payload, documentId: selected.document_id ?? selected.documentId }) }, token ?? undefined);
      else await apiRequest('/engine/create_manual_document', { method: 'POST', body: JSON.stringify(payload) }, token ?? undefined);
      setMessage(selected ? 'Classe atualizada.' : 'Classe criada.'); setEditing(false); setSelected(undefined); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao salvar classe.'); }
    finally { setSaving(false); }
  }

  async function remove(item: DocumentClass) {
    const id = item.document_id ?? item.documentId; if (!id) return;
    try { await apiRequest(`/engine/document/${id}`, { method: 'DELETE' }, token ?? undefined); setMessage('Classe excluída.'); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao excluir classe.'); }
  }

  return <Screen title="Classes de documento">
    <Pressable onPress={() => edit()} style={styles.primary}><ThemedText style={styles.white}>Nova classe</ThemedText></Pressable>
    {message && <ThemedText>{message}</ThemedText>}
    {editing && <Card>
      <ThemedText type="subtitle">{selected ? 'Editar classe' : 'Nova classe'}</ThemedText>
      <TextInput value={name} onChangeText={setName} placeholder="Nome da classe" style={styles.input} />
      <TextInput value={description} onChangeText={setDescription} placeholder="Descrição" style={styles.input} multiline />
      <ThemedText type="smallBold">Campos extraídos</ThemedText>
      {fields.map((field, index) => <View key={index} style={styles.fieldRow}>
        <TextInput value={field.name} onChangeText={(value) => updateField(index, 'name', value)} placeholder="Nome do campo" style={styles.input} />
        <TextInput value={field.description} onChangeText={(value) => updateField(index, 'description', value)} placeholder="Descrição do campo" style={styles.input} />
      </View>)}
      <Pressable onPress={() => setFields((current) => [...current, { name: '', description: '' }])}><ThemedText type="linkPrimary">Adicionar campo</ThemedText></Pressable>
      <Pressable disabled={saving} onPress={save} style={styles.primary}><ThemedText style={styles.white}>{saving ? 'Salvando...' : 'Salvar'}</ThemedText></Pressable>
      <Pressable onPress={() => { setEditing(false); setSelected(undefined); }}><ThemedText type="linkPrimary">Cancelar</ThemedText></Pressable>
    </Card>}
    <LoadingOrError loading={!items.length && !error} error={error} />
    {items.length === 0 && !error && <ThemedText>Nenhuma classe cadastrada.</ThemedText>}
    {items.map((item, index) => <Card key={String(item.document_id ?? item.documentId ?? index)}>
      <ThemedText type="smallBold">{String(item.display_name ?? item.displayName ?? item.name ?? 'Classe')}</ThemedText>
      <ThemedText>{String(item.description ?? 'Sem descrição')}</ThemedText>
      <View style={styles.actions}><Pressable onPress={() => edit(item)}><ThemedText type="linkPrimary">Editar</ThemedText></Pressable><Pressable onPress={() => void remove(item)}><ThemedText style={styles.danger}>Excluir</ThemedText></Pressable></View>
    </Card>)}
  </Screen>;
}

const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, backgroundColor: '#fff', color: '#111827' }, fieldRow: { gap: 8 }, actions: { flexDirection: 'row', justifyContent: 'space-between' }, primary: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' }, danger: { color: '#b91c1c', fontWeight: '700' } });
