import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type Data = Record<string, unknown>;
export default function AnalyticsScreen() {
  const { token } = useAuth(); const [data, setData] = useState<Data>(); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Data>('/users/profile', {}, token ?? undefined).then(async (p) => { const company = p.data?.company as Data | undefined; const id = company?.company_id ?? company?.companyId; if (!id) throw new Error('Usuário sem empresa.'); const today = new Date(); const from = new Date(today); from.setDate(today.getDate() - 30); const query = `from=${from.toISOString().slice(0, 10)}&to=${today.toISOString().slice(0, 10)}`; const r = await apiRequest<Data>(`/users/company/${id}/analytics/dashboard?${query}`, {}, token ?? undefined); setData(r.data); }).catch(e => setError(e.message)); }, [token]);
  const scalarMetrics = data ? Object.entries(data).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)) : [];
  const collections: [string, unknown[]][] = data ? Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value as unknown[]]) : [];
  return <Screen title="Analytics"><LoadingOrError loading={!data && !error} error={error} />{data && <><Card><ThemedText type="smallBold">Período</ThemedText><ThemedText>Últimos 30 dias</ThemedText></Card><ThemedText type="subtitle">Indicadores da empresa</ThemedText>{scalarMetrics.map(([key, value]) => <Card key={key}><ThemedText type="small">{key.replaceAll('_', ' ')}</ThemedText><ThemedText type="subtitle">{String(value)}</ThemedText></Card>)}{collections.map(([key, value]) => <Card key={key}><ThemedText type="smallBold">{key.replaceAll('_', ' ')}</ThemedText><ThemedText>{value.length} registros</ThemedText>{value.slice(0, 5).map((entry: unknown, index: number) => <ThemedText key={index}>{typeof entry === 'object' ? Object.entries((entry ?? {}) as Record<string, unknown>).filter(([, item]) => ['string', 'number'].includes(typeof item)).slice(0, 3).map(([field, item]) => `${field}: ${String(item)}`).join(' · ') : String(entry)}</ThemedText>)}</Card>)}</>}</Screen>;
}
