import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { router } from 'expo-router';

export default function LoginScreen() {
  const { signIn, signInWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true); setError(null);
    try { await signIn(email.trim(), password); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar.'); } finally { setLoading(false); }
  }
  async function googleLogin() {
    setLoading(true); setError(null);
    try {
      const response = await apiRequest<{ authorizationUrl: string }>(`/oauth/google/start?intent=login&mobileRedirect=${encodeURIComponent('flaxflow://oauth/google')}`);
      const result = await WebBrowser.openAuthSessionAsync(response.data?.authorizationUrl ?? '', 'flaxflow://oauth/google');
      if (result.type === 'success' && result.url) {
        const token = new URL(result.url).searchParams.get('token');
        if (!token) throw new Error('O login Google não retornou um token.');
        await signInWithToken(token);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar com Google.'); } finally { setLoading(false); }
  }
  return <ThemedView style={styles.container}><SafeAreaView style={styles.content}>
    <ThemedText type="title">FlaxFlow</ThemedText>
    <ThemedText style={styles.subtitle}>Entre para acessar seus documentos e operações.</ThemedText>
    <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="E-mail" value={email} onChangeText={setEmail} style={styles.input} />
    <TextInput secureTextEntry placeholder="Senha" value={password} onChangeText={setPassword} style={styles.input} />
    {error && <ThemedText style={styles.error}>{error}</ThemedText>}
    <Pressable disabled={loading || !email || !password} onPress={submit} style={styles.button}>
      {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Entrar</ThemedText>}
    </Pressable>
    <Pressable disabled={loading} onPress={() => void googleLogin()} style={styles.googleButton}><ThemedText>Entrar com Google</ThemedText></Pressable>
    <Pressable onPress={() => router.push('/signup')}><ThemedText type="linkPrimary">Criar uma conta</ThemedText></Pressable>
    <Pressable onPress={() => router.push('/forgot-password')}><ThemedText type="linkPrimary">Esqueci minha senha</ThemedText></Pressable>
  </SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 }, subtitle: { opacity: 0.7 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#fff' }, button: { borderRadius: 12, padding: 15, alignItems: 'center', backgroundColor: '#208AEF' }, googleButton: { borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' }, buttonText: { color: '#fff', fontWeight: '700' }, error: { color: '#b91c1c' } });
