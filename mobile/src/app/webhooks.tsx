import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type Hook = Record<string, unknown>;
export default function WebhooksScreen() {
  const { token } = useAuth(); const [hooks, setHooks] = useState<Hook[]>([]); const [url, setUrl] = useState(''); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>();
  const load = useCallback(() => apiRequest<Hook[]>('/engine/webhooks', {}, token ?? undefined).then(r => setHooks(r.data ?? [])).catch(e => setError(e.message)), [token]);
  useEffect(() => { void load(); }, [load]);
  async function create() { if (!url.trim()) return; try { await apiRequest('/engine/webhooks', { method: 'POST', body: JSON.stringify({ url: url.trim(), eventTypes: [] }) }, token ?? undefined); setUrl(''); setMessage('Webhook criado.'); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao criar webhook.'); } }
  async function remove(id: string) { try { await apiRequest(`/engine/webhooks/${id}`, { method: 'DELETE' }, token ?? undefined); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao remover webhook.'); } }
  return <Screen title="Webhooks"><TextInput value={url} onChangeText={setUrl} placeholder="https://seu-endpoint.com/webhook" keyboardType="url" autoCapitalize="none" style={styles.input} /><Pressable onPress={create} style={styles.button}><ThemedText style={styles.white}>Adicionar webhook</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}<LoadingOrError loading={!hooks.length && !error} error={error} />{hooks.map((hook, i) => { const id = String(hook.webhook_id ?? hook.webhookId ?? i); return <Card key={id}><ThemedText type="smallBold">{String(hook.url ?? '')}</ThemedText><ThemedText>{hook.is_active === false || hook.isActive === false ? 'Inativo' : 'Ativo'}</ThemedText><Pressable onPress={() => remove(id)}><ThemedText style={styles.danger}>Remover</ThemedText></Pressable></Card>; })}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, button: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' }, danger: { color: '#b91c1c', fontWeight: '700' } });
