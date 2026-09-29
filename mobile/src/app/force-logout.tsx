import { useEffect } from 'react';
import { router } from 'expo-router';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/auth/AuthContext';
export default function ForceLogoutScreen() { const { signOut } = useAuth(); useEffect(() => { signOut(); }, [signOut]); return <Screen title="Sessão encerrada"><ThemedText>Sua sessão foi encerrada por segurança.</ThemedText><ThemedText type="linkPrimary" onPress={() => router.replace('/')}>Voltar ao login</ThemedText></Screen>; }
