import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { router } from 'expo-router';

// Mirrors FlaxFlow.PortalAI.Frontend/src/app/login/page.tsx (palette from globals.css).
const palette = {
  light: { page: '#f3f4f6', card: '#ffffff', title: '#111827', muted: '#4b5563', label: '#374151', inputBg: '#ffffff', inputBorder: '#d1d5db', inputText: '#111827', placeholder: '#6b7280', divider: '#e5e7eb', teal: '#0891b2', tealPressed: '#0e7490', onTeal: '#020617', link: '#0891b2', strong: '#0f172a', footer: '#6b7280' },
  dark: { page: '#111827', card: '#1f2937', title: '#ffffff', muted: '#d1d5db', label: '#e5e7eb', inputBg: '#374151', inputBorder: '#4b5563', inputText: '#ffffff', placeholder: '#9ca3af', divider: '#4b5563', teal: '#22d3ee', tealPressed: '#0891b2', onTeal: '#020617', link: '#67e8f9', strong: '#e2e8f0', footer: '#9ca3af' },
};

const googleErrors: Record<string, string> = {
  not_linked: 'Conta Google não vinculada. Entre com e-mail/senha e vincule em Configurações.',
  not_configured: 'Login com Google não está configurado neste servidor.',
};
const GOOGLE_ERROR = 'Falha no login com Google. Tente novamente.';

export default function LoginScreen() {
  const { signIn, signInWithToken } = useAuth();
  const c = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const busy = loading || googleLoading;

  async function submit() {
    if (busy || !email.trim() || !password) return;
    setLoading(true); setError(null); setGoogleError(null);
    try { await signIn(email.trim(), password); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar.'); } finally { setLoading(false); }
  }

  async function googleLogin() {
    setGoogleLoading(true); setError(null); setGoogleError(null);
    try {
      const response = await apiRequest<{ authorizationUrl: string }>(`/oauth/google/start?intent=login&mobileRedirect=${encodeURIComponent('flaxflow://oauth/google')}`);
      const result = await WebBrowser.openAuthSessionAsync(response.data?.authorizationUrl ?? '', 'flaxflow://oauth/google');
      if (result.type === 'success' && result.url) {
        const params = new URL(result.url).searchParams;
        const token = params.get('token');
        const status = params.get('google');
        if (token) await signInWithToken(token);
        else setGoogleError(googleErrors[status ?? ''] ?? GOOGLE_ERROR);
      }
    } catch (e) { setGoogleError(e instanceof Error ? e.message : GOOGLE_ERROR); } finally { setGoogleLoading(false); }
  }

  const inputStyle = (field: 'email' | 'password') => [styles.input, { backgroundColor: c.inputBg, borderColor: focused === field ? c.teal : c.inputBorder, color: c.inputText }, focused === field && styles.inputFocused];

  return <View style={[styles.page, { backgroundColor: c.page }]}>
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image source={require('@/assets/images/flaxflow-logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="FlaxFlow" />
            <Text style={[styles.title, { color: c.title }]}>Bem-vindo de volta</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>Entre na sua conta do FlaxFlow</Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.card }]}>
            {googleError && <View style={styles.warning}><Text style={styles.warningText}>{googleError}</Text></View>}

            <View style={styles.field}>
              <Text style={[styles.label, { color: c.label }]}>E-mail</Text>
              <TextInput autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" returnKeyType="next" placeholder="Digite seu e-mail" placeholderTextColor={c.placeholder} value={email} onChangeText={setEmail} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} onSubmitEditing={() => passwordRef.current?.focus()} style={inputStyle('email')} />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: c.label }]}>Senha</Text>
              <TextInput ref={passwordRef} secureTextEntry autoComplete="password" textContentType="password" returnKeyType="go" placeholder="Digite sua senha" placeholderTextColor={c.placeholder} value={password} onChangeText={setPassword} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} onSubmitEditing={() => void submit()} style={inputStyle('password')} />
            </View>

            <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8} style={styles.forgot}>
              <Text style={[styles.forgotText, { color: c.strong }]}>Esqueceu a senha?</Text>
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable accessibilityRole="button" disabled={busy || !email.trim() || !password} onPress={() => void submit()} style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? c.tealPressed : c.teal }, (busy || !email.trim() || !password) && styles.disabled]}>
              {loading ? <ActivityIndicator color={c.onTeal} /> : <Text style={[styles.primaryText, { color: c.onTeal }]}>Entrar</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
              <Text style={[styles.dividerText, { color: c.placeholder }]}>ou</Text>
              <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
            </View>

            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void googleLogin()} style={({ pressed }) => [styles.secondary, { borderColor: c.inputBorder, backgroundColor: pressed ? c.divider : 'transparent' }, busy && styles.disabled]}>
              <Text style={[styles.secondaryText, { color: c.title }]}>{googleLoading ? 'Redirecionando para o Google…' : 'Entrar com Google'}</Text>
            </Pressable>

            <View style={styles.signupRow}>
              <Text style={[styles.signupText, { color: c.muted }]}>Não tem uma conta? </Text>
              <Pressable onPress={() => router.push('/signup')} hitSlop={8}>
                <Text style={[styles.signupLink, { color: c.link }]}>Cadastre-se aqui</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.footer, { color: c.footer }]}>© {new Date().getFullYear()} FlaxFlow. Todos os direitos reservados.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 240, height: 93, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, marginTop: 8, textAlign: 'center' },
  card: { borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  warning: { marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 8 },
  warningText: { fontSize: 14, color: '#78350f' },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
  inputFocused: { borderWidth: 2, paddingHorizontal: 15, paddingVertical: 11 },
  forgot: { alignSelf: 'flex-start', marginBottom: 20 },
  forgotText: { fontSize: 14, fontWeight: '500' },
  error: { color: '#b91c1c', fontSize: 14, marginBottom: 12 },
  primary: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  dividerText: { fontSize: 12 },
  secondary: { borderRadius: 8, borderWidth: 1, paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '500' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 },
  signupText: { fontSize: 14 },
  signupLink: { fontSize: 14, fontWeight: '500' },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 32 },
});
