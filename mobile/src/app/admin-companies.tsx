import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type Item = Record<string, unknown>;
export default function AdminCompaniesScreen() {
  const { token } = useAuth(); const [items, setItems] = useState<Item[]>([]); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Item>('/users/profile', {}, token ?? undefined).then(async (p) => { if (!p.data?.is_admin && !p.data?.isAdmin) throw new Error('Acesso administrativo necessário.'); const r = await apiRequest<Item[]>('/admin/companies', {}, token ?? undefined); setItems(r.data ?? []); }).catch(e => setError(e.message)); }, [token]);
  return <Screen title="Empresas admin"><LoadingOrError loading={!items.length && !error} error={error} />{items.map((item, i) => <Card key={String(item.company_id ?? item.companyId ?? i)}><ThemedText type="smallBold">{String(item.name ?? 'Empresa')}</ThemedText><ThemedText>Usuários: {String(item.users_count ?? item.usersCount ?? item.memberCount ?? 0)}</ThemedText><ThemedText>Status: {String(item.status ?? 'ativa')}</ThemedText></Card>)}</Screen>;
}
