import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

type KeyItem = Record<string, unknown>;
export default function ApiKeysScreen() {
  const { token } = useAuth(); const [keys, setKeys] = useState<KeyItem[]>([]); const [name, setName] = useState(''); const [message, setMessage] = useState<string>();
  const load = useCallback(() => apiRequest<{ api_keys?: KeyItem[]; apiKeys?: KeyItem[] }>('/users/api-keys', {}, token ?? undefined).then(r => setKeys(r.data?.api_keys ?? r.data?.apiKeys ?? [])).catch(e => setMessage(e.message)), [token]);
  useEffect(() => { void load(); }, [load]);
  async function create() { if (!name.trim()) return; try { const r = await apiRequest<KeyItem>('/users/api-keys', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }, token ?? undefined); setName(''); setMessage(r.message ?? 'Chave criada.'); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao criar chave.'); } }
  async function remove(id: string) { try { await apiRequest('/users/api-keys', { method: 'DELETE', body: JSON.stringify({ apiKeyId: id }) }, token ?? undefined); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao revogar chave.'); } }
  return <Screen title="Chaves de API"><TextInput value={name} onChangeText={setName} placeholder="Nome da chave" style={styles.input} /><Pressable onPress={create} style={styles.primary}><ThemedText style={styles.primaryText}>Criar chave</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}{keys.map((item, i) => { const id = String(item.api_key_id ?? item.apiKeyId ?? i); return <Card key={id}><ThemedText type="smallBold">{String(item.name ?? item.label ?? 'Chave')}</ThemedText><ThemedText>{String(item.masked_key ?? item.maskedKey ?? 'Chave protegida')}</ThemedText><Pressable onPress={() => remove(id)}><ThemedText style={styles.danger}>Revogar</ThemedText></Pressable></Card>; })}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, primary: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, danger: { color: '#b91c1c', fontWeight: '700' } });
