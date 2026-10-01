import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
type User = Record<string, unknown>;
export default function AdminUsersScreen() {
  const { token } = useAuth(); const [users, setUsers] = useState<User[]>([]); const [search, setSearch] = useState(''); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<User>('/users/profile', {}, token ?? undefined).then(async (p) => { if (!p.data?.is_admin && !p.data?.isAdmin) throw new Error('Acesso administrativo necessário.'); const r = await apiRequest<User>('/admin/users?limit=100&offset=0', {}, token ?? undefined); const data = r.data as User; setUsers((data.items ?? data.users ?? []) as User[]); }).catch(e => setError(e.message)); }, [token]);
  const filtered = users.filter((user) => `${user.email ?? ''} ${user.first_name ?? user.firstName ?? ''} ${user.last_name ?? user.lastName ?? ''}`.toLowerCase().indexOf(search.toLowerCase()) !== -1);
  return <Screen title="Usuários admin"><TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nome ou e-mail" style={styles.input} /><LoadingOrError loading={!users.length && !error} error={error} />{filtered.map((user, i) => { const id = String(user.user_id ?? user.userId ?? i); return <Pressable key={id} onPress={() => router.push(`/admin-users/${id}`)}><Card><ThemedText type="smallBold">{String(user.email ?? '')}</ThemedText><ThemedText>{String(user.first_name ?? user.firstName ?? '')} {String(user.last_name ?? user.lastName ?? '')}</ThemedText></Card></Pressable>; })}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' } });
