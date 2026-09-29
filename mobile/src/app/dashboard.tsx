import { useEffect, useState } from 'react';
import { Screen, Card, LoadingOrError } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

export default function DashboardScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Record<string, unknown>>('/engine/processing_jobs_analytics', {}, token ?? undefined).then(r => setData((r.data ?? {}) as Record<string, unknown>)).catch(e => setError(e.message)); }, [token]);
  return <Screen title="Dashboard"><LoadingOrError loading={!data && !error} error={error} />{data && <>
    <Card><ThemedText type="small">Total de jobs</ThemedText><ThemedText type="subtitle">{String(data.total_jobs ?? data.totalJobs ?? 0)}</ThemedText></Card>
    <Card><ThemedText type="small">Jobs concluídos</ThemedText><ThemedText type="subtitle">{String(data.completed_jobs ?? data.completedJobs ?? 0)}</ThemedText></Card>
    <Card><ThemedText type="small">Páginas processadas</ThemedText><ThemedText type="subtitle">{String(data.total_pages_processed ?? data.totalPagesProcessed ?? 0)}</ThemedText></Card>
  </>}</Screen>;
}
