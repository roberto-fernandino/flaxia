import { useEffect, useState } from 'react';
import { Screen, Card, LoadingOrError } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
export default function ClassifiersScreen() {
  const { token } = useAuth(); const [items, setItems] = useState<Record<string, unknown>[]>([]); const [error, setError] = useState<string>(); const [name, setName] = useState(''); const [message, setMessage] = useState<string>();
  useEffect(() => { apiRequest<Record<string, unknown>[]>('/engine/classifiers', {}, token ?? undefined).then(r => setItems(r.data ?? [])).catch(e => setError(e.message)); }, [token]);
  async function create() { if (!name.trim()) return; try { const r = await apiRequest<string>('/engine/classifiers', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }, token ?? undefined); setName(''); setMessage('Classificador criado.'); if (r.data) router.push(`/classifiers/${r.data}`); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao criar.'); } }
  return <Screen title="Classificadores"><TextInput value={name} onChangeText={setName} placeholder="Nome do classificador" style={styles.input} /><Pressable onPress={create} style={styles.primary}><ThemedText style={styles.primaryText}>Criar classificador</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}<LoadingOrError loading={!items.length && !error} error={error} />{items.map((item, i) => { const id = String(item.classifier_id ?? item.classifierId ?? i); return <Pressable key={id} onPress={() => router.push(`/classifiers/${id}`)}><Card><ThemedText type="smallBold">{String(item.name ?? 'Classificador')}</ThemedText><ThemedText>{String(item.models_count ?? item.modelsCount ?? 0)} modelos</ThemedText></Card></Pressable>; })}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, primary: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' } });
