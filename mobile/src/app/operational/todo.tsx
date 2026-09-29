import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';

type Item = Record<string, unknown>;
type Saved = Item & { filters?: Record<string, unknown> };
const views = ['pending', 'finished', 'rejected'] as const;

export default function OperationalTodoScreen() {
  const { token } = useAuth();
  const [view, setView] = useState<(typeof views)[number]>('pending');
  const [workStatus, setWorkStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [selected, setSelected] = useState<string>();
  const [queryName, setQueryName] = useState('');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(true);

  async function loadSaved() { const result = await apiRequest<Saved[]>('/operational/todo/saved-queries', {}, token ?? undefined); setSaved(result.data ?? []); }
  async function load() { setLoading(true); setError(undefined); try { const params = new URLSearchParams({ page: '0', pageSize: '25', view }); if (workStatus !== 'all') params.set('workStatus', workStatus); if (search.trim()) params.set('search', search.trim()); const result = await apiRequest<{ items?: Item[] }>(`/operational/todo/validations?${params}`, {}, token ?? undefined); setItems(result.data?.items ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar a fila.'); } finally { setLoading(false); } }
  // These loaders intentionally capture the current auth token and filters for each request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadSaved().catch(() => undefined); }, [token]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [token, view, workStatus]);
  async function claim(item: Item) { const job = item.job as Item | undefined; const id = String(job?.process_job_id ?? job?.processJobId ?? ''); if (!id) return; try { await apiRequest(`/engine/processing_jobs/${id}/lock`, { method: 'POST' }, token ?? undefined); router.push(`/operational/process/result/${id}?from=todo`); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Este job já foi assumido por outro usuário.'); void load(); } }
  async function saveQuery() { if (!queryName.trim()) return; try { const filters = { search, workStatus, view }; if (selected) await apiRequest(`/operational/todo/saved-queries/${selected}`, { method: 'PUT', body: JSON.stringify({ name: queryName.trim(), filters }) }, token ?? undefined); else { const result = await apiRequest<Saved>('/operational/todo/saved-queries', { method: 'POST', body: JSON.stringify({ name: queryName.trim(), filters }) }, token ?? undefined); setSelected(String(result.data?.saved_query_id ?? result.data?.savedQueryId ?? '')); } setMessage('Consulta salva.'); setQueryName(''); await loadSaved(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Falha ao salvar consulta.'); } }
  async function removeQuery(id: string) { try { await apiRequest(`/operational/todo/saved-queries/${id}`, { method: 'DELETE' }, token ?? undefined); if (selected === id) setSelected(undefined); await loadSaved(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Falha ao remover consulta.'); } }
  function selectQuery(query: Saved) { const filters = query.filters ?? {}; setSelected(String(query.saved_query_id ?? query.savedQueryId ?? '')); setSearch(String(filters.search ?? '')); setWorkStatus(String(filters.workStatus ?? 'all')); setView((filters.view as typeof view) ?? 'pending'); }
  return <Screen title="To Do"><ThemedText>Fila operacional de validações e tarefas pendentes.</ThemedText><View style={styles.row}>{views.map((item) => <Pressable key={item} onPress={() => setView(item)} style={[styles.chip, view === item && styles.active]}><ThemedText>{item === 'pending' ? 'Pendentes' : item === 'finished' ? 'Concluídos' : 'Rejeitados'}</ThemedText></Pressable>)}</View><View style={styles.row}>{['all', 'available', 'in_progress'].map((item) => <Pressable key={item} onPress={() => setWorkStatus(item)} style={[styles.chip, workStatus === item && styles.active]}><ThemedText>{item === 'all' ? 'Todos' : item === 'available' ? 'Disponíveis' : 'Em andamento'}</ThemedText></Pressable>)}</View><TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => void load()} placeholder="Buscar por arquivo" style={styles.input} /><Pressable onPress={() => void load()} style={styles.button}><ThemedText style={styles.white}>Atualizar fila</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}<LoadingOrError loading={loading} error={error} />{!loading && items.length === 0 && !error && <ThemedText>Nenhum item encontrado.</ThemedText>}{items.map((item, index) => { const job = item.job as Item | undefined; const id = String(job?.process_job_id ?? job?.processJobId ?? index); const locked = Boolean(item.locked_by_user_id ?? item.lockedByUserId); return <Card key={id}><ThemedText type="smallBold">{String(job?.file_name ?? job?.fileName ?? 'Documento')}</ThemedText><ThemedText>Status: {String(job?.status ?? 'pendente')}</ThemedText>{item.due_date || item.dueDate ? <ThemedText>Prazo: {String(item.due_date ?? item.dueDate)}</ThemedText> : null}<Pressable disabled={locked} onPress={() => void claim(item)} style={styles.button}><ThemedText style={styles.white}>{locked ? `Em andamento por ${String(item.locked_by_name ?? item.lockedByName ?? 'outro usuário')}` : 'Assumir e validar'}</ThemedText></Pressable></Card>; })}<Card><ThemedText type="smallBold">Minhas consultas</ThemedText><TextInput value={queryName} onChangeText={setQueryName} placeholder="Nome da consulta atual" style={styles.input} /><Pressable onPress={() => void saveQuery()} style={styles.secondary}><ThemedText>Salvar filtros atuais</ThemedText></Pressable>{saved.map((query, index) => { const id = String(query.saved_query_id ?? query.savedQueryId ?? index); return <View key={id} style={styles.saved}><Pressable onPress={() => selectQuery(query)}><ThemedText type="linkPrimary">{String(query.name ?? 'Consulta')}</ThemedText></Pressable><Pressable onPress={() => void removeQuery(id)}><ThemedText style={styles.danger}>Excluir</ThemedText></Pressable></View>; })}</Card></Screen>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { padding: 9, borderRadius: 8, backgroundColor: '#e5e7eb' }, active: { backgroundColor: '#bfe8df' }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, button: { padding: 12, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, secondary: { padding: 12, borderRadius: 10, backgroundColor: '#e5e7eb', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' }, danger: { color: '#b91c1c' }, saved: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 } });
