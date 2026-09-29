import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

type Series = { key?: string; label?: string; value?: number; costUsd?: number; requests?: number; tokens?: number };
type Summary = { requests: number; succeeded: number; failed: number; pending: number; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; failureRate: number; daily?: Series[]; byOrigin?: Series[]; byModel?: Series[] };

const number = (value: unknown) => new Intl.NumberFormat('pt-BR').format(Number(value ?? 0));
const money = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

export default function AdminUsageScreen() {
  const { token } = useAuth(); const [data, setData] = useState<Summary>(); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Record<string, unknown>>('/users/profile', {}, token ?? undefined).then(async (p) => { if (!p.data?.is_admin && !p.data?.isAdmin) throw new Error('Acesso administrativo necessário.'); const r = await apiRequest<Summary>('/admin/ai-usage/summary', {}, token ?? undefined); setData(r.data); }).catch(e => setError(e instanceof Error ? e.message : 'Falha ao carregar uso de IA.')); }, [token]);
  return <Screen title="Uso de IA"><LoadingOrError loading={!data && !error} error={error} />{data && <>
    <Card><ThemedText type="smallBold">Resumo do período</ThemedText><ThemedText>Requisições: {number(data.requests)}</ThemedText><ThemedText>Sucesso: {number(data.succeeded)} · Falhas: {number(data.failed)} · Pendentes: {number(data.pending)}</ThemedText><ThemedText>Tokens: {number(data.totalTokens)} ({number(data.inputTokens)} entrada / {number(data.outputTokens)} saída)</ThemedText><ThemedText>Custo: {money(data.costUsd)}</ThemedText><ThemedText>Taxa de falha: {(Number(data.failureRate ?? 0) * 100).toFixed(1)}%</ThemedText></Card>
    <Card><ThemedText type="smallBold">Gasto por origem</ThemedText>{(data.byOrigin ?? []).length === 0 ? <ThemedText>Sem dados de origem.</ThemedText> : data.byOrigin?.map((item, index) => <ThemedText key={index}>{String(item.label ?? item.key ?? 'Desconhecida')}: {money(item.costUsd ?? item.value)}</ThemedText>)}</Card>
    <Card><ThemedText type="smallBold">Uso por modelo</ThemedText>{(data.byModel ?? []).length === 0 ? <ThemedText>Sem dados por modelo.</ThemedText> : data.byModel?.map((item, index) => <ThemedText key={index}>{String(item.label ?? item.key ?? 'Desconhecido')}: {number(item.requests)} requisições · {money(item.costUsd ?? item.value)}</ThemedText>)}</Card>
  </>}</Screen>;
}
