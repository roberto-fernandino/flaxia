import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { Card, FilterChip, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { apiRequest } from '@/lib/api';

type Analytics = { total_jobs?: number; completed_jobs?: number; failed_jobs?: number; unclassified_jobs?: number; total_pages_processed?: number };
type Job = { processJobId?: string; process_job_id?: string; status?: string; startedAt?: string; started_at?: string; finishedAt?: string; finished_at?: string; pagesCount?: number; pages_count?: number };
type JobsPage = { items?: Job[]; total?: number };
type Filter = 'all' | 'completed' | 'processing' | 'failed' | 'rejected';
const filters: Filter[] = ['all', 'completed', 'processing', 'failed', 'rejected'];
const labels: Record<Filter, string> = { all: 'Todos', completed: 'Concluídos', processing: 'Processando', failed: 'Falhos', rejected: 'Rejeitados' };
function payload<T>(response: { data?: T }): T | undefined { return response.data; }
function formatDate(date?: string) { return date ? new Date(date).toLocaleString() : '-'; }
function statusColor(status?: string) { if (status === 'completed') return '#15803d'; if (status === 'failed' || status === 'rejected') return '#b91c1c'; return '#a16207'; }

export default function DashboardScreen() {
  const { token } = useAuth();
  const theme = useTheme();
  const [analytics, setAnalytics] = useState<Analytics>(); const [jobs, setJobs] = useState<JobsPage>();
  const [filter, setFilter] = useState<Filter>('all'); const [page, setPage] = useState(0); const [loading, setLoading] = useState(true); const [jobsLoading, setJobsLoading] = useState(true); const [error, setError] = useState<string>();
  useEffect(() => { if (!token) return; setLoading(true); apiRequest<Analytics>('/engine/processing_jobs_analytics', {}, token).then(response => setAnalytics(payload(response))).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.')).finally(() => setLoading(false)); }, [token]);
  useEffect(() => { if (!token) return; setJobsLoading(true); const query = new URLSearchParams({ page: String(page), pageSize: '10' }); if (filter !== 'all') query.set('status', filter); apiRequest<JobsPage>(`/engine/processing_jobs?${query.toString()}`, {}, token).then(response => setJobs(payload(response))).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível carregar os jobs.')).finally(() => setJobsLoading(false)); }, [filter, page, token]);
  const totalPages = Math.max(1, Math.ceil((jobs?.total ?? 0) / 10)); const items = useMemo(() => jobs?.items ?? [], [jobs]);
  if (!token) return null;
  return <Screen title="Dashboard">
    {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
    <ThemedText type="smallBold">Visão geral do processamento</ThemedText>
    {loading ? <ActivityIndicator color="#0891b2" /> : <View style={styles.metrics}><Metric label="Total de jobs" description="Jobs processados" value={analytics?.total_jobs ?? 0} color="#92704a" /><Metric label="Total de arquivos" description="Arquivos processados" value={analytics?.total_jobs ?? 0} color="#8b5cf6" /><Metric label="Jobs concluídos" description="Concluídos com sucesso" value={analytics?.completed_jobs ?? 0} color="#16a34a" /><Metric label="Páginas processadas" description="Total analisado" value={analytics?.total_pages_processed ?? 0} color="#2563eb" /><Metric label="Jobs falhos" description="Jobs com erros" value={analytics?.failed_jobs ?? 0} color="#dc2626" /><Metric label="Não classificados" description="Sem classe correspondente" value={analytics?.unclassified_jobs ?? 0} color="#d97706" /></View>}
    <ThemedText type="smallBold">Processamentos recentes</ThemedText>
    <View style={styles.filters}>{filters.map(item => <FilterChip key={item} label={labels[item]} active={filter === item} onPress={() => { setFilter(item); setPage(0); }} />)}</View>
    {jobsLoading ? <ActivityIndicator color="#0891b2" /> : items.length === 0 ? <Card><ThemedText>Nenhum job encontrado.</ThemedText></Card> : items.map((job, index) => { const id = job.processJobId ?? job.process_job_id ?? String(index); const started = job.startedAt ?? job.started_at; const finished = job.finishedAt ?? job.finished_at; const pages = job.pagesCount ?? job.pages_count ?? 0; return <Link key={`${id}-${index}`} href={{ pathname: '/dashboard/job/[id]', params: { id: String(id), tab: 'validation' } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Abrir validação do job ${id}`}><Card><View style={styles.jobHeader}><ThemedText style={{ color: statusColor(job.status), fontWeight: '700' }}>{job.status ?? 'processing'}</ThemedText><ThemedText style={styles.jobId}>Job {id}</ThemedText></View><ThemedText style={styles.muted}>Início: {formatDate(started)}</ThemedText><ThemedText style={styles.muted}>Fim: {formatDate(finished)} · Páginas: {pages}</ThemedText><View pointerEvents="none" style={styles.viewButton}><ThemedText style={styles.viewText}>Ver resultado</ThemedText></View></Card></Pressable></Link>; })}
    {totalPages > 1 && <View style={styles.pagination}><ThemedText>Página {page + 1} de {totalPages}</ThemedText><View style={styles.paginationButtons}><Pressable disabled={page === 0} onPress={() => setPage(current => Math.max(0, current - 1))}><ThemedText type="linkPrimary">Anterior</ThemedText></Pressable><Pressable disabled={page >= totalPages - 1} onPress={() => setPage(current => Math.min(totalPages - 1, current + 1))}><ThemedText type="linkPrimary">Próxima</ThemedText></Pressable></View></View>}
  </Screen>;
}
function Metric({ label, description, value, color }: { label: string; description: string; value: number; color: string }) { return <Card><View style={[styles.metricAccent, { borderLeftColor: color }]}><View style={styles.metricCopy}><ThemedText type="smallBold">{label}</ThemedText><ThemedText style={styles.muted}>{description}</ThemedText></View><ThemedText type="subtitle" style={{ color }}>{String(value)}</ThemedText></View></Card>; }
const styles = StyleSheet.create({ metrics: { gap: 10 }, metricAccent: { borderLeftWidth: 4, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, metricCopy: { flex: 1, gap: 3 }, muted: { opacity: 0.68, fontSize: 13 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, jobHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' }, jobId: { flex: 1, opacity: 0.7 }, viewButton: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 8, backgroundColor: '#0891b2', paddingHorizontal: 12, paddingVertical: 9 }, viewText: { color: '#fff', fontWeight: '700' }, pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, paginationButtons: { flexDirection: 'row', gap: 18 } });
