import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type Item = Record<string, unknown>;
export default function ValidationsScreen() {
  const { token } = useAuth(); const [items, setItems] = useState<Item[]>([]); const [error, setError] = useState<string>(); const [message, setMessage] = useState<string>();
  const load = useCallback(() => apiRequest<{ items?: Item[] }>('/operational/todo/validations?page=0&pageSize=30&view=pending', {}, token ?? undefined).then(r => setItems(r.data?.items ?? [])).catch(e => setError(e.message)), [token]);
  useEffect(() => { void load(); }, [load]);
  async function action(id: string, endpoint: string) { try { await apiRequest(`/engine/processing_jobs/${id}/${endpoint}`, { method: endpoint === 'mark_validated' || endpoint === 'mark_rejected' ? 'PATCH' : 'POST' }, token ?? undefined); await apiRequest(`/engine/processing_jobs/${id}/lock`, { method: 'DELETE' }, token ?? undefined).catch(() => undefined); setMessage(endpoint === 'mark_validated' ? 'Job validado.' : 'Job rejeitado.'); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha na ação.'); } }
  async function openForValidation(id: string) { try { await apiRequest(`/engine/processing_jobs/${id}/lock`, { method: 'POST' }, token ?? undefined); router.push(`/jobs/${id}?tab=validation`); } catch (e) { setMessage(e instanceof Error ? e.message : 'Este job já está sendo validado por outra pessoa.'); } }
  return <Screen title="Validações"><LoadingOrError loading={!items.length && !error} error={error} />{message && <ThemedText>{message}</ThemedText>}{items.length === 0 && !error && <ThemedText>Nenhuma validação pendente.</ThemedText>}{items.map((item, i) => { const id = String(item.process_job_id ?? item.processJobId ?? item.processing_job_id ?? i); return <Card key={id}><ThemedText type="smallBold">{String(item.file_name ?? item.fileName ?? 'Documento')}</ThemedText><ThemedText>{String(item.status ?? 'aguardando validação')}</ThemedText><Pressable onPress={() => void openForValidation(id)}><ThemedText type="linkPrimary">Assumir e abrir resultado</ThemedText></Pressable><Pressable onPress={() => void action(id, 'mark_validated')} style={styles.accept}><ThemedText style={styles.white}>Validar</ThemedText></Pressable><Pressable onPress={() => void action(id, 'mark_rejected')} style={styles.reject}><ThemedText style={styles.white}>Rejeitar</ThemedText></Pressable></Card>; })}</Screen>;
}
const styles = StyleSheet.create({ accept: { padding: 10, backgroundColor: '#15803d', borderRadius: 8, alignItems: 'center' }, reject: { padding: 10, backgroundColor: '#b91c1c', borderRadius: 8, alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
