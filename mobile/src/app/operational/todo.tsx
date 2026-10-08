import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Field, FilterChip, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';

type Item = Record<string, unknown>;
type Saved = Item & { filters?: Record<string, unknown> };
const views = ['pending', 'finished', 'rejected'] as const;

export default function OperationalTodoScreen() {
  const { token } = useAuth();
  const theme = useTheme();
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
  async function claim(item: Item) { const job = item.job as Item | undefined; const id = String(job?.process_job_id ?? job?.processJobId ?? ''); if (!id) return; try { await apiRequest(`/engine/processing_jobs/${id}/lock`, { method: 'POST' }, token ?? undefined); router.push(`/todo/job/${id}?tab=validation`); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Este job já foi assumido por outro usuário.'); void load(); } }
  async function saveQuery() { if (!queryName.trim()) return; try { const filters = { search, workStatus, view }; if (selected) await apiRequest(`/operational/todo/saved-queries/${selected}`, { method: 'PUT', body: JSON.stringify({ name: queryName.trim(), filters }) }, token ?? undefined); else { const result = await apiRequest<Saved>('/operational/todo/saved-queries', { method: 'POST', body: JSON.stringify({ name: queryName.trim(), filters }) }, token ?? undefined); setSelected(String(result.data?.saved_query_id ?? result.data?.savedQueryId ?? '')); } setMessage('Consulta salva.'); setQueryName(''); await loadSaved(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Falha ao salvar consulta.'); } }
  async function removeQuery(id: string) { try { await apiRequest(`/operational/todo/saved-queries/${id}`, { method: 'DELETE' }, token ?? undefined); if (selected === id) setSelected(undefined); await loadSaved(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Falha ao remover consulta.'); } }
  function selectQuery(query: Saved) { const filters = query.filters ?? {}; setSelected(String(query.saved_query_id ?? query.savedQueryId ?? '')); setSearch(String(filters.search ?? '')); setWorkStatus(String(filters.workStatus ?? 'all')); setView((filters.view as typeof view) ?? 'pending'); }
  return <Screen title="A fazer"><ThemedText>Fila de validações, tarefas pendentes e prazos de SLA.</ThemedText><View style={styles.row}>{views.map((item) => <FilterChip key={item} active={view === item} onPress={() => setView(item)} label={item === 'pending' ? 'Pendentes' : item === 'finished' ? 'Concluídos' : 'Rejeitados'} />)}</View>{view === 'pending' && <View style={styles.row}>{(['all', 'available', 'in_progress'] as const).map((item) => <FilterChip key={item} active={workStatus === item} onPress={() => setWorkStatus(item)} label={item === 'all' ? 'Todos' : item === 'available' ? 'Disponíveis' : 'Em andamento'} />)}</View>}<Field value={search} onChangeText={setSearch} onSubmitEditing={() => void load()} placeholder="Buscar por arquivo, classe ou conteúdo" returnKeyType="search" /><Pressable onPress={() => void load()} style={styles.button}><ThemedText style={styles.white}>Atualizar fila</ThemedText></Pressable>{message && <ThemedText style={{ color: theme.danger }}>{message}</ThemedText>}<LoadingOrError loading={loading} error={error} />{!loading && items.length === 0 && !error && <Card><ThemedText type="smallBold">Nenhuma tarefa encontrada</ThemedText><ThemedText>Quando houver documentos para validar, eles aparecerão aqui.</ThemedText></Card>}{items.map((item, index) => { const job = item.job as Item | undefined; const id = String(job?.process_job_id ?? job?.processJobId ?? index); const locked = Boolean(item.locked_by_user_id ?? item.lockedByUserId); const due = item.due_date ?? item.dueDate ?? item.deadline; const canValidate = view === 'pending' && !locked; return <Card key={id}><ThemedText type="smallBold">{String(job?.file_name ?? job?.fileName ?? item.document_name ?? 'Documento')}</ThemedText><ThemedText>Status: {String(job?.status ?? view)}</ThemedText><ThemedText>SLA: {due ? String(due) : 'Sem prazo definido'}</ThemedText>{item.locked_by_name || item.lockedByName ? <ThemedText>Responsável: {String(item.locked_by_name ?? item.lockedByName)}</ThemedText> : null}{canValidate ? <Pressable onPress={() => void claim(item)} style={styles.button}><ThemedText style={styles.white}>Assumir e validar</ThemedText></Pressable> : locked && view === 'pending' ? <ThemedText style={styles.muted}>Em andamento por {String(item.locked_by_name ?? item.lockedByName ?? 'outro usuário')}</ThemedText> : <ThemedText style={styles.muted}>Sem ações disponíveis</ThemedText>}</Card>; })}<Card><ThemedText type="smallBold">Minhas consultas</ThemedText><Field value={queryName} onChangeText={setQueryName} placeholder="Nome da consulta atual" /><Pressable onPress={() => void saveQuery()} style={[styles.secondary, { backgroundColor: theme.secondary, borderColor: theme.border }]}><ThemedText style={styles.secondaryLabel}>Salvar filtros atuais</ThemedText></Pressable>{saved.map((query, index) => { const id = String(query.saved_query_id ?? query.savedQueryId ?? index); return <View key={id} style={styles.saved}><Pressable onPress={() => selectQuery(query)}><ThemedText type="linkPrimary">{String(query.name ?? 'Consulta')}</ThemedText></Pressable><Pressable onPress={() => void removeQuery(id)}><ThemedText style={{ color: theme.danger }}>Excluir</ThemedText></Pressable></View>; })}</Card></Screen>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { padding: 12, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, secondary: { padding: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' }, secondaryLabel: { fontWeight: '700' }, white: { color: '#fff', fontWeight: '700' }, muted: { opacity: 0.65 }, saved: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 7 } });
