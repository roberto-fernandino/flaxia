import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type Item = Record<string, unknown>;
export default function ActivityScreen() {
  const { token } = useAuth(); const [items, setItems] = useState<Item[]>([]); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Item>('/users/profile', {}, token ?? undefined).then(async (p) => { const c = p.data?.company as Item | undefined; const id = c?.company_id ?? c?.companyId; if (!id) throw new Error('Usuário sem empresa.'); const r = await apiRequest<Item>(`/users/company/${id}/activity?page=0&pageSize=50`, {}, token ?? undefined); const data = r.data as Item; setItems((data.items ?? data.events ?? []) as Item[]); }).catch(e => setError(e.message)); }, [token]);
  return <Screen title="Atividade"><LoadingOrError loading={!items.length && !error} error={error} />{items.length === 0 && !error && <ThemedText>Nenhuma atividade encontrada.</ThemedText>}{items.map((item, i) => <Card key={String(item.activity_id ?? item.activityId ?? i)}><ThemedText type="smallBold">{String(item.action ?? item.event_type ?? item.eventType ?? 'Atividade')}</ThemedText><ThemedText>{String(item.description ?? item.created_at ?? item.createdAt ?? '')}</ThemedText></Card>)}</Screen>;
}
