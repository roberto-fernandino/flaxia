import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type Item = Record<string, unknown>;
export default function AdminBillingScreen() {
  const { token } = useAuth(); const [items, setItems] = useState<Item[]>([]); const [email, setEmail] = useState(''); const [error, setError] = useState<string>(); const [message, setMessage] = useState<string>();
  const load = useCallback(() => apiRequest<Item>('/admin/billing/monthly-report-recipients', {}, token ?? undefined).then(r => { const data = r.data as Item; setItems((data.items ?? data.recipients ?? r.data ?? []) as Item[]); }).catch(e => setError(e.message)), [token]);
  useEffect(() => { apiRequest<Item>('/users/profile', {}, token ?? undefined).then(p => { if (!p.data?.is_admin && !p.data?.isAdmin) throw new Error('Acesso administrativo necessário.'); return load(); }).catch(e => setError(e.message)); }, [token, load]);
  async function add() { if (!email.trim()) return; try { await apiRequest('/admin/billing/monthly-report-recipients', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }, token ?? undefined); setEmail(''); setMessage('Destinatário adicionado.'); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao adicionar.'); } }
  async function remove(id: string) { try { await apiRequest(`/admin/billing/monthly-report-recipients/${id}`, { method: 'DELETE' }, token ?? undefined); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao remover.'); } }
  return <Screen title="Billing"><TextInput value={email} onChangeText={setEmail} placeholder="E-mail do relatório mensal" keyboardType="email-address" autoCapitalize="none" style={styles.input} /><Pressable onPress={add} style={styles.button}><ThemedText style={styles.white}>Adicionar destinatário</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}<LoadingOrError loading={!items.length && !error} error={error} />{items.map((item, i) => { const id = String(item.recipient_id ?? item.recipientId ?? i); return <Card key={id}><ThemedText type="smallBold">{String(item.email ?? '')}</ThemedText><Pressable onPress={() => remove(id)}><ThemedText style={styles.danger}>Remover</ThemedText></Pressable></Card>; })}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, padding: 11, backgroundColor: '#fff' }, button: { padding: 13, borderRadius: 9, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' }, danger: { color: '#b91c1c', fontWeight: '700' } });
