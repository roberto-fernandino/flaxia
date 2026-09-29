import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { apiRequest } from '@/lib/api';
import { Screen, Card, LoadingOrError } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const [invite, setInvite] = useState<Record<string, unknown>>(); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Record<string, unknown>>(`/users/company/invites/${id}`).then(r => setInvite(r.data)).catch(e => setError(e.message)); }, [id]);
  return <Screen title="Convite para empresa"><LoadingOrError loading={!invite && !error} error={error} />{invite && <><Card><ThemedText type="subtitle">Você foi convidado</ThemedText><ThemedText>Empresa: {String(invite.company_name ?? invite.companyName ?? 'FlaxFlow')}</ThemedText><ThemedText>E-mail: {String(invite.email ?? invite.invitedEmail ?? '')}</ThemedText></Card><Pressable onPress={() => router.push(`/signup?inviteId=${id}`)} style={styles.button}><ThemedText style={styles.white}>Aceitar e criar conta</ThemedText></Pressable></>}</Screen>;
}
const styles = StyleSheet.create({ button: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
