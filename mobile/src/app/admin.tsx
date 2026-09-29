import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { router } from 'expo-router';
type Data = Record<string, unknown>;
export default function AdminScreen() {
  const { token } = useAuth(); const [profile, setProfile] = useState<Data>(); const [dashboard, setDashboard] = useState<Data>(); const [users, setUsers] = useState<Data[]>([]); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Data>('/users/profile', {}, token ?? undefined).then(async (p) => { setProfile(p.data); if (!p.data?.is_admin && !p.data?.isAdmin) { setError('Acesso administrativo necessário.'); return; } const [d, u] = await Promise.all([apiRequest<Data>('/admin/dashboard', {}, token ?? undefined), apiRequest<Data[]>('/admin/users', {}, token ?? undefined)]); setDashboard(d.data); setUsers(u.data ?? []); }).catch(e => setError(e.message)); }, [token]);
  const metrics = dashboard ? Object.entries(dashboard).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)) : [];
  return <Screen title="Administração"><LoadingOrError loading={!profile && !error} error={error} />{dashboard && <><ThemedText type="subtitle">Visão geral</ThemedText>{metrics.map(([key, value]) => <Card key={key}><ThemedText type="small">{key.replaceAll('_', ' ')}</ThemedText><ThemedText type="subtitle">{String(value)}</ThemedText></Card>)}</>}<ThemedText type="subtitle">Usuários</ThemedText>{users.map((user, i) => { const id = String(user.user_id ?? user.userId ?? i); return <Pressable key={id} onPress={() => router.push(`/admin/users/${id}`)}><Card><ThemedText type="smallBold">{String(user.email ?? '')}</ThemedText><ThemedText>{String(user.first_name ?? user.firstName ?? '')} {String(user.last_name ?? user.lastName ?? '')}</ThemedText><ThemedText type="linkPrimary">Abrir detalhe</ThemedText></Card></Pressable>; })}</Screen>;
}
