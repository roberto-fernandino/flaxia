import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type Item = Record<string, unknown>;
export default function AdminSettingsScreen() {
  const { token } = useAuth(); const [models, setModels] = useState<Item[]>([]); const [limit, setLimit] = useState(''); const [error, setError] = useState<string>(); const [message, setMessage] = useState<string>();
  useEffect(() => { Promise.all([apiRequest<Item>('/users/profile', {}, token ?? undefined), apiRequest<Item>('/admin/models?onlyActive=true&limit=200&offset=0', {}, token ?? undefined), apiRequest<number>('/admin/usage-limits/new-user-pages', {}, token ?? undefined)]).then(([p, m, l]) => { if (!p.data?.is_admin && !p.data?.isAdmin) throw new Error('Acesso administrativo necessário.'); const mData = m.data as Item; setModels((mData.items ?? mData.models ?? []) as Item[]); setLimit(String(l.data ?? '')); }).catch(e => setError(e.message)); }, [token]);
  async function saveLimit() { const value = Number(limit); if (!Number.isFinite(value) || value < 0) return; try { const r = await apiRequest<number>('/admin/usage-limits/new-user-pages', { method: 'PUT', body: JSON.stringify({ limit: value }) }, token ?? undefined); setLimit(String(r.data ?? value)); setMessage(r.message ?? 'Limite atualizado.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao atualizar limite.'); } }
  return <Screen title="Configurações admin"><LoadingOrError loading={!limit && !error} error={error} /><Card><ThemedText type="smallBold">Limite de páginas de novos usuários</ThemedText><TextInput value={limit} onChangeText={setLimit} keyboardType="number-pad" style={styles.input} /><Pressable onPress={saveLimit} style={styles.button}><ThemedText style={styles.white}>Salvar limite</ThemedText></Pressable></Card>{message && <ThemedText>{message}</ThemedText>}<ThemedText type="subtitle">Modelos ativos</ThemedText>{models.map((model, i) => <Card key={String(model.id ?? model.model_id ?? i)}><ThemedText type="smallBold">{String(model.name ?? model.modelName ?? 'Modelo')}</ThemedText><ThemedText>{String(model.provider ?? '')}</ThemedText></Card>)}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, padding: 11, backgroundColor: '#fff' }, button: { marginTop: 10, padding: 13, borderRadius: 9, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
